import { Check } from 'lucide-react';
import { useState } from 'react';
import { SearchBar } from '@/components/ui/SearchBar';

export interface SearchFilterOption {
  value: string;
  label: string;
}

interface SearchFilterBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
  filterLabel: string;
  allLabel: string;
  filterValue: string | null;
  filterOptions: SearchFilterOption[];
  onFilterChange: (value: string | null) => void;
  className?: string;
}

/** Search field with the shared optional filter toggle and option panel. */
export function SearchFilterBar({
  value,
  onChange,
  placeholder,
  label,
  filterLabel,
  allLabel,
  filterValue,
  filterOptions,
  onFilterChange,
  className,
}: SearchFilterBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <SearchBar
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={label}
      filter={filterOptions.length > 0 ? {
        open,
        onOpenChange: setOpen,
        active: filterValue !== null,
        label: filterLabel,
        panel: (
          <div className="searchbar-panel-scroll" role="listbox">
            <button
              type="button"
              role="option"
              aria-selected={filterValue === null}
              onClick={() => { onFilterChange(null); setOpen(false); }}
              className="searchbar-option"
            >
              <span>{allLabel}</span>
              {filterValue === null && <Check size={16} className="text-[var(--primary)]" />}
            </button>
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={filterValue === option.value}
                onClick={() => { onFilterChange(option.value); setOpen(false); }}
                className="searchbar-option"
              >
                <span>{option.label}</span>
                {filterValue === option.value && <Check size={16} className="text-[var(--primary)]" />}
              </button>
            ))}
          </div>
        ),
      } : undefined}
    />
  );
}
