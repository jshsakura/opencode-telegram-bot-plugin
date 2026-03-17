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
