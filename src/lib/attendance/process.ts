import { clearUploads, insertAttendance, loadProcessingContext, loadUploadRows } from './db';
import { getGeminiUnavailableReason } from './gemini';
import { matchParticipant } from './match';
import { mergeSessions } from './merge';
import type {
  AttendanceInsertPayload,
  MergedParticipant,
  NameMatch,
  ProcessingReport,
  UnmatchedRecord,
} from './types';

export type { ProcessingReport } from './types';

export interface ProcessOptions {
  useGemini?: boolean;
}

const LOG_PREFIX = '[attendance-parser]';

/**
 * Process a lecture's raw upload rows into cleaned `attendance` records:
 * read uploads, merge sessions, match participants (tutors excluded), insert
 * (idempotent on student_id+lecture_id), then clear the uploads table — only
 * after the insert succeeded, so a failure leaves it re-runnable.
 */
export async function processAttendance(
  lectureId: string,
  options: ProcessOptions = {},
): Promise<ProcessingReport> {
  const logs: string[] = [];
  const log = (message: string) => {
    console.log(`${LOG_PREFIX} ${message}`);
    logs.push(message);
  };

  const uploads = await loadUploadRows(lectureId);
  if (uploads.length === 0) {
    log(`No upload rows found for lecture ${lectureId}; nothing to process.`);
    return emptyReport(logs);
  }

  const ctx = await loadProcessingContext(lectureId);
  log(
    `Lecture ${lectureId} (batch ${ctx.batchId}, scheduled ${ctx.scheduledMinutes} min): ${uploads.length} upload rows, ${ctx.roster.length} roster students.`,
  );

  const participants = mergeSessions(uploads);
  const mergedSessions = participants.reduce((sum, p) => sum + p.sessionCount, 0);
  const duplicateRowsIgnored = participants.reduce((sum, p) => sum + p.duplicateRowsIgnored, 0);
  log(
    `Merged ${uploads.length} rows → ${participants.length} participants (${mergedSessions} sessions; ${duplicateRowsIgnored} duplicate/overlapping rows absorbed).`,
  );

  const matched: { participant: MergedParticipant; match: NameMatch }[] = [];
  const unmatched: UnmatchedRecord[] = [];
  const tutorsDetected: string[] = [];

  for (const participant of participants) {
    const match = await matchParticipant(participant.displayName, ctx.roster, ctx.tutors, options);

    if (match.kind === 'student') {
      matched.push({ participant, match });
      log(
        `Matched "${participant.displayName}" → student ${match.studentId} (${match.confidence}: ${match.reason}). ${participant.totalMinutes} min.`,
      );
    } else if (match.kind === 'tutor') {
      tutorsDetected.push(participant.displayName);
      log(
        `Detected tutor "${participant.displayName}" (${match.reason}); excluded from student attendance.`,
      );
    } else {
      unmatched.push({ name: participant.displayName, reason: match.reason });
      log(`Could not match "${participant.displayName}" — ${match.reason}. Flagged for manual review.`);
    }
  }

  // 4. Validate tutor relationships
  const tutorMismatches: string[] = [];
  for (const displayName of tutorsDetected) {
    const tutor = ctx.tutors.find((t) => t.name === displayName);
    if (tutor && !ctx.batchTutorIds.has(tutor.id)) {
      tutorMismatches.push(displayName);
      log(`WARN: tutor "${displayName}" is NOT assigned to batch ${ctx.batchId}.`);
    } else if (tutor) {
      log(`Tutor "${displayName}" is correctly assigned to batch ${ctx.batchId}.`);
    }
  }

  // 4b. Report AI-matching health
  const geminiUnavailableReason = getGeminiUnavailableReason();
  if (geminiUnavailableReason) {
    log(`WARN: AI name matching unavailable — ${geminiUnavailableReason}. Only deterministic matching was used.`);
  }

  // 5. Build cleaned records
  const payloads: AttendanceInsertPayload[] = matched.map(({ participant, match }) => ({
    student_id: match.studentId!,
    batch_id: ctx.batchId,
    lecture_id: ctx.lectureId,
    status: computeStatus(participant.totalMinutes, ctx.scheduledMinutes),
    total_attended_minutes: participant.totalMinutes,
    raw_upload_ids: participant.rawUploadIds,
    source: 'automated',
    approved: false,
  }));

  // 6. Insert, then 7. clear uploads — only reached on success
  const inserted = payloads.length > 0 ? await insertAttendance(payloads) : 0;
  log(`Inserted ${inserted} attendance records.`);

  await clearUploads(lectureId);
  log(`Cleared uploads for lecture ${lectureId}.`);

  log(
    `Summary: ${uploads.length} rows → ${participants.length} participants → ${matched.length} matched → ${inserted} records; ${unmatched.length} unmatched; ${tutorsDetected.length} tutor(s).`,
  );

  return {
    uploadedRows: uploads.length,
    uniqueParticipants: participants.length,
    mergedSessions,
    duplicateRowsIgnored,
    studentsMatched: matched.length,
    tutorsDetected,
    tutorMismatches,
    unmatched,
    attendanceInserted: inserted,
    uploadsCleaned: true,
    geminiUnavailableReason: geminiUnavailableReason ?? undefined,
    logs,
  };
}

/** Attendance bands, from the PRD (§5.4). Exported so nothing re-invents them. */
export const ATTENDANCE_PRESENT_PERCENT = 90;
export const ATTENDANCE_PARTIAL_PERCENT = 65;

/** Map attended minutes against scheduled minutes to an attendance status. */
export function computeStatus(totalMinutes: number, scheduledMinutes: number): 'present' | 'partial' | 'absent' {
  const percentage = scheduledMinutes > 0 ? (totalMinutes / scheduledMinutes) * 100 : 0;
  if (percentage >= ATTENDANCE_PRESENT_PERCENT) return 'present';
  if (percentage >= ATTENDANCE_PARTIAL_PERCENT) return 'partial';
  return 'absent';
}

function emptyReport(logs: string[]): ProcessingReport {
  return {
    uploadedRows: 0,
    uniqueParticipants: 0,
    mergedSessions: 0,
    duplicateRowsIgnored: 0,
    studentsMatched: 0,
    tutorsDetected: [],
    tutorMismatches: [],
    unmatched: [],
    attendanceInserted: 0,
    uploadsCleaned: false,
    logs,
  };
}
