/* sw.js — Offline cache service worker.
 * FCM background messaging is handled by firebase-messaging-sw.js (separate file).
 * This worker only manages caching for offline support. */

const CACHE = 'naqisna-v6';
const ASSETS = ['./', './index.html', './logo.png', './icon-192.png', './icon-512.png', './badge.png', './manifest.webmanifest', './sounds/audio-library.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .catch(() => {})
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url || '';
  if (url.includes('/sounds/')) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const net = fetch(e.request)
          .then((res) => {
            if (res && res.ok) {
              const cp = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached);
        return cached || net;
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request)
        .then((res) => {
          if (res && res.ok) {
            const cp = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {});
          }
          return res;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});

self.addEventListener('message', (e) => {
  if (e && e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting().catch(() => {});
});
