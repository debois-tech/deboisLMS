import { useEffect, useRef, useState } from 'react';
import { CalendarDays, Check, ChevronDown, Search } from 'lucide-react';
import type { Lecture } from '@/lib/types';
import { formatDate } from '@/lib/utils/format';

interface LectureSelectProps {
  lectures: Lecture[];
  value: string | null;
  onChange: (lectureId: string) => void;
}

function lectureLabel(lecture: Lecture) {
  return `${formatDate(lecture.lecture_date)}${lecture.meeting_code ? ` (${lecture.meeting_code})` : ''}`;
}

export function LectureSelect({ lectures, value, onChange }: LectureSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = lectures.find((lecture) => lecture.id === value);
  const filtered = lectures.filter((lecture) => lectureLabel(lecture).toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const choose = (lectureId: string) => {
    onChange(lectureId);
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
        <span className={selected ? '' : 'text-[var(--text-muted)]'}>{selected ? lectureLabel(selected) : 'Select a lecture'}</span>
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
                placeholder="Search lectures..."
                className="min-h-10 w-full border-0 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                style={{ paddingLeft: '0.25rem', paddingRight: '0.25rem' }}
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1" role="listbox">
            {filtered.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]" style={{ padding: '1rem 1.25rem' }}>No lectures found</p>
            ) : (
              filtered.map((lecture) => (
                <button
                  key={lecture.id}
                  type="button"
                  role="option"
                  aria-selected={value === lecture.id}
                  onClick={() => choose(lecture.id)}
                  className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-md)] text-left text-sm text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ paddingLeft: '1rem', paddingRight: '1rem' }}
                >
                  <span className="flex items-center gap-2"><CalendarDays size={15} className="shrink-0 text-[var(--primary)]" />{lectureLabel(lecture)}</span>
                  {value === lecture.id && <Check size={16} className="text-[var(--primary)]" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
