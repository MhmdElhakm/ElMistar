// ═══════════════════════════════════════════════════════════
// FIREBASE CONFIG LOADER - ElMistar
// لا توجد قاعدة بيانات افتراضية مضمّنة في الموقع.
// يتم ربط قاعدة البيانات المحددة من المعلم فقط عبر صفحة الإدارة:
//   1) الإعداد المحفوظ في المتصفح (المحدد من صفحة الإدارة) — له الأولوية
//   2) الإعداد المضمّن المكتوب من الخادم (احتياطي يخدم الزوار الآخرين،
//      ويُكتب من الخادم عند حفظ المعلم الإعداد من صفحة الإدارة)
// إذا لم يتوفر أي إعداد فلا يتم ربط أي قاعدة بيانات.
// ═══════════════════════════════════════════════════════════
(function () {
    var STORAGE_KEY = 'elmistar_firebase_config';

    // 1) الإعداد المحفوظ في المتصفح (المحدد من صفحة الإدارة)
    var saved = null;
    try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            var parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') saved = parsed;
        }
    } catch (e) {}

    // 2) الإعداد المضمّن المكتوب من الخادم (احتياطي فقط — ليس قاعدة افتراضية)
    var embedded = window.__ELMISTAR_EMBEDDED_CONFIG || null;

    var config = null;
    if (saved && saved.apiKey && saved.projectId) {
        config = saved;
    } else if (embedded && embedded.apiKey && embedded.projectId) {
        config = embedded;
    }

    window.__fbConfigured = false;

    window.ElmistarConfig = {
        STORAGE_KEY: STORAGE_KEY,
        get: function () {
            return config ? JSON.parse(JSON.stringify(config)) : null;
        },
        save: function (cfg) {
            if (!cfg || typeof cfg !== 'object') return;
            config = cfg;
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch (e) {}
        },
        clear: function () {
            config = null;
            try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        },
        isConfigured: function () { return !!config; },
        test: function (cfg) {
            return new Promise(function (resolve, reject) {
                var name = 'connection-test-' + Date.now();
                try {
                    var app = firebase.initializeApp(cfg, name);
                    app.firestore().collection('settings').doc('_connection_test').get()
                        .then(function () { app.delete().catch(function () {}); resolve(true); })
                        .catch(function (err) { app.delete().catch(function () {}); reject(err); });
                } catch (err) { reject(err); }
            });
        }
    };

    if (config) {
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(config);
            }
            window.db = firebase.firestore();
            window.__fbConfigured = true;
            console.log('✅ تم ربط قاعدة البيانات (Firestore): ' + config.projectId);
        } catch (err) {
            console.error('❌ فشل ربط قاعدة البيانات:', err);
            window.__fbConfigured = false;
        }
    } else {
        console.warn('⚠️ لم يتم ربط قاعدة بيانات Firebase بعد — رجاءً ربطها من لوحة التحكم.');
    }
})();
