# @jshsakura/opencode-telegram-bot-plugin

[OpenCode](https://opencode.ai) plugin that sends Telegram notifications when tasks complete, and lets you respond to permission requests directly from your phone.

## Features

- Task completion notifications
- Permission request handling with inline buttons (Allow / Always / Reject)
- Todo list completion summaries
- Subtask start notifications
- Error notifications
- Session summary with file list and change statistics
- Multi-language support (Korean, English)
- Notification filtering to control which alerts you receive
- Duplicate notification prevention with configurable TTL

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

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token (required) | - |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID (required) | - |
| `TELEGRAM_LANGUAGE` | Language for notifications (`ko` or `en`) | `ko` |
| `TELEGRAM_NOTIFY_SESSION` | Session idle notifications | `true` |
| `TELEGRAM_NOTIFY_PERMISSION` | Permission request notifications | `true` |
| `TELEGRAM_NOTIFY_TODO` | Todo completion notifications | `true` |
| `TELEGRAM_NOTIFY_SUBTASK` | Subtask start notifications | `true` |
| `TELEGRAM_NOTIFY_ERROR` | Error notifications | `true` |
| `TELEGRAM_NOTIFY_FILE_LIST` | File list in session summary | `true` |
| `TELEGRAM_DEDUP_ENABLED` | Enable duplicate notification filtering | `true` |
| `TELEGRAM_DEDUP_TTL_MS` | Deduplication TTL in milliseconds | `300000` (5 min) |

## Multi-language Support

The plugin supports Korean and English notifications:

```bash
# Korean (default)
export TELEGRAM_LANGUAGE="ko"

# English
export TELEGRAM_LANGUAGE="en"
```

## Notification Filtering

Control which notifications you want to receive:

```bash
# Disable session idle notifications
export TELEGRAM_NOTIFY_SESSION="false"

# Disable file list in session summary
export TELEGRAM_NOTIFY_FILE_LIST="false"

# Disable todo completion summaries
export TELEGRAM_NOTIFY_TODO="false"

# Disable subtask notifications
export TELEGRAM_NOTIFY_SUBTASK="false"

# Disable error notifications (not recommended)
export TELEGRAM_NOTIFY_ERROR="false"
```

Permission notifications cannot be disabled as they require your response.

## Local Testing

Test the plugin locally before publishing:

```bash
# Build
npm run build

# Run tests
npm test

# Test with npm link (in plugin directory)
npm link

# Use in another project
cd /path/to/your-project
npm link @jshsakura/opencode-telegram-bot-plugin

# After testing, unlink
npm unlink -g @jshsakura/opencode-telegram-bot-plugin
```

Or use directly with file path:

```json
{
  "plugin": [
    "./path/to/opencode-telegram-bot-plugin"
  ]
}
```

## Deduplication

Prevents duplicate notifications for the same event within a time window:

```bash
# Enable dedup (default)
export TELEGRAM_DEDUP_ENABLED="true"

# Set TTL to 10 minutes
export TELEGRAM_DEDUP_TTL_MS="600000"
```

## Notifications

| Event | Notification |
|-------|-------------|
| Task completes | ✅ Task Complete |
| Permission needed | 🔔 Permission Request (with buttons) |
| All todos done | 📋 All Tasks Complete |
| Subtask spawned | 🔀 Subtask Started |
| Session idle | 💤 Session Idle |
| Session done | 📊 Session Summary (files, changes) |
| Error occurred | ❌ Error |

## License

MIT
