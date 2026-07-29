import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Layers,
  Users,
  GraduationCap,
  ClipboardCheck,
  DollarSign,
  FileText,
  Plus,
  X,
  PanelLeft,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard },
  { label: 'Batches', to: '/batches', icon: Layers },
  { label: 'Students', to: '/students', icon: Users },
  { label: 'Tutors', to: '/tutors', icon: GraduationCap },
  { label: 'Attendance', to: '/attendance', icon: ClipboardCheck },
  { label: 'Finance', to: '/fees', icon: DollarSign },
  { label: 'Assignments', to: '/assignments', icon: FileText },
];

interface SidebarProps {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggle?: () => void;
}

export function Sidebar({ open, collapsed, onClose, onToggle }: SidebarProps) {
  const location = useLocation();

  const isActive = (to: string) =>
    location.pathname === to || (to !== '/' && location.pathname.startsWith(to));

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
          {navItems.map((item) => {
            const active = isActive(item.to);
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
                    ? 'bg-[var(--primary)] text-white shadow-[0_0_16px_rgba(79,70,229,0.35)]'
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

        <div className={clsx('p-2', collapsed && 'flex justify-center')}>
          <Link
            to="/batches/new"
            onClick={onClose}
            title={collapsed ? 'New Batch' : undefined}
            className={clsx(
              'flex items-center rounded-[var(--radius-md)] bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white text-sm font-semibold transition-all duration-200 shadow-[0_0_16px_rgba(79,70,229,0.3)] h-10 w-full',
              collapsed ? 'justify-center' : 'gap-2.5 pl-2'
            )}
          >
            <span className="flex items-center justify-center w-10 h-10 shrink-0">
              <Plus size={16} />
            </span>
            {!collapsed && <span>New Batch</span>}
          </Link>
        </div>
      </aside>
    </>
  );
}
