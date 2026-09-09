/* ElMistar PWA Bootstrap — PWA Installation (not a manual shortcut).
 * One-line integration for ANY app (existing or newly added):
 *   <script src="../pwa-bootstrap.js"></script>   ← in <head>
 * It auto-wires, idempotently:
 *   1) early capture of beforeinstallprompt / appinstalled
 *   2) <link rel="manifest" href="./manifest.json"> if missing
 *   3) shared pwa-install.css if missing
 *   4) Service Worker ./sw.js registration (required for installability)
 *   5) shared pwa-install.js (real native install UI, 5s delay)
 * Per-app files still required in each app folder:
 *   ./manifest.json (copy apps/_template/manifest.json and edit names/icons)
 *   ./sw.js         (copy apps/_template/sw.js)
 *   ./icons/icon-192.png + ./icons/icon-512.png
 */
(function () {
  'use strict';
  try {
    if (window.__elmistarPwaBootstrap) return;
    window.__elmistarPwaBootstrap = true;

    var sharedBase = './';
    try {
      var cs = document.currentScript && document.currentScript.src;
      if (cs) sharedBase = cs.slice(0, cs.lastIndexOf('/') + 1);
    } catch (e) {}

    if (!window.__elmistarPwaEarlyCapture) {
      window.__elmistarPwaEarlyCapture = true;
      if (window.__elmistarDeferredPrompt === undefined) {
        try { window.__elmistarDeferredPrompt = null; } catch (e) {}
      }
      if (window.__elmistarInstalled === undefined) {
        try { window.__elmistarInstalled = false; } catch (e) {}
      }
      window.addEventListener('beforeinstallprompt', function (e) {
        try { e.preventDefault(); } catch (err) {}
        try { window.__elmistarDeferredPrompt = e; } catch (err) {}
        try { if (window.__elmistarPwaOnPrompt) window.__elmistarPwaOnPrompt(e); } catch (err) {}
      });
      window.addEventListener('appinstalled', function () {
        try { window.__elmistarInstalled = true; } catch (e) {}
        try { window.__elmistarDeferredPrompt = null; } catch (e) {}
        try { if (window.__elmistarPwaOnInstalled) window.__elmistarPwaOnInstalled(); } catch (e) {}
      });
    }

    function ensureHeadLink(rel, href) {
      try {
        if (document.querySelector('link[rel="' + rel + '"]')) return;
        var l = document.createElement('link');
        l.rel = rel;
        l.href = href;
        document.head.appendChild(l);
      } catch (e) {}
    }

    ensureHeadLink('manifest', './manifest.json');

    try {
      var hasPwaCss = false;
      var links = document.querySelectorAll('link[rel="stylesheet"]');
      for (var i = 0; i < links.length; i++) {
        var h = links[i].getAttribute('href') || '';
        if (h.indexOf('pwa-install.css') !== -1) { hasPwaCss = true; break; }
      }
      if (!hasPwaCss) {
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = sharedBase + 'pwa-install.css';
        document.head.appendChild(css);
      }
    } catch (e) {}

    if ('serviceWorker' in navigator) {
      var register = function () {
        try {
          navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(function () {});
        } catch (e) {}
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register);
    }

    try {
      var hasPwaJs = false;
      var scripts = document.querySelectorAll('script[src]');
      for (var j = 0; j < scripts.length; j++) {
        var s = scripts[j].getAttribute('src') || '';
        if (s.indexOf('pwa-install.js') !== -1 && s.indexOf('pwa-bootstrap') === -1) { hasPwaJs = true; break; }
      }
      if (!hasPwaJs && !window.ElMistarPWA) {
        var el = document.createElement('script');
        el.src = sharedBase + 'pwa-install.js';
        el.defer = true;
        (document.head || document.documentElement).appendChild(el);
      }
    } catch (e) {}
  } catch (e) {}
})();
