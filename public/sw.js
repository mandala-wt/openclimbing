// Offline shell for Klettersteig-Karte. Static file, served as an asset.
const CACHE = 'kletterglueck-offline-v1';
const PRECACHE = [
  '/klettersteig/climbs.jsonl',
  '/klettersteig/icon-32.png',
  '/klettersteig/icon-192.png',
  '/klettersteig/icon-512.png',
  '/icons-climbing/sprites/climbing.json',
  '/icons-climbing/sprites/climbing.png',
  '/manifest-openclimbing.json',
];

const sameOrigin = (url) => url.origin === self.location.origin;

const isStatic = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/klettersteig/') ||
  url.pathname.startsWith('/icons') ||
  url.pathname.startsWith('/sprites/') ||
  url.pathname.endsWith('.json') ||
  url.pathname.endsWith('.png') ||
  url.pathname.endsWith('.svg') ||
  url.pathname.endsWith('.woff2');

const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
};

const networkFirst = async (request) => {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const hit = await cache.match(request);
    if (hit) return hit;
    if (request.mode === 'navigate') {
      const start = await cache.match('/start');
      if (start) return start;
    }
    throw error;
  }
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE.map((url) =>
            cache.add(url).catch(() => undefined),
          ),
        ),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (!sameOrigin(url)) return;
  if (url.pathname.startsWith('/api/')) return;
  if (isStatic(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request));
  }
});
