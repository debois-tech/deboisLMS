import { supabase } from '../client';
import { removeStoredDocuments } from './documents';
import { deleteBatchMaterials } from './materials';
import { maybeRow, ok, row, rows } from './result';
import { deriveBatchStatus } from '@/lib/utils/format';
import type { Batch, BatchProgramOption } from '@/lib/types';

// Status follows the calendar, corrected on read. Best-effort write — students cannot update.
function syncStatus(batch: Batch): Batch {
  const status = deriveBatchStatus(batch);
  if (status === batch.status) return batch;
  void supabase.from('batches').update({ status }).eq('id', batch.id).then(() => {});
  return { ...batch, status };
}

export async function getBatches(): Promise<Batch[]> {
  return rows<Batch>(
    await supabase.from('batches').select('*').order('created_at', { ascending: false }),
    'Could not load batches',
  ).map(syncStatus);
}

export async function getBatchById(id: string): Promise<Batch | undefined> {
  const batch = maybeRow<Batch>(
    await supabase.from('batches').select('*').eq('id', id).single(),
    'Could not load this batch',
  );
  return batch && syncStatus(batch);
}

export async function createBatch(input: Omit<Batch, 'id' | 'created_at'>): Promise<Batch> {
  return row<Batch>(
    await supabase.from('batches').insert({ ...input, status: deriveBatchStatus(input) }).select().single(),
    'Could not create the batch',
  );
}

export async function updateBatch(id: string, input: Partial<Batch>): Promise<Batch | undefined> {
  const patch = 'start_date' in input ? { ...input, status: deriveBatchStatus(input) } : input;
  return maybeRow<Batch>(
    await supabase.from('batches').update(patch).eq('id', id).select().single(),
    'Could not save the batch',
  );
}

// Marks the batch finished on `endedOn` (YYYY-MM-DD). Logins survive 30 more days.
export async function endBatch(id: string, endedOn: string): Promise<Batch> {
  return row<Batch>(
    await supabase.rpc('end_batch', { p_batch_id: id, p_ended_on: endedOn }),
    'Could not end this batch',
  );
}

export interface BatchDeletionCounts {
  students: number;
  fees: number;
  payments: number;
  lectures: number;
  attendance: number;
  assignments: number;
  materials: number;
  tutors: number;
}

// Counted in the browser so this needs no RPC. Every one of these cascades with the batch.
export async function getBatchDeletionCounts(batchId: string): Promise<BatchDeletionCounts> {
  const count = async (table: string) => {
    const { count: total, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('batch_id', batchId);
    if (error) throw new Error(`Could not count ${table}: ${error.message}`);
    return total ?? 0;
  };

  const [students, fees, payments, lectures, attendance, assignments, materials, tutors] =
    await Promise.all([
      count('batch_student_mapping'),
      count('student_fees'),
      count('fee_payment_logs'),
      count('lectures'),
      count('attendance'),
      count('assignments'),
      count('materials'),
      count('tutor_batch_mapping'),
    ]);

  return { students, fees, payments, lectures, attendance, assignments, materials, tutors };
}

// Material files first: materials cascade with the batch, taking their storage paths with them.
// Document files after: they are named by enrolment, and those cascade too.
export async function deleteBatch(id: string): Promise<void> {
  await deleteBatchMaterials(id);
  const enrolments = rows<{ id: string }>(
    await supabase.from('batch_student_mapping').select('id').eq('batch_id', id),
    'Could not read the batch enrolments',
  );
  ok(await supabase.from('batches').delete().eq('id', id), 'Could not delete the batch');
  await removeStoredDocuments(enrolments.map((e) => e.id));
}

/** One way: the batch and its students leave every total, and the students take refs from the test series. */
export async function convertBatchToTest(id: string): Promise<{ converted: number }> {
  return row<{ converted: number }>(
    await supabase.rpc('convert_batch_to_test', { p_batch_id: id }),
    'Could not convert this batch',
  );
}

// Every programme, from the database rather than a list in the app.
export async function getBatchPrograms(): Promise<BatchProgramOption[]> {
  return rows<BatchProgramOption>(
    await supabase.from('batch_programs').select('*').order('sort_order'),
    'Could not load programmes',
  );
}

// The shape the database enforces on a code, checked here so the error is readable.
export const PROGRAM_CODE_PATTERN = /^[A-Z]{2,6}$/;

// Adds or renames a programme, when a batch names a code that does not exist yet.
export async function saveBatchProgram(
  code: string,
  name: string,
  sortOrder?: number,
): Promise<BatchProgramOption> {
  const normalized = code.trim().toUpperCase();
  if (!PROGRAM_CODE_PATTERN.test(normalized)) {
    throw new Error('An abbreviation is 2 to 6 capital letters, e.g. PHR.');
  }
  if (!name.trim()) throw new Error('Give the programme a full name.');

  return row<BatchProgramOption>(
    await supabase
      .from('batch_programs')
      .upsert(
        { code: normalized, name: name.trim(), ...(sortOrder === undefined ? {} : { sort_order: sortOrder }) },
        { onConflict: 'code' },
      )
      .select()
      .single(),
    'Could not save the programme',
  );
}
