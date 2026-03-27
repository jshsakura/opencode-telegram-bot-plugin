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
  rateLimit: {
    enabled: boolean;
    minIntervalMs: number;
  };
  message: {
    maxLength: number;
    truncateSuffix: string;
    compactWhitespace: boolean;
  };
  batch: {
    enabled: boolean;
    intervalMs: number;
    maxBatchSize: number;
  };
  polling: {
    enabled: boolean;
  };
}

const DEFAULT_CONFIG: TelegramPluginConfig = {
  language: 'ko',
  notifications: {
    session: true,
    permission: true,
    todo: false,
    subtask: false,
    error: true,
    fileList: false,
  },
  dedup: {
    enabled: true,
    ttlMs: 300000, // 5 minutes
  },
  rateLimit: {
    enabled: true,
    minIntervalMs: 5000,
  },
  message: {
    maxLength: 900,
    truncateSuffix: '...',
    compactWhitespace: true,
  },
  batch: {
    enabled: true,
    intervalMs: 5000,
    maxBatchSize: 10,
  },
  polling: {
    enabled: false,
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
    language: parseLanguage(process.env['OPENCODE_TELEGRAM_LANGUAGE']),
    notifications: {
      session: parseBoolean(process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'], DEFAULT_CONFIG.notifications.session),
      permission: parseBoolean(process.env['OPENCODE_TELEGRAM_NOTIFY_PERMISSION'], DEFAULT_CONFIG.notifications.permission),
      todo: parseBoolean(process.env['OPENCODE_TELEGRAM_NOTIFY_TODO'], DEFAULT_CONFIG.notifications.todo),
      subtask: parseBoolean(process.env['OPENCODE_TELEGRAM_NOTIFY_SUBTASK'], DEFAULT_CONFIG.notifications.subtask),
      error: parseBoolean(process.env['OPENCODE_TELEGRAM_NOTIFY_ERROR'], DEFAULT_CONFIG.notifications.error),
      fileList: parseBoolean(process.env['OPENCODE_TELEGRAM_NOTIFY_FILE_LIST'], DEFAULT_CONFIG.notifications.fileList),
    },
    dedup: {
      enabled: parseBoolean(process.env['OPENCODE_TELEGRAM_DEDUP_ENABLED'], DEFAULT_CONFIG.dedup.enabled),
      ttlMs: parseNumber(process.env['OPENCODE_TELEGRAM_DEDUP_TTL_MS'], DEFAULT_CONFIG.dedup.ttlMs),
    },
    rateLimit: {
      enabled: parseBoolean(process.env['OPENCODE_TELEGRAM_RATE_LIMIT_ENABLED'], DEFAULT_CONFIG.rateLimit.enabled),
      minIntervalMs: parseNumber(process.env['OPENCODE_TELEGRAM_RATE_LIMIT_INTERVAL_MS'], DEFAULT_CONFIG.rateLimit.minIntervalMs),
    },
    message: {
      maxLength: parseNumber(process.env['OPENCODE_TELEGRAM_MESSAGE_MAX_LENGTH'], DEFAULT_CONFIG.message.maxLength),
      truncateSuffix: process.env['OPENCODE_TELEGRAM_MESSAGE_TRUNCATE_SUFFIX'] ?? DEFAULT_CONFIG.message.truncateSuffix,
      compactWhitespace: parseBoolean(process.env['OPENCODE_TELEGRAM_MESSAGE_COMPACT_WHITESPACE'], DEFAULT_CONFIG.message.compactWhitespace),
    },
    batch: {
      enabled: parseBoolean(process.env['OPENCODE_TELEGRAM_BATCH_ENABLED'], DEFAULT_CONFIG.batch.enabled),
      intervalMs: parseNumber(process.env['OPENCODE_TELEGRAM_BATCH_INTERVAL_MS'], DEFAULT_CONFIG.batch.intervalMs),
      maxBatchSize: parseNumber(process.env['OPENCODE_TELEGRAM_BATCH_MAX_SIZE'], DEFAULT_CONFIG.batch.maxBatchSize),
    },
    polling: {
      enabled: parseBoolean(process.env['OPENCODE_TELEGRAM_POLLING_ENABLED'], DEFAULT_CONFIG.polling.enabled),
    },
  };

  cachedConfig = config;
  return config;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
