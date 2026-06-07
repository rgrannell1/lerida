// Service worker — generated from web/sw.template.js by bs/build.ts (the
// __VERSION__ and __PRECACHE__ sentinels are substituted with the content-hashed
// build). Precaches the app shell for offline / instant loads and runtime-caches
// OpenStreetMap tiles. Navigations are network-first (so a new deploy is picked
// up); same-origin hashed assets are cache-first (they're immutable).
//
// Every fetch path degrades gracefully: a rejected network request is never
// allowed to surface as an opaque "ServiceWorker intercepted the request and
// encountered an unexpected error" — we fall back to cache, then let the request
// pass through to the browser.

const CACHE = "lerida-__VERSION__";
const TILE_CACHE = "lerida-tiles";
const PRECACHE = ["__PRECACHE__"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // Resilient precache: one unreachable asset must not abort the whole
      // install (atomic addAll would), or the new worker never activates and
      // clients stay stuck on the previous one.
      .then((cache) => Promise.allSettled(PRECACHE.map((path) => cache.add(path))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE && name !== TILE_CACHE)
            .map((name) => caches.delete(name)),
        )
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  // Only GETs are cacheable; leave everything else to the browser.
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    // Network-first so a new deploy is picked up; fall back to the cached shell
    // offline, and to a live fetch if even that is missing.
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/index.html").then((hit) => hit || fetch(request))
      ),
    );
    return;
  }
  if (url.origin === self.location.origin) {
    // Cache-first for our own (content-hashed) assets. If it isn't cached, go to
    // the network; if the network rejects, try the cache once more rather than
    // letting respondWith reject with an opaque error.
    event.respondWith(
      caches.match(request).then((hit) =>
        hit ||
        fetch(request).catch((error) =>
          caches.match(request).then((retry) => {
            if (retry) {
              return retry;
            }
            throw error;
          })
        )
      ),
    );
    return;
  }
  const host = url.hostname;
  if (host === "tile.openstreetmap.org" || host.endsWith(".tile.openstreetmap.org")) {
    event.respondWith(cacheTile(request));
  }
});

// Stale-while-revalidate for tiles. Only successful responses are cached (so a
// 404/500 can't pin a permanently broken tile), and the refresh is tied to the
// event's lifetime so it isn't killed mid-write.
async function cacheTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  const fromNetwork = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);
  return cached || fromNetwork;
}
