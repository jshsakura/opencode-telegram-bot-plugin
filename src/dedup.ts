import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { isProcessRunning } from './process-utils.js';

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
    // Write to a per-process temp file and rename into place — rename is
    // atomic on the same filesystem, so a reader never observes a
    // half-written/corrupted STORAGE_PATH even under heavy contention.
    const tmpPath = `${STORAGE_PATH}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(storage), 'utf-8');
    fs.renameSync(tmpPath, STORAGE_PATH);
  } catch {}
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryReclaimStaleLock(): boolean {
  try {
    // Fast path: the lock's owning process has already died. Reclaim
    // immediately instead of making every other instance wait out the
    // full LOCK_STALE_MS window just because one holder crashed.
    try {
      const content = fs.readFileSync(LOCK_PATH, 'utf-8').trim();
      const pid = parseInt(content, 10);
      if (Number.isFinite(pid) && pid > 0 && !isProcessRunning(pid)) {
        try {
          fs.unlinkSync(LOCK_PATH);
        } catch {}
        return true;
      }
    } catch {}

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

async function withStorageLock<T>(fn: () => T | Promise<T>): Promise<T | undefined> {
  const startedAt = Date.now();

  while (true) {
    let fd: number | null = null;

    try {
      fd = fs.openSync(LOCK_PATH, 'wx');
      const pidBuf = Buffer.from(String(process.pid));
      fs.writeSync(fd, pidBuf, 0, pidBuf.length, 0);
      return await fn();
    } catch {
      if (tryReclaimStaleLock()) {
        continue;
      }
      if (Date.now() - startedAt >= LOCK_TIMEOUT_MS) {
        // Give up without the lock. Do NOT fall through to an unprotected
        // read-modify-write here — under real multi-instance contention
        // that races with whoever holds the lock and can corrupt the
        // storage file for every instance sharing it. Failing open (skip
        // dedup, still send) is the safe degradation.
        return undefined;
      }
      // Jitter so multiple waiting instances don't retry in lockstep.
      await sleep(LOCK_RETRY_MS + Math.random() * LOCK_RETRY_MS);
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
    const result = await withStorageLock(() => {
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
    // Lock wasn't acquired in time — fail open (allow send) rather than
    // risk corrupting shared dedup state under contention.
    return result ?? true;
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
