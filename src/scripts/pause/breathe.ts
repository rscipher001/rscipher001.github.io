// A one-minute breathing guide: in for four seconds, out for six, six times.
const IN = 4000;
const OUT = 6000;
const ROUNDS = 6;

/** How full the lungs are `elapsed` ms into the rhythm: 0 = empty, 1 = full. Slow at the turns. */
export function breathAt(elapsed: number): number {
  const t = ((elapsed % (IN + OUT)) + IN + OUT) % (IN + OUT);
  const progress = t < IN ? t / IN : 1 - (t - IN) / OUT;
  return (1 - Math.cos(progress * Math.PI)) / 2;
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

/**
 * The scene breathes too: shallowly on its own, and fully in time with the guide while it runs,
 * easing between the two over a couple of seconds so nothing ever jumps.
 */
export function sceneBreath() {
  const EASE = 2500;
  let guided: { start: number; end?: number } | undefined;
  return {
    start(now: number) {
      guided = { start: now };
    },
    end(now: number) {
      if (guided) guided.end = now;
    },
    /** 0 = empty, 1 = a full guided breath. */
    at(now: number): number {
      const calm = 0.5 * breathAt(now);
      if (!guided) return calm;
      const weight = Math.min(smooth((now - guided.start) / EASE), guided.end === undefined ? 1 : 1 - smooth((now - guided.end) / EASE));
      return calm + (breathAt(now - guided.start) - calm) * weight;
    },
  };
}

export interface Breathing {
  stop(): void;
}

/**
 * Runs the guide. `label` shows the instruction; the ring's size follows the breath through
 * the --breath custom property (0 = empty, 1 = full). Calls `done` when the minute is over.
 */
export function breathe(ring: HTMLElement, label: HTMLElement, done: (finished: boolean) => void, start = performance.now()): Breathing {
  let frame = 0;
  let stopped = false;

  const tick = (now: number) => {
    if (stopped) return;
    const elapsed = now - start;
    if (elapsed >= ROUNDS * (IN + OUT)) {
      ring.style.setProperty('--breath', '0');
      label.textContent = 'That was a minute.';
      done(true);
      return;
    }
    ring.style.setProperty('--breath', breathAt(elapsed).toFixed(3));
    const text = elapsed % (IN + OUT) < IN ? 'Breathe in' : 'Breathe out';
    if (label.textContent !== text) label.textContent = text;
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      stopped = true;
      cancelAnimationFrame(frame);
      done(false);
    },
  };
}
