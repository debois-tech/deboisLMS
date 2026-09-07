import { HTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

interface CardProps extends HTMLAttributes<HTMLElement> {
  glass?: boolean;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
  /** `button` when the whole card is the control, so it keeps real keyboard behaviour. */
  as?: 'div' | 'button';
  children: ReactNode;
}

const paddingMap = {
  sm: 'ui-card-padding-sm',
  md: 'ui-card-padding-md',
  lg: 'ui-card-padding-lg',
};

export function Card({ glass, hover, padding = 'md', as: Tag = 'div', children, className, ...rest }: CardProps) {
  return (
    <Tag
      type={Tag === 'button' ? 'button' : undefined}
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
    </Tag>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  // Sits next to the title itself — a count badge, a search toggle. `action` stays pinned far right.
  titleAdornment?: ReactNode;
  className?: string;
}
export function CardHeader({ title, subtitle, action, titleAdornment, className }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-6 ${className ?? ''}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{title}</h3>
          {titleAdornment}
        </div>
        {subtitle && <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
