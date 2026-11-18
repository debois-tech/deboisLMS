import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
  /** Marks this heading as the login intro's landing point. */
  intro?: boolean;
}

export function PageHeader({ title, subtitle, action, intro }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1
          className="text-xl font-bold text-[var(--text-primary)] tracking-tight"
          data-intro-target={intro ? '' : undefined}
        >
          {title}
        </h1>
        {subtitle && <p className="text-sm text-[var(--text-muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
