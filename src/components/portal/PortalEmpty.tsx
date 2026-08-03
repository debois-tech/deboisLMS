import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface PortalEmptyProps {
  icon?: LucideIcon;
  /** Say why it is empty and what happens next — never just "No records". */
  children: ReactNode;
  /** Optional way out, when there is something the student can actually do. */
  action?: ReactNode;
}

/**
 * The empty state a student sees most often, because a new student starts with
 * every list empty. It has to read as "nothing has happened yet", not "something
 * is broken", so the copy always explains what will fill it.
 */
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
