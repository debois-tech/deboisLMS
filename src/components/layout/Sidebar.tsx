import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  Plus, X, PanelLeft,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard',   to: '/' },
  { label: 'Batches',     to: '/batches' },
  { label: 'Students',    to: '/students' },
  { label: 'Tutors',      to: '/tutors' },
  { label: 'Attendance',  to: '/attendance' },
  { label: 'Finance',     to: '/fees' },
  { label: 'Assignments', to: '/assignments' },
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
          'lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]',
          open ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'w-[4.75rem]' : 'w-64'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] lg:hidden">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div className={clsx('px-3 pt-2 pb-1 border-b border-[var(--border)]', collapsed && 'px-2')}>
          <button
            onClick={onToggle}
            aria-label="Toggle sidebar"
            title="Toggle sidebar"
            className="flex items-center justify-center w-full py-2 rounded-[10px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
          >
            {collapsed ? (
              <span className="font-bold text-lg select-none gradient-text">d</span>
            ) : (
              <PanelLeft size={18} />
            )}
          </button>
        </div>

        <nav className={clsx('flex-1 p-3 overflow-y-auto', collapsed && 'px-2')}>
          {navItems.map((item, index) => {
            const active = isActive(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={clsx(
                  'flex items-center justify-center px-2 py-7 rounded-[10px] text-sm font-medium transition-all duration-200 group',
                  active
                    ? 'bg-[var(--primary)] text-white shadow-[0_0_16px_rgba(79,70,229,0.4)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                )}
                style={index < navItems.length - 1 ? { marginBottom: '12px' } : undefined}
              >
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={clsx('p-3 border-t border-[var(--border)]', collapsed && 'px-2')}>
          <Link
            to="/batches/new"
            className="flex items-center gap-2 justify-center w-full py-6 rounded-[10px] bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white text-sm font-semibold transition-all duration-200 shadow-[0_0_16px_rgba(79,70,229,0.35)]"
          >
            <Plus size={16} /> {!collapsed && 'New Batch'}
          </Link>
        </div>
      </aside>
    </>
  );
}
