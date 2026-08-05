/** CSV writing for exports the admin shares outside the app. */
type CsvCell = string | number | boolean | null | undefined;

/**
 * Quote a cell per RFC 4180, and guard against CSV injection — a cell starting
 * with `=`, `+`, `-`, or `@` would be executed as a formula in Excel or Sheets.
 */
function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n');
}

/** Trigger a browser download. The leading BOM makes Excel read the file as UTF-8. */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([`\u{FEFF}${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Turn a title into a safe, readable filename stem: "Week 3 — API's" → "week-3-apis". */
export function toFileStem(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  );
}
