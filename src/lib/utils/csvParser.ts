export interface CsvRow {
  sno: number;
  participant_name_raw: string;
  attendance_started?: string;
  joined_at?: string;
  attendance_stopped?: string;
  attended_duration_raw?: string;
  attended_minutes?: number;
}

export interface CsvTable {
  headers: string[];
  rows: Record<string, string>[];
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"' && quoted) {
      value += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  values.push(value.trim());
  return values;
}

export function parseCsvTable(text: string): CsvTable {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });

  return { headers, rows };
}

function parseDuration(raw: string): number {
  if (!raw) return 0;
  let total = 0;
  const h = raw.match(/(\d+)\s*h/);
  const m = raw.match(/(\d+)\s*m/);
  const s = raw.match(/(\d+)\s*s/);
  if (h) total += parseInt(h[1]) * 60;
  if (m) total += parseInt(m[1]);
  if (s) total += Math.round(parseInt(s[1]) / 60);
  return total;
}

/**
 * Convert a CSV time cell into a value Postgres accepts for a `timestamp` column.
 * The Meet export uses time-only values Postgres rejects; those are combined with
 * the lecture's date. Always a naive local `YYYY-MM-DDTHH:MM:SS`.
 */
export function normalizeTimestampForDb(
  value: string | undefined,
  fallbackDate?: string,
): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();

  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return toNaiveLocal(new Date(parsed));

  if (fallbackDate) {
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (match) {
      let hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = match[3] ? Number(match[3]) : 0;
      const meridiem = match[4]?.toUpperCase();
      if (meridiem === 'AM' && hours === 12) hours = 0;
      if (meridiem === 'PM' && hours < 12) hours += 12;
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${fallbackDate}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
  }

  return null;
}

/** Format a Date as naive wall-clock `YYYY-MM-DDTHH:MM:SS` (no time zone). */
function toNaiveLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export interface ParsedAttendanceCsv {
  rows: CsvRow[];
  /**
   * The meeting code the export carries, when it has one. Used to recognise a
   * CSV that has already been processed for a lecture.
   */
  meetingCode?: string;
}

export function parseCsv(text: string): ParsedAttendanceCsv {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return { rows: [] };

  const header = lines[0].toLowerCase();
  const colMap: Record<string, number> = {};
  header.split(',').forEach((col, i) => {
    const c = col.trim().replace(/[()]/g, '').replace(/\s+/g, '_');
    if (c.includes('s_no') || c === 'sno' || c === 's.no' || c === 'sno' || c.includes('serial')) colMap.sno = i;
    if (c.includes('participant') || c.includes('name')) colMap.name = i;
    if (c.includes('started') || c.includes('start')) colMap.started = i;
    if (c.includes('joined') || c.includes('join')) colMap.joined = i;
    if (c.includes('stopped') || c.includes('stop')) colMap.stopped = i;
    if (c.includes('duration')) colMap.duration = i;
    if (c.includes('meeting') || c.includes('code')) colMap.meeting = i;
  });

  const rows: CsvRow[] = [];
  let meetingCode: string | undefined;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const name = cols[colMap.name]?.trim().replace(/^"(.*)"$/, '$1') ?? '';
    if (!name) continue;

    // Every row repeats the same code; the first non-empty one is the meeting.
    if (!meetingCode && colMap.meeting !== undefined) {
      const code = cols[colMap.meeting]?.trim().replace(/^"(.*)"$/, '$1');
      if (code) meetingCode = code;
    }

    rows.push({
      sno: i,
      participant_name_raw: name,
      attendance_started: cols[colMap.started]?.trim() ?? undefined,
      joined_at: cols[colMap.joined]?.trim() ?? undefined,
      attendance_stopped: cols[colMap.stopped]?.trim() ?? undefined,
      attended_duration_raw: cols[colMap.duration]?.trim() ?? undefined,
      attended_minutes: parseDuration(cols[colMap.duration] ?? ''),
    });
  }

  return { rows, meetingCode };
}
