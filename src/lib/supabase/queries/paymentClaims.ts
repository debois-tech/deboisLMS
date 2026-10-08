import { supabase } from '../client';
import { ok, row, rows } from './result';
import { getStudents } from './students';
import { getBatches } from './batches';
import type { FeePaymentLog, PaymentClaim, StudentFee } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { toCsv, downloadCsv } from '@/lib/utils/csvExport';

const QR_PATH = 'qr_img.jpeg';

const qrCacheBust = Date.now();

/** Public URL, no fetch — the 'assets' bucket serves it straight off a CDN. */
export function getPaymentQrUrl(): string {
  const url = supabase.storage.from('assets').getPublicUrl(QR_PATH).data.publicUrl;
  return `${url}?v=${qrCacheBust}`;
}

export async function submitPaymentClaim(
  studentId: string,
  batchId: string | undefined,
  transactionId: string,
  amount: number,
): Promise<void> {
  // No .select(): students may insert but not read payment_claims, and RETURNING needs a SELECT policy.
  ok(
    await supabase
      .from('payment_claims')
      .insert({ student_id: studentId, batch_id: batchId ?? null, transaction_id: transactionId, amount }),
    'Could not submit your payment details',
  );
}

export async function getPendingClaims(studentId: string): Promise<PaymentClaim[]> {
  return rows<PaymentClaim>(
    await supabase
      .from('payment_claims')
      .select('*')
      .eq('student_id', studentId)
      .eq('status', 'pending')
      .order('created_at'),
    'Could not load payment claims',
  );
}

/** Fired on window once a claim is approved or dismissed, so the bottom-right notice recounts. */
export const CLAIMS_CHANGED = 'claims-changed';

export type PendingClaimRow = PaymentClaim & { student?: { name: string; is_test: boolean } | null };

/** Every live student's pending claim, oldest first, with their name for the notice. Test students' stay on their own page. */
export async function getAllPendingClaims(): Promise<PendingClaimRow[]> {
  return rows<PendingClaimRow>(
    await supabase
      .from('payment_claims')
      .select('*, student:students(name, is_test)')
      .eq('status', 'pending')
      .order('created_at'),
    'Could not load payment claims',
  ).filter((claim) => !claim.student?.is_test);
}

/** Logs the claim as a payment and marks it approved, in one transaction. */
export async function approvePaymentClaim(claimId: string): Promise<{ log: FeePaymentLog; fee: StudentFee }> {
  const result = row<{ log: FeePaymentLog; fee: StudentFee }>(
    await supabase.rpc('approve_payment_claim', { p_claim_id: claimId }),
    'Could not approve this claim',
  );
  window.dispatchEvent(new Event(CLAIMS_CHANGED));
  return result;
}

export async function dismissPaymentClaim(claimId: string): Promise<void> {
  ok(
    await supabase.from('payment_claims').update({ status: 'dismissed' }).eq('id', claimId).eq('status', 'pending'),
    'Could not dismiss this claim',
  );
  window.dispatchEvent(new Event(CLAIMS_CHANGED));
}

/** Admin-only export. Claims are verified from the student page and the payment log popup. */
export async function exportPaymentClaimsCsv(): Promise<void> {
  const [claimsResult, students, batches] = await Promise.all([
    supabase.from('payment_claims').select('*').order('created_at', { ascending: false }),
    getStudents(),
    getBatches(),
  ]);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const claims = rows<PaymentClaim>(claimsResult, 'Could not load payment claims')
    .filter((claim) => !studentById.get(claim.student_id)?.is_test);
  const batchNameById = new Map(batches.map((b) => [b.id, b.name]));

  const csv = toCsv(
    ['Student', 'Student Code', 'Batch', 'Transaction ID', 'Amount', 'Status', 'Submitted At'],
    claims.map((claim) => {
      const student = studentById.get(claim.student_id);
      return [
        student?.name ?? 'Unknown',
        student?.student_code ?? '',
        claim.batch_id ? batchNameById.get(claim.batch_id) ?? 'Unknown' : '',
        claim.transaction_id,
        claim.amount,
        claim.status,
        formatDateTime(claim.created_at),
      ];
    }),
  );
  downloadCsv('payment-claims.csv', csv);
}
