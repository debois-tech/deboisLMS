import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { NavRail, type Group } from '@/components/layout/NavRail';
import { NavHex } from '@/components/layout/NavHex';
import { Spinner } from '@/components/ui/Spinner';

type Mode = 'rail' | 'mosaic';
const MODE_KEY = 'nav-mode';
const RAIL_KEY = 'nav-rail';

// Choices live in this browser; blocked storage just means they last the visit.
const remembered = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage blocked.
  }
};

interface NavShellProps {
  groups: Group[];
  newAction?: { label: string; to: string } | null;
  homePath?: string;
  themeToggle?: boolean;
}

// The signed-in shell for admin and tutor: header, a navigation the user picks (icon rail or mosaic), and the page.
export function NavShell({ groups, newAction, homePath, themeToggle }: NavShellProps) {
  const { pathname } = useLocation();
  const [mode, setMode] = useState<Mode>(() => (remembered(MODE_KEY, 'mosaic') === 'rail' ? 'rail' : 'mosaic'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Rail mode: icons only unless the user widened it.
  const [icons, setIcons] = useState(() => remembered(RAIL_KEY, 'icons') !== 'wide');

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const choose = (next: Mode) => {
    setMode(next);
    setDrawerOpen(false);
    remember(MODE_KEY, next);
  };
  const toggleIcons = () => {
    setIcons(!icons);
    remember(RAIL_KEY, icons ? 'wide' : 'icons');
  };

  const switcher = (
    <div className="nav-switch" role="group" aria-label="Navigation style">
      {(['rail', 'mosaic'] as const).map((value) => (
        <button key={value} type="button" aria-pressed={mode === value} onClick={() => choose(value)}>
          {value === 'rail' ? 'Rail' : 'Mosaic'}
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar
        homePath={homePath}
        themeToggle={themeToggle}
        onMenuClick={mode === 'rail' ? () => setDrawerOpen(true) : undefined}
        center={mode === 'mosaic' ? <NavHex groups={groups} newAction={newAction} /> : undefined}
        switcher={switcher}
      />
      <div className="app-shell">
        {mode === 'rail' && (
          <NavRail groups={groups} newAction={newAction} open={drawerOpen} collapsed={icons} onClose={() => setDrawerOpen(false)} onToggle={toggleIcons} />
        )}
        <main key={pathname} className="app-content animate-fade-in">
          {/* The page loads in here, so a first visit never blanks the navigation. */}
          <Suspense fallback={<Spinner centered />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
