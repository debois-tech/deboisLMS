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
        // Padding comes from `.ui-badge*`, not from Tailwind — see globals.css.
        'ui-badge inline-flex items-center gap-2 rounded-full font-medium leading-4',
        size === 'sm' ? 'ui-badge-sm text-[11px]' : size === 'lg' ? 'ui-badge-lg text-sm' : 'text-xs',
        variants[variant]
      )}
    >
      {dot && <span className={clsx('w-2 h-2 shrink-0 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
}
