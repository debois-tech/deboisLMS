import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Plus, X } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import type { Group, Leaf } from '@/components/layout/NavRail';
import { startComets } from '@/components/layout/navComets';

type Tile = Leaf & { action?: boolean };

// Tiles per long row; rows alternate n, n-1 so they interlock. Admin's 14 tiles fill 5/4/5 and 4/3/4/3 exactly.
const colsFor = (width: number) => (width < 520 ? 3 : width < 820 ? 4 : 5);
const watchResize = (notify: () => void) => {
  window.addEventListener('resize', notify);
  return () => window.removeEventListener('resize', notify);
};
const useCols = () => useSyncExternalStore(watchResize, () => colsFor(window.innerWidth), () => 5);

// Weak hardware skips the stagger and the glow; reduced-motion is handled in CSS.
const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
const LITE = (navigator.hardwareConcurrency ?? 8) <= 4 || (memory ?? 8) <= 4;

// Empty cells drawn around the tiles, fainter the further out, as if the mosaic went on and was not filled yet.
const RINGS = 3;
const GHOST_OPACITY = [0, 0.28, 0.1, 0.035];
const HEX_POINTS = '50,0 100,28.87 100,86.6 50,115.47 0,86.6 0,28.87';
const Ghost = ({ d, style }: { d: number; style?: CSSProperties }) => (
  <svg className="hx-ghost" viewBox="-1 -1 102 117.47" aria-hidden style={{ '--o': GHOST_OPACITY[d], ...style } as CSSProperties}>
    <polygon points={HEX_POINTS} />
  </svg>
);

// Tiles per row, as slices of the list: rows alternate cols, cols-1.
const rowsFor = (tiles: Tile[], cols: number) => {
  const rows: Tile[][] = [];
  for (let at = 0, row = 0; at < tiles.length; row++) {
    const size = row % 2 ? cols - 1 : cols;
    rows.push(tiles.slice(at, at + size));
    at += size;
  }
  return rows;
};

const matches = (tile: Tile, pathname: string) =>
  tile.end ? pathname === tile.to : pathname === tile.to || pathname.startsWith(`${tile.to}/`);

interface NavHexProps {
  groups: Group[];
  /** The "+ New" tile at the end; none for a role that has nothing to create. */
  newAction?: { label: string; to: string } | null;
}

