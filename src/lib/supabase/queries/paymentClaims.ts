import { supabase } from '../client';
import { row, rows } from './result';
import { getStudents } from './students';
import { getBatches } from './batches';
import type { PaymentClaim } from '@/lib/types';
import { formatDateTime } from '@/lib/utils/format';
import { toCsv, downloadCsv } from '@/lib/utils/csvExport';

const QR_PATH = 'qr.jpeg';

/** Public URL, no fetch — the 'assets' bucket serves it straight off a CDN. */
export function getPaymentQrUrl(): string {
  return supabase.storage.from('assets').getPublicUrl(QR_PATH).data.publicUrl;
}

export async function submitPaymentClaim(
  studentId: string,
  batchId: string | undefined,
  transactionId: string,
  amount: number,
): Promise<PaymentClaim> {
  return row<PaymentClaim>(
    await supabase
      .from('payment_claims')
      .insert({ student_id: studentId, batch_id: batchId ?? null, transaction_id: transactionId, amount })
      .select()
      .single(),
    'Could not submit your payment details',
  );
}

/** Admin-only, export-only — nothing in the UI lists these; the office still logs payments by hand. */
export async function exportPaymentClaimsCsv(): Promise<void> {
  const [claimsResult, students, batches] = await Promise.all([
    supabase.from('payment_claims').select('*').order('created_at', { ascending: false }),
    getStudents(),
    getBatches(),
  ]);
  const claims = rows<PaymentClaim>(claimsResult, 'Could not load payment claims');

  const studentById = new Map(students.map((s) => [s.id, s]));
  const batchNameById = new Map(batches.map((b) => [b.id, b.name]));

  const csv = toCsv(
    ['Student', 'Student Code', 'Batch', 'Transaction ID', 'Amount', 'Submitted At'],
    claims.map((claim) => {
      const student = studentById.get(claim.student_id);
      return [
        student?.name ?? 'Unknown',
        student?.student_code ?? '',
        claim.batch_id ? batchNameById.get(claim.batch_id) ?? 'Unknown' : '',
        claim.transaction_id,
        claim.amount,
        formatDateTime(claim.created_at),
      ];
    }),
  );
  downloadCsv('payment-claims.csv', csv);
}
