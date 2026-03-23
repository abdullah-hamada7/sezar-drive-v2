const {
  CASH_COLLECT_NOTE_MAX_LENGTH,
  normalizeCashCollectedNote,
} = require('../src/modules/trip/cash-collected-note');

describe('normalizeCashCollectedNote', () => {
  test('returns null for undefined/null/empty', () => {
    expect(normalizeCashCollectedNote(undefined)).toBe(null);
    expect(normalizeCashCollectedNote(null)).toBe(null);
    expect(normalizeCashCollectedNote('   ')).toBe(null);
  });

  test('trims and escapes', () => {
    expect(normalizeCashCollectedNote('  hello  ')).toBe('hello');
    expect(normalizeCashCollectedNote('  <b>x</b>  ')).toBe('&lt;b&gt;x&lt;&#x2F;b&gt;');
  });

  test('throws for non-string note', () => {
    try {
      normalizeCashCollectedNote(123);
      throw new Error('Expected normalizeCashCollectedNote to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('CASH_COLLECT_NOTE_INVALID');
    }
  });

  test('throws for too long note', () => {
    const note = 'a'.repeat(CASH_COLLECT_NOTE_MAX_LENGTH + 1);

    try {
      normalizeCashCollectedNote(note);
      throw new Error('Expected normalizeCashCollectedNote to throw');
    } catch (err) {
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('CASH_COLLECT_NOTE_TOO_LONG');
      expect(Array.isArray(err.details)).toBe(true);
      expect(err.details?.[0]?.max).toBe(CASH_COLLECT_NOTE_MAX_LENGTH);
    }
  });
});
