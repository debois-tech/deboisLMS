import type { ReactNode } from 'react';

// Same box as .select-trigger, so a "nothing to pick yet" placeholder matches the real dropdown.
export function FieldNotice({ children }: { children: ReactNode }) {
  return (
    <div className="select-trigger max-w-md" style={{ color: 'var(--text-muted)', cursor: 'default' }}>
      {children}
    </div>
  );
}
