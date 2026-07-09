'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { LayoutDashboard, BookOpen, User, PlusCircle, ChevronRight, X } from 'lucide-react';

const navItems = [
  { label: 'Home',      href: '/dashboard',         icon: LayoutDashboard },
  { label: 'My Classes', href: '/dashboard/classes', icon: BookOpen },
  { label: 'Join Class', href: '/dashboard/join',    icon: PlusCircle },
  { label: 'Profile',   href: '/dashboard/profile',  icon: User },
];

interface StudentSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function StudentSidebar({ open, onClose }: StudentSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-64 bg-[var(--bg-surface)] border-r border-[var(--border)] z-40 flex flex-col transition-transform duration-300',
          'lg:translate-x-0 lg:sticky lg:top-16 lg:h-[calc(100vh-4rem)]',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] lg:hidden">
          <span className="text-sm font-semibold text-[var(--text-primary)]">Menu</span>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Student Portal</span>
          </div>
        </div>

        <nav className="flex-1 p-3 overflow-y-auto space-y-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-200',
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

        <div className="p-3 border-t border-[var(--border)]">
          <Link
            href="/dashboard/join"
            className="flex items-center gap-2 justify-center w-full py-2.5 rounded-[10px] bg-[var(--primary)] hover:bg-[var(--primary-light)] text-white text-sm font-semibold transition-all duration-200"
          >
            <PlusCircle size={16} /> Join a Class
          </Link>
        </div>
      </aside>
    </>
  );
}
