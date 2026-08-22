const BOM = String.fromCharCode(0xfeff);

function escapeCell(value) {
  const s = value == null ? '' : String(value);
  if (/["\,\n;]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.map(escapeCell).join(',')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  // Boshida BOM qo'shiladi - Excel'da o'zbekcha/kirill harflarni to'g'ri ko'rsatish uchun
  return BOM + lines.join('\r\n');
}

function sendCsv(res, filename, headers, rows) {
  const csv = toCsv(headers, rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

module.exports = { toCsv, sendCsv };
