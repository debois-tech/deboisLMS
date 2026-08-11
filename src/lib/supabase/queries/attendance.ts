import { supabase } from '../client';
import { maybeRow, rows as unwrapRows } from './result';
import type { UploadRow, AttendanceRecord, AttendanceStatus, AttendanceSource } from '@/lib/types';
import { normalizeTimestampForDb } from '@/lib/utils/csvParser';

export async function getUploadsByLecture(lectureId: string): Promise<UploadRow[]> {
  return unwrapRows<UploadRow>(
    await supabase.from('uploads').select('*').eq('lecture_id', lectureId).order('sno'),
    'Could not load the uploaded rows',
  );
}

export async function getAttendanceByLecture(lectureId: string): Promise<AttendanceRecord[]> {
  return unwrapRows<AttendanceRecord>(
    await supabase
      .from('attendance')
      .select('*, student:students(id, name, email, phone)')
      .eq('lecture_id', lectureId)
      .order('created_at'),
    'Could not load attendance for this lecture',
  );
}

/** Approved-only attendance for one student, newest first (RLS enforces the same rule server-side). */
export async function getApprovedAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
  const records = unwrapRows<AttendanceRecord>(
    await supabase
      .from('attendance')
      .select('*, lecture:lectures(*)')
      .eq('student_id', studentId)
      .eq('approved', true),
    'Could not load your attendance',
  );

  return records.sort((a, b) =>
    (b.lecture?.lecture_date ?? '').localeCompare(a.lecture?.lecture_date ?? '')
  );
}

export async function insertUploadRows(
  lectureId: string,
  meetingCode: string,
  lectureDate: string | undefined,
  rows: { sno: number; participant_name_raw: string; attendance_started?: string; joined_at?: string; attendance_stopped?: string; attended_duration_raw?: string; attended_minutes?: number }[]
): Promise<void> {
  const records = rows.map((r) => ({
    lecture_id: lectureId,
    sno: r.sno,
    participant_name_raw: r.participant_name_raw,
    attendance_started: normalizeTimestampForDb(r.attendance_started, lectureDate),
    joined_at: normalizeTimestampForDb(r.joined_at, lectureDate),
    attendance_stopped: normalizeTimestampForDb(r.attendance_stopped, lectureDate),
    attended_duration_raw: r.attended_duration_raw ?? null,
    attended_minutes: r.attended_minutes ?? null,
    meeting_code: meetingCode,
    processed: false,
  }));

  const { error } = await supabase.from('uploads').insert(records);
  if (error) throw new Error(`Failed to upload rows: ${error.message}`);
}

export interface ManualAttendanceInput {
  studentId: string;
  batchId: string;
  lectureId: string;
  status: AttendanceStatus;
  minutes: number;
  source: AttendanceSource;
}

/**
 * Marks one student for one lecture by hand, already approved — an admin ticking
 * the box *is* the human judgement the approval gate exists to capture, so asking
 * them to approve their own entry afterwards would be a second click for nothing.
 *
 * Upserts on `(student_id, lecture_id)`, the same key the CSV pipeline uses, so
 * marking a student who already has a record corrects it instead of failing.
 */
export async function markAttendance(input: ManualAttendanceInput): Promise<AttendanceRecord | undefined> {
  return maybeRow<AttendanceRecord>(
    await supabase
      .from('attendance')
      .upsert(
        {
          student_id: input.studentId,
          batch_id: input.batchId,
          lecture_id: input.lectureId,
          status: input.status,
          total_attended_minutes: input.minutes,
          source: input.source,
          approved: true,
          approved_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,lecture_id' },
      )
      .select('*, student:students(id, name, email, phone)')
      .single(),
    'Could not mark the attendance',
  );
}

/** Unticking a marked student removes the record rather than leaving an unapproved one behind. */
export async function deleteAttendance(id: string): Promise<void> {
  const { error } = await supabase.from('attendance').delete().eq('id', id);
  if (error) throw new Error(`Could not remove the attendance: ${error.message}`);
}

export async function approveAttendance(id: string): Promise<AttendanceRecord | undefined> {
  return setAttendanceApproved(id, true);
}

export async function setAttendanceApproved(id: string, approved: boolean): Promise<AttendanceRecord | undefined> {
  return maybeRow<AttendanceRecord>(
    await supabase
      .from('attendance')
      .update({
        approved,
        approved_at: approved ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .select('*, student:students(id, name, email, phone)')
      .single(),
    'Could not update the approval',
  );
}

export async function bulkApproveAttendance(lectureId: string): Promise<number> {
  return unwrapRows<{ id: string }>(
    await supabase
      .from('attendance')
      .update({ approved: true, approved_at: new Date().toISOString() })
      .eq('lecture_id', lectureId)
      .eq('approved', false)
      .select(),
    'Could not approve the attendance',
  ).length;
}

export async function getUnapprovedCount(): Promise<number> {
  const { count, error } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false);
  if (error) throw new Error(`Could not count pending attendance: ${error.message}`);
  return count ?? 0;
}