(function (global) {
  'use strict';

  var services = global.QuranIntegratedServiceData;
  if (!services) throw new Error('بيانات الخدمات المدمجة غير محمّلة');
  var SERVICE_TITLES = {
    radio: 'إذاعة القرآن الكريم',
    fiqh: 'فقه ميسّر',
    stories: 'قصص القرآن للأطفال'
  };
  var CAIRO_FONT_FACES = (services.radio.css.match(
    /@font-face\s*\{[^}]*font-family:\s*['"]Cairo['"][^}]*\}/g
  ) || []).join('\n');
  var globalFontStyle = document.createElement('style');
  globalFontStyle.textContent = CAIRO_FONT_FACES +
    '.integrated-services,.app-service-view{font-family:"Cairo","Segoe UI",Tahoma,Arial,sans-serif}' +
    '.app-service-view button,.app-service-view input,.app-service-view select{font:inherit}';
  document.head.appendChild(globalFontStyle);

  function scopedStyles(css) {
    return css
      .replace(/:root\b/g, ':host')
      .replace(/(^|})\s*html\s*,\s*body(?=\s*[{,])/g, '$1 :host')
      .replace(/(^|})\s*(?:html|body)(?=\s*[{,])/g, '$1 :host');
  }

  function mount(key, host) {
    var service = services[key];
    if (!service) throw new Error('الخدمة المطلوبة غير معروفة: ' + key);
    if (!host || typeof host.attachShadow !== 'function') throw new Error('حاوية الخدمة غير صالحة');

    host.setAttribute('role', 'region');
    host.setAttribute('aria-label', SERVICE_TITLES[key] || 'محتوى الخدمة');
    host.tabIndex = 0;
    host.style.setProperty('overflow-x', 'hidden', 'important');
    host.style.setProperty('overflow-y', 'auto', 'important');
    host.style.setProperty('touch-action', 'pan-y', 'important');
    host.style.setProperty('overscroll-behavior-y', 'contain', 'important');
    var root = host.shadowRoot || host.attachShadow({ mode: 'open' });
    root.replaceChildren();
    var style = document.createElement('style');
    style.textContent = CAIRO_FONT_FACES +
      ':host{display:block;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:0!important}' +
      scopedStyles(service.css) +
      '.integrated-service-root{position:relative;width:100%;min-height:100%}' +
      ':host .integrated-service-root,:host .integrated-service-root *{font-family:"Cairo","Segoe UI",Tahoma,Arial,sans-serif!important}' +
      (key === 'radio'
        ? ':host{--bg:var(--panel,#f5f8fb);--ink:inherit;--muted:inherit;--line:inherit;--blue:var(--green,#14634a);--blue2:color-mix(in srgb,var(--green,#14634a) 78%,#123);--blue-soft:color-mix(in srgb,var(--green,#14634a) 12%,var(--panel,#fff));}' +
          ':host .hero,:host .tile,:host .st,:host .lib,:host .back{background:var(--card,var(--panel,#fff));border-color:var(--line)}' +
          ':host .t-blue,:host .t-green{--tc:var(--green,#14634a);--tint:color-mix(in srgb,var(--green,#14634a) 12%,var(--panel,#fff))}' +
          ':host .t-purple,:host .t-orange{--tc:var(--sub,#a58b62);--tint:color-mix(in srgb,var(--sub,#a58b62) 14%,var(--panel,#fff))}' +
          ':host .st.on{background:var(--blue-soft)}:host .lt .dl{background:var(--panel,#f5f8fb)}' +
          ':host .logo rect:nth-of-type(2){fill:var(--green,#14634a)}:host .logo #lg stop:first-child{stop-color:var(--green,#14634a)}:host .logo #lg stop:last-child{stop-color:var(--g900,#0b3d2e)}' +
          ':host .mini{background:var(--green,#14634a);color:var(--on-green,#fff)}:host .mini .mp svg{fill:var(--on-green,#fff)}'
        : '') +
      (key === 'fiqh' ? '.integrated-service-root{padding-bottom:120px}' : '') +
      (key === 'fiqh'
        ? ':host{background-color:var(--bg)!important;background-image:linear-gradient(165deg,var(--bg1) 0%,var(--bg2) 38%,var(--bg3) 100%)!important;color:var(--fg)!important}'
        : ':host{background-color:var(--bg)!important;color:var(--ink)!important}') +
      ':host,:host([data-theme="dark"]){--blue:var(--green,#14634a);--blue2:color-mix(in srgb,var(--green,#14634a) 78%,#123);' +
      '--blue-soft:color-mix(in srgb,var(--green,#14634a) 12%,#fff);--pri:var(--green,#14634a);' +
      '--pri2:color-mix(in srgb,var(--green,#14634a) 78%,#123);--pri-soft:color-mix(in srgb,var(--green,#14634a) 12%,#fff)}';
    root.appendChild(style);

    var content = document.createElement('div');
    content.className = 'integrated-service-root';
    content.innerHTML = service.markup;
    root.appendChild(content);

    var listeners = [];
    var localListeners = [];
    var disposed = false;
    function addWindowListener(type, listener, options) {
      var target = type === 'keydown' ? host : global;
      target.addEventListener(type, listener, options);
      listeners.push({ target: target, type: type, listener: listener, options: options });
    }
    function removeWindowListener(type, listener, options) {
      for (var i = listeners.length - 1; i >= 0; i--) {
        var entry = listeners[i];
        if (entry.type === type && entry.listener === listener) {
          entry.target.removeEventListener(type, listener, options === undefined ? entry.options : options);
          listeners.splice(i, 1);
        }
      }
    }
    var scopedDocument = new Proxy(document, {
      get: function (target, property) {
        if (property === 'documentElement') return host;
        if (property === 'body') return target.body;
        if (property === 'getElementById') {
          return function (id) {
            var elements = root.querySelectorAll('[id]');
            for (var i = 0; i < elements.length; i++) {
              if (elements[i].id === String(id)) return elements[i];
            }
            return null;
          };
        }
        if (property === 'querySelector') return root.querySelector.bind(root);
        if (property === 'querySelectorAll') return root.querySelectorAll.bind(root);
        if (property === 'addEventListener') {
          return function (type, listener, options) {
            root.addEventListener(type, listener, options);
            localListeners.push({ type: type, listener: listener, options: options });
          };
        }
        if (property === 'removeEventListener') {
          return function (type, listener, options) {
            root.removeEventListener(type, listener, options);
            for (var i = localListeners.length - 1; i >= 0; i--) {
              if (localListeners[i].type === type && localListeners[i].listener === listener) {
                localListeners.splice(i, 1);
              }
            }
          };
        }
        var value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    var scopedWindow = new Proxy(global, {
      get: function (target, property) {
        if (property === 'addEventListener') return addWindowListener;
        if (property === 'removeEventListener') return removeWindowListener;
        if (property === 'scrollTo') {
          return function (x, y) {
            host.scrollTop = Number(y) || 0;
          };
        }
        if (property === 'scrollY' || property === 'pageYOffset') {
          return host.scrollTop;
        }
        var value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      }
    });
    try {
      service.run(scopedDocument, scopedWindow, addWindowListener, removeWindowListener);
    } catch (error) {
      dispose();
      throw error;
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      listeners.slice().forEach(function (entry) {
        if (entry.type === 'pagehide') entry.listener.call(entry.target, new Event('pagehide'));
        entry.target.removeEventListener(entry.type, entry.listener, entry.options);
      });
      localListeners.forEach(function (entry) {
        root.removeEventListener(entry.type, entry.listener, entry.options);
      });
      root.querySelectorAll('audio').forEach(function (audio) { audio.pause(); });
      root.replaceChildren();
    }

    return dispose;
  }

  global.QuranIntegratedServices = { mount: mount };
})(window);
