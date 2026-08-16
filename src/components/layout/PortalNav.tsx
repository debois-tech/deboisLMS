import { useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, CalendarCheck, FileText, LayoutDashboard, User, X } from 'lucide-react';

interface PortalNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** `end` so the index route doesn't stay active on every child path. */
  end?: boolean;
}

/** Single source of truth for portal sections — add a route in App.tsx and an entry here. */
export const portalNavItems: PortalNavItem[] = [
  { label: 'Home', to: '/portal', icon: LayoutDashboard, end: true },
  { label: 'Attendance', to: '/portal/attendance', icon: CalendarCheck },
  { label: 'Assignments', to: '/portal/assignments', icon: FileText },
  { label: 'Material', to: '/portal/materials', icon: BookOpen },
  { label: 'Profile', to: '/portal/profile', icon: User },
];

interface PortalNavProps {
  open: boolean;
  onClose: () => void;
}

const FOCUSABLE = 'a[href], button:not([disabled])';

/**
 * The portal's sections, as a drawer at every width. Always mounted so it can
 * animate both ways; `visibility` in the closed state is what keeps its links
 * out of the tab order rather than a conditional render.
 */
export function PortalNav({ open, onClose }: PortalNavProps) {
  const { pathname } = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);
  // Held in a ref so the effects below key on `open` and `pathname` alone — a new
  // `onClose` identity every render would otherwise re-run them and steal focus.
  // Written in its own effect, which runs before the two that read it.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  // Navigating is the drawer's whole purpose, so arriving anywhere closes it.
  // Covers the browser's own back and forward as well as the links inside.
  useEffect(() => {
    closeRef.current();
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      // The drawer covers the page, so Tab must not walk out into what it covers.
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      opener?.focus();
    };
  }, [open]);

  return (
    <div className={`portal-drawer${open ? ' is-open' : ''}`}>
      <div className="portal-drawer-scrim" aria-hidden="true" onClick={onClose} />

      <div
        ref={panelRef}
        id="portal-menu"
        className="portal-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Portal menu"
      >
        <div className="portal-drawer-head">
          <span className="portal-drawer-label">Menu</span>
          <button type="button" onClick={onClose} className="portal-drawer-close" aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="portal-drawer-nav" aria-label="Portal sections">
          {portalNavItems.map(({ label, to, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `portal-nav-link${isActive ? ' is-active' : ''}`}
            >
              <Icon size={17} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
