import { memo, useEffect, useRef, useState, useSyncExternalStore } from 'react';
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

// Tiles per row, as slices of TILES: rows alternate cols, cols-1.
const rowsFor = (cols: number) => {
  const rows: Tile[][] = [];
  for (let at = 0, row = 0; at < TILES.length; row++) {
    const size = row % 2 ? cols - 1 : cols;
    rows.push(TILES.slice(at, at + size));
    at += size;
  }
  return rows;
};

// Electric veins behind a plucked tile. Per tile, a walk over the honeycomb corners (the gaps between cells) grows
// outward from the tile's six corners: every step is kept with a chance that falls with distance, so the veins branch and
// thin out, with hairs and bright nodes along them. Coordinates are cell widths from the tile centre. Each of the
// BUCKETS distance rings is drawn in turn (CSS), so the veins spread outward as the tile lifts and retract when it drops.
const GROW = [1, 1, 0.95, 0.85, 0.7, 0.5, 0.3];
const BUCKETS = GROW.length;
const RADIUS = 1 / Math.sqrt(3);
const rnd = (min: number, max: number) => min + Math.random() * (max - min);
const pt = (x: number, y: number) => `${+x.toFixed(3)} ${+y.toFixed(3)}`;
type Vein = { edge: string; hair: string; node: string };

const corner = (cx: number, cy: number, i: number): [number, number] => [cx + RADIUS * Math.sin((i * Math.PI) / 3), cy - RADIUS * Math.cos((i * Math.PI) / 3)];

// Every corner of every cell near the mosaic, with its neighbours; same lattice maths as the ghosts.
const makeGraph = (cols: number, rowCount: number) => {
  const xs: number[] = [];
  const ys: number[] = [];
  const adj: number[][] = [];
  const ids = new Map<string, number>();
  const id = (x: number, y: number) => {
    const key = `${x.toFixed(2)},${y.toFixed(2)}`;
    let at = ids.get(key);
    if (at === undefined) {
      at = xs.push(x) - 1;
      ys.push(y);
      adj.push([]);
      ids.set(key, at);
    }
    return at;
  };
  for (let k = -6; k < rowCount + 6; k++) {
    const cap = Math.abs(k) % 2 ? cols - 1 : cols;
    for (let slot = -8; slot < cap + 8; slot++) {
      const [cx, cy] = [slot - (cap - 1) / 2, (k - (rowCount - 1) / 2) * 0.866];
      for (let i = 0; i < 6; i++) {
        const a = id(...corner(cx, cy, i));
        const b = id(...corner(cx, cy, i + 1));
        if (!adj[a].includes(b)) {
          adj[a].push(b);
          adj[b].push(a);
        }
      }
    }
  }
  return { xs, ys, adj, id };
};

// A short curling hair, sometimes forking, thinner (shorter) the further out it grows.
const hair = (x: number, y: number, angle: number, ring: number) => {
  const step = rnd(0.05, 0.1) * (1 - ring * 0.1);
  let d = `M${pt(x, y)}`;
  let [px, py, a] = [x, y, angle];
  let fork = '';
  for (let s = 0; s < 4; s++) {
    a += rnd(-0.7, 0.7);
    px += Math.cos(a) * step;
    py += Math.sin(a) * step;
    d += `L${pt(px, py)}`;
    if (s >= 1 && Math.random() < 0.3) {
      const b = a + (Math.random() < 0.5 ? -0.8 : 0.8);
      fork += `M${pt(px, py)}L${pt(px + Math.cos(b) * step, py + Math.sin(b) * step)}L${pt(px + Math.cos(b + 0.4) * step * 1.7, py + Math.sin(b + 0.4) * step * 1.7)}`;
    }
  }
  return d + fork;
};

