import type { AttendanceSource, AttendanceStatus } from '@/lib/types';

/** What a full attendance is measured against, so no form retypes it. */
export const DEFAULT_LECTURE_MINUTES = 120;

/** A single contiguous join → leave span for one participant, in epoch ms. */
export interface ParsedInterval {
  start: number;
  end: number;
}

/** A raw row straight from the `uploads` table. */
export interface RawUploadRow {
  id: string;
  sno?: number | null;
  participant_name_raw: string;
  attendance_started?: string | null;
  joined_at?: string | null;
  attendance_stopped?: string | null;
  attended_duration_raw?: string | null;
  attended_minutes?: number | null;
  meeting_code?: string | null;
}

/** One participant after merging sessions and deduping multi-device rows. */
export interface MergedParticipant {
  /** Normalized, dedupe-safe name key. */
  key: string;
  /** The most common original spelling from the CSV. */
  displayName: string;
  /** Total attended minutes across all merged sessions (union, no double count). */
  totalMinutes: number;
  /** Number of continuous session clusters (after gap tolerance). */
  sessionCount: number;
  /** Number of raw rows absorbed by overlapping clusters (multi-device / reconnect). */
  duplicateRowsIgnored: number;
  /** All raw `uploads.id` values consumed for this participant. */
  rawUploadIds: string[];
}

export type MatchKind = 'student' | 'tutor' | 'unmatched';
export type MatchConfidence = 'exact' | 'fuzzy' | 'ai' | 'unmatched';

export interface NameMatch {
  kind: MatchKind;
  studentId?: string;
  tutorId?: string;
  confidence: MatchConfidence;
  score?: number;
  reason: string;
}

/** An active student in the lecture's batch roster. */
export interface RosterEntry {
  studentId: string;
  name: string;
}

/** Everything the parser needs to resolve one lecture's attendance. */
export interface ProcessingContext {
  lectureId: string;
  batchId: string;
  lectureDate: string;
  scheduledMinutes: number;
  meetingCode?: string;
  roster: RosterEntry[];
  tutors: { id: string; name: string }[];
  /** Tutor ids assigned to this lecture's batch. */
  batchTutorIds: Set<string>;
}

/** A cleaned record ready for the `attendance` table. */
export interface AttendanceInsertPayload {
  student_id: string;
  batch_id: string;
  lecture_id: string;
  status: AttendanceStatus;
  total_attended_minutes: number;
  raw_upload_ids: string[];
  source: AttendanceSource;
  approved: boolean;
}

export interface UnmatchedRecord {
  name: string;
  reason: string;
}

/** Full result of one processing run, returned to the caller and logged. */
export interface ProcessingReport {
  uploadedRows: number;
  uniqueParticipants: number;
  mergedSessions: number;
  duplicateRowsIgnored: number;
  studentsMatched: number;
  tutorsDetected: string[];
  tutorMismatches: string[];
  unmatched: UnmatchedRecord[];
  attendanceInserted: number;
  uploadsCleaned: boolean;
  /** Why AI name matching was unavailable, if it was. */
  geminiUnavailableReason?: string;
  logs: string[];
}
