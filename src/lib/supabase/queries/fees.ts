import { supabase } from '../client';
import type { StudentFee, BatchFeeSummary } from '@/lib/types';

export async function getFeesByBatch(batchId: string): Promise<StudentFee[]> {
  const { data } = await supabase
    .from('student_fees')
    .select('*')
    .eq('batch_id', batchId);
  return (data ?? []) as StudentFee[];
}

export async function updateFeePayment(id: string, paidAmount: number): Promise<StudentFee | undefined> {
  const { data } = await supabase
    .from('student_fees')
    .update({ paid_amount: paidAmount, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return data as StudentFee | undefined;
}

export async function getBatchFeeSummary(): Promise<BatchFeeSummary[]> {
  const { data } = await supabase
    .from('batch_fee_summary')
    .select('*');
  return (data ?? []) as BatchFeeSummary[];
}