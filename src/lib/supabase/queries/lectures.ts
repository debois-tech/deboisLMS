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

export async function getLectureById(id: string): Promise<Lecture | undefined> {
  return maybeRow<Lecture>(
    await supabase.from('lectures').select('*').eq('id', id).single(),
    'Could not load this lecture',
  );
}

export async function createLecture(input: Omit<Lecture, 'id' | 'created_at'>): Promise<Lecture> {
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
