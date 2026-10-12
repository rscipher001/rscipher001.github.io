// Now and then a few birds cross the sky: flat silhouettes like the ridges, flapping a few beats
// and then gliding. Seen from afar, so each is only a curved stroke of wing with a small body.

interface Bird {
  /** Place in the flock, relative to its leader. */
  dx: number;
  dy: number;
  span: number;
  /** Wingbeats per millisecond, and where in its beat this bird starts. */
  beat: number;
  phase: number;
  /** A spell of flapping and gliding repeats every `cycle` ms; `flapping` is the flapping share. */
  cycle: number;
  flapping: number;
  offset: number;
  /** A slow wander about its place, so the flock never moves as one rigid shape. */
  wander: number;
  wanderPhase: number;
}

interface Flock {
  x: number;
  y: number;
  born: number;
  /** Pixels per millisecond: positive flies right. */
  vx: number;
  vy: number;
  depth: number;
  birds: Bird[];
}

export interface Birds {
  draw(ctx: CanvasRenderingContext2D, now: number): void;
  /** How far a bird can reach above or below `top` and `bottom`, wings and all. */
  margin: number;
  /** The heights flocks fly at, including a pass across the sun or moon. */
  top: number;
  bottom: number;
}

export interface BirdOptions {
  width: number;
  /** The band of sky the flocks keep to. */
  top: number;
  bottom: number;
  colour: (depth: number) => string;
  /** The sun or moon. Silhouettes show best against it, so about half the flocks fly across it. */
  glow?: { y: number; reach: number };
  /** Reduced motion: one flock, held mid-flight. */
  still: boolean;
}

/** Draws one bird with its wings at `a`: -1 fully down, 0 level, 1 fully up. */
function drawBird(ctx: CanvasRenderingContext2D, x: number, y: number, span: number, a: number) {
  const s = span / 2;
  const tipX = s * (1 - 0.14 * Math.abs(a));
  const tipY = s * (0.1 - 0.62 * a);
  const bendX = s * 0.42;
  const bendY = -s * (0.16 + 0.3 * a);
  // Never thinner than about a pixel, or distant birds vanish into hairlines.
  const thick = Math.max(s * 0.15, 1.1);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.07, y - thick * 0.2);
  ctx.quadraticCurveTo(x - bendX, y + bendY - thick * 0.6, x - tipX, y + tipY);
  ctx.quadraticCurveTo(x - bendX * 0.95, y + bendY + thick * 0.9, x - s * 0.05, y + thick * 0.8);
  ctx.quadraticCurveTo(x, y + thick * 1.25, x + s * 0.05, y + thick * 0.8);
  ctx.quadraticCurveTo(x + bendX * 0.95, y + bendY + thick * 0.9, x + tipX, y + tipY);
  ctx.quadraticCurveTo(x + bendX, y + bendY - thick * 0.6, x + s * 0.07, y - thick * 0.2);
  ctx.quadraticCurveTo(x, y - thick * 0.6, x - s * 0.07, y - thick * 0.2);
  ctx.closePath();
  ctx.fill();
}

const between = (min: number, max: number) => min + Math.random() * (max - min);

const ease = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/** Where the wings are at `now`: a few beats, then a glide with them held slightly raised. */
function wings(bird: Bird, now: number) {
  const t = (((now + bird.offset) % bird.cycle) + bird.cycle) % bird.cycle;
  const flapEnd = bird.cycle * bird.flapping;
  const turn = 280;
  const power = Math.min(ease(t / turn), 1 - ease((t - flapEnd) / turn));
  return power * 0.95 * Math.sin(now * bird.beat * 2 * Math.PI + bird.phase) + (1 - power) * 0.22;
}

