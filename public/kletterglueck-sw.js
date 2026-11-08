/* Kletterglück shell cache. Our own files only — never map tiles or /api. */
const CACHE = 'kletterglueck-shell-v1';
const MAX_ENTRIES = 80;
const FEATURE_PATH = /^\/(node|way|relation)\/\d+(?:\/.*)?$/;
const STATIC_FILE = /\.(?:js|css|woff2?|png|svg|ico|webmanifest)$/;

const shouldStore = (rawUrl) => {
  let url;
  try {
    url = new URL(rawUrl);
  } catch (error) {
    return false;
  }
  if (url.origin !== self.location.origin) return false;
  const pathname = url.pathname;
  if (pathname.startsWith('/api/')) return false;
  if (pathname.indexOf('webpack-hmr') !== -1 || pathname.indexOf('hot-update') !== -1) {
    return false;
  }
  if (pathname.startsWith('/_next/data/')) return false;
  if (pathname.startsWith('/_next/static/')) return true;
  if (pathname.startsWith('/klettersteig/')) return true;
  if (
    pathname === '/' ||
    pathname === '/unterwegs' ||
    pathname === '/notfall' ||
    pathname === '/unterwegs.html' ||
    pathname === '/kletterglueck-field.js' ||
    pathname === '/kletterglueck-sw.js' ||
    pathname === '/start'
  ) {
    return true;
  }
  if (FEATURE_PATH.test(pathname)) return true;
  return STATIC_FILE.test(pathname);
};

const trim = async (cache) => {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;
  await Promise.all(
    keys.slice(0, keys.length - MAX_ENTRIES).map((key) => cache.delete(key)),
  );
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(['/unterwegs.html', '/kletterglueck-field.js']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.indexOf('kletterglueck-shell-') === 0 && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !shouldStore(request.url)) return;
  const url = new URL(request.url);
  const immutable =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/unterwegs.html' ||
    url.pathname === '/kletterglueck-field.js';

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      if (immutable) {
        const cached = await cache.match(request);
        if (cached) return cached;
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timer);
        if (response && response.ok && response.type === 'basic') {
          await cache.put(request, response.clone());
          await trim(cache);
        }
        return response;
      } catch (error) {
        clearTimeout(timer);
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const fallback = await cache.match('/unterwegs.html');
          if (fallback) return fallback;
        }
        throw error;
      }
    })(),
  );
});
