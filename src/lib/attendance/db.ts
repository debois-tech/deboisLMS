import { supabase } from '@/lib/supabase/client';
import type {
  AttendanceInsertPayload,
  ProcessingContext,
  RawUploadRow,
  RosterEntry,
} from './types';

/**
 * Load every raw upload row for a lecture, in CSV order.
 */
export async function loadUploadRows(lectureId: string): Promise<RawUploadRow[]> {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('lecture_id', lectureId)
    .order('sno');

  if (error) throw new Error(`Failed to read uploads: ${error.message}`);
  return (data ?? []) as RawUploadRow[];
}

/**
 * Build the processing context for a lecture:
 * lecture metadata, the active student roster for the lecture's batch,
 * all tutors, and the tutors assigned to that batch.
 */
export async function loadProcessingContext(lectureId: string): Promise<ProcessingContext> {
  const [lectureRes, tutorsRes, tutorMapRes] = await Promise.all([
    supabase
      .from('lectures')
      .select('id, batch_id, lecture_date, meeting_code, scheduled_duration_minutes')
      .eq('id', lectureId)
      .maybeSingle(),
    supabase.from('tutors').select('id, name'),
    supabase.from('tutor_batch_mapping').select('tutor_id').eq('batch_id', lectureId),
  ]);

  if (lectureRes.error) throw new Error(`Failed to load lecture: ${lectureRes.error.message}`);
  const lecture = lectureRes.data;
  if (!lecture) throw new Error(`Lecture ${lectureId} not found`);

  const rosterRes = await supabase
    .from('batch_student_mapping')
    .select('student_id, students!inner(id, name)')
    .eq('batch_id', lecture.batch_id)
    .eq('status', 'active');

  if (rosterRes.error) throw new Error(`Failed to load roster: ${rosterRes.error.message}`);

  const roster: RosterEntry[] = ((rosterRes.data ?? []) as any[])
    .map((r) => ({ studentId: r.students?.id, name: r.students?.name }))
    .filter((r): r is RosterEntry => Boolean(r.studentId && r.name));

  const tutors = (tutorsRes.data ?? []) as { id: string; name: string }[];
  const batchTutorIds = new Set<string>((tutorMapRes.data ?? []).map((t: any) => t.tutor_id));

  return {
    lectureId,
    batchId: lecture.batch_id,
    lectureDate: lecture.lecture_date,
    scheduledMinutes: lecture.scheduled_duration_minutes ?? 90,
    meetingCode: lecture.meeting_code,
    roster,
    tutors,
    batchTutorIds,
  };
}

/**
 * Insert cleaned attendance records.
 *
 * Uses an idempotent upsert on `(student_id, lecture_id)` so a re-run (e.g.
 * after a partial failure) cannot create duplicate rows.
 *
 * @returns the number of rows written.
 */
export async function insertAttendance(payloads: AttendanceInsertPayload[]): Promise<number> {
  if (payloads.length === 0) return 0;

  const { data, error } = await supabase
    .from('attendance')
    .upsert(payloads, { onConflict: 'student_id,lecture_id' })
    .select('id');

  if (error) throw new Error(`Failed to insert attendance: ${error.message}`);
  return (data ?? []).length;
}

/**
 * Delete all upload rows for a lecture.
 *
 * Only ever called after the attendance insert succeeded, so the upload table
 * stays intact if processing fails midway.
 */
export async function clearUploads(lectureId: string): Promise<void> {
  const { error } = await supabase.from('uploads').delete().eq('lecture_id', lectureId);
  if (error) throw new Error(`Failed to clear uploads: ${error.message}`);
}
