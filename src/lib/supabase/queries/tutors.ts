import { supabase } from '../client';
import type { Tutor, TutorBatchMapping } from '@/lib/types';

export async function getTutors(): Promise<Tutor[]> {
  const { data } = await supabase
    .from('tutors')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as Tutor[];
}

export async function getTutorById(id: string): Promise<Tutor | undefined> {
  const { data } = await supabase
    .from('tutors')
    .select('*')
    .eq('id', id)
    .single();
  return data as Tutor | undefined;
}

export async function getTutorBatches(tutorId: string): Promise<TutorBatchMapping[]> {
  const { data } = await supabase
    .from('tutor_batch_mapping')
    .select('*')
    .eq('tutor_id', tutorId);
  return (data ?? []) as TutorBatchMapping[];
}

export async function createTutor(input: Omit<Tutor, 'id' | 'created_at'>): Promise<Tutor> {
  const { data } = await supabase
    .from('tutors')
    .insert(input)
    .select()
    .single();
  return data as Tutor;
}

export async function getBatchTutors(batchId: string): Promise<(Tutor & { mapping: TutorBatchMapping })[]> {
  const { data: mappings } = await supabase
    .from('tutor_batch_mapping')
    .select('*, tutors(*)')
    .eq('batch_id', batchId);

  if (!mappings) return [];
  return mappings.map((m: any) => ({
    ...(m.tutors as Tutor),
    mapping: { id: m.id, tutor_id: m.tutor_id, batch_id: m.batch_id, assigned_at: m.assigned_at },
  }));
}

export async function assignTutorToBatch(tutorId: string, batchId: string): Promise<TutorBatchMapping> {
  const { data } = await supabase
    .from('tutor_batch_mapping')
    .insert({ tutor_id: tutorId, batch_id: batchId })
    .select()
    .single();
  return data as TutorBatchMapping;
}

export async function removeTutorFromBatch(mappingId: string): Promise<void> {
  await supabase.from('tutor_batch_mapping').delete().eq('id', mappingId);
}
