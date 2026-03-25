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
  delete process.env['TELEGRAM_NOTIFY_PERMISSION'];
});

describe('EventRouter permission notification toggle', () => {
  it('does not send permission message when TELEGRAM_NOTIFY_PERMISSION=false', async () => {
    process.env['TELEGRAM_NOTIFY_PERMISSION'] = 'false';

    const sendPermissionRequest = vi.fn(async () => {});
    const telegram = { sendPermissionRequest } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent(makePermissionEvent());
    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);

    expect(sendPermissionRequest).not.toHaveBeenCalled();
  });

  it('sends permission message when TELEGRAM_NOTIFY_PERMISSION=true', async () => {
    process.env['TELEGRAM_NOTIFY_PERMISSION'] = 'true';

    const sendPermissionRequest = vi.fn(async () => {});
    const telegram = { sendPermissionRequest } as unknown as TelegramBridge;
    const router = new EventRouter(telegram);

    await router.handleEvent(makePermissionEvent());
    clearInterval((router as unknown as { evictTimer: NodeJS.Timeout }).evictTimer);

    expect(sendPermissionRequest).toHaveBeenCalledTimes(1);
  });
});
