import { useEffect, useState } from 'react';
import { ReceiptText, Wallet } from 'lucide-react';
import {
  PortalEmpty,
  PortalList,
  PortalPage,
  PortalRow,
  PortalSection,
  PortalStat,
  PortalStatGrid,
  PortalStatus,
  usePortalStudentId,
} from '@/components/portal';
import { getBatchById, getFeePaymentLogsByStudent, getFeesByStudent } from '@/lib/supabase';
import type { FeePaymentLog, StudentFee } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';

/** The database stores `bank_transfer`; a receipt should read "Bank transfer". */
function paymentMethodLabel(method?: string): string {
  if (!method) return 'Other';
  const words = method.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export default function PortalFeesPage() {
  const studentId = usePortalStudentId();
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [logs, setLogs] = useState<FeePaymentLog[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    let active = true;

    (async () => {
      const [feeRows, logRows] = await Promise.all([
        getFeesByStudent(studentId),
        getFeePaymentLogsByStudent(studentId),
      ]);

      const batchIds = [...new Set([...feeRows, ...logRows].map((row) => row.batch_id))];
      const batches = await Promise.all(batchIds.map((id) => getBatchById(id)));

      if (!active) return;
      setFees(feeRows);
      setLogs(logRows);
      setBatchNames(new Map(batchIds.map((id, index) => [id, batches[index]?.name ?? 'Batch'])));
      setLoading(false);
    })();

    return () => { active = false; };
  }, [studentId]);

  const totalFee = fees.reduce((sum, fee) => sum + Number(fee.total_fee), 0);
  const totalPaid = fees.reduce((sum, fee) => sum + Number(fee.paid_amount), 0);
  const outstanding = totalFee - totalPaid;
  const paidPercent = totalFee > 0 ? Math.min(100, Math.round((totalPaid / totalFee) * 100)) : 0;

  return (
    <PortalPage title="Your fees" loading={loading}>
      {fees.length === 0 && logs.length === 0 ? (
        <PortalEmpty icon={Wallet}>No fee set yet.</PortalEmpty>
      ) : (
        <>
          <PortalStatGrid>
            <PortalStat
              label="Still to pay"
              icon={ReceiptText}
              value={outstanding > 0 ? formatCurrency(outstanding) : 'Nothing'}
              tone={outstanding > 0 ? 'attention' : 'positive'}
              note={outstanding > 0 ? 'Pay your coordinator' : undefined}
            />
            <PortalStat
              label="Paid so far"
              icon={Wallet}
              value={formatCurrency(totalPaid)}
              progress={paidPercent}
              note={`of ${formatCurrency(totalFee)}`}
            />
          </PortalStatGrid>

          {fees.length > 0 && (
            <PortalSection title="By batch">
              <PortalList>
                {fees.map((fee) => {
                  const due = Number(fee.total_fee) - Number(fee.paid_amount);
                  return (
                    <PortalRow
                      key={fee.id}
                      primary={batchNames.get(fee.batch_id) ?? 'Batch'}
                      secondary={
                        due > 0
                          ? `${formatCurrency(due)} of ${formatCurrency(Number(fee.total_fee))} left`
                          : `${formatCurrency(Number(fee.total_fee))} paid`
                      }
                      muted={due <= 0}
                      trailing={<PortalStatus kind="fee" value={due > 0 ? 'due' : 'paid'} />}
                    />
                  );
                })}
              </PortalList>
            </PortalSection>
          )}

          <PortalSection title="Payments">
            {logs.length === 0 ? (
              <PortalEmpty icon={ReceiptText}>No payments recorded yet.</PortalEmpty>
            ) : (
              <PortalList>
                {logs.map((log) => (
                  <PortalRow
                    key={log.id}
                    primary={formatCurrency(Number(log.amount))}
                    secondary={`${formatDate(log.payment_date)} · ${batchNames.get(log.batch_id) ?? 'Batch'}`}
                    trailing={
                      <span className="portal-row-meta">{paymentMethodLabel(log.payment_method)}</span>
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
