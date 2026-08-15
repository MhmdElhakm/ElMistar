const SyncService = (function () {
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
