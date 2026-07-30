import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import type { Batch } from '@/lib/types';

interface BatchSelectProps {
  batches: Batch[];
  value: string | null;
  onChange: (batchId: string) => void;
}

export function BatchSelect({ batches, value, onChange }: BatchSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = batches.find((batch) => batch.id === value);
  const filtered = batches.filter((batch) => batch.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (batchId: string) => {
    onChange(batchId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] px-5 text-left text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
      >
        <span className={selected ? '' : 'text-[var(--text-muted)]'}>{selected?.name ?? 'Select a batch'}</span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--border)] p-2">
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]" style={{ paddingLeft: '1rem', paddingRight: '1rem' }}>
              <Search size={15} className="shrink-0 text-[var(--text-muted)]" />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search batches..."
                className="min-h-10 w-full border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                style={{ paddingLeft: '0.25rem', paddingRight: '0.25rem' }}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>No batches found</p>
            ) : (
              filtered.map((batch) => (
                <button
                  key={batch.id}
                  type="button"
                  role="option"
                  aria-selected={value === batch.id}
                  onClick={() => choose(batch.id)}
                  className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-md)] px-4 text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
                >
                  <span>{batch.name}</span>
                  {value === batch.id && <Check size={16} className="text-[var(--primary)]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
