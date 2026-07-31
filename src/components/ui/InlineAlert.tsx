import { ReactNode } from 'react';

interface InlineAlertProps {
  children: ReactNode;
}

export function InlineAlert({ children }: InlineAlertProps) {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-red-500/20 bg-red-500/10 text-sm text-red-400"
      style={{ padding: '0.75rem 1rem' }}
    >
      {children}
    </div>
  );
}
