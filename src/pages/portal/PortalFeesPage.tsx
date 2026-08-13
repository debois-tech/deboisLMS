import { useState } from 'react';
import { PartyPopper, Wallet } from 'lucide-react';
import {
  PortalEmpty,
  PortalFocus,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  PortalStatus,
  usePortalStudentId,
} from '@/components/portal';
import { getBatchById, getFeePaymentLogsByStudent, getMyFeeDues } from '@/lib/supabase';
import type { FeePaymentLog, StudentFeeDue } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { formatCurrency, formatDate } from '@/lib/utils/format';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
  other: 'Payment',
};

/** Balance and own payments only — reads `student_fee_dues`, so total_fee never reaches the browser. */
export default function PortalFeesPage() {
  const studentId = usePortalStudentId();
  const [fees, setFees] = useState<StudentFeeDue[]>([]);
  const [payments, setPayments] = useState<FeePaymentLog[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;

    const [feeRows, paymentRows] = await Promise.all([
      getMyFeeDues(),
      getFeePaymentLogsByStudent(studentId),
    ]);

    const batchIds = [...new Set([...feeRows, ...paymentRows].map((row) => row.batch_id))];
    const batches = await Promise.all(batchIds.map((id) => getBatchById(id)));

    setFees(feeRows);
    setPayments(paymentRows);
    setBatchNames(new Map(batchIds.map((id, index) => [id, batches[index]?.name ?? 'Batch'])));
  });

  const outstanding = fees.reduce((sum, fee) => sum + Math.max(0, Number(fee.amount_due)), 0);

  return (
    <PortalPage title="Your fees" loading={loading} error={error} onRetry={retry} shape="list">
      {fees.length === 0 && payments.length === 0 ? (
        <PortalEmpty icon={Wallet}>No fee set yet.</PortalEmpty>
      ) : (
        <>
          {/* One number is the whole page, so it is the page's answer rather than
              a tile in a grid of one. */}
          {outstanding > 0 ? (
            <PortalFocus
              icon={Wallet}
              title={`${formatCurrency(outstanding)} to pay`}
              detail="Pay your coordinator. Payments show here once they are recorded."
            />
          ) : (
            <PortalFocus icon={PartyPopper} title="Nothing to pay" detail="You are fully paid up." />
          )}

          {fees.length > 0 && (
            <PortalSection title="By batch">
              <PortalList>
                {fees.map((fee) => {
                  const due = Number(fee.amount_due);
                  return (
                    <PortalRow
                      key={fee.id}
                      primary={batchNames.get(fee.batch_id) ?? 'Batch'}
                      // Only the balance is ever spelled out. A settled batch says
                      // so with its pill and carries no figure at all.
                      secondary={due > 0 ? `${formatCurrency(due)} pending` : undefined}
                      muted={due <= 0}
                      trailing={<PortalStatus kind="fee" value={due > 0 ? 'due' : 'paid'} />}
                    />
                  );
                })}
              </PortalList>
            </PortalSection>
          )}

          {/* Answers "did my payment land?" without restating the account. */}
          <PortalSection title="Your payments">
            {payments.length === 0 ? (
              <PortalEmpty icon={Wallet}>No payments recorded yet.</PortalEmpty>
            ) : (
              <PortalList>
                {payments.map((payment) => (
                  <PortalRow
                    key={payment.id}
                    primary={formatCurrency(Number(payment.amount))}
                    secondary={`${METHOD_LABELS[payment.payment_method ?? 'other'] ?? 'Payment'} · ${
                      batchNames.get(payment.batch_id) ?? 'Batch'
                    }`}
                    trailing={
                      <span className="portal-row-meta">{formatDate(payment.payment_date)}</span>
                    }
                  />
                ))}
              </PortalList>
            )}
          </PortalSection>
        </>
      )}
    </PortalPage>
  );
}
