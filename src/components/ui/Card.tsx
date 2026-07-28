import { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
  children: ReactNode;
}

export function Card({ glass, hover, children, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'rounded-[14px] border border-[var(--border)] p-5',
        glass
          ? 'glass'
          : 'bg-[var(--bg-surface)] shadow-[var(--shadow-sm)]',
        hover &&
          'transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-md)] hover:translate-y-[-2px] cursor-pointer',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps { title: string; subtitle?: string; action?: ReactNode }
export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
