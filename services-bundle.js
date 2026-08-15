// ==========================================
// SERVICE WORKER LOGIC
// ==========================================
if (typeof window === 'undefined' && typeof self !== 'undefined') {
const CACHE_NAME = 'elmistar-admin-v11';
const ASSETS_TO_CACHE = [
    './admin.html',
    './admin.css',
    './admin.js',
    './firebase-config.js',
    './firebase-config-data.js',
    './services/firebaseService.js',
    './services/offlineSync.js',
    'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Poppins:wght@400;500;600;700;800;900&display=swap',
    'https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore-compat.js',
    'https://www.gstatic.com/firebasejs/10.11.0/firebase-storage-compat.js'
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

    event.respondWith(
        fetch(event.request)
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

}

// ==========================================
// CLIENT SIDE LOGIC
// ==========================================
if (typeof window !== 'undefined') {
  // --- firebaseService.js ---
  (function() {
// Firebase is initialized by firebase-config.js (loaded before this bundle).
// لا توجد قاعدة بيانات افتراضية — يُحدَّد الإعداد من لوحة التحكم.
if (firebase.apps.length) {
    window.db = firebase.firestore();
}
window.__fbConfigured = !!window.db;

console.log("Firebase Service Initialized (configured: " + window.__fbConfigured + ")");

  })();

  // --- offlineSync.js (includes OfflineManager and SyncService) ---
  if (!window.OfflineManager && !window.SyncService) {
window.OfflineManager = (function () {
    const DB_NAME = 'ElMistarOfflineDB';
    const STORE_NAME = 'operations';
    const DB_VERSION = 1;
    let dbInstance = null;

    // Initialize IndexedDB
    function initDB() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (event) => {
                console.error("OfflineManager: Error initializing IndexedDB", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Save an operation locally
    async function saveOperation(operation) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Ensure operation has a timestamp
            operation.timestamp = operation.timestamp || Date.now();
            
            // Add pendingSync flag as requested
            operation.pendingSync = true;
            
            const request = store.add(operation);

            request.onsuccess = () => {
                console.log("Offline Save Success", request.result);
                resolve(request.result);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Get all pending operations sorted by timestamp
    async function getOperations() {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result || [];
                // Sort by timestamp to ensure order of execution
                results.sort((a, b) => a.timestamp - b.timestamp);
                resolve(results);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Delete an operation after successful sync
    async function deleteOperation(id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Clear all operations
    async function clearAll() {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    return {
        init: initDB,
        saveOperation,
        getOperations,
        deleteOperation,
        clearAll
    };
})();

window.SyncService = (function () {
    let isSyncing = false;

    // Detect initial state
    let isOnline = navigator.onLine;

    // Initialize UI and Events
    function init() {
        createStatusIndicator();
        updateStatusUI();

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initialize offline DB
        OfflineManager.init();

        // If currently online, try to sync any left-over data
        if (navigator.onLine) {
            syncData();
        }
    }

    function createStatusIndicator() {
        // Create an indicator if it doesn't exist
        if (!document.getElementById('connection-status')) {
            const indicator = document.createElement('div');
            indicator.id = 'connection-status';
            indicator.style.position = 'fixed';
            indicator.style.bottom = '20px';
            indicator.style.left = '20px';
            indicator.style.padding = '8px 16px';
            indicator.style.borderRadius = '20px';
            indicator.style.fontSize = '14px';
            indicator.style.fontWeight = 'bold';
            indicator.style.zIndex = '9999';
            indicator.style.transition = 'all 0.3s ease';
            indicator.style.display = 'flex';
            indicator.style.alignItems = 'center';
            indicator.style.gap = '8px';
            document.body.appendChild(indicator);
        }
    }

    function updateStatusUI() {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;

        if (isOnline) {
            indicator.style.backgroundColor = '#dcfce7';
            indicator.style.color = '#15803d';
            indicator.style.border = '1px solid #16a34a';
            indicator.innerHTML = "<i class='bx bx-wifi'></i> متصل";
            // Hide after a few seconds if online
            setTimeout(() => {
                if (navigator.onLine) indicator.style.opacity = '0';
            }, 3000);
        } else {
            indicator.style.opacity = '1';
            indicator.style.backgroundColor = '#fee2e2';
            indicator.style.color = '#b91c1c';
            indicator.style.border = '1px solid #ef4444';
            indicator.innerHTML = "<i class='bx bx-wifi-off'></i> بدون إنترنت";
        }
    }

    function handleOnline() {
        isOnline = true;
        updateStatusUI();
        console.log("Network status changed: Online");
        syncData();
    }

    function handleOffline() {
        isOnline = false;
        updateStatusUI();
        console.log("Network status changed: Offline");
        if (typeof showToast === 'function') {
            showToast("لا يوجد اتصال بالإنترنت، تم حفظ البيانات محلياً وسيتم رفعها تلقائياً عند عودة الاتصال", "error");
        }
    }

    // Process stored operations
    async function syncData() {
        if (isSyncing || !navigator.onLine) return;
        isSyncing = true;

        console.log("Sync Started");

        try {
            const operations = await OfflineManager.getOperations();
            if (operations.length === 0) {
                isSyncing = false;
                return; // Nothing to sync
            }

            for (const op of operations) {
                try {
                    await pushToFirebase(op);
                    // On success, delete from local DB
                    await OfflineManager.deleteOperation(op.id);
                } catch (err) {
                    console.error("Sync failed for operation:", op, err);
                    // If it's a network error, stop syncing and retry later
                    throw err; 
                }
            }

            console.log("Sync Success");
        } catch (error) {
            console.error("Sync Failed:", error);
        } finally {
            isSyncing = false;
        }
    }

    // Push a single operation to Firebase
    async function pushToFirebase(op) {
        // Wait for db to be available
        if (!window.db) {
            throw new Error("Firestore DB not initialized yet");
        }

        // Clean up serverTimestamp issues if any
        if (op.data && op.data.createdAt === 'SERVER_TIMESTAMP') {
            op.data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (op.data && op.data.confirmedAt === 'SERVER_TIMESTAMP') {
            op.data.confirmedAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        const colRef = window.db.collection(op.collection);

        if (op.action === 'add') {
            await colRef.add(op.data);
        } else if (op.action === 'update') {
            await colRef.doc(op.docId).update(op.data);
        } else if (op.action === 'delete') {
            await colRef.doc(op.docId).delete();
        } else if (op.action === 'set') {
            await colRef.doc(op.docId).set(op.data);
        }
    }

    // Public wrapper to use instead of direct db calls
    async function executeDbOperation(collection, action, docId, data) {
        // Format data to handle timestamps nicely when offline
        if (data) {
            for (let key in data) {
                if (data[key] && typeof data[key] === 'object' && data[key].constructor && data[key].constructor.name === 'FieldValueImpl') {
                    data[key] = 'SERVER_TIMESTAMP';
                }
            }
        }

        if (navigator.onLine) {
            try {
                // Execute directly
                const op = { collection, action, docId, data };
                await pushToFirebase(op);
                return { success: true, offline: false };
            } catch (err) {
                console.error("Direct execution failed", err);
                
                // Check if it's a network/connection error
                const isNetworkError = 
                    err.code === 'unavailable' || 
                    err.code === 'deadline-exceeded' ||
                    (err.message && err.message.toLowerCase().includes('network')) ||
                    (err.message && err.message.toLowerCase().includes('failed to fetch'));
                
                if (!isNetworkError) {
                    throw err; 
                }
                console.warn("Network error, falling back to offline storage.");
            }
        }
        
        // Save locally
        await OfflineManager.saveOperation({
            collection,
            action,
            docId,
            data,
            timestamp: Date.now()
        });
        
        return { success: true, offline: true };
    }

    return {
        init,
        executeDbOperation
    };
})();

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    SyncService.init();
});

  }

  // --- offline-manager.js ---
  if (!window.OfflineManager) {
window.OfflineManager = (function () {
    const DB_NAME = 'ElMistarOfflineDB';
    const STORE_NAME = 'operations';
    const DB_VERSION = 1;
    let dbInstance = null;

    // Initialize IndexedDB
    function initDB() {
        return new Promise((resolve, reject) => {
            if (dbInstance) {
                resolve(dbInstance);
                return;
            }
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                dbInstance = event.target.result;
                resolve(dbInstance);
            };

            request.onerror = (event) => {
                console.error("OfflineManager: Error initializing IndexedDB", event.target.error);
                reject(event.target.error);
            };
        });
    }

    // Save an operation locally
    async function saveOperation(operation) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Ensure operation has a timestamp
            operation.timestamp = operation.timestamp || Date.now();
            
            const request = store.add(operation);

            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Get all pending operations sorted by timestamp
    async function getOperations() {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result || [];
                // Sort by timestamp to ensure order of execution
                results.sort((a, b) => a.timestamp - b.timestamp);
                resolve(results);
            };
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Delete an operation after successful sync
    async function deleteOperation(id) {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    // Clear all operations
    async function clearAll() {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = (e) => reject(e.target.error);
        });
    }

    return {
        init: initDB,
        saveOperation,
        getOperations,
        deleteOperation,
        clearAll
    };
})();

  }

  // --- sync-service.js ---
  if (!window.SyncService) {
window.SyncService = (function () {
    let isSyncing = false;

    // Detect initial state
    let isOnline = navigator.onLine;

    // Initialize UI and Events
    function init() {
        createStatusIndicator();
        updateStatusUI();

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initialize offline DB
        OfflineManager.init();

        // If currently online, try to sync any left-over data
        if (navigator.onLine) {
            syncData();
        }
    }

    function createStatusIndicator() {
        // Create an indicator if it doesn't exist
        if (!document.getElementById('connection-status')) {
            const indicator = document.createElement('div');
            indicator.id = 'connection-status';
            indicator.style.position = 'fixed';
            indicator.style.bottom = '20px';
            indicator.style.left = '20px';
            indicator.style.padding = '8px 16px';
            indicator.style.borderRadius = '20px';
            indicator.style.fontSize = '14px';
            indicator.style.fontWeight = 'bold';
            indicator.style.zIndex = '9999';
            indicator.style.transition = 'all 0.3s ease';
            indicator.style.display = 'flex';
            indicator.style.alignItems = 'center';
            indicator.style.gap = '8px';
            document.body.appendChild(indicator);
        }
    }

    function updateStatusUI() {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;

        if (isOnline) {
            indicator.style.backgroundColor = '#dcfce7';
            indicator.style.color = '#15803d';
            indicator.style.border = '1px solid #16a34a';
            indicator.innerHTML = "<i class='bx bx-wifi'></i> متصل";
            // Hide after a few seconds if online
            setTimeout(() => {
                if (navigator.onLine) indicator.style.opacity = '0';
            }, 3000);
        } else {
            indicator.style.opacity = '1';
            indicator.style.backgroundColor = '#fee2e2';
            indicator.style.color = '#b91c1c';
            indicator.style.border = '1px solid #ef4444';
            indicator.innerHTML = "<i class='bx bx-wifi-off'></i> بدون إنترنت";
        }
    }

    function handleOnline() {
        isOnline = true;
        updateStatusUI();
        syncData();
    }

    function handleOffline() {
        isOnline = false;
        updateStatusUI();
        if (typeof showToast === 'function') {
            showToast("أنت تعمل حالياً بدون إنترنت، سيتم مزامنة البيانات تلقائياً عند عودة الاتصال.", "error");
        }
    }

    // Process stored operations
    async function syncData() {
        if (isSyncing || !navigator.onLine) return;
        isSyncing = true;

        try {
            const operations = await OfflineManager.getOperations();
            if (operations.length === 0) {
                isSyncing = false;
                return; // Nothing to sync
            }

            if (typeof showToast === 'function') {
                showToast("جاري مزامنة البيانات مع الخادم... ⏳");
            }

            for (const op of operations) {
                try {
                    await pushToFirebase(op);
                    // On success, delete from local DB
                    await OfflineManager.deleteOperation(op.id);
                } catch (err) {
                    console.error("Sync failed for operation:", op, err);
                    // If it's a network error, stop syncing and retry later
                    // We don't delete the operation so it will retry
                    throw err; 
                }
            }

            if (typeof showToast === 'function') {
                showToast("✅ تمت مزامنة جميع البيانات بنجاح!");
            }
        } catch (error) {
            console.error("Sync process encountered an error:", error);
            if (typeof showToast === 'function') {
                showToast("تعذر استكمال المزامنة، سيتم إعادة المحاولة لاحقاً.", "error");
            }
        } finally {
            isSyncing = false;
        }
    }

    // Push a single operation to Firebase
    async function pushToFirebase(op) {
        // Remove the local id and timestamp to not mess up Firebase if they are not needed
        // but we need to keep data clean
        
        // Wait for db to be available (assuming 'db' is global from admin.js)
        if (!window.db) {
            throw new Error("Firestore DB not initialized yet");
        }

        // Clean up serverTimestamp issues if any
        if (op.data && op.data.createdAt === 'SERVER_TIMESTAMP') {
            op.data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        }
        if (op.data && op.data.confirmedAt === 'SERVER_TIMESTAMP') {
            op.data.confirmedAt = firebase.firestore.FieldValue.serverTimestamp();
        }

        const colRef = window.db.collection(op.collection);

        if (op.action === 'add') {
            await colRef.add(op.data);
        } else if (op.action === 'update') {
            await colRef.doc(op.docId).update(op.data);
        } else if (op.action === 'delete') {
            await colRef.doc(op.docId).delete();
        } else if (op.action === 'set') {
            await colRef.doc(op.docId).set(op.data);
        }
    }

    // Public wrapper to use instead of direct db calls
    async function executeDbOperation(collection, action, docId, data) {
        // Format data to handle timestamps nicely when offline
        if (data) {
            // Find FieldValue.serverTimestamp() and replace with string for local storage
            for (let key in data) {
                if (data[key] && typeof data[key] === 'object' && data[key].constructor && data[key].constructor.name === 'FieldValueImpl') {
                    data[key] = 'SERVER_TIMESTAMP';
                }
            }
        }

        if (navigator.onLine) {
            try {
                // Execute directly
                const op = { collection, action, docId, data };
                await pushToFirebase(op);
                return { success: true, offline: false };
            } catch (err) {
                console.error("Direct execution failed", err);
                
                // Check if it's a network/connection error
                const isNetworkError = 
                    err.code === 'unavailable' || 
                    err.code === 'deadline-exceeded' ||
                    (err.message && err.message.toLowerCase().includes('network')) ||
                    (err.message && err.message.toLowerCase().includes('failed to fetch'));
                
                if (!isNetworkError) {
                    // It's a real error (permission, validation, etc.)
                    throw err; // Re-throw to be handled by caller or global handler
                }
                // If it is a network error, we fall through to save locally
                console.warn("Network error, falling back to offline storage.");
            }
        }
        
        // Save locally (either because navigator.onLine was false or pushToFirebase failed with network error)
        await OfflineManager.saveOperation({
            collection,
            action,
            docId,
            data,
            timestamp: Date.now()
        });
        
        if (typeof showToast === 'function') {
            showToast("تم الحفظ محلياً (وضع عدم الاتصال)", "error");
        }
        return { success: true, offline: true };
    }

    return {
        init,
        executeDbOperation
    };
})();

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    SyncService.init();
});

  }




}
