// Nature scenes for the pause page, drawn on a canvas. Each visit gets a new one, and it breathes:
// slowly on its own, and in time with the breathing guide while that runs.
import { makeGarden } from '../../lib/garden';
import { flyBirds } from './birds';

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


/** How full the scene's breath is at a moment (in performance.now() time): 0 = empty, 1 = full. */
export type BreathAt = (now: number) => number;

interface Scene {
  /** Draws one frame. */
  frame: (now: number) => void;
  /** Milliseconds between frames: drifting ridges need few, falling rain more. */
  interval: number;
  /** The band of sky birds keep to, in scenes that have one, and where the sun or moon is. */
  sky?: { top: number; bottom: number; glow: { y: number; reach: number } };
}

interface Stage {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  p: Palette;
  rand: Rand;
  breath: BreathAt;
  still: boolean;
}

/** Paints what never moves once, at full resolution, to be copied into every frame. */
function bake(s: Stage, draw: (ctx: CanvasRenderingContext2D) => void) {
  const layer = document.createElement('canvas');
  layer.width = s.ctx.canvas.width;
  layer.height = s.ctx.canvas.height;
  const ctx = layer.getContext('2d')!;
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  draw(ctx);
  return layer;
}

function copy(s: Stage, layer: HTMLCanvasElement) {
  s.ctx.setTransform(1, 0, 0, 1, 0, 0);
  s.ctx.drawImage(layer, 0, 0);
  s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
}

/**
 * Wraps a frame so that, after the first, it only repaints the band where anything moves; above
 * and below it the canvas keeps what the first frame drew.
 */
function within(s: Stage, top: number, bottom: number, draw: (now: number) => void) {
  let first = true;
  return (now: number) => {
    s.ctx.save();
    if (!first) {
      s.ctx.beginPath();
      s.ctx.rect(0, Math.floor(top), s.w, Math.ceil(bottom - top));
      s.ctx.clip();
    }
    first = false;
    draw(now);
    s.ctx.restore();
  };
}

function sky(ctx: CanvasRenderingContext2D, w: number, p: Palette, bottom: number) {
  const g = ctx.createLinearGradient(0, 0, 0, bottom);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(1, p.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, bottom);
}

interface Sun {
  x: number;
  y: number;
  r: number;
}

function placeSun(w: number, h: number, rand: Rand, maxY: number): Sun {
  const r = Math.min(w, h) * 0.035;
  return { x: w * (0.58 + rand() * 0.28), y: Math.min(maxY, h * (0.14 + rand() * 0.14)), r };
}

function drawSun(ctx: CanvasRenderingContext2D, { x, y, r }: Sun, p: Palette) {
  const reach = r * 7;
  const halo = ctx.createRadialGradient(x, y, r, x, y, reach);
  halo.addColorStop(0, p.glow + (p.dark ? '30' : '70'));
  halo.addColorStop(1, p.glow + '00');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, reach, 0, Math.PI * 2);
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

/**
 * Birds are silhouettes, darker than anything behind them, so they stand out most against the sun
 * or moon. By day they take the tone of the ridges at their distance; at night they're nearly
 * black, faint against the dark sky and clear against the moon and its glow.
 */
const birdColour = (p: Palette) => (depth: number) =>
  p.dark ? mix(p.near, '#000000', 0.3 + depth * 0.3) : mix(p.far, p.near, 0.45 + depth * 0.35);

/**
 * A band of valley mist, thicker in places and thinner in others, baked into a strip as wide as the
 * screen whose two ends match, so laid end to end it can drift sideways for ever.
 */
function mistStrip(s: Stage, height: number, colour: string, rand: Rand) {
  const strip = document.createElement('canvas');
  strip.width = Math.ceil(s.w * s.dpr);
  strip.height = Math.ceil(height * s.dpr);
  const c = strip.getContext('2d')!;
  c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  // Rising from the valley floor: fade from the mist's own colour at zero opacity, since
  // transparent black would leave a grey band.
  const rising = c.createLinearGradient(0, 0, 0, height);
  rising.addColorStop(0, colour.replace(/[\d.]+\)$/, '0)'));
  rising.addColorStop(1, colour);
  c.fillStyle = rising;
  c.fillRect(0, 0, s.w, height);
  // Then thin it in patches: a few slow waves, each a whole number of cycles across the strip.
  const waves = [1, 2, 3, 5].map((k) => ({ k, phase: rand() * Math.PI * 2, weight: 1 / k }));
  const total = waves.reduce((sum, wave) => sum + wave.weight, 0);
  const across = c.createLinearGradient(0, 0, s.w, 0);
  for (let i = 0; i <= 48; i++) {
    const u = i / 48;
    const v = waves.reduce((sum, wave) => sum + wave.weight * Math.sin(2 * Math.PI * wave.k * u + wave.phase), 0) / total;
    across.addColorStop(u, `rgba(0, 0, 0, ${(0.78 + 0.22 * v).toFixed(3)})`);
  }
  c.globalCompositeOperation = 'destination-in';
  c.fillStyle = across;
  c.fillRect(0, 0, s.w, height);
  return strip;
}

