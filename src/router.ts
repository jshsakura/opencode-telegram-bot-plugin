import type { OpenCodeEvent, SessionState } from './types.js';
import { TelegramBridge } from './telegram.js';

const SESSION_MAX_IDLE_MS = 2 * 60 * 60 * 1000; // 2 hours
const SESSION_EVICT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export class EventRouter {
  private telegram: TelegramBridge;
  private sessionStates = new Map<string, SessionState>();
  private sessionTitles = new Map<string, string>();
  private evictTimer: NodeJS.Timeout;

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
        const props = event.properties as { info: { id: string; title?: string } };
        if (props.info.title) {
          this.sessionTitles.set(props.info.id, props.info.title);
        }
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

  private async handleSessionStatus(event: OpenCodeEvent): Promise<void> {
    const { sessionID, status } = event.properties as {
      sessionID: string;
      status: { type: 'busy' | 'idle' | 'retry' };
    };
    const now = Date.now();
    const prev = this.sessionStates.get(sessionID);

    if (status.type === 'busy') {
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
    const { sessionID } = event.properties as { sessionID: string };
    const state = this.sessionStates.get(sessionID);

    if (!state || state.status !== 'idle') return;

    const title = this.sessionTitles.get(sessionID) || sessionID;
    await this.telegram.sendSessionIdle(title, sessionID);
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
    const { todos } = event.properties as {
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

    if (allCompleted) {
      await this.telegram.sendTodosComplete(
        (event.properties as { sessionID: string }).sessionID,
        todos
      );
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
      await this.telegram.sendSubtaskStarted(
        part.description || '',
        part.agent || 'unknown',
        part.prompt
      );
    }
  }

  private async handleSessionError(event: OpenCodeEvent): Promise<void> {
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

    await this.telegram.sendError(message, sessionID);
  }
}
