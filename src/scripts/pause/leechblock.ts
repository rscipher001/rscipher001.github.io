// LeechBlock (1.7 or newer) runs its own countdown in any page whose address contains "lb-custom".
// It injects its blocked.js, which reads the block set and blocked address from this page's query
// (?$S&$U), writes the seconds left into #lbDelaySeconds once a second, and at zero tells LeechBlock
// to let the site through, loading it too if "Automatically load blocked page" is on. If
// "Cancel delay countdown if delaying page loses focus" is on and you leave, it strikes through
// #lbCountdownText and stops. This page can't drive that countdown, only watch it and reflect it.

/**
 * At /pause/lb-custom/, LeechBlock's script fills in the blocked address and, when the block has an
 * end (a time period, a time limit, certain days), the time it lifts, formatted for your locale.
 * Calls `read` once LeechBlock has read this page's address, with that time if there is one, or
 * after a few seconds with nothing if LeechBlock isn't running here.
 */
export function followBlock(read: (until?: string) => void) {
  const address = document.getElementById('lbBlockedURL');
  const until = document.getElementById('lbUnblockTime');
  if (!address || !until) return read();
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    // LeechBlock gives seconds too ("17:00:00", "5:00:00 PM"); minutes are enough.
    const time = until.textContent?.trim().replace(/(\d{1,2}[:.]\d{2})[:.]\d{2}(?!\d)/, '$1');
    read(time || undefined);
  };
  // It writes the address first and the time straight after, in the same moment.
  const observer = new MutationObserver(finish);
  observer.observe(address, { childList: true, characterData: true, subtree: true });
  if (address.textContent) finish();
  setTimeout(finish, 3000);
}

export interface DelayView {
  /** Seconds left, and how much of the wait has passed (0–1). */
  tick(left: number, fraction: number): void;
  /** Still here two seconds after zero: LeechBlock isn't loading the site itself, so offer a link. */
  ready(): void;
  /** LeechBlock stopped the countdown because the tab lost focus. */
  cancelled(): void;
  /** No countdown arrived: LeechBlock isn't running here, or this block set has no delay. */
  missing(): void;
}

export function followDelay(view: DelayView) {
  const seconds = document.getElementById('lbDelaySeconds')!;
  const label = document.getElementById('lbCountdownText')!;
  let total = 0;
  let finished = false;

  const read = () => {
    const left = Number.parseInt(seconds.textContent ?? '', 10);
    if (!Number.isFinite(left)) return;
    total ||= Math.max(left, 1);
    view.tick(left, 1 - left / total);
    if (left <= 0 && !finished) {
      finished = true;
      setTimeout(() => view.ready(), 2000);
    }
  };

  new MutationObserver(read).observe(seconds, { childList: true, characterData: true, subtree: true });
  new MutationObserver(() => {
    if (label.style.textDecoration.includes('line-through')) view.cancelled();
  }).observe(label, { attributes: true, attributeFilter: ['style'] });

  read();
  setTimeout(() => total || view.missing(), 3000);
}
