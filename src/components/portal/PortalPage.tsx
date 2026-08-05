import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

/** The logged-in student's id, or undefined when the login isn't linked to a student row. */
export function usePortalStudentId(): string | undefined {
  return useAuth().user?.student_id;
}

interface PortalPageProps {
  /** The one h1 on the page. A sentence, not a category name. */
  title: ReactNode;
  /** A single control that acts on the whole page, e.g. a search field. */
  action?: ReactNode;
  loading?: boolean;
  /**
   * The load failed. Takes over the page, because the alternative is a student
   * reading "No classes yet." when the classes are there but unreachable.
   */
  error?: string | null;
  onRetry?: () => void;
  /** Shape of the loading placeholder — match it to what the page actually renders. */
  shape?: 'dashboard' | 'list';
  children: ReactNode;
}

/** Frame for every portal section: title, optional control, loading placeholder, error state. */
export function PortalPage({ title, action, loading, error, onRetry, shape = 'dashboard', children }: PortalPageProps) {
  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-page-title">{title}</h1>
        {action}
      </div>
      {loading ? <PortalLoading shape={shape} /> : error ? <PortalError onRetry={onRetry} /> : children}
    </div>
  );
}

/** Not the thrown message — a student can do nothing with "PGRST301 JWT expired". */
function PortalError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="portal-empty" role="alert">
      <span className="portal-empty-icon portal-empty-icon-alert">
        <AlertTriangle size={18} aria-hidden="true" />
      </span>
      <p className="portal-empty-text">This didn't load. Check your connection and try again.</p>
      {onRetry && (
        <button type="button" className="portal-retry" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

/** Placeholders shaped like the content that is loading, so the page doesn't jump when data lands. */
export function PortalLoading({ shape = 'dashboard' }: { shape?: 'dashboard' | 'list' }) {
  return (
    <div className="portal-skeleton" aria-busy="true" aria-label="Loading">
      {shape === 'dashboard' && (
        <>
          <div className="skeleton portal-skeleton-focus" />
          <div className="portal-skeleton-grid">
            <div className="skeleton portal-skeleton-tile" />
            <div className="skeleton portal-skeleton-tile" />
            <div className="skeleton portal-skeleton-tile" />
          </div>
        </>
      )}
      <div className="skeleton portal-skeleton-list" />
    </div>
  );
}
