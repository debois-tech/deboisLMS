import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import type { Batch, Tutor, TutorBatchMapping } from '@/lib/types';

export async function getTutors(): Promise<Tutor[]> {
  return rows<Tutor>(
    await supabase.from('tutors').select('*').order('created_at', { ascending: false }),
    'Could not load tutors',
  );
}

export async function getTutorById(id: string): Promise<Tutor | undefined> {
  return maybeRow<Tutor>(
    await supabase.from('tutors').select('*').eq('id', id).single(),
    'Could not load this tutor',
  );
}

export async function getTutorBatches(tutorId: string): Promise<(TutorBatchMapping & { batch?: Batch })[]> {
  // Joined rather than fetched per mapping: the tutor detail page needs the batch
  // name for every row and used to await one lookup each.
  return rows<TutorBatchMapping & { batch?: Batch }>(
    await supabase
      .from('tutor_batch_mapping')
      .select('*, batch:batches(*)')
      .eq('tutor_id', tutorId),
    'Could not load this tutor’s batches',
  );
}

export async function createTutor(input: Omit<Tutor, 'id' | 'created_at'>): Promise<Tutor> {
  return row<Tutor>(
    await supabase.from('tutors').insert(input).select().single(),
    'Could not create the tutor',
  );
}

export async function getBatchTutors(batchId: string): Promise<(Tutor & { mapping: TutorBatchMapping })[]> {
  const mappings = rows<any>(
    await supabase.from('tutor_batch_mapping').select('*, tutors(*)').eq('batch_id', batchId),
    'Could not load the batch tutors',
  );

  return mappings.map((m) => ({
    ...(m.tutors as Tutor),
    mapping: { id: m.id, tutor_id: m.tutor_id, batch_id: m.batch_id, assigned_at: m.assigned_at },
  }));
}

export async function assignTutorToBatch(tutorId: string, batchId: string): Promise<TutorBatchMapping> {
  return row<TutorBatchMapping>(
    await supabase
      .from('tutor_batch_mapping')
      .insert({ tutor_id: tutorId, batch_id: batchId })
      .select()
      .single(),
    'Could not assign the tutor',
  );
}

export async function removeTutorFromBatch(mappingId: string): Promise<void> {
  ok(
    await supabase.from('tutor_batch_mapping').delete().eq('id', mappingId),
    'Could not remove the tutor',
  );
}
