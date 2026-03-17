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
