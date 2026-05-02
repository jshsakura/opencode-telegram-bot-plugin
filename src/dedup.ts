import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const DEFAULT_TTL_MS = 300000;

const STORAGE_PATH = path.join(os.tmpdir(), 'opencode-telegram-bot-dedup.json');
const LOCK_PATH = path.join(os.tmpdir(), 'opencode-telegram-bot-dedup.lock');
const LOCK_RETRY_MS = 10;
const LOCK_TIMEOUT_MS = 2000;
const LOCK_STALE_MS = 3000;

interface HashEntry {
  timestamp: number;
}

interface Storage {
  [hash: string]: HashEntry;
}

function hashMessage(message: string): string {
  return crypto.createHash('sha256').update(message).digest('hex');
}

function readStorage(): Storage {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      return {};
    }
    const data = fs.readFileSync(STORAGE_PATH, 'utf-8');
    return JSON.parse(data) as Storage;
  } catch {
    return {};
  }
}

function writeStorage(storage: Storage): void {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(storage, null, 2), 'utf-8');
  } catch {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryReclaimStaleLock(): boolean {
  try {
    const stat = fs.statSync(LOCK_PATH);
    if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
      try {
        fs.unlinkSync(LOCK_PATH);
      } catch {}
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

async function withStorageLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const startedAt = Date.now();

  while (true) {
    let fd: number | null = null;

    try {
      fd = fs.openSync(LOCK_PATH, 'wx');
      return await fn();
    } catch {
      if (tryReclaimStaleLock()) {
        continue;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {}
        return await fn();
      }
      await sleep(LOCK_RETRY_MS);
    } finally {
      if (fd !== null) {
        try {
          fs.closeSync(fd);
        } catch {}

        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {}
      }
    }
  }
}

function cleanupExpired(storage: Storage, now: number, ttlMs: number): Storage {
  const cleaned: Storage = {};
  for (const [hash, entry] of Object.entries(storage)) {
    if (now - entry.timestamp < ttlMs) {
      cleaned[hash] = entry;
    }
  }
  return cleaned;
}

/**
 * Check if message should be sent and store hash if so.
 * Returns true if message should be sent (not duplicate).
 * Returns false if message is duplicate (within TTL).
 */
export async function checkAndStore(message: string, ttlMs: number = DEFAULT_TTL_MS): Promise<boolean> {
  try {
    return await withStorageLock(() => {
      const now = Date.now();
      const messageHash = hashMessage(message);
      let storage = readStorage();
      storage = cleanupExpired(storage, now, ttlMs);

      if (storage[messageHash]) {
        return false;
      }

      storage[messageHash] = { timestamp: now };
      writeStorage(storage);
      return true;
    });
  } catch {
    return true;
  }
}

export function clear(): void {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      fs.unlinkSync(STORAGE_PATH);
    }
  } catch {}
}
