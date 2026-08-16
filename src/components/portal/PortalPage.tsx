import type { ReactNode } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { StudentIdChip } from '@/components/students/StudentLink';

/** The logged-in student's id, or undefined when the login isn't linked to a student row. */
export function usePortalStudentId(): string | undefined {
  return useAuth().user?.student_id;
}

interface PortalPageProps {
  /** The one h1 on the page. A sentence, not a category name. */
  title: ReactNode;
  /** A single control that acts on the whole page, e.g. a search field. */
  action?: ReactNode;
  /** A short identity fact that belongs beside the title, e.g. the student's ID. Not a control. */
  meta?: ReactNode;
  loading?: boolean;
  /** Takes over the page — "No classes yet" would be a lie when the fetch failed. */
  error?: string | null;
  onRetry?: () => void;
  /** Shape of the loading placeholder — match it to what the page actually renders. */
  shape?: 'dashboard' | 'list';
  children: ReactNode;
}

/** Frame for every portal section: title, optional control, loading placeholder, error state. */
export function PortalPage({ title, action, meta, loading, error, onRetry, shape = 'dashboard', children }: PortalPageProps) {
  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-page-title">{title}</h1>
        {meta}
        {action}
      </div>
      {loading ? <PortalLoading shape={shape} /> : error ? <PortalError onRetry={onRetry} /> : children}
    </div>
  );
}

interface PortalIdentityProps {
  name: string;
  /** The permanent student ID. Rendered with its copy control, same as admin sees. */
  code?: string;
  /** How the institute reaches them, already joined. One line, not a list. */
  contact?: string;
  links?: { label: string; href: string }[];
}

/**
 * The student, stated once, as the masthead of the page that is about them. The
 * monogram is the topbar avatar's treatment on purpose — the page reads as "you"
 * before a word of it is read. A rule under it, not a card, so the labelled cards
 * below are details of this rather than four boxes in a stack.
 */
export function PortalIdentity({ name, code, contact, links = [] }: PortalIdentityProps) {
  const initials = name
    .split(' ')
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  return (
    <div className="portal-identity">
      <span className="portal-monogram" aria-hidden="true">{initials}</span>

      <div className="portal-identity-body">
        <div className="portal-identity-head">
          <p className="portal-identity-name">{name}</p>
          <StudentIdChip code={code} showLabel={false} />
        </div>
        {contact && <p className="portal-identity-contact">{contact}</p>}
        {links.length > 0 && (
          <p className="portal-identity-links">
            {links.map(({ label, href }) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="portal-identity-link">
                {label}
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ))}
          </p>
        )}
      </div>
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
