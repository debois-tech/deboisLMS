import { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

const base =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-[var(--radius-md)] transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-base)] disabled:opacity-50 disabled:cursor-not-allowed select-none';

const variants = {
  primary:
    'bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white shadow-[0_0_20px_rgba(79,70,229,0.35)] hover:shadow-[0_0_28px_rgba(99,102,241,0.5)] active:scale-[0.98]',
  secondary:
    'bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] text-[var(--text-primary)] border border-[var(--border)] hover:border-[var(--border-strong)] active:scale-[0.98]',
  danger:
    'bg-[var(--danger)] hover:bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.3)] hover:shadow-[0_0_24px_rgba(239,68,68,0.45)] active:scale-[0.98]',
  ghost:
    'bg-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-[0.98]',
  outline:
    'bg-transparent border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white active:scale-[0.98]',
};

const sizes = {
  sm: 'min-h-11 px-6 py-3 text-xs',
  md: 'min-h-12 px-7 py-3.5 text-sm',
  lg: 'min-h-12 px-7 py-3 text-base',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={clsx(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}
