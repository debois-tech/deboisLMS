import { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, Check, ChevronDown, Search } from 'lucide-react';
import type { Assignment } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

interface AssignmentSelectProps {
  assignments: Assignment[];
  value: string | null;
  onChange: (assignmentId: string) => void;
}

export function AssignmentSelect({ assignments, value, onChange }: AssignmentSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = assignments.find((assignment) => assignment.id === value);
  const filtered = assignments.filter((assignment) =>
    `${assignment.title} ${assignment.assigned_date ?? ''}`.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (assignmentId: string) => {
    onChange(assignmentId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] text-left text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        style={{ paddingLeft: '1.25rem', paddingRight: '1.25rem' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={selected ? '' : 'text-[var(--text-muted)]'}>
          {selected
            ? `${selected.title}${selected.assigned_date ? ` (${formatDate(selected.assigned_date)})` : ''}`
            : 'Select an assignment'}
        </span>
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
                placeholder="Search assignments..."
                className="min-h-10 w-full border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                style={{ paddingLeft: '0.25rem', paddingRight: '0.25rem' }}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>No assignments found</p>
            ) : (
              filtered.map((assignment) => (
                <button
                  key={assignment.id}
                  type="button"
                  role="option"
                  aria-selected={value === assignment.id}
                  onClick={() => choose(assignment.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <ClipboardCheck size={15} className="shrink-0 text-[var(--primary)]" />
                    <span className="min-w-0">
                      <span className="block truncate">{assignment.title}</span>
                      <span className="block text-xs text-[var(--text-muted)]">
                        {assignment.assigned_date ? formatDate(assignment.assigned_date) : '—'}
                        {assignment.description ? ` • ${assignment.description.substring(0, 40)}${assignment.description.length > 40 ? '...' : ''}` : ''}
                      </span>
                    </span>
                  </span>
                  {value === assignment.id && <Check size={16} className="shrink-0 text-[var(--primary)]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
