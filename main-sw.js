const CACHE_NAME = 'elmistar-main-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './apps-section.js',
    './educational-works.js',
    './summer-courses.js',
    './firebase-config.js',
    './firebase-config-data.js',
    './services-bundle.js',
    './sync-service.js',
    './img/logo.png',
    'https://fonts.googleapis.com/css2?family=Fredoka+One&family=Cairo:wght@700;800;900&family=Lalezar&family=Oi&family=Rakkas&display=swap',
    'https://fonts.cdnfonts.com/css/raphtalia',
    'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore-compat.js'
];

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function(cache) {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(name) {
                    if (name !== CACHE_NAME) return caches.delete(name);
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('firestore.googleapis.com')) return;

    var fetchOpts = {};
    var url = event.request.url;
    if (url.endsWith('.js') || url.endsWith('.html') || url.endsWith('.css')) {
        fetchOpts.cache = 'no-cache';
    }

    event.respondWith(
        fetch(event.request, fetchOpts).then(function(response) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
                if (response.status === 200 || response.type === 'opaque') {
                    cache.put(event.request, clone);
                }
            });
            return response;
        }).catch(function() {
            return caches.match(event.request);
        })
    );
});
