import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PortalListProps {
  /** The one figure the rows below add up to, e.g. a `PortalAmount`. Not a row. */
  head?: ReactNode;
  children: ReactNode;
}

/** One card, hairlines inside it. Put `PortalRow`s in here, nothing else. */
export function PortalList({ head, children }: PortalListProps) {
  return (
    <div className="portal-list">
      {head && <div className="portal-list-head">{head}</div>}
      {children}
    </div>
  );
}

interface PortalRowProps {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
  state?: 'todo' | 'done' | 'missed';
  muted?: boolean;
  onClick?: () => void;
  label?: string;
}

/** One line of meaning: state dot, the thing, a quiet second line, one trailing slot. */
export function PortalRow({ primary, secondary, trailing, state, muted, onClick, label }: PortalRowProps) {
  const className = clsx(
    'portal-list-row',
    onClick && 'is-interactive',
    muted && 'is-muted',
  );

  const body = (
    <>
      <span className="portal-list-lead">
        {state && (
          <span
            className={clsx('portal-row-dot', state === 'done' && 'is-done', state === 'missed' && 'is-missed')}
            aria-hidden="true"
          />
        )}
        <span className="min-w-0">
          <span className="portal-list-primary block">{primary}</span>
          {secondary && <span className="portal-list-secondary block">{secondary}</span>}
        </span>
      </span>
      {(trailing || onClick) && (
        <span className="portal-list-trailing">
          {trailing}
          {onClick && <ChevronRight size={15} className="portal-row-chevron" aria-hidden="true" />}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={className}>
      {body}
    </button>
  );
}

export interface PortalFact {
  label: string;
  value: ReactNode;
}

/**
 * Facts the student cannot change — a college, a date of birth. Anything blank is
 * dropped rather than shown as a dash: a row that says nothing is not a fact.
 */
export function PortalFacts({ facts }: { facts: PortalFact[] }) {
  const present = facts.filter(({ value }) => value !== undefined && value !== null && value !== '');
  if (present.length === 0) return null;

  return (
    <dl className="portal-facts">
      {present.map(({ label, value }) => (
        <div key={label} className="portal-fact">
          <dt className="portal-fact-label">{label}</dt>
          <dd className="portal-fact-value">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
