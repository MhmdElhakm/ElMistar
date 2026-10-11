/* sw-cache.js — Offline Service Worker + System Notifications.
 * PWA offline caching + عرض إشعارات النظام والتعامل مع الضغط عليها.
 */

const CACHE_NAME = 'naqisna-pwa-v16';
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
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
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
        .catch(() => caches.match(event.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
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

// الضغط على إشعار النظام يفتح التطبيق (كان ناقصاً — بدونه الضغط لا يفعل شيئاً).
self.addEventListener('notificationclick', (event) => {
  try { event.notification.close(); } catch (e) {}
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (var i = 0; i < list.length; i++) {
        try { list[i].focus(); return; } catch (e) {}
      }
      try { return clients.openWindow('./index.html'); } catch (e) {}
    }).catch(() => {})
  );
});

self.addEventListener('notificationclose', () => {});

self.addEventListener('push', (event) => {
  var title = 'ناقصنا إيه 🔔';
  var opts = { body: 'عندك تحديث جديد', icon: './icon-192.png', badge: './icon-192.png', tag: 'naqisna-push' };
  try {
    if (event.data) {
      try {
        var d = event.data.json();
        if (d.title) title = d.title;
        if (d.body) opts.body = d.body;
        if (d.tag) opts.tag = d.tag;
      } catch (e) { try { opts.body = event.data.text(); } catch (e2) {} }
    }
  } catch (e) {}
  event.waitUntil(self.registration.showNotification(title, opts).catch(() => {}));
});
