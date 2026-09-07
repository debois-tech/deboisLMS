import type { Assignment, AssignmentCompletion } from '@/lib/types';
import { formatTimeLabel } from '@/lib/utils/date';

export type AssignmentState = 'todo' | 'done' | 'late';

type WithCompletion = Pick<Assignment, 'due_at'> & { completion?: AssignmentCompletion };

export function isPastDue(dueAt: string | null | undefined, now: number): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt).getTime();
  return !Number.isNaN(due) && now > due;
}

// Late is decided once, from submitted_at vs due_at — not from the clock right now.
export function isLateSubmission(dueAt: string | null | undefined, submittedAt: string | null | undefined): boolean {
  if (!dueAt || !submittedAt) return false;
  const due = new Date(dueAt).getTime();
  const submitted = new Date(submittedAt).getTime();
  return !Number.isNaN(due) && !Number.isNaN(submitted) && submitted > due;
}

export function assignmentState(assignment: WithCompletion): AssignmentState {
  if (!assignment.completion?.submitted) return 'todo';
  return isLateSubmission(assignment.due_at, assignment.completion.submitted_at) ? 'late' : 'done';
}

// True once the deadline has passed and nothing has been handed in yet — still
// submittable, just worth flagging in the to-do list.
export function isOverdue(assignment: WithCompletion, now: number): boolean {
  return !assignment.completion?.submitted && isPastDue(assignment.due_at, now);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "6 Aug, 11:59 PM" — the deadline stated plainly. */
export function formatDeadline(dueAt: string): string {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return '';
  const day = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const time = formatTimeLabel(`${due.getHours()}:${String(due.getMinutes()).padStart(2, '0')}`);
  return `${day}, ${time}`;
}

/** Urgency first, date second: "Due in 3 hours" says what "Due 6 Aug" doesn't. */
export function formatDueLabel(dueAt: string | null | undefined, now: number): string {
  if (!dueAt) return 'No deadline';

  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return '';

  const stated = formatDeadline(dueAt);
  const left = due - now;

  if (left <= 0) {
    const late = now - due;
    if (late < HOUR) return `Overdue by ${Math.max(1, Math.floor(late / MINUTE))} min`;
    if (late < DAY) return `Overdue by ${Math.floor(late / HOUR)}h`;
    if (late < 7 * DAY) return `Overdue by ${Math.floor(late / DAY)}d`;
    return `Overdue since ${stated}`;
  }

  if (left < HOUR) return `Due in ${Math.max(1, Math.floor(left / MINUTE))} min`;
  if (left < 6 * HOUR) return `Due in ${Math.floor(left / HOUR)}h — ${stated}`;
  if (left < DAY) return `Due today, ${stated.split(', ')[1] ?? stated}`;
  if (left < 2 * DAY) return `Due tomorrow, ${stated.split(', ')[1] ?? stated}`;
  if (left < 7 * DAY) return `Due in ${Math.floor(left / DAY)} days — ${stated}`;
  return `Due ${stated}`;
}

/** True inside the last 24 hours, where the row earns a warning colour. */
export function isDueSoon(dueAt: string | null | undefined, now: number): boolean {
  if (!dueAt) return false;
  const left = new Date(dueAt).getTime() - now;
  return left > 0 && left < DAY;
}
