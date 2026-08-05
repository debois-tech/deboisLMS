import { clsx } from 'clsx';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

// Label colours come from the `*-text` tokens, tuned per theme for contrast.
const variants: Record<BadgeVariant, string> = {
  default:  'bg-[var(--bg-overlay)] text-[var(--text-secondary)] border border-[var(--border)]',
  success:  'bg-emerald-500/15 text-[var(--success-text)] border border-emerald-500/25',
  warning:  'bg-amber-500/15   text-[var(--warning-text)] border border-amber-500/25',
  danger:   'bg-red-500/15     text-[var(--danger-text)]  border border-red-500/25',
  info:     'bg-blue-500/15    text-[var(--info-text)]    border border-blue-500/25',
  purple:   'bg-purple-500/15  text-[var(--purple-text)]  border border-purple-500/25',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-[var(--text-muted)]',
  success: 'bg-[var(--success-text)]',
  warning: 'bg-[var(--warning-text)]',
  danger:  'bg-[var(--danger-text)]',
  info:    'bg-[var(--info-text)]',
  purple:  'bg-[var(--purple-text)]',
};

export function Badge({ children, variant = 'default', size = 'md', dot }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2.5 py-1 text-[11px]' : size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant]
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
