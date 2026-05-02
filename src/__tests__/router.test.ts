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
  delete process.env['OPENCODE_TELEGRAM_IDLE_MIN_BUSY_MS'];
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

    // Long-running busy phase — passes the min-busy threshold.
    await vi.advanceTimersByTimeAsync(65_000);

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
    await vi.advanceTimersByTimeAsync(65_000);
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
    await vi.advanceTimersByTimeAsync(65_000);
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

  it('suppresses idle notifications within the per-session cooldown even when payload changes', async () => {
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
    await vi.advanceTimersByTimeAsync(65_000);
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
    await vi.advanceTimersByTimeAsync(65_000);
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

  it('allows another idle notification once the per-session cooldown has elapsed', async () => {
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
    await vi.advanceTimersByTimeAsync(65_000);
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

    // Wait past the 5-min per-session cooldown.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 1_000);

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });
    await vi.advanceTimersByTimeAsync(65_000);
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

  it('suppresses idle notifications when the busy phase was shorter than the min-busy threshold', async () => {
    vi.useFakeTimers();
    process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'true';

    const sendSessionIdle = vi.fn(async () => {});
    const telegram = { sendSessionIdle } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent({
      type: 'session.created',
      properties: { info: { id: 's1', title: 'Quick Task' } },
    });

    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'busy' } },
    });
    // Only ~10s of work — shorter than the default 60s threshold.
    await vi.advanceTimersByTimeAsync(10_000);
    await router.handleEvent({
      type: 'session.status',
      properties: { sessionID: 's1', status: { type: 'idle' } },
    });
    await router.handleEvent({
      type: 'session.idle',
      properties: { sessionID: 's1' },
    });

    await vi.advanceTimersByTimeAsync(15_000);
    expect(sendSessionIdle).not.toHaveBeenCalled();

    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);
  });

  it('respects OPENCODE_TELEGRAM_IDLE_MIN_BUSY_MS=0 to disable the threshold', async () => {
    vi.useFakeTimers();
    process.env['OPENCODE_TELEGRAM_NOTIFY_SESSION'] = 'true';
    process.env['OPENCODE_TELEGRAM_IDLE_MIN_BUSY_MS'] = '0';

    const sendSessionIdle = vi.fn(async () => {});
    const telegram = { sendSessionIdle } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent({
      type: 'session.created',
      properties: { info: { id: 's1', title: 'Anything' } },
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

    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);
  });
});
