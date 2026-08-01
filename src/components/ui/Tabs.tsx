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
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto -mx-1 px-1">
        <div className="batch-tabs-bar flex items-center gap-2 border border-[var(--border)] bg-[var(--bg-surface)] rounded-[var(--radius-md)] shadow-[var(--shadow-sm)] w-max min-w-full sm:min-w-0 sm:w-fit">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleChange(tab.value)}
              className={clsx(
                'batch-tab-button flex items-center gap-2 rounded-[var(--radius-sm)] text-sm font-semibold whitespace-nowrap transition-all duration-200',
                active === tab.value
                  ? 'bg-[var(--primary)] text-white shadow-[var(--primary-glow-soft)]'
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
      </div>
      {children && <div className="scroll-mt-24">{children(active)}</div>}
    </div>
  );
}
