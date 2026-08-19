import { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';

/** A label and a number on one line. Given `onClick` it becomes a real button. */
interface StatCardProps {
  label: string;
  value: ReactNode;
  /** Tone for the value, e.g. `text-[var(--success-text)]`. */
  valueClassName?: string;
  onClick?: () => void;
  /** Names the action for screen readers, which the label alone does not. */
  actionLabel?: string;
}

export function StatCard({ label, value, valueClassName, onClick, actionLabel }: StatCardProps) {
  const body = (
    <>
      <p className="text-base font-semibold text-[var(--text-primary)] truncate">{label}</p>
      <p className={`text-lg font-bold truncate tabular-nums ${valueClassName ?? 'text-[var(--text-primary)]'}`}>{value}</p>
    </>
  );

  if (!onClick) {
    return <Card padding="sm" className="flex items-center justify-between">{body}</Card>;
  }

  return (
    <Card
      as="button"
      padding="sm"
      hover
      onClick={onClick}
      aria-label={actionLabel ?? label}
      className="flex w-full items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
    >
      {body}
    </Card>
  );
}
