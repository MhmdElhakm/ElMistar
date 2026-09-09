const CACHE_NAME = 'elmistar-main-v1';
const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './pwa-install.js',
    './pwa-install.css',
    './img/logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => Promise.allSettled(
                CORE_ASSETS.map(url => cache.add(url).catch(() => null))
            ))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName.indexOf('elmistar-main-') === 0) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;

    const url = event.request.url;

    if (url.includes('firestore.googleapis.com') ||
        url.includes('firebase') ||
        url.includes('googleapis.com') ||
        url.includes('gstatic.com')) {
        return;
    }

    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put('./index.html', copy).catch(() => {});
                    });
                    return response;
                })
                .catch(() => caches.match('./index.html').then(m => m || caches.match('./')))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            const network = fetch(event.request).then(response => {
                if (response && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, copy).catch(() => {});
                    });
                }
                return response;
            }).catch(() => cached);
            return cached || network;
        })
    );
});
