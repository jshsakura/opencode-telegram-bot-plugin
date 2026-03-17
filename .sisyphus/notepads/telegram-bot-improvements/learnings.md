# Learnings - Telegram Bot Improvements

## 2026-03-18: Vitest Setup

### Configuration
- Project uses ESM (`"type": "module"` in package.json)
- TypeScript with `NodeNext` module resolution
- Vitest config uses `include: ['src/**/*.test.ts']` pattern
- Node environment for test runner

### Test Scripts Added
```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage"
}
```

### Installed Dependencies
- `vitest@^4.1.0`
- `@vitest/coverage-v8@^4.1.0`

## 2026-03-18: Dedup Module Implementation

### Pattern: File-based JSON Storage
- Storage path: `path.join(os.tmpdir(), 'opencode-telegram-dedup.json')`
- Consistent with existing lock file pattern in telegram.ts

### Pattern: Graceful Degradation
- On any file I/O error, return `true` (allow message to be sent)
- Never block notifications due to dedup failures
- Empty catch blocks acceptable for this pattern

### Testing Approach
- Use `vi.spyOn(fs, 'writeFileSync')` to simulate file write errors
- Use short TTL (50-100ms) with `setTimeout` for TTL expiration tests
- Always call `clear()` in beforeEach/afterEach for test isolation

## 2026-03-18: i18n Module Implementation

### Pattern: Simple Key-Value i18n
- No external i18n libraries needed - simple key-value object structure
- Use `as const` for translation objects to enable type inference
- Define separate `TranslationMessages` interface with `string` types for flexibility

### Pattern: Dot-notation Key Lookup
- Use `key.split(".")` to navigate nested translation objects
- Dynamic property access with type assertion: `(obj as Record<string, unknown>)[part]`
- Return key name as fallback when translation not found

### Pattern: Language Fallback Chain
1. Invalid language → fallback to Korean (default)
2. Missing key → return key string itself
3. Non-string value → return key string

### Type Safety
- Export `Language = "ko" | "en"` as union type
- Use `lang is Language` type guard in `isValidLanguage()`
- Interface with `string` types (not literal types) for cross-language compatibility

## 2026-03-18: Config Module Implementation

### Pattern: Memoized Config with Cache Clear
- Use module-level `let cachedConfig: Type | null = null` pattern
- Export `clearConfigCache()` function for testing purposes
- Tests must call `clearConfigCache()` in `beforeEach` and `afterEach`

### Pattern: Environment Variable Parsing
- Use `process.env['VAR_NAME']` with bracket notation for type safety
- Parse functions should accept `string | undefined` and return fallback for undefined
- Boolean parsing: `value.toLowerCase() === 'true'`
- Number parsing: `parseInt(value, 10)` with NaN and non-positive checks
- Language parsing: normalize with `toLowerCase()` and validate against allowed values

### Test Pattern: Environment Variable Testing
- Save original env in `beforeEach`: `const originalEnv = { ...process.env }`
- Restore in `afterEach` by comparing and restoring/deleting
- Always call `clearConfigCache()` before each test to reset memoization

### Config Default Values
```typescript
language: 'ko'
notifications.session: true
notifications.permission: true
notifications.todo: true
notifications.subtask: true
notifications.error: true
dedup.enabled: true
dedup.ttlMs: 300000  // 5 minutes
```

## 2026-03-18: Notification Filtering Pattern
- Early return pattern at the start of handlers: `if (!getConfig().notifications.X) return;`
- For subtask filtering, check config inside the type check to avoid unnecessary config access
- Permission requests are ALWAYS sent (no filtering) as they require user interaction
- Config import: `import { getConfig } from "./config.js";`

## Dedup Integration in sendMessage (2026-03-18)

**Pattern**: Use optional `skipDedup` parameter for exempting specific message types from dedup
- Added `skipDedup?: boolean` as third parameter to private `sendMessage`
- Permission requests pass `true` to bypass dedup (every permission request must be delivered)
- Other notifications use dedup to prevent duplicate messages within TTL

**Implementation details**:
```typescript
private async sendMessage(text: string, inlineKeyboard?: InlineKeyboardButton[][], skipDedup?: boolean): Promise<void> {
  if (!skipDedup) {
    const config = getConfig();
    if (config.dedup.enabled) {
      const shouldSend = await checkAndStore(text, config.dedup.ttlMs);
      if (!shouldSend) return; // Skip duplicate
    }
  }
  // ... send message
}
```

**Graceful degradation**: If dedup check fails (throws), message is still sent. This ensures notifications work even if dedup storage is corrupted.

**Config usage**: `getConfig()` is called inside `sendMessage` to get fresh config values (enabled, ttlMs).

## Session Summary Feature (2026-03-18)

