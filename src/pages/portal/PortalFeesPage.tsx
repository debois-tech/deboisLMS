import { useEffect, useState } from 'react';
import { ReceiptText, Wallet } from 'lucide-react';
import { PortalEmpty, PortalPage, PortalRow, PortalStat, usePortalStudentId } from '@/components/portal/PortalPage';
import { getBatchById, getFeePaymentLogsByStudent, getFeesByStudent } from '@/lib/supabase';
import type { FeePaymentLog, StudentFee } from '@/lib/types';
import { formatCurrency, formatDate } from '@/lib/utils/format';

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
    <PortalPage title="Fees" subtitle="Your fee status and payment history" loading={loading}>
      {fees.length === 0 && logs.length === 0 ? (
        <PortalEmpty>No fee record yet.</PortalEmpty>
      ) : (
        <>
          <div className="portal-stat-grid">
            <PortalStat
              label="Paid"
              icon={Wallet}
              value={formatCurrency(totalPaid)}
              note={`of ${formatCurrency(totalFee)} total`}
            >
              <div className="portal-progress">
                <div className="portal-progress-fill" style={{ transform: `scaleX(${paidPercent / 100})` }} />
              </div>
            </PortalStat>
            <PortalStat
              label="Outstanding"
              icon={ReceiptText}
              value={outstanding > 0 ? formatCurrency(outstanding) : 'Nil'}
              note={outstanding > 0 ? 'Due to be paid' : 'Paid in full'}
            />
          </div>

          {fees.length > 0 && (
            <section>
              <h2 className="portal-page-title">By batch</h2>
              <div className="portal-list mt-3">
                {fees.map((fee) => {
                  const due = Number(fee.total_fee) - Number(fee.paid_amount);
                  return (
                    <PortalRow
                      key={fee.id}
                      primary={batchNames.get(fee.batch_id) ?? 'Batch'}
                      secondary={`${formatCurrency(Number(fee.paid_amount))} paid of ${formatCurrency(Number(fee.total_fee))}`}
                      trailing={
                        <span className={`text-xs font-semibold ${due > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {due > 0 ? `${formatCurrency(due)} due` : 'Paid'}
                        </span>
                      }
                    />
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2 className="portal-page-title">Payment history</h2>
            <div className="mt-3">
              {logs.length === 0 ? (
                <PortalEmpty>No payments recorded yet.</PortalEmpty>
              ) : (
                <div className="portal-list">
                  {logs.map((log) => (
                    <PortalRow
                      key={log.id}
                      primary={formatCurrency(Number(log.amount))}
                      secondary={`${formatDate(log.payment_date)} · ${batchNames.get(log.batch_id) ?? 'Batch'}`}
                      trailing={
                        <span className="text-xs capitalize text-[var(--text-muted)]">
                          {(log.payment_method ?? 'other').replace('_', ' ')}
                        </span>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </PortalPage>
  );
}
