import { addDays, fromDateValue, toDateValue } from '@/lib/utils/date';

const GAP_DAYS = 20;
const WINDOW_DAYS = 3;
const MAX_INSTALLMENTS = 2;

/** Matches the note written by log_registration_fee() in schema.sql. */
export const REGISTRATION_NOTE = 'Registration fee';

export interface InstallmentDue {
  index: number;
  dueDate: string;
  /** Negative once the date has passed. */
  daysLeft: number;
  missed: boolean;
}

/** Payments that count towards an instalment — the registration fee is not one. */
export function countInstallmentPayments(
  logs: { batch_id: string; notes?: string }[],
  batchId: string,
): number {
  return logs.filter((log) => log.batch_id === batchId && log.notes !== REGISTRATION_NOTE).length;
}

/**
 * Instalments fall 20 and 40 days after the batch starts, two at most.
 * Returns a value only inside the 3-day window before one, or once it is missed.
 */
export function dueInstallment(
  startDate: string | null | undefined,
  paidCount: number,
  outstanding: number,
  now: number,
): InstallmentDue | null {
  const start = startDate ? fromDateValue(startDate.slice(0, 10)) : null;
  const index = paidCount + 1;
  if (!start || outstanding <= 0 || index > MAX_INSTALLMENTS) return null;

  const due = addDays(start, GAP_DAYS * index);
  const today = fromDateValue(toDateValue(new Date(now)));
  if (!today) return null;

  const daysLeft = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (daysLeft > WINDOW_DAYS) return null;

  return { index, dueDate: toDateValue(due), daysLeft, missed: daysLeft < 0 };
}

export function installmentLabel({ daysLeft, missed }: InstallmentDue): string {
  if (missed) return 'Installment missed';
  if (daysLeft === 0) return 'Installment due today';
  return `Installment due in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`;
}
