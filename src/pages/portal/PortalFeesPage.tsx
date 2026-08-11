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
import { getBatchById, getFeesByStudent } from '@/lib/supabase';
import type { StudentFee } from '@/lib/types';
import { useInitialLoad } from '@/lib/hooks/useInitialLoad';
import { formatCurrency } from '@/lib/utils/format';

/**
 * What the student still owes, and nothing else. The totals and the running
 * paid-so-far figure are deliberately absent: a student acts on the balance, and
 * the fuller picture is the admin's to hold.
 */
export default function PortalFeesPage() {
  const studentId = usePortalStudentId();
  const [fees, setFees] = useState<StudentFee[]>([]);
  const [batchNames, setBatchNames] = useState<Map<string, string>>(new Map());

  const { loading, error, retry } = useInitialLoad(async () => {
    if (!studentId) return;

    const feeRows = await getFeesByStudent(studentId);
    const batchIds = [...new Set(feeRows.map((row) => row.batch_id))];
    const batches = await Promise.all(batchIds.map((id) => getBatchById(id)));

    setFees(feeRows);
    setBatchNames(new Map(batchIds.map((id, index) => [id, batches[index]?.name ?? 'Batch'])));
  });

  const dueOn = (fee: StudentFee) => Number(fee.total_fee) - Number(fee.paid_amount);
  const outstanding = fees.reduce((sum, fee) => sum + Math.max(0, dueOn(fee)), 0);

  return (
    <PortalPage title="Your fees" loading={loading} error={error} onRetry={retry} shape="list">
      {fees.length === 0 ? (
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

          <PortalSection title="By batch">
            <PortalList>
              {fees.map((fee) => {
                const due = dueOn(fee);
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
        </>
      )}
    </PortalPage>
  );
}
