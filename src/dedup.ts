import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const DEFAULT_TTL_MS = 300000;

const STORAGE_PATH = path.join(os.tmpdir(), 'opencode-telegram-bot-dedup.json');

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
