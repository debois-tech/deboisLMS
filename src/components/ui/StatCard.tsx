import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  valueClassName?: string;
}

export function StatCard({ label, value, icon: Icon, color, valueClassName }: StatCardProps) {
  return (
    <Card padding="sm" className="flex items-center justify-between">
      <p className="text-base font-semibold text-[var(--text-primary)] truncate">{label}</p>
      <p className={`text-lg font-bold truncate ${valueClassName ?? 'text-[var(--text-primary)]'}`}>{value}</p>
    </Card>
  );
}
