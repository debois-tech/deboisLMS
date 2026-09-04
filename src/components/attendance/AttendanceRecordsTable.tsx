import { useMemo, useState } from 'react';
import { CheckCircle, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { StatusPill } from '@/components/ui/StatusPill';
import { Button } from '@/components/ui/Button';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types';

interface AttendanceRecordsTableProps {
  records: AttendanceRecord[];
  onToggleApproved: (id: string, approved: boolean) => void;
  /** Renders the Approve All toolbar above the table, only while rows await approval. */
  onApproveAll?: () => void;
  maxHeight?: string;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'partial', label: 'Partial' },
  { value: 'absent', label: 'Absent' },
];

export function AttendanceRecordsTable({
  records,
  onToggleApproved,
  onApproveAll,
  maxHeight = '24rem',
}: AttendanceRecordsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | null>(null);

  const pending = records.filter((r) => !r.approved).length;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${r.student?.name ?? ''} ${r.student?.email ?? ''} ${r.student?.phone ?? ''}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [records, search, statusFilter]);

  return (
    <div className="table-block">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchFilterBar
          className="max-w-sm"
          value={search}
          onChange={setSearch}
          placeholder="Search by student name, email or phone"
          filterLabel="Status"
          allLabel="All statuses"
          filterValue={statusFilter}
          filterOptions={STATUS_OPTIONS}
          onFilterChange={(value) => setStatusFilter(value as AttendanceStatus | null)}
        />

        {onApproveAll && pending > 0 && (
          <div className="table-toolbar">
            <Badge variant="warning">{pending} awaiting approval</Badge>
            <Button className="action-button-compact" onClick={onApproveAll}>
              <CheckCircle size={14} /> Approve All
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search size={32} />} title="No matching records" />
      ) : (
        <Table maxHeight={maxHeight}>
          <THead>
            <TR>
              <TH align="center" className="w-12">#</TH>
              <TH>Student</TH>
              <TH>Status</TH>
              <TH>Minutes</TH>
              <TH>Source</TH>
              <TH align="center">Approved</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((r, index) => (
              <TR key={r.id}>
                <TD align="center" className="cell-muted">{index + 1}</TD>
                <TD>
                  <p className="font-medium text-[var(--text-primary)]">{r.student?.name ?? 'Unknown student'}</p>
                  {(r.student?.email || r.student?.phone) && (
                    <p className="cell-muted mt-0.5 text-xs">{r.student.email ?? r.student.phone}</p>
                  )}
                </TD>
                <TD>
                  <StatusPill kind="attendance" value={r.status} />
                </TD>
                <TD className="cell-secondary">
                  {r.total_attended_minutes != null ? `${r.total_attended_minutes} min` : '—'}
                </TD>
                <TD className="cell-muted capitalize">{r.source}</TD>
                <TD align="center">
                  <input
                    type="checkbox"
                    className="data-table-checkbox"
                    checked={r.approved}
                    onChange={(e) => onToggleApproved(r.id, e.target.checked)}
                    title={r.approved ? 'Unapprove' : 'Approve'}
                    aria-label={r.approved ? `Unapprove ${r.student?.name ?? 'student'}` : `Approve ${r.student?.name ?? 'student'}`}
                  />
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
