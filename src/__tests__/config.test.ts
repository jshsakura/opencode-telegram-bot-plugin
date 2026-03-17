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
      delete process.env['TELEGRAM_LANGUAGE'];
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should return default notifications.session as true', () => {
      delete process.env['TELEGRAM_NOTIFY_SESSION'];
      const config = getConfig();
      expect(config.notifications.session).toBe(true);
    });

    it('should return default notifications.permission as true', () => {
      delete process.env['TELEGRAM_NOTIFY_PERMISSION'];
      const config = getConfig();
      expect(config.notifications.permission).toBe(true);
    });

    it('should return default notifications.todo as true', () => {
      delete process.env['TELEGRAM_NOTIFY_TODO'];
      const config = getConfig();
      expect(config.notifications.todo).toBe(true);
    });

    it('should return default notifications.subtask as true', () => {
      delete process.env['TELEGRAM_NOTIFY_SUBTASK'];
      const config = getConfig();
      expect(config.notifications.subtask).toBe(true);
    });

    it('should return default notifications.error as true', () => {
      delete process.env['TELEGRAM_NOTIFY_ERROR'];
      const config = getConfig();
      expect(config.notifications.error).toBe(true);
    });

    it('should return default dedup.enabled as true', () => {
      delete process.env['TELEGRAM_DEDUP_ENABLED'];
      const config = getConfig();
      expect(config.dedup.enabled).toBe(true);
    });

    it('should return default dedup.ttlMs as 300000', () => {
      delete process.env['TELEGRAM_DEDUP_TTL_MS'];
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });
  });

  describe('language parsing', () => {
    it('should accept "ko" as language', () => {
      process.env['TELEGRAM_LANGUAGE'] = 'ko';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should accept "en" as language', () => {
      process.env['TELEGRAM_LANGUAGE'] = 'en';
      const config = getConfig();
      expect(config.language).toBe('en');
    });

    it('should accept "KO" (uppercase) as language', () => {
      process.env['TELEGRAM_LANGUAGE'] = 'KO';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should accept "EN" (uppercase) as language', () => {
      process.env['TELEGRAM_LANGUAGE'] = 'EN';
      const config = getConfig();
      expect(config.language).toBe('en');
    });

    it('should fallback to "ko" for invalid language', () => {
      process.env['TELEGRAM_LANGUAGE'] = 'fr';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should fallback to "ko" for empty string', () => {
      process.env['TELEGRAM_LANGUAGE'] = '';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });

    it('should fallback to "ko" for random string', () => {
      process.env['TELEGRAM_LANGUAGE'] = 'random';
      const config = getConfig();
      expect(config.language).toBe('ko');
    });
  });

  describe('boolean parsing', () => {
    it('should parse "true" as true', () => {
      process.env['TELEGRAM_NOTIFY_SESSION'] = 'true';
      const config = getConfig();
      expect(config.notifications.session).toBe(true);
    });

    it('should parse "TRUE" (uppercase) as true', () => {
      process.env['TELEGRAM_NOTIFY_SESSION'] = 'TRUE';
      const config = getConfig();
      expect(config.notifications.session).toBe(true);
    });

    it('should parse "false" as false', () => {
      process.env['TELEGRAM_NOTIFY_SESSION'] = 'false';
      const config = getConfig();
      expect(config.notifications.session).toBe(false);
    });

    it('should parse "FALSE" (uppercase) as false', () => {
      process.env['TELEGRAM_NOTIFY_SESSION'] = 'FALSE';
      const config = getConfig();
      expect(config.notifications.session).toBe(false);
    });

    it('should parse random string as false', () => {
      process.env['TELEGRAM_NOTIFY_SESSION'] = 'random';
      const config = getConfig();
      expect(config.notifications.session).toBe(false);
    });
  });

  describe('number parsing', () => {
    it('should parse valid number string', () => {
      process.env['TELEGRAM_DEDUP_TTL_MS'] = '60000';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(60000);
    });

    it('should fallback to default for NaN', () => {
      process.env['TELEGRAM_DEDUP_TTL_MS'] = 'not-a-number';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });

    it('should fallback to default for negative number', () => {
      process.env['TELEGRAM_DEDUP_TTL_MS'] = '-1000';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });

    it('should fallback to default for zero', () => {
      process.env['TELEGRAM_DEDUP_TTL_MS'] = '0';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });

    it('should fallback to default for empty string', () => {
      process.env['TELEGRAM_DEDUP_TTL_MS'] = '';
      const config = getConfig();
      expect(config.dedup.ttlMs).toBe(300000);
    });
  });

  describe('memoization', () => {
    it('should cache config after first call', () => {
      delete process.env['TELEGRAM_LANGUAGE'];
      const config1 = getConfig();
      
      process.env['TELEGRAM_LANGUAGE'] = 'en';
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
      delete process.env['TELEGRAM_LANGUAGE'];
      const config1 = getConfig();
      
      clearConfigCache();
      process.env['TELEGRAM_LANGUAGE'] = 'en';
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
});
