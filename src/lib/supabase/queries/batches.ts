import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import type { Batch } from '@/lib/types';

export async function getBatches(): Promise<Batch[]> {
  return rows<Batch>(
    await supabase.from('batches').select('*').order('created_at', { ascending: false }),
    'Could not load batches',
  );
}

export async function getBatchById(id: string): Promise<Batch | undefined> {
  return maybeRow<Batch>(
    await supabase.from('batches').select('*').eq('id', id).single(),
    'Could not load this batch',
  );
}

export async function createBatch(input: Omit<Batch, 'id' | 'created_at'>): Promise<Batch> {
  return row<Batch>(
    await supabase.from('batches').insert(input).select().single(),
    'Could not create the batch',
  );
}

export async function updateBatch(id: string, input: Partial<Batch>): Promise<Batch | undefined> {
  return maybeRow<Batch>(
    await supabase.from('batches').update(input).eq('id', id).select().single(),
    'Could not save the batch',
  );
}

export async function deleteBatch(id: string): Promise<void> {
  ok(await supabase.from('batches').delete().eq('id', id), 'Could not delete the batch');
}
