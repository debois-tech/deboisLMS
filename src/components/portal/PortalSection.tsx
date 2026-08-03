import type { ReactNode } from 'react';

interface PortalSectionProps {
  /** Short label for the group. Sits a step below the page title, never competing with it. */
  title: string;
  /** One control scoped to this section, e.g. a link to the full list. */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * A labelled group inside a portal page. Every portal page builds its body from
 * these instead of hand-rolling a heading and a margin, so the gap between a label
 * and its content is the same everywhere.
 */
export function PortalSection({ title, action, children }: PortalSectionProps) {
  return (
    <section className="portal-section">
      <div className="portal-section-head">
        <h2 className="portal-section-title">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
