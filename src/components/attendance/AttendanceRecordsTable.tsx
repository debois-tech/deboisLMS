import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import { SearchFilterBar } from '@/components/ui/SearchFilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import type { AttendanceRecord, AttendanceStatus } from '@/lib/types';

interface AttendanceRecordsTableProps {
  records: AttendanceRecord[];
  maxHeight?: string;
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'partial', label: 'Partial' },
  { value: 'absent', label: 'Absent' },
  { value: 'no_appli', label: 'N/A' },
  { value: 'no_mark', label: 'Not marked' },
];

export function AttendanceRecordsTable({ records, maxHeight = '24rem' }: AttendanceRecordsTableProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<AttendanceStatus | null>(null);

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
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
