import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Users } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import type { Student } from '@/lib/types';

interface StudentMultiSelectProps {
  students: Student[];
  value: string[];
  onChange: (studentIds: string[]) => void;
}

export function StudentMultiSelect({ students, value, onChange }: StudentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const filtered = students.filter((student) => student.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const toggle = (studentId: string) => {
    onChange(value.includes(studentId) ? value.filter((id) => id !== studentId) : [...value, studentId]);
  };

  return (
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-elevated)] text-left text-sm text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
        aria-expanded={open}
      >
        <span className={value.length ? '' : 'text-[var(--text-muted)]'}>
          {value.length ? `${value.length} student${value.length === 1 ? '' : 's'} selected` : 'Select students'}
        </span>
        <ChevronDown size={16} className={`shrink-0 text-[var(--text-muted)] transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] shadow-[var(--shadow-lg)]">
          <div className="border-b border-[var(--border)] p-2">
            <SearchBar size="sm" autoFocus value={search} onChange={setSearch} placeholder="Search students" />
          </div>
          <div className="p-1" style={{ maxHeight: '16rem', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
            {filtered.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-[var(--text-muted)]" style={{ padding: '1rem' }}><Users size={15} /> No students found</p>
            ) : filtered.map((student) => (
              <button key={student.id} type="button" onClick={() => toggle(student.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]" style={{ paddingLeft: '0.75rem', paddingRight: '0.75rem' }}>
                <span className="min-w-0 truncate">{student.name}{student.email ? ` (${student.email})` : ''}</span>
                {value.includes(student.id) && <Check size={16} className="shrink-0 text-[var(--primary)]" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
