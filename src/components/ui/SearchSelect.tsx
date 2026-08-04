import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';

export interface SearchSelectOption {
  value: string;
  label: string;
  searchText?: string;
  icon?: ReactNode;
  meta?: ReactNode;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  renderOption?: (option: SearchSelectOption, selected: boolean) => ReactNode;
  className?: string;
  selectedValues?: string[];
  onToggle?: (value: string) => void;
  triggerLabel?: ReactNode;
}

/** Shared searchable dropdown used by admin and portal selectors. */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  renderOption,
  className = '',
  selectedValues,
  onToggle,
  triggerLabel,
}: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelPosition, setPanelPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const selected = options.find((option) => option.value === value);
  const multiple = Boolean(selectedValues && onToggle);
  const term = search.trim().toLowerCase();
  const filtered = options.filter((option) =>
    (option.searchText ?? `${option.label} ${option.meta ?? ''}`).toLowerCase().includes(term),
  );

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setPanelPosition(null);
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelPosition({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  const choose = (nextValue: string) => {
    if (multiple) {
      onToggle?.(nextValue);
      return;
    }
    onChange(nextValue);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative w-full max-w-md ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        onClick={() => setOpen((current) => !current)}
        className={`select-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? 'truncate' : 'truncate text-[var(--text-muted)]'}>
          {triggerLabel ?? selected?.label ?? placeholder}
        </span>
        <ChevronDown size={16} className="select-trigger-chevron" />
      </button>

      {open && panelPosition && createPortal(
        <div
          ref={panelRef}
          className="select-panel"
          style={{
            position: 'fixed',
            top: panelPosition.top,
            left: panelPosition.left,
            width: panelPosition.width,
            right: 'auto',
            zIndex: 70,
            marginTop: 0,
          }}
        >
          <div className="select-panel-head">
            <SearchBar size="sm" autoFocus value={search} onChange={setSearch} placeholder={searchPlaceholder} />
          </div>
          <div className="select-panel-scroll" role="listbox">
            {filtered.length === 0 ? (
              <p className="select-panel-empty">{emptyText}</p>
            ) : (
              filtered.map((option) => {
                const isSelected = multiple
                  ? selectedValues!.includes(option.value)
                  : value === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => choose(option.value)}
                    className="select-option"
                  >
                    {renderOption ? renderOption(option, isSelected) : (
                      <span className="truncate">{option.label}</span>
                    )}
                    {isSelected && <Check size={16} className="shrink-0 text-[var(--primary)]" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
