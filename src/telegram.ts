import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type { TelegramConfig, PermissionCallbackHandler, InlineKeyboardButton, TelegramUpdate, SessionSummary, FileDiff } from './types.js';
import { t } from './i18n/index.js';
import { getConfig } from './config.js';
import { checkAndStore } from './dedup.js';

const LOCK_PATH = path.join(os.tmpdir(), 'opencode-telegram.lock');
const MAX_BACKOFF_MS = 60_000;
const INITIAL_BACKOFF_MS = 5_000;

interface PendingPermission {
  sessionID: string;
  permissionID: string;
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

  constructor(config: TelegramConfig) {
    this.botToken = config.botToken;
    this.chatId = config.chatId;
  }

  onPermissionCallback(handler: PermissionCallbackHandler): void {
    this.callbackHandler = handler;
  }

  async start(): Promise<void> {
    if (this.polling) return;
    
    this.polling = true;
    this.isPollingOwner = this.acquirePollLock();
    
    if (this.isPollingOwner) {
      console.log('[opencode-telegram] Bot polling started (this instance owns the poll lock)');
      this.pollLoop();
    } else {
      console.log('[opencode-telegram] Another instance is polling. This instance will only send notifications.');
    }
  }

  // Synchronous — safe to call from process.on("exit")
  stop(): void {
    this.polling = false;
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
        });
        
        backoff = INITIAL_BACKOFF_MS;
        
        for (const update of updates) {
          this.pollOffset = update.update_id + 1;
          if (update.callback_query?.data) {
            await this.handleCallbackQuery(update);
          }
        }
      } catch (err) {
        console.error('[opencode-telegram] Poll error:', err instanceof Error ? err.message : err);
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
    diffs?: FileDiff[]
  ): Promise<void> {
    const lang = getConfig().language;
    const lines = [
      `<b>${t('session.idle.title', lang)}</b>`,
      ``,
      `<b>${t('session.idle.session', lang)}:</b> ${escapeHtml(sessionTitle || sessionID)}`,
    ];

    if (summary) {
      lines.push('');
      lines.push(`<b>${t('session.idle.stats', lang)}</b> +${summary.additions} / -${summary.deletions}`);
    }

    if (diffs && diffs.length > 0) {
      lines.push('');
      lines.push(`<b>${t('session.idle.files', lang)}:</b>`);
      for (const diff of diffs) {
        lines.push(`  <code>${escapeHtml(diff.file)}</code>`);
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
    const lang = getConfig().language;
    const lines = [`<b>${t('permission.title', lang)}</b>`, ``];
    lines.push(`<b>${t('permission.action', lang)}:</b> ${escapeHtml(title)}`);

    if (metadata['command']) {
      lines.push(`<b>${t('permission.command', lang)}:</b> <code>${escapeHtml(String(metadata['command']))}</code>`);
    }
    if (metadata['path']) {
      lines.push(`<b>${t('permission.path', lang)}:</b> <code>${escapeHtml(String(metadata['path']))}</code>`);
    }

    const key = this.nextCallbackKey++;
    this.pendingPermissions.set(key, { sessionID, permissionID });

    // callback_data format: "p:<key>:<response>"
    const keyboard: InlineKeyboardButton[][] = [
      [
        { text: t('permission.allow', lang), callback_data: `p:${key}:once` },
        { text: t('permission.always', lang), callback_data: `p:${key}:always` },
        { text: t('permission.reject', lang), callback_data: `p:${key}:reject` },
      ],
    ];

    await this.sendMessage(lines.join('\n'), keyboard, true);
  }

  async sendTodosComplete(_sessionID: string, todos: Array<{ content: string }>): Promise<void> {
    const lang = getConfig().language;
    const lines = [`<b>${t('todos.title', lang)}</b>`, ``];
    
    for (const todo of todos.slice(0, 10)) {
      lines.push(`  ✅ ${escapeHtml(todo.content)}`);
    }
    if (todos.length > 10) {
      lines.push(`  ${t('todos.more', lang).replace('N', String(todos.length - 10))}`);
    }

    await this.sendMessage(lines.join('\n'));
  }

  async sendSubtaskStarted(description: string, agent: string, prompt?: string): Promise<void> {
    const lang = getConfig().language;
    const lines = [
      `<b>${t('subtask.title', lang)}</b>`,
      ``,
      `<b>${t('subtask.agent', lang)}:</b> ${escapeHtml(agent)}`,
      `<b>${t('subtask.description', lang)}:</b> ${escapeHtml(description)}`,
    ];

    if (prompt) {
      const truncated = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
      lines.push(`<b>${t('subtask.prompt', lang)}:</b> ${escapeHtml(truncated)}`);
    }

    await this.sendMessage(lines.join('\n'));
  }

  async sendError(message: string, sessionID?: string): Promise<void> {
    const lang = getConfig().language;
    const lines = [`<b>${t('error.title', lang)}</b>`, ``];
    
    if (sessionID) {
      lines.push(`<b>${t('session.idle.session', lang)}:</b> ${escapeHtml(sessionID)}`);
    }
    lines.push(escapeHtml(message));

    await this.sendMessage(lines.join('\n'));
  }

  private async sendMessage(text: string, inlineKeyboard?: InlineKeyboardButton[][], skipDedup?: boolean): Promise<void> {
    // Check dedup before sending (skip for permission requests)
    if (!skipDedup) {
      const config = getConfig();
      if (config.dedup.enabled) {
        try {
          const shouldSend = await checkAndStore(text, config.dedup.ttlMs);
          if (!shouldSend) {
            // Duplicate message within TTL, skip sending
            return;
          }
        } catch {
          // If dedup check fails, proceed with sending (graceful degradation)
        }
      }
    }

    try {
      await this.apiCall('sendMessage', {
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        ...(inlineKeyboard ? { reply_markup: { inline_keyboard: inlineKeyboard } } : {}),
      });
    } catch (err) {
      console.error('[opencode-telegram] Failed to send message:', err instanceof Error ? err.message : err);
    }
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
