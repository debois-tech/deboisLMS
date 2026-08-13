import { ReactNode, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, X } from 'lucide-react';
import { clsx } from 'clsx';
import { Calendar } from '@/components/ui/Calendar';
import {
  formatDateValue,
  formatTimeLabel,
  fromDateValue,
  fromInstant,
  toDateValue,
  toInstant,
} from '@/lib/utils/date';

const PANEL_WIDTH = 288;
const GAP = 8;

interface AnchoredPanelProps {
  /** A ref, not an element: reading `.current` during the parent's render is a stale read. */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

/** Portalled and fixed-positioned, because most date fields sit inside a modal whose body scrolls. */
function AnchoredPanel({ anchorRef, onClose, children }: AnchoredPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; above: boolean } | null>(null);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 340;

    // Flip above only when there is actually more room up there.
    const below = window.innerHeight - rect.bottom;
    const above = below < height + GAP && rect.top > below;

    setPosition({
      top: above ? Math.max(GAP, rect.top - height - GAP) : rect.bottom + GAP,
      left: Math.min(
        Math.max(GAP, rect.left),
        Math.max(GAP, window.innerWidth - PANEL_WIDTH - GAP),
      ),
      above,
    });
  }, [anchorRef]);

  useLayoutEffect(place, [place]);

  useEffect(() => {
    // Capture, so a scroll inside the modal body counts and not just the window's.
    const update = () => place();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [place]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };

    // Capture phase, or a surrounding modal's Escape handler closes the dialog instead.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel) return;
      const focusable = [...panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )];
      if (focusable.length === 0) return;

      event.stopPropagation();
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !panel.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div
      ref={panelRef}
      className={clsx('datepicker-panel', position?.above && 'is-above')}
      style={{
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: PANEL_WIDTH,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface TriggerProps {
  label: string;
  placeholder: string;
  open: boolean;
  disabled?: boolean;
  filled: boolean;
  onToggle: () => void;
  onClear?: () => void;
  ariaLabel?: string;
  id?: string;
  className?: string;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

function PickerTrigger({
  label, placeholder, open, disabled, filled, onToggle, onClear, ariaLabel, id, className, triggerRef,
}: TriggerProps) {
  return (
    <div className={clsx('datepicker', className)}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={clsx('datepicker-trigger', open && 'is-open', !filled && 'is-empty')}
      >
        <CalendarDays size={15} className="datepicker-trigger-icon" />
        <span className="datepicker-trigger-value">{filled ? label : placeholder}</span>
      </button>

      {filled && onClear && !disabled && (
        <button
          type="button"
          className="datepicker-clear"
          onClick={onClear}
          aria-label="Clear date"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

interface DatePickerProps {
  /** `YYYY-MM-DD`, or an empty string for no date. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest / latest selectable day, as `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  disabled?: boolean;
  clearable?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
}

/** A date field in our own theme. Replaces `<input type="date">`, whose panel the browser draws. */
export function DatePicker({
  value, onChange, placeholder = 'Pick a date', min, max, disabled, clearable = true, id, className, ariaLabel,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = fromDateValue(value);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <PickerTrigger
        id={id}
        triggerRef={triggerRef}
        className={className}
        label={formatDateValue(value)}
        placeholder={placeholder}
        open={open}
        disabled={disabled}
        filled={Boolean(selected)}
        ariaLabel={ariaLabel}
        onToggle={() => setOpen((wasOpen) => !wasOpen)}
        onClear={clearable ? () => onChange('') : undefined}
      />

      {open && (
        <AnchoredPanel anchorRef={triggerRef} onClose={close}>
          <Calendar
            autoFocus
            selected={selected}
            min={min ? fromDateValue(min) : null}
            max={max ? fromDateValue(max) : null}
            onSelect={(date) => {
              onChange(toDateValue(date));
              close();
            }}
          />
          <div className="datepicker-foot">
            <button
              type="button"
              className="datepicker-foot-action"
              onClick={() => {
                onChange(toDateValue(new Date()));
                close();
              }}
            >
              Today
            </button>
            {clearable && value && (
              <button
                type="button"
                className="datepicker-foot-action is-quiet"
                onClick={() => {
                  onChange('');
                  close();
                }}
              >
                Clear
              </button>
            )}
          </div>
        </AnchoredPanel>
      )}
    </>
  );
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = ['00', '15', '30', '45', '59'];

interface DateTimePickerProps {
  /** An ISO instant, or null for none. */
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
  min?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  ariaLabel?: string;
}

/** A date and a time as one absolute instant. Defaults to 11:59 PM. */
export function DateTimePicker({
  value, onChange, placeholder = 'Pick a deadline', min, disabled, id, className, ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const parts = value ? fromInstant(value) : null;
  const [time, setTime] = useState(parts?.time ?? '23:59');
  const dateValue = parts?.date ?? '';
  const selected = fromDateValue(dateValue);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const commit = (nextDate: string, nextTime: string) => {
    const iso = toInstant(nextDate, nextTime);
    if (iso) onChange(iso);
  };

  const [hourText, minuteText] = time.split(':');
  const hour24 = Number(hourText);
  const meridiem = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  const setClock = (nextHour12: number, nextMinute: string, nextMeridiem: string) => {
    const hour = nextMeridiem === 'AM'
      ? (nextHour12 === 12 ? 0 : nextHour12)
      : (nextHour12 === 12 ? 12 : nextHour12 + 12);
    const next = `${String(hour).padStart(2, '0')}:${nextMinute}`;
    setTime(next);
    if (dateValue) commit(dateValue, next);
  };

  return (
    <>
      <PickerTrigger
        id={id}
        triggerRef={triggerRef}
        className={className}
        label={value ? `${formatDateValue(dateValue)} · ${formatTimeLabel(time)}` : ''}
        placeholder={placeholder}
        open={open}
        disabled={disabled}
        filled={Boolean(value)}
        ariaLabel={ariaLabel}
        onToggle={() => setOpen((wasOpen) => !wasOpen)}
        onClear={() => onChange(null)}
      />

      {open && (
        <AnchoredPanel anchorRef={triggerRef} onClose={close}>
          <Calendar
            autoFocus
            selected={selected}
            min={min ? fromDateValue(min) : null}
            onSelect={(date) => commit(toDateValue(date), time)}
          />

          <div className="datepicker-time">
            <span className="datepicker-time-label">Closes at</span>
            <div className="datepicker-time-fields">
              <select
                aria-label="Hour"
                value={hour12}
                onChange={(event) => setClock(Number(event.target.value), minuteText, meridiem)}
              >
                {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
              </select>
              <select
                aria-label="Minute"
                value={minuteText}
                onChange={(event) => setClock(hour12, event.target.value, meridiem)}
              >
                {/* Keeps an off-list minute selectable, so opening the picker can't reset it. */}
                {(MINUTES.includes(minuteText) ? MINUTES : [...MINUTES, minuteText].sort()).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <select
                aria-label="AM or PM"
                value={meridiem}
                onChange={(event) => setClock(hour12, minuteText, event.target.value)}
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>

          <div className="datepicker-foot">
            <button
              type="button"
              className="datepicker-foot-action"
              onClick={() => {
                setTime('23:59');
                commit(dateValue || toDateValue(new Date()), '23:59');
              }}
            >
              End of day
            </button>
            <button type="button" className="datepicker-foot-action is-quiet" onClick={close}>
              Done
            </button>
          </div>
        </AnchoredPanel>
      )}
    </>
  );
}
