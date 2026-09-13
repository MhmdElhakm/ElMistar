/* firebase-messaging-sw.js — Main Service Worker (FCM + Cache).
 * Firebase SDK auto-discovers this file at the root.
 * Handles: FCM background messages, push events, notification clicks, offline cache.
 * Deploy: place at public/ root (same level as index.html).
 */

/* ── Cache (offline support) ── */
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
          .then((res) => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {}); } return res; })
          .catch(() => cached);
        return cached || net;
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const net = fetch(e.request)
        .then((res) => { if (res && res.ok) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, cp)).catch(() => {}); } return res; })
        .catch(() => cached);
      return cached || net;
    })
  );
});

self.addEventListener('message', (e) => {
  if (e && e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting().catch(() => {});
});

/* ── Firebase Cloud Messaging ── */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyC8Gj1hufwwXrdO4zzQjPMeMg_KD3XSKDQ',
  projectId: 'project-84ae3235-3633-44c1-819',
  messagingSenderId: '1009475192148',
  appId: '1:1009475192148:web:5031fa8ddcbca4c860b4c1'
});

const fcm = firebase.messaging();

/* ── Background message handler ──
 * Fires when app is CLOSED or in background.
 * Data-only payloads (no notification field) arrive here. */
fcm.onBackgroundMessage((payload) => {
  const d = (payload && payload.data) || {};
  const title = d.title || 'ناقصنا إيه';
  const tab = d.tab || 'notifs';
  const url = './index.html#' + tab;
  const isUrgent = d.urgent === 'true';

  return self.registration.showNotification(title, {
    body: d.body || 'عندك تحديث جديد',
    icon: './icon-512.png',
    badge: './badge.png',
    image: d.image || undefined,
    dir: 'rtl',
    lang: 'ar',
    tag: d.nid || d.tag || 'naqisna-fcm',
    renotify: true,
    requireInteraction: true,
    vibrate: isUrgent ? [200, 100, 200, 100, 200] : [120, 60, 120],
    data: { url: url, tab: tab, nid: d.nid || '' },
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'dismiss', title: 'إغلاق' }
    ]
  });
});

/* ── Generic push handler ──
 * Catches any push event not handled by onBackgroundMessage. */
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { try { d = { body: e.data.text() }; } catch { d = {}; } }
  const title = d.title || 'ناقصنا إيه';
  const tab = d.tab || 'notifs';
  const url = './index.html#' + tab;
  const isUrgent = d.urgent === true || d.urgent === 'true';
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || 'عندك تحديث جديد',
      icon: d.icon || './icon-512.png',
      badge: d.badge || './badge.png',
      image: d.image,
      dir: 'rtl',
      lang: 'ar',
      tag: d.tag || d.nid || 'naqisna-push',
      renotify: true,
      requireInteraction: true,
      vibrate: isUrgent ? [200, 100, 200, 100, 200] : [120, 60, 120],
      data: { url: url, tab: tab, nid: d.nid || '' },
      actions: [
        { action: 'open', title: 'فتح' },
        { action: 'dismiss', title: 'إغلاق' }
      ]
    })
  );
});

/* ── Notification click ── */
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

/* ── Re-subscribe on browser rotation ── */
self.addEventListener('pushsubscriptionchange', (e) => {
  e.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (!sub) {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          clients.forEach((c) => { try { c.postMessage({ type: 'PUSH_RESUBSCRIBE' }); } catch {} });
        }
      } catch {}
    })()
  );
});
