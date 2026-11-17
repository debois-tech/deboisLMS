import { Children, cloneElement, isValidElement, ReactElement, ReactNode, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { clsx } from 'clsx';

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  /** Max height for the scroll container. Defaults to 22rem. */
  maxHeight?: string;
  stickyHeader?: boolean;
}

export function Table({ children, className, maxHeight = '22rem', stickyHeader = true, ...rest }: TableProps) {
  return (
    <div className="data-table-wrap" style={{ maxHeight }}>
      <table className={clsx('data-table', stickyHeader && 'data-table-sticky', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}

// The Sr No. column is added here, so every table gets it and none builds its own.
const withSerial = (children: ReactNode, serial: (at: number) => string | number) =>
  Children.toArray(children).map((child, at) =>
    isValidElement(child) ? cloneElement(child as ReactElement<{ serial?: string | number }>, { serial: serial(at) }) : child,
  );

export function THead({ children }: { children: ReactNode }) {
  return <thead>{withSerial(children, () => 'Sr No.')}</thead>;
}

/** `from` numbers the first row: pass the pager's `from` so page 2 carries on from page 1. */
export function TBody({ children, from = 1 }: { children: ReactNode; from?: number }) {
  return <tbody>{withSerial(children, (at) => Math.max(from, 1) + at)}</tbody>;
}

/** `onActivate` makes the whole row a control: click, or Enter / Space while the row itself is focused. */
export function TR({ children, className, serial, onActivate }: { children: ReactNode; className?: string; serial?: string | number; onActivate?: () => void }) {
  return (
    <tr
      className={onActivate ? `row-link ${className ?? ''}` : className}
      onClick={onActivate}
      tabIndex={onActivate ? 0 : undefined}
      onKeyDown={onActivate ? (event) => {
        if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        onActivate();
      } : undefined}
    >
      {typeof serial === 'string' && <th className="serial-col text-center!">{serial}</th>}
      {typeof serial === 'number' && <td className="serial-col cell-muted text-center!">{serial}</td>}
      {children}
    </tr>
  );
}

const alignClass = {
  left: 'text-left!',
  center: 'text-center!',
  right: 'text-right!',
} as const;

export function TH({
  children,
  className,
  align = 'left',
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <th className={clsx(alignClass[align], className)} {...rest}>
      {children}
    </th>
  );
}

export function TD({
  children,
  className,
  align = 'left',
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { align?: 'left' | 'center' | 'right' }) {
  return (
    <td className={clsx(alignClass[align], className)} {...rest}>
      {children}
    </td>
  );
}
