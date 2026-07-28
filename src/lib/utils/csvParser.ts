export interface CsvRow {
  sno: number;
  participant_name_raw: string;
  joined_at?: string;
  attendance_stopped?: string;
  attended_duration_raw?: string;
  attended_minutes?: number;
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

export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const colMap: Record<string, number> = {};
  header.split(',').forEach((col, i) => {
    const c = col.trim().replace(/[()]/g, '').replace(/\s+/g, '_');
    if (c.includes('s_no') || c === 'sno' || c === 's.no' || c === 'sno' || c.includes('serial')) colMap.sno = i;
    if (c.includes('participant') || c.includes('name')) colMap.name = i;
    if (c.includes('joined') || c.includes('join')) colMap.joined = i;
    if (c.includes('stopped') || c.includes('stop')) colMap.stopped = i;
    if (c.includes('duration')) colMap.duration = i;
    if (c.includes('meeting') || c.includes('code')) colMap.meeting = i;
  });

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const name = cols[colMap.name]?.trim().replace(/^"(.*)"$/, '$1') ?? '';
    if (!name) continue;
    rows.push({
      sno: i,
      participant_name_raw: name,
      joined_at: cols[colMap.joined]?.trim() ?? undefined,
      attendance_stopped: cols[colMap.stopped]?.trim() ?? undefined,
      attended_duration_raw: cols[colMap.duration]?.trim() ?? undefined,
      attended_minutes: parseDuration(cols[colMap.duration] ?? ''),
    });
  }

  return rows;
}
