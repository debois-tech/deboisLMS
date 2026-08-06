import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface PortalEmptyProps {
  icon?: LucideIcon;
  /** A phrase and a full stop — "No attendance marked yet." Never an explanation. */
  children: ReactNode;
  /** Optional way out, when there is something the student can actually do. */
  action?: ReactNode;
}

/** "Nothing here yet", not "this is broken" — the icon and framing carry that. */
export function PortalEmpty({ icon: Icon = Inbox, children, action }: PortalEmptyProps) {
  return (
    <div className="portal-empty">
      <span className="portal-empty-icon">
        <Icon size={18} aria-hidden="true" />
      </span>
      <p className="portal-empty-text">{children}</p>
      {action}
    </div>
  );
}
