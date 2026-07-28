import { supabase } from '../client';
import type { Batch } from '@/lib/types';

export async function getBatches(): Promise<Batch[]> {
  const { data } = await supabase
    .from('batches')
    .select('*')
    .order('created_at', { ascending: false });
  return (data ?? []) as Batch[];
}

export async function getBatchById(id: string): Promise<Batch | undefined> {
  const { data } = await supabase
    .from('batches')
    .select('*')
    .eq('id', id)
    .single();
  return data as Batch | undefined;
}

export async function createBatch(input: Omit<Batch, 'id' | 'created_at'>): Promise<Batch> {
  const { data } = await supabase
    .from('batches')
    .insert(input)
    .select()
    .single();
  return data as Batch;
}

export async function updateBatch(id: string, input: Partial<Batch>): Promise<Batch | undefined> {
  const { data } = await supabase
    .from('batches')
    .update(input)
    .eq('id', id)
    .select()
    .single();
  return data as Batch | undefined;
}

export async function deleteBatch(id: string): Promise<void> {
  await supabase.from('batches').delete().eq('id', id);
}