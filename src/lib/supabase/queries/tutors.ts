import { supabase } from '../client';
import { invokeLoginFunction, maybeRow, ok, row, rows } from './result';
import type { Batch, StudentCredentials, Tutor, TutorBatchMapping } from '@/lib/types';

/** Active tutors by default: the pickers must never offer an archived one. */
export async function getTutors(status: Tutor['status'] = 'active'): Promise<Tutor[]> {
  return rows<Tutor>(
    await supabase.from('tutors').select('*').eq('status', status).order('created_at', { ascending: false }),
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
      // !inner drops a batch the viewer cannot read, so an admin never sees a test batch.
      .select('*, batch:batches!inner(*)')
      .eq('tutor_id', tutorId),
    'Could not load this tutor’s batches',
  );
}

// Every tutor's assignments, for the Tutors table.
export async function getAllTutorBatches(): Promise<(TutorBatchMapping & { batch?: Batch })[]> {
  return rows<TutorBatchMapping & { batch?: Batch }>(
    await supabase.from('tutor_batch_mapping').select('*, batch:batches!inner(*)'),
    'Could not load tutor batches',
  );
}

export async function createTutor(input: Pick<Tutor, 'name' | 'email' | 'phone'>): Promise<Tutor> {
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

/** What a tutor holds in each batch, so the unassign flow can say what Delete would erase. */
export interface TutorBatchFootprint {
  mapping_id: string;
  materials: number;
  quizzes: number;
  images: number;
  badges: number;
  curriculum: number;
  actions: number;
}

export async function getTutorBatchFootprints(mappingIds: string[]): Promise<TutorBatchFootprint[]> {
  return rows<TutorBatchFootprint>(
    await supabase.rpc('tutor_batch_footprints', { p_mappings: mappingIds }),
    'Could not load what this tutor holds',
  );
}

/** Unassigns the tutor. `erase` also deletes what they made in that batch, files included. */
export async function removeTutorFromBatch(mappingId: string, erase = false): Promise<void> {
  const { data, error } = await supabase.rpc('remove_tutor_from_batch', {
    p_mapping: mappingId,
    p_delete: erase,
  });
  ok({ error }, 'Could not remove the tutor from this batch');
  if (!erase) return;

  const { materials, images } = data as { materials: string[]; images: string[] };
  const results = await Promise.all([
    materials.length > 0 ? supabase.storage.from('materials').remove(materials) : null,
    images.length > 0 ? supabase.storage.from('assets').remove(images) : null,
  ]);
  if (results.some((result) => result?.error)) throw new Error('The data is deleted but some files could not be removed');
}

/** Deletes the login, takes the tutor off every batch and archives them; their work stays. See archive_tutor(). */
export async function archiveTutor(id: string): Promise<void> {
  ok(await supabase.rpc('archive_tutor', { p_tutor_id: id }), 'Could not delete this login');
}

// Removes an archived tutor for good — see delete_tutor() in schema.sql.
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
