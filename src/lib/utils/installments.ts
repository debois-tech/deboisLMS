import { addDays, fromDateValue, toDateValue } from '@/lib/utils/date';
import { formatCurrency } from '@/lib/utils/format';

/** Days from the batch start. The third is the catch-up, 10 days behind the second. */
const MILESTONE_DAYS = [15, 30, 40];
const WINDOW_DAYS = 3;
/** The student is never shown an instalment numbered past this. */
const MAX_LABELLED = 2;

/** Matches the note written by log_registration_fee() in schema.sql. */
export const REGISTRATION_NOTE = 'Registration fee';

export interface InstallmentDue {
  index: number;
  dueDate: string;
  /** Negative once the date has passed. */
  daysLeft: number;
  missed: boolean;
  /** The 40-day catch-up. Real, but never given a number in front of the student. */
  unofficial: boolean;
}

/**
 * Which milestone is next, or null when there is nothing to chase yet.
 *
 * `paidThrough` comes from the student_fee_dues view — 0, 1 or 2 — because it is
 * decided by amount, and the amounts themselves never reach the browser. Counting
 * payment logs instead used to call two instalments settled after any three
 * payments, however small, and the reminder vanished with the balance still owed.
 */
export function dueInstallment(
  startDate: string | null | undefined,
  paidThrough: number,
  outstanding: number,
  now: number,
): InstallmentDue | null {
  const start = startDate ? fromDateValue(startDate.slice(0, 10)) : null;
  const index = paidThrough + 1;
  if (!start || outstanding <= 0 || index > MILESTONE_DAYS.length) return null;

  const due = addDays(start, MILESTONE_DAYS[index - 1]);
  const today = fromDateValue(toDateValue(new Date(now)));
  if (!today) return null;

  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft > WINDOW_DAYS) return null;

  return { index, dueDate: toDateValue(due), daysLeft, missed: daysLeft < 0, unofficial: index > MAX_LABELLED };
}

/**
 * Whether the balance is late rather than merely unpaid. On schedule it is not
 * bad news and must not be coloured like it — red is earned by a date that went
 * past unpaid, or by money still owed once both instalments are behind them.
 */
export function behindOnFees(
  startDate: string | null | undefined,
  paidThrough: number,
  outstanding: number,
  now: number,
): boolean {
  if (outstanding <= 0) return false;
  if (paidThrough >= MAX_LABELLED) return true;

  const start = startDate ? fromDateValue(startDate.slice(0, 10)) : null;
  const today = start ? fromDateValue(toDateValue(new Date(now))) : null;
  if (!start || !today) return false;

  const passed = MILESTONE_DAYS.filter((days) => addDays(start, days).getTime() <= today.getTime()).length;
  return paidThrough < passed;
}

export function installmentLabel({ daysLeft, missed, unofficial }: InstallmentDue): string {
  const what = unofficial ? 'Payment' : 'Installment';
  if (missed) return unofficial ? 'Payment overdue' : 'Installment missed';
  if (daysLeft === 0) return `${what} due today`;
  return `${what} due in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
}

/** The line under the title. The catch-up names the sum instead of a number that does not exist. */
export function installmentDetail(due: InstallmentDue, outstanding: number, dueDate: string): string {
  return due.unofficial
    ? `${formatCurrency(outstanding)} remaining`
    : `Installment ${due.index} · due ${dueDate}`;
}
