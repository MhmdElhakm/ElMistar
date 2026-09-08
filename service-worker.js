const CACHE_NAME = 'elmistar-admin-v11';
const ASSETS_TO_CACHE = [
    './admin.html',
    './admin.css',
    './admin.js',
    './sync-service.js',
    './services-bundle.js',
    './firebase-config.js',
    './firebase-config-data.js',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Poppins:wght@400;500;600;700;800;900&display=swap',
    'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore-compat.js'
];

// Install Event - Cache assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
    self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch Event - Network first, fallback to cache
self.addEventListener('fetch', event => {
    // Only cache GET requests
    if (event.request.method !== 'GET') return;

    // Skip Firestore/Firebase API calls from service worker cache
    if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('firebase')) {
        return;
    }

    // For JS and HTML files, always bypass the browser HTTP cache to get fresh content
    var fetchOpts = {};
    var url = event.request.url;
    if (url.endsWith('.js') || url.endsWith('.html') || url.endsWith('.css')) {
        fetchOpts.cache = 'no-cache';
    }

    event.respondWith(
        fetch(event.request, fetchOpts)
            .then(response => {
                // Clone the response
                const responseToCache = response.clone();
                caches.open(CACHE_NAME)
                    .then(cache => {
                        // Don't cache opaque responses or non-success
                        if(response.status === 200 || response.type === 'opaque') {
                            cache.put(event.request, responseToCache);
                        }
                    });
                return response;
            })
            .catch(() => {
                // If network fails, try cache
                return caches.match(event.request);
            })
    );
});
