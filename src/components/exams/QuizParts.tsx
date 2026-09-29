import type { CSSProperties, ReactNode } from 'react';
import { Check, Minus, X } from 'lucide-react';
import { clsx } from 'clsx';
import { OPTION_LETTERS } from '@/lib/utils/quiz';

type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dim';

interface QuizOptionProps {
  index: number;
  label: string;
  state?: OptionState;
  // 0 to 1: how much of the row the result bar covers.
  fill?: number;
  pct?: number;
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
  large?: boolean;
  // Reads "(correct)" to a screen reader; the colour alone says it to everyone else.
  flag?: 'correct' | 'wrong';
}

// One option: a button while it is being answered, a plain row once it only reports.
export function QuizOption({ index, label, state = 'idle', fill, pct, count, onClick, disabled, large, flag }: QuizOptionProps) {
  const className = clsx('qz-opt', large && 'is-large', state !== 'idle' && `is-${state}`);
  const body = (
    <>
      {fill !== undefined && <span className="qz-opt-bar" style={{ '--p': fill } as CSSProperties} aria-hidden="true" />}
      <span className="qz-opt-letter" aria-hidden="true">{OPTION_LETTERS[index]}</span>
      <span className="qz-opt-label">{label}</span>
      {(pct !== undefined || flag) && (
        <span className="qz-opt-stat">
          {flag === 'correct' && <Check size={16} aria-hidden="true" className="text-[var(--success-text)]" />}
          {flag === 'wrong' && <X size={16} aria-hidden="true" className="text-[var(--danger-text)]" />}
          {pct !== undefined && <span className="qz-opt-pct">{pct}%</span>}
          {count !== undefined && <span className="qz-opt-count">{count}</span>}
          {flag && <span className="sr-only">{flag === 'correct' ? '(correct answer)' : '(wrong answer)'}</span>}
        </span>
      )}
    </>
  );

  if (!onClick) return <div className={className}>{body}</div>;
  return (
    <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={state === 'selected'}>
      {body}
    </button>
  );
}

interface QuizTimerProps {
  left: number;
  total: number;
  big?: boolean;
}

export function QuizTimer({ left, total, big }: QuizTimerProps) {
  const urgent = left <= 3;
  const low = left <= Math.min(10, total / 3);
  const num = <span className="qz-timer-num">{Math.ceil(left)}s</span>;
  return (
    <div className={clsx('qz-timer', big && 'is-big', low && 'is-low', urgent && 'is-urgent')} role="timer" aria-label="Time left">
      {big && num}
      <div className="qz-timer-track">
        <div className="qz-timer-fill" style={{ '--left': total > 0 ? Math.min(1, left / total) : 0 } as CSSProperties} />
      </div>
      {!big && num}
    </div>
  );
}

export interface BoardRow {
  rank: number;
  name: string;
  points: number;
  me?: boolean;
}

export function QuizBoard({ rows }: { rows: BoardRow[] }) {
  return (
    <div className="qz-board">
      {rows.map((row, index) => (
        <div key={`${row.rank}-${index}`} className={clsx('qz-board-row', row.me && 'is-me')}>
          <span className={clsx('qz-rank', row.rank <= 3 && 'is-podium')}>{row.rank}</span>
          <span className="qz-board-name">{row.me ? `${row.name} (you)` : row.name}</span>
          <span className="qz-board-pts">{row.points.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  );
}

interface VerdictProps {
  kind: 'correct' | 'wrong' | 'none' | 'neutral';
  points?: number;
  note?: ReactNode;
}

const VERDICTS = {
  correct: { title: 'Correct', Icon: Check },
  wrong: { title: 'Not quite', Icon: X },
  none: { title: 'No answer', Icon: Minus },
  neutral: { title: 'Answers are in', Icon: Check },
};

export function QuizVerdict({ kind, points, note }: VerdictProps) {
  const { title, Icon } = VERDICTS[kind];
  return (
    <div className={clsx('qz-verdict', kind === 'correct' && 'is-correct', kind === 'wrong' && 'is-wrong')} role="status">
      <span className="qz-verdict-icon"><Icon size={20} aria-hidden="true" /></span>
      <div className="qz-verdict-body">
        <p className="qz-verdict-title">{title}</p>
        {note && <p className="qz-verdict-note">{note}</p>}
      </div>
      {points !== undefined && kind === 'correct' && <span className="qz-verdict-pts">+{points.toLocaleString('en-IN')}</span>}
    </div>
  );
}

interface SegmentProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}

// A pick-one control for a handful of short choices. Arrow keys move the selection.
export function QuizSegment<T extends string>({ value, options, onChange, label }: SegmentProps<T>) {
  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const next = options[(index + delta + options.length) % options.length];
    onChange(next.value);
    (event.currentTarget.parentElement?.children[options.indexOf(next)] as HTMLElement | undefined)?.focus();
  };

  return (
    <div className="qz-seg" role="radiogroup" aria-label={label}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => onKeyDown(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
