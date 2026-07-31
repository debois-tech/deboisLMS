import { ReactNode, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
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

export function THead({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={className}>{children}</tr>;
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
