'use client';

import Link from 'next/link';
import { Sun, Moon, Bell, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';
import { useAuth } from '@/lib/context/AuthContext';
import { useState } from 'react';

interface NavbarProps {
  onMenuToggle?: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = user?.full_name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 gap-4">
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors p-1"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 font-bold text-lg select-none">
        <span className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white text-xs font-black">D</span>
        <span className="hidden sm:block gradient-text">Deboistech LMS</span>
      </Link>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        {/* Notifications */}
        <button className="relative w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200">
          <Bell size={17} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--primary)]" />
        </button>

        {/* User avatar dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-[10px] hover:bg-[var(--bg-elevated)] transition-all duration-200"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-xs font-bold">
              {initials}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-[var(--text-primary)] leading-none">{user?.full_name}</p>
              <p className="text-[10px] text-[var(--text-muted)] mt-0.5 capitalize">{user?.role}</p>
            </div>
            <ChevronDown size={14} className="text-[var(--text-muted)]" />
          </button>

          {dropdownOpen && (
            <div
              className="absolute right-0 top-full mt-2 w-44 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[12px] shadow-[var(--shadow-lg)] py-1 z-50 animate-fade-in"
              onBlur={() => setDropdownOpen(false)}
            >
              <Link
                href={user?.role === 'admin' ? '/admin/dashboard' : '/dashboard/profile'}
                className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                My Profile
              </Link>
              <hr className="border-[var(--border)] my-1" />
              <button className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
