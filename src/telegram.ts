import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TelegramConfig, PermissionCallbackHandler, InlineKeyboardButton, TelegramUpdate, SessionSummary, FileDiff } from './types.js';
import { t } from './i18n/index.js';
import { getConfig } from './config.js';
import { checkAndStore } from './dedup.js';

const LOCK_PATH = path.join(os.tmpdir(), 'opencode-telegram-bot.lock');
const MAX_BACKOFF_MS = 60_000;
const INITIAL_BACKOFF_MS = 5_000;
const PENDING_PERMISSION_TTL_MS = 30 * 60 * 1000;

interface PendingPermission {
  sessionID: string;
  permissionID: string;
  createdAt: number;
}

interface QueuedMessage {
  text: string;
  inlineKeyboard?: InlineKeyboardButton[][];
  priority: 'high' | 'normal';
}

export class TelegramBridge {
  private botToken: string;
  private chatId: string;
  private callbackHandler: PermissionCallbackHandler | null = null;
  private polling = false;
  private pollOffset = 0;
  private lockFd: number | null = null;
  private isPollingOwner = false;
  
  // callback_data shortening: monotonic counter -> (sessionID, permissionID)
  private nextCallbackKey = 1;
  private pendingPermissions = new Map<number, PendingPermission>();

  private lastSendTime = 0;
  private messageQueue: QueuedMessage[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private sendChain: Promise<void> = Promise.resolve();
  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
  }

  onPermissionCallback(handler: PermissionCallbackHandler): void {
    this.callbackHandler = handler;
  }

  async start(): Promise<void> {
    if (this.polling) return;

    const config = getConfig();
    if (!config.polling.enabled) {
      console.log('[opencode-telegram-bot] Polling disabled (send-only mode). Set OPENCODE_TELEGRAM_POLLING_ENABLED=true to enable.');
      return;
    }

    this.polling = true;
    this.isPollingOwner = this.acquirePollLock();

    if (this.isPollingOwner) {
        console.log('[opencode-telegram-bot] Bot polling started (this instance owns the poll lock)');
      this.pollLoop();
    } else {
        console.log('[opencode-telegram-bot] Another instance is polling. This instance will only send notifications.');
    }
  }

