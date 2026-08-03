import type { ReactNode } from 'react';
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
  /** Shape of the loading placeholder — match it to what the page actually renders. */
  shape?: 'dashboard' | 'list';
  children: ReactNode;
}

/**
 * Frame for every portal section: the page title, an optional page-level control,
 * and the loading placeholder. A new portal page is this wrapper plus widgets from
 * `@/components/portal` — see the README in this folder.
 */
export function PortalPage({ title, action, loading, shape = 'dashboard', children }: PortalPageProps) {
  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-page-title">{title}</h1>
        {action}
      </div>
      {loading ? <PortalLoading shape={shape} /> : children}
    </div>
  );
}

/**
 * Placeholders shaped like the content that is loading, so the page doesn't jump
 * when the data lands and a slow connection still shows the layout it is getting.
 */
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
