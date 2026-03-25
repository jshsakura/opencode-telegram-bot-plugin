import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { checkAndStore, clear, DEFAULT_TTL_MS } from '../dedup.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const STORAGE_PATH = path.join(os.tmpdir(), 'opencode-telegram-bot-dedup.json');

describe('dedup', () => {
  beforeEach(() => {
    clear();
  });

  afterEach(() => {
    clear();
  });

  describe('DEFAULT_TTL_MS', () => {
    it('should be 5 minutes (300000ms)', () => {
      expect(DEFAULT_TTL_MS).toBe(300000);
    });
  });

  describe('checkAndStore', () => {
    it('should return true for new message', async () => {
      const result = await checkAndStore('test message');
      expect(result).toBe(true);
    });

    it('should return false for duplicate message within TTL', async () => {
      await checkAndStore('test message');
      const result = await checkAndStore('test message');
      expect(result).toBe(false);
    });

    it('should return true for same message after TTL expires', async () => {
      const shortTtl = 100;
      await checkAndStore('test message', shortTtl);
      
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = await checkAndStore('test message', shortTtl);
      expect(result).toBe(true);
    });

    it('should handle different messages independently', async () => {
      const result1 = await checkAndStore('message 1');
      const result2 = await checkAndStore('message 2');
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });

    it('should store hash with timestamp in file', async () => {
      await checkAndStore('test message');
      
      const data = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8'));
      const keys = Object.keys(data);
      
      expect(keys.length).toBe(1);
      expect(data[keys[0]]).toHaveProperty('timestamp');
      expect(typeof data[keys[0]].timestamp).toBe('number');
    });

    it('should clean up expired entries on check', async () => {
      const shortTtl = 50;
      await checkAndStore('old message', shortTtl);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await checkAndStore('new message', shortTtl);
      
      const data = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf-8'));
      const messages = Object.keys(data);
      
      expect(messages.length).toBe(1);
    });

    it('should use default TTL when not specified', async () => {
      const result = await checkAndStore('test');
      expect(result).toBe(true);
    });

    it('should return true on file read error (graceful degradation)', async () => {
      fs.writeFileSync(STORAGE_PATH, 'invalid json{', 'utf-8');
      
      const result = await checkAndStore('test message');
      expect(result).toBe(true);
    });

    it('should return true on file write error (graceful degradation)', async () => {
      const originalWriteFileSync = fs.writeFileSync;
      vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('Write error');
      });
      
      const result = await checkAndStore('test message');
      expect(result).toBe(true);
      
      vi.restoreAllMocks();
    });
  });

  describe('clear', () => {
    it('should remove storage file', async () => {
      await checkAndStore('test message');
      expect(fs.existsSync(STORAGE_PATH)).toBe(true);
      
      clear();
      
      expect(fs.existsSync(STORAGE_PATH)).toBe(false);
    });

    it('should not throw when file does not exist', () => {
      clear();
      expect(() => clear()).not.toThrow();
    });
  });
});
