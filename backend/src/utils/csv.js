function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[\r\n",]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv({ columns, rows }) {
  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error('CSV columns are required');
  }
  const safeRows = Array.isArray(rows) ? rows : [];
  const header = columns.map((c) => csvEscape(c.header ?? c.key ?? '')).join(',');
  const lines = [header];

  for (const row of safeRows) {
    const line = columns
      .map((c) => {
        const raw = typeof c.value === 'function' ? c.value(row) : row?.[c.key];
        return csvEscape(raw);
      })
      .join(',');
    lines.push(line);
  }

  return `${lines.join('\n')}\n`;
}

function sendCsv(res, { filename, columns, rows }) {
  const csv = toCsv({ columns, rows });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename || 'export.csv'}"`);
  res.send(csv);
}

module.exports = {
  toCsv,
  sendCsv,
};
