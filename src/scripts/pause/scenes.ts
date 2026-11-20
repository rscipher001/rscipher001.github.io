// Nature scenes for the pause page, drawn on a canvas. Each visit gets a new one, and it breathes:
// slowly on its own, and in time with the breathing guide while that runs.
//
// They're coloured like Japanese woodblock landscapes (shin-hanga): flat shapes with no outlines,
// each shaded with one soft gradation, the colours changing with distance and the time of day.
import { makeGarden } from '../../lib/garden';
import { flyBirds } from './birds';

export type Period = 'morning' | 'day' | 'evening' | 'night';
export type SceneName = 'mountains' | 'pond' | 'garden';
export const SCENES: SceneName[] = ['mountains', 'pond', 'garden'];

export interface Palette {
  dark: boolean;
  /** The sky from overhead down to the horizon. */
  sky: [string, string, string];
  /** The sun or moon, and the light it spreads around itself. */
  sun: string;
  glow: string;
  /** Morning and evening suns hang low over the hills; the midday sun and the moon ride high. */
  low: boolean;
  /** Hills from the farthest to the nearest, each a deeper colour than the one behind it. */
  ridges: string[];
  /** What the hills pale into towards their feet, and how thick the mist in the valleys is. */
  haze: string;
  mist: number;
  /** The pond from the far shore to close by, and the rings rain leaves on it. */
  water: [string, string, string];
  ripple: string;
  /** The raked garden: gravel, the shaded and lit sides of its grooves, stones, and their shadows. */
  sand: string;
  rake: string;
  rakeLight: string;
  stone: string;
  stoneLight: string;
  shadow: string;
  /** The page under the words, and the words. */
  ground: string;
  ink: string;
  inkSoft: string;
}

