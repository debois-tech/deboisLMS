import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import { deriveBatchStatus } from '@/lib/utils/format';
import type { Batch } from '@/lib/types';

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