const makeVeins = (graph: ReturnType<typeof makeGraph>, tx: number, ty: number): Vein[] => {
  const { xs, ys, adj } = graph;
  const buckets: Vein[] = Array.from({ length: BUCKETS }, () => ({ edge: '', hair: '', node: '' }));
  const dist = new Array<number>(xs.length).fill(-1);
  const alive = new Array<boolean>(xs.length).fill(false);
  const order: number[] = [];
  for (let i = 0; i < 6; i++) {
    const at = graph.id(...corner(tx, ty, i));
    dist[at] = 0;
    alive[at] = true;
    order.push(at);
  }
  // Breadth-first: the queue grows while it is walked, so each vertex is handled after every nearer one.
  for (let q = 0; q < order.length; q++) {
    const u = order[q];
    if (dist[u] >= BUCKETS) break;
    for (const v of adj[u]) {
      if (dist[v] < 0) {
        dist[v] = dist[u] + 1;
        order.push(v);
      }
    }
  }
  for (const u of order) {
    const ring = dist[u];
    if (ring >= BUCKETS || !alive[u]) continue;
    for (const v of adj[u]) {
      if (dist[v] < ring || (dist[v] === ring && v < u) || Math.random() > GROW[ring]) continue;
      const [dx, dy] = [xs[v] - xs[u], ys[v] - ys[u]];
      const [nx, ny] = [-dy / RADIUS, dx / RADIUS];
      const sway = () => rnd(-0.018, 0.018);
      const a = Math.atan2(dy, dx);
      const bucket = buckets[ring];
      bucket.edge += `M${pt(xs[u], ys[u])}L${pt(xs[u] + dx / 3 + nx * sway(), ys[u] + dy / 3 + ny * sway())}L${pt(xs[u] + (dx * 2) / 3 + nx * sway(), ys[u] + (dy * 2) / 3 + ny * sway())}L${pt(xs[v], ys[v])}`;
      if (Math.random() < 0.6) bucket.hair += hair(xs[u] + dx / 2, ys[u] + dy / 2, a + (Math.random() < 0.5 ? -1 : 1) * rnd(0.9, 1.9), ring);
      if (alive[v]) continue;
      alive[v] = true;
      const far = buckets[Math.min(dist[v], BUCKETS - 1)];
      if (Math.random() < 0.9) {
        for (let n = Math.random() < 0.5 ? 3 : 2; n > 0; n--) far.hair += hair(xs[v], ys[v], a + rnd(-1.3, 1.3), ring);
      }
      if (Math.random() < 0.4) far.node += `M${pt(xs[v], ys[v])}h.001`;
    }
  }
  return buckets;
};

// One set of veins per tile (same order as TILES), made once per layout.
const veinCache = new Map<number, { x: number; y: number; veins: Vein[] }[]>();
const veinsFor = (cols: number) => {
  let sets = veinCache.get(cols);
  if (!sets) {
    const rows = rowsFor(cols);
    const graph = makeGraph(cols, rows.length);
    sets = rows.flatMap((row, r) => {
      const cap = r % 2 ? cols - 1 : cols;
      return row.map((_, i) => {
        const [x, y] = [i - (cap - 1) / 2, (r - (rows.length - 1) / 2) * 0.866];
        return { x, y, veins: makeVeins(graph, x, y) };
      });
    });
    veinCache.set(cols, sets);
  }
  return sets;
};

// Dark socket the tile leaves, then per ring: glow, core, hair and node paths (see the CSS for the draw).
const SOCKET = Array.from({ length: 6 }, (_, i) => corner(0, 0, i).map((n) => +(n * 0.96).toFixed(3)).join(',')).join(' ');
const Zap = memo(function Zap({ veins, x, y, on }: { veins: Vein[]; x: number; y: number; on: boolean }) {
  return (
    <svg className={clsx('hx-vein', on && 'is-on')} viewBox="-3.6 -3.6 7.2 7.2" aria-hidden style={{ '--gx': x, '--gy': y } as CSSProperties}>
      <polygon className="hx-socket" points={SOCKET} />
      {veins.map((ring, k) => (
        <g key={k} style={{ '--k': k } as CSSProperties}>
          <path className="hx-vg" d={ring.edge} />
          <path className="hx-vc" d={ring.edge} />
          <path className="hx-vh" d={ring.hair} />
          <path className="hx-vn hx-vo" d={ring.node} />
          <path className="hx-vn" d={ring.node} />
        </g>
      ))}
    </svg>
  );
});

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

  const rows = rowsFor(cols);

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

  const lit = hot ?? (term && hits.length === 1 ? hits[0] : null);

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
          {open && veinsFor(cols).map((set, i) => <Zap key={TILES[i].to} {...set} on={TILES[i] === lit} />)}
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
