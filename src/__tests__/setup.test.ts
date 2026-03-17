import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should be configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support TypeScript', () => {
    const message: string = 'Hello, Vitest!';
    expect(message).toBeTypeOf('string');
  });
});
