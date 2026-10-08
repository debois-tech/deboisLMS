import { Badge } from '@/components/ui/Badge';
import type { AttendanceStatus, BatchStatus, FeeStatus, FeedbackStatus, MappingStatus, QuizStatus } from '@/lib/types';

type Tone = 'default' | 'success' | 'warning' | 'danger' | 'info';

/** Every admin status pill, so one status never shows two colours. Pass the domain value. */
const batch: Record<BatchStatus, [string, Tone]> = {
  upcoming: ['Upcoming', 'info'],
  ongoing: ['Ongoing', 'success'],
  completed: ['Completed', 'default'],
};

const enrollment: Record<MappingStatus, [string, Tone]> = {
  active: ['Active', 'success'],
  archived: ['Archived', 'default'],
  terminated: ['Terminated', 'danger'],
  transferred: ['Transferred', 'default'],
};

const fee: Record<FeeStatus, [string, Tone]> = {
  paid: ['Paid', 'success'],
  due: ['Due', 'warning'],
  terminated: ['Terminated', 'danger'],
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
  | { kind: 'attendance'; value: AttendanceStatus }
  | { kind: 'feedback'; value: FeedbackStatus }
  | { kind: 'quiz'; value: QuizStatus };

const feedback: Record<FeedbackStatus, [string, Tone]> = {
  open: ['Open', 'warning'],
  resolved: ['Resolved', 'success'],
};

const quiz: Record<QuizStatus, [string, Tone]> = {
  draft: ['Draft', 'default'],
  lobby: ['Lobby', 'info'],
  live: ['Live', 'success'],
  ended: ['Ended', 'default'],
};

const maps = { batch, enrollment, fee, attendance, feedback, quiz };

export function StatusPill(props: StatusProps) {
  const [label, tone] = (maps[props.kind] as Record<string, [string, Tone]>)[props.value];
  return <Badge variant={tone} dot>{label}</Badge>;
}
