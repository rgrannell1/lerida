// Service worker — generated from web/sw.template.js by bs/build.ts (the
// __VERSION__ and __PRECACHE__ sentinels are substituted with the content-hashed
// build). Precaches the app shell for offline / instant loads and runtime-caches
// OpenStreetMap tiles. Navigations are network-first (so a new deploy is picked
// up); same-origin hashed assets are cache-first (they're immutable).

const CACHE = "lerida-__VERSION__";
const TILE_CACHE = "lerida-tiles";
const PRECACHE = ["__PRECACHE__"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
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
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }
  if (url.origin === self.location.origin) {
    event.respondWith(caches.match(request).then((hit) => hit || fetch(request)));
    return;
  }
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    event.respondWith(cacheTile(request));
  }
});

async function cacheTile(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  const fromNetwork = fetch(request)
    .then((response) => {
      cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fromNetwork;
}
