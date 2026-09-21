import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { CurriculumNode } from '@/lib/types';
import { doneByDate } from '@/lib/utils/curriculum';
import { WEEKDAY_LABELS, addMonths, formatDateValue, formatMonthLabel, monthGrid, startOfMonth, toDateValue } from '@/lib/utils/date';

/** What was taught on which day: only done nodes, read from their done_on date. */
export function CurriculumCalendar({ nodes, onClose }: { nodes: CurriculumNode[]; onClose: () => void }) {
  const byDate = useMemo(() => doneByDate(nodes), [nodes]);
  const titleOf = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);

  const latest = useMemo(() => [...byDate.keys()].sort().pop(), [byDate]);
  const [month, setMonth] = useState(() => startOfMonth(latest ? new Date(`${latest}T00:00:00`) : new Date()));
  const [selected, setSelected] = useState<string | null>(latest ?? null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const today = toDateValue(new Date());
  const thisMonth = month.getMonth();
  const items = selected ? byDate.get(selected) ?? [] : [];

  const path = (node: CurriculumNode) => {
    const parent = node.parent_id ? titleOf.get(node.parent_id) : undefined;
    const grand = parent?.parent_id ? titleOf.get(parent.parent_id) : undefined;
    return [grand?.title, parent?.title].filter(Boolean).join(' › ');
  };

  return (
    <div className="cv-calendar nodrag nopan nowheel" role="dialog" aria-label="Completed topics calendar">
      <div className="cv-calendar-head">
        <button type="button" className="cv-icon-btn" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
          <ChevronLeft size={16} />
        </button>
        <span className="cv-calendar-month">{formatMonthLabel(month)}</span>
        <button type="button" className="cv-icon-btn" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={16} />
        </button>
        <button type="button" className="cv-icon-btn" aria-label="Close calendar" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="cv-calendar-grid">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label} className="cv-calendar-weekday">{label}</span>
        ))}
        {monthGrid(month).map((date) => {
          const value = toDateValue(date);
          const count = byDate.get(value)?.length ?? 0;
          return (
            <button
              key={value}
              type="button"
              className={clsx(
                'cv-calendar-day',
                date.getMonth() !== thisMonth && 'is-outside',
                value === today && 'is-today',
                value === selected && 'is-selected',
                count > 0 && 'has-items',
              )}
              onClick={() => setSelected(value)}
              aria-label={`${formatDateValue(value)}${count ? `, ${count} completed` : ''}`}
              aria-pressed={value === selected}
            >
              {date.getDate()}
              {count > 0 && <span className="cv-calendar-count" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="cv-calendar-list">
        {!selected ? (
          <p className="cv-calendar-empty">Nothing has been marked done yet.</p>
        ) : items.length === 0 ? (
          <p className="cv-calendar-empty">Nothing was completed on {formatDateValue(selected)}.</p>
        ) : (
          <>
            <p className="cv-calendar-date">{formatDateValue(selected)}</p>
            <ul>
              {items.map((node) => (
                <li key={node.id}>
                  <span className="cv-calendar-item">{node.title}</span>
                  {path(node) && <span className="cv-calendar-path">{path(node)}</span>}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
