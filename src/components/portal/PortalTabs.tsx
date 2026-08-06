import { clsx } from 'clsx';

export interface PortalTab<T extends string> {
  value: T;
  label: string;
  /** Always shown, zero included — an empty Missed bucket is information. */
  count: number;
}

interface PortalTabsProps<T extends string> {
  tabs: PortalTab<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for screen readers, e.g. "Filter assignments". */
  label: string;
}

/** The in-page switch between a portal list's sections. Arrow keys move between tabs. */
export function PortalTabs<T extends string>({ tabs, value, onChange, label }: PortalTabsProps<T>) {
  const handleKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.value);
  };

  return (
    <div className="portal-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          tabIndex={tab.value === value ? 0 : -1}
          onClick={() => onChange(tab.value)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={clsx('portal-tab', tab.value === value && 'is-active')}
        >
          {tab.label}
          <span className="portal-tab-count">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
