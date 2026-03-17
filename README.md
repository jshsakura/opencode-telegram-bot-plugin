# @jshsakura/opencode-telegram-bot-plugin

[OpenCode](https://opencode.ai) plugin that sends Telegram notifications when tasks complete, and lets you respond to permission requests directly from your phone.

## Features

- Task completion notifications
- Permission request handling with inline buttons (Allow / Always / Reject)
- Todo list completion summaries
- Subtask start notifications
- Error notifications

## Installation

```bash
npm install @jshsakura/opencode-telegram-bot-plugin
```

## Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the instructions
3. Copy the **bot token**

### 2. Get Your Chat ID

1. Send any message to your bot
2. Open: `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find `"chat":{"id":123456789}` — that's your chat ID

### 3. Set Environment Variables

```bash
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_CHAT_ID="your-chat-id"
```

### 4. Add to OpenCode

Add to `~/.config/opencode/opencode.json`:

```json
{
  "plugin": [
    "@jshsakura/opencode-telegram-bot-plugin"
  ]
}
```

### 5. Restart OpenCode

```bash
opencode
```

## Notifications

| Event | Notification |
|-------|-------------|
| Task completes | ✅ Task Complete |
| Permission needed | 🔔 Permission Request (with buttons) |
| All todos done | 📋 All Tasks Complete |
| Subtask spawned | 🔀 Subtask Started |
| Session error | ❌ Error |

## License

MIT
