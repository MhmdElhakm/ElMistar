/* notify-bridge.js — Web → Native bridge for the Naqisna APK.
 * Safe in browser/PWA: every native call is guarded by isNative().
 * Auto-sync (APK only): prayer times, appointments, tasks snapshot + widget data.
 * Reads page localStorage keys: 'baytna_v2' (app state), 'naqisna_prayer' (timings cache).
 */
(function () {
  'use strict';

  var PRAYERS = [
    { id: 'Fajr', name: 'الفجر' },
    { id: 'Dhuhr', name: 'الظهر' },
    { id: 'Asr', name: 'العصر' },
    { id: 'Maghrib', name: 'المغرب' },
    { id: 'Isha', name: 'العشاء' }
  ];

  function isNative() {
    try { return !!(window.NativeNotify && typeof window.NativeNotify.show === 'function'); }
    catch (e) { return false; }
  }

  function call(name) {
    try {
      if (!isNative()) return null;
      var fn = window.NativeNotify[name];
      if (typeof fn !== 'function') return null;
      return fn.apply(window.NativeNotify, Array.prototype.slice.call(arguments, 1));
    } catch (e) { return null; }
  }

  function readJSON(key) {
    try {
      var v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function todayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function hhmmToTodayMillis(hhmm) {
    try {
      var p = String(hhmm || '').slice(0, 5).split(':');
      var h = Number(p[0]), m = Number(p[1]);
      if (isNaN(h) || isNaN(m)) return 0;
      var d = new Date();
      d.setHours(h, m, 0, 0);
      return d.getTime();
    } catch (e) { return 0; }
  }

  /* ---------- prayer: push today's timings to native alarms ---------- */
  var lastPrayerPush = '';
  function pushPrayerDay() {
    if (!isNative()) return false;
    try {
      var pc = readJSON('naqisna_prayer');
      if (!pc || !pc.timings || pc.day !== todayKey()) return false;
      var sig = pc.day + '|' + PRAYERS.map(function (p) { return String((pc.timings[p.id] || '')).slice(0, 5); }).join(',');
      if (sig === lastPrayerPush) return true;
      try {
        call('savePrayerConfig',
          String(pc.lat || 0), String(pc.lng || 0), '5',
          String(pc.place || ''), String(pc.govId || ''));
      } catch (e) {}
      var now = Date.now(), n = 0;
      PRAYERS.forEach(function (p) {
        var ts = hhmmToTodayMillis(pc.timings[p.id]);
        if (ts > now + 15000) {
          try { call('schedulePrayer', p.id, String(ts), p.name); n++; } catch (e) {}
        }
      });
      lastPrayerPush = sig;
      return n > 0;
    } catch (e) { return false; }
  }

  /* ---------- appointments: push next occurrences ---------- */
  function nextWeeklyOccurrence(a, from) {
    try {
      var days = a.days || [];
      if (!days.length) return 0;
      var dtMap = (a.dayTimes && typeof a.dayTimes === 'object') ? a.dayTimes : {};
      for (var off = 0; off < 8; off++) {
        var d = new Date(from.getTime() + off * 86400000);
        var jd = d.getDay();
        var hit = days.indexOf(jd) >= 0 || days.indexOf(String(jd)) >= 0;
        if (!hit) continue;
        var tm = dtMap[String(jd)] || dtMap[jd] || a.time || '09:00';
        var ts = new Date(d); 
        var pp = String(tm).slice(0, 5).split(':');
        ts.setHours(Number(pp[0]) || 9, Number(pp[1]) || 0, 0, 0);
        if (ts.getTime() > from.getTime()) return ts.getTime();
      }
    } catch (e) {}
    return 0;
  }

  function pushAppts() {
    if (!isNative()) return false;
    try {
      var st = readJSON('baytna_v2') || {};
      var list = Array.isArray(st._appts) ? st._appts : [];
      var now = Date.now(), out = [];
      list.forEach(function (a) {
        if (!a || a.done) return;
        var ts = 0;
        if (a.repeat === 'weekly') ts = nextWeeklyOccurrence(a, new Date());
        else if (a.date && a.time) {
          try {
            var dd = String(a.date).split('-');
            var tt = String(a.time).slice(0, 5).split(':');
            ts = new Date(Number(dd[0]), Number(dd[1]) - 1, Number(dd[2]),
              Number(tt[0]), Number(tt[1]), 0, 0).getTime();
          } catch (e) { ts = 0; }
        }
        if (!ts || ts <= now) return;
        var at = ts - (Number(a.remind) || 0) * 60000;
        if (at <= now) at = ts;
        out.push({ id: String(a.id), title: String(a.title || 'موعد هام'), ts: ts, at: at });
      });
      call('pushAppts', JSON.stringify(out));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- tasks + widget snapshot ---------- */
  var lastWidgetPush = '';
  function pushWidget() {
    if (!isNative()) return false;
    try {
      var st = readJSON('baytna_v2') || {};
      var tasks = (Array.isArray(st._tasks) ? st._tasks : []).filter(function (t) { return t && !t.done; });
      var orders = (Array.isArray(st.orders) ? st.orders : []).filter(function (o) { return o && o.status !== 'purchased'; });
      var appts = (Array.isArray(st._appts) ? st._appts : []).filter(function (a) { return a && !a.done; });
      var pc = readJSON('naqisna_prayer');
      var nextPrayer = null;
      if (pc && pc.timings && pc.day === todayKey()) {
        var now = Date.now();
        for (var i = 0; i < PRAYERS.length; i++) {
          var ts = hhmmToTodayMillis(pc.timings[PRAYERS[i].id]);
          if (ts > now) { nextPrayer = { n: PRAYERS[i].name, ts: ts }; break; }
        }
      }
      var snap = {
        date: todayKey(),
        tasksOpen: tasks.length,
        tasks: tasks.slice(0, 6).map(function (t) { return { t: String(t.title || '').slice(0, 60) }; }),
        ordersOpen: orders.length,
        apptsOpen: appts.length,
        nextAppt: null,
        nextPrayer: nextPrayer
      };
      var sig = JSON.stringify(snap);
      if (sig === lastWidgetPush) return true;
      lastWidgetPush = sig;
      call('pushWidgetData', sig);
      try {
        var pend = orders.map(function (o) { return { t: String(o.name || '').slice(0, 60) }; }).slice(0, 6);
        call('pushTasks', JSON.stringify(tasks.slice(0, 20).map(function (t) {
          return { id: String(t.id), t: String(t.title || '').slice(0, 80) };
        })));
        void pend;
      } catch (e) {}
      return true;
    } catch (e) { return false; }
  }

  /* ---------- new orders: real backend events (Supabase realtime/poll) ----------
     Notifies only when the page is hidden (app in background) so the user
     is not spammed for their own visible actions. Killed-app push needs
     FCM + server component (see FCM_SETUP.md). */
  function watchOrders() {
    if (!isNative()) return false;
    try {
      var st = readJSON('baytna_v2') || {};
      var orders = Array.isArray(st.orders) ? st.orders : [];
      var myName = '';
      try { myName = (st.user && st.user.name) || ''; } catch (e) {}
      var known = {};
      try { known = JSON.parse(localStorage.getItem('nb_known_orders') || '{}'); } catch (e) { known = {}; }
      var first = !localStorage.getItem('nb_known_orders');
      var changed = false, now = Date.now();
      var fresh = {};
      orders.forEach(function (o) {
        if (!o || o.status === 'purchased') return;
        var key = o.id || ('n:' + String(o.name || ''));
        if (!key || key === 'n:') return;
        fresh[key] = 1;
        if (!known[key]) {
          changed = true;
          // new pending order arrived via sync
          if (!first && document.hidden) {
            var byMe = myName && o.createdBy && o.createdBy === myName;
            if (!byMe) {
              try {
                notifyOrder('', '🛒 ' + String(o.name || 'طلب جديد').slice(0, 80)
                  + (o.createdBy ? ' — ' + String(o.createdBy).slice(0, 30) : ''));
              } catch (e) {}
            }
          }
        }
      });
      // prune entries older than 30 idle days is overkill; cap size instead
      var keys = Object.keys(fresh);
      if (keys.length > 300) fresh = keys.slice(-300).reduce(function (m, k) { m[k] = 1; return m; }, {});
      try { localStorage.setItem('nb_known_orders', JSON.stringify(fresh)); } catch (e) {}
      void now;
      return changed;
    } catch (e) { return false; }
  }

  function syncAll() {
    if (!isNative()) return false;
    var r = false;
    try { r = pushPrayerDay() || r; } catch (e) {}
    try { r = pushAppts() || r; } catch (e) {}
    try { r = pushWidget() || r; } catch (e) {}
    try { watchOrders(); } catch (e) {}
    return r;
  }

  /* ---------- public API ---------- */
  function nativeShow(title, body, kind) {
    if (!isNative()) return false;
    try {
      window.NativeNotify.show(String(title || ''), String(body || ''), String(kind || 'general'));
      return true;
    } catch (e) { return false; }
  }

  /* ---------- deep link: open the right in-app screen from widget/tap ---------- */
  function handleDeepLink() {
    try {
      var h = String(location.hash || '').replace('#', '');
      if (!h) return false;
      var sel = null;
      if (h === 'tasks') sel = '[data-goto-tasks]';
      else if (h === 'prayer') sel = '[data-prayer-times]';
      else if (h === 'azkar') sel = '[data-azkar-toggle]';
      if (!sel) return false;
      var el = document.querySelector(sel);
      if (el) {
        setTimeout(function () { try { el.click(); } catch (e) {} }, 600);
        return true;
      }
      return false;
    } catch (e) { return false; }
  }

  function notifyOrder(orderNo, summary) {    if (!isNative()) return false;
    try {
      if (typeof window.NativeNotify.notifyOrder === 'function') {
        window.NativeNotify.notifyOrder(String(orderNo || ''), String(summary || ''));
        return true;
      }
      return nativeShow('طلب جديد 🛒', (orderNo ? '#' + orderNo + ' ' : '') + (summary || ''), 'orders');
    } catch (e) { return false; }
  }

  function requestPermission() {
    if (isNative() && typeof window.NativeNotify.requestPermission === 'function') {
      try { window.NativeNotify.requestPermission(); } catch (e) {}
      return Promise.resolve('prompt');
    }
    try {
      if ('Notification' in window) {
        if (Notification.permission === 'granted') return Promise.resolve('granted');
        if (Notification.permission === 'denied') return Promise.resolve('denied');
        try {
          var p = Notification.requestPermission();
          if (p && typeof p.then === 'function') return p;
        } catch (e) {}
        return Promise.resolve(Notification.permission || 'prompt');
      }
    } catch (e) {}
    return Promise.resolve('unsupported');
  }

  window.AppNotify = {
    isNative: isNative,
    requestPermission: requestPermission,
    nativeShow: nativeShow,
    notifyOrder: notifyOrder,
    pushPrayerDay: pushPrayerDay,
    pushAppts: pushAppts,
    pushWidget: pushWidget,
    syncAll: syncAll,
    handleDeepLink: handleDeepLink,
    scheduleDaily: function (id, h, m, t, b, k) {
      try {
        if (!isNative() || typeof window.NativeNotify.scheduleDaily !== 'function') return false;
        window.NativeNotify.scheduleDaily(String(id), Number(h) || 0, Number(m) || 0,
          String(t || ''), String(b || ''), String(k || 'general'));
        return true;
      } catch (e) { return false; }
    },
    cancel: function (id) {
      try {
        if (!isNative() || typeof window.NativeNotify.cancel !== 'function') return false;
        window.NativeNotify.cancel(String(id));
        return true;
      } catch (e) { return false; }
    },
    /* Push WebView notification settings into native prefs (APK only).
       p = { prayers:{Fajr:bool,...}, cats:{cat_prayer:bool,...},
             adhanMode:'full'|'short'|'notify', quiet:[fromMin,toMin] } */
    syncPrefs: function (p) {
      try {
        if (!isNative()) return false;
        var N = window.NativeNotify;
        p = p || {};
        if (p.prayers && typeof p.prayers === 'object') {
          for (var id in p.prayers) {
            if (!Object.prototype.hasOwnProperty.call(p.prayers, id)) continue;
            try { if (typeof N.setPrayerEnabled === 'function') N.setPrayerEnabled(String(id), !!p.prayers[id]); } catch (e) {}
          }
        }
        if (p.cats && typeof p.cats === 'object') {
          for (var c in p.cats) {
            if (!Object.prototype.hasOwnProperty.call(p.cats, c)) continue;
            try { if (typeof N.setCatEnabled === 'function') N.setCatEnabled(String(c), !!p.cats[c]); } catch (e) {}
          }
        }
        try { if (typeof N.setAdhanMode === 'function' && p.adhanMode) N.setAdhanMode(String(p.adhanMode)); } catch (e) {}
        try {
          if (typeof N.setQuietHours === 'function' && p.quiet && p.quiet.length === 2) {
            N.setQuietHours(Number(p.quiet[0]) | 0, Number(p.quiet[1]) | 0);
          }
        } catch (e) {}
        return true;
      } catch (e) { return false; }
    }
  };

  /* auto-sync loop — APK WebView only */
  try {
    if (isNative()) {
      setTimeout(function () { try { syncAll(); } catch (e) {} }, 4000);
      setTimeout(function () { try { handleDeepLink(); } catch (e) {} }, 2500);
      setInterval(function () { try { syncAll(); } catch (e) {} }, 45000);
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) { try { syncAll(); } catch (e) {} }
      });
    }
  } catch (e) {}
})();