/** Ridge after ridge, each nearer one darker, with mist pooling and drifting in the valleys. */
function mountains(s: Stage): Scene {
  const { ctx, w, h, p, rand } = s;
  const sun = placeSun(w, h, rand, h * 0.3);
  const backdrop = bake(s, (c) => {
    sky(c, w, p, h);
    if (p.dark) stars(c, w, h, rand, h * 0.45);
    drawSun(c, sun, p);
  });

  const layers = 5;
  // The mist drifts one way for the whole visit, as if on a faint wind.
  const wind = rand() < 0.5 ? 1 : -1;
  const ridges = Array.from({ length: layers }, (_, i) => {
    const t = i / (layers - 1);
    const base = h * (0.42 + t * 0.18);
    const amp = h * (0.22 - t * 0.12);
    const n = noise1d(rand, 5);
    const scale = 2.2 + t * 2.5;
    const offset = rand() * 200;
    const line: number[] = [];
    for (let x = 0; x <= w + 4; x += 4) {
      // Sharpen the noise into peaks and saddles rather than a gentle swell.
      const v = n(offset + (x / w) * scale);
      line.push(base - amp * Math.max(0, v - 0.2) ** 1.4 * 1.9);
    }
    // Mist rising from the valley behind the next ridge, drifting two to five pixels a second.
    const mistTop = base - amp * 0.6;
    const mistHeight = amp * 0.6 + h * 0.06;
    const mist = i < layers - 1 ? mistStrip(s, mistHeight, p.mist, rand) : undefined;
    const drift = wind * (0.0018 + t * 0.0035);
    // How far the ridge rises on a full breath: a few pixels far away, more up close.
    return { line, fill: mix(p.far, p.near, t ** 1.2), mist, mistTop, mistHeight, drift, rise: h * (0.003 + t * 0.009) };
  });
  // Everything that moves lies between the highest peak, fully risen, and the lowest dip of the
  // nearest ridge; below that dip the nearest ridge is one solid colour.
  const top = Math.min(...ridges.map((r) => Math.min(...r.line) - r.rise)) - 2;
  const bottom = Math.max(...ridges[layers - 1].line) + 2;
  const frame = within(s, top, bottom, (now) => {
    copy(s, backdrop);
    ridges.forEach((ridge, i) => {
      // The breath reaches each nearer ridge a moment later, like a slow swell coming closer.
      const breath = s.breath(now - i * 300);
      const dy = -ridge.rise * breath;
      ctx.fillStyle = ridge.fill;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ridge.line.forEach((y, k) => ctx.lineTo(k * 4, y + dy));
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      if (ridge.mist) {
        // Two copies of the strip end to end, shifted by the drift; whole device pixels only, so
        // the seam between them never shows.
        const shift = (((now * ridge.drift) % w) + w) % w;
        const x = Math.round((shift - w) * s.dpr) / s.dpr;
        ctx.save();
        ctx.translate(0, dy);
        ctx.globalAlpha = 0.8 + 0.2 * breath;
        ctx.drawImage(ridge.mist, x, ridge.mistTop, w, ridge.mistHeight);
        ctx.drawImage(ridge.mist, x + w, ridge.mistTop, w, ridge.mistHeight);
        ctx.restore();
      }
    });
  });
  return { frame, interval: 100, sky: { top: h * 0.07, bottom: h * 0.26, glow: { y: sun.y, reach: sun.r * 3 } } };
}

interface Drop {
  x: number;
  y: number;
  born: number;
  size: number;
}

