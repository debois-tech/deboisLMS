import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { SearchSelect } from '@/components/ui/SearchSelect';
import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { formatCurrency } from '@/lib/utils/format';
import type { EarningBreakdown } from '@/lib/types';

const ALL = 'all';

interface EarningBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  breakdown: EarningBreakdown[];
}

// Label over figure — same pairing the overview row uses.
function Figure({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${tone}`}>{formatCurrency(value)}</p>
    </div>
  );
}

export function EarningBreakdownModal({ open, onClose, breakdown }: EarningBreakdownModalProps) {
  const [batchId, setBatchId] = useState<string>(ALL);

  // Aggregate whichever rows the filter selects.
  const { totals, rows } = useMemo(() => {
    const filtered = batchId === ALL ? breakdown : breakdown.filter((r) => r.batch_id === batchId);
    const sum = (pick: (r: EarningBreakdown) => number) =>
      filtered.reduce((acc, r) => acc + Number(pick(r) ?? 0), 0);

    return {
      rows: filtered,
      totals: {
        activeStudents:        sum((r) => r.active_students),
        terminatedStudents:    sum((r) => r.terminated_students),
        collected:             sum((r) => r.collected),
        collectedActive:       sum((r) => r.collected_active),
        collectedTerminated:   sum((r) => r.collected_terminated),
        pending:               sum((r) => r.pending),
        voidAmount:            sum((r) => r.void_amount),
        neverDue:              sum((r) => r.never_due),
        recovered:             sum((r) => r.recovered),
      },
    };
  }, [breakdown, batchId]);

  return (
    <Modal open={open} onClose={onClose} title="Earning breakdown" size="xl">
      {breakdown.length === 0 ? (
        <p className="text-sm text-[var(--text-muted)]">No batches yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {/* ── 1. Batch filter ──────────────────────────────── */}
          <SearchSelect
            options={[
              { value: ALL, label: 'All batches' },
              ...breakdown.map((r) => ({ value: r.batch_id, label: r.batch_name })),
            ]}
            value={batchId}
            onChange={setBatchId}
            placeholder="All batches"
            searchPlaceholder="Search batches"
            emptyText="No batches found"
            className="max-w-xs"
          />

          {/* ── 2. Overview figures ──────────────────────────── */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <Figure label="Collected"   value={totals.collected}  tone="text-[var(--success-text)]" />
            <Figure label="Pending due" value={totals.pending}    tone="text-[var(--danger-text)]" />
            <Figure label="Void"        value={totals.voidAmount} tone="text-[var(--warning-text)]" />
          </div>

          {/* ── 3. Student split ─────────────────────────────── */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="success" dot>{totals.activeStudents} active</Badge>
            <Badge variant="warning" dot>{totals.terminatedStudents} terminated</Badge>
            {totals.recovered > 0 && (
              <Badge variant="info" dot>{formatCurrency(totals.recovered)} recovered post-exit</Badge>
            )}
          </div>

          <hr className="divider m-0" />

          {/* ── 4. Detailed breakdown table ──────────────────── */}
          <Table maxHeight="18rem">
            <THead>
              <TR>
                <TH>Batch</TH>
                <TH align="right">Active coll.</TH>
                <TH align="right">Term. coll.</TH>
                <TH align="right">Pending</TH>
                <TH align="right">Void</TH>
                <TH align="right">Never due</TH>
                <TH align="right">Recovered</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((r) => (
                <TR key={r.batch_id}>
                  <TD className="font-medium text-[var(--text-primary)]">{r.batch_name}</TD>
                  <TD align="right" className="tabular-nums text-[var(--success-text)]">{formatCurrency(r.collected_active)}</TD>
                  <TD align="right" className="tabular-nums text-[var(--success-text)]">{formatCurrency(r.collected_terminated)}</TD>
                  <TD align="right" className="tabular-nums text-[var(--danger-text)]">{formatCurrency(r.pending)}</TD>
                  <TD align="right" className="tabular-nums text-[var(--warning-text)]">{formatCurrency(r.void_amount)}</TD>
                  <TD align="right" className="tabular-nums cell-muted">{formatCurrency(r.never_due)}</TD>
                  <TD align="right" className="tabular-nums text-[var(--info-text)]">{formatCurrency(r.recovered)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </Modal>
  );
}
