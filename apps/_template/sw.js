const CACHE_NAME = 'elmistar-app-v1';
const ASSETS_TO_CACHE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return Promise.allSettled(
          ASSETS_TO_CACHE.map(function (url) { return cache.add(url).catch(function () { return null; }); })
        );
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (names) {
        return Promise.all(names.map(function (n) {
          if (n !== CACHE_NAME) return caches.delete(n);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request)
        .then(function (res) {
          if (!res || res.status !== 200 || res.type !== 'basic') return res;
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          return res;
        })
        .catch(function () {
          if (event.request.mode === 'navigate') return caches.match('./index.html');
        });
    })
  );
});
