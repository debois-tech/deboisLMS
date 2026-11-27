import { techError } from '@/lib/utils/errors';
import { supabase } from '@/lib/supabase/client';
import type { ExistingRecord } from './consolidate';
import { DEFAULT_LECTURE_MINUTES } from './types';
import type {
  AttendanceInsertPayload,
  ProcessingContext,
  RawUploadRow,
  RosterEntry,
} from './types';

/** Load every raw upload row for a lecture, in CSV order. */
export async function loadUploadRows(lectureId: string): Promise<RawUploadRow[]> {
  const { data, error } = await supabase
    .from('uploads')
    .select('*')
    .eq('lecture_id', lectureId)
    .order('sno');

  if (error) throw techError('Could not read the attendance uploads', error.message);
  return (data ?? []) as RawUploadRow[];
}

/** Build the processing context: lecture metadata, the active roster, and assigned tutors. */
export async function loadProcessingContext(lectureId: string): Promise<ProcessingContext> {
  const [lectureRes, tutorsRes] = await Promise.all([
    supabase
      .from('lectures')
      .select('id, batch_id, lecture_date, scheduled_duration_minutes')
      .eq('id', lectureId)
      .maybeSingle(),
    supabase.from('tutors').select('id, name'),
  ]);

  if (lectureRes.error) throw techError('Could not load the lecture', lectureRes.error.message);
  const lecture = lectureRes.data;
  if (!lecture) throw new Error('Lecture not found');

  const tutorMapRes = await supabase.from('tutor_batch_mapping').select('tutor_id').eq('batch_id', lecture.batch_id);

  const rosterRes = await supabase
    .from('batch_student_mapping')
    .select('student_id, joined_at, students!inner(id, name)')
    .eq('batch_id', lecture.batch_id)
    .eq('status', 'active');

  if (rosterRes.error) throw techError('Could not load the class list', rosterRes.error.message);

  type RosterRow = { student_id: string; joined_at: string | null; students: { id: string; name: string } | null };

  const roster: RosterEntry[] = ((rosterRes.data ?? []) as unknown as RosterRow[])
    .map((r) => ({ studentId: r.students?.id, name: r.students?.name, joinedAt: r.joined_at }))
    .filter((r): r is RosterEntry => Boolean(r.studentId && r.name));

  const tutors = (tutorsRes.data ?? []) as { id: string; name: string }[];
  const batchTutorIds = new Set<string>(
    ((tutorMapRes.data ?? []) as { tutor_id: string }[]).map((t) => t.tutor_id),
  );

  return {
    lectureId,
    batchId: lecture.batch_id,
    lectureDate: lecture.lecture_date,
    scheduledMinutes: lecture.scheduled_duration_minutes ?? DEFAULT_LECTURE_MINUTES,
    roster,
    tutors,
    batchTutorIds,
  };
}

/** What is already on the register for a lecture, so a re-run can leave hand-entered rows alone. */
export async function loadExistingAttendance(lectureId: string): Promise<ExistingRecord[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('student_id, source')
    .eq('lecture_id', lectureId);

  if (error) throw techError('Could not read the saved attendance', error.message);
  return (data ?? []) as ExistingRecord[];
}

/** Idempotent on `(student_id, lecture_id)`, so a re-run cannot duplicate. Returns rows written. */
export async function insertAttendance(payloads: AttendanceInsertPayload[]): Promise<number> {
  if (payloads.length === 0) return 0;

  const { data, error } = await supabase
    .from('attendance')
    .upsert(payloads, { onConflict: 'student_id,lecture_id' })
    .select('id');

  if (error) throw techError('Could not save the attendance', error.message);
  return (data ?? []).length;
}

/** Delete all upload rows for a lecture. Only called after the attendance insert succeeded. */
export async function clearUploads(lectureId: string): Promise<void> {
  const { error } = await supabase.from('uploads').delete().eq('lecture_id', lectureId);
  if (error) throw techError('Could not clear the attendance uploads', error.message);
}
