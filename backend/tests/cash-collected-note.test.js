const {
  CASH_COLLECT_NOTE_MAX_LENGTH,
  normalizeCashCollectedNote,
} = require('../src/modules/trip/cash-collected-note');

describe('normalizeCashCollectedNote', () => {
  test.each([
    ['undefined input', undefined],
    ['null input', null],
    ['blank string', '   '],
  ])('empty note (%s) returns null', (_label, note) => {
    expect(normalizeCashCollectedNote(note)).toBe(null);
  });

  test('trimmed note is escaped for storage', () => {
    expect(normalizeCashCollectedNote('  hello  ')).toBe('hello');
    expect(normalizeCashCollectedNote('  <b>x</b>  ')).toBe('&lt;b&gt;x&lt;&#x2F;b&gt;');
  });

  test('non_string_note_rejects_with_invalid_code', () => {
    expect(() => normalizeCashCollectedNote(123)).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'CASH_COLLECT_NOTE_INVALID',
      })
    );
  });

  test('note_over_max_length_rejects_with_too_long_code', () => {
    const note = 'a'.repeat(CASH_COLLECT_NOTE_MAX_LENGTH + 1);

    expect(() => normalizeCashCollectedNote(note)).toThrow(
      expect.objectContaining({
        statusCode: 400,
        code: 'CASH_COLLECT_NOTE_TOO_LONG',
        details: expect.arrayContaining([
          expect.objectContaining({ max: CASH_COLLECT_NOTE_MAX_LENGTH }),
        ]),
      })
    );
  });
});
