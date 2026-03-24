import type { OpenCodeEvent, SessionState, SessionSummary, FileDiff } from './types.js';
import { TelegramBridge } from './telegram.js';
import { getConfig } from './config.js';

const SESSION_MAX_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_EVICT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export class EventRouter {
  private telegram: TelegramBridge;
  private sessionStates = new Map<string, SessionState>();
  private sessionTitles = new Map<string, string>();
  private sessionSummaries = new Map<string, SessionSummary>();
  private sessionDiffs = new Map<string, FileDiff[]>();
  private sessionTodoPending = new Map<string, boolean>(); // true = has unfinished todos
  private idleDebounceTimers = new Map<string, NodeJS.Timeout>(); // debounce idle notifs
  private evictTimer: NodeJS.Timeout;

  private static readonly IDLE_DEBOUNCE_MS = 15_000; // 15s — survives system-reminder cycles

  constructor(telegram: TelegramBridge) {
    this.telegram = telegram;
    this.evictTimer = setInterval(() => this.evictStaleSessions(), SESSION_EVICT_INTERVAL_MS);
    this.evictTimer.unref();
  }

  private evictStaleSessions(): void {
    const cutoff = Date.now() - SESSION_MAX_IDLE_MS;
    for (const [id, state] of this.sessionStates) {
      if (state.lastSeenAt < cutoff) {
        this.sessionStates.delete(id);
        this.sessionTitles.delete(id);
        this.sessionSummaries.delete(id);
        this.sessionDiffs.delete(id);
        this.sessionTodoPending.delete(id);
        const t = this.idleDebounceTimers.get(id);
        if (t) { clearTimeout(t); this.idleDebounceTimers.delete(id); }
      }
    }
  }

  async handleEvent(event: OpenCodeEvent): Promise<void> {
    switch (event.type) {
      case 'session.status':
        await this.handleSessionStatus(event);
        break;
      case 'session.idle':
        await this.handleSessionIdle(event);
        break;
      case 'permission.updated':
        await this.handlePermissionUpdated(event);
        break;
      case 'todo.updated':
        await this.handleTodoUpdated(event);
        break;
      case 'message.part.updated':
        await this.handleMessagePartUpdated(event);
        break;
      case 'session.updated': {
        const props = event.properties as { 
          info: { 
            id: string; 
            title?: string;
            summary?: SessionSummary;
          } 
        };
        if (props.info.title) {
          this.sessionTitles.set(props.info.id, props.info.title);
        }
        if (props.info.summary) {
          this.sessionSummaries.set(props.info.id, props.info.summary);
        }
        break;
      }
      case 'session.diff': {
        const props = event.properties as { 
          sessionID: string; 
          diff: FileDiff[] 
        };
        this.sessionDiffs.set(props.sessionID, props.diff);
        break;
      }
      case 'session.created': {
        const props = event.properties as { info: { id: string; title?: string } };
        if (props.info.title) {
          this.sessionTitles.set(props.info.id, props.info.title);
        }
        break;
      }
      case 'session.error':
        await this.handleSessionError(event);
        break;
    }
  }

  private isNoiseSession(sessionID: string, title?: string): boolean {
    // No title received yet is NOT enough to call it noise —
    // check if it literally looks like an auto-generated session ID (ses_xxxx)
    const effectiveTitle = title || sessionID;
    if (/^ses_[a-zA-Z0-9]+$/.test(effectiveTitle)) return true;
    const lowerTitle = effectiveTitle.toLowerCase();
    if (lowerTitle.includes('subagent)') || lowerTitle.includes('(@')) return true;
    return false;
  }

  private async handleSessionStatus(event: OpenCodeEvent): Promise<void> {
    const { sessionID, status } = event.properties as {
      sessionID: string;
      status: { type: 'busy' | 'idle' | 'retry' };
    };
    const now = Date.now();
    const prev = this.sessionStates.get(sessionID);

    if (status.type === 'busy') {
      // Cancel any pending idle notification — session is active again
      const existing = this.idleDebounceTimers.get(sessionID);
      if (existing) { clearTimeout(existing); this.idleDebounceTimers.delete(sessionID); }
      this.sessionStates.set(sessionID, {
        ...prev,
        status: 'busy',
        lastBusyAt: now,
        lastSeenAt: now,
      });
    } else if (status.type === 'idle') {
      this.sessionStates.set(sessionID, {
        ...prev,
        status: 'idle',
        lastSeenAt: now,
      });
    } else if (status.type === 'retry') {
      this.sessionStates.set(sessionID, {
        ...prev,
        status: 'retry',
        lastSeenAt: now,
      });
    }
  }

  private async handleSessionIdle(event: OpenCodeEvent): Promise<void> {
    if (!getConfig().notifications.session) return;

    const { sessionID } = event.properties as { sessionID: string };
    const state = this.sessionStates.get(sessionID);

    if (!state || state.status !== 'idle') return;

    const title = this.sessionTitles.get(sessionID) || sessionID;
    if (this.isNoiseSession(sessionID, title)) return;

    // Cancel any existing debounce for this session and reschedule
    const existing = this.idleDebounceTimers.get(sessionID);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.idleDebounceTimers.delete(sessionID);
      // Re-check status — if it went busy again, skip
      const current = this.sessionStates.get(sessionID);
      if (!current || current.status !== 'idle') return;

      const summary = this.sessionSummaries.get(sessionID);
      const waitingForUser = this.sessionTodoPending.get(sessionID) === true;
      const diffs = getConfig().notifications.fileList
        ? this.sessionDiffs.get(sessionID)
        : undefined;

      await this.telegram.sendSessionIdle(title, sessionID, summary, diffs, waitingForUser);
    }, EventRouter.IDLE_DEBOUNCE_MS);

    timer.unref();
    this.idleDebounceTimers.set(sessionID, timer);
  }

  private async handlePermissionUpdated(event: OpenCodeEvent): Promise<void> {
    const perm = event.properties as {
      sessionID: string;
      id: string;
      title: string;
      metadata: Record<string, unknown>;
    };
    await this.telegram.sendPermissionRequest(perm.sessionID, perm.id, perm.title, perm.metadata);
  }

  private async handleTodoUpdated(event: OpenCodeEvent): Promise<void> {
    if (!getConfig().notifications.todo) return;

    const { sessionID, todos } = event.properties as {
      sessionID: string;
      todos: Array<{
        content: string;
        status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
      }>;
    };

    if (todos.length === 0) return;

    const allCompleted = todos.every(
      (t) => t.status === 'completed' || t.status === 'cancelled'
    );

    // Track whether there are pending/in-progress todos for the waiting-for-user signal
    this.sessionTodoPending.set(sessionID, !allCompleted);

    if (allCompleted) {
      await this.telegram.sendTodosComplete(sessionID, todos);
    }
  }

  private async handleMessagePartUpdated(event: OpenCodeEvent): Promise<void> {
    const { part } = event.properties as {
      part: {
        type: string;
        description?: string;
        agent?: string;
        prompt?: string;
      };
    };

    if (part.type === 'subtask') {
      if (!getConfig().notifications.subtask) return;
      await this.telegram.sendSubtaskStarted(
        part.description || '',
        part.agent || 'unknown',
        part.prompt
      );
    }
  }

  private async handleSessionError(event: OpenCodeEvent): Promise<void> {
    if (!getConfig().notifications.error) return;

    const { sessionID, error } = event.properties as {
      sessionID: string;
      error?: {
        data?: {
          message?: string;
        };
      };
    };

    if (!error) return;

    let message = 'Unknown error';
    if ('data' in error && error.data && 'message' in error.data) {
      message = String(error.data.message);
    }

    const title = this.sessionTitles.get(sessionID) || sessionID;
    if (this.isNoiseSession(sessionID, title)) return;

    if (message === 'The operation was aborted.' || message.startsWith('Model not found:')) {
      return;
    }

    await this.telegram.sendError(message, title !== sessionID ? title : sessionID);
  }
}
