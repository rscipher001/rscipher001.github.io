// The quiet pages: one calm scene and one moment (a quote, a reminder or a photo) per visit.
//   /pause/               blocked sites            LeechBlock: /pause/#$U
//   /delayed/lb-custom/   delayed sites            LeechBlock: /delayed/lb-custom/?$S&$U
//                         (LeechBlock runs the countdown in this page itself, see leechblock.ts)
//   /delayed/             what the address bar shows once LeechBlock has read the address above;
//                         reloading it goes back there. Also forwards the earlier /delayed/#$S&$U.
import { breathe, sceneBreath, type Breathing } from './breathe';
import { followDelay } from './leechblock';
import { toggleRain } from './rain';
import { PALETTES, SCENES, paint, periodOf, type Palette, type Period, type SceneName } from './scenes';

type Look = 'light' | 'dark';
type Mode = 'pause' | 'delayed' | 'forward';

interface Destination {
  url: string;
  host: string;
  /** LeechBlock is blocking this very site, so it would keep sending us back here. */
  ours: boolean;
}

interface Moment {
  id: string;
  kind: 'quote' | 'reminder' | 'image';
  text?: string;
  by?: string;
  src?: string;
  alt?: string;
  caption?: string;
  time?: Period;
}

/** The page LeechBlock runs its countdown in: it does so for any address containing "lb-custom". */
const LB_PAGE = '/delayed/lb-custom/';

const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;

// Remembers what was shown lately so the next visit brings something else.
const memory = {
  get(key: string): string[] {
    try {
      return JSON.parse(localStorage.getItem(`pause:${key}`) ?? '[]');
    } catch {
      return [];
    }
  },
  set(key: string, value: string[]) {
    try {
      localStorage.setItem(`pause:${key}`, JSON.stringify(value));
    } catch {
      // Private browsing: every visit is simply a fresh pick.
    }
  },
};

function pick<T>(items: T[], key: (item: T) => string, memoryKey: string, keep: number): T {
  const recent = memory.get(memoryKey);
  const fresh = items.filter((item) => !recent.includes(key(item)));
  const pool = fresh.length ? fresh : items;
  const choice = pool[Math.floor(Math.random() * pool.length)];
  memory.set(memoryKey, [key(choice), ...recent.filter((id) => id !== key(choice))].slice(0, Math.min(keep, items.length - 1)));
  return choice;
}

/** Reload, but never twice within a few seconds: whatever happens, this page can't spin. */
function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem('quiet:reloaded') ?? 0);
    if (Date.now() - last < 4000) return;
    sessionStorage.setItem('quiet:reloaded', String(Date.now()));
  } catch {
    return; // Without storage there's no way to tell a loop apart, so don't reload at all.
  }
  location.reload();
}

/**
 * Splits this page's address into our own options and the address LeechBlock passed on. LeechBlock
 * fills in $U (the blocked address) and $S (the block set's number) wherever they appear, so any of
 * #$U, #$S&$U, ?$S&$U or ?wait=15&$S&$U can arrive. The blocked address is everything from its
 * http(s):// onwards; a number just before it is the block set; anything earlier in the query is ours.
 */
function readAddress(): { options: string; raw?: string; set?: string } {
  const start = /https?(:|%3A)(\/|%2F){2}/i;
  const setBefore = (text: string) => /(?:^|&)(\d+)&$/.exec(text)?.[1];
  const hash = location.hash.slice(1);
  const query = location.search.slice(1);
  const inHash = hash.search(start);
  if (inHash >= 0) return { options: query, raw: hash.slice(inHash), set: setBefore(hash.slice(0, inHash)) };
  const inQuery = query.search(start);
  if (inQuery >= 0) {
    const before = query.slice(0, inQuery);
    // Drop a trailing "&5&" (the set number) or a lone "&", but keep a value like "wait=20".
    return { options: before.replace(/(^|&)\d*&?$/, ''), raw: query.slice(inQuery), set: setBefore(before) };
  }
  return { options: query };
}

function destination(raw: string | undefined): Destination | undefined {
  if (!raw) return undefined;
  for (const candidate of [() => raw, () => decodeURIComponent(raw)]) {
    try {
      const url = new URL(candidate());
      if (!/^https?:$/.test(url.protocol)) return undefined;
      return { url: url.href, host: url.hostname.replace(/^www\./, ''), ours: url.host === location.host };
    } catch {
      // Try the next reading of the address.
    }
  }
  return undefined;
}

// Light or dark is remembered for this page only, separately from the rest of the site.
const savedLook = (): Look | null => {
  try {
    const look = localStorage.getItem('pause:look');
    return look === 'light' || look === 'dark' ? look : null;
  } catch {
    return null;
  }
};

const saveLook = (look: Look) => {
  try {
    localStorage.setItem('pause:look', look);
  } catch {
    // Not remembered in private browsing; it still applies to this visit.
  }
};

