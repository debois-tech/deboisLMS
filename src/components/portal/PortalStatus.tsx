import { Badge } from '@/components/ui/Badge';
import type { AttendanceStatus, BatchStatus, FeeStatus, FeedbackStatus, MappingStatus } from '@/lib/types';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

/** The only place schema values become student wording. */
const attendance: Record<AttendanceStatus, [string, Tone]> = {
  present: ['Attended', 'success'],
  partial: ['Partly attended', 'warning'],
  absent: ['Missed', 'danger'],
};

const fee: Record<FeeStatus, [string, Tone]> = {
  paid: ['Paid', 'success'],
  due: ['Payment pending', 'warning'],
};

const enrollment: Record<MappingStatus, [string, Tone]> = {
  active: ['Ongoing', 'success'],
  dropped: ['Finished', 'default'],
  terminated: ['Ended', 'default'],
};

// A batch a student is on but that has not started yet is not "Ongoing" to them.
const batch: Record<BatchStatus, [string, Tone]> = {
  upcoming: ['Starting soon', 'info'],
  ongoing: ['Ongoing', 'success'],
  completed: ['Finished', 'default'],
};

type SubmissionValue = 'submitted' | 'pending' | 'missed';

const submission: Record<SubmissionValue, [string, Tone]> = {
  submitted: ['Submitted', 'success'],
  pending: ['To do', 'warning'],
  missed: ['Missed', 'danger'],
};

type StatusProps =
  | { kind: 'attendance'; value: AttendanceStatus }
  | { kind: 'fee'; value: FeeStatus }
  | { kind: 'enrollment'; value: MappingStatus }
  | { kind: 'batch'; value: BatchStatus }
  | { kind: 'submission'; value: SubmissionValue }
  | { kind: 'feedback'; value: FeedbackStatus };

const feedback: Record<FeedbackStatus, [string, Tone]> = {
  open: ['Open', 'warning'],
  resolved: ['Resolved', 'success'],
};

const maps = { attendance, fee, enrollment, batch, submission, feedback };

/** The one pill used across the portal. Pass the domain value, not a label or colour. */
export function PortalStatus(props: StatusProps) {
  const [label, tone] = (maps[props.kind] as Record<string, [string, Tone]>)[props.value];
  return <Badge variant={tone} dot>{label}</Badge>;
}

/** The same wording without the pill, for places that need plain text. */
export function statusLabel(props: StatusProps): string {
  return (maps[props.kind] as Record<string, [string, Tone]>)[props.value][0];
}
