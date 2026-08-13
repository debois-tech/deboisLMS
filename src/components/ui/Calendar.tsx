import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  formatMonthLabel,
  isSameDay,
  monthGrid,
  startOfMonth,
} from '@/lib/utils/date';

interface CalendarProps {
  selected: Date | null;
  onSelect: (date: Date) => void;
  min?: Date | null;
  max?: Date | null;
  autoFocus?: boolean;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function outOfRange(date: Date, min?: Date | null, max?: Date | null): boolean {
  if (min && date < new Date(min.getFullYear(), min.getMonth(), min.getDate())) return true;
  if (max && date > new Date(max.getFullYear(), max.getMonth(), max.getDate())) return true;
  return false;
}

export function Calendar({ selected, onSelect, min, max, autoFocus }: CalendarProps) {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<Date>(() => selected ?? today);
  const [month, setMonth] = useState<Date>(() => startOfMonth(selected ?? today));
  const [pickingMonth, setPickingMonth] = useState(false);

  const gridRef = useRef<HTMLDivElement>(null);
  const shouldFocusRef = useRef(Boolean(autoFocus));

  const days = useMemo(() => monthGrid(month), [month]);

  useEffect(() => {
    if (!shouldFocusRef.current) return;
    shouldFocusRef.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>('[data-cursor="true"]')?.focus();
  });

  const moveCursor = (next: Date) => {
    if (outOfRange(next, min, max)) return;
    shouldFocusRef.current = true;
    setCursor(next);
    if (next.getMonth() !== month.getMonth() || next.getFullYear() !== month.getFullYear()) {
      setMonth(startOfMonth(next));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const keys: Record<string, () => Date> = {
      ArrowLeft: () => addDays(cursor, -1),
      ArrowRight: () => addDays(cursor, 1),
      ArrowUp: () => addDays(cursor, -7),
      ArrowDown: () => addDays(cursor, 7),
      Home: () => addDays(cursor, -((cursor.getDay() + 6) % 7)),
      End: () => addDays(cursor, 6 - ((cursor.getDay() + 6) % 7)),
      PageUp: () => addMonths(cursor, -1),
      PageDown: () => addMonths(cursor, 1),
    };

    const next = keys[event.key];
    if (next) {
      event.preventDefault();
      moveCursor(next());
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!outOfRange(cursor, min, max)) onSelect(cursor);
    }
  };

  const stepMonth = (delta: number) => {
    setMonth((current) => addMonths(current, delta));
  };

  return (
    <div className="calendar">
      <div className="calendar-head">
        <button
          type="button"
          className="calendar-nav"
          onClick={() => (pickingMonth ? setMonth(addMonths(month, -12)) : stepMonth(-1))}
          aria-label={pickingMonth ? 'Previous year' : 'Previous month'}
        >
          <ChevronLeft size={16} />
        </button>

        <button
          type="button"
          className={clsx('calendar-title', pickingMonth && 'is-open')}
          onClick={() => setPickingMonth((open) => !open)}
          aria-expanded={pickingMonth}
        >
          {pickingMonth ? month.getFullYear() : formatMonthLabel(month)}
        </button>

        <button
          type="button"
          className="calendar-nav"
          onClick={() => (pickingMonth ? setMonth(addMonths(month, 12)) : stepMonth(1))}
          aria-label={pickingMonth ? 'Next year' : 'Next month'}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {pickingMonth ? (
        <div className="calendar-months">
          {MONTH_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              className={clsx(
                'calendar-month',
                index === month.getMonth() && 'is-current',
                selected &&
                  index === selected.getMonth() &&
                  month.getFullYear() === selected.getFullYear() &&
                  'is-selected',
              )}
              onClick={() => {
                setMonth(new Date(month.getFullYear(), index, 1));
                setPickingMonth(false);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="calendar-weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div
            ref={gridRef}
            className="calendar-grid"
            role="grid"
            aria-label={formatMonthLabel(month)}
            onKeyDown={handleKeyDown}
          >
            {days.map((day) => {
              const outside = day.getMonth() !== month.getMonth();
              const disabled = outOfRange(day, min, max);
              const isSelected = selected ? isSameDay(day, selected) : false;
              const isCursor = isSameDay(day, cursor);

              return (
                <button
                  key={day.getTime()}
                  type="button"
                  role="gridcell"
                  data-cursor={isCursor}
                  tabIndex={isCursor ? 0 : -1}
                  disabled={disabled}
                  aria-selected={isSelected}
                  aria-current={isSameDay(day, today) ? 'date' : undefined}
                  aria-label={day.toLocaleDateString('en-IN', {
                    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  })}
                  className={clsx(
                    'calendar-day',
                    outside && 'is-outside',
                    isSelected && 'is-selected',
                    isSameDay(day, today) && !isSelected && 'is-today',
                  )}
                  onClick={() => {
                    setCursor(day);
                    onSelect(day);
                  }}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
