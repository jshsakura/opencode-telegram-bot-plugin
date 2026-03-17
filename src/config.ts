/**
 * Telegram Plugin Configuration Module
 */

export interface TelegramPluginConfig {
  language: 'ko' | 'en';
  notifications: {
    session: boolean;
    permission: boolean;
    todo: boolean;
    subtask: boolean;
    error: boolean;
    fileList: boolean;
  };
  dedup: {
    enabled: boolean;
    ttlMs: number;
  };
}

const DEFAULT_CONFIG: TelegramPluginConfig = {
  language: 'ko',
  notifications: {
    session: true,
    permission: true,
    todo: true,
    subtask: true,
    error: true,
    fileList: true,
  },
  dedup: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
  },
};

let cachedConfig: TelegramPluginConfig | null = null;

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseLanguage(value: string | undefined): 'ko' | 'en' {
  if (value === undefined) return DEFAULT_CONFIG.language;
  const normalized = value.toLowerCase();
  if (normalized === 'ko' || normalized === 'en') {
    return normalized;
  }
  return DEFAULT_CONFIG.language;
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

export function getConfig(): TelegramPluginConfig {
  if (cachedConfig !== null) {
    return cachedConfig;
  }

  const config: TelegramPluginConfig = {
    language: parseLanguage(process.env['TELEGRAM_LANGUAGE']),
    notifications: {
      session: parseBoolean(process.env['TELEGRAM_NOTIFY_SESSION'], DEFAULT_CONFIG.notifications.session),
      permission: parseBoolean(process.env['TELEGRAM_NOTIFY_PERMISSION'], DEFAULT_CONFIG.notifications.permission),
      todo: parseBoolean(process.env['TELEGRAM_NOTIFY_TODO'], DEFAULT_CONFIG.notifications.todo),
      subtask: parseBoolean(process.env['TELEGRAM_NOTIFY_SUBTASK'], DEFAULT_CONFIG.notifications.subtask),
      error: parseBoolean(process.env['TELEGRAM_NOTIFY_ERROR'], DEFAULT_CONFIG.notifications.error),
      fileList: parseBoolean(process.env['TELEGRAM_NOTIFY_FILE_LIST'], DEFAULT_CONFIG.notifications.fileList),
    },
    dedup: {
      enabled: parseBoolean(process.env['TELEGRAM_DEDUP_ENABLED'], DEFAULT_CONFIG.dedup.enabled),
      ttlMs: parseNumber(process.env['TELEGRAM_DEDUP_TTL_MS'], DEFAULT_CONFIG.dedup.ttlMs),
    },
  };

  cachedConfig = config;
  return config;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
