import { Check } from 'lucide-react';
import { ReactNode, useState } from 'react';
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
  sortLabel?: string;
  sortValue?: string;
  sortOptions?: SearchFilterOption[];
  onSortChange?: (value: string) => void;
  defaultSortValue?: string;
  className?: string;
}

//search filter
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
  sortLabel,
  sortValue,
  sortOptions,
  onSortChange,
  defaultSortValue,
  className,
}: SearchFilterBarProps) {
  const [open, setOpen] = useState(false);

  const hasSort = Boolean(sortOptions?.length && onSortChange);
  const hasFilter = filterOptions.length > 0;
  const sortChanged = hasSort && sortValue !== defaultSortValue;

  const group = (heading: string, body: ReactNode) =>
    hasSort && hasFilter ? (
      <div className="searchbar-panel-group">
        <p className="searchbar-panel-heading">{heading}</p>
        {body}
      </div>
    ) : (
      body
    );

  return (
    <SearchBar
      className={className}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={label}
      filter={hasFilter || hasSort ? {
        open,
        onOpenChange: setOpen,
        active: filterValue !== null || sortChanged,
        label: hasSort ? `${sortLabel ?? 'Sort'} and ${filterLabel.toLowerCase()}` : filterLabel,
        panel: (
          <div className="searchbar-panel-scroll">
            {hasSort && group(sortLabel ?? 'Sort', (
              <div role="listbox" aria-label={sortLabel ?? 'Sort'}>
                {sortOptions!.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={sortValue === option.value}
                    onClick={() => { onSortChange!(option.value); setOpen(false); }}
                    className="searchbar-option"
                  >
                    <span>{option.label}</span>
                    {sortValue === option.value && <Check size={16} className="text-[var(--primary)]" />}
                  </button>
                ))}
              </div>
            ))}

            {hasFilter && group(filterLabel, (
              <div role="listbox" aria-label={filterLabel}>
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
            ))}
          </div>
        ),
      } : undefined}
    />
  );
}