  // Synchronous — safe to call from process.on("exit")
  stop(): void {
    this.polling = false;
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.messageQueue.length > 0 && !this.isFlushing) {
      void this.flushBatchQueue(getConfig());
    }
    this.releasePollLock();
  }

  private acquirePollLock(): boolean {
    try {
      // O_WRONLY | O_CREAT | O_EXCL — atomic create-or-fail
      const fd = fs.openSync(LOCK_PATH, 'wx');
      // Write PID through the same fd to avoid race window
      const pidBuf = Buffer.from(String(process.pid));
      fs.writeSync(fd, pidBuf, 0, pidBuf.length, 0);
      this.lockFd = fd;
      return true;
    } catch {
      // File exists — check if owning process is still alive
      try {
        const content = fs.readFileSync(LOCK_PATH, 'utf-8').trim();
        const pid = parseInt(content, 10);
        if (pid && !isProcessRunning(pid)) {
          // Stale lock — remove and retry once
          fs.unlinkSync(LOCK_PATH);
          try {
            const fd = fs.openSync(LOCK_PATH, 'wx');
            const pidBuf = Buffer.from(String(process.pid));
            fs.writeSync(fd, pidBuf, 0, pidBuf.length, 0);
            this.lockFd = fd;
            return true;
          } catch {
            // Another process grabbed the lock between unlink and open
          }
        }
      } catch {
        // Lock file disappeared or unreadable — another instance won
      }
      return false;
    }
  }

  private releasePollLock(): void {
    if (!this.isPollingOwner) return;
    
    try {
      if (this.lockFd !== null) {
        fs.closeSync(this.lockFd);
        this.lockFd = null;
      }
      fs.unlinkSync(LOCK_PATH);
    } catch {
      // Lock file may already be removed
    }
    this.isPollingOwner = false;
  }

  private async pollLoop(): Promise<void> {
    let backoff = INITIAL_BACKOFF_MS;
    
    while (this.polling) {
      try {
        const updates = await this.apiCall<TelegramUpdate[]>('getUpdates', {
          offset: this.pollOffset,
          timeout: 30,
          allowed_updates: ['callback_query'],
        });
        
        backoff = INITIAL_BACKOFF_MS;
        
        for (const update of updates) {
          this.pollOffset = update.update_id + 1;
          if (update.callback_query?.data) {
            await this.handleCallbackQuery(update);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('409') || msg.toLowerCase().includes('conflict')) {
          console.log('[opencode-telegram-bot] Another instance is polling (409 Conflict). Switching to send-only mode.');
          this.polling = false;
          this.releasePollLock();
          return;
        }
        console.error('[opencode-telegram-bot] Poll error:', msg);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
      }
    }
  }

  private async handleCallbackQuery(update: TelegramUpdate): Promise<void> {
    const cq = update.callback_query!;
    const data = cq.data;
    
    if (!this.callbackHandler) {
      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'No handler available',
      });
      return;
    }

    // Parse short callback_data: "p:<key>:<response>"
    const parts = data.split(':');
    if (parts[0] !== 'p' || parts.length < 3) {
      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'Invalid callback',
      });
      return;
    }

    const key = parseInt(parts[1], 10);
    const response = parts[2] as 'once' | 'always' | 'reject';
    
    if (response !== 'once' && response !== 'reject' && response !== 'always') {
      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'Invalid response',
      });
      return;
    }

    this.cleanupPendingPermissions();
    const pending = this.pendingPermissions.get(key);
    if (!pending) {
      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: 'Permission request expired',
      });
      return;
    }

    const { sessionID, permissionID } = pending;

    try {
      await this.callbackHandler(sessionID, permissionID, response);
      this.pendingPermissions.delete(key);

      const lang = getConfig().language;
      const label = response === 'once'
        ? t('button.allowed', lang)
        : response === 'always'
          ? t('button.always_allowed', lang)
          : t('button.rejected', lang);

      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: label,
      });

      if (cq.message) {
        try {
          const newText = `${cq.message.text || ''}\n\n→ ${label}`;
          await this.apiCall('editMessageText', {
            chat_id: cq.message.chat.id,
            message_id: cq.message.message_id,
            text: newText,
          });
        } catch {
          // editMessageText can fail on old/unchanged messages — non-critical
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      await this.apiCall('answerCallbackQuery', {
        callback_query_id: cq.id,
        text: `Error: ${msg}`.slice(0, 200),
      });
    }
  }

  async sendSessionIdle(
    sessionTitle: string, 
    sessionID: string, 
    summary?: SessionSummary, 
    diffs?: FileDiff[],
    waitingForUser?: boolean
  ): Promise<void> {
    const lang = getConfig().language;
    const titleKey = waitingForUser ? 'session.idle.waiting_for_input' : 'session.idle.title';
    const lines = [
      `<b>${t(titleKey, lang)}</b>`,
      `<code>${escapeHtml(sessionTitle || sessionID)}</code>`,
    ];

    if (summary && (summary.additions > 0 || summary.deletions > 0)) {
      lines.push(`<b>+${summary.additions}</b>/<b>-${summary.deletions}</b>`);
    }

    if (diffs && diffs.length > 0) {
      lines.push(`<b>${t('session.idle.files', lang)}</b>`);
      for (const diff of diffs) {
        lines.push(`• <code>${escapeHtml(diff.file)}</code>`);
      }
    }

    await this.sendMessage(lines.join('\n'));
  }

  async sendPermissionRequest(
    sessionID: string,
    permissionID: string,
    title: string,
    metadata: Record<string, unknown>
  ): Promise<void> {
    const config = getConfig();
    const lang = config.language;
    const lines = [
      `<b>${t('permission.title', lang)}</b>`,
    ];

    lines.push(`<i>${t('permission.action', lang)}:</i>`);
    lines.push(`  ${escapeHtml(title)}`);

    if (metadata['command']) {
      lines.push(`<i>${t('permission.command', lang)}:</i>`);
      lines.push(`  <code>${escapeHtml(String(metadata['command']))}</code>`);
    }
    if (metadata['path']) {
      lines.push(`<i>${t('permission.path', lang)}:</i>`);
      lines.push(`  <code>${escapeHtml(String(metadata['path']))}</code>`);
    }

    if (config.polling.enabled) {
      this.cleanupPendingPermissions();
      const key = this.nextCallbackKey++;
      this.pendingPermissions.set(key, { sessionID, permissionID, createdAt: Date.now() });

      const keyboard: InlineKeyboardButton[][] = [
        [
          { text: t('permission.allow', lang), callback_data: `p:${key}:once` },
          { text: t('permission.always', lang), callback_data: `p:${key}:always` },
          { text: t('permission.reject', lang), callback_data: `p:${key}:reject` },
        ],
      ];

      await this.sendMessage(lines.join('\n'), keyboard, true);
    } else {
      lines.push('');
      lines.push(`<i>${t('permission.respond_in_app', lang)}</i>`);
      await this.sendMessage(lines.join('\n'), undefined, true);
    }
  }

  async sendTodosComplete(_sessionID: string, todos: Array<{ content: string }>): Promise<void> {
    const lang = getConfig().language;
    const lines = [
      `<b>${t('todos.title', lang)}</b>`,
    ];
    
    for (const todo of todos.slice(0, 10)) {
      lines.push(`  ✓ ${escapeHtml(todo.content)}`);
    }
    if (todos.length > 10) {
      lines.push(``);
      lines.push(`  <i>${t('todos.more', lang).replace('N', String(todos.length - 10))}</i>`);
    }

    await this.sendMessage(lines.join('\n'));
  }

  async sendSubtaskStarted(description: string, agent: string, prompt?: string): Promise<void> {
    const lang = getConfig().language;
    const lines = [
      `<b>${t('subtask.title', lang)}</b>`,
      `<i>${t('subtask.agent', lang)}:</i> <b>${escapeHtml(agent)}</b>`,
      `<i>${t('subtask.description', lang)}:</i>`,
      `  ${escapeHtml(description)}`,
    ];

    if (prompt) {
      const truncated = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
      lines.push(`<i>${t('subtask.prompt', lang)}:</i>`);
      lines.push(`  <code>${escapeHtml(truncated)}</code>`);
    }

    await this.sendMessage(lines.join('\n'));
  }

  async sendError(message: string, sessionTitle?: string): Promise<void> {
    const lang = getConfig().language;
    const lines = [
      `<b>${t('error.title', lang)}</b>`,
    ];
    
    if (sessionTitle) {
      lines.push(`<i>${t('session.idle.session', lang)}:</i> <code>${escapeHtml(sessionTitle)}</code>`);
    }
    lines.push(`<code>${escapeHtml(message)}</code>`);

    await this.sendMessage(lines.join('\n'));
  }

  private async sendMessage(text: string, inlineKeyboard?: InlineKeyboardButton[][], skipDedup?: boolean): Promise<void> {
    const config = getConfig();

    let processedText = config.message.compactWhitespace
      ? this.compactWhitespace(text)
      : text;

    processedText = this.truncateMessage(processedText, config.message.maxLength, config.message.truncateSuffix);

    if (!skipDedup && config.dedup.enabled) {
      try {
        const shouldSend = await checkAndStore(processedText, config.dedup.ttlMs);
        if (!shouldSend) {
          return;
        }
      } catch {
      }
    }

    const priority: 'high' | 'normal' = skipDedup ? 'high' : 'normal';

    if (config.batch.enabled && priority === 'normal') {
      this.messageQueue.push({ text: processedText, inlineKeyboard, priority });
      this.scheduleBatchFlush(config);
    } else {
      await this.sendWithRateLimit(processedText, inlineKeyboard, config);
    }
  }

  private compactWhitespace(text: string): string {
    const parts = text.split(/(<code>[\s\S]*?<\/code>)/g);

    return parts
      .map((part, index) => {
        if (index % 2 === 1) {
          return part;
        }

        return part
          .replace(/[ \t]+/g, ' ')
          .replace(/\n{3,}/g, '\n\n');
      })
      .join('')
      .trim();
  }

  private cleanupPendingPermissions(): void {
    const now = Date.now();
    for (const [key, pending] of this.pendingPermissions.entries()) {
      if (now - pending.createdAt > PENDING_PERMISSION_TTL_MS) {
        this.pendingPermissions.delete(key);
      }
    }
  }

  private truncateMessage(text: string, maxLength: number, suffix: string): string {
    if (text.length <= maxLength) return text;

    if (maxLength <= 0) return '';
    if (suffix.length >= maxLength) return suffix.slice(0, maxLength);

    return text.slice(0, maxLength - suffix.length) + suffix;
  }

  private scheduleBatchFlush(config: ReturnType<typeof getConfig>): void {
    if (this.batchTimer) return;
    
    if (this.messageQueue.length >= config.batch.maxBatchSize) {
      this.flushBatchQueue(config);
      return;
    }

    this.batchTimer = setTimeout(() => {
      this.batchTimer = null;
      this.flushBatchQueue(getConfig());
    }, config.batch.intervalMs);
  }

  private async flushBatchQueue(config: ReturnType<typeof getConfig>): Promise<void> {
    if (this.isFlushing || this.messageQueue.length === 0) return;
    
    this.isFlushing = true;
    
    try {
      const batch = this.messageQueue.splice(0, config.batch.maxBatchSize);
      
      if (batch.length === 1) {
        const msg = batch[0];
        await this.sendWithRateLimit(msg.text, msg.inlineKeyboard, config);
      } else {
        const combinedText = batch.map((m, i) => `━━━ [${i + 1}] ━━━\n${m.text}`).join('\n\n');
        const truncated = this.truncateMessage(combinedText, config.message.maxLength, config.message.truncateSuffix);
        await this.sendWithRateLimit(truncated, undefined, config);
      }
    } finally {
      this.isFlushing = false;
      
      if (this.messageQueue.length > 0) {
        this.scheduleBatchFlush(config);
      }
    }
  }

  private async sendWithRateLimit(
    text: string, 
    inlineKeyboard: InlineKeyboardButton[][] | undefined, 
    config: ReturnType<typeof getConfig>
  ): Promise<void> {
    const task = async () => {
      if (config.rateLimit.enabled) {
        const now = Date.now();
        const elapsed = now - this.lastSendTime;
        const minInterval = config.rateLimit.minIntervalMs;

        if (elapsed < minInterval) {
          await sleep(minInterval - elapsed);
        }
        this.lastSendTime = Date.now();
      }

      try {
        await this.apiCall('sendMessage', {
          chat_id: this.chatId,
          text,
          parse_mode: 'HTML',
          ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
        });
      } catch (err) {
        console.error('[opencode-telegram-bot] Failed to send message:', err instanceof Error ? err.message : err);
      }
    };

    const next = this.sendChain.then(task, task);
    this.sendChain = next.catch(() => {});
    await next;
  }

  private apiCall<T>(method: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const settle = (fn: (value: T) => void, value: T) => {
        if (settled) return;
        settled = true;
        fn(value);
      };

      const body = JSON.stringify(payload);
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${this.botToken}/${method}`,
          method: 'POST',
          family: 4,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          timeout: method === 'getUpdates' ? 35000 : 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.ok) {
                settle(resolve, parsed.result);
              } else {
                reject(new Error(`Telegram API error: ${parsed.description || 'unknown'}`));
              }
            } catch {
              reject(new Error(`Invalid JSON response: ${data.slice(0, 100)}`));
            }
          });
        }
      );

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Request timeout for ${method}`));
      });

      req.write(body);
      req.end();
    });
  }
}

// Utility functions
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