/** A still pond with a far shore; rain lands and spreads in slow rings. */
function pond(s: Stage): Scene {
  const { ctx, w, h, p, rand } = s;
  const shore = h * (0.3 + rand() * 0.06);
  const sun = placeSun(w, h, rand, shore * 0.55);

  // Distant treeline, which swells a little with each breath, and its soft reflection.
  const n = noise1d(rand, 6);
  const offset = rand() * 100;
  const trees: number[] = [];
  for (let x = 0; x <= w + 3; x += 3) trees.push(h * 0.05 * (0.35 + n(offset + (x / w) * 9)));
  const treeline = (breath: number, below: number) => {
    ctx.beginPath();
    ctx.moveTo(0, shore);
    trees.forEach((tree, k) => ctx.lineTo(k * 3, shore + below * tree * (1 + 0.14 * breath)));
    ctx.lineTo(w, shore);
    ctx.closePath();
    ctx.fill();
  };

  const pathBottom = h * 0.66;

  // Sky, sun and water never move: one picture, painted once. The water hides the sun's lower glow.
  const backdrop = bake(s, (c) => {
    sky(c, w, p, shore);
    if (p.dark) stars(c, w, h, rand, shore * 0.8);
    drawSun(c, sun, p);
    const g = c.createLinearGradient(0, shore, 0, h);
    g.addColorStop(0, mix(p.far, p.water, 0.6));
    g.addColorStop(0.25, p.water);
    g.addColorStop(1, p.water);
    c.fillStyle = g;
    c.fillRect(0, shore, w, h - shore);
    // Faint glints on the water, packed closer near the far shore.
    for (let i = 0; i < 90; i++) {
      const depth = rand() ** 2;
      const y = shore + 6 + depth * (h * 0.6 - shore);
      const len = (12 + rand() * 60) * (0.4 + depth);
      const x = rand() * w;
      c.strokeStyle = p.dark ? 'rgba(210, 225, 215, 0.06)' : 'rgba(255, 255, 255, 0.35)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + len, y);
      c.stroke();
    }
    // A faint column of light on the water under the sun or moon, for the glints to shimmer in.
    const mid = shore + (pathBottom - shore) * 0.4;
    const reach = (pathBottom - shore) * 0.65;
    const across = sun.r * 3;
    c.save();
    c.translate(sun.x, mid);
    c.scale(across / reach, 1);
    const column = c.createRadialGradient(0, 0, 0, 0, 0, reach);
    column.addColorStop(0, p.dark ? p.glow + '1c' : '#ffffff66');
    column.addColorStop(1, p.dark ? p.glow + '00' : '#ffffff00');
    c.fillStyle = column;
    c.beginPath();
    c.arc(0, 0, reach, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });

  // A path of light on the water below the sun or moon: short glints, narrow by the far shore and
  // widening towards you, each slowly brightening and fading on its own few-second rhythm.
  const glints: { x: number; y: number; len: number; width: number; fade: number; rate: number; phase: number; sway: number }[] = [];
  for (let k = 0; k < 72; k++) {
    const d = (k / 71) ** 1.5;
    const y = shore + 3 + d * (pathBottom - shore - 3);
    const across = sun.r * (0.8 + d * 5);
    // Pale daytime water needs more and longer glints for the path to show at all.
    const count = (p.dark ? 2 : 3) + Math.floor(rand() * 2 + d * 1.5);
    for (let j = 0; j < count; j++) {
      // Roughly bell-shaped about the middle of the path.
      const g = (rand() + rand() + rand() - 1.5) / 1.5;
      glints.push({
        x: sun.x + g * across,
        y,
        len: (3 + d * 22) * (0.6 + rand() * 0.8) * (p.dark ? 1 : 1.8),
        width: (p.dark ? 0.8 : 1.1) + d * 1.2,
        // Brightest in the middle, dimmer towards you, and easing in just below the far shore.
        fade: (1 - Math.abs(g) * 0.7) * (1 - d * 0.55) * Math.min(1, 0.25 + d * 12),
        rate: 0.0006 + rand() * 0.0012,
        phase: rand() * Math.PI * 2,
        sway: 1 + d * 5,
      });
    }
  }
  // Moonlight is the moon's own silver; by day the glints are white.
  const light = p.dark ? p.glow : '#ffffff';
  const strength = p.dark ? 0.6 : 1;
  const shine = (now: number) => {
    ctx.strokeStyle = light;
    ctx.lineCap = 'round';
    for (const glint of glints) {
      const alpha = strength * glint.fade * (0.5 + 0.5 * Math.sin(now * glint.rate + glint.phase)) ** 1.5;
      if (alpha < 0.02) continue;
      const x = glint.x + Math.sin(now * glint.rate * 0.6 + glint.phase * 2) * glint.sway;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = glint.width;
      ctx.beginPath();
      ctx.moveTo(x - glint.len / 2, glint.y);
      ctx.lineTo(x + glint.len / 2, glint.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  };

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
  const spawn = (born: number) => {
    const y = shore + (h * 0.62 - shore) * (0.08 + rand() * 0.92);
    drops.push({ x: rand() * w, y, born, size: 0.6 + rand() * 0.6 });
  };
  // Held still, a few rings are caught part of the way out.
  if (s.still) for (let i = 0; i < 7; i++) spawn(-life * (0.15 + rand() * 0.5));
  let nextDrop = 0;

  // What moves: the treeline and its reflection, the path of light, and the rain, which lands no
  // lower than 0.62 of the way down and spreads its rings a little further.
  const tallest = Math.max(...trees) * 1.14;
  const lowest = Math.max(h * 0.62 + spread * 1.2 * 0.46, pathBottom + 4) + 2;
  const frame = within(s, shore - tallest - 2, lowest, (now) => {
    copy(s, backdrop);
    const breath = s.breath(now);
    ctx.fillStyle = p.far;
    treeline(breath, -1);
    ctx.globalAlpha = 0.35;
    treeline(breath, 0.7);
    ctx.globalAlpha = 1;
    shine(now);

    if (!s.still && now >= nextDrop) {
      spawn(now);
      nextDrop = now + 350 + rand() * 1100;
    }
    ctx.strokeStyle = p.ripple;
    ctx.lineWidth = 1;
    for (let i = drops.length - 1; i >= 0; i--) {
      if (!s.still && now - drops[i].born > life + 600) drops.splice(i, 1);
      else ring(drops[i], now);
    }
  });
  return { frame, interval: 33, sky: { top: h * 0.05, bottom: shore - h * 0.11, glow: { y: sun.y, reach: sun.r * 3 } } };
}

/** A raked dry garden, the same generator the rest of the site uses; the rings breathe. */
function garden(s: Stage, seed: string): Scene {
  const { ctx, w, h, p } = s;
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

  const backdrop = bake(s, (c) => {
    c.fillStyle = p.ground;
    c.fillRect(0, 0, w, h);
    c.lineWidth = 1;
    c.lineCap = 'round';
    c.strokeStyle = p.rake;
    for (const d of g.lines) c.stroke(new Path2D(d));
  });
  const stones = g.stones.map((stone) => {
    const shade = ctx.createLinearGradient(stone.cx - stone.r * 0.6, stone.cy - stone.r, stone.cx + stone.r * 0.5, stone.cy + stone.r);
    shade.addColorStop(0, p.stoneLight);
    shade.addColorStop(1, p.stone);
    return {
      cx: stone.cx,
      cy: stone.cy,
      clearing: new Path2D(stone.clearingPath),
      rings: stone.rings.map((d) => new Path2D(d)),
      body: new Path2D(stone.body),
      shade,
    };
  });

  const frame = (now: number) => {
    copy(s, backdrop);
    ctx.lineCap = 'round';
    ctx.strokeStyle = p.rake;
    stones.forEach((stone, i) => {
      // The raked rings swell outward a little as the garden breathes in, one stone after another.
      const k = 1 + 0.016 * s.breath(now - i * 450);
      ctx.save();
      ctx.translate(stone.cx, stone.cy);
      ctx.scale(k, k);
      ctx.translate(-stone.cx, -stone.cy);
      ctx.lineWidth = 1 / k;
      ctx.fillStyle = p.ground;
      ctx.fill(stone.clearing);
      for (const ring of stone.rings) ctx.stroke(ring);
      ctx.restore();
      ctx.fillStyle = stone.shade;
      ctx.fill(stone.body);
    });
  };
  return { frame, interval: 100 };
}

/**
 * Draws a scene into the canvas, sized to the window, and keeps it breathing, with birds crossing
 * its sky on their own canvas. Returns a function that stops the motion. With reduced motion
 * preferred, it draws a single still frame instead.
 */
export function paint(
  canvas: HTMLCanvasElement,
  birdCanvas: HTMLCanvasElement,
  name: SceneName,
  p: Palette,
  seed: string,
  still: boolean,
  breath: BreathAt,
): () => void {
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

  const stage: Stage = { ctx, w, h, dpr, p, rand, breath, still };
  const scene = name === 'mountains' ? mountains(stage) : name === 'pond' ? pond(stage) : garden(stage, seed);
  const birds = scene.sky && flyBirds(birdCanvas, dpr, { width: w, ...scene.sky, colour: birdColour(p), still });
  birdCanvas.hidden = !birds;
  if (still) {
    scene.frame(0);
    birds?.(0);
    return () => {};
  }

  // Only as many frames as the motion needs: it spares the battery, and the page stays calm.
  let id = 0;
  let lastScene = -Infinity;
  let lastBirds = -Infinity;
  const tick = (now: number) => {
    id = requestAnimationFrame(tick);
    if (now - lastScene >= scene.interval - 4) {
      lastScene = now;
      scene.frame(now);
    }
    if (birds && now - lastBirds >= 29) {
      lastBirds = now;
      birds(now);
    }
  };
  tick(performance.now());
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}
