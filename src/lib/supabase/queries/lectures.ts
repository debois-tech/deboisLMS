import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import { getAttendanceByBatch } from './attendance';
import type { Lecture } from '@/lib/types';

export async function getLecturesByBatch(batchId: string): Promise<Lecture[]> {
  return rows<Lecture>(
    await supabase
      .from('lectures')
      .select('*, tutor:tutors(id, name)')
      .eq('batch_id', batchId)
      .order('lecture_date', { ascending: false }),
    'Could not load lectures',
  );
}

export async function createLecture(input: Omit<Lecture, 'id' | 'created_at' | 'tutor'>): Promise<Lecture> {
  // The database rejects a zero length with a constraint name; say it plainly instead.
  if ((input.scheduled_duration_minutes ?? 1) < 1) throw new Error('Lecture time cannot be 0');
  return row<Lecture>(
    await supabase.from('lectures').insert(input).select().single(),
    'Could not create the lecture',
  );
}

export async function updateLecture(id: string, input: Partial<Omit<Lecture, 'tutor'>>): Promise<Lecture | undefined> {
  return maybeRow<Lecture>(
    await supabase.from('lectures').update(input).eq('id', id).select().single(),
    'Could not save the lecture',
  );
}

export async function deleteLecture(id: string): Promise<void> {
  ok(await supabase.from('lectures').delete().eq('id', id), 'Could not delete the lecture');
}

export interface LectureAttendanceSummary {
  lecture_id: string;
  attended: number;
  applicable: number;
  marked_at: string | null;
  marked_by: string[];
}

/** Per lecture of one batch: attended of applicable students, last marked, and by whom. */
export async function getLectureSummaries(batchId: string): Promise<Map<string, LectureAttendanceSummary>> {
  // Worked out here from the batch's attendance rows (the same query the CSV export uses), not from a database view.
  // The totals are extra: if they cannot load, the lectures still show, with dashes.
  try {
    const summaries = new Map<string, LectureAttendanceSummary>();
    const editors = new Map<string, Set<string>>();
    for (const row of await getAttendanceByBatch(batchId)) {
      const entry = summaries.get(row.lecture_id) ?? { lecture_id: row.lecture_id, attended: 0, applicable: 0, marked_at: null, marked_by: [] };
      if (row.status !== 'no_appli') entry.applicable += 1;
      if (row.status === 'present' || row.status === 'partial') entry.attended += 1;
      if (row.marked_at && (!entry.marked_at || row.marked_at > entry.marked_at)) entry.marked_at = row.marked_at;
      for (const email of row.marked_by ?? []) editors.set(row.lecture_id, (editors.get(row.lecture_id) ?? new Set()).add(email));
      summaries.set(row.lecture_id, entry);
    }
    for (const [id, entry] of summaries) entry.marked_by = [...(editors.get(id) ?? [])].sort();
    return summaries;
  } catch (err) {
    console.error('[lectures] attendance totals', err);
    return new Map();
  }
}
