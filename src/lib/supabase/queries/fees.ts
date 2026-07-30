import { supabase } from '../client';
import type { StudentFee, BatchFeeSummary, FeePaymentLog, PaymentMethod } from '@/lib/types';

export async function getFeesByBatch(batchId: string): Promise<StudentFee[]> {
  const { data: existing } = await supabase
    .from('student_fees')
    .select('*')
    .eq('batch_id', batchId);

  const { data: mappings } = await supabase
    .from('batch_student_mapping')
    .select('student_id')
    .eq('batch_id', batchId)
    .eq('status', 'active');

  const existingFees = (existing ?? []) as StudentFee[];
  const existingStudentIds = new Set(existingFees.map((fee) => fee.student_id));
  const missingStudentIds = (mappings ?? [])
    .map((mapping) => mapping.student_id as string)
    .filter((studentId) => !existingStudentIds.has(studentId));

  if (missingStudentIds.length > 0) {
    await supabase.from('student_fees').insert(
      missingStudentIds.map((student_id) => ({ student_id, batch_id: batchId, total_fee: 0, paid_amount: 0 }))
    );
    const { data: refreshed } = await supabase
      .from('student_fees')
      .select('*')
      .eq('batch_id', batchId);
    return (refreshed ?? existingFees) as StudentFee[];
  }

  return existingFees;
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

export async function updateFeeTotal(id: string, totalFee: number): Promise<StudentFee | undefined> {
  const { data } = await supabase
    .from('student_fees')
    .update({ total_fee: totalFee, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  return data as StudentFee | undefined;
}

export async function getFeePaymentLogs(studentFeeId: string): Promise<FeePaymentLog[]> {
  const { data } = await supabase
    .from('fee_payment_logs')
    .select('*')
    .eq('student_fee_id', studentFeeId)
    .order('payment_date', { ascending: false });
  return (data ?? []) as FeePaymentLog[];
}

export async function addFeePaymentLog(input: {
  student_fee_id: string;
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod;
  notes?: string;
}): Promise<FeePaymentLog | undefined> {
  const { data: fee } = await supabase
    .from('student_fees')
    .select('student_id, batch_id, paid_amount')
    .eq('id', input.student_fee_id)
    .single();
  if (!fee) return undefined;

  const { data: log } = await supabase
    .from('fee_payment_logs')
    .insert({ ...input, student_id: fee.student_id, batch_id: fee.batch_id })
    .select()
    .single();
  if (!log) return undefined;

  await supabase
    .from('student_fees')
    .update({ paid_amount: Number(fee.paid_amount) + input.amount, updated_at: new Date().toISOString() })
    .eq('id', input.student_fee_id);
  return log as FeePaymentLog;
}

export async function getBatchFeeSummary(): Promise<BatchFeeSummary[]> {
  const { data } = await supabase
    .from('batch_fee_summary')
    .select('*');
  return (data ?? []) as BatchFeeSummary[];
}
