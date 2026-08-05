import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface PortalFocusProps {
  icon: LucideIcon;
  /** A whole sentence — "Your next class is tomorrow" — not a label. */
  title: ReactNode;
  /** The facts behind the sentence: when, where, which code. */
  detail?: ReactNode;
  /** The one thing to do about it, if there is one. */
  action?: ReactNode;
}

/** The answer to "what do I do now?", heavier than any tile under it. At most one per page. */
export function PortalFocus({ icon: Icon, title, detail, action }: PortalFocusProps) {
  return (
    <div className="portal-focus">
      <span className="portal-focus-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="portal-focus-body">
        <p className="portal-focus-title">{title}</p>
        {detail && <p className="portal-focus-detail">{detail}</p>}
      </div>
      {action && <div className="portal-focus-action">{action}</div>}
    </div>
  );
}
