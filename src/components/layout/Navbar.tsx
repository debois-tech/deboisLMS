import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { useState, useEffect, useRef } from 'react';

export function Navbar() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const { user } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropdownOpen]);

  const initials = user?.full_name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header className="h-16 border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-md sticky top-0 z-40 flex items-center px-4 gap-4">
      <Link
        to="/"
        className="font-bold text-2xl select-none gradient-text hover:opacity-80 transition-opacity ml-10"
      >
        deboistech ERP
      </Link>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
        </button>

        <div className="relative" ref={dropdownRef}>
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
            >
              <hr className="border-[var(--border)] my-1" />
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/auth/login');
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
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
