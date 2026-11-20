(function () {
    'use strict';

    var READ_TIMEOUT_MS = 12000;
    var RESUME_AFTER_MS = 5 * 60 * 1000;

    var SETTINGS_DOCS = [
        'registration', 'enrollment', 'sessionConfig', 'notes',
        'congrats', 'socialLinks', 'profile',
        'educationalWorksConfig', 'whatsapp_templates', 'appsSection'
    ];
    var BOOT_COLLECTIONS = ['summerCourses', 'educationalWorks', 'announcements', 'groups', 'apps'];

    var status = 'pending';
    var reason = '';
    var readyResolve = null;
    var readyPromise = new Promise(function (res) { readyResolve = res; });
    var running = false;
    var hiddenAt = 0;

    function withTimeout(promise, ms) {
        return new Promise(function (resolve, reject) {
            var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
            promise.then(function (v) { clearTimeout(t); resolve(v); },
                function (e) { clearTimeout(t); reject(e); });
        });
    }

    function waitForDb() {
        return window.db ? Promise.resolve(window.db) : Promise.reject(new Error('no-db'));
    }

    function fetchDocServer(db, id) {
        return withTimeout(
            db.collection('settings').doc(id).get({ source: 'server' }),
            READ_TIMEOUT_MS
        ).then(function () { return true; }, function (err) {
            if (err && (err.code === 'permission-denied' || err.code === 'not-found')) return true;
            throw err;
        });
    }

    function fetchColServer(db, name) {
        return withTimeout(
            db.collection(name).get({ source: 'server' }),
            READ_TIMEOUT_MS
        ).then(function () { return true; });
    }

    function fetchAllFromServer(db) {
        var jobs = SETTINGS_DOCS.map(function (id) {
            return fetchDocServer(db, id);
        }).concat(BOOT_COLLECTIONS.map(function (name) {
            return fetchColServer(db, name);
        }));
        return Promise.all(jobs).then(function () { return true; });
    }

    function setStatus(s, r) {
        status = s;
        reason = r || '';
        try {
            document.dispatchEvent(new CustomEvent('elmistar:boot-status', { detail: { status: s, reason: reason } }));
        } catch (e) {
            try { document.dispatchEvent(new Event('elmistar:boot-status')); } catch (e2) {}
        }
    }

    function runBoot() {
        if (running) return readyPromise;
        running = true;
        setStatus('pending');
        waitForDb().then(function () {
            running = false;
            setStatus('ready');
            try { window.__ELMISTAR_LAST_SYNC = Date.now(); } catch (e) {}
            try { document.dispatchEvent(new Event('elmistar:boot-ready')); } catch (e) {}
            if (readyResolve) { readyResolve(true); readyResolve = null; }
        }, function (err) {
            running = false;
            var r = (err && err.message === 'no-db') ? 'no-db' : 'fetch-failed';
            setStatus('error', r);
            try { document.dispatchEvent(new Event('elmistar:boot-error')); } catch (e) {}
            if (readyResolve) { readyResolve(false); readyResolve = null; }
        });
        return readyPromise;
    }

    function retry() {
        readyPromise = new Promise(function (res) { readyResolve = res; });
        running = false;
        return runBoot();
    }

    function refreshInBackground() {
        if (!window.db || status !== 'ready') return Promise.resolve(false);
        return fetchAllFromServer(window.db).then(function () {
            try { window.__ELMISTAR_LAST_SYNC = Date.now(); } catch (e) {}
            try { document.dispatchEvent(new Event('elmistar:data-refreshed')); } catch (e) {}
            return true;
        }, function () { return false; });
    }

    function getDocServer(col, id) {
        if (!window.db) return Promise.reject(new Error('no-db'));
        return withTimeout(
            window.db.collection(col).doc(id).get({ source: 'server' }),
            READ_TIMEOUT_MS
        );
    }

    function getDocsServer(col) {
        if (!window.db) return Promise.reject(new Error('no-db'));
        return withTimeout(
            window.db.collection(col).get({ source: 'server' }),
            READ_TIMEOUT_MS
        );
    }

    function onServerSnapshot(target, onData, onError) {
        var seenServer = false;
        var opts = { includeMetadataChanges: true };
        function next(snap) {
            var meta = null;
            try { meta = snap.metadata || null; } catch (e) {}
            if (meta && meta.fromCache === true && !seenServer) return;
            seenServer = true;
            onData(snap);
        }
        function err(e) { if (typeof onError === 'function') onError(e); }
        try {
            return target.onSnapshot(opts, next, err);
        } catch (e) {
            return target.onSnapshot(next, err);
        }
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) { hiddenAt = Date.now(); return; }
        if (hiddenAt && (Date.now() - hiddenAt) > RESUME_AFTER_MS) refreshInBackground();
        hiddenAt = 0;
    });

    window.addEventListener('pageshow', function (e) {
        if (e && e.persisted && status !== 'ready') retry();
    });

    window.ElmistarBoot = {
        ready: readyPromise,
        retry: retry,
        state: function () { return { status: status, reason: reason }; },
        refreshInBackground: refreshInBackground,
        getDocServer: getDocServer,
        getDocsServer: getDocsServer,
        onServerSnapshot: onServerSnapshot
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runBoot);
    } else {
        runBoot();
    }
})();