export function makeBirds({ width, top, bottom, colour, glow, still }: BirdOptions): Birds {
  const size = Math.min(Math.max(width * 0.012, 11), 20);
  const flocks: Flock[] = [];
  let nextFlock: number | undefined;

  const launch = (now: number, x?: number) => {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const depth = Math.random();
    const span = size * (0.7 + depth * 0.8);
    const count = [1, 2, 2, 3, 3, 3, 4, 5][Math.floor(Math.random() * 8)];
    const birds: Bird[] = [];
    for (let k = 0; k < count; k++) {
      // A loose V: each one a little behind the last, alternating above and below.
      const rank = Math.ceil(k / 2);
      const side = k % 2 ? 1 : -1;
      birds.push({
        dx: -dir * rank * span * between(1.5, 2.4),
        dy: side * rank * span * between(0.35, 0.7),
        span: span * between(0.85, 1.1),
        beat: between(0.0021, 0.0028),
        phase: Math.random() * Math.PI * 2,
        cycle: between(2600, 4400),
        flapping: between(0.3, 0.55),
        offset: Math.random() * 5000,
        wander: span * between(0.15, 0.35),
        wanderPhase: Math.random() * Math.PI * 2,
      });
    }
    // Crossing the screen takes 25 to 45 seconds; nearer birds go a little faster.
    const vx = (dir * (width + span * 12)) / (between(30000, 38000) * (1.2 - depth * 0.4));
    flocks.push({
      x: x ?? (dir > 0 ? -span * 3 : width + span * 3),
      y: glow && Math.random() < 0.5 ? glow.y + between(-0.6, 0.6) * glow.reach : between(top, bottom),
      born: now,
      vx,
      vy: (Math.random() - 0.5) * span * 0.00005,
      depth,
      birds,
    });
  };

  if (still) launch(0, width * between(0.2, 0.55));

  return {
    margin: Math.ceil(size * 1.65 * 2.2),
    top: glow ? Math.min(top, glow.y - 0.6 * glow.reach) : top,
    bottom: glow ? Math.max(bottom, glow.y + 0.6 * glow.reach) : bottom,
    draw(ctx, now) {
      if (!still) {
        // The first flock comes soon, so even a short visit sees one; later ones every half minute or so.
        nextFlock ??= now + between(1200, 4500);
        if (now >= nextFlock && flocks.length < 2) {
          launch(now);
          nextFlock = now + between(16000, 34000);
        }
      }
      for (let f = flocks.length - 1; f >= 0; f--) {
        const flock = flocks[f];
        const age = still ? 0 : now - flock.born;
        const x = flock.x + flock.vx * age;
        const y = flock.y + flock.vy * age;
        const reach = flock.birds.reduce((most, b) => Math.max(most, Math.abs(b.dx) + b.span), 0);
        if ((flock.vx > 0 && x - reach > width + 20) || (flock.vx < 0 && x + reach < -20)) {
          flocks.splice(f, 1);
          continue;
        }
        ctx.fillStyle = colour(flock.depth);
        for (const bird of flock.birds) {
          const drift = Math.sin(now * 0.00045 + bird.wanderPhase);
          const bob = Math.sin(now * 0.0011 + bird.wanderPhase * 2) * bird.span * 0.08;
          drawBird(ctx, x + bird.dx + drift * bird.wander, y + bird.dy + drift * bird.wander * 0.6 + bob, bird.span, wings(bird, now));
        }
      }
    },
  };
}

/**
 * Flies birds on their own transparent canvas, laid over the scene and only as tall as their band
 * of sky, so each frame redraws a handful of small shapes rather than the whole landscape.
 * Returns a function that draws the frame at `now`.
 */
export function flyBirds(canvas: HTMLCanvasElement, dpr: number, options: BirdOptions): (now: number) => void {
  const birds = makeBirds(options);
  const top = Math.max(0, birds.top - birds.margin);
  const height = birds.bottom + birds.margin - top;
  canvas.style.top = `${top}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.round(options.width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d')!;
  return (now) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
    birds.draw(ctx, now);
  };
}
