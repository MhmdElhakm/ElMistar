const CACHE = 'naqisna-v3';
const ASSETS = ['./', './index.html', './logo.png', './icon-192.png', './icon-512.png', './badge.png', './manifest.webmanifest'];

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

/* Web Push: show notification from server payload (title/body only, no secrets). */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { try { d = { body: e.data.text() }; } catch { d = {}; } }
  const title = d.title || 'ناقصنا إيه';
  const tab = d.tab || 'notifs';
  const url = './index.html#' + tab;
  const opts = {
    body: d.body || 'عندك تحديث جديد',
    icon: d.icon || './icon-512.png',
    badge: d.badge || './badge.png',
    image: d.image,
    dir: 'rtl',
    lang: 'ar',
    tag: d.tag || 'naqisna-push',
    renotify: true,
    requireInteraction: d.urgent === true,
    vibrate: [120, 60, 120],
    data: { url: url, tab: tab, nid: d.nid || '' },
    actions: [{ action: 'open', title: 'فتح' }, { action: 'dismiss', title: 'إغلاق' }]
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

/* Focus existing app window if open, else open deep-linked page. */
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const target = (e.notification.data && e.notification.data.url) || './index.html#notifs';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        try {
          if (c.url.indexOf('index.html') >= 0 || c.url.replace(/[#?].*$/, '').endsWith('/')) {
            c.navigate(target).catch(() => {});
            return c.focus();
          }
        } catch {}
      }
      return self.clients.openWindow(target);
    }).catch(() => { try { return self.clients.openWindow(target); } catch {} })
  );
});

self.addEventListener('notificationclose', () => {});

/* Best-effort re-subscribe when the browser rotates the subscription. */
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const reg = await self.registration.pushManager.getSubscription();
        if (!reg) {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          clients.forEach((c) => { try { c.postMessage({ type: 'PUSH_RESUBSCRIBE' }); } catch {} });
        }
      } catch {}
    })()
  );
});
