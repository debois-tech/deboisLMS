import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { CalendarCheck, FileText, LayoutDashboard, Wallet } from 'lucide-react';

interface PortalNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** `end` so the index route doesn't stay active on every child path. */
  end?: boolean;
}

/** Single source of truth for portal sections — add a route in App.tsx and an entry here. */
export const portalNavItems: PortalNavItem[] = [
  { label: 'Overview', to: '/portal', icon: LayoutDashboard, end: true },
  { label: 'Attendance', to: '/portal/attendance', icon: CalendarCheck },
  { label: 'Assignments', to: '/portal/assignments', icon: FileText },
  { label: 'Fees', to: '/portal/fees', icon: Wallet },
];

export function PortalNav() {
  return (
    <nav className="portal-nav" aria-label="Portal sections">
      {portalNavItems.map(({ label, to, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `portal-nav-link${isActive ? ' is-active' : ''}`}
        >
          <Icon size={15} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
