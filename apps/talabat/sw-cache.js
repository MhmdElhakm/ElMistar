/* sw-cache.js — Offline Service Worker.
 * PWA offline caching only (no notifications).
 */

const CACHE_NAME = 'naqisna-pwa-v19';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './supabase-client.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn('[SW] Pre-cache failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME && !k.startsWith('mushaf-offline-')).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // صفحات HTML: الشبكة أولاً لضمان وصول التحديثات، والكاش احتياطي عند انقطاع النت
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true, ignoreVary: true })
          .then((c) => {
            if (c) return c;
            const path = new URL(event.request.url).pathname;
            // The Mushaf has its own page + offline cache; serve it when the directory URL was not cached
            const fallback = /\/quran\//.test(path) ? '/quran/index.html' : './index.html';
            return caches.match(fallback, { ignoreSearch: true, ignoreVary: true })
              .then((f) => f || caches.match('./index.html'));
          }))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true, ignoreVary: true }).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache)).catch(() => {});
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting().catch(() => {});
  }
});
