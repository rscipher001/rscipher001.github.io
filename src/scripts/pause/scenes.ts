// Nature scenes for the pause page, drawn on a canvas. Each visit gets a new one.
import { makeGarden } from '../../lib/garden';

export type Period = 'morning' | 'day' | 'evening' | 'night';
export type SceneName = 'mountains' | 'pond' | 'garden';
export const SCENES: SceneName[] = ['mountains', 'pond', 'garden'];

export interface Palette {
  dark: boolean;
  skyTop: string;
  skyHorizon: string;
  far: string;
  near: string;
  mist: string;
  glow: string;
  water: string;
  ripple: string;
  ground: string;
  ink: string;
  inkSoft: string;
  rake: string;
  stone: string;
  stoneLight: string;
}

const light = { dark: false, ink: '#262b22', inkSoft: '#596150', rake: '#cdd2c3', stone: '#a1a697', stoneLight: '#c9cdbf' };

export const PALETTES: Record<Period, Palette> = {
  morning: {
    ...light,
    skyTop: '#dde2df',
    skyHorizon: '#f1e8df',
    far: '#d3d4ce',
    near: '#7c8574',
    mist: 'rgba(243, 239, 233, 0.6)',
    glow: '#f6e8d6',
    water: '#dfe3dd',
    ripple: 'rgba(80, 92, 76, 0.32)',
    ground: '#edefe7',
  },
  day: {
    ...light,
    skyTop: '#d9e1dc',
    skyHorizon: '#eef0e9',
    far: '#c8cec2',
    near: '#6c7863',
    mist: 'rgba(240, 242, 235, 0.6)',
    glow: '#f7f6ef',
    water: '#d9e0d8',
    ripple: 'rgba(70, 86, 66, 0.3)',
    ground: '#edefe7',
  },
  evening: {
    ...light,
    skyTop: '#d0d4d4',
    skyHorizon: '#eedfd2',
    far: '#c2bbba',
    near: '#58604f',
    mist: 'rgba(236, 228, 220, 0.55)',
    glow: '#f2d9c1',
    water: '#d6d8d1',
    ripple: 'rgba(70, 76, 64, 0.3)',
    ground: '#eae9e2',
  },
  night: {
    dark: true,
    skyTop: '#0e1416',
    skyHorizon: '#1b2427',
    far: '#263030',
    near: '#111714',
    mist: 'rgba(32, 42, 42, 0.55)',
    glow: '#dfe4d8',
    water: '#141c1d',
    ripple: 'rgba(205, 222, 212, 0.2)',
    ground: '#161b17',
    ink: '#d9decf',
    inkSoft: '#a2aa96',
    rake: '#2a3229',
    stone: '#3a4237',
    stoneLight: '#566050',
  },
};

export function periodOf(date: Date): Period {
  const h = date.getHours();
  if (h >= 5 && h < 10) return 'morning';
  if (h >= 10 && h < 17) return 'day';
  if (h >= 17 && h < 22) return 'evening';
  return 'night';
}

type Rand = () => number;

