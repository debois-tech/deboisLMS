import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import type { Lecture } from '@/lib/types';

export async function getLecturesByBatch(batchId: string): Promise<Lecture[]> {
  return rows<Lecture>(
    await supabase
      .from('lectures')
      .select('*')
      .eq('batch_id', batchId)
      .order('lecture_date', { ascending: false }),
    'Could not load lectures',
  );
}

export async function createLecture(input: Omit<Lecture, 'id' | 'created_at'>): Promise<Lecture> {
  // The database rejects a zero length with a constraint name; say it plainly instead.
  if ((input.scheduled_duration_minutes ?? 1) < 1) throw new Error('Lecture time cannot be 0');
  return row<Lecture>(
    await supabase.from('lectures').insert(input).select().single(),
    'Could not create the lecture',
  );
}

export async function updateLecture(id: string, input: Partial<Lecture>): Promise<Lecture | undefined> {
  return maybeRow<Lecture>(
    await supabase.from('lectures').update(input).eq('id', id).select().single(),
    'Could not save the lecture',
  );
}

export async function deleteLecture(id: string): Promise<void> {
  ok(await supabase.from('lectures').delete().eq('id', id), 'Could not delete the lecture');
}
