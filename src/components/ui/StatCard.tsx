import { Card } from '@/components/ui/Card';

/**
 * A label and a number on one line. It used to also take `icon` and `color`,
 * which every caller passed and the component never rendered — the props are
 * gone rather than left as a promise the card does not keep.
 */
interface StatCardProps {
  label: string;
  value: string | number;
  /** Tone for the value, e.g. `text-[var(--success-text)]`. */
  valueClassName?: string;
}

export function StatCard({ label, value, valueClassName }: StatCardProps) {
  return (
    <Card padding="sm" className="flex items-center justify-between">
      <p className="text-base font-semibold text-[var(--text-primary)] truncate">{label}</p>
      <p className={`text-lg font-bold truncate ${valueClassName ?? 'text-[var(--text-primary)]'}`}>{value}</p>
    </Card>
  );
}
