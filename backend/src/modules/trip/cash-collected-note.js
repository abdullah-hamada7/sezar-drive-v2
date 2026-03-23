const validator = require('validator');
const { ValidationError } = require('../../errors');

const CASH_COLLECT_NOTE_MAX_LENGTH = 250;

function normalizeCashCollectedNote(note) {
  if (note === undefined || note === null) return null;
  if (typeof note !== 'string') {
    throw new ValidationError(
      'Cash collection note must be a string',
      [{ path: 'note', msg: 'NOTE_MUST_BE_STRING' }],
      'CASH_COLLECT_NOTE_INVALID'
    );
  }

  const trimmed = note.trim();
  if (!trimmed) return null;

  if (trimmed.length > CASH_COLLECT_NOTE_MAX_LENGTH) {
    throw new ValidationError(
      `Cash collection note must be ${CASH_COLLECT_NOTE_MAX_LENGTH} characters or less`,
      [{ path: 'note', msg: 'MAX_LENGTH', max: CASH_COLLECT_NOTE_MAX_LENGTH }],
      'CASH_COLLECT_NOTE_TOO_LONG'
    );
  }

  // Keep storage consistent with legacy route behavior (escape HTML).
  return validator.escape(trimmed);
}

module.exports = {
  CASH_COLLECT_NOTE_MAX_LENGTH,
  normalizeCashCollectedNote,
};
