import { describe, it, expect } from 'vitest';
import { TelegramBridge } from '../telegram.js';

interface TelegramBridgeInternals {
  truncateMessage: (text: string, maxLength: number, suffix: string) => string;
  compactWhitespace: (text: string) => string;
}

describe('TelegramBridge internal text processing', () => {
  const bridge = new TelegramBridge({
    botToken: 'test-token',
    chatId: 'test-chat-id',
  });
  const internals = bridge as unknown as TelegramBridgeInternals;

  it('truncateMessage keeps output within maxLength when suffix is longer than maxLength', () => {
    const result = internals.truncateMessage('abcdefghijklmnopqrstuvwxyz', 2, '...');
    expect(result).toBe('..');
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('compactWhitespace does not alter content inside <code> blocks', () => {
    const input = 'outside    space\n\n\n<code>a    b\n\n\n/path   with   spaces</code>\n\n\nnext';
    const result = internals.compactWhitespace(input);

    expect(result).toContain('<code>a    b\n\n\n/path   with   spaces</code>');
    expect(result).toContain('outside space');
    expect(result).toContain('\n\nnext');
  });
});
