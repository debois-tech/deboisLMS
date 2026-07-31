import { supabase } from '../client';
import type { UploadRow, AttendanceRecord } from '@/lib/types';
import { normalizeTimestampForDb } from '@/lib/utils/csvParser';

export async function getUploadsByLecture(lectureId: string): Promise<UploadRow[]> {
  const { data } = await supabase
    .from('uploads')
    .select('*')
    .eq('lecture_id', lectureId)
    .order('sno');
  return (data ?? []) as UploadRow[];
}

export async function getAttendanceByLecture(lectureId: string): Promise<AttendanceRecord[]> {
  const { data } = await supabase
    .from('attendance')
    .select('*, student:students(id, name, email, phone)')
    .eq('lecture_id', lectureId)
    .order('created_at');
  return (data ?? []) as AttendanceRecord[];
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
  const { data } = await supabase
    .from('attendance')
    .update({
      approved,
      approved_at: approved ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select('*, student:students(id, name, email, phone)')
    .single();
  return data as AttendanceRecord | undefined;
}

export async function bulkApproveAttendance(lectureId: string): Promise<number> {
  const { data } = await supabase
    .from('attendance')
    .update({ approved: true, approved_at: new Date().toISOString() })
    .eq('lecture_id', lectureId)
    .eq('approved', false)
    .select();
  return (data ?? []).length;
}

export async function getUnapprovedCount(): Promise<number> {
  const { count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('approved', false);
  return count ?? 0;
}