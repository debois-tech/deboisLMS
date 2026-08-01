import { mostFrequent, normalizeName } from './normalize';
import type { MergedParticipant, ParsedInterval, RawUploadRow } from './types';

/**
 * Gap tolerance (ms) for treating two connections as one continuous session.
 * Google Meet frequently splits a single attendee into rows separated by a
 * few seconds of reconnection; anything inside this window is merged so the
 * tiny gap is not counted as time outside the meeting.
 */
const MERGE_GAP_MS = 2 * 60 * 1000;

/**
 * Parse a joined/stopped timestamp from the CSV into epoch ms.
 *
 * Accepts ISO-8601 strings (e.g. `2024-01-01T09:00:00Z`) and time-only
 * formats (`9:00:00 AM`, `09:00`, `9.00`). Time-only values are anchored to
 * "today" which is sufficient because only relative durations matter.
 *
 * @returns epoch ms, or `null` if the value cannot be parsed.
 */
export function parseTimestamp(value?: string | null): number | null {
  if (!value) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso)) return iso;

  return parseTimeOnly(trimmed);
}

/** Parse 12/24-hour clock strings like `9:00:00 AM`, `09:00`, `9.00 PM`. */
function parseTimeOnly(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  const meridiem = match[4]?.toUpperCase();

  if (meridiem === 'AM' && hours === 12) hours = 0;
  if (meridiem === 'PM' && hours < 12) hours += 12;

  const date = new Date();
  date.setHours(hours, minutes, seconds, 0);
  return date.getTime();
}

/**
 * Collapse overlapping / near-overlapping intervals into continuous clusters.
 *
 * - Overlapping intervals (two devices with the same times) merge → counted once.
 * - Intervals separated by ≤ MERGE_GAP_MS merge → a Meet reconnect glitch.
 * - Truly disjoint sessions stay separate → their durations are summed.
 *
 * @returns the sorted clusters covering every interval.
 */
function clusterIntervals(intervals: ParsedInterval[]): ParsedInterval[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const clusters: ParsedInterval[] = [];

  for (const interval of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && interval.start <= last.end + MERGE_GAP_MS) {
      last.end = Math.max(last.end, interval.end);
    } else {
      clusters.push({ start: interval.start, end: interval.end });
    }
  }

  return clusters;
}

/** Duration of an interval in whole minutes (rounded). */
function intervalMinutes(interval: ParsedInterval): number {
  return Math.round((interval.end - interval.start) / 60000);
}

/**
 * Merge raw upload rows into one entry per participant.
 *
 * Rows are grouped by normalized name. Join/leave pairs are clustered so that:
 * 1. Multiple join/leave sessions for the same person are summed.
 * 2. Identical/overlapping rows from a second device are counted only once.
 *
 * When a row has no usable join/leave timestamps its CSV-provided
 * `attended_minutes` is used instead (only if the participant has no valid
 * intervals at all, otherwise timestamp-derived minutes win).
 */
export function mergeSessions(rows: RawUploadRow[]): MergedParticipant[] {
  const grouped = new Map<
    string,
    { displayNames: string[]; intervals: ParsedInterval[]; fallbackMinutes: number[]; rawIds: string[] }
  >();

  for (const row of rows) {
    const key = normalizeName(row.participant_name_raw);
    if (!key) continue;

    let group = grouped.get(key);
    if (!group) {
      group = { displayNames: [], intervals: [], fallbackMinutes: [], rawIds: [] };
      grouped.set(key, group);
    }
    group.displayNames.push(row.participant_name_raw);
    group.rawIds.push(row.id);

    const start = parseTimestamp(row.joined_at) ?? parseTimestamp(row.attendance_started);
    const end = parseTimestamp(row.attendance_stopped);

    if (start != null && end != null && end >= start) {
      group.intervals.push({ start, end });
    } else {
      group.fallbackMinutes.push(Number(row.attended_minutes ?? 0));
    }
  }

  const participants: MergedParticipant[] = [];

  for (const [key, group] of grouped) {
    const clusters = clusterIntervals(group.intervals);
    const sessionTotal = clusters.reduce((sum, c) => sum + intervalMinutes(c), 0);
    const fallbackTotal = group.fallbackMinutes.reduce((sum, m) => sum + m, 0);

    const hasIntervals = clusters.length > 0;
    const sessionCount = hasIntervals ? clusters.length : Math.max(1, group.fallbackMinutes.length);
    const totalMinutes = hasIntervals ? sessionTotal : fallbackTotal;

    participants.push({
      key,
      displayName: mostFrequent(group.displayNames),
      totalMinutes,
      sessionCount,
      duplicateRowsIgnored: Math.max(0, group.rawIds.length - sessionCount),
      rawUploadIds: group.rawIds,
    });
  }

  return participants;
}
