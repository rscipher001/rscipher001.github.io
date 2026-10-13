// Service worker that keeps the whole site readable offline.
//
// The build (src/integrations/offline.ts) prepends two constants to this file:
//   VERSION  - a hash of every precached file, so any change ships a new cache
//   PRECACHE - the list of URLs to save on install
// It is not processed by Vite; keep it plain, dependency-free JavaScript.

/* global VERSION, PRECACHE */

const SITE_CACHE = `site-${VERSION}`;
const EXTRA_CACHE = 'extra';
const EXTRA_LIMIT = 80;
const NETWORK_TIMEOUT_MS = 3500;
const OFFLINE_PAGE = '/offline/';
// The pages LeechBlock sends you to. They open instantly from the saved copy.
const QUIET_PAGES = ['/pause/', '/pause/lb-custom/', '/delayed/', '/delayed/lb-custom/'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SITE_CACHE)
      // `reload` skips the HTTP cache so we never save a stale copy.
      .then((cache) => cache.addAll(PRECACHE.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('site-') && key !== SITE_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // The quiet pages open instantly from the saved copy; other pages prefer fresh content.
    const quiet = QUIET_PAGES.find((path) => url.pathname === path || url.pathname === path.slice(0, -1));
    event.respondWith(quiet ? instant(event, quiet) : page(request, url));
  } else if (url.pathname.startsWith('/_astro/')) {
    // Fingerprinted build output never changes under the same name.
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Pages: fresh from the network when it answers in time, otherwise the saved copy.
async function page(request, url) {
  const network = fetch(request).then(async (response) => {
    if (response.ok) {
      const cache = await caches.open(SITE_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  });

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  const fast = await Promise.race([network.catch(() => null), timeout]);
  if (fast) return fast;

  const saved = await savedPage(url);
  if (saved) return saved;

  // Nothing saved: keep waiting on the network, then fall back to the offline page.
  const late = await network.catch(() => null);
  return late ?? (await lookup(OFFLINE_PAGE)).response ?? new Response('Offline', { status: 503 });
}

// The saved copy right away, refreshed in the background for next time. The refresh asks for the
// plain page, so a blocked address passed in the query (LeechBlock's ?$S&$U) is never sent on.
async function instant(event, path) {
  const refresh = fetch(path, { cache: 'no-cache' })
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(SITE_CACHE);
        await cache.put(path, response.clone());
      }
      return response;
    })
    .catch(() => null);
  const saved = (await lookup(path)).response;
  if (saved) {
    event.waitUntil(refresh);
    return saved;
  }
  return (await refresh) ?? (await lookup(OFFLINE_PAGE)).response ?? new Response('Offline', { status: 503 });
}

async function savedPage(url) {
  const path = url.pathname;
  const candidates = [path, path.endsWith('/') ? `${path}index.html` : `${path}/`];
  for (const candidate of candidates) {
    const { response } = await lookup(candidate);
    // A navigation can't be answered with a response that was itself redirected.
    if (response) return response.redirected ? new Response(response.body, response) : response;
  }
  return null;
}

async function cacheFirst(request) {
  const { response } = await lookup(request);
  if (response) return response;
  const fresh = await fetch(request);
  if (fresh.ok) await remember(EXTRA_CACHE, request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request) {
  const { response, cacheName } = await lookup(request);
  const refresh = fetch(request)
    .then(async (fresh) => {
      if (fresh.ok) await remember(cacheName ?? EXTRA_CACHE, request, fresh.clone());
      return fresh;
    })
    .catch(() => null);
  return response ?? (await refresh) ?? new Response('', { status: 504 });
}

// The current site cache always wins over the extra cache, whatever their creation order.
async function lookup(request) {
  for (const cacheName of [SITE_CACHE, EXTRA_CACHE]) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request, { ignoreSearch: true });
    if (response) return { response, cacheName };
  }
  return { response: null, cacheName: null };
}

// Files outside the precache (large images, new files) go to the extra cache, capped in size.
async function remember(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
  if (cacheName !== EXTRA_CACHE) return;
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - EXTRA_LIMIT)).map((key) => cache.delete(key)));
}
