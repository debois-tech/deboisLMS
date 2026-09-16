import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Layers,
  Users,
  GraduationCap,
  ClipboardCheck,
  DollarSign,
  FileText,
  BookOpen,
  MessageSquare,
  Plus,
  X,
  PanelLeft,
} from 'lucide-react';

export interface SidebarNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  /** Match only exactly `to`, never a sub-route — for the dashboard/index item. */
  end?: boolean;
}

const navItems: SidebarNavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Batches', to: '/batches', icon: Layers },
  { label: 'Students', to: '/students', icon: Users },
  { label: 'Tutors', to: '/tutors', icon: GraduationCap },
  { label: 'Attendance', to: '/attendance', icon: ClipboardCheck },
  { label: 'Finance', to: '/fees', icon: DollarSign },
  { label: 'Assignments', to: '/assignments', icon: FileText },
  { label: 'Study Material', to: '/materials', icon: BookOpen },
  { label: 'Feedback', to: '/feedback', icon: MessageSquare },
];

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggle?: () => void;
  /** Defaults to the admin nav — a tutor shell passes its own scoped list. */
  items?: SidebarNavItem[];
  /** Bottom "+ New X" shortcut. Pass `null` to hide it entirely. */
  newAction?: { label: string; to: string } | null;
}

export function Sidebar({ open, collapsed, onClose, onToggle, items = navItems, newAction = { label: 'New Batch', to: '/batches/new' } }: SidebarProps) {
  const location = useLocation();

  const isActive = (item: SidebarNavItem) =>
    item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full bg-[var(--bg-surface)] border-r border-[var(--border)] z-40 flex flex-col transition-all duration-300',
          'lg:translate-x-0 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)]',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[4.5rem]' : 'w-60'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] lg:hidden">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-2 py-2">
          <button
            onClick={onToggle}
            aria-label="Toggle sidebar"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
           className={clsx(
      'flex items-center rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all h-9 w-full',
      collapsed ? 'justify-center' : 'gap-2.5 pl-2'
    )} >
            <span className="flex items-center justify-center w-10 h-9 shrink-0">
              <PanelLeft size={18} />
            </span>
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto py-3 px-2 space-y-1">
          {items.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                title={collapsed ? item.label : undefined}
                className={clsx(
                   'flex items-center rounded-[var(--radius-md)] text-sm font-medium transition-all duration-200 h-10 w-full',
          collapsed ? 'justify-center' : 'gap-2.5 pl-2',
                  active
                    ? 'bg-[var(--primary)] text-white shadow-[var(--primary-glow)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                )}
              >
                <span className="flex items-center justify-center w-10 h-10 shrink-0">
                  <Icon size={18} />
                </span>
               {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {newAction && (
          <div className={clsx('p-2', collapsed && 'flex justify-center')}>
            <Link
              to={newAction.to}
              onClick={onClose}
              title={collapsed ? newAction.label : undefined}
              className={clsx(
                'flex items-center rounded-[var(--radius-md)] bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white text-sm font-semibold transition-all duration-200 shadow-[var(--primary-glow)] h-10 w-full',
                collapsed ? 'justify-center' : 'gap-2.5 pl-2'
              )}
            >
              <span className="flex items-center justify-center w-10 h-10 shrink-0">
                <Plus size={16} />
              </span>
              {!collapsed && <span>{newAction.label}</span>}
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
