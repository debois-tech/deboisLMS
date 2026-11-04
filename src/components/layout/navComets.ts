// Comets for the mosaic overlay: a few bright heads with continuous tails creep along the honeycomb edges,
// leave the screen and come back in on the far side, like a snake in the old game. One canvas, no DOM per comet.
const R = 0.5774; // an edge's length, in cell widths
const RAD = Math.PI / 180;
const CORNERS: [number, number][] = [[0, -R], [0.5, -R / 2], [0.5, R / 2], [0, R], [-0.5, R / 2], [-0.5, -R / 2]];

const SPEED = 1; // cell widths per second
const TAIL = 1.8; // cell widths

interface Comet {
  verts: [number, number][]; // the last vertices it passed, oldest first
  up: boolean; // an "up" vertex has edges at 30, 150 and 270 degrees; a "down" one at 90, 210 and 330
  ang: number; // heading of the edge it is on
  back: number; // the way it came, never taken
  t: number; // distance along the current edge
  pref: number; // the heading it tries to keep, which drifts so the route wanders
  steps: number;
  age: number;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.trim().replace('#', ''), 16);
  return Number.isNaN(n) ? [52, 211, 153] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Starts the animation; the returned function stops it. */
export function startComets(canvas: HTMLCanvasElement, mosaic: HTMLElement, cols: number, rowCount: number, lite: boolean): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const samples = lite ? 14 : 28;
  const [cr, cg, cb] = rgb(getComputedStyle(canvas).getPropertyValue('--comet') || '#34d399');
  let w = 0, h = 0, dpr = 1, p = 1, cx = 0, cy = 0, W = 0, H = 0;

  const measure = () => {
    const box = canvas.getBoundingClientRect();
    w = box.width;
    h = box.height;
    dpr = Math.min(window.devicePixelRatio || 1, lite ? 1 : 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const cell = mosaic.querySelector<HTMLElement>('.hx-cell');
    p = (cell?.offsetWidth ?? 150) + (cell ? parseFloat(getComputedStyle(cell).marginLeft) * 2 : 6);
    const m = mosaic.getBoundingClientRect();
    cx = m.left - box.left + m.width / 2;
    cy = m.top - box.top + m.height / 2;
    // The honeycomb repeats every whole cell across and every even number of rows down, so wrapping by those
    // keeps a comet on the edges. Wide enough that the seam is well off screen.
    W = Math.ceil((2 * Math.max(cx, w - cx)) / p) + 4;
    const rows = Math.ceil((2 * Math.max(cy, h - cy)) / (p * 0.866)) + 4;
    H = (rows + (rows % 2)) * 0.866;
  };
  measure();
  window.addEventListener('resize', measure);

  const wrap = (v: number, size: number) => ((((v + size / 2) % size) + size) % size) - size / 2;

  const turn = (c: Comet) => {
    const options = (c.up ? [30, 150, 270] : [90, 210, 330]).filter((a) => a !== c.back);
    const off = (a: number) => Math.abs((((a - c.pref + 540) % 360) + 360) % 360 - 180);
    options.sort((a, b) => off(a) - off(b));
    c.ang = Math.random() < 0.75 ? options[0] : options[1];
    c.back = (c.ang + 180) % 360;
    if (++c.steps % 14 === 0) c.pref = (c.pref + (Math.random() < 0.5 ? 60 : -60) + 360) % 360;
  };

  const spawn = (): Comet => {
    const row = Math.floor(Math.random() * rowCount);
    const cap = row % 2 ? cols - 1 : cols;
    const x = Math.floor(Math.random() * cap) - (cap - 1) / 2;
    const y = (row - (rowCount - 1) / 2) * 0.866;
    const corner = Math.floor(Math.random() * 6);
    const comet: Comet = {
      verts: [[x + CORNERS[corner][0], y + CORNERS[corner][1]]],
      up: corner % 2 === 0,
      ang: 0,
      back: -1,
      t: 0,
      pref: Math.floor(Math.random() * 6) * 60,
      steps: 0,
      age: 0,
    };
    turn(comet);
    return comet;
  };
  const comets = Array.from({ length: lite ? 2 : 4 }, spawn);
  const keep = Math.ceil(TAIL / R) + 3;

  const advance = (c: Comet, dt: number) => {
    c.t += SPEED * dt;
    c.age += dt;
    while (c.t >= R) {
      c.t -= R;
      const last = c.verts[c.verts.length - 1];
      c.verts.push([last[0] + R * Math.cos(c.ang * RAD), last[1] + R * Math.sin(c.ang * RAD)]);
      if (c.verts.length > keep) c.verts.shift();
      c.up = !c.up;
      turn(c);
    }
  };

  // Points back along the route from the head, evenly spaced over the tail's length.
  const trail = (c: Comet): [number, number][] => {
    const last = c.verts[c.verts.length - 1];
    const chain: [number, number][] = [[last[0] + c.t * Math.cos(c.ang * RAD), last[1] + c.t * Math.sin(c.ang * RAD)], ...[...c.verts].reverse()];
    const lens = chain.slice(1).map((pt, i) => Math.hypot(pt[0] - chain[i][0], pt[1] - chain[i][1]));
    const out: [number, number][] = [];
    let seg = 0;
    let done = 0;
    for (let j = 0; j <= samples; j++) {
      const s = (j * TAIL) / samples;
      while (seg < lens.length - 1 && done + lens[seg] < s) done += lens[seg++];
      const f = lens[seg] ? Math.min(1, Math.max(0, (s - done) / lens[seg])) : 1;
      out.push([chain[seg][0] + (chain[seg + 1][0] - chain[seg][0]) * f, chain[seg][1] + (chain[seg + 1][1] - chain[seg][1]) * f]);
    }
    return out;
  };

  let raf = 0;
  let before = performance.now();
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - before) / 1000);
    before = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = 'butt'; // round caps would double up where segments meet and show as beads
    ctx.globalCompositeOperation = 'lighter';

    for (const c of comets) {
      advance(c, dt);
      const rise = Math.min(1, c.age / 1.2);
      const pts = trail(c).map(([x, y]) => {
        const X = cx + wrap(x, W) * p;
        const Y = cy + wrap(y, H) * p;
        // Fades out toward every screen edge, so it slips away rather than vanishing.
        const fade = Math.min(1, Math.max(0, Math.min(X, w - X, Y, h - Y) / (p * 1.4)));
        return { X, Y, fade };
      });
      for (let j = 0; j < pts.length - 1; j++) {
        const a = pts[j];
        const b = pts[j + 1];
        if (Math.abs(b.X - a.X) > (W * p) / 2 || Math.abs(b.Y - a.Y) > (H * p) / 2) continue; // across the seam
        const f = j / samples;
        const alpha = (1 - f) ** 1.6 * Math.min(a.fade, b.fade) * rise;
        if (alpha < 0.01) continue;
        const width = Math.max(0.8, p * 0.014 * (1 - f * 0.8));
        ctx.beginPath();
        ctx.moveTo(a.X, a.Y);
        ctx.lineTo(b.X, b.Y);
        ctx.lineWidth = width * 4;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha * 0.16})`;
        ctx.stroke();
        ctx.lineWidth = width;
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.stroke();
      }
      const head = pts[0];
      const strength = head.fade * rise;
      if (strength > 0.01) {
        const glow = ctx.createRadialGradient(head.X, head.Y, 0, head.X, head.Y, p * 0.05);
        glow.addColorStop(0, `rgba(${cr},${cg},${cb},${0.5 * strength})`);
        glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(head.X, head.Y, p * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(234,255,246,${strength})`;
        ctx.beginPath();
        ctx.arc(head.X, head.Y, Math.max(1.4, p * 0.011), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', measure);
    ctx.clearRect(0, 0, w, h);
  };
}
