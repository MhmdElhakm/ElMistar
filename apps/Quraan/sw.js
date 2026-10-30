var CACHE_NAME = 'quran-pro-app-v46';
var APP_SHELL = [
  './index.html',
  './tajweed-font-data.js',
  './worship-data.js',
  './worship-ui.js',
  './integrated-services-data.js',
  './ruqya-ui.js',
  './integrated-services.js',
  './prayer-times.js',
  './manifest.webmanifest',
  './logo.png',
  './note.mp3',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key.indexOf('quran-pro-app-') === 0 && key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  var requestUrl = new URL(request.url);
  if (requestUrl.pathname.endsWith('/note.mp3') && request.headers.has('range')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match('./note.mp3').then(function (cached) {
          if (!cached) return fetch(request);
          return cached.arrayBuffer().then(function (body) {
            var range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') || '');
            if (!range || (!range[1] && !range[2])) {
              return new Response(null, {
                status: 416,
                headers: { 'Content-Range': 'bytes */' + body.byteLength }
              });
            }
            var start = range[1] ? Number(range[1]) : Math.max(0, body.byteLength - Number(range[2]));
            var end = range[2] ? Number(range[2]) : body.byteLength - 1;
            if (start >= body.byteLength || start > end) {
              return new Response(null, {
                status: 416,
                headers: { 'Content-Range': 'bytes */' + body.byteLength }
              });
            }
            end = Math.min(end, body.byteLength - 1);
            return new Response(body.slice(start, end + 1), {
              status: 206,
              headers: {
                'Accept-Ranges': 'bytes',
                'Content-Length': String(end - start + 1),
                'Content-Range': 'bytes ' + start + '-' + end + '/' + body.byteLength,
                'Content-Type': cached.headers.get('Content-Type') || 'audio/mpeg'
              }
            });
          });
        });
      })
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          return cached || caches.match('./index.html');
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(function (cached) {
      if (cached && request.cache !== 'reload') return cached;
      return fetch(request).then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { return cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
