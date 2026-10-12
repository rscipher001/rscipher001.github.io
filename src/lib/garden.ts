/**
 * A small karesansui (dry stone garden) generator.
 *
 * Given a seed it places a few stones, rakes rings around them and fills the
 * rest with long, nearly straight lines. The same seed always grows the same
 * garden. Output is plain SVG path data, used by Garden.astro (SVG) and by the
 * pause page (canvas, via Path2D).
 */

export interface GardenOptions {
  seed: string;
  width?: number;
  height?: number;
  /** Stone radii as fractions of the height, largest first. */
  stones?: number[];
  /** Distance between rake lines and rings, in viewBox units. */
  gap?: number;
  /** Horizontal band (fractions of the width) where stones may sit. */
  zone?: [number, number];
}

export interface Stone {
  cx: number;
  cy: number;
  r: number;
  body: string;
  rings: string[];
  /** Outline of the raked clearing; straight lines stop at it. */
  clearingPath: string;
  clearing: number;
}

export interface Garden {
  width: number;
  height: number;
  stones: Stone[];
  lines: string[];
}

/** cyrb53-style string hash, 32 bits. */
export function hash(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  return h1 >>> 0;
}

/** mulberry32: a tiny seeded random number generator. */
export function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Closed, smooth path through points (Catmull-Rom as cubic Béziers). */
function closedCurve(points: [number, number][]): string {
  const n = points.length;
  const at = (i: number) => points[(i + n) % n];
  let d = `M${r1(at(0)[0])} ${r1(at(0)[1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r1(c1[0])} ${r1(c1[1])} ${r1(c2[0])} ${r1(c2[1])} ${r1(p2[0])} ${r1(p2[1])}`;
  }
  return d + 'Z';
}

interface Shape {
  wobble: number[];
  phases: number[];
  squash: number;
  /** Flattens the underside, so stones look settled into the gravel. */
  seat: number;
}

function outline(cx: number, cy: number, r: number, shape: Shape, points = 28): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2;
    let k = 1;
    shape.wobble.forEach((w, h) => (k += w * Math.sin(a * (h + 2) + shape.phases[h])));
    let y = Math.sin(a) * r * k * shape.squash;
    if (y > 0) y *= 1 - shape.seat;
    pts.push([cx + Math.cos(a) * r * k, cy + y]);
  }
  return closedCurve(pts);
}

export function makeGarden({
  seed,
  width = 1600,
  height = 420,
  stones: sizes = [0.16, 0.08],
  gap = 10,
  zone = [0.1, 0.9],
}: GardenOptions): Garden {
  const rand = rng(hash(seed));
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo);

  const placed: Stone[] = [];
  for (const size of sizes) {
    const r = height * size * between(0.9, 1.1);
    // Three to five rings, as in a real garden; small stones get fewer.
    const ringCount = Math.min(5, Math.max(3, Math.round((r / gap) * 0.55)));
    const clearing = r + gap * (ringCount + 0.5);
    for (let attempt = 0; attempt < 300; attempt++) {
      const cx = between(width * zone[0], width * zone[1]);
      const cy = between(height * 0.38, height * 0.62);
      if (placed.some((s) => Math.hypot(s.cx - cx, s.cy - cy) < s.clearing + clearing + gap * 2)) continue;

      const shape: Shape = {
        wobble: [between(0.02, 0.05), between(0.01, 0.03), between(0, 0.015)],
        phases: [rand() * 6.28, rand() * 6.28, rand() * 6.28],
        squash: between(0.62, 0.74),
        seat: between(0.1, 0.25),
      };
      const rings: string[] = [];
      for (let i = 1; i <= ringCount; i++) {
        // Rings relax towards ellipses the further they are from the stone.
        const fade = 1 / (1 + i * 0.8);
        const ringShape = {
          ...shape,
          wobble: shape.wobble.map((w) => w * fade),
          squash: shape.squash + (0.92 - shape.squash) * (i / (ringCount + 1)),
          seat: shape.seat * fade,
        };
        rings.push(outline(cx, cy, r + gap * i, ringShape, 36));
      }
      const clearingShape = { ...shape, wobble: shape.wobble.map((w) => w * 0.1), squash: 0.92, seat: 0 };
      placed.push({
        cx,
        cy,
        r,
        body: outline(cx, cy, r, shape),
        rings,
        clearing,
        clearingPath: outline(cx, cy, clearing, clearingShape, 36),
      });
      break;
    }
  }

  // Long strokes with a slow tremor, like a rake pulled by hand.
  const lines: string[] = [];
  const phase = rand() * 6.28;
  for (let y = gap / 2, row = 0; y < height; y += gap, row++) {
    const steps = Math.ceil(width / 40);
    let d = '';
    for (let s = 0; s <= steps; s++) {
      const x = (s / steps) * width;
      const dy = Math.sin(x / 260 + phase + row * 0.21) * 0.7 + Math.sin(x / 83 + row * 0.7) * 0.25;
      d += `${s === 0 ? 'M' : 'L'}${r1(x)} ${r1(y + dy)}`;
    }
    lines.push(d);
  }

  return { width, height, stones: placed, lines };
}
