// A one-minute breathing guide: in for four seconds, out for six, six times.
const IN = 4000;
const OUT = 6000;
const ROUNDS = 6;

export interface Breathing {
  stop(): void;
}

/**
 * Runs the guide. `label` shows the instruction; the ring's size follows the breath through
 * the --breath custom property (0 = empty, 1 = full). Calls `done` when the minute is over.
 */
export function breathe(ring: HTMLElement, label: HTMLElement, done: (finished: boolean) => void): Breathing {
  const start = performance.now();
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
    const t = elapsed % (IN + OUT);
    const inhaling = t < IN;
    // Ease in and out like a real breath: slow at the turns.
    const progress = inhaling ? t / IN : 1 - (t - IN) / OUT;
    const eased = (1 - Math.cos(progress * Math.PI)) / 2;
    ring.style.setProperty('--breath', eased.toFixed(3));
    const text = inhaling ? 'Breathe in' : 'Breathe out';
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
