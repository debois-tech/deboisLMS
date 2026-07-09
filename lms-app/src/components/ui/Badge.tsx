'use client';

import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
}

const variants: Record<BadgeVariant, string> = {
  default:  'bg-[var(--bg-overlay)] text-[var(--text-secondary)] border border-[var(--border)]',
  success:  'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  warning:  'bg-amber-500/15  text-amber-400  border border-amber-500/25',
  danger:   'bg-red-500/15    text-red-400    border border-red-500/25',
  info:     'bg-blue-500/15   text-blue-400   border border-blue-500/25',
  purple:   'bg-purple-500/15 text-purple-400 border border-purple-500/25',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--text-muted)]',
  success: 'bg-emerald-400',
  warning: 'bg-amber-400',
  danger:  'bg-red-400',
  info:    'bg-blue-400',
  purple:  'bg-purple-400',
};

export function Badge({ children, variant = 'default', size = 'sm', dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        variants[variant]
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
