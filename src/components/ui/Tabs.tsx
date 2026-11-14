import { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { clsx } from 'clsx';

interface Tab { label: string; value: string; badge?: number; soon?: boolean }

interface TabsProps {
  tabs: Tab[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  children?: (active: string) => ReactNode;
}

export function Tabs({ tabs, defaultValue, onChange, children }: TabsProps) {
  // The tab lives in the URL, so Back from a student or tutor lands on this section, not on Overview.
  const [params, setParams] = useSearchParams();
  const asked = params.get('tab');
  const active = tabs.some((tab) => tab.value === asked) ? asked! : defaultValue ?? tabs[0]?.value;

  const handleChange = (val: string) => {
    setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', val); return next; }, { replace: true });
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
              disabled={tab.soon}
              className={clsx(
                'batch-tab-button flex items-center gap-2 rounded-[var(--radius-sm)] text-sm font-semibold whitespace-nowrap transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60',
                active === tab.value
                  ? 'bg-[var(--primary)] text-white shadow-[var(--primary-glow-soft)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'
              )}
            >
              {tab.label}
              {tab.soon && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[var(--bg-overlay)] text-[var(--text-muted)]">Soon</span>}
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
