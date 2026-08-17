interface FilterTab<T extends string> {
  value: T;
  label: string;
  count: number;
}

interface FilterTabsProps<T extends string> {
  tabs: FilterTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

/** Segmented filter over one list — batches by status, students by enrolment. */
export function FilterTabs<T extends string>({ tabs, value, onChange, label }: FilterTabsProps<T>) {
  return (
    <div className="filter-tabs" role="tablist" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          onClick={() => onChange(tab.value)}
          className={`filter-tab${tab.value === value ? ' is-active' : ''}`}
        >
          {tab.label}
          <span className="filter-tab-count">{tab.count}</span>
        </button>
      ))}
    </div>
  );
}
