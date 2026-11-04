import { supabase } from '../client';
import { rows as unwrapRows } from './result';
import type { AttendanceRecord, AttendanceStatus, AttendanceSource } from '@/lib/types';
import { normalizeTimestampForDb } from '@/lib/utils/csvParser';

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

// Every attendance row for a batch, across every lecture — the CSV export's source. Paged, because the API hands back at most 1000 rows a call.
export async function getAttendanceByBatch(batchId: string): Promise<AttendanceRecord[]> {
  const PAGE = 1000;
  const all: AttendanceRecord[] = [];
  for (let from = 0; ; from += PAGE) {
    const page = unwrapRows<AttendanceRecord>(
      await supabase.from('attendance').select('*').eq('batch_id', batchId).order('id').range(from, from + PAGE - 1),
      'Could not load attendance for this batch',
    );
    all.push(...page);
    if (page.length < PAGE) return all;
  }
}

/** One student's attendance, newest first. The "not marked yet" rows are hidden by RLS as well. */
export async function getAttendanceByStudent(studentId: string): Promise<AttendanceRecord[]> {
  const records = unwrapRows<AttendanceRecord>(
    await supabase
      .from('attendance')
      .select('*, lecture:lectures(*)')
      .eq('student_id', studentId)
      .neq('status', 'no_mark'),
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

interface AttendanceInput {
  studentId: string;
  status: AttendanceStatus;
  minutes: number;
  source: AttendanceSource;
}

/** Saves a whole lecture's marks in one write. Upserts on `(student_id, lecture_id)`. */
export async function saveAttendance(batchId: string, lectureId: string, marks: AttendanceInput[]): Promise<void> {
  if (marks.length === 0) return;
  const { error } = await supabase.from('attendance').upsert(
    marks.map((mark) => ({
      student_id: mark.studentId,
      batch_id: batchId,
      lecture_id: lectureId,
      status: mark.status,
      total_attended_minutes: mark.minutes,
      source: mark.source,
    })),
    { onConflict: 'student_id,lecture_id' },
  );
  if (error) throw new Error(`Could not save the attendance: ${error.message}`);
}
