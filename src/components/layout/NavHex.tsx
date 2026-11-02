import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import { Plus, X } from 'lucide-react';
import { SearchBar } from '@/components/ui/SearchBar';
import { GROUPS, type Leaf } from '@/components/layout/NavRail';
import { startComets } from '@/components/layout/navComets';

type Tile = Leaf & { action?: boolean };

// Every page as one flat mosaic, plus the bottom "+ New Batch" shortcut of the sidebars.
const TILES: Tile[] = [
  ...GROUPS.flatMap((group) => group.items),
  { label: 'New Batch', to: '/batches/new', icon: Plus, action: true },
];

// Tiles per long row; rows alternate n, n-1 so they interlock. 14 tiles fill 5/4/5 and 4/3/4/3 exactly.
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

// Electric static behind a hovered tile: three sets of strands bursting out in every direction, shown one at a
// time every ~80ms so the burst crackles in place. The tiles above it hide most of it; it shows in the socket the
// tile left and through the gaps, which only implies the connection.
const STRANDS = 22;
const strand = (ox: number, oy: number, angle: number, from: number, to: number) => {
  const [ux, uy] = [Math.cos(angle), Math.sin(angle)];
  let d = '';
  for (let r = from, k = 0; r < to; r += 6 + Math.random() * 6, k++) {
    const kink = (Math.random() - 0.5) * 8;
    d += `${k ? 'L' : 'M'}${(ox + ux * r - uy * kink).toFixed(1)} ${(oy + uy * r + ux * kink).toFixed(1)}`;
  }
  return d;
};
const ZAP_SETS = Array.from({ length: 3 }, () => {
  let d = '';
  for (let i = 0; i < STRANDS; i++) {
    const angle = ((i + (Math.random() - 0.5) * 0.6) / STRANDS) * 2 * Math.PI;
    d += strand(0, 0, angle, 26, 85 + Math.random() * 45);
    for (let fork = 0; fork < 2; fork++) {
      if (Math.random() < 0.6) {
        const at = 36 + Math.random() * 40;
        d += strand(Math.cos(angle) * at, Math.sin(angle) * at, angle + (Math.random() < 0.5 ? -0.45 : 0.45), 0, 12 + Math.random() * 20);
      }
    }
  }
  return d;
});
const Zap = ({ x, y }: { x: number; y: number }) => (
  <svg className="hx-zap" viewBox="-100 -115.47 200 230.94" aria-hidden style={{ '--gx': x, '--gy': y } as CSSProperties}>
    <polygon className="hx-socket" points="0,-57.74 50,-28.87 50,28.87 0,57.74 -50,28.87 -50,-28.87" />
    {ZAP_SETS.map((d, i) => (
      <g key={i} className="hx-zap-set">
        <path className="hx-zap-glow" d={d} />
        <path className="hx-zap-mid" d={d} />
        <path className="hx-zap-core" d={d} />
      </g>
    ))}
  </svg>
);

const matches = (tile: Tile, pathname: string) =>
  tile.end ? pathname === tile.to : pathname === tile.to || pathname.startsWith(`${tile.to}/`);

// Option 4: the header shows where you are; click it (or Ctrl+K) for a honeycomb of every page.
export function NavHex() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const cols = useCols();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hot, setHot] = useState<Tile | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const mosaic = useRef<HTMLDivElement>(null);
  const sparks = useRef<HTMLCanvasElement>(null);

  // The deepest match wins: /batches/new is "New Batch", not "Batches".
  const current = TILES.filter((tile) => matches(tile, pathname)).sort((a, b) => b.to.length - a.to.length)[0];
  const here = current?.label ?? pathname.split('/')[1]?.replace(/^./, (c) => c.toUpperCase()) ?? 'Menu';

  const term = query.trim().toLowerCase();
  const hits = term ? TILES.filter((tile) => tile.label.toLowerCase().includes(term)) : TILES;

  const close = () => {
    setOpen(false);
    setQuery('');
    setHot(null);
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

  const rows: Tile[][] = [];
  for (let at = 0, row = 0; at < TILES.length; row++) {
    const size = row % 2 ? cols - 1 : cols;
    rows.push(TILES.slice(at, at + size));
    at += size;
  }

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

  // Where each tile sits in the lattice, in cell widths and row heights from the centre; the zap goes behind the lit one.
  const sits = new Map<Tile, [number, number]>();
  rows.forEach((row, r) => {
    const cap = r % 2 ? cols - 1 : cols;
    row.forEach((tile, i) => sits.set(tile, [i - (cap - 1) / 2, r - (rows.length - 1) / 2]));
  });
  const lit = hot ?? (term && hits.length === 1 ? hits[0] : null);
  const litAt = lit && sits.get(lit);

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
          {litAt && <Zap key={lit.to} x={litAt[0]} y={litAt[1]} />}
        </div>
        {rows.map((row, r) => (
          <div key={r} className="nav4-row">
            {row.map((tile) => {
              const Icon = tile.icon;
              const hit = hits.includes(tile);
              const i = TILES.indexOf(tile);
              return (
                <div
                  key={tile.to}
                  className={clsx('hx-cell', term && (hit ? 'is-hit' : 'is-dim'), term && hit && hits.length === 1 && 'is-solo')}
                  style={{ '--i': i } as CSSProperties}
                >
                  <Link
                    to={tile.to}
                    onClick={close}
                    onMouseEnter={() => setHot(tile)}
                    onMouseLeave={() => setHot(null)}
                    onFocus={() => setHot(tile)}
                    onBlur={() => setHot(null)}
                    onPointerDown={() => setHot(null)}
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