/** Dark is always the night garden. Light follows the clock, and stays at dusk late at night. */
const paletteFor = (look: Look, period: Period): Palette =>
  look === 'dark' ? PALETTES.night : PALETTES[period === 'night' ? 'evening' : period];

function showMoment(moment: Moment) {
  const figure = $('.pause__moment');
  const quote = figure.querySelector('blockquote')!;
  const caption = figure.querySelector('figcaption')!;
  figure.dataset.kind = moment.kind;
  if (moment.kind === 'image') {
    quote.hidden = !moment.caption;
    quote.querySelector('p')!.textContent = moment.caption ?? '';
    caption.hidden = true;
  } else {
    quote.querySelector('p')!.textContent = moment.text ?? '';
    caption.textContent = moment.by ?? '';
    caption.hidden = !moment.by;
  }
}

function start() {
  const mode = (document.body.dataset.mode ?? 'pause') as Mode;
  const address = readAddress();
  const to = destination(address.raw);

  if (mode === 'forward') {
    // A reload of the tidied address: go back to the full one so LeechBlock starts its countdown again.
    const full: unknown = history.state?.leechblock;
    if (typeof full === 'string' && full.startsWith(`${location.origin}${LB_PAGE}?`)) {
      location.replace(full);
      return;
    }
    // The delayed page's earlier address: hand over to the page LeechBlock can run its countdown in.
    if (to && address.set && !to.ours) {
      location.replace(`${LB_PAGE}?${address.set}&${to.url}`);
      return;
    }
  }

  const params = new URLSearchParams(address.options);
  const moments: Moment[] = JSON.parse($('#moments').textContent ?? '[]');
  const prefersDark = matchMedia('(prefers-color-scheme: dark)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ?at=, ?look=, ?scene= and ?moment= let you preview any combination.
  const at = params.get('at') as Period | null;
  const period = at && at in PALETTES ? at : periodOf(new Date());
  const preview = params.get('look');
  let look: Look =
    preview === 'light' || preview === 'dark' ? preview : (savedLook() ?? (prefersDark || period === 'night' ? 'dark' : 'light'));
  let palette = paletteFor(look, period);

  const forTime = moments.filter((m) => !m.time || m.time === period);
  const moment = moments.find((m) => m.id === params.get('moment')) ?? pick(forTime, (m) => m.id, 'recent', 12);
  showMoment(moment);

  // Tidy the address bar so the blocked address isn't kept in history or bookmarks. The delayed page
  // waits until LeechBlock has read it (see tidyDelayed below).
  if (mode !== 'delayed' && address.raw) {
    history.replaceState(null, '', `${location.pathname}${address.options ? `?${address.options}` : ''}`);
  }
  // Landing here again from a tab that's already on this page only changes the #part: start afresh,
  // unless the new address is this site itself (LeechBlock blocking this page; reloading would loop).
  addEventListener('hashchange', () => {
    if (!destination(readAddress().raw)?.ours) reloadOnce();
  });
  // Coming back with the Back button shows a frozen copy of the page; start it again instead.
  addEventListener('pageshow', (event) => event.persisted && reloadOnce());

  const note = $('.pause__from');
  const say = (text: string) => {
    note.textContent = text;
    note.hidden = false;
  };

  // What the moment is about: a blocked site, a countdown, or a site that can wait.
  const breatheButton = $<HTMLButtonElement>('[data-action="breathe"]');
  const canWait = /^can-wait=([^&]*)(&breathe)?$/.exec(location.hash.slice(1));
  let countingDown = false;
  if (to?.ours) {
    say(`LeechBlock is blocking this page too, so it would keep sending you back here. Add +${location.host} to the site list of each block set.`);
  } else if (mode === 'forward' && to) {
    say(
      `You were about to open ${to.host}. This page's address has changed: in LeechBlock, set this block set's page to https://${location.host}/delayed/lb-custom/?$S&$U`,
    );
  } else if (mode === 'delayed' && canWait) {
    say(`${decodeURIComponent(canWait[1])} can wait.`);
    history.replaceState(null, '', '/delayed/');
    if (canWait[2]) queueMicrotask(() => breatheButton.click());
  } else if (mode === 'delayed' && to) {
    countingDown = true;
    const box = $('.pause__countdown');
    const text = $('.pause__countdown-text');
    const bar = box.querySelector<HTMLElement>('.pause__progress span')!;
    const stay = $<HTMLButtonElement>('[data-action="stay"]');
    const onward = $<HTMLAnchorElement>('.pause__continue');
    const plural = (n: number) => (n === 1 ? '1 second' : `${n} seconds`);
    // Leaving the page is the only way to stop LeechBlock's countdown, so "stay" loads it again without
    // the blocked address and remembers the choice after the #. (By path, not location.pathname: once
    // tidied that's /delayed/, and changing only the # wouldn't load a new page.)
    const stayHere = (thenBreathe = false) =>
      location.replace(`${LB_PAGE}#can-wait=${encodeURIComponent(to.host)}${thenBreathe ? '&breathe' : ''}`);

    stay.addEventListener('click', () => stayHere());
    breatheButton.addEventListener('click', (event) => {
      if (!countingDown) return;
      event.stopImmediatePropagation();
      stayHere(true);
    });

    // LeechBlock reads this page's address once, when its script starts; its first tick means it has.
    // From then on the address bar can show /delayed/, keeping the full address for a reload.
    let tidied = false;
    const tidyDelayed = () => {
      if (tidied) return;
      tidied = true;
      history.replaceState({ leechblock: location.href }, '', '/delayed/');
    };

    followDelay({
      tick(left, fraction) {
        tidyDelayed();
        if (!countingDown) {
          // The countdown arrived after missing() gave up on it.
          countingDown = true;
          note.hidden = true;
        }
        box.hidden = false;
        stay.hidden = false;
        text.textContent = left > 0 ? `${to.host} opens in ${plural(left)}.` : `Opening ${to.host}.`;
        bar.style.transform = `scaleX(${fraction})`;
      },
      ready() {
        countingDown = false;
        text.textContent = `${to.host} is ready when you are.`;
        onward.href = to.url;
        onward.textContent = `Open ${to.host}`;
        onward.hidden = false;
      },
      cancelled() {
        countingDown = false;
        text.textContent = 'The countdown stopped because you left this tab. Reload the page to start it again.';
        box.classList.add('is-stopped');
      },
      missing() {
        countingDown = false;
        say(
          `You were about to open ${to.host}. LeechBlock didn't start its countdown on this page, usually because it isn't allowed to run on websites. In Firefox, open about:addons, choose LeechBlock NG, turn on “Access your data for all websites” under Permissions, then reload this page.`,
        );
      },
    });
  } else if (to) {
    say(`You were about to open ${to.host}.`);
  }

  // The backdrop: the visitor's own photo, or a freshly drawn scene.
  const canvas = $<HTMLCanvasElement>('.pause__scene');
  const birdCanvas = $<HTMLCanvasElement>('.pause__birds');
  const photographed = moment.kind === 'image' && moment.src;
  const requested = params.get('scene') as SceneName | null;
  const scene = requested && SCENES.includes(requested) ? requested : pick(SCENES, (s) => s, 'scenes', 1);
  const seed = String(Math.random());
  // The scene breathes slowly on its own, and with you while the breathing guide runs.
  const air = sceneBreath();
  let stopScene = () => {};
  const draw = () => {
    stopScene();
    if (!photographed) stopScene = paint(canvas, birdCanvas, scene, palette, seed, still, air.at);
  };

  if (photographed) {
    const photo = $<HTMLImageElement>('.pause__photo');
    photo.src = moment.src!;
    photo.alt = moment.alt ?? '';
    photo.hidden = false;
    canvas.hidden = true;
  }

  const toggle = $<HTMLButtonElement>('.pause__look');
  const applyLook = () => {
    palette = paletteFor(look, period);
    const root = document.documentElement.style;
    root.setProperty('--ground', palette.ground);
    root.setProperty('--ink', palette.ink);
    root.setProperty('--ink-soft', palette.inkSoft);
    document.documentElement.dataset.dark = String(palette.dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.ground);
    toggle.setAttribute('aria-label', look === 'dark' ? 'Switch to the light version' : 'Switch to the dark version');
    draw();
  };
  applyLook();

  toggle.addEventListener('click', () => {
    look = look === 'dark' ? 'light' : 'dark';
    saveLook(look);
    applyLook();
    // The new scene surfaces gently from the ground colour.
    if (!still && !photographed) canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, easing: 'ease-out' });
  });

  let resizing = 0;
  addEventListener('resize', () => {
    clearTimeout(resizing);
    resizing = window.setTimeout(draw, 150);
  });

  document.body.classList.add('is-ready');

  // Breathing guide.
  const breath = $('.pause__breath');
  let session: Breathing | undefined;
  const finish = (finished: boolean) => {
    session = undefined;
    air.end(performance.now());
    breatheButton.textContent = 'Breathe for a minute';
    setTimeout(() => document.body.classList.remove('is-breathing'), finished ? 2500 : 0);
  };
  breatheButton.addEventListener('click', () => {
    if (session) return session.stop();
    document.body.classList.add('is-breathing');
    breatheButton.textContent = 'Stop';
    const start = performance.now();
    air.start(start);
    session = breathe(breath.querySelector('.pause__ring')!, breath.querySelector('.pause__breath-label')!, finish, start);
  });

  // Rain.
  const rainButton = $<HTMLButtonElement>('[data-action="rain"]');
  rainButton.addEventListener('click', async () => {
    const playing = await toggleRain();
    rainButton.setAttribute('aria-pressed', String(playing));
    rainButton.textContent = playing ? 'Stop the rain' : 'Listen to rain';
  });
}

start();
