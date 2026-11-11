// نظام الكاش (مهم لفهم سبب «ملفات المصحف غير مكتملة» التي كانت تظهر بعد فترة):
//
//  SHELL_CACHE  ملفات التطبيق الصغيرة (html/css/js/…). يُغيَّر رقمه مع كل إصدار ويُحذف القديم.
//  ASSET_CACHE  الملفات الثقيلة (48 خط مصحف + meanings.json). رقمه لا يتغير مع تحديثات التطبيق،
//               فلا تُحذف الخطوط ولا يُعاد تنزيلها كل إصدار. غيّر رقمه فقط إذا تغيّرت الخطوط نفسها.
//
// في الإصدارات السابقة كانت الخطوط في نفس كاش الإصدار، وكل تحديث للـ service worker يحذفها فيحاول
// التطبيق تنزيلها من جديد، وأي فشل في الشبكة (أو اختلاف اسم الكاش بين الصفحة والـ SW) كان يحجب المصحف.
// عند التفعيل نُرحِّل الخطوط من الكاش القديم إلى ASSET_CACHE قبل حذفه حتى لا يخسرها من نزّلها سابقًا.
var SHELL_CACHE = 'quran-shell-v158';
var ASSET_CACHE = 'quran-assets-v1'; // يجب أن يطابق ASSET_CACHE في app.js
var LEGACY_PREFIX = 'quran-pro-app-';
var SHELL_PREFIX = 'quran-shell-';
var APP_SHELL = [
  './index.html',
  './style.css',
  './data.js',
  './app.js',
  './manifest.webmanifest',
  './logo.png',
  './note.mp3'
];

function isHeavyAsset(url) {
  return url.indexOf('/fonts/') !== -1 || /\/meanings\.json(\?|$)/.test(url);
}
function cacheNameFor(url) {
  return isHeavyAsset(url) ? ASSET_CACHE : SHELL_CACHE;
}

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

// نقل الملفات الثقيلة من أي كاش قديم إلى ASSET_CACHE (تُتخطى الموجودة).
function migrateHeavyAssets(key, assets) {
  return caches.open(key).then(function (old) {
    return old.keys().then(function (requests) {
      return Promise.all(requests.filter(function (r) { return isHeavyAsset(r.url); }).map(function (request) {
        return assets.match(request).then(function (exists) {
          if (exists) return null;
          return old.match(request).then(function (response) {
            return response && response.ok ? assets.put(request, response) : null;
          });
        });
      }));
    });
  }).catch(function () {});
}

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      var stale = keys.filter(function (key) {
        return key.indexOf(LEGACY_PREFIX) === 0 || (key.indexOf(SHELL_PREFIX) === 0 && key !== SHELL_CACHE);
      });
      return caches.open(ASSET_CACHE).then(function (assets) {
        return Promise.all(stale.map(function (key) { return migrateHeavyAssets(key, assets); }));
      }).then(function () {
        return Promise.all(stale.map(function (key) { return caches.delete(key); }));
      });
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windows) {
      for (var i = 0; i < windows.length; i++) {
        if (new URL(windows[i].url).origin === self.location.origin) {
          return windows[i].focus();
        }
      }
      return clients.openWindow(event.notification.data && event.notification.data.url || './');
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var fontHost = new URL(request.url).hostname;
  if (fontHost === 'fonts.googleapis.com' || fontHost === 'fonts.gstatic.com') {
    // خطوط Google: تُخزَّن عند أول استخدام لتعمل دون إنترنت لاحقًا.
    event.respondWith(
      caches.open(ASSET_CACHE).then(function (cache) {
        return cache.match(request).then(function (hit) {
          var network = fetch(request).then(function (res) {
            if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
            return res;
          });
          return hit || network.catch(function () { return hit; });
        });
      })
    );
    return;
  }
  if (new URL(request.url).origin !== self.location.origin) return;

  var requestUrl = new URL(request.url);
  if (requestUrl.pathname.endsWith('/note.mp3') && request.headers.has('range')) {
    event.respondWith(
      caches.match('./note.mp3').then(function (cached) {
        return Promise.resolve(cached).then(function (cached) {
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
          caches.open(SHELL_CACHE).then(function (cache) { return cache.put(request, copy); });
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
          caches.open(cacheNameFor(request.url)).then(function (cache) { return cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});
