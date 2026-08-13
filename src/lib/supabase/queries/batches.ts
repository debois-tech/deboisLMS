import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import { deriveBatchStatus } from '@/lib/utils/format';
import type { Batch, BatchProgram, BatchProgramOption } from '@/lib/types';

/**
 * The status column follows the calendar, so a row that has since started is
 * corrected on read. The write is best-effort — students may read batches but
 * not update them — and the returned row carries the right status either way.
 */
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

export async function deleteBatch(id: string): Promise<void> {
  ok(await supabase.from('batches').delete().eq('id', id), 'Could not delete the batch');
}

/** Every programme, from the database rather than a list in the app. */
export async function getBatchPrograms(): Promise<BatchProgramOption[]> {
  return rows<BatchProgramOption>(
    await supabase.from('batch_programs').select('*').order('sort_order'),
    'Could not load programmes',
  );
}

/** The shape the database enforces on a code, checked here so the error is readable. */
export const PROGRAM_CODE_PATTERN = /^[A-Z]{2,6}$/;

/**
 * Adds a programme, or renames the one already holding that code. Called when a
 * batch is created under an abbreviation that does not exist yet, so the list
 * grows from ordinary use rather than from a migration.
 */
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

/**
 * The live batch running a programme. Completed batches are never targeted, so
 * last year's intake cannot absorb this year's students. Throws when the answer
 * is not exactly one batch — silently picking would put students somewhere the
 * admin did not choose.
 */
export function resolveProgramBatch(batches: Batch[], program: BatchProgram, programName: string): Batch {
  const live = batches.filter((b) => b.program === program && b.status !== 'completed');
  if (live.length === 1) return live[0];
  throw new Error(
    live.length === 0
      ? `No open batch for ${programName}. Create one, or reopen the finished batch.`
      : `${programName} has ${live.length} open batches. Import from the batch's own page instead.`,
  );
}
