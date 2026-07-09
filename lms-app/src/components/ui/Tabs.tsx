'use client';

import { useState, ReactNode } from 'react';
import { clsx } from 'clsx';

interface Tab { label: string; value: string; badge?: number }

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  children?: (active: string) => ReactNode;
}

export function Tabs({ tabs, defaultValue, onChange, children }: TabsProps) {
  const [active, setActive] = useState(defaultValue ?? tabs[0]?.value);

  const handleChange = (val: string) => {
    setActive(val);
    onChange?.(val);
  };

  return (
    <div>
      <div className="flex items-center gap-1 p-1 bg-[var(--bg-elevated)] rounded-[12px] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleChange(tab.value)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-[9px] text-sm font-medium transition-all duration-200',
              active === tab.value
                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className={clsx(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
                active === tab.value
                  ? 'bg-[var(--primary)] text-white'
                  : 'bg-[var(--bg-overlay)] text-[var(--text-muted)]'
              )}>
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
      {children && <div className="mt-5">{children(active)}</div>}
    </div>
  );
}
