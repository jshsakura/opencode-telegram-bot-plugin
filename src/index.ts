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
  const botToken = process.env['TELEGRAM_BOT_TOKEN'];
  const chatId = process.env['TELEGRAM_CHAT_ID'];

  if (!botToken || !chatId) {
    console.warn(
      '[opencode-telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables. Plugin disabled.'
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
        '[opencode-telegram] Failed to reply to permission:',
        err instanceof Error ? err.message : err
      );
    }
  });

  await telegram.start();

  const cleanup = () => telegram.stop();
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', cleanup);

  return {
    async event({ event }) {
      await router.handleEvent(event);
    },
  };
};

export default OpencodeTelegram;
