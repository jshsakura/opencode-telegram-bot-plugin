import { describe, it, expect, vi, afterEach } from 'vitest';
import { EventRouter } from '../router.js';
import { clearConfigCache } from '../config.js';
import type { TelegramBridge } from '../telegram.js';

function makePermissionEvent() {
  return {
    type: 'permission.updated',
    properties: {
      sessionID: 's1',
      id: 'p1',
      title: 'Run command',
      metadata: {},
    },
  };
}

afterEach(() => {
  clearConfigCache();
  delete process.env['OPENCODE_TELEGRAM_NOTIFY_PERMISSION'];
  delete process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'];
  vi.useRealTimers();
});

describe('EventRouter permission notification toggle', () => {
  it('does not send permission message when OPENCODE_TELEGRAM_NOTIFY_PERMISSION=false', async () => {
    process.env['OPENCODE_TELEGRAM_NOTIFY_PERMISSION'] = 'false';

    const sendPermissionRequest = vi.fn(async () => {});
    const telegram = { sendPermissionRequest } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent(makePermissionEvent());
    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);

    expect(sendPermissionRequest).not.toHaveBeenCalled();
  });

  it('sends permission message when OPENCODE_TELEGRAM_NOTIFY_PERMISSION=true', async () => {
    process.env['OPENCODE_TELEGRAM_NOTIFY_PERMISSION'] = 'true';

    const sendPermissionRequest = vi.fn(async () => {});
    const telegram = { sendPermissionRequest } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent(makePermissionEvent());
    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);

    expect(sendPermissionRequest).toHaveBeenCalledTimes(1);
  });
});

describe('EventRouter idle notification deduping', () => {
  it('sends only one idle notification during the same idle cycle', async () => {
    vi.useFakeTimers();
    process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'true';

    const sendSessionIdle = vi.fn(async () => {});
    const telegram = { sendSessionIdle } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent({
      type: 'session.created',
      properties: { info: { id: 's1', title: 'Main Session' } },
    });

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'idle' } },
    });

    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).toHaveBeenCalledTimes(1);

    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).toHaveBeenCalledTimes(1);

    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);
  });

  it('suppresses repeated idle notifications after a busy-idle cycle when the payload is unchanged', async () => {
    vi.useFakeTimers();
    process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'true';

    const sendSessionIdle = vi.fn(async () => {});
    const telegram = { sendSessionIdle } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent({
      type: 'session.created',
      properties: { info: { id: 's1', title: 'Main Session' } },
    });
    await router.handleEvent({
      type: 'session.updated',
      properties: { info: { id: 's1', summary: { additions: 12, deletions: 3, files: 1 } } },
    });

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });
    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'idle' } },
    });
    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).toHaveBeenCalledTimes(1);

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });
    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'idle' } },
    });
    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).toHaveBeenCalledTimes(1);

    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);
  });

  it('allows a new idle notification after a busy-idle cycle when the payload changes', async () => {
    vi.useFakeTimers();
    process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'true';

    const sendSessionIdle = vi.fn(async () => {});
    const telegram = { sendSessionIdle } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent({
      type: 'session.created',
      properties: { info: { id: 's1', title: 'Main Session' } },
    });
    await router.handleEvent({
      type: 'session.updated',
      properties: { info: { id: 's1', summary: { additions: 12, deletions: 3, files: 1 } } },
    });

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });
    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'idle' } },
    });
    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).toHaveBeenCalledTimes(1);

    await router.handleEvent({
      type: 'session.updated',
      properties: { info: { id: 's1', summary: { additions: 18, deletions: 4, files: 2 } } },
    });
    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });
    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'idle' } },
    });
    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).toHaveBeenCalledTimes(2);

    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);
  });
});
