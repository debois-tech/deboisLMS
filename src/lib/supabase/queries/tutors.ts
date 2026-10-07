import { supabase } from '../client';
import { invokeLoginFunction, maybeRow, ok, row, rows } from './result';
import type { Batch, StudentCredentials, Tutor, TutorBatchMapping } from '@/lib/types';

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
  const mappings = rows<TutorBatchMapping & { tutors: Tutor }>(
    await supabase.from('tutor_batch_mapping').select('*, tutors(*)').eq('batch_id', batchId),
    'Could not load the batch tutors',
  );

  return mappings.map((m) => ({
    ...m.tutors,
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

// Removes the tutor, their batch links and their login — see delete_tutor() in schema.sql.
export async function deleteTutor(id: string): Promise<void> {
  ok(await supabase.rpc('delete_tutor', { p_tutor_id: id }), 'Could not delete this tutor');
}

export async function getTutorByAuthUserId(authUserId: string): Promise<Tutor | undefined> {
  return maybeRow<Tutor>(
    await supabase.from('tutors').select('*').eq('auth_user_id', authUserId).maybeSingle(),
    'Could not load your tutor record',
  );
}

/** Create uses the derived password; `rotate` issues a random one. Shown once, never stored. */
export async function createTutorLogin(tutorId: string, rotate = false): Promise<StudentCredentials> {
  return invokeLoginFunction('create-tutor-login', { tutor_id: tutorId, rotate });
}

export interface TutorAction {
  id: string;
  tutor_id: string | null;
  tutor_name: string;
  op: 'created' | 'updated' | 'deleted';
  item: string;
  detail: string | null;
  batch_id: string | null;
  times: number;
  created_at: string;
}

// Newest first; written by database triggers on everything a tutor changes
export async function getTutorActions(): Promise<TutorAction[]> {
  return rows<TutorAction>(
    await supabase.from('tutor_actions').select('*').order('created_at', { ascending: false }).limit(500),
    'Could not load the tutor log',
  );
}
