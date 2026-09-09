(function () {
  'use strict';
  try {
    if (window.__elmistarPwaInit) return;
    window.__elmistarPwaInit = true;

    function isStandaloneMode() {
      try {
        if (window.matchMedia('(display-mode: standalone)').matches) return true;
        if (window.matchMedia('(display-mode: fullscreen)').matches) return true;
        if (window.matchMedia('(display-mode: minimal-ui)').matches) return true;
        if (window.navigator.standalone === true) return true;
        if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
      } catch (e) {}
      return false;
    }
    function isIOSDevice() {
      try {
        var ua = navigator.userAgent || navigator.vendor || '';
        if (/iphone|ipad|ipod/i.test(ua)) return true;
        if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
      } catch (e) {}
      return false;
    }
    function isAppInstalled() {
      if (isStandaloneMode()) return true;
      if (installedViaEvent) return true;
      try {
        if (window.__elmistarInstalled === true) return true;
      } catch (e) {}
      return false;
    }

    if (isStandaloneMode()) return;

    var deferredPrompt = null;
    try {
      if (window.__elmistarDeferredPrompt) deferredPrompt = window.__elmistarDeferredPrompt;
      if (window.__elmistarInstalled === true) return;
    } catch (e) {}
    var installedViaEvent = false;
    var overlay = null, bar = null;
    var installBtn = null, closeBtn = null, subEl = null, titleEl = null, iconEl = null;
    var autoShown = false;
    var dismissedThisLoad = false;
    var prompting = false;

    var TXT = {
      ready: 'اضغط «تثبيت» لإضافة التطبيق إلى شاشتك الرئيسية',
      ios: 'اضغط مشاركة ↗ ثم «إضافة إلى الشاشة الرئيسية»',
      manual: 'من قائمة المتصفح ⋮ اختر «تثبيت التطبيق»',
      success: 'أصبح التطبيق الآن على شاشتك الرئيسية 🎉'
    };

    function refreshMode() {
      if (!overlay) return;
      if (!deferredPrompt) {
        try {
          if (window.__elmistarDeferredPrompt) deferredPrompt = window.__elmistarDeferredPrompt;
        } catch (e) {}
      }
      installBtn.classList.remove('hidden');
      try { installBtn.removeAttribute('disabled'); } catch (e) {}
      if (isIOSDevice()) {
        subEl.textContent = TXT.ios;
      } else if (deferredPrompt) {
        subEl.textContent = TXT.ready;
      } else {
        subEl.textContent = TXT.manual;
      }
    }

    function hide() {
      if (!overlay) return;
      overlay.classList.remove('show');
      dismissedThisLoad = true;
    }
    function show(force) {
      if (!overlay || !document.body.contains(overlay)) return;
      if (isAppInstalled()) { remove(); return; }
      if (dismissedThisLoad && !force) return;
      refreshMode();
      overlay.classList.add('show');
      autoShown = true;
    }
    function remove() {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
    }
    function showSuccess() {
      if (!overlay) return;
      if (!overlay.classList.contains('show')) overlay.classList.add('show');
      bar.classList.add('success');
      iconEl.textContent = '✓';
      titleEl.textContent = 'تم تثبيت التطبيق!';
      subEl.textContent = TXT.success;
      installBtn.classList.add('hidden');
      setTimeout(function () { hide(); }, 2600);
    }
    function markInstalled(withSuccess) {
      installedViaEvent = true;
      try { window.__elmistarInstalled = true; } catch (e) {}
      deferredPrompt = null;
      try { window.__elmistarDeferredPrompt = null; } catch (e) {}
      if (withSuccess && overlay) showSuccess();
      else remove();
    }

    function onPrompt(e) {
      try {
        if (e) {
          if (e.preventDefault) { try { e.preventDefault(); } catch (err) {} }
          deferredPrompt = e;
          try { window.__elmistarDeferredPrompt = e; } catch (err) {}
        }
      } catch (err) {}
      refreshMode();
    }
    function onInstalled() {
      markInstalled(true);
    }
    try {
      window.__elmistarPwaOnPrompt = onPrompt;
      window.__elmistarPwaOnInstalled = onInstalled;
    } catch (e) {}
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    try {
      var mq = window.matchMedia('(display-mode: standalone)');
      var onChange = function (ev) { if (ev && ev.matches) { markInstalled(false); } else if (isStandaloneMode()) { markInstalled(false); } };
      if (mq && mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq && mq.addListener) mq.addListener(onChange);
    } catch (e) {}
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && isStandaloneMode()) markInstalled(false);
    });
    try {
      if (navigator.getInstalledRelatedApps) {
        navigator.getInstalledRelatedApps().then(function (apps) {
          if (apps && apps.length) markInstalled(false);
        }).catch(function () {});
      }
    } catch (e) {}

    function build() {
      overlay = document.createElement('div');
      overlay.className = 'elmistar-pwa-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'تثبيت التطبيق');
      overlay.innerHTML =
        '<div class="elmistar-pwa-sheet">' +
          '<div class="elmistar-pwa-icon">📱</div>' +
          '<div class="elmistar-pwa-txt">' +
            '<div class="elmistar-pwa-title">ثبّت التطبيق على هاتفك</div>' +
            '<div class="elmistar-pwa-sub"></div>' +
          '</div>' +
          '<button type="button" class="elmistar-pwa-install">تثبيت</button>' +
          '<button type="button" class="elmistar-pwa-close" aria-label="إغلاق">×</button>' +
          '<div class="elmistar-pwa-more"></div>' +
        '</div>';
      document.body.appendChild(overlay);
      bar = overlay.querySelector('.elmistar-pwa-sheet');
      installBtn = overlay.querySelector('.elmistar-pwa-install');
      closeBtn = overlay.querySelector('.elmistar-pwa-close');
      subEl = overlay.querySelector('.elmistar-pwa-sub');
      titleEl = overlay.querySelector('.elmistar-pwa-title');
      iconEl = overlay.querySelector('.elmistar-pwa-icon');
      var moreEl = overlay.querySelector('.elmistar-pwa-more');
      window.__elmistarPwaMore = moreEl;
      function toggleMore() {
        if (!moreEl) return;
        var open = moreEl.classList.contains('show');
        if (open) {
          moreEl.classList.remove('show');
          bar.classList.remove('expanded');
          moreEl.innerHTML = '';
        } else {
          if (isIOSDevice()) {
            moreEl.innerHTML =
              '<ol class="elmistar-pwa-steps">' +
                '<li><span class="elmistar-pwa-step-n">1</span><span>اضغط زر المشاركة <b>↗</b></span></li>' +
                '<li><span class="elmistar-pwa-step-n">2</span><span>اختر <b>«إضافة إلى الشاشة الرئيسية»</b></span></li>' +
                '<li><span class="elmistar-pwa-step-n">3</span><span>اضغط <b>«إضافة»</b></span></li>' +
              '</ol>';
          } else {
            moreEl.innerHTML = 'من قائمة المتصفح <b>⋮</b> اختر <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>';
          }
          moreEl.classList.add('show');
          bar.classList.add('expanded');
        }
      }
      window.__elmistarPwaToggleMore = toggleMore;
      installBtn.addEventListener('click', function () {
        if (prompting) return;
        if (isAppInstalled()) { remove(); return; }
        if (!deferredPrompt) {
          try {
            if (window.__elmistarDeferredPrompt) deferredPrompt = window.__elmistarDeferredPrompt;
          } catch (e) {}
        }
        if (deferredPrompt) {
          var dp = deferredPrompt;
          prompting = true;
          try { installBtn.setAttribute('disabled', 'disabled'); } catch (e) {}
          try {
            var p = dp.prompt();
            if (p && p.catch) p.catch(function () {});
            if (dp.userChoice) {
              dp.userChoice.then(function (choice) {
                prompting = false;
                try { installBtn.removeAttribute('disabled'); } catch (e) {}
                deferredPrompt = null;
                try { window.__elmistarDeferredPrompt = null; } catch (e) {}
                if (choice && choice.outcome === 'accepted') {
                  markInstalled(true);
                } else { hide(); }
              }).catch(function () {
                prompting = false;
                try { installBtn.removeAttribute('disabled'); } catch (e) {}
                hide();
              });
            } else {
              prompting = false;
              try { installBtn.removeAttribute('disabled'); } catch (e) {}
              hide();
            }
          } catch (e) {
            prompting = false;
            try { installBtn.removeAttribute('disabled'); } catch (e) {}
            hide();
          }
        } else {
          try {
            if (window.__elmistarPwaToggleMore) window.__elmistarPwaToggleMore();
          } catch (e) {}
        }
      });
      if (closeBtn) closeBtn.addEventListener('click', hide);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
      refreshMode();
    }

    function init() {
      if (!document.body) return;
      if (isAppInstalled()) return;
      build();
      var delay = 1500;
      try {
        if (typeof window.ELMISTAR_PWA_DELAY === 'number') delay = window.ELMISTAR_PWA_DELAY;
      } catch (e) {}
      setTimeout(function () {
        if (!autoShown) show(false);
      }, delay);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    window.ElMistarPWA = window.ElMistarPWA || {};
    window.ElMistarPWA.isAppInstalled = isAppInstalled;
    window.ElMistarPWA.showInstall = function () { dismissedThisLoad = false; show(true); };
    window.ElMistarPWA.hideInstall = hide;
    window.ElMistarPWA.installNow = function () {
      if (installBtn && document.body.contains(installBtn)) installBtn.click();
      return !!deferredPrompt;
    };
    window.ElMistarPWA.canInstall = function () { return !!deferredPrompt && !isAppInstalled(); };
    window.ElMistarPWA.debug = function () {
      var info = {
        secureContext: !!window.isSecureContext,
        protocol: location.protocol,
        standalone: isStandaloneMode(),
        ios: isIOSDevice(),
        promptCaptured: !!deferredPrompt,
        sw: ('serviceWorker' in navigator),
        manifest: !!document.querySelector('link[rel="manifest"]')
      };
      try {
        if (navigator.serviceWorker && navigator.serviceWorker.controller) info.swActive = true;
        else info.swActive = false;
      } catch (e) { info.swActive = 'unknown'; }
      return info;
    };
  } catch (e) {}
})();
