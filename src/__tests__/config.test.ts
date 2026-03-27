import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getConfig, clearConfigCache, TelegramPluginConfig } from '../config.js';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearConfigCache();
  });

  afterEach(() => {
    clearConfigCache();
    Object.keys(originalEnv).forEach(key => {
      if (process.env[key] !== originalEnv[key]) {
        if (originalEnv[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = originalEnv[key];
        }
      }
    });
  });

  describe('default values', () => {
    it('should return default language as ko', () => {
      delete process.env['OPENCODE_TELEGRAM_LANGUAGE'];
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should return default notifications.session as true', () => {
      delete process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'];
      const config = getConfig();
      expect(config.notifications.session).toBe(true);
    });

    it('should return default notifications.permission as true', () => {
      delete process.env['OPENCODE_TELEGRAM_NOTIFY_PERMISSION'];
      const config = getConfig();
      expect(config.notifications.permission).toBe(true);
    });

    it('should return default notifications.todo as false', () => {
      delete process.env['OPENCODE_TELEGRAM_NOTIFY_TODO'];
      const config = getConfig();
      expect(config.notifications.todo).toBe(false);
    });

    it('should return default notifications.subtask as false', () => {
      delete process.env['OPENCODE_TELEGRAM_NOTIFY_SUBTASK'];
      const config = getConfig();
      expect(config.notifications.subtask).toBe(false);
    });

    it('should return default notifications.fileList as false', () => {
      delete process.env['OPENCODE_TELEGRAM_NOTIFY_FILE_LIST'];
      const config = getConfig();
      expect(config.notifications.fileList).toBe(false);
    });

    it('should return default notifications.error as true', () => {
      delete process.env['OPENCODE_TELEGRAM_NOTIFY_ERROR'];
      const config = getConfig();
      expect(config.notifications.error).toBe(true);
    });

    it('should return default dedup.enabled as true', () => {
      delete process.env['OPENCODE_TELEGRAM_DEDUP_ENABLED'];
      const config = getConfig();
      expect(config.dedup.enabled).toBe(true);
    });

    it('should return default dedup.ttlMs as 300000', () => {
      delete process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'];
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });
  });

  describe('language parsing', () => {
    it('should accept "ko" as language', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'ko';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should accept "en" as language', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'en';
      const config = getConfig();
      expect(config.language).toBe('en');
    });

    it('should accept "KO" (uppercase) as language', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'KO';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should accept "EN" (uppercase) as language', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'EN';
      const config = getConfig();
      expect(config.language).toBe('en');
    });

    it('should fallback to "ko" for invalid language', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'fr';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should fallback to "ko" for empty string', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = '';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should fallback to "ko" for random string', () => {
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'random';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });
  });

  describe('boolean parsing', () => {
    it('should parse "true" as true', () => {
      process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'true';
      const config = getConfig();
      expect(config.notifications.session).toBe(true);
    });

    it('should parse "TRUE" (uppercase) as true', () => {
      process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'TRUE';
      const config = getConfig();
      expect(config.notifications.session).toBe(true);
    });

    it('should parse "false" as false', () => {
      process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'false';
      const config = getConfig();
      expect(config.notifications.session).toBe(false);
    });

    it('should parse "FALSE" (uppercase) as false', () => {
      process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'FALSE';
      const config = getConfig();
      expect(config.notifications.session).toBe(false);
    });

    it('should parse random string as false', () => {
      process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'random';
      const config = getConfig();
      expect(config.notifications.session).toBe(false);
    });
  });

  describe('number parsing', () => {
    it('should parse valid number string', () => {
      process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'] = '60000';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(60000);
    });

    it('should fallback to default for NaN', () => {
      process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'] = 'not-a-number';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });

    it('should fallback to default for negative number', () => {
      process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'] = '-1000';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });

    it('should fallback to default for zero', () => {
      process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'] = '0';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });

    it('should fallback to default for empty string', () => {
      process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'] = '';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });
  });

  describe('memoization', () => {
    it('should cache config after first call', () => {
      delete process.env['OPENCODE_TELEGRAM_LANGUAGE'];
      const config1 = getConfig();
      
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'en';
      const config2 = getConfig();
      
      expect(config1.language).toBe('ko');
      expect(config2.language).toBe('ko');
    });

    it('should return same object reference on subsequent calls', () => {
      const config1 = getConfig();
      const config2 = getConfig();
      expect(config1).toBe(config2);
    });

    it('should reload config after cache cleared', () => {
      delete process.env['OPENCODE_TELEGRAM_LANGUAGE'];
      const config1 = getConfig();
      
      clearConfigCache();
      process.env['OPENCODE_TELEGRAM_LANGUAGE'] = 'en';
      const config2 = getConfig();
      
      expect(config1.language).toBe('ko');
      expect(config2.language).toBe('en');
    });
  });

  describe('type safety', () => {
    it('should return TelegramPluginConfig type', () => {
      const config: TelegramPluginConfig = getConfig();
      expect(config).toHaveProperty('language');
      expect(config).toHaveProperty('notifications');
      expect(config).toHaveProperty('dedup');
    });
  });

  describe('rateLimit config', () => {
    it('should return default rateLimit.enabled as true', () => {
      delete process.env['OPENCODE_TELEGRAM_RATE_LIMIT_ENABLED'];
      const config = getConfig();
      expect(config.rateLimit.enabled).toBe(true);
    });

    it('should return default rateLimit.minIntervalMs as 5000', () => {
      delete process.env['OPENCODE_TELEGRAM_RATE_LIMIT_INTERVAL_MS'];
      const config = getConfig();
      expect(config.rateLimit.minIntervalMs).toBe(5000);
    });

    it('should parse rateLimit.enabled from env', () => {
      process.env['OPENCODE_TELEGRAM_RATE_LIMIT_ENABLED'] = 'false';
      const config = getConfig();
      expect(config.rateLimit.enabled).toBe(false);
    });

    it('should parse rateLimit.minIntervalMs from env', () => {
      process.env['OPENCODE_TELEGRAM_RATE_LIMIT_INTERVAL_MS'] = '2000';
      const config = getConfig();
      expect(config.rateLimit.minIntervalMs).toBe(2000);
    });
  });

  describe('message config', () => {
    it('should return default message.maxLength as 900', () => {
      delete process.env['OPENCODE_TELEGRAM_MESSAGE_MAX_LENGTH'];
      const config = getConfig();
      expect(config.message.maxLength).toBe(900);
    });

    it('should return default message.truncateSuffix as ...', () => {
      delete process.env['OPENCODE_TELEGRAM_MESSAGE_TRUNCATE_SUFFIX'];
      const config = getConfig();
      expect(config.message.truncateSuffix).toBe('...');
    });

    it('should return default message.compactWhitespace as true', () => {
      delete process.env['OPENCODE_TELEGRAM_MESSAGE_COMPACT_WHITESPACE'];
      const config = getConfig();
      expect(config.message.compactWhitespace).toBe(true);
    });

    it('should parse message.maxLength from env', () => {
      process.env['OPENCODE_TELEGRAM_MESSAGE_MAX_LENGTH'] = '3000';
      const config = getConfig();
      expect(config.message.maxLength).toBe(3000);
    });

    it('should parse message.truncateSuffix from env', () => {
      process.env['OPENCODE_TELEGRAM_MESSAGE_TRUNCATE_SUFFIX'] = '…';
      const config = getConfig();
      expect(config.message.truncateSuffix).toBe('…');
    });

    it('should parse message.compactWhitespace from env', () => {
      process.env['OPENCODE_TELEGRAM_MESSAGE_COMPACT_WHITESPACE'] = 'false';
      const config = getConfig();
      expect(config.message.compactWhitespace).toBe(false);
    });
  });

  describe('batch config', () => {
    it('should return default batch.enabled as true', () => {
      delete process.env['OPENCODE_TELEGRAM_BATCH_ENABLED'];
      const config = getConfig();
      expect(config.batch.enabled).toBe(true);
    });

    it('should return default batch.intervalMs as 5000', () => {
      delete process.env['OPENCODE_TELEGRAM_BATCH_INTERVAL_MS'];
      const config = getConfig();
      expect(config.batch.intervalMs).toBe(5000);
    });

    it('should return default batch.maxBatchSize as 10', () => {
      delete process.env['OPENCODE_TELEGRAM_BATCH_MAX_SIZE'];
      const config = getConfig();
      expect(config.batch.maxBatchSize).toBe(10);
    });

    it('should parse batch.enabled from env', () => {
      process.env['OPENCODE_TELEGRAM_BATCH_ENABLED'] = 'false';
      const config = getConfig();
      expect(config.batch.enabled).toBe(false);
    });

    it('should parse batch.intervalMs from env', () => {
      process.env['OPENCODE_TELEGRAM_BATCH_INTERVAL_MS'] = '5000';
      const config = getConfig();
      expect(config.batch.intervalMs).toBe(5000);
    });

    it('should parse batch.maxBatchSize from env', () => {
      process.env['OPENCODE_TELEGRAM_BATCH_MAX_SIZE'] = '10';
      const config = getConfig();
      expect(config.batch.maxBatchSize).toBe(10);
    });
  });
});
