import { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

const paddingMap = {
  sm: 'ui-card-padding-sm',
  md: 'ui-card-padding-md',
  lg: 'ui-card-padding-lg',
};

export function Card({ glass, hover, padding = 'md', children, className, ...rest }: CardProps) {
  return (
    <div
      className={clsx(
        'ui-card rounded-[var(--radius-lg)] border border-[var(--border)]',
        paddingMap[padding],
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

interface CardHeaderProps { title: string; subtitle?: string; action?: ReactNode; className?: string }
export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${className ?? ''}`}>
      <div className="min-w-0">
        <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