export const PALETTES: Record<Period, Palette> = {
  // Dawn: blue overhead, warming to peach at the horizon, over blue-grey hills.
  morning: {
    dark: false,
    sky: ['#c9d8e6', '#e6dfe4', '#f8dcc8'],
    sun: '#fff3dc',
    glow: '#ffe2b8',
    low: true,
    ridges: ['#c3cbdd', '#a4b3cc', '#8199b3', '#5f8093', '#476a72'],
    haze: '#faece2',
    mist: 0.45,
    water: ['#f0dcd0', '#cfdbe3', '#b7cad8'],
    ripple: 'rgba(60, 84, 104, 0.32)',
    sand: '#ece4d6',
    rake: '#cfc4b0',
    rakeLight: '#f8f3e8',
    stone: '#7d8690',
    stoneLight: '#b4bbbd',
    shadow: '#465a78',
    ground: '#f1eee8',
    ink: '#232a2e',
    inkSoft: '#55616a',
  },
  // Day: clear blue over blue-green hills.
  day: {
    dark: false,
    sky: ['#a9cbe0', '#cfe2e6', '#eef0df'],
    sun: '#fffdf2',
    glow: '#fff6d8',
    low: false,
    ridges: ['#b4cdd3', '#94b8b6', '#76a297', '#5a8a78', '#44705c'],
    haze: '#f0f6ee',
    mist: 0.4,
    water: ['#dfe9df', '#b9d3d8', '#a3c3cc'],
    ripple: 'rgba(48, 84, 84, 0.3)',
    sand: '#ebe6d8',
    rake: '#cdc6b2',
    rakeLight: '#f7f4ea',
    stone: '#7f897f',
    stoneLight: '#b9bfb2',
    shadow: '#3c5050',
    ground: '#eef0e6',
    ink: '#242a26',
    inkSoft: '#566152',
  },
  // Evening: apricot and rose low in the sky, over plum and violet hills.
  evening: {
    dark: false,
    sky: ['#9aa0c4', '#e3b7b4', '#f6cf9f'],
    sun: '#ffe6c0',
    glow: '#ffc98a',
    low: true,
    ridges: ['#c8aab6', '#a68ca4', '#836f93', '#5f587f', '#424667'],
    haze: '#f6d6c4',
    mist: 0.4,
    water: ['#f0cdb0', '#c9b4bd', '#a9a3bd'],
    ripple: 'rgba(70, 60, 90, 0.3)',
    sand: '#f0dfcc',
    rake: '#d3bca8',
    rakeLight: '#fbeedd',
    stone: '#7a708a',
    stoneLight: '#d9bfae',
    shadow: '#605078',
    ground: '#efe8e1',
    ink: '#2a2630',
    inkSoft: '#625a68',
  },
  // Night: indigo, under a silver moon.
  night: {
    dark: true,
    sky: ['#0b1226', '#16213d', '#25365a'],
    sun: '#e8ecf4',
    glow: '#9db4d8',
    low: false,
    ridges: ['#2b3a5c', '#223150', '#1a2843', '#131f36', '#0d172a'],
    haze: '#3c5078',
    mist: 0.35,
    water: ['#22304f', '#101a30', '#0c1428'],
    ripple: 'rgba(190, 208, 236, 0.2)',
    sand: '#1a2238',
    rake: '#121930',
    rakeLight: '#2c3856',
    stone: '#353f58',
    stoneLight: '#6a779a',
    shadow: '#04080f',
    ground: '#0f1626',
    ink: '#dfe3ee',
    inkSoft: '#a3abc0',
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

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** `a`, taken `t` of the way towards `b`. */
const mix = (a: string, b: string, t: number) => {
  const pb = channels(b);
  return `#${channels(a)
    .map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0'))
    .join('')}`;
};

/** A colour at some opacity. At zero it's still the same colour, so fading to it never greys. */
const fade = (hex: string, alpha: number) => `rgba(${channels(hex).join(', ')}, ${alpha})`;

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

interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Copies a baked layer into the frame: all of it, or only the area given, in whole device pixels. */
function copy(s: Stage, layer: HTMLCanvasElement, area?: Area) {
  s.ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (!area) s.ctx.drawImage(layer, 0, 0);
  else {
    const x = Math.max(0, Math.floor(area.x * s.dpr));
    const y = Math.max(0, Math.floor(area.y * s.dpr));
    const w = Math.min(layer.width, Math.ceil((area.x + area.w) * s.dpr)) - x;
    const h = Math.min(layer.height, Math.ceil((area.y + area.h) * s.dpr)) - y;
    if (w > 0 && h > 0) s.ctx.drawImage(layer, x, y, w, h, x, y, w, h);
  }
  s.ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
}

/**
 * Wraps a frame so that, after the first, it only repaints the band where anything moves; above
 * and below it the canvas keeps what the first frame drew.
 */
function within(s: Stage, top: number, bottom: number, draw: (now: number, first: boolean) => void) {
  let first = true;
  return (now: number) => {
    s.ctx.save();
    if (!first) {
      s.ctx.beginPath();
      s.ctx.rect(0, Math.floor(top), s.w, Math.ceil(bottom - top));
      s.ctx.clip();
    }
    draw(now, first);
    first = false;
    s.ctx.restore();
  };
}

/** The sky, graded down to the horizon; below the horizon, wherever it shows, the horizon's colour. */
function sky(ctx: CanvasRenderingContext2D, w: number, p: Palette, horizon: number, bottom = horizon) {
  const g = ctx.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, p.sky[0]);
  g.addColorStop(0.55, p.sky[1]);
  g.addColorStop(1, p.sky[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, bottom);
}

interface Sun {
  x: number;
  y: number;
  r: number;
}

/** A low sun looks larger. It sits right of centre, away from the words. */
function sunAt(w: number, h: number, p: Palette, rand: Rand) {
  return { x: w * (0.58 + rand() * 0.28), r: Math.min(w, h) * (p.low ? 0.042 : 0.032) };
}

function drawSun(ctx: CanvasRenderingContext2D, { x, y, r }: Sun, p: Palette, w: number) {
  // Its light, spread wide across the sky around it, warmest low in the sky at either end of the day.
  const wide = Math.max(w * 0.2, r * 10);
  const strength = p.dark ? 0.16 : p.low ? 0.62 : 0.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(2.6, 1);
  const wash = ctx.createRadialGradient(0, 0, 0, 0, 0, wide);
  wash.addColorStop(0, fade(p.glow, strength));
  wash.addColorStop(0.4, fade(p.glow, strength * 0.35));
  wash.addColorStop(1, fade(p.glow, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(-wide, -wide, wide * 2, wide * 2);
  ctx.restore();
  // A brighter halo close in, then the disc.
  const reach = r * 4.5;
  const halo = ctx.createRadialGradient(x, y, r, x, y, reach);
  const bright = p.dark ? 0.34 : 0.75;
  halo.addColorStop(0, fade(p.glow, bright));
  halo.addColorStop(0.3, fade(p.glow, bright * 0.4));
  halo.addColorStop(1, fade(p.glow, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, reach, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.sun;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  if (p.dark) {
    // The moon's darker seas, roughly where they are on the real one, faint enough to notice only
    // on a second look.
    ctx.save();
    ctx.clip();
    for (const [dx, dy, size] of MARIA) {
      const sea = ctx.createRadialGradient(x + dx * r, y + dy * r, 0, x + dx * r, y + dy * r, size * r);
      sea.addColorStop(0, fade('#7d8698', 0.2));
      sea.addColorStop(1, fade('#7d8698', 0));
      ctx.fillStyle = sea;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.restore();
  }
}

/** Where the moon's seas lie, and how large they are, in radii from its centre. */
const MARIA = [
  [-0.28, -0.3, 0.42],
  [0.2, -0.28, 0.3],
  [0.32, 0, 0.32],
  [-0.5, 0.1, 0.45],
  [-0.1, 0.45, 0.3],
  [0.5, 0.25, 0.22],
];

function stars(ctx: CanvasRenderingContext2D, w: number, h: number, rand: Rand, maxY: number) {
  const count = Math.round((w * h) / 14000);
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(214, 224, 245, ${0.15 + rand() * 0.5})`;
    ctx.beginPath();
    ctx.arc(rand() * w, rand() * maxY, rand() * 0.9 + 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Birds are silhouettes, darker than anything behind them, so they stand out most against the sun
 * or moon: the colour of the nearest hills, deepened, and a little more for nearer birds.
 */
const birdColour = (p: Palette) => {
  const nearest = p.ridges[p.ridges.length - 1];
  return (depth: number) => mix(nearest, '#000000', (p.dark ? 0.3 : 0.12) + depth * 0.3);
};

/**
 * A band of valley mist, thicker in places and thinner in others, baked into a strip as wide as the
 * screen whose two ends match, so laid end to end it can drift sideways for ever.
 */
function mistStrip(s: Stage, height: number, colour: string, thickness: number, rand: Rand) {
  const strip = document.createElement('canvas');
  strip.width = Math.ceil(s.w * s.dpr);
  strip.height = Math.ceil(height * s.dpr);
  const c = strip.getContext('2d')!;
  c.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  // Rising from the valley floor.
  const rising = c.createLinearGradient(0, 0, 0, height);
  rising.addColorStop(0, fade(colour, 0));
  rising.addColorStop(1, fade(colour, thickness));
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

/** Ridge after ridge, each nearer one deeper in colour, with mist pooling and drifting in the valleys. */
function mountains(s: Stage): Scene {
  const { ctx, w, h, p, rand } = s;
  const layers = p.ridges.length;
  // The mist drifts one way for the whole visit, as if on a faint wind.
  const wind = rand() < 0.5 ? 1 : -1;
  // Shapes are measured against the screen's longer side, so a phone held upright sees the same
  // broad ridges as a wide screen rather than a squeezed, spiky range.
  const span = Math.max(w, h * 1.3);
  const ridges = p.ridges.map((colour, i) => {
    const t = i / (layers - 1);
    const base = h * (0.42 + t * 0.18);
    const amp = h * (0.22 - t * 0.12);
    const n = noise1d(rand, 5);
    const scale = 2.2 + t * 2.5;
    const offset = rand() * 200;
    const line: number[] = [];
    for (let x = 0; x <= w + 4; x += 4) {
      // Sharpen the noise into peaks and saddles rather than a gentle swell.
      const v = n(offset + (x / span) * scale);
      line.push(base - amp * Math.max(0, v - 0.2) ** 1.4 * 1.9);
    }
    const crest = Math.min(...line);
    // Mist rising from the valley behind the next ridge, drifting two to five pixels a second.
    const mistTop = base - amp * 0.6;
    const mistHeight = amp * 0.6 + h * 0.06;
    const mist = i < layers - 1 ? mistStrip(s, mistHeight, p.haze, p.mist, rand) : undefined;
    const drift = wind * (0.0018 + t * 0.0035);
    return {
      line,
      shape: new Path2D(),
      // The ridge's own colour along its crest, paling into the haze towards its foot.
      shade: { top: crest, bottom: base + (base - crest) * 0.3, colours: [colour, mix(colour, p.haze, 0.15), mix(colour, p.haze, 0.55)] },
      mist,
      mistTop,
      mistHeight,
      drift,
      // How far the ridge rises on a full breath: a few pixels far away, more up close.
      rise: h * (0.003 + t * 0.009),
    };
  });
  // Each ridge is filled only as far down as the next one always covers, the nearest to the bottom.
  ridges.forEach((ridge, i) => {
    const floor = i < layers - 1 ? Math.max(...ridges[i + 1].line) + ridge.rise + 2 : h;
    ridge.shape.moveTo(0, floor);
    ridge.line.forEach((y, k) => ridge.shape.lineTo(k * 4, y));
    ridge.shape.lineTo((ridge.line.length - 1) * 4, floor);
    ridge.shape.closePath();
  });

  // The sun or moon. Low in the morning and evening, resting on the skyline with part of it hidden.
  const { x, r } = sunAt(w, h, p, rand);
  const skyline = Math.min(...ridges.map((ridge) => ridge.line[Math.round(x / 4)]));
  const y = p.low ? skyline - r * (0.15 + rand() * 0.7) : Math.min(skyline - r * 1.5, h * (0.11 + rand() * 0.12));
  const sun = { x, y, r };
  const backdrop = bake(s, (c) => {
    sky(c, w, p, h * 0.5, h);
    if (p.dark) stars(c, w, h, rand, h * 0.45);
    drawSun(c, sun, p, w);
  });

  // Everything that moves lies between the highest peak, fully risen, and the lowest dip of the
  // nearest ridge; below that dip the nearest ridge's colour no longer changes.
  const top = Math.min(...ridges.map((ridge) => ridge.shade.top - ridge.rise)) - 2;
  const bottom = Math.max(...ridges[layers - 1].line) + 2;
  // Below the far ridge's lowest dip the ridges always cover the sky, so only above it does the sky
  // need painting again.
  const above = { x: 0, y: top, w, h: Math.max(...ridges[0].line) + 2 - top };
  const frame = within(s, top, bottom, (now, first) => {
    copy(s, backdrop, first ? undefined : above);
    ridges.forEach((ridge, i) => {
      // The breath reaches each nearer ridge a moment later, like a slow swell coming closer.
      const breath = s.breath(now - i * 300);
      const dy = -ridge.rise * breath;
      ctx.save();
      ctx.translate(0, dy);
      // The shading stays put on the screen while the ridge rises and settles through it.
      const { shade } = ridge;
      const gradient = ctx.createLinearGradient(0, shade.top - dy, 0, shade.bottom - dy);
      gradient.addColorStop(0, shade.colours[0]);
      gradient.addColorStop(0.5, shade.colours[1]);
      gradient.addColorStop(1, shade.colours[2]);
      ctx.fillStyle = gradient;
      ctx.fill(ridge.shape);
      if (ridge.mist) {
        // Two copies of the strip end to end, shifted by the drift; whole device pixels only, so
        // the seam between them never shows.
        const shift = (((now * ridge.drift) % w) + w) % w;
        const x = Math.round((shift - w) * s.dpr) / s.dpr;
        ctx.globalAlpha = 0.8 + 0.2 * breath;
        ctx.drawImage(ridge.mist, x, ridge.mistTop, w, ridge.mistHeight);
        ctx.drawImage(ridge.mist, x + w, ridge.mistTop, w, ridge.mistHeight);
      }
      ctx.restore();
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

/** A still pond below far hills and a nearer treeline; rain lands and spreads in slow rings. */
function pond(s: Stage): Scene {
  const { ctx, w, h, p, rand } = s;
  const shore = h * (0.3 + rand() * 0.06);
  // Measured against the screen's longer side, as the mountains are, so a phone sees the same shapes.
  const span = Math.max(w, h * 1.3);

  // Far hills, pale with distance. They and their reflection never move.
  const hillNoise = noise1d(rand, 4);
  const hillOffset = rand() * 100;
  const hills: number[] = [];
  for (let x = 0; x <= w + 6; x += 6) hills.push(h * (0.03 + 0.085 * hillNoise(hillOffset + (x / span) * 3) ** 1.6));
  const hill = (c: CanvasRenderingContext2D, below: number) => {
    c.beginPath();
    c.moveTo(0, shore);
    hills.forEach((height, k) => c.lineTo(k * 6, shore + below * height));
    c.lineTo(w, shore);
    c.closePath();
    c.fill();
  };

  // Woods along the far shore: a line of tree crowns, taller where the land rises. Each crown is a
  // small round top; overlapping, they make the soft, uneven edge of a forest seen from afar.
  const land = noise1d(rand, 4);
  const landOffset = rand() * 100;
  const crown = h * 0.0075;
  const step = 2;
  const trees = Array.from({ length: Math.ceil(w / step) + 2 }, () => 0);
  for (let x = -crown * 2; x < w + crown * 2; ) {
    const size = crown * (0.6 + rand() * 0.8);
    const top = h * (0.014 + 0.032 * land(landOffset + (x / span) * 5)) * (0.85 + rand() * 0.3);
    const last = Math.min(trees.length - 1, Math.floor((x + size) / step));
    for (let k = Math.max(0, Math.ceil((x - size) / step)); k <= last; k++) {
      const dx = (k * step - x) / size;
      trees[k] = Math.max(trees[k], top - size * (1 - Math.sqrt(1 - dx * dx)));
    }
    x += size * (0.8 + rand() * 0.6);
  }
  // The woods are painted once onto a strip of their own, paling a little towards the water. Each
  // frame stretches the strip as they swell with the breath, and flips it, shorter, for their reflection.
  const high = Math.ceil(Math.max(...trees)) + 1;
  const woods = document.createElement('canvas');
  woods.width = Math.ceil(w * s.dpr);
  woods.height = Math.ceil(high * s.dpr);
  const wc = woods.getContext('2d')!;
  wc.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
  const shade = wc.createLinearGradient(0, 0, 0, high);
  shade.addColorStop(0, p.ridges[3]);
  shade.addColorStop(1, mix(p.ridges[3], p.haze, 0.3));
  wc.fillStyle = shade;
  wc.beginPath();
  wc.moveTo(0, high);
  trees.forEach((tree, k) => wc.lineTo(k * step, high - tree));
  wc.lineTo((trees.length - 1) * step, high);
  wc.closePath();
  wc.fill();
  const tallest = high * 1.14;
  const treeline = (breath: number, stretch: number) => {
    ctx.save();
    ctx.translate(0, shore);
    ctx.scale(1, stretch * (1 + 0.14 * breath));
    ctx.drawImage(woods, 0, -high, woods.width / s.dpr, high);
    ctx.restore();
  };

  // The sun or moon: low in the morning and evening, resting on the far hills.
  const { x, r } = sunAt(w, h, p, rand);
  const y = p.low ? shore - hills[Math.round(x / 6)] - r * (0.1 + rand() * 0.6) : Math.min(shore * 0.55, h * (0.11 + rand() * 0.12));
  const sun = { x, y, r };
  const pathBottom = h * 0.66;

  // Sky, sun, hills and water never move: one picture, painted once. The water hides the sun's lower glow.
  const backdrop = bake(s, (c) => {
    sky(c, w, p, shore);
    if (p.dark) stars(c, w, h, rand, shore * 0.8);
    drawSun(c, sun, p, w);
    const hillShade = c.createLinearGradient(0, shore - Math.max(...hills), 0, shore);
    hillShade.addColorStop(0, p.ridges[1]);
    hillShade.addColorStop(1, mix(p.ridges[1], p.haze, 0.45));
    c.fillStyle = hillShade;
    hill(c, -1);
    // The water holds the pale sky near the far shore and deepens as it comes closer.
    const g = c.createLinearGradient(0, shore, 0, h);
    g.addColorStop(0, p.water[0]);
    g.addColorStop(0.3, p.water[1]);
    g.addColorStop(1, p.water[2]);
    c.fillStyle = g;
    c.fillRect(0, shore, w, h - shore);
    c.globalAlpha = 0.3;
    c.fillStyle = p.ridges[1];
    hill(c, 0.75);
    c.globalAlpha = 1;
    // Faint streaks on the water, packed closer near the far shore.
    for (let i = 0; i < 90; i++) {
      const depth = rand() ** 2;
      const y = shore + 6 + depth * (h * 0.6 - shore);
      const len = (12 + rand() * 60) * (0.4 + depth);
      const x = rand() * w;
      c.strokeStyle = p.dark ? fade(p.sun, 0.06) : 'rgba(255, 255, 255, 0.35)';
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
    column.addColorStop(0, fade(p.dark ? p.glow : p.sun, p.dark ? 0.11 : 0.45));
    column.addColorStop(1, fade(p.dark ? p.glow : p.sun, 0));
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
  // The glints are the sun's or moon's own colour.
  const strength = p.dark ? 0.6 : 1;
  const shine = (now: number) => {
    ctx.strokeStyle = p.sun;
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
  // A faint line of light where the woods meet the water.
  const waterline = p.dark ? fade(p.sun, 0.08) : fade(mix(p.water[0], '#ffffff', 0.5), 0.45);

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
  const lowest = Math.max(h * 0.62 + spread * 1.2 * 0.46, pathBottom + 4) + 2;
  const frame = within(s, shore - tallest - 2, lowest, (now) => {
    copy(s, backdrop);
    const breath = s.breath(now);
    treeline(breath, 1);
    ctx.globalAlpha = 0.5;
    treeline(breath, -0.75);
    ctx.globalAlpha = 1;
    ctx.fillStyle = waterline;
    ctx.fillRect(0, shore - 0.5, w, 1);
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
  return {
    frame,
    interval: 33,
    // Birds stay above the trees, even when the sun is down among them.
    sky: { top: h * 0.05, bottom: shore - h * 0.11, glow: { y: Math.min(sun.y, shore - h * 0.09), reach: sun.r * 3 } },
  };
}

/** A raked dry garden, the same generator the rest of the site uses; the rings breathe. */
function garden(s: Stage, seed: string): Scene {
  const { ctx, w, h, p, rand } = s;
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

  // Light falls across the garden from one side (-1: the left), low in the morning and evening, when
  // the stones' shadows reach further.
  const from = rand() < 0.5 ? -1 : 1;
  const reach = p.low ? 1.7 : 0.9;
  // Gravel warmed by the light on one side, shading towards the other. Inside a clearing, drawn while
  // its rings are scaled by k about the stone at (cx, cy), it's placed to line up with the gravel around.
  const light = (c: CanvasRenderingContext2D, k = 1, cx = 0, cy = 0) => {
    const at = (x: number, y: number) => [cx + (x - cx) / k, cy + (y - cy) / k] as const;
    const gradient = c.createLinearGradient(...at(from < 0 ? 0 : w, 0), ...at(from < 0 ? w : 0, h));
    gradient.addColorStop(0, fade(p.glow, p.dark ? 0.1 : 0.4));
    gradient.addColorStop(0.5, fade(p.glow, 0));
    gradient.addColorStop(0.5, fade(p.shadow, 0));
    gradient.addColorStop(1, fade(p.shadow, p.dark ? 0.3 : 0.12));
    return gradient;
  };
  // Each raked groove: its shaded side, and just below it the side the light catches.
  const rake = (c: CanvasRenderingContext2D, paths: Path2D[], width: number) => {
    c.lineWidth = width;
    c.strokeStyle = p.rake;
    for (const path of paths) c.stroke(path);
    c.save();
    c.translate(0, width * 1.2);
    c.strokeStyle = p.rakeLight;
    for (const path of paths) c.stroke(path);
    c.restore();
  };

  const backdrop = bake(s, (c) => {
    c.fillStyle = p.sand;
    c.fillRect(0, 0, w, h);
    c.lineCap = 'round';
    rake(c, g.lines.map((d) => new Path2D(d)), 1);
    c.fillStyle = light(c);
    c.fillRect(0, 0, w, h);
  });

  // No two stones quite alike: each leans a little warm, cool or green.
  const tints = ['#a0785a', '#5a7896', '#6e8a5a'];
  const firstTint = Math.floor(rand() * tints.length);
  const stones = g.stones.map((stone, i) => {
    const { cx, cy, r } = stone;
    const tint = tints[(firstTint + i) % tints.length];
    const colour = mix(p.stone, tint, 0.12);
    const body = new Path2D(stone.body);
    // A stone and its shadow never change, so each pair is painted once onto a small canvas of its own,
    // lined up with the screen's pixels.
    const snap = (v: number) => Math.floor(v * s.dpr) / s.dpr;
    // The shadow reaches up to 2.7 radii away from the light, the stone and its shadow 1.35 towards it.
    const sprite = document.createElement('canvas');
    sprite.width = Math.ceil(r * 4.05 * s.dpr);
    sprite.height = Math.ceil(r * 1.95 * s.dpr);
    const at = { x: snap(cx - r * (from < 0 ? 1.35 : 2.7)), y: snap(cy - r * 0.9), w: sprite.width / s.dpr, h: sprite.height / s.dpr };
    const c = sprite.getContext('2d')!;
    c.setTransform(s.dpr, 0, 0, s.dpr, -at.x * s.dpr, -at.y * s.dpr);
    // Its shadow: the stone's outline laid flat on the gravel, away from the light, and softened. The
    // outline itself is drawn well off to one side, so only its blurred shadow lands on the canvas.
    const aside = at.w * 2;
    c.save();
    c.shadowColor = fade(p.shadow, p.dark ? 0.6 : 0.34);
    c.shadowBlur = r * 0.2 * s.dpr;
    c.shadowOffsetX = aside * s.dpr;
    c.translate(cx - from * r * reach * 0.4 - aside, cy + r * 0.32);
    c.scale(1 + reach * 0.3, 0.5);
    c.translate(-cx, -cy);
    c.fill(body);
    c.restore();
    // The stone, lit on the light's side and shading away from it,
    const side = c.createLinearGradient(cx + from * r * 0.8, cy - r * 0.5, cx - from * r * 0.8, cy + r * 0.5);
    side.addColorStop(0, mix(p.stoneLight, tint, 0.08));
    side.addColorStop(0.5, colour);
    side.addColorStop(1, mix(colour, p.shadow, 0.3));
    c.fillStyle = side;
    c.fill(body);
    // then paler on top, where the sky falls on it, and darker where it meets the gravel.
    const volume = c.createLinearGradient(0, cy - r * 0.75, 0, cy + r * 0.75);
    volume.addColorStop(0, fade(p.sun, p.dark ? 0.08 : 0.2));
    volume.addColorStop(0.45, fade(p.sun, 0));
    volume.addColorStop(0.55, fade(p.shadow, 0));
    volume.addColorStop(1, fade(p.shadow, p.dark ? 0.4 : 0.3));
    c.fillStyle = volume;
    c.fill(body);
    return {
      cx,
      cy,
      clearing: new Path2D(stone.clearingPath),
      rings: stone.rings.map((d) => new Path2D(d)),
      sprite,
      at,
    };
  });

  // Only the stones' clearings move, between the highest clearing or shadow and the lowest.
  const top = Math.min(...g.stones.map((stone, i) => Math.min(stone.cy - stone.clearing * 1.02, stones[i].at.y))) - 2;
  const bottom = Math.max(...g.stones.map((stone, i) => Math.max(stone.cy + stone.clearing * 1.02, stones[i].at.y + stones[i].at.h))) + 2;
  const frame = within(s, top, bottom, (now) => {
    copy(s, backdrop);
    ctx.lineCap = 'round';
    stones.forEach((stone, i) => {
      // The raked rings swell outward a little as the garden breathes in, one stone after another.
      const k = 1 + 0.016 * s.breath(now - i * 450);
      ctx.save();
      ctx.translate(stone.cx, stone.cy);
      ctx.scale(k, k);
      ctx.translate(-stone.cx, -stone.cy);
      ctx.fillStyle = p.sand;
      ctx.fill(stone.clearing);
      rake(ctx, stone.rings, 1 / k);
      ctx.fillStyle = light(ctx, k, stone.cx, stone.cy);
      ctx.fill(stone.clearing);
      ctx.restore();
      ctx.drawImage(stone.sprite, stone.at.x, stone.at.y, stone.at.w, stone.at.h);
    });
  });
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
