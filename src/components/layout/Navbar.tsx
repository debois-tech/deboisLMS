import { Link, useNavigate } from 'react-router-dom';
import { Sun, Moon, LogOut, ChevronDown, Menu } from 'lucide-react';
import { useTheme } from '@/lib/context/ThemeContext';
import { useAuth } from '@/lib/context/AuthContext';
import { supabase } from '@/lib/supabase/client';
import { useState, useEffect, useRef } from 'react';

interface NavbarProps {
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps) {
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
    <header
      className="h-14 border-b border-[var(--border)] bg-[var(--bg-surface)]/80 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between gap-2 sm:gap-3"
      style={{ paddingLeft: '2rem', paddingRight: '2rem' }}
    >
      <button
        onClick={onMenuClick}
        aria-label="Open menu"
        className="lg:hidden w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-all"
      >
        <Menu size={18} />
      </button>

      <Link to="/" className="flex items-center select-none hover:opacity-80 transition-opacity">
        <img src={theme === 'dark' ? '/logo-dark.png' : '/logo.png'} alt="deboistech" className="h-9 w-auto" />
      </Link>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center gap-2.5 px-3 py-2 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-all duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--accent)] flex items-center justify-center text-white text-sm font-bold">
            {initials}
          </div>
          <div className="hidden sm:block text-left min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] leading-none truncate max-w-[9rem]">{user?.full_name}</p>
          </div>
          <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
        </button>

        {dropdownOpen && (
          <div className="nav-user-dropdown absolute right-0 top-full mt-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-sm)] shadow-[var(--shadow-lg)] z-50 animate-dropdown min-w-[220px]">
            <div className="nav-user-dropdown-header border-b border-[var(--border)]">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{user?.full_name}</p>
              <p className="text-xs text-[var(--text-muted)] mt-1">{user?.email}</p>
            </div>

            <button
              onClick={toggle}
              className="nav-user-dropdown-item flex items-center justify-between w-full text-sm text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors"
            >
              <span className="flex items-center gap-3">
                {theme === 'dark' ? <Moon size={17} /> : <Sun size={17} />}
                <span>Theme</span>
              </span>
              <div
                className={`relative w-[44px] h-[24px] rounded-full transition-colors duration-200 ${theme === 'dark' ? 'bg-[var(--primary)]' : 'bg-[var(--text-muted)]'}`}
              >
                <div
                  className={`absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white transition-transform duration-200 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </div>
            </button>

            <div className="nav-user-dropdown-divider border-t border-[var(--border)]">
              <button
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate('/auth/login');
                }}
                className="nav-user-dropdown-item flex items-center gap-3 w-full text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
