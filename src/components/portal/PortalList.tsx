import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface PortalListProps {
  children: ReactNode;
}

/** One card, hairlines inside it. Put `PortalRow`s in here, nothing else. */
export function PortalList({ children }: PortalListProps) {
  return <div className="portal-list">{children}</div>;
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