### Pattern: In-Memory Session Data Storage
- Use Map<string, Type> for session-related data storage in EventRouter
- `sessionSummaries = new Map<string, SessionSummary>()` for summary stats
- `sessionDiffs = new Map<string, FileDiff[]>()` for file change lists
- Clean up all session-related Maps in `evictStaleSessions()`

### Types Added to types.ts
```typescript
interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
}

interface SessionSummary {
  additions: number;
  deletions: number;
  files: number;
  diffs?: FileDiff[];
}
```

### Event Handlers
- `session.updated`: Store title AND summary if present
- `session.diff`: Store diffs array indexed by sessionID
- Both use simple `Map.set()` operations

### Telegram Method Signature Update
- Extended `sendSessionIdle` to accept optional `summary` and `diffs` parameters
- Display stats line: `📊 Changes +N / -M`
- Display file list: `📁 Files:` followed by indented file paths

### i18n Keys Added
- `session.idle.stats`: "📊 변경" / "📊 Changes"
- `session.idle.files`: "📁 파일" / "📁 Files"

### No Interpolation in i18n
- Current t() function doesn't support template interpolation
- For dynamic values (additions/deletions), format directly in code: `+${summary.additions} / -${summary.deletions}`
- Keep i18n keys for static text labels only

## 2026-03-18: i18n Applied to telegram.ts

### Message Function i18n Pattern
- Get language at start of each function: `const lang = getConfig().language;`
- Use `t('key.path', lang)` for all display strings
- For strings with dynamic values, use `.replace()` on translation result:
  ```typescript
  t('todos.more', lang).replace('N', String(todos.length - 10))
  ```

### Translation Keys Used
| Function | Keys |
|----------|------|
| sendSessionIdle | `session.idle.title`, `session.idle.session`, `session.idle.stats`, `session.idle.files` |
| sendPermissionRequest | `permission.title`, `permission.action`, `permission.command`, `permission.path`, `permission.allow`, `permission.always`, `permission.reject` |
| sendTodosComplete | `todos.title`, `todos.more` |
| sendSubtaskStarted | `subtask.title`, `subtask.agent`, `subtask.description`, `subtask.prompt` |
| sendError | `error.title`, `session.idle.session` |
| handleCallbackQuery | `button.allowed`, `button.always_allowed`, `button.rejected` |

### Emoji Changes
- Session complete: ✅ → 🚀 (already in translation file)
- Other emojis kept as-is (already included in translation strings)

### Important: No Function Signature Changes
- All function signatures remain unchanged
- Language retrieved from config inside each function
- Existing logic intact, only display strings changed

## Integration Test Results (2026-03-18)

### Build Output
- `npm run typecheck` → 0 errors
- `npm run build` → success
- `npm test` → 91 tests passed (4 test files)

### dist/ Structure
All expected files generated:
- `index.js`, `index.d.ts` - Main plugin export
- `router.js`, `router.d.ts` - Event routing
- `telegram.js`, `telegram.d.ts` - Telegram API bridge
- `types.js`, `types.d.ts` - TypeScript types
- `config.js`, `config.d.ts` - Configuration module
- `dedup.js`, `dedup.d.ts` - Deduplication module
- `i18n/index.js`, `i18n/ko.js`, `i18n/en.js` - Internationalization

### Module Exports
- **index.js**: Default export `OpencodeTelegram` function
- **config.js**: `getConfig()`, `clearConfigCache()`
- **dedup.js**: `checkAndStore()`, `clear()`, `DEFAULT_TTL_MS`
- **i18n/index.js**: `t()`, `getAvailableLanguages()`, `isValidLanguage()`, `DEFAULT_LANGUAGE`, `translations`, `ko`, `en`

### Cross-Module Integration
All modules integrate correctly:
- i18n + config: Language from config used for translations
- dedup + config: TTL from config used for deduplication
- All modules importable from dist/ at runtime

### Notes
- No `TelegramConfigSchema` exported - schema validation not part of public API
- Source maps generated correctly (.js.map, .d.ts.map)
- ES modules compiled correctly for Node.js consumption

## 2026-03-18: README Documentation Update

### Documentation Structure
- Keep sections in logical order: Features → Installation → Setup → Configuration → Language → Filtering → Dedup → Notifications → License
- Use markdown tables for config variables and notification events
- Provide practical code examples for each feature

### Config Table Format
| Variable | Description | Default |
|----------|-------------|---------|
Use monospace for variable names and values in table cells.

### Environment Variables Documented
All 10 TELEGRAM_* variables documented:
- Required: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Optional with defaults: `TELEGRAM_LANGUAGE`, `TELEGRAM_NOTIFY_*`, `TELEGRAM_DEDUP_*`

### Section Order Strategy
Place Configuration section after Setup (step 5), before language/filtering sections. This follows the user journey: install → setup → configure → customize.

### Notification Table Updates
Added two new events:
- Session idle (💤 Session Idle)
- Session done (📊 Session Summary with files, changes)