/** Smooth 1D value noise with a few octaves: gentle ridgelines and treelines. */
function noise1d(rand: Rand, octaves: number) {
  const tables = Array.from({ length: octaves }, () => Array.from({ length: 256 }, rand));
  return (x: number) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      const f = x * 2 ** o;
      const i = Math.floor(f);
      const t = f - i;
      const s = (1 - Math.cos(t * Math.PI)) / 2;
      const table = tables[o];
      sum += amp * (table[i & 255] * (1 - s) + table[(i + 1) & 255] * s);
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

function sky(ctx: CanvasRenderingContext2D, w: number, p: Palette, bottom: number) {
  const g = ctx.createLinearGradient(0, 0, 0, bottom);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(1, p.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, bottom);
}

function sunOrMoon(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, rand: Rand, maxY: number) {
  const r = Math.min(w, h) * 0.035;
  const x = w * (0.58 + rand() * 0.28);
  const y = Math.min(maxY, h * (0.14 + rand() * 0.14));
  const halo = ctx.createRadialGradient(x, y, r, x, y, r * 7);
  halo.addColorStop(0, p.glow + (p.dark ? '30' : '70'));
  halo.addColorStop(1, p.glow + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, r * 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.glow + (p.dark ? 'e6' : 'cc');
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, rand: Rand, maxY: number) {
  const count = Math.round((w * h) / 14000);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(225, 232, 220, ${0.15 + rand() * 0.45})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * maxY, rand() * 0.9 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(', ')})`;
};

/** Ridge after ridge, each nearer one darker, with mist pooling in the valleys. */
function mountains(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, rand: Rand) {
  sky(ctx, w, p, h);
  if (p.dark) stars(ctx, w, h, rand, h * 0.45);
  sunOrMoon(ctx, w, h, p, rand, h * 0.3);

  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const base = h * (0.42 + t * 0.18);
    const amp = h * (0.22 - t * 0.12);
    const n = noise1d(rand, 5);
    const scale = 2.2 + t * 2.5;
    const offset = rand() * 200;

    ctx.fillStyle = mix(p.far, p.near, t ** 1.2);
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w + 4; x += 4) {
      // Sharpen the noise into peaks and saddles rather than a gentle swell.
      const v = n(offset + (x / w) * scale);
      const y = base - amp * Math.max(0, v - 0.2) ** 1.4 * 1.9;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Mist rising from the valley behind the next ridge.
    if (i < layers - 1) {
      const mist = ctx.createLinearGradient(0, base - amp * 0.6, 0, base + h * 0.06);
      // Fade from the mist's own colour at zero opacity; transparent black would leave a grey band.
      mist.addColorStop(0, p.mist.replace(/[\d.]+\)$/, '0)'));
      mist.addColorStop(1, p.mist);
      ctx.fillStyle = mist;
      ctx.fillRect(0, base - amp * 0.6, w, amp * 0.6 + h * 0.06);
    }
  }
}

/** A still pond with a far shore; rain lands and spreads in slow rings. */
function pond(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, rand: Rand) {
  const shore = h * (0.3 + rand() * 0.06);
  sky(ctx, w, p, shore);
  if (p.dark) stars(ctx, w, h, rand, shore * 0.8);
  sunOrMoon(ctx, w, h, p, rand, shore * 0.55);

  // Distant treeline and its soft reflection.
  const n = noise1d(rand, 6);
  const offset = rand() * 100;
  const tree = (x: number) => h * 0.05 * (0.35 + n(offset + (x / w) * 9));
  ctx.fillStyle = p.far;
  ctx.beginPath();
  ctx.moveTo(0, shore);
  for (let x = 0; x <= w + 3; x += 3) ctx.lineTo(x, shore - tree(x));
  ctx.lineTo(w, shore);
  ctx.closePath();
  ctx.fill();

  const water = ctx.createLinearGradient(0, shore, 0, h);
  water.addColorStop(0, mix(p.far, p.water, 0.6));
  water.addColorStop(0.25, p.water);
  water.addColorStop(1, p.water);
  ctx.fillStyle = water;
  ctx.fillRect(0, shore, w, h - shore);

  // Faint glints on the water, packed closer near the far shore.
  for (let i = 0; i < 90; i++) {
    const depth = rand() ** 2;
    const y = shore + 6 + depth * (h * 0.6 - shore);
    const len = (12 + rand() * 60) * (0.4 + depth);
    const x = rand() * w;
    ctx.strokeStyle = p.dark ? 'rgba(210, 225, 215, 0.06)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = p.far;
  ctx.beginPath();
  ctx.moveTo(0, shore);
  for (let x = 0; x <= w + 3; x += 3) ctx.lineTo(x, shore + tree(x) * 0.7);
  ctx.lineTo(w, shore);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  return shore;
}

/** A raked dry garden, the same generator the rest of the site uses. */
function garden(ctx: CanvasRenderingContext2D, w: number, h: number, p: Palette, seed: string) {
  ctx.fillStyle = p.ground;
  ctx.fillRect(0, 0, w, h);
  const m = Math.min(w, h);
  const area = h * 0.72;
  const g = makeGarden({
    seed,
    width: w,
    height: area,
    stones: [(0.13 * m) / area, (0.06 * m) / area, (0.035 * m) / area],
    gap: Math.max(9, m / 70),
    zone: [0.12, 0.88],
  });

  ctx.lineWidth = 1;
  ctx.lineCap = 'round';
  ctx.strokeStyle = p.rake;
  for (const d of g.lines) ctx.stroke(new Path2D(d));
  for (const stone of g.stones) {
    ctx.fillStyle = p.ground;
    ctx.fill(new Path2D(stone.clearingPath));
    for (const d of stone.rings) ctx.stroke(new Path2D(d));
    const grad = ctx.createLinearGradient(stone.cx - stone.r * 0.6, stone.cy - stone.r, stone.cx + stone.r * 0.5, stone.cy + stone.r);
    grad.addColorStop(0, p.stoneLight);
    grad.addColorStop(1, p.stone);
    ctx.fillStyle = grad;
    ctx.fill(new Path2D(stone.body));
  }
}

interface Drop {
  x: number;
  y: number;
  born: number;
  size: number;
}

/**
 * Draws a scene into the canvas, sized to the window. Returns a function that stops any animation.
 * The rain on the pond is the only motion, and it stays still when reduced motion is preferred.
 */
export function paint(canvas: HTMLCanvasElement, name: SceneName, p: Palette, seed: string, still: boolean): () => void {
  const ctx = canvas.getContext('2d')!;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  // Size from the element itself, so the drawing is never stretched to fit.
  const rect = canvas.getBoundingClientRect();
  const w = rect.width || window.innerWidth;
  const h = rect.height || window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let seedNumber = 0;
  for (const ch of seed) seedNumber = (seedNumber * 31 + ch.charCodeAt(0)) >>> 0;
  let state = seedNumber || 1;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };

  if (name === 'mountains') {
    mountains(ctx, w, h, p, rand);
    return () => {};
  }
  if (name === 'garden') {
    garden(ctx, w, h, p, seed);
    return () => {};
  }

  // The pond: paint the still water once, then draw rain on top of a copy of it.
  const shore = pond(ctx, w, h, p, rand);
  const base = document.createElement('canvas');
  base.width = canvas.width;
  base.height = canvas.height;
  base.getContext('2d')!.drawImage(canvas, 0, 0);

  const drops: Drop[] = [];
  const life = 3200;
  const spread = Math.min(w, h) * 0.11;
  const ring = (d: Drop, now: number) => {
    for (let k = 0; k < 3; k++) {
      const t = (now - d.born - k * 260) / life;
      if (t <= 0 || t >= 1) continue;
      const depth = (d.y - shore) / (h - shore);
      const rx = spread * d.size * Math.sqrt(t);
      ctx.globalAlpha = (1 - t) ** 1.6 * (1 - k * 0.25);
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, rx, rx * (0.16 + depth * 0.3), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const spawn = (now: number) => {
    const y = shore + (h * 0.62 - shore) * (0.08 + rand() * 0.92);
    drops.push({ x: rand() * w, y, born: now, size: 0.6 + rand() * 0.6 });
  };

  ctx.strokeStyle = p.ripple;
  ctx.lineWidth = 1;

  if (still) {
    for (let i = 0; i < 7; i++) {
      spawn(0);
      ring(drops[i], life * (0.15 + rand() * 0.5));
    }
    return () => {};
  }

  let frame = 0;
  let nextDrop = 0;
  const tick = (now: number) => {
    if (now >= nextDrop) {
      spawn(now);
      nextDrop = now + 350 + rand() * 1100;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(base, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = p.ripple;
    for (let i = drops.length - 1; i >= 0; i--) {
      if (now - drops[i].born > life + 600) drops.splice(i, 1);
      else ring(drops[i], now);
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(frame);
}
