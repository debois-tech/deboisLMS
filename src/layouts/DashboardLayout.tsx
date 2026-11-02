import { Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from '@/components/layout/Navbar';
import { NavRail } from '@/components/layout/NavRail';
import { NavHex } from '@/components/layout/NavHex';
import { Sidebar } from '@/components/layout/Sidebar';
import { Spinner } from '@/components/ui/Spinner';

const RAIL_KEY = 'admin-nav-rail';
const VARIANT_KEY = 'admin-nav-variant';

// The mosaic (4) is the live nav. The others are kept aside: open any admin page with ?nav=old or ?nav=2 to see one, ?nav=4 to return.
type Variant = 'old' | '2' | '4';
const isVariant = (value: string | null): value is Variant => value === 'old' || value === '2' || value === '4';
function readVariant(): Variant {
  const asked = new URLSearchParams(window.location.search).get('nav');
  try {
    if (isVariant(asked)) localStorage.setItem(VARIANT_KEY, asked);
    const saved = isVariant(asked) ? asked : localStorage.getItem(VARIANT_KEY);
    return isVariant(saved) ? saved : '4';
  } catch {
    return isVariant(asked) ? asked : '4';
  }
}

// Temporary showcase switch: reloads on the other nav (the URL flag wins over the saved choice, so it is rewritten).
function VariantSwitch({ variant }: { variant: Variant }) {
  const go = (next: Variant) => {
    const url = new URL(window.location.href);
    url.searchParams.set('nav', next);
    window.location.assign(url.toString());
  };
  return (
    <div className="nav-demo" role="group" aria-label="Navigation style">
      {([['2', 'Rail'], ['4', 'Mosaic']] as const).map(([value, label]) => (
        <button key={value} type="button" aria-pressed={variant === value} onClick={() => variant !== value && go(value)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export default function DashboardLayout() {
  const { pathname } = useLocation();
  const [variant] = useState(readVariant);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Option 2: icon rail unless the admin widened it; the choice is remembered in this browser.
  const [rail, setRail] = useState(() => {
    try {
      return localStorage.getItem(RAIL_KEY) !== 'wide';
    } catch {
      return true;
    }
  });
  // Original sidebar, untouched: its own collapse state.
  const [oldCollapsed, setOldCollapsed] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const toggleRail = () => {
    setRail(!rail);
    try {
      localStorage.setItem(RAIL_KEY, rail ? 'wide' : 'rail');
    } catch {
      // Storage blocked: the choice just lasts this visit.
    }
  };

  const toggleOld = () => {
    if (window.innerWidth < 1024) {
      setOldCollapsed(false);
      setSidebarOpen((open) => !open);
      return;
    }
    setOldCollapsed((collapsed) => !collapsed);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <Navbar
        onMenuClick={
          variant === '4'
            ? undefined
            : () => {
                setOldCollapsed(false);
                setSidebarOpen(true);
              }
        }
        center={variant === '4' ? <NavHex /> : undefined}
        demo={<VariantSwitch variant={variant} />}
      />
      <div className="app-shell">
        {variant === 'old' && (
          <Sidebar open={sidebarOpen} collapsed={oldCollapsed} onClose={() => setSidebarOpen(false)} onToggle={toggleOld} />
        )}
        {variant === '2' && (
          <NavRail open={sidebarOpen} collapsed={rail} onClose={() => setSidebarOpen(false)} onToggle={toggleRail} />
        )}
        <main key={pathname} className="app-content animate-fade-in">
          {/* The page loads in here, so a first visit never blanks the sidebar. */}
          <Suspense fallback={<Spinner centered />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
