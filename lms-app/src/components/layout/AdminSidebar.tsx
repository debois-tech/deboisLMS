'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import {
  LayoutDashboard, BookOpen, GraduationCap, Users, BarChart3, Plus, ChevronRight, X,
} from 'lucide-react';

const navItems = [
  { label: 'Dashboard',  href: '/admin/dashboard',   icon: LayoutDashboard },
  { label: 'My Classes', href: '/admin/classes',      icon: BookOpen },
  { label: 'Students',   href: '/admin/students',     icon: Users },
  { label: 'Analytics',  href: '/admin/analytics',    icon: BarChart3 },
];

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-[var(--bg-surface)] border-r border-[var(--border)] z-40 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile close */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] lg:hidden">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        {/* Admin badge */}
        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--primary)]/10 border border-[var(--primary)]/20">
            <div className="w-2 h-2 rounded-full bg-[var(--primary)]" />
            <span className="text-xs font-semibold text-[var(--primary)]">Admin Panel</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200 group',
                  active
                    ? 'bg-[var(--primary)] text-white shadow-[0_0_16px_rgba(79,70,229,0.4)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                )}
              >
                <Icon size={17} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight size={14} />}
              </Link>
            );
          })}
        </nav>

        {/* Quick action */}
        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/admin/classes/new"
            className="flex items-center gap-2 justify-center w-full py-2.5 rounded-[10px] bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white text-sm font-semibold transition-all duration-200 shadow-[0_0_16px_rgba(79,70,229,0.35)]"
          >
            <Plus size={16} /> New Class
          </Link>
        </div>
      </aside>
    </>
  );
}
