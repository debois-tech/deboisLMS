import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

interface PortalStatProps {
  /** What the number is. Plain words, not a database column name. */
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  /** What the number was counted from, in as few words as possible — "11 of 12 classes". */
  note?: ReactNode;
  /** 0–100. Draws the bar under the note; omit it and no bar is drawn. */
  progress?: number;
  /** Colours the value from the semantic tokens. Never colour a value inline. */
  tone?: 'default' | 'positive' | 'attention';
}

/** One number and, at most, the few words that say what it was counted from. */
export function PortalStat({ label, icon: Icon, value, note, progress, tone = 'default' }: PortalStatProps) {
  const clamped = progress === undefined ? undefined : Math.max(0, Math.min(100, progress));

  return (
    <div className="portal-stat">
      <p className="portal-stat-label">
        <Icon size={13} aria-hidden="true" />
        {label}
      </p>
      <p
        className={clsx(
          'portal-stat-value',
          tone === 'positive' && 'is-positive',
          tone === 'attention' && 'is-attention',
        )}
      >
        {value}
      </p>
      {note && <p className="portal-stat-note">{note}</p>}
      {clamped !== undefined && (
        <div
          className="portal-progress"
          role="progressbar"
          aria-valuenow={clamped}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div className="portal-progress-fill" style={{ transform: `scaleX(${clamped / 100})` }} />
        </div>
      )}
    </div>
  );
}

/** The grid every portal page puts its stats in. Wraps to one column on a phone. */
export function PortalStatGrid({ children }: { children: ReactNode }) {
  return <div className="portal-stat-grid">{children}</div>;
}

interface PortalAmountProps {
  /** Already formatted — the widget sets the type, never the currency. */
  value: ReactNode;
  /** What the figure covers, in as few words as possible. */
  note?: ReactNode;
  tone?: 'default' | 'positive' | 'attention';
}

/**
 * One sum of money given the weight of the answer it is. For the head of a
 * `PortalList`, where a stat tile alone in a grid would look like a tile missing
 * its neighbours and a section label alone would understate the number.
 */
export function PortalAmount({ value, note, tone = 'default' }: PortalAmountProps) {
  return (
    <div className="portal-amount">
      <p
        className={clsx(
          'portal-amount-value',
          tone === 'positive' && 'is-positive',
          tone === 'attention' && 'is-attention',
        )}
      >
        {value}
      </p>
      {note && <p className="portal-amount-note">{note}</p>}
    </div>
  );
}
