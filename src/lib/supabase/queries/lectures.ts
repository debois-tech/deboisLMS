import { supabase } from '../client';
import type { Lecture } from '@/lib/types';

export async function getLecturesByBatch(batchId: string): Promise<Lecture[]> {
  const { data } = await supabase
    .from('lectures')
    .select('*')
    .eq('batch_id', batchId)
    .order('lecture_date', { ascending: false });
  return (data ?? []) as Lecture[];
}

export async function getLectureById(id: string): Promise<Lecture | undefined> {
  const { data } = await supabase
    .from('lectures')
    .select('*')
    .eq('id', id)
    .single();
  return data as Lecture | undefined;
}

export async function createLecture(input: Omit<Lecture, 'id' | 'created_at'>): Promise<Lecture> {
  const { data } = await supabase
    .from('lectures')
    .insert(input)
    .select()
    .single();
  return data as Lecture;
}

export async function deleteLecture(id: string): Promise<void> {
  await supabase.from('lectures').delete().eq('id', id);
}