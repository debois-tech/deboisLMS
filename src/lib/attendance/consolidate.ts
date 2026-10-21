/** Pure helpers for turning matched participants into attendance writes. No I/O, so they are unit-tested directly. */

export interface MatchedParticipant {
  studentId: string;
  displayName: string;
  totalMinutes: number;
  rawUploadIds: string[];
}

export interface ConsolidatedParticipants {
  merged: MatchedParticipant[];
  /** Display names folded into another participant that matched the same student. */
  collapsed: string[];
}

/**
 * One participant per student. Two display names can resolve to the same student (a second device,
 * a typo'd rejoin), and a batch upsert with a repeated `(student_id, lecture_id)` is rejected by
 * Postgres as a whole. Their minutes are summed, capped at the lecture length.
 */
export function consolidateByStudent(
  items: MatchedParticipant[],
  scheduledMinutes: number,
): ConsolidatedParticipants {
  const byStudent = new Map<string, MatchedParticipant>();
  const collapsed: string[] = [];

  for (const item of items) {
    const seen = byStudent.get(item.studentId);
    if (!seen) {
      byStudent.set(item.studentId, { ...item, rawUploadIds: [...item.rawUploadIds] });
      continue;
    }

    const total = seen.totalMinutes + item.totalMinutes;
    seen.totalMinutes = scheduledMinutes > 0 ? Math.min(total, scheduledMinutes) : total;
    seen.rawUploadIds.push(...item.rawUploadIds);
    collapsed.push(item.displayName);
  }

  return { merged: [...byStudent.values()], collapsed };
}

export interface ExistingRecord {
  student_id: string;
  source: string | null;
  approved: boolean | null;
}

/**
 * A record that was approved, or entered by hand, is a person's judgement. Re-processing a CSV
 * must not overwrite it or send it back to pending review.
 */
export function splitProtected<T extends { student_id: string }>(
  payloads: T[],
  existing: ExistingRecord[],
): { toWrite: T[]; kept: T[] } {
  const protectedIds = new Set(
    existing.filter((row) => row.source === 'manual' || row.approved === true).map((row) => row.student_id),
  );

  const toWrite: T[] = [];
  const kept: T[] = [];
  for (const payload of payloads) {
    (protectedIds.has(payload.student_id) ? kept : toWrite).push(payload);
  }
  return { toWrite, kept };
}
