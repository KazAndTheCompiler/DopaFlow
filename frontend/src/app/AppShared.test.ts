import { describe, expect, it } from 'vitest';
import { localDateISO, getCommandReply } from './AppShared';

describe('AppShared', () => {
  describe('localDateISO', () => {
    it('returns today date in ISO format (YYYY-MM-DD)', () => {
      const result = localDateISO();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns date offset by given days', () => {
      const today = new Date();
      const future = new Date(today);
      future.setDate(future.getDate() + 7);
      const expected = future.toISOString().slice(0, 10);

      const result = localDateISO(7);
      expect(result).toBe(expected);
    });

    it('handles negative offset (past dates)', () => {
      const today = new Date();
      const past = new Date(today);
      past.setDate(past.getDate() - 3);
      const expected = past.toISOString().slice(0, 10);

      const result = localDateISO(-3);
      expect(result).toBe(expected);
    });
  });

  describe('getCommandReply', () => {
    it('returns trimmed reply string when present', () => {
      const result = getCommandReply({ reply: '  Task created successfully!  ' });
      expect(result).toBe('Task created successfully!');
    });

    it('returns empty string when reply is null', () => {
      const result = getCommandReply({ reply: null });
      expect(result).toBe('');
    });

    it('returns empty string when reply is undefined', () => {
      const result = getCommandReply({});
      expect(result).toBe('');
    });

    it('returns empty string when reply is not a string', () => {
      const result = getCommandReply({ reply: { text: 'hello' } as unknown as string });
      expect(result).toBe('');
    });
  });
});
