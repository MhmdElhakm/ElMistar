/* sw-cache.js — Offline Service Worker.
 * PWA offline caching only (no notifications).
 */

const CACHE_NAME = 'naqisna-pwa-v21';
const CAIRO_FONT_CSS = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './offline-cairo.css',
  './logo.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './supabase-client.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        await cache.addAll(ASSETS_TO_CACHE);

        // Warm the browser cache for Cairo while online so the app keeps the
        // same Arabic font after the device goes offline. This is best-effort:
        // the app still loads normally if Google Fonts is unavailable.
        try {
          const response = await fetch(CAIRO_FONT_CSS, { mode: 'cors' });
          if (!response.ok) return;
          const css = await response.text();
          const fontUrls = [...css.matchAll(/https:\/\/fonts\.gstatic\.com\/[^)]+/g)].map((m) => m[0]);
          await cache.put(CAIRO_FONT_CSS, new Response(css, {
            headers: { 'Content-Type': 'text/css; charset=utf-8' }
          }));
          await Promise.all(fontUrls.map(async (url) => {
            try {
              const fontResponse = await fetch(url, { mode: 'cors' });
              if (fontResponse.ok) await cache.put(url, fontResponse);
            } catch (_) {}
          }));
        } catch (_) {}
      })
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
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname.endsWith('/offline-cairo.css')) {
    event.respondWith(
      caches.match(CAIRO_FONT_CSS).then((cached) => {
        if (!cached) return new Response('body{font-family:Cairo, sans-serif}', { headers: { 'Content-Type': 'text/css' } });
        return cached.text().then((css) => {
          const rewritten = css.replace(/https:\/\/fonts\.gstatic\.com\/[^)]+/g, (url) =>
            '/__cairo_font?url=' + encodeURIComponent(url)
          );
          return new Response(rewritten, { headers: { 'Content-Type': 'text/css; charset=utf-8' } });
        });
      })
    );
    return;
  }
  if (requestUrl.pathname.endsWith('/__cairo_font')) {
    const sourceUrl = requestUrl.searchParams.get('url');
    if (!sourceUrl) return;
    event.respondWith(
      caches.match(sourceUrl).then((cached) => {
        const online = fetch(sourceUrl, { mode: 'cors' }).then((response) => {
          if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(sourceUrl, response.clone())).catch(() => {});
          return response;
        }).catch(() => cached);
        return cached || online;
      })
    );
    return;
  }

  // Streamed Quran recitation audio: bypass the SW so the browser handles range requests natively
  if (event.request.url.indexOf('cdn.islamic.network') !== -1) return;

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
