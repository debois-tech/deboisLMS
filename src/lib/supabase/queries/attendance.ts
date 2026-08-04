import { supabase } from '../client';
import { maybeRow, rows as unwrapRows } from './result';
import type { UploadRow, AttendanceRecord } from '@/lib/types';
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

/**
 * Attendance for one student across every lecture, newest first. Only approved rows
 * are returned — unapproved records are still pending admin review and shouldn't be
 * presented to the student as fact (RLS enforces the same rule server-side).
 */
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