import { ReactNode, useEffect, useRef } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';

export type SearchBarSize = 'sm' | 'md' | 'lg';

/** Icon scales with the field so the two never drift apart again. */
const iconSize: Record<SearchBarSize, number> = { sm: 14, md: 16, lg: 18 };

interface SearchBarFilter {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Renders the toggle as engaged — a filter is currently narrowing the results. */
  active?: boolean;
  label?: string;
  /** Dropdown contents. The bar owns the panel's position, outside-click and Escape. */
  panel: ReactNode;
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: SearchBarSize;
  autoFocus?: boolean;
  /** Accessible name. Falls back to the placeholder. */
  label?: string;
  className?: string;
  /** Omit entirely on surfaces that have nothing to filter by. */
  filter?: SearchBarFilter;
}

/**
 * The one search field in the app. Every surface that searches uses this, at one
 * of three sizes, so icon size, height, padding and focus treatment stay in step.
 * The filter toggle is opt-in — pages without a filter get a plain field.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
  size = 'md',
  autoFocus,
  label,
  className,
  filter,
}: SearchBarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dismissal lives here rather than in each caller, which is where the previous
  // copies drifted: one page handled outside-click, none handled Escape.
  const filterOpen = filter?.open ?? false;
  const onOpenChange = filter?.onOpenChange;

  useEffect(() => {
    if (!filterOpen || !onOpenChange) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen, onOpenChange]);

  const clear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div ref={rootRef} className={clsx('searchbar', `searchbar-${size}`, className)}>
      <div className="searchbar-field">
        <Search size={iconSize[size]} className="searchbar-icon" />

        <input
          ref={inputRef}
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label ?? placeholder}
        />

        {value && (
          <button type="button" onClick={clear} aria-label="Clear search" className="searchbar-action">
            <X size={iconSize[size]} />
          </button>
        )}

        {filter && (
          <button
            type="button"
            onClick={() => filter.onOpenChange(!filter.open)}
            aria-label={filter.label ?? 'Filter'}
            aria-expanded={filter.open}
            className={clsx('searchbar-action', filter.active && 'is-active')}
          >
            <SlidersHorizontal size={iconSize[size]} />
          </button>
        )}
      </div>

      {filter?.open && <div className="searchbar-panel">{filter.panel}</div>}
    </div>
  );
}
