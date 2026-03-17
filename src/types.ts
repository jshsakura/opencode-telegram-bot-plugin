// Telegram API Types
export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export interface TelegramUpdate {
  update_id: number;
  callback_query?: {
    id: string;
    data: string;
    message?: {
      chat: { id: number };
      message_id: number;
      text?: string;
    };
  };
}

export interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

// Permission callback handler
export type PermissionCallbackHandler = (
  sessionID: string,
  permissionID: string,
  response: 'once' | 'always' | 'reject'
) => Promise<void>;

// Session state tracking
export interface SessionState {
  status: 'busy' | 'idle' | 'retry';
  lastBusyAt?: number;
  lastSeenAt: number;
}

// OpenCode Event Types
export interface OpenCodeEvent {
  type: string;
  properties: Record<string, unknown>;
}

export interface SessionStatusEvent extends OpenCodeEvent {
  type: 'session.status';
  properties: {
    sessionID: string;
    status: { type: 'busy' | 'idle' | 'retry' };
  };
}

export interface SessionIdleEvent extends OpenCodeEvent {
  type: 'session.idle';
  properties: {
    sessionID: string;
  };
}

export interface PermissionUpdatedEvent extends OpenCodeEvent {
  type: 'permission.updated';
  properties: {
    sessionID: string;
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  };
}

export interface TodoUpdatedEvent extends OpenCodeEvent {
  type: 'todo.updated';
  properties: {
    sessionID: string;
    todos: Array<{
      content: string;
      status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
    }>;
  };
}

export interface MessagePartUpdatedEvent extends OpenCodeEvent {
  type: 'message.part.updated';
  properties: {
    part: {
      type: string;
      description?: string;
      agent?: string;
      prompt?: string;
    };
  };
}

export interface SessionUpdatedEvent extends OpenCodeEvent {
  type: 'session.updated';
  properties: {
    info: {
      id: string;
      title?: string;
    };
  };
}

export interface SessionCreatedEvent extends OpenCodeEvent {
  type: 'session.created';
  properties: {
    info: {
      id: string;
      title?: string;
    };
  };
}

export interface SessionErrorEvent extends OpenCodeEvent {
  type: 'session.error';
  properties: {
    sessionID: string;
    error?: {
      data?: {
        message?: string;
      };
    };
  };
}
