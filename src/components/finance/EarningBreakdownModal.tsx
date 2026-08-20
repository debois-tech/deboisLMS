import { ReactNode, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/utils/format';
import type { EarningBreakdown } from '@/lib/types';

const ALL = 'all';

interface EarningBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  breakdown: EarningBreakdown[];
}

/** Label over figure, the pairing the Fees page uses, without the card around it. */
function Figure({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tone}`}>{formatCurrency(value)}</p>
    </div>
  );
}

/** Zero is noise in a column you scan for the ones that are not. */
function Amount({ value, tone }: { value: number; tone?: string }) {
  if (!value) return <span className="cell-muted">—</span>;
  return <span className={`tabular-nums ${tone ?? ''}`}>{formatCurrency(value)}</span>;
}

function Count({ value }: { value: number }) {
  return value ? <span className="tabular-nums">{value}</span> : <span className="cell-muted">—</span>;
}

/** Two figures over the rows they summarise. The figures are the section's heading. */
function Section({ figures, children }: { figures: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">{figures}</div>
      {children}
    </div>
  );
}

export function EarningBreakdownModal({ open, onClose, breakdown }: EarningBreakdownModalProps) {
  const [batchId, setBatchId] = useState<string>(ALL);

  const rows = useMemo(
    () => (batchId === ALL ? breakdown : breakdown.filter((row) => row.batch_id === batchId)),
    [breakdown, batchId],
  );

  const totals = useMemo(() => {
    const sum = (pick: (row: EarningBreakdown) => number) =>
      rows.reduce((total, row) => total + Number(pick(row) ?? 0), 0);

    return {
      collected: sum((row) => row.collected),
      pending: sum((row) => row.pending),
      voidAmount: sum((row) => row.void_amount),
      recovered: sum((row) => row.recovered),
      left: sum((row) => row.terminated_students),
    };
  }, [rows]);

  return (
    <Modal open={open} onClose={onClose} title="Earning breakdown" size="lg">
      {breakdown.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No batches yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          <SearchSelect
            options={[
              { value: ALL, label: 'All batches' },
              ...breakdown.map((row) => ({ value: row.batch_id, label: row.batch_name })),
            ]}
            value={batchId}
            onChange={setBatchId}
            placeholder="All batches"
            searchPlaceholder="Search batches"
            emptyText="No batches found"
            className="max-w-xs"
          />

          {/* Students still enrolled. Colour only on pending — collected is not something you act on. */}
          <Section
            figures={
              <>
                <Figure label="Collected" value={totals.collected} tone="text-[var(--success-text)]" />
                <Figure label="Pending due" value={totals.pending} tone="text-[var(--danger-text)]" />
              </>
            }
          >
            <Table maxHeight="12rem">
              <THead>
                <TR>
                  <TH>Batch</TH>
                  <TH align="right">Students</TH>
                  <TH align="right">Collected</TH>
                  <TH align="right">Pending</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.batch_id}>
                    <TD className="font-medium">{row.batch_name}</TD>
                    <TD align="right"><Count value={Number(row.active_students)} /></TD>
                    <TD align="right"><Amount value={Number(row.collected_active)} /></TD>
                    <TD align="right"><Amount value={Number(row.pending)} tone="text-[var(--danger-text)]" /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Section>

          <hr className="divider m-0" />

          {/* Students who left. Nothing here is chased, so it never sits beside pending. */}
          <Section
            figures={
              <>
                <Figure label="Void" value={totals.voidAmount} tone="text-[var(--warning-text)]" />
                <Figure label="Recovered" value={totals.recovered} tone="text-[var(--success-text)]" />
              </>
            }
          >
            {totals.left === 0 ? (
              <p className="text-sm text-[var(--text-muted)]">Nobody has left yet.</p>
            ) : (
              <Table maxHeight="12rem">
                <THead>
                  <TR>
                    <TH>Batch</TH>
                    <TH align="right">Left</TH>
                    <TH align="right">Collected</TH>
                    <TH align="right">Void</TH>
                    <TH align="right">Recovered</TH>
                  </TR>
                </THead>
                <TBody>
                  {rows.map((row) => (
                    <TR key={row.batch_id}>
                      <TD className="font-medium">{row.batch_name}</TD>
                      <TD align="right"><Count value={Number(row.terminated_students)} /></TD>
                      <TD align="right"><Amount value={Number(row.collected_terminated)} /></TD>
                      <TD align="right"><Amount value={Number(row.void_amount)} tone="text-[var(--warning-text)]" /></TD>
                      <TD align="right"><Amount value={Number(row.recovered)} tone="text-[var(--success-text)]" /></TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Section>
        </div>
      )}
    </Modal>
  );
}
