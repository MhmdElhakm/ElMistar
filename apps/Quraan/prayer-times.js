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
  var CACHE_KEY = 'quran_prayer_cache_v1';
  var CITY_KEY = 'quran_prayer_city_v1';
  var activeContainer = null;
  var activeStatus = null;
  var countdownTimer = null;
  var requestController = null;
  var activeRequestId = 0;
  var cacheReadFailed = false;

  function todayKey(date) {
    date = date || new Date();
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function selectedCity() {
    var id = 'cairo';
    try { id = localStorage.getItem(CITY_KEY) || id; } catch (error) {}
    return CITIES.find(function (city) { return city.id === id; }) || CITIES[0];
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

    list.innerHTML = PRAYERS.map(function (prayer) {
      var formatted = formatTime(data.timings[prayer.id]);
      return '<div class="qpt-row"><span class="qpt-row-name">' + prayer.name +
        '</span><span class="qpt-row-time">' + escapeHtml(formatted.time) +
        '<small>' + escapeHtml(formatted.period) + '</small></span></div>';
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
          lat = CITIES[0].lat;
          lng = CITIES[0].lng;
          place = CITIES[0].name;
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
    loadTimes(false);
  }

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
