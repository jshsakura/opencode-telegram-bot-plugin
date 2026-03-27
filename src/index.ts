import { TelegramBridge } from './telegram.js';
import { EventRouter } from './router.js';

interface PluginContext {
  client: {
    postSessionIdPermissionsPermissionId: (params: {
      path: { id: string; permissionID: string };
      query: { directory: string };
      body: { response: string };
    }) => Promise<void>;
  };
  directory: string;
}

interface PluginResult {
  event?: (params: { event: { type: string; properties: Record<string, unknown> } }) => Promise<void>;
}

const OpencodeTelegram = async (ctx: PluginContext): Promise<PluginResult> => {
  const botToken = process.env['OPENCODE_TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['OPENCODE_TELEGRAM_CHAT_ID'];

  if (!botToken || !chatId) {
    console.warn(
        '[opencode-telegram-bot] Missing OPENCODE_TELEGRAM_BOT_TOKEN or OPENCODE_TELEGRAM_CHAT_ID environment variables. Plugin disabled.'
    );
    return {};
  }

  const telegram = new TelegramBridge({ botToken, chatId });
  const router = new EventRouter(telegram);

  telegram.onPermissionCallback(async (sessionID, permissionID, response) => {
    try {
      await ctx.client.postSessionIdPermissionsPermissionId({
        path: { id: sessionID, permissionID },
        query: { directory: ctx.directory },
        body: { response },
      });
    } catch (err) {
      console.error(
      '[opencode-telegram-bot] Failed to reply to permission:',
        err instanceof Error ? err.message : err
      );
    }
  });

  await telegram.start();

  return {
    async event({ event }) {
      // Fire-and-forget: don't block the host's event pipeline
      router.handleEvent(event).catch((err) => {
        console.error(
          '[opencode-telegram-bot] Event handler error:',
          err instanceof Error ? err.message : err
        );
      });
    },
  };
};

export default OpencodeTelegram;
