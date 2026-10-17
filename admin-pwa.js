/* Admin PWA helpers: install prompt, standalone detection,
   pending-outbox badge, manual sync trigger. */
(function () {
    'use strict';

    var deferredPrompt = null;
    var BADGE_ID = 'pwa-pending-badge';

    function $(id) { return document.getElementById(id); }

    function isStandalone() {
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.navigator.standalone === true) return true; // iOS
        return false;
    }

    function isIOS() {
        return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
    }

    function countPending() {
        return new Promise(function (resolve) {
            try {
                if (!('indexedDB' in window)) { resolve(0); return; }
                var req = indexedDB.open('ElMistarOfflineDB', 1);
                req.onsuccess = function (e) {
                    try {
                        var db = e.target.result;
                        if (!db.objectStoreNames.contains('operations')) { resolve(0); return; }
                        var tx = db.transaction(['operations'], 'readonly');
                        var st = tx.objectStore('operations');
                        var c = st.count();
                        c.onsuccess = function () { resolve(c.result || 0); };
                        c.onerror = function () { resolve(0); };
                    } catch (err) { resolve(0); }
                };
                req.onerror = function () { resolve(0); };
                req.onblocked = function () { resolve(0); };
            } catch (e) { resolve(0); }
        });
    }

    function refreshBadge() {
        countPending().then(function (n) {
            var badge = $(BADGE_ID);
            if (n > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.id = BADGE_ID;
                    badge.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;' +
                        'background:#fff7ed;color:#9a3412;border:1.5px solid #fb923c;border-radius:999px;' +
                        'padding:8px 16px;font-size:13px;font-weight:800;font-family:inherit;' +
                        'box-shadow:0 4px 14px rgba(249,115,22,.25);display:flex;align-items:center;gap:6px;';
                    document.body.appendChild(badge);
                }
                badge.style.display = 'flex';
                badge.innerHTML = '<i class="bx bx-cloud-upload"></i> ' + n + ' بانتظار الرفع';
                badge.title = 'تعديلات محفوظة محلياً ستُرفع تلقائياً عند الاتصال';
            } else if (badge) {
                badge.style.display = 'none';
            }
        });
    }

    function updateInstallUI() {
        var status = $('pwa-install-status');
        var btn = $('pwa-install-btn');
        var iosHelp = $('pwa-ios-help');
        if (!status) return;

        if (isStandalone()) {
            status.innerHTML = '✅ <strong>التطبيق مثبّت</strong> ويعمل من أيقونة الهاتف مباشرة.';
            if (btn) btn.style.display = 'none';
            if (iosHelp) iosHelp.style.display = 'none';
            return;
        }
        if (deferredPrompt) {
            status.innerHTML = '📲 جهازك يدعم التثبيت — اضغط الزر لتثبيت لوحة التحكم كتطبيق على هاتفك.';
            if (btn) btn.style.display = '';
            if (iosHelp) iosHelp.style.display = 'none';
            return;
        }
        if (isIOS()) {
            status.innerHTML = '📲 للتثبيت على الآيفون اتبع الخطوات بالأسفل (متصفح سفاري).';
            if (btn) btn.style.display = 'none';
            if (iosHelp) iosHelp.style.display = '';
            return;
        }
        status.innerHTML = '📲 للتثبيت من متصفح الهاتف: قائمة <strong>⋮</strong> ← <strong>تثبيت التطبيق / إضافة إلى الشاشة الرئيسية</strong>. ' +
            'بعد التثبيت ستعمل اللوحة بدون إنترنت مع حفظ تلقائي ومزامنة عند الاتصال.';
        if (btn) btn.style.display = 'none';
        if (iosHelp) iosHelp.style.display = 'none';
    }

    function bind() {
        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredPrompt = e;
            updateInstallUI();
        });

        var btn = $('pwa-install-btn');
        if (btn) {
            btn.addEventListener('click', function () {
                if (!deferredPrompt) {
                    updateInstallUI();
                    return;
                }
                deferredPrompt.prompt();
                if (deferredPrompt.userChoice) {
                    deferredPrompt.userChoice.then(function () {
                        deferredPrompt = null;
                        setTimeout(updateInstallUI, 1000);
                    }).catch(function () {
                        deferredPrompt = null;
                        updateInstallUI();
                    });
                } else {
                    setTimeout(updateInstallUI, 1000);
                }
            });
        }

        window.addEventListener('appinstalled', function () {
            deferredPrompt = null;
            updateInstallUI();
        });

        var syncBtn = $('pwa-sync-now-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', function () {
                if (!navigator.onLine) {
                    if (typeof showToast === 'function') showToast('لا يوجد اتصال — سيتم الرفع تلقائياً عند عودته', 'error');
                    return;
                }
                try { window.dispatchEvent(new Event('online')); } catch (e) {}
                if (typeof showToast === 'function') showToast('جارٍ مزامنة البيانات...', 'info');
                setTimeout(refreshBadge, 2500);
                setTimeout(refreshBadge, 6000);
            });
        }

        window.addEventListener('online', function () { setTimeout(refreshBadge, 2000); });
        window.addEventListener('offline', refreshBadge);
        document.addEventListener('elmistar:data-refreshed', refreshBadge);
        setInterval(refreshBadge, 8000);

        updateInstallUI();
        refreshBadge();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bind);
    } else {
        bind();
    }
})();
