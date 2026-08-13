import { Badge } from '@/components/ui/Badge';
import type { AttendanceStatus, BatchStatus, FeeStatus, MappingStatus } from '@/lib/types';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

/**
 * Every admin-side status pill, so one status never shows two colours.
 * Pass the domain value — never a label or a variant.
 */
const batch: Record<BatchStatus, [string, Tone]> = {
  upcoming: ['Upcoming', 'info'],
  ongoing: ['Ongoing', 'success'],
  completed: ['Completed', 'default'],
};

const enrollment: Record<MappingStatus, [string, Tone]> = {
  active: ['Active', 'success'],
  dropped: ['Dropped', 'danger'],
};

const fee: Record<FeeStatus, [string, Tone]> = {
  paid: ['Paid', 'success'],
  due: ['Due', 'warning'],
};

const attendance: Record<AttendanceStatus, [string, Tone]> = {
  present: ['Present', 'success'],
  partial: ['Partial', 'warning'],
  absent: ['Absent', 'danger'],
};

type StatusProps =
  | { kind: 'batch'; value: BatchStatus }
  | { kind: 'enrollment'; value: MappingStatus }
  | { kind: 'fee'; value: FeeStatus }
  | { kind: 'attendance'; value: AttendanceStatus };

const maps = { batch, enrollment, fee, attendance };

export function StatusPill(props: StatusProps) {
  const [label, tone] = (maps[props.kind] as Record<string, [string, Tone]>)[props.value];
  return <Badge variant={tone} dot>{label}</Badge>;
}
