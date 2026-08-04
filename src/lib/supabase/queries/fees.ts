import { supabase } from '../client';
import { maybeRow, ok, row, rows } from './result';
import type { StudentFee, BatchFeeSummary, FeePaymentLog, PaymentMethod } from '@/lib/types';

/**
 * Fees for a batch, backfilling a zeroed row for any active student who has none
 * yet — the finance table is built from this, so a student missing a row would
 * otherwise be invisible on it.
 */
export async function getFeesByBatch(batchId: string): Promise<StudentFee[]> {
  const existingFees = rows<StudentFee>(
    await supabase.from('student_fees').select('*').eq('batch_id', batchId),
    'Could not load fees for this batch',
  );

  const mappings = rows<{ student_id: string }>(
    await supabase
      .from('batch_student_mapping')
      .select('student_id')
      .eq('batch_id', batchId)
      .eq('status', 'active'),
    'Could not load the batch roster',
  );

  const existingStudentIds = new Set(existingFees.map((fee) => fee.student_id));
  const missingStudentIds = mappings
    .map((mapping) => mapping.student_id)
    .filter((studentId) => !existingStudentIds.has(studentId));

  if (missingStudentIds.length === 0) return existingFees;

  ok(
    await supabase.from('student_fees').insert(
      missingStudentIds.map((student_id) => ({
        student_id,
        batch_id: batchId,
        total_fee: 0,
        paid_amount: 0,
      })),
    ),
    'Could not create fee records for new students',
  );

  return rows<StudentFee>(
    await supabase.from('student_fees').select('*').eq('batch_id', batchId),
    'Could not reload fees for this batch',
  );
}

export async function updateFeePayment(id: string, paidAmount: number): Promise<StudentFee | undefined> {
  return maybeRow<StudentFee>(
    await supabase
      .from('student_fees')
      .update({ paid_amount: paidAmount, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single(),
    'Could not save the payment',
  );
}

export async function getFeePaymentLogs(studentFeeId: string): Promise<FeePaymentLog[]> {
  return rows<FeePaymentLog>(
    await supabase
      .from('fee_payment_logs')
      .select('*')
      .eq('student_fee_id', studentFeeId)
      .order('payment_date', { ascending: false }),
    'Could not load the payment history',
  );
}

/** Records the payment log and balance update in one database transaction. */
export async function addFeePaymentLog(input: {
  student_fee_id: string;
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod;
  notes?: string;
}): Promise<{ log: FeePaymentLog; fee: StudentFee }> {
  return row<{ log: FeePaymentLog; fee: StudentFee }>(
    await supabase.rpc('record_fee_payment', {
      p_student_fee_id: input.student_fee_id,
      p_amount: input.amount,
      p_payment_date: input.payment_date,
      p_payment_method: input.payment_method ?? 'other',
      p_notes: input.notes ?? null,
    }),
    'Could not record the payment',
  );
}

export async function getBatchFeeSummary(): Promise<BatchFeeSummary[]> {
  return rows<BatchFeeSummary>(
    await supabase.from('batch_fee_summary').select('*'),
    'Could not load the fee summary',
  );
}

export async function getFeesByStudent(studentId: string): Promise<StudentFee[]> {
  return rows<StudentFee>(
    await supabase
      .from('student_fees')
      .select('*')
      .eq('student_id', studentId)
      .order('updated_at', { ascending: false }),
    'Could not load your fees',
  );
}

export async function getFeePaymentLogsByStudent(studentId: string): Promise<FeePaymentLog[]> {
  return rows<FeePaymentLog>(
    await supabase
      .from('fee_payment_logs')
      .select('*')
      .eq('student_id', studentId)
      .order('payment_date', { ascending: false }),
    'Could not load your payments',
  );
}
