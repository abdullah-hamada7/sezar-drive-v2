function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeDeep(input) {
  if (input == null) return input;
  if (typeof input === 'string') return escapeHtml(input);
  if (Array.isArray(input)) return input.map(sanitizeDeep);
  if (typeof input === 'object') {
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, sanitizeDeep(value)]));
  }
  return input;
}

module.exports = {
  sanitizeDeep,
};
