import { ReactNode, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { formatCurrency } from '@/lib/utils/format';
import type { EarningBreakdown } from '@/lib/types';

const ALL = 'all';

interface EarningBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  breakdown: EarningBreakdown[];
}

/** A figure and what it is. Amounts share one column so they can be read down. */
function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${tone ?? 'text-[var(--text-primary)]'}`}>{value}</span>
    </div>
  );
}

/** Where a figure came from. Reads as commentary, never as another headline. */
function SubLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-xs text-[var(--text-muted)]">
      <span>{label}</span>
      {value && <span className="tabular-nums">{value}</span>}
    </div>
  );
}

function Group({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

export function EarningBreakdownModal({ open, onClose, breakdown }: EarningBreakdownModalProps) {
  const [batchId, setBatchId] = useState<string>(ALL);

  const totals = useMemo(() => {
    const rows = batchId === ALL ? breakdown : breakdown.filter((row) => row.batch_id === batchId);
    const sum = (pick: (row: EarningBreakdown) => number) =>
      rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);

    return {
      collected: sum((row) => row.collected),
      collectedActive: sum((row) => row.collected_active),
      collectedTerminated: sum((row) => row.collected_terminated),
      pending: sum((row) => row.pending),
      voidAmount: sum((row) => row.void_amount),
      neverDue: sum((row) => row.never_due),
      recovered: sum((row) => row.recovered),
      activeStudents: sum((row) => row.active_students),
      terminatedStudents: sum((row) => row.terminated_students),
    };
  }, [breakdown, batchId]);

  const options = [
    { value: ALL, label: 'All batches' },
    ...breakdown.map((row) => ({ value: row.batch_id, label: row.batch_name })),
  ];

  const students = (count: number) => `${count} ${count === 1 ? 'student' : 'students'}`;

  return (
    <Modal open={open} onClose={onClose} title="Earning breakdown" size="lg">
      <div className="flex flex-col gap-7">
        <SearchSelect
          options={options}
          value={batchId}
          onChange={setBatchId}
          placeholder="All batches"
          searchPlaceholder="Search batches"
          emptyText="No batches found"
          className="max-w-xs"
        />

        {breakdown.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No batches to report on yet.</p>
        ) : (
          <>
            <Group>
              <Line label="Collected" value={formatCurrency(totals.collected)} tone="text-[var(--success-text)]" />
              <SubLine label="From students still enrolled" value={formatCurrency(totals.collectedActive)} />
              <SubLine label="From students who left" value={formatCurrency(totals.collectedTerminated)} />
            </Group>

            <Group>
              <Line label="Pending due" value={formatCurrency(totals.pending)} tone="text-[var(--danger-text)]" />
              <SubLine label={`Owed by ${students(totals.activeStudents)} still enrolled`} />
            </Group>

            {/* Void sits below the rule because it is not part of the same arithmetic. */}
            <div className="border-t border-[var(--border)] pt-7 flex flex-col gap-3">
              <Group>
                <Line label="Void" value={formatCurrency(totals.voidAmount)} tone="text-[var(--warning-text)]" />
                <SubLine label={`Left unpaid by ${students(totals.terminatedStudents)} who ended their course`} />
              </Group>

              <p className="text-xs leading-relaxed text-[var(--text-muted)] max-w-prose">
                What these students owed on the day they left. It is kept out of pending due
                because there is no way to collect it. Anything they do pay still counts as
                earning, so these two figures no longer move together.
              </p>

              <Group>
                <SubLine label="Never became due" value={formatCurrency(totals.neverDue)} />
                <SubLine label="Recovered since" value={formatCurrency(totals.recovered)} />
              </Group>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
