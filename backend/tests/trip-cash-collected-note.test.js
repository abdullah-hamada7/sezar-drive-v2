const { ValidationError } = require('../src/errors');

describe('ValidationError code override', () => {
  test('treats 2nd string param as code (backwards compatible)', () => {
    const err = new ValidationError('Rejection reason is required', 'REJECTION_REASON_REQUIRED');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('REJECTION_REASON_REQUIRED');
    expect(err.details).toBe(null);
  });

  test('supports explicit code + details', () => {
    const err = new ValidationError('Note too long', [{ path: 'note', msg: 'MAX_LENGTH' }], 'CASH_COLLECT_NOTE_TOO_LONG');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('CASH_COLLECT_NOTE_TOO_LONG');
    expect(Array.isArray(err.details)).toBe(true);
  });
});
