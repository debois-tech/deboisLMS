import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Spinner } from '@/components/ui/Spinner';
import { useAuth } from '@/lib/context/AuthContext';

/**
 * Frame for every portal section: resolves the logged-in student's id, holds the loading
 * state, and renders a section heading. A new section only needs `usePortalStudentId` and
 * this wrapper.
 */
export function usePortalStudentId(): string | undefined {
  return useAuth().user?.student_id;
}

interface PortalPageProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  children: ReactNode;
}

export function PortalPage({ title, subtitle, loading, children }: PortalPageProps) {
  return (
    <div className="portal-page">
      <div>
        <h1 className="portal-page-title">{title}</h1>
        {subtitle && <p className="portal-page-subtitle">{subtitle}</p>}
      </div>
      {loading ? <Spinner centered /> : children}
    </div>
  );
}

export function PortalStat({
  label,
  icon: Icon,
  value,
  note,
  children,
}: {
  label: string;
  icon: LucideIcon;
  value: ReactNode;
  note?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="portal-stat">
      <p className="portal-stat-label">
        <Icon size={13} />
        {label}
      </p>
      <p className="portal-stat-value">{value}</p>
      {note && <p className="portal-stat-note">{note}</p>}
      {children}
    </div>
  );
}

export function PortalEmpty({ children }: { children: ReactNode }) {
  return <p className="portal-empty">{children}</p>;
}

export function PortalRow({
  primary,
  secondary,
  trailing,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="portal-list-row">
      <div className="min-w-0">
        <p className="portal-list-primary">{primary}</p>
        {secondary && <p className="portal-list-secondary">{secondary}</p>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
