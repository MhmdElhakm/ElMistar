(function () {
  'use strict';

  var PRAYERS = [
    { id: 'Fajr', name: 'الفجر' },
    { id: 'Sunrise', name: 'الشروق' },
    { id: 'Dhuhr', name: 'الظهر' },
    { id: 'Asr', name: 'العصر' },
    { id: 'Maghrib', name: 'المغرب' },
    { id: 'Isha', name: 'العشاء' }
  ];
  var CITIES = [
    { id: 'cairo', name: 'القاهرة', lat: 30.0444, lng: 31.2357 },
    { id: 'giza', name: 'الجيزة', lat: 30.0131, lng: 31.2089 },
    { id: 'alex', name: 'الإسكندرية', lat: 31.2001, lng: 29.9187 },
    { id: 'dakahlia', name: 'الدقهلية', lat: 31.0379, lng: 31.3815 },
    { id: 'redsea', name: 'البحر الأحمر', lat: 27.2579, lng: 33.8116 },
    { id: 'beheira', name: 'البحيرة', lat: 31.0341, lng: 30.4682 },
    { id: 'fayoum', name: 'الفيوم', lat: 29.3084, lng: 30.8428 },
    { id: 'gharbia', name: 'الغربية', lat: 30.7865, lng: 31.0004 },
    { id: 'ismailia', name: 'الإسماعيلية', lat: 30.5965, lng: 32.2715 },
    { id: 'monufia', name: 'المنوفية', lat: 30.559, lng: 31.01 },
    { id: 'minya', name: 'المنيا', lat: 28.1099, lng: 30.7503 },
    { id: 'qalyubia', name: 'القليوبية', lat: 30.462, lng: 31.1848 },
    { id: 'newvalley', name: 'الوادي الجديد', lat: 25.45, lng: 30.546 },
    { id: 'suez', name: 'السويس', lat: 29.9668, lng: 32.5498 },
    { id: 'aswan', name: 'أسوان', lat: 24.0889, lng: 32.8998 },
    { id: 'asyut', name: 'أسيوط', lat: 27.1783, lng: 31.1859 },
    { id: 'benisuef', name: 'بني سويف', lat: 29.0661, lng: 31.099 },
    { id: 'portsaid', name: 'بورسعيد', lat: 31.2653, lng: 32.3019 },
    { id: 'damietta', name: 'دمياط', lat: 31.4165, lng: 31.8133 },
    { id: 'sharkia', name: 'الشرقية', lat: 30.5877, lng: 31.502 },
    { id: 'sohag', name: 'سوهاج', lat: 26.556, lng: 31.6948 },
    { id: 'sinaiN', name: 'شمال سيناء', lat: 31.1313, lng: 33.7984 },
    { id: 'sinaiS', name: 'جنوب سيناء', lat: 27.9828, lng: 34.3932 },
    { id: 'kafr', name: 'كفر الشيخ', lat: 31.1141, lng: 30.9414 },
    { id: 'matrouh', name: 'مطروح', lat: 31.3543, lng: 27.2373 },
    { id: 'luxor', name: 'الأقصر', lat: 25.6872, lng: 32.6396 },
    { id: 'qena', name: 'قنا', lat: 26.1642, lng: 32.7267 },
    { id: 'gps', name: 'موقعي الحالي (GPS)', lat: null, lng: null }
  ];
  var DEFAULT_CITY = CITIES.find(function (city) { return city.id === 'aswan'; }) || CITIES[0];
  var CACHE_KEY = 'quran_prayer_cache_v1';
  var CITY_KEY = 'quran_prayer_city_v1';
  var ALERTS_KEY = 'quran_prayer_alerts_v1';
  var ALERT_CACHE = 'quran-prayer-audio-v1';
  var AUDIO_PATH = './audio-cache/';
  var ALERT_PRAYERS = PRAYERS.slice();
  var ADHAN_VOICE_ID = 'adhan-makkah';
  var ADHAN_VOICES = {
    'adhan-makkah': {
      label: 'أذان المسجد الحرام · مكة',
      url: 'https://upload.wikimedia.org/wikipedia/commons/transcoded/a/a7/Adhan%2C_Great_Mosque_of_Mecca_-_Jan_21%2C_2013.webm/Adhan%2C_Great_Mosque_of_Mecca_-_Jan_21%2C_2013.webm.360p.mpeg4.mov',
      extension: 'mpeg4.mov',
      page: 'https://commons.wikimedia.org/wiki/File:Adhan,_Great_Mosque_of_Mecca_-_Jan_21,_2013.webm',
      credit: 'Seyfula Islam',
      licenseName: 'CC BY 3.0',
      license: 'https://creativecommons.org/licenses/by/3.0/'
    }
  };
  var DEFAULT_ALERTS = {
    enabled: { Fajr: false, Sunrise: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false },
    sound: true,
    voice: ADHAN_VOICE_ID,
    advance: 0,
    notifications: false
  };
  var activeContainer = null;
  var activeStatus = null;
  var countdownTimer = null;
  var alertTimer = null;
  var adhanAudio = new Audio();
  var audioLoadPromises = Object.create(null);
  var firedAlertKeys = Object.create(null);
  var requestController = null;
  var activeRequestId = 0;
  var cacheReadFailed = false;

  function todayKey(date) {
    date = date || new Date();
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  function prayerBellButton(prayer, enabled) {
    var label = (enabled ? 'إيقاف تنبيه صلاة ' : 'تفعيل تنبيه صلاة ') + prayer.name;
    return '<button type="button" class="qpt-bell' + (enabled ? ' is-enabled' : '') +
      '" data-qpt-prayer-toggle="' + prayer.id + '" aria-label="' + label +
      '" aria-pressed="' + enabled + '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>' +
      (enabled ? '' : '<path class="qpt-bell-slash" d="M4 4l16 16"/>') + '</svg></button>';
  }

  function togglePrayerAlert(button) {
    var prayerId = button.getAttribute('data-qpt-prayer-toggle');
    if (!prayerId) return;
    var prayer = ALERT_PRAYERS.find(function (item) { return item.id === prayerId; });
    if (!prayer) return;
    var alerts = readAlerts();
    alerts.enabled[prayerId] = !alerts.enabled[prayerId];
    if (!saveAlerts(alerts)) return;
    var updatedButton = prayerBellButton(prayer, alerts.enabled[prayerId]);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = updatedButton;
    button.replaceWith(wrapper.firstChild);
    setAlertStatus(alerts.enabled[prayerId]
      ? 'تم تفعيل تنبيه صلاة ' + prayer.name + '.'
      : 'تم إيقاف تنبيه صلاة ' + prayer.name + '.', 'success');
    startAlertScheduler();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function selectedCity() {
    var id = DEFAULT_CITY.id;
    try { id = localStorage.getItem(CITY_KEY) || id; } catch (error) {}
    return CITIES.find(function (city) { return city.id === id; }) || DEFAULT_CITY;
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      if (!data || data.format !== 'quran-prayer-cache' || data.version !== 1 ||
          !data.items || typeof data.items !== 'object' || Array.isArray(data.items)) {
        throw new Error('بيانات مواقيت الصلاة المحفوظة غير معروفة');
      }
      cacheReadFailed = false;
      return data.items;
    } catch (error) {
      cacheReadFailed = true;
      setStatus('تعذرت قراءة مواقيت الصلاة المحفوظة؛ لم يتم تغيير بياناتك.', 'error');
      return {};
    }
  }

  function writeCache(cityId, value) {
    if (cacheReadFailed) return false;
    try {
      var items = readCache();
      items[cityId] = value;
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        format: 'quran-prayer-cache',
        version: 1,
        items: items
      }));
      window.dispatchEvent(new CustomEvent('quran-prayer-times-updated'));
      return true;
    } catch (error) {
      return false;
    }
  }

  function readAlerts() {
    try {
      var raw = localStorage.getItem(ALERTS_KEY);
      if (!raw) return JSON.parse(JSON.stringify(DEFAULT_ALERTS));
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new Error('إعدادات التنبيه غير صالحة');
      return {
        enabled: ALERT_PRAYERS.reduce(function (enabled, prayer) {
          enabled[prayer.id] = saved.enabled && typeof saved.enabled[prayer.id] === 'boolean'
            ? saved.enabled[prayer.id] : DEFAULT_ALERTS.enabled[prayer.id];
          return enabled;
        }, {}),
        sound: typeof saved.sound === 'boolean' ? saved.sound : DEFAULT_ALERTS.sound,
        voice: ADHAN_VOICE_ID,
        advance: [0, 5, 10, 15].indexOf(Number(saved.advance)) !== -1 ? Number(saved.advance) : 0,
        notifications: saved.notifications === true
      };
    } catch (error) {
      console.error('تعذر قراءة إعدادات تنبيهات الصلاة.', error);
      setAlertStatus('تعذرت قراءة إعدادات التنبيه؛ عُرضت الإعدادات الافتراضية.', 'warning');
      return JSON.parse(JSON.stringify(DEFAULT_ALERTS));
    }
  }

  function saveAlerts(alerts) {
    try {
      localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
      return true;
    } catch (error) {
      console.error('تعذر حفظ إعدادات تنبيهات الصلاة.', error);
      setAlertStatus('تعذر حفظ الإعدادات على هذا الجهاز. تحقق من مساحة التخزين.', 'error');
      return false;
    }
  }

  function setAlertStatus(message, kind) {
    if (!activeContainer) return;
    var status = activeContainer.querySelector('[data-qpt-alert-status]');
    if (status) {
      status.textContent = kind === 'success' || kind === 'info' ? '' : message;
      status.dataset.kind = kind || 'info';
    }
  }

  function audioCacheUrl(voiceId) {
    var voice = ADHAN_VOICES[voiceId];
    var extension = voice && voice.extension || (voice && voice.url.split('?')[0].split('.').pop()) || 'ogg';
    return new URL(AUDIO_PATH + voiceId + '.' + extension, window.location.href).toString();
  }

  function loadAdhanVoice(voiceId) {
    var voice = ADHAN_VOICES[voiceId];
    if (!voice) return Promise.reject(new Error('صوت الأذان المختار غير معروف'));
    if (audioLoadPromises[voiceId]) return audioLoadPromises[voiceId];

    var localUrl = audioCacheUrl(voiceId);
    audioLoadPromises[voiceId] = (async function () {
      if ('caches' in window) {
        var cache = await caches.open(ALERT_CACHE);
        var cached = await cache.match(localUrl);
        if (cached) return localUrl;
        var response = await fetch(voice.url, { mode: 'cors', cache: 'force-cache' });
        if (!response.ok || response.type === 'opaque') {
          throw new Error('تعذر تنزيل التسجيل المرخّص. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
        }
        await cache.put(localUrl, response.clone());
        return localUrl;
      }
      return voice.url;
    })().catch(function (error) {
      delete audioLoadPromises[voiceId];
      throw error;
    });
    return audioLoadPromises[voiceId];
  }

  function removeUnusedAdhanCacheEntries() {
    if (!('caches' in window)) return Promise.resolve();
    return caches.open(ALERT_CACHE).then(function (cache) {
      var selectedUrl = audioCacheUrl(ADHAN_VOICE_ID);
      return cache.keys().then(function (keys) {
        return Promise.all(keys.filter(function (request) {
          return request.url !== selectedUrl;
        }).map(function (request) {
          return cache.delete(request);
        }));
      });
    });
  }

  function playSelectedAdhan() {
    loadAdhanVoice(ADHAN_VOICE_ID).then(function (url) {
      adhanAudio.src = url;
      adhanAudio.currentTime = 0;
      return adhanAudio.play();
    }).catch(function (error) {
      console.error('تعذر تشغيل الأذان عند موعد الصلاة.', error);
      setAlertStatus('تعذر تشغيل تسجيل الأذان تلقائيًا. افتح التطبيق وتحقق من اتصال الإنترنت.', 'warning');
    });
  }

  function sendNotification(prayer, isAdvance) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var title = isAdvance ? 'اقترب موعد صلاة ' + prayer.name : 'حان الآن وقت صلاة ' + prayer.name;
    var options = {
      body: isAdvance ? 'باقي ' + readAlerts().advance + ' دقائق على الصلاة.' : 'حيّ على الصلاة.',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'quran-prayer-' + prayer.id + (isAdvance ? '-reminder' : ''),
      renotify: false,
      vibrate: [180, 90, 180],
      data: { url: './' }
    };
    var notification;
    try {
      notification = navigator.serviceWorker && navigator.serviceWorker.ready
        ? navigator.serviceWorker.ready.then(function (registration) {
          if (!registration.showNotification) throw new Error('إشعارات عامل الخدمة غير مدعومة');
          return registration.showNotification(title, options);
        })
        : Promise.resolve(new Notification(title, options));
    } catch (error) {
      notification = Promise.reject(error);
    }
    notification.catch(function (error) {
      console.error('تعذر عرض إشعار الصلاة.', error);
      setAlertStatus('تعذر عرض الإشعار. تحقق من إعدادات إشعارات المتصفح.', 'warning');
    });
  }

  function checkPrayerAlerts() {
    var alerts = readAlerts();
    var cityId = selectedCity().id;
    var cache = readCache()[cityId];
    if (!cache || !cache.timings || cache.day !== todayKey()) return;

    var now = new Date();
    var today = todayKey(now);
    ALERT_PRAYERS.forEach(function (prayer) {
      if (!alerts.enabled[prayer.id]) return;
      var at = timeDate(cache.timings[prayer.id], now);
      if (!at) return;
      [
        { minutes: alerts.advance, isAdvance: true },
        { minutes: 0, isAdvance: false }
      ].forEach(function (item) {
        if (item.isAdvance && !item.minutes) return;
        var target = new Date(at.getTime() - item.minutes * 60000);
        var elapsed = now.getTime() - target.getTime();
        if (elapsed < 0 || elapsed > 90000) return;
        var key = 'quran_prayer_alert_fired_' + cityId + '_' + today + '_' +
          prayer.id + (item.isAdvance ? '_before' : '');
        if (firedAlertKeys[key]) return;
        try {
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
        } catch (error) {
          console.error('تعذر تسجيل تنبيه الصلاة لمنع تكراره.', error);
          setAlertStatus('تعذر حفظ سجل التنبيه؛ سيعمل منع التكرار حتى إغلاق الصفحة فقط.', 'warning');
        }
        firedAlertKeys[key] = true;
        if (alerts.sound) playSelectedAdhan();
        if (alerts.notifications) sendNotification(prayer, item.isAdvance);
        if (!alerts.notifications && !alerts.sound) {
          setAlertStatus('حان وقت صلاة ' + prayer.name + '.', 'info');
        } else {
          setAlertStatus(item.isAdvance
            ? 'تذكير: بقي ' + item.minutes + ' دقائق على صلاة ' + prayer.name + '.'
            : 'حان وقت صلاة ' + prayer.name + '.', 'success');
        }
      });
    });
  }

  function startAlertScheduler() {
    if (alertTimer) return;
    checkPrayerAlerts();
    alertTimer = setInterval(checkPrayerAlerts, 15000);
  }

  function renderAlertSettings() {
    var alerts = readAlerts();
    var settings = activeContainer && activeContainer.querySelector('[data-qpt-alerts]');
    if (!settings) return;
    settings.innerHTML =
      '<summary class="qpt-alert-summary"><span><b>إعدادات الأذان والتنبيهات</b>' +
      '<small>' + ADHAN_VOICES[ADHAN_VOICE_ID].label +
      '</small></span><i aria-hidden="true"></i></summary>' +
      '<div class="qpt-alert-content">' +
      '<details class="qpt-audio-info"><summary aria-label="معلومات مصدر الأذان وترخيصه" title="معلومات مصدر الأذان وترخيصه">ⓘ</summary>' +
      '<div>التسجيل: <a href="' + ADHAN_VOICES[ADHAN_VOICE_ID].page +
      '" target="_blank" rel="noopener noreferrer">' + ADHAN_VOICES[ADHAN_VOICE_ID].credit +
      '</a> · الترخيص: <a href="' + ADHAN_VOICES[ADHAN_VOICE_ID].license +
      '" target="_blank" rel="noopener noreferrer">' + ADHAN_VOICES[ADHAN_VOICE_ID].licenseName + '</a></div></details>' +
      '<label class="qpt-alert-option"><span>التذكير قبل الصلاة</span><select data-qpt-advance>' +
      [[0, 'وقت الصلاة فقط'], [5, 'قبلها بـ٥ دقائق'], [10, 'قبلها بـ١٠ دقائق'], [15, 'قبلها بـ١٥ دقيقة']].map(function (option) {
        return '<option value="' + option[0] + '"' + (alerts.advance === option[0] ? ' selected' : '') +
          '>' + option[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label class="qpt-alert-toggle"><input type="checkbox" data-qpt-sound' +
      (alerts.sound ? ' checked' : '') + '><span>تشغيل أذان المسجد الحرام عند التنبيه</span></label>' +
      '<div class="qpt-notification-row"><span data-qpt-notification-label></span>' +
      '<button type="button" class="qpt-notification-button" data-qpt-notifications></button></div>' +
      '<p class="qpt-alert-status" data-qpt-alert-status role="status" aria-live="polite"></p></div>';
    settings.open = false;
    updateNotificationButton();
    settings.querySelectorAll('[data-qpt-advance], [data-qpt-sound]').forEach(function (input) {
      input.addEventListener('change', function () {
        var next = readAlerts();
        if (input.hasAttribute('data-qpt-advance')) next.advance = Number(input.value);
        if (input.hasAttribute('data-qpt-sound')) next.sound = input.checked;
        if (saveAlerts(next)) setAlertStatus('حُفظت إعدادات التنبيه على هذا الجهاز.', 'success');
        startAlertScheduler();
      });
    });
    settings.querySelector('[data-qpt-notifications]').addEventListener('click', enableNotifications);
  }

  function updateNotificationButton() {
    if (!activeContainer) return;
    var button = activeContainer.querySelector('[data-qpt-notifications]');
    var label = activeContainer.querySelector('[data-qpt-notification-label]');
    if (!button || !label) return;
    var row = activeContainer.querySelector('.qpt-notification-row');
    if (!('Notification' in window) || Notification.permission === 'denied') {
      if (row) row.hidden = true;
      return;
    }
    if (row) row.hidden = false;
    button.hidden = false;
    var alerts = readAlerts();
    if (Notification.permission === 'granted' && alerts.notifications) {
      label.textContent = 'إشعارات النظام مفعّلة';
      button.textContent = 'إيقاف الإشعارات';
    } else if (Notification.permission === 'granted') {
      label.textContent = '';
      button.textContent = 'تفعيل الإشعارات';
    } else {
      label.textContent = '';
      button.textContent = 'تفعيل الإشعارات';
    }
  }

  function enableNotifications() {
    if (!('Notification' in window)) {
      setAlertStatus('المتصفح لا يدعم إشعارات النظام.', 'warning');
      return;
    }
    var current = readAlerts();
    if (Notification.permission === 'granted' && current.notifications) {
      current.notifications = false;
      if (saveAlerts(current)) {
        updateNotificationButton();
      }
      return;
    }
    if (Notification.permission === 'denied') {
      setAlertStatus('السماح محظور. غيّر إذن الإشعارات من إعدادات المتصفح لهذا الموقع.', 'warning');
      return;
    }
    (Notification.permission === 'granted'
      ? Promise.resolve('granted')
      : Notification.requestPermission()).then(function (permission) {
      current = readAlerts();
      current.notifications = permission === 'granted';
      if (!saveAlerts(current)) return;
      updateNotificationButton();
      startAlertScheduler();
    }).catch(function (error) {
      console.error('تعذر طلب إذن إشعارات الصلاة.', error);
      setAlertStatus('تعذر طلب إذن الإشعارات من المتصفح.', 'error');
    });
  }

  function timeDate(value, date) {
    var match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return null;
    var result = new Date(date || new Date());
    result.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return result;
  }

  function prayerRange(timings) {
    var now = new Date();
    var previous = null;
    var next = null;
    PRAYERS.forEach(function (prayer) {
      var at = timeDate(timings[prayer.id], now);
      if (!at) return;
      if (at <= now) previous = { prayer: prayer, at: at };
      else if (!next) next = { prayer: prayer, at: at };
    });
    if (!next) {
      var fajr = timeDate(timings.Fajr, now);
      if (fajr) {
        fajr.setDate(fajr.getDate() + 1);
        next = { prayer: PRAYERS[0], at: fajr };
      }
    }
    if (!previous) {
      var yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      var isha = timeDate(timings.Isha, yesterday);
      if (isha) previous = { prayer: PRAYERS[5], at: isha };
    }
    return { previous: previous, next: next };
  }

  function formatTime(value) {
    var match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    if (!match) return { time: String(value || '—'), period: '' };
    var hour = Number(match[1]) % 24;
    var period = hour < 12 ? 'ص' : 'م';
    hour = hour % 12 || 12;
    return { time: hour + ':' + match[2], period: period };
  }

  function formatCountdown(milliseconds) {
    var seconds = Math.max(0, Math.floor(milliseconds / 1000));
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var rest = seconds % 60;
    return [hours, minutes, rest].map(function (value) {
      return String(value).padStart(2, '0');
    }).join(':');
  }

  function setStatus(message, kind) {
    if (!activeContainer) return;
    var status = activeContainer.querySelector('[data-qpt-status]');
    if (status) {
      status.textContent = message;
      status.dataset.kind = kind || 'info';
    }
    if (activeStatus) activeStatus(selectedCity().name + ' · الهيئة المصرية العامة للمساحة');
  }

  function drawTimes(data, isStale) {
    if (!activeContainer || !data || !data.timings) return;
    var list = activeContainer.querySelector('[data-qpt-list]');
    var title = activeContainer.querySelector('[data-qpt-next]');
    var clock = activeContainer.querySelector('[data-qpt-countdown]');
    var ring = activeContainer.querySelector('[data-qpt-ring]');
    var hijri = activeContainer.querySelector('[data-qpt-hijri]');
    if (!list) return;

    var alerts = readAlerts();
    list.innerHTML = PRAYERS.map(function (prayer) {
      var formatted = formatTime(data.timings[prayer.id]);
      return '<div class="qpt-row"><span class="qpt-row-name">' + prayer.name +
        '</span><span class="qpt-row-time">' + escapeHtml(formatted.time) +
        '<small>' + escapeHtml(formatted.period) + '</small></span>' +
        prayerBellButton(prayer, Boolean(alerts.enabled[prayer.id])) + '</div>';
    }).join('');

    var month = data.hijri && data.hijri.month ? data.hijri.month.ar : '';
    hijri.textContent = data.hijri && data.hijri.day
      ? data.hijri.day + ' ' + month + ' ' + data.hijri.year + 'هـ'
      : new Date(data.day || Date.now()).toLocaleDateString('ar-EG');

    if (isStale) {
      title.textContent = 'آخر مواقيت محفوظة';
      clock.textContent = '—';
      ring.style.strokeDashoffset = '471.2';
      return;
    }

    var range = prayerRange(data.timings);
    if (!range.next) {
      title.textContent = 'لا تتوفر مواقيت قادمة';
      clock.textContent = '—';
      return;
    }

    title.textContent = range.next.prayer.name;
    var circumference = 2 * Math.PI * 75;
    function tick() {
      if (!activeContainer || !range.next) return;
      var remaining = range.next.at - new Date();
      if (remaining <= 0) {
        if (countdownTimer) clearInterval(countdownTimer);
        countdownTimer = null;
        loadTimes(true);
        return;
      }
      clock.textContent = formatCountdown(remaining);
      if (range.previous) {
        var duration = range.next.at - range.previous.at;
        var progress = duration > 0 ? (Date.now() - range.previous.at) / duration : 0;
        ring.style.strokeDashoffset = String(circumference * (1 - Math.max(0, Math.min(1, progress))));
      }
    }
    tick();
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = setInterval(tick, 1000);
  }

  function getPosition() {
    return new Promise(function (resolve) {
      if (!navigator.geolocation) { resolve(null); return; }
      var timeout = setTimeout(function () { resolve(null); }, 8000);
      navigator.geolocation.getCurrentPosition(function (position) {
        clearTimeout(timeout);
        resolve(position);
      }, function () {
        clearTimeout(timeout);
        resolve(null);
      }, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
    });
  }

  async function loadTimes(force) {
    if (!activeContainer) return;
    var requestId = ++activeRequestId;
    var city = selectedCity();
    var cache = readCache()[city.id] || null;
    var today = todayKey();
    if (cache && cache.timings) {
      var freshForToday = cache.day === today;
      drawTimes(cache, !freshForToday);
      if (freshForToday) setStatus('مواقيت اليوم محفوظة على هذا الجهاز.', 'info');
      else setStatus('المعروض آخر مواقيت محفوظة من ' + (cache.day || 'يوم سابق') + '، وقد لا تناسب تاريخ اليوم.', 'warning');
    }
    if (!force && cache && cache.day === today) {
      setStatus('مواقيت اليوم محفوظة؛ جارٍ التحقق من وجود تحديث.', 'info');
    } else if (!cache) {
      setStatus('جارٍ تحميل مواقيت الصلاة للمدينة المحددة…', 'info');
    }

    if (requestController) requestController.abort();
    requestController = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = requestController ? setTimeout(function () { requestController.abort(); }, 12000) : null;
    try {
      var lat = city.lat;
      var lng = city.lng;
      var place = city.name;
      if (city.id === 'gps') {
        var position = await getPosition();
        if (position && position.coords) {
          lat = position.coords.latitude;
          lng = position.coords.longitude;
          place = 'موقعي الحالي';
        } else if (cache && Number.isFinite(cache.lat) && Number.isFinite(cache.lng)) {
          lat = cache.lat;
          lng = cache.lng;
          place = cache.place || place;
        } else {
          lat = DEFAULT_CITY.lat;
          lng = DEFAULT_CITY.lng;
          place = DEFAULT_CITY.name;
        }
      }
      var now = new Date();
      var date = String(now.getDate()).padStart(2, '0') + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' + now.getFullYear();
      var params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lng),
        method: '5'
      });
      var response = await fetch('https://api.aladhan.com/v1/timings/' + date + '?' + params.toString(), {
        cache: 'no-store',
        signal: requestController ? requestController.signal : undefined
      });
      if (requestId !== activeRequestId || !activeContainer) return;
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var payload = await response.json();
      if (requestId !== activeRequestId || !activeContainer) return;
      var result = payload && payload.data;
      if (!result || !result.timings || !result.timings.Fajr) throw new Error('بيانات مواقيت الصلاة غير مكتملة');
      var saved = {
        timings: result.timings,
        hijri: result.date && result.date.hijri || null,
        day: today,
        lat: lat,
        lng: lng,
        place: place,
        city: city.name
      };
      drawTimes(saved, false);
      var persisted = writeCache(city.id, saved);
      setStatus(persisted
        ? 'حُدّثت المواقيت وحُفظت على هذا الجهاز دون إنترنت.'
        : 'تم تحميل المواقيت، لكن تعذر حفظها على هذا الجهاز.', persisted ? 'success' : 'warning');
    } catch (error) {
      if (requestId !== activeRequestId || !activeContainer) return;
      if (error && error.name === 'AbortError' && !activeContainer) return;
      if (cache && cache.timings && cache.day === today) {
        drawTimes(cache, false);
        setStatus('تعذر الاتصال؛ نعرض مواقيت اليوم المحفوظة دون إنترنت.', 'warning');
      } else if (cache && cache.timings) {
        drawTimes(cache, true);
        setStatus('لا يتوفر اتصال لتحديث مواقيت اليوم. المعروض آخر حفظ من ' + (cache.day || 'يوم سابق') + '.', 'warning');
      } else {
        setStatus(cacheReadFailed
          ? 'تعذرت قراءة المواقيت المحفوظة، ولم يتم استبدالها. تحقق من الاتصال ثم أعد المحاولة.'
          : 'تعذر جلب المواقيت. تحقق من الاتصال ثم أعد المحاولة.', 'error');
        var list = activeContainer && activeContainer.querySelector('[data-qpt-list]');
        if (list) list.innerHTML = '<div class="qpt-row"><span class="qpt-row-name">لم تُحمّل مواقيت اليوم بعد.</span></div>';
      }
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  function open(container, onStatus) {
    close();
    cacheReadFailed = false;
    activeContainer = container;
    activeStatus = onStatus || function () {};
    removeUnusedAdhanCacheEntries().catch(function (error) {
      console.error('تعذر حذف تسجيلات الأذان غير المختارة من التخزين المؤقت.', error);
      setAlertStatus('تعذر حذف التسجيلات الصوتية القديمة من هذا الجهاز.', 'warning');
    });
    var city = selectedCity();
    container.innerHTML = '<section class="qpt" aria-label="مواقيت الصلاة">' +
      '<header class="qpt-head"><div class="qpt-head-copy"><h2>صلواتي</h2><div class="qpt-date" data-qpt-date></div></div>' +
      '<label class="qpt-city-label">المدينة<select class="qpt-city" data-qpt-city aria-label="اختر المحافظة أو موقعك"></select></label></header>' +
      '<div class="qpt-hero"><div class="qpt-ring-wrap"><svg class="qpt-ring" viewBox="0 0 170 170" aria-hidden="true">' +
      '<circle class="qpt-ring-bg" cx="85" cy="85" r="75"></circle><circle class="qpt-ring-fg" data-qpt-ring cx="85" cy="85" r="75"></circle></svg>' +
      '<div class="qpt-ring-copy"><b class="qpt-next-label" data-qpt-next>جارٍ التجهيز</b><span class="qpt-countdown" data-qpt-countdown dir="ltr">--:--:--</span></div></div>' +
      '<div class="qpt-remaining">الوقت المتبقي للصلاة القادمة</div><div class="qpt-hijri" data-qpt-hijri></div></div>' +
      '<div class="qpt-status" data-qpt-status role="status" aria-live="polite"></div>' +
      '<div class="qpt-list" data-qpt-list aria-label="مواقيت الصلاة"></div>' +
      '<details class="qpt-alerts" data-qpt-alerts aria-label="إعدادات تنبيهات الأذان"></details>' +
      '<div class="qpt-actions"><button type="button" class="qpt-retry" data-qpt-retry>تحديث المواقيت</button></div>' +
      '<p class="qpt-note">طريقة الحساب: الهيئة المصرية العامة للمساحة — قد تختلف المواقيت باختلاف الموقع المحلي.</p>' +
      '</section>';
    var select = container.querySelector('[data-qpt-city]');
    select.innerHTML = CITIES.map(function (item) {
      return '<option value="' + item.id + '"' + (item.id === city.id ? ' selected' : '') + '>' +
        escapeHtml(item.name) + '</option>';
    }).join('');
    var dateElement = container.querySelector('[data-qpt-date]');
    dateElement.textContent = new Date().toLocaleDateString('ar-EG', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    activeStatus = onStatus || null;
    select.addEventListener('change', function () {
      try { localStorage.setItem(CITY_KEY, select.value); } catch (error) {
        activeStatus('تعذر حفظ اختيار المحافظة، وسيعود الاختيار الافتراضي عند إعادة الفتح.', 'warning');
      }
      window.dispatchEvent(new CustomEvent('quran-prayer-times-updated'));
      loadTimes(true);
    });
    container.querySelector('[data-qpt-retry]').addEventListener('click', function () {
      loadTimes(true);
    });
    container.querySelector('[data-qpt-list]').addEventListener('click', function (event) {
      var button = event.target.closest('[data-qpt-prayer-toggle]');
      if (button) togglePrayerAlert(button);
    });
    renderAlertSettings();
    startAlertScheduler();
    loadTimes(false);
  }

  startAlertScheduler();

  function close() {
    activeRequestId++;
    if (countdownTimer) clearInterval(countdownTimer);
    countdownTimer = null;
    if (requestController) requestController.abort();
    requestController = null;
    activeContainer = null;
    activeStatus = null;
  }

  window.QuranPrayerTimes = { open: open, close: close };
})();
