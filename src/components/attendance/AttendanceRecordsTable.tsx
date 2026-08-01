import { Badge } from '@/components/ui/Badge';
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/Table';
import type { AttendanceRecord } from '@/lib/types';

interface AttendanceRecordsTableProps {
  records: AttendanceRecord[];
  onToggleApproved: (id: string, approved: boolean) => void;
  maxHeight?: string;
}

function statusVariant(status: AttendanceRecord['status']) {
  if (status === 'present') return 'success' as const;
  if (status === 'partial') return 'warning' as const;
  return 'danger' as const;
}

export function AttendanceRecordsTable({ records, onToggleApproved, maxHeight = '24rem' }: AttendanceRecordsTableProps) {
  return (
    <Table maxHeight={maxHeight}>
      <THead>
        <TR>
          <TH>Student</TH>
          <TH>Status</TH>
          <TH>Minutes</TH>
          <TH>Source</TH>
          <TH align="center">Approved</TH>
        </TR>
      </THead>
      <TBody>
        {records.map((r) => (
          <TR key={r.id}>
            <TD>
              <p className="font-medium text-[var(--text-primary)]">{r.student?.name ?? 'Unknown student'}</p>
              {(r.student?.email || r.student?.phone) && (
                <p className="cell-muted mt-0.5 text-xs">{r.student.email ?? r.student.phone}</p>
              )}
            </TD>
            <TD>
              <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
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
  );
}