// The header shows where you are; click it (or Ctrl+K) for a honeycomb of every page.
export function NavHex({ groups, newAction }: NavHexProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cols = useCols();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const mosaic = useRef<HTMLDivElement>(null);
  const sparks = useRef<HTMLCanvasElement>(null);

  // Every page as one flat mosaic, plus the "+ New" shortcut of the sidebars.
  const tiles = useMemo<Tile[]>(
    () => [...groups.flatMap((group) => group.items), ...(newAction ? [{ ...newAction, icon: Plus, action: true }] : [])],
    [groups, newAction],
  );
  const rows = useMemo(() => rowsFor(tiles, cols), [tiles, cols]);

  // The deepest match wins: /batches/new is "New Batch", not "Batches".
  const current = tiles.filter((tile) => matches(tile, pathname)).sort((a, b) => b.to.length - a.to.length)[0];
  const section = pathname.split('/').filter((part) => part && part !== 'tutor')[0];
  const here = current?.label ?? (section ? section.replace(/^./, (c) => c.toUpperCase()) : 'Menu');

  const term = query.trim().toLowerCase();
  const hits = term ? tiles.filter((tile) => tile.label.toLowerCase().includes(term)) : tiles;

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      // A phone keyboard would cover the mosaic, so only a pointer device autofocuses the search.
      if (!window.matchMedia('(hover: hover)').matches) closeButton.current?.focus();
    } else if (wasOpen.current) {
      trigger.current?.focus();
    }
    wasOpen.current = open;
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Lattice slots outside the real rows, as offsets from the centre in cell widths and row heights.
  const ghosts: { key: string; x: number; y: number; d: number }[] = [];
  for (let k = -RINGS; k < rows.length + RINGS; k++) {
    const cap = Math.abs(k) % 2 ? cols - 1 : cols;
    const dy = k < 0 ? -k : k >= rows.length ? k - rows.length + 1 : 0;
    for (let slot = -RINGS; slot < cap + RINGS; slot++) {
      if (k >= 0 && k < rows.length && slot >= 0 && slot < cap) continue;
      const dx = slot < 0 ? -slot : slot >= cap ? slot - cap + 1 : 0;
      const d = dy + Math.max(0, dx - Math.ceil(dy / 2));
      if (d <= RINGS) ghosts.push({ key: `${k}:${slot}`, x: slot - (cap - 1) / 2, y: k - (rows.length - 1) / 2, d });
    }
  }

  useEffect(() => {
    if (open && sparks.current && mosaic.current) return startComets(sparks.current, mosaic.current, cols, rows.length, LITE);
  }, [open, cols, rows.length]);

  const overlay = (
    <div
      className={clsx('nav4-ov', open && 'is-open', LITE && 'is-lite')}
      role="dialog"
      aria-modal="true"
      aria-label="Go to"
      aria-hidden={!open}
      onKeyDown={(event) => event.key === 'Escape' && close()}
      onClick={(event) => !(event.target as Element).closest('.hx-cell, .nav4-bar > *') && close()}
    >
      <div className="nav4-bar">
        <span />
        {open && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!hits[0]) return;
              navigate(hits[0].to);
              close();
            }}
          >
            <SearchBar value={query} onChange={setQuery} placeholder="Search" autoFocus={window.matchMedia('(hover: hover)').matches} />
          </form>
        )}
        <button ref={closeButton} type="button" className="nav4-close" onClick={close} aria-label="Close"><X size={20} /></button>
      </div>

      <div ref={mosaic} className="nav4-mosaic" style={{ '--n': cols, '--r': rows.length } as CSSProperties}>
        <div className="nav4-lattice" aria-hidden>
          {ghosts.map((ghost) => (
            <Ghost key={ghost.key} d={ghost.d} style={{ '--gx': ghost.x, '--gy': ghost.y } as CSSProperties} />
          ))}
        </div>
        {rows.map((row, r) => (
          <div key={r} className="nav4-row">
            {row.map((tile) => {
              const Icon = tile.icon;
              const hit = hits.includes(tile);
              return (
                <div
                  key={tile.to}
                  className={clsx('hx-cell', term && (hit ? 'is-hit' : 'is-dim'), term && hit && hits.length === 1 && 'is-solo')}
                  style={{ '--i': tiles.indexOf(tile) } as CSSProperties}
                >
                  <Link
                    to={tile.to}
                    onClick={close}
                    tabIndex={term && !hit ? -1 : 0}
                    aria-current={tile === current ? 'page' : undefined}
                    className={clsx('hx', tile === current && 'is-current', tile.action && 'is-action')}
                  >
                    <span className="hx-face">
                      <span className="hx-in">
                        <Icon />
                        <span>{tile.label}</span>
                      </span>
                    </span>
                  </Link>
                </div>
              );
            })}
            {/* A short last row keeps its place in the lattice instead of re-centring. */}
            {Array.from({ length: (r % 2 ? cols - 1 : cols) - row.length }, (_, at) => <Ghost key={`fill${at}`} d={1} />)}
          </div>
        ))}
        {term && hits.length === 0 && <p className="nav4-empty">No match</p>}
      </div>
      <canvas ref={sparks} className="nav4-sparks" aria-hidden />
    </div>
  );

  return (
    <>
      <button ref={trigger} type="button" className="nav4-now" onClick={() => setOpen(true)} aria-haspopup="dialog" title="Go to (Ctrl K)">
        {here}
      </button>
      {createPortal(overlay, document.body)}
    </>
  );
}
