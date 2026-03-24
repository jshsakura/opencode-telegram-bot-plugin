# @jshsakura/opencode-telegram-bot-plugin

[OpenCode](https://opencode.ai) plugin that sends smart Telegram notifications — only what matters, beautifully formatted.

## Features

- 🔔 **Permission request handling** with inline buttons (Allow / Always / Reject)
- ✨ **Smart idle notifications** — shows whether the session completed or is waiting for your input
- 📊 **Session summary** with file change stats and expandable file list
- 📋 **Todo completion summaries**
- ❌ **Error notifications** — filtered to only show real errors (not aborts or subagent noise)
- 🤫 **Subagent noise filtering** — background/unnamed sessions are silently ignored
- 🌐 **Multi-language support** (Korean, English)
- 🔁 **Duplicate notification prevention** with configurable TTL
- ⚡ **409 Conflict safe** — multiple OpenCode instances don't fight over polling

## Installation

```bash
npm install -g @jshsakura/opencode-telegram-bot-plugin
```

## Update

```bash
npm update -g @jshsakura/opencode-telegram-bot-plugin
```

After updating, restart OpenCode.

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

### 4. Add to OpenCode Global Config

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
| `TELEGRAM_NOTIFY_FILE_LIST` | Expandable file list in session summary | `true` |
| `TELEGRAM_DEDUP_ENABLED` | Enable duplicate notification filtering | `true` |
| `TELEGRAM_DEDUP_TTL_MS` | Deduplication TTL in milliseconds | `300000` (5 min) |

## Noise Filtering (v1.1.0+)

The plugin automatically suppresses notifications from:

- **Subagents** — sessions with titles like `(@explore subagent)`, `(@oracle subagent)` etc.
- **Unnamed background sessions** — sessions where the title is just a raw session ID (`ses_xxxx`)
- **Generic errors** — `The operation was aborted.` and `Model not found:` errors are silently dropped
- **Todo completions** from subagent/background sessions are also suppressed (v1.1.4+)
- **Subtask notifications** from subagent sessions or with subagent-style agent names are also suppressed (v1.1.4+)

This keeps your Telegram clean when using multi-agent workflows like **Oh My OpenCode**.

## Idle Notification Debounce (v1.1.2+)

Idle notifications are delayed **15 seconds** before being sent. If the session goes busy again within that window (e.g. due to `system-reminder` injections), the notification is cancelled.

This prevents rapid idle→busy→idle cycles from spamming your Telegram.

## Smart Wait Detection (v1.1.0+)

When a session goes idle, the plugin checks if there are unfinished todos:

- **Unfinished todos remaining** → `⏳ 사용자 입력을 기다리고 있습니다` — you need to act
- **All todos done** → `✨ 작업 완료 및 사용자 대기` — clean completion

No extra LLM calls or API requests — uses already-received todo event data.

## Notification Filtering

Control which notifications you receive:

```bash
export TELEGRAM_NOTIFY_SESSION="false"     # Disable session idle
export TELEGRAM_NOTIFY_FILE_LIST="false"   # Disable file list
export TELEGRAM_NOTIFY_TODO="false"        # Disable todo summaries
export TELEGRAM_NOTIFY_SUBTASK="false"     # Disable subtask notifications
export TELEGRAM_NOTIFY_ERROR="false"       # Disable errors (not recommended)
```

Permission notifications cannot be disabled as they require your response.

## Deduplication

Prevents duplicate notifications within a time window:

```bash
export TELEGRAM_DEDUP_ENABLED="true"
export TELEGRAM_DEDUP_TTL_MS="600000"   # 10 minutes
```

## Notification Reference

| Event | Notification |
|-------|-------------|
| Task completes (waiting for input) | ⏳ Waiting for user input |
| Task completes (all done) | ✨ Task completed |
| Permission needed | 🔔 Permission Request (with buttons) |
| All todos done | 📋 All Tasks Complete |
| Error occurred | ❌ Error (real errors only) |

## License

MIT
