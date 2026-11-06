  (() => {
    'use strict';

    const host = document.getElementById('tasksApp');
    if (!host) return;
    const root = host.attachShadow({ mode: 'open' });
    const storageKey = 'quran_tasks_v1';
    const taskCompletionSound = new Audio('./note.mp3');
    taskCompletionSound.preload = 'auto';
    function playTaskCompletionSound() {
      taskCompletionSound.currentTime = 0;
      const playback = taskCompletionSound.play();
      if (playback && typeof playback.catch === 'function') playback.catch(error => {
        console.error('تعذر تشغيل صوت إكمال المهمة.', error);
        if (window.MushafRuntime && window.MushafRuntime.toast) {
          window.MushafRuntime.toast('تعذر تشغيل صوت إكمال المهمة.');
        }
      });
    }
    const days = [
      { value: 6, label: 'السبت' }, { value: 0, label: 'الأحد' },
      { value: 1, label: 'الاثنين' }, { value: 2, label: 'الثلاثاء' },
      { value: 3, label: 'الأربعاء' }, { value: 4, label: 'الخميس' },
      { value: 5, label: 'الجمعة' }
    ];
    const defaultTaskSections = [
      { key: 'fajr', category: 'الفجر', icon: 'mosque', tasks: [
        ['أذكار الاستيقاظ', 1], ['السنة القبلية', 2], ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1], ['أذكار الصباح', 2], ['الضحى ٤ ركعات', 2]
      ] },
      { key: 'duhr', category: 'الظهر', icon: 'mosque', tasks: [
        ['السنة القبلية ٤ ركعات', 2], ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1], ['السنة البعدية', 2]
      ] },
      { key: 'asr', category: 'العصر', icon: 'mosque', tasks: [
        ['الجماعة الأولى', 2], ['أذكار بعد الصلاة', 1], ['أذكار المساء', 2]
      ] },
      { key: 'magh', category: 'المغرب', icon: 'mosque', tasks: [
        ['الجماعة الأولى', 2], ['أذكار بعد الصلاة', 1], ['السنة البعدية', 2]
      ] },
      { key: 'isha', category: 'العشاء', icon: 'mosque', tasks: [
        ['الجماعة الأولى', 2], ['أذكار بعد الصلاة', 1], ['السنة البعدية', 2]
      ] },
      { key: 'qiyam', category: 'قيام الليل والوتر', icon: 'moon', tasks: [
        ['ركعتان قيام ليل', 2], ['الوتر', 2]
      ] },
      { key: 'quran', category: 'الفجر', icon: 'book', tasks: [
        ['حفظ نصف صفحة', 2], ['الورد اليومي', 2]
      ] }
    ];
    const defaultTasks = defaultTaskSections.flatMap(section => section.tasks.map((task, index) => ({
      id: 'daily-default-' + section.key + '-' + index,
      title: task[0],
      points: task[1],
      category: section.category,
      icon: section.icon,
      defaultTask: true,
      daily: true
    })));
    const defaultLeaderboard = [
      { name: 'قارئ مجتهد', points: 1200 },
      { name: 'محافظ على ورده', points: 950 },
      { name: 'طالب علم', points: 780 }
    ];
    const icons = [
      ['mosque', '🕌', 'صلاة'], ['sparkle', '📿', 'أذكار'], ['drop', '💧', 'مياه'],
      ['activity', '🏃', 'رياضة'], ['dumbbell', '💪', 'تمارين'], ['walk', '🚶', 'مشي'],
      ['book', '📖', 'قراءة'], ['moon', '🌙', 'نوم'], ['sun', '☀️', 'صباح'],
      ['leaf', '🥗', 'أكل صحي'], ['apple', '🍎', 'فاكهة'], ['pill', '💊', 'دواء'],
      ['heart', '❤️', 'صحة'], ['smile', '🙏', 'امتنان'], ['target', '🎯', 'هدف'],
      ['trophy', '🏆', 'إنجاز'], ['ban', '🚭', 'إقلاع'], ['flame', '🔥', 'حماس'],
      ['bolt', '⚡', 'طاقة'], ['star', '⭐', 'عام'], ['check', '✅', 'تم'], ['home', '🏠', 'بيت']
    ];
    const taskIconPaths = {
      mosque: '<path d="M3 20h18M5 20V10h14v10M8 10V7l4-3 4 3v3M10 20v-5h4v5M3 10l9-6 9 6"/>',
      sparkle: '<path d="M12 3 14 9l6 3-6 2-2 7-2-7-6-2 6-3 2-6Z"/><path d="m19 3 .7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7L19 3Z"/>',
      drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
      activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
      dumbbell: '<path d="M6 9v6M3 10v4M18 9v6M21 10v4M6 12h12"/>',
      walk: '<circle cx="14" cy="5" r="2"/><path d="m12 9-3 4 3 2 1 5M12 10l4 3 3 1M9 13l-4 5M13 15l4 4"/>',
      book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6"/>',
      moon: '<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>',
      sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
      leaf: '<path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 10-7 9-16Z"/><path d="M5 20c3-5 7-8 12-11"/>',
      apple: '<path d="M12 8c-2-3-7-2-8 2-1 5 2 11 6 11 1 0 1.5-.5 2-.5s1 .5 2 .5c4 0 7-6 6-11-1-4-6-5-8-2Z"/><path d="M12 8c0-3 1-5 4-6-1 3-2 5-4 6Z"/>',
      pill: '<path d="M4.8 19.2a5 5 0 0 1 0-7.1l7.3-7.3a5 5 0 0 1 7.1 7.1l-7.3 7.3a5 5 0 0 1-7.1 0Z"/><path d="m8.3 8.6 7.1 7.1"/>',
      heart: '<path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/>',
      smile: '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
      target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m14 10 6-6m-4 0h4v4"/>',
      trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
      ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
      flame: '<path d="M13 3c1 4-2 5-1 8 1-2 3-3 4-5 3 3 5 7 3 11a7.5 7.5 0 0 1-14-1c-1-4 1-8 5-11 0 4 1 5 2 6 1-3 2-5 1-8Z"/><path d="M10 17a2 2 0 0 0 4 0c0-1-1-2-2-3-1 1-2 2-2 3Z"/>',
      bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
      star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
      check: '<path d="m5 12 4 4L19 6"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10"/>',
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z"/>'
    };
    const taskIconSvg = (name, className) =>
      `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${taskIconPaths[name] || taskIconPaths.star}</svg>`;
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
    const localDate = date => {
      const d = date || new Date();
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    };
    const validDays = values => Array.isArray(values)
      ? [...new Set(values.map(Number).filter(value => Number.isInteger(value) && value >= 0 && value <= 6))]
      : [];
    const uid = () => (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2);
    const readLegacy = () => {
      try {
        const raw = localStorage.getItem('baytna_v2');
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        console.error('تعذر قراءة بيانات المهام القديمة من baytna_v2.', error);
        return null;
      }
    };
    const cleanTasks = value => Array.isArray(value) ? value.filter(item =>
      item && typeof item === 'object' && String(item.title || '').trim()
    ).map(item => Object.assign({}, item, {
      id: String(item.id || uid()),
      title: String(item.title).trim().slice(0, 120),
      done: item.done === true,
      points: Number.isInteger(Number(item.points)) && Number(item.points) >= 0 && Number(item.points) <= 100
        ? Number(item.points)
        : 0,
      days: validDays(item.days),
      hist: item.hist && typeof item.hist === 'object' ? item.hist : {}
    })) : [];
    let data;
    let storageError = '';
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        data = JSON.parse(saved);
      } else {
        const legacy = readLegacy();
        data = {
          tasks: cleanTasks(legacy && legacy._tasks),
          defaultTasksVersion: 0,
          taskDraft: { title: '', icon: 'star', daily: false, days: [] },
          formOpen: false
        };
        if (data.tasks.length) {
          localStorage.setItem(storageKey, JSON.stringify(data));
        }
      }
    } catch (error) {
      console.error('تعذر تحميل بيانات المهام.', error);
      storageError = 'تعذر تحميل البيانات المحفوظة. تحقق من مساحة التخزين في المتصفح.';
      data = {};
    }
    const state = {
      tasks: cleanTasks(data && data.tasks),
      view: 'tasks',
      profile: (function (value, tasks) {
        return {
          name: typeof (value && value.name) === 'string' ? value.name.slice(0, 80) : '',
          age: Number.isInteger(Number(value && value.age)) && Number(value.age) >= 1 && Number(value.age) <= 120
            ? Number(value.age)
            : '',
          phone: typeof (value && value.phone) === 'string' ? value.phone.slice(0, 24) : '',
          avatar: typeof (value && value.avatar) === 'string' && value.avatar.indexOf('data:image/') === 0
            ? value.avatar
            : '',
          totalPoints: value && Number.isSafeInteger(Number(value.totalPoints)) && Number(value.totalPoints) >= 0
            ? Number(value.totalPoints)
            : (tasks || []).filter(task => task.done).reduce((total, task) => total + (Number(task.points) || 0), 0)
        };
      })(data && data.profile, cleanTasks(data && data.tasks)),
      profileFormOpen: false,
      defaultTasksVersion: Number(data && data.defaultTasksVersion) || 0,
      taskDraft: Object.assign(
        { title: '', icon: 'star', points: 1, category: '', daily: false, days: [], daysOpen: false },
        data && data.taskDraft && typeof data.taskDraft === 'object' ? data.taskDraft : {}
      ),
      formOpen: data && data.formOpen === true
    };
    function save() {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          tasks: state.tasks, profile: state.profile,
          defaultTasksVersion: state.defaultTasksVersion,
          taskDraft: state.taskDraft, formOpen: state.formOpen
        }));
        storageError = '';
        return true;
      } catch (error) {
        console.error('تعذر حفظ بيانات المهام.', error);
        storageError = 'لم يتم حفظ التغيير؛ مساحة تخزين المتصفح غير متاحة أو ممتلئة.';
        render();
        return false;
      }
    }
    const backupFormat = 'qurany-app-backup';
    const backupLimit = 20 * 1024 * 1024;
    function isAppStorageKey(key) {
      return key === 'quran_tasks_v1' || key === 'baytna_v2' ||
        key.indexOf('mq.') === 0 && key !== 'mq.offlineReady' && key !== 'mq.pagesPreparedV2' ||
        key.indexOf('quran_') === 0 || key.indexOf('tq_') === 0;
    }
    function exportAppData() {
      try {
        const data = {};
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key && isAppStorageKey(key)) data[key] = localStorage.getItem(key);
        }
        const backup = {
          format: backupFormat,
          version: 1,
          createdAt: new Date().toISOString(),
          data: data
        };
        const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'Qurany-backup-' + localDate() + '.json';
        link.hidden = true;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        storageError = '';
        render();
      } catch (error) {
        console.error('تعذر إنشاء نسخة Qurany الاحتياطية.', error);
        storageError = 'تعذر إنشاء النسخة الاحتياطية. تحقق من مساحة التخزين ثم أعد المحاولة.';
        render();
      }
    }
    async function importAppData(file) {
      if (!file) return;
      if (file.size > backupLimit) {
        storageError = 'حجم ملف النسخة الاحتياطية أكبر من الحد المسموح (٢٠ ميجابايت).';
        render();
        return;
      }
      let backup;
      try {
        backup = JSON.parse(await file.text());
      } catch (error) {
        console.error('تعذر قراءة ملف النسخة الاحتياطية.', error);
        storageError = 'تعذر قراءة الملف. اختر نسخة Qurany الاحتياطية بصيغة JSON.';
        render();
        return;
      }
      if (!backup || backup.format !== backupFormat || backup.version !== 1 ||
          !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
        storageError = 'الملف المحدد ليس نسخة احتياطية صالحة من Qurany.';
        render();
        return;
      }
      const entries = Object.entries(backup.data);
      if (entries.length > 500 || entries.some(([key, value]) =>
        !isAppStorageKey(key) || typeof value !== 'string')) {
        storageError = 'تحتوي النسخة على بيانات غير صالحة أو غير متوافقة.';
        render();
        return;
      }
      if (!window.confirm('سيتم استبدال بيانات Qurany على هذا الجهاز بمحتويات النسخة الاحتياطية. هل تريد المتابعة؟')) return;

      const previous = {};
      try {
        for (let index = 0; index < localStorage.length; index++) {
          const key = localStorage.key(index);
          if (key && isAppStorageKey(key)) previous[key] = localStorage.getItem(key);
        }
        Object.keys(previous).forEach(key => localStorage.removeItem(key));
        entries.forEach(([key, value]) => localStorage.setItem(key, value));
        window.location.reload();
      } catch (error) {
        console.error('تعذر استعادة نسخة Qurany الاحتياطية.', error);
        try {
          for (let index = localStorage.length - 1; index >= 0; index--) {
            const key = localStorage.key(index);
            if (key && isAppStorageKey(key)) localStorage.removeItem(key);
          }
          Object.keys(previous).forEach(key => localStorage.setItem(key, previous[key]));
        } catch (rollbackError) {
          console.error('تعذر التراجع عن استعادة النسخة الاحتياطية.', rollbackError);
        }
        storageError = 'تعذرت استعادة النسخة. لم يكتمل التغيير؛ تحقق من مساحة التخزين وأعد المحاولة.';
        render();
      }
    }
    function todayKey() { return localDate(); }
    const prayerIdsByTaskCategory = {
      الفجر: 'Fajr', الظهر: 'Dhuhr', العصر: 'Asr', المغرب: 'Maghrib', العشاء: 'Isha',
      'قيام الليل والوتر': 'Isha'
    };
    const prayerLabelsByTaskCategory = {
      'قيام الليل والوتر': 'بعد العشاء'
    };
    const taskPrayerCategories = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء', 'قيام الليل والوتر'];
    function readPrayerSchedule() {
      try {
        const raw = localStorage.getItem('quran_prayer_cache_v1');
        if (!raw) return { timings: null, fresh: false, error: false };
        const cached = JSON.parse(raw);
        if (!cached || cached.format !== 'quran-prayer-cache' || cached.version !== 1 ||
            !cached.items || typeof cached.items !== 'object' || Array.isArray(cached.items)) {
          throw new Error('بيانات مواقيت الصلاة المحفوظة غير معروفة');
        }
        const cityId = localStorage.getItem('quran_prayer_city_v1') || 'aswan';
        const city = cached.items[cityId];
        if (!city || !city.timings || typeof city.timings !== 'object') {
          return { timings: null, fresh: false, error: false };
        }
        const now = new Date();
        const expectedDay = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
        return {
          timings: city.timings,
          fresh: city.day === expectedDay,
          error: false
        };
      } catch (error) {
        console.error('تعذر قراءة مواقيت الصلاة لجدول المهام.', error);
        return { timings: null, fresh: false, error: true };
      }
    }
    function prayerMinutesForTask(task, schedule) {
      const prayerId = prayerIdsByTaskCategory[task.category];
      if (!prayerId || !schedule.fresh || !schedule.timings) return null;
      const match = String(schedule.timings[prayerId] || '').match(/(\d{1,2}):(\d{2})/);
      if (!match) return null;
      const hour = Number(match[1]), minute = Number(match[2]);
      return hour < 24 && minute < 60 ? hour * 60 + minute : null;
    }
    function currentPrayerCategory(schedule) {
      if (!schedule.fresh || !schedule.timings) return '';
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const prayers = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء']
        .map(category => ({
          category,
          minutes: prayerMinutesForTask({ category: category }, schedule)
        }))
        .filter(prayer => prayer.minutes != null)
        .sort((a, b) => a.minutes - b.minutes);
      if (!prayers.length) return '';
      let activeCategory = prayers[prayers.length - 1].category;
      prayers.forEach(prayer => {
        if (prayer.minutes <= currentMinutes) activeCategory = prayer.category;
      });
      return activeCategory;
    }
    let prayerRefreshTimer = 0;
    function schedulePrayerRefresh() {
      window.clearTimeout(prayerRefreshTimer);
      const schedule = readPrayerSchedule();
      let delay = 60000;
      if (schedule.fresh && schedule.timings) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const prayerMinutes = ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء']
          .map(category => prayerMinutesForTask({ category: category }, schedule))
          .filter(minutes => minutes != null)
          .sort((a, b) => a - b);
        const nextMinutes = prayerMinutes.find(minutes => minutes > currentMinutes);
        const minutesUntilNextPrayer = nextMinutes == null
          ? 1440 - currentMinutes + (prayerMinutes[0] == null ? 0 : prayerMinutes[0])
          : nextMinutes - currentMinutes;
        delay = Math.max(1000, minutesUntilNextPrayer * 60000 + 1000);
      }
      prayerRefreshTimer = window.setTimeout(() => {
        if (state.view === 'tasks') render();
        schedulePrayerRefresh();
      }, delay);
    }
    function taskTimeLabel(task, schedule) {
      const prayerId = prayerIdsByTaskCategory[task.category];
      if (!prayerId) return task.category;
      const displayName = prayerLabelsByTaskCategory[task.category] || task.category;
      const minutes = prayerMinutesForTask(task, schedule);
      if (minutes == null) return displayName + ' · حدّث المواقيت';
      const time = String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
      return displayName + ' · ' + time.replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit]);
    }
    function sortTasksByPrayerTime(tasks, schedule) {
      return tasks.map((task, index) => ({ task, index, minutes: prayerMinutesForTask(task, schedule) }))
        .sort((a, b) => (a.minutes == null ? 1440 : a.minutes) - (b.minutes == null ? 1440 : b.minutes) || a.index - b.index)
        .map(entry => entry.task);
    }
    function rollTasks() {
      const today = todayKey();
      const todayNum = new Date().getDay();
      let changed = false;
      state.tasks.forEach(task => {
        const scheduled = validDays(task.days);
        if (task.daily && task.day !== today) {
          if (task.day) task.hist[task.day] = !!task.done;
          task.done = false;
          task.day = today;
          changed = true;
        } else if (!task.daily && scheduled.length && task.day !== today) {
          if (task.day) task.hist[task.day] = !!task.done;
          if (scheduled.includes(todayNum)) task.done = false;
          task.day = today;
          changed = true;
        }
        const keys = Object.keys(task.hist || {}).sort();
        while (keys.length > 30) delete task.hist[keys.shift()];
      });
      if (changed) save();
    }
    function seedDefaultTasks() {
      if (state.defaultTasksVersion >= 4) return;
      if (state.defaultTasksVersion < 1) {
        const taskIds = new Set(state.tasks.map(task => task.id));
        const today = todayKey();
        defaultTasks.forEach(task => {
          if (taskIds.has(task.id)) return;
          state.tasks.push(Object.assign({}, task, {
            done: false, createdAt: new Date().toISOString(), day: today, days: [], hist: {}
          }));
        });
      } else {
        state.tasks = state.tasks.filter(task =>
          !(task.defaultTask && task.category === 'أذكار متنوعة')
          && !String(task.id).startsWith('daily-default-azkar-')
        );
      }
      state.tasks = state.tasks.filter(task =>
        task.title !== 'مهمة اختبار غير مصنفة'
        && task.title !== 'قراءة ستة أرباع'
      );
      const dailyWird = defaultTasks.find(task => task.id === 'daily-default-quran-1');
      const previousDailyWird = state.tasks.find(task =>
        task.id === 'daily-default-qiyam-1' || (task.defaultTask && task.title === 'الورد اليومي — جزء كامل')
      );
      if (previousDailyWird && dailyWird) {
        Object.assign(previousDailyWird, {
          id: dailyWird.id,
          title: dailyWird.title,
          points: dailyWird.points,
          category: dailyWird.category,
          icon: dailyWird.icon,
          defaultTask: true,
          daily: true
        });
      }
      const defaultsById = new Map(defaultTasks.map(task => [task.id, task]));
      state.tasks = state.tasks.map(task => {
        const updated = task.defaultTask && defaultsById.get(task.id);
        return updated ? Object.assign({}, task, {
          title: updated.title,
          category: updated.category,
          icon: updated.icon
        }) : task;
      });
      if (dailyWird) {
        let keptDailyWird = false;
        state.tasks = state.tasks.filter(task => {
          if (task.id !== dailyWird.id) return true;
          if (keptDailyWird) return false;
          keptDailyWird = true;
          return true;
        });
      }
      state.defaultTasksVersion = 4;
      save();
    }
    function taskVisible(task) {
      const scheduled = validDays(task.days);
      return !scheduled.length || scheduled.includes(new Date().getDay());
    }
    function streak(task) {
      const isDone = key => key === todayKey() ? !!task.done : !!(task.hist && task.hist[key]);
      const date = new Date();
      if (!isDone(todayKey())) date.setDate(date.getDate() - 1);
      let count = 0;
      for (let i = 0; i < 365; i++) {
        if (!isDone(localDate(date))) break;
        count++;
        date.setDate(date.getDate() - 1);
      }
      return count;
    }
    function taskDayLabel(task) {
      const selected = validDays(task.days);
      if (!selected.length) return '';
      return selected.length === 7 ? 'كل يوم' : days.filter(day => selected.includes(day.value)).map(day => day.label).join(' • ');
    }
    function syncAzkarTask(event) {
      const detail = event && event.detail;
      if (!detail || typeof detail.categoryId !== 'string' || typeof detail.completed !== 'boolean') return;
      const source = detail.categoryId;
      const titles = {
        morning: /أذكار\s*الصباح/,
        evening: /أذكار\s*المساء/,
        wake: /أذكار\s*الاستيقاظ/,
        sleep: /أذكار\s*(?:قبل\s*)?النوم/,
        prayer: /أذكار\s*بعد\s*الصلاة/,
        daily: /أذكار\s*(?:يومية|متنوعة)/
      };
      let task;
      if (detail.completed && source === 'prayer') {
        if (state.tasks.some(item => item.done && item.day === todayKey() &&
            item.autoAzkarSource === source && taskVisible(item))) return;
        task = state.tasks.find(item => !item.done && taskVisible(item) && titles.prayer.test(item.title));
      } else if (detail.completed) {
        if (state.tasks.some(item => item.done && item.day === todayKey() &&
            item.autoAzkarSource === source && taskVisible(item))) return;
        const match = titles[source];
        if (!match) return;
        task = state.tasks.find(item => !item.done && taskVisible(item) && match.test(item.title));
      } else {
        task = state.tasks.filter(item =>
          item.done && item.autoAzkarSource === source && taskVisible(item)
        ).sort((a, b) => (b.autoAzkarAt || 0) - (a.autoAzkarAt || 0))[0];
      }
      if (!task) return;
      if (detail.completed && !task.done) {
        task.done = true;
        task.day = todayKey();
        state.profile.totalPoints += Math.max(0, Number(task.points) || 0);
        task.autoAzkarSource = source;
        task.autoAzkarAt = Date.now();
      } else if (!detail.completed && task.autoAzkarSource === source) {
        task.done = false;
        state.profile.totalPoints = Math.max(0, state.profile.totalPoints - (Number(task.points) || 0));
        delete task.autoAzkarSource;
        delete task.autoAzkarAt;
      } else {
        return;
      }
      if (save()) render();
    }
    function compressProfileAvatar(file) {
      return new Promise((resolve, reject) => {
        let objectUrl;
        try {
          objectUrl = URL.createObjectURL(file);
        } catch (error) {
          reject(error);
          return;
        }
        const image = new Image();
        const releaseUrl = () => URL.revokeObjectURL(objectUrl);
        image.onload = () => {
          try {
            const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const context = canvas.getContext('2d');
            if (!context) throw new Error('تعذر تجهيز الصورة في هذا المتصفح.');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(blob => {
              releaseUrl();
              if (!blob) {
                reject(new Error('تعذر ضغط الصورة المختارة.'));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الصورة المختارة.'));
              reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.78);
          } catch (error) {
            releaseUrl();
            reject(error);
          }
        };
        image.onerror = () => {
          releaseUrl();
          reject(new Error('تعذر فتح الصورة المختارة.'));
        };
        image.src = objectUrl;
      });
    }
    async function saveProfile(form) {
      const name = form.elements.profileName.value.trim();
      const ageValue = form.elements.profileAge.value.trim();
      const phone = form.elements.profilePhone.value.trim();
      const age = ageValue ? Number(ageValue) : '';
      const avatarFile = form.elements.profileAvatar.files[0];
      if (name.length > 80) {
        storageError = 'يجب ألا يتجاوز الاسم ٨٠ حرفًا.';
        render();
        return;
      }
      if (ageValue && (!Number.isInteger(age) || age < 1 || age > 120)) {
        storageError = 'أدخل عمرًا صحيحًا بين سنة و١٢٠ سنة.';
        render();
        return;
      }
      if (phone && !/^\+?[0-9٠-٩\s()-]{7,24}$/.test(phone)) {
        storageError = 'تحقق من رقم الهاتف؛ اكتب ٧ أرقام على الأقل.';
        render();
        return;
      }
      let avatar = state.profile.avatar;
      if (avatarFile) {
        if (!avatarFile.type || avatarFile.type.indexOf('image/') !== 0 || avatarFile.size > 12 * 1024 * 1024) {
          storageError = 'اختر صورة صالحة لا يتجاوز حجمها ١٢ ميجابايت.';
          render();
          return;
        }
        try {
          avatar = await compressProfileAvatar(avatarFile);
        } catch (error) {
          console.error('تعذر تجهيز صورة الملف الشخصي.', error);
          storageError = error && error.message ? error.message : 'تعذر تجهيز الصورة المختارة.';
          render();
          return;
        }
      }
      state.profile.name = name;
      state.profile.age = age;
      state.profile.phone = phone;
      state.profile.avatar = avatar;
      storageError = '';
      if (save()) {
        state.profileFormOpen = false;
        render();
      }
    }
    function render() {
      const prayerSchedule = readPrayerSchedule();
      const activePrayer = currentPrayerCategory(prayerSchedule);
      const scheduledTasks = state.tasks.filter(taskVisible);
      const pendingTasks = scheduledTasks.filter(task => !task.done);
      const completedTasks = scheduledTasks.filter(task => task.done);
      const earnedPoints = completedTasks.reduce((total, task) => total + (Number(task.points) || 0), 0);
      const availablePoints = scheduledTasks.reduce((total, task) => total + (Number(task.points) || 0), 0);
      const scheduledHidden = state.tasks.length - scheduledTasks.length;
      const taskDays = validDays(state.taskDraft.days);
      const currentIcon = icons.find(icon => icon[0] === state.taskDraft.icon) || icons[icons.length - 1];
      const taskDraftCategory = taskPrayerCategories.includes(state.taskDraft.category) ? state.taskDraft.category : (activePrayer || 'الفجر');
      const form = `
        <form class="form-card" data-form="task">
          <label class="field-label" for="taskTitle">اسم المهمة</label>
          <div class="input-row"><input id="taskTitle" name="title" maxlength="120" placeholder="مثال: مراجعة ورد القرآن" value="${esc(state.taskDraft.title)}"><button class="primary icon-only" type="submit" aria-label="إضافة المهمة">＋</button></div>
          <label class="field-label" for="taskPrayerCategory">وقت إنجاز المهمة</label>
          <select id="taskPrayerCategory" name="category">${taskPrayerCategories.map(category => `<option value="${esc(category)}" ${taskDraftCategory === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select>
          <label class="field-label" for="taskPoints">النقاط عند الإنجاز</label>
          <input id="taskPoints" name="points" type="number" min="0" max="100" step="1" inputmode="numeric" value="${Number.isInteger(Number(state.taskDraft.points)) ? Number(state.taskDraft.points) : 1}">
          <div class="option-row"><button type="button" class="chip ${state.taskDraft.daily ? 'selected' : ''}" data-action="daily" aria-pressed="${state.taskDraft.daily}"><svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 0 0-12-5L4 10M4 17v-5h5"/><path d="M5 12a7 7 0 0 0 12 5l3-3"/></svg><span>مهمة يومية</span></button><button type="button" class="chip ${taskDays.length ? 'selected' : ''}" data-action="task-days" aria-pressed="${taskDays.length > 0}"><svg class="chip-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01"/></svg><span>${taskDays.length ? 'تحديد الأيام' : 'كل الأيام'}</span></button></div>
          ${state.taskDraft.daysOpen ? `<div class="days-grid">${days.map(day => `<button type="button" class="day-chip ${taskDays.includes(day.value) ? 'selected' : ''}" data-action="task-day" data-day="${day.value}">${day.label}</button>`).join('')}</div>` : ''}
          ${taskDays.length ? `<div class="hint">ستظهر في: ${esc(taskDays.length === 7 ? 'كل يوم' : days.filter(day => taskDays.includes(day.value)).map(day => day.label).join('، '))}</div>` : ''}
          <div class="icon-grid" role="group" aria-label="أيقونة المهمة">${icons.map(icon => `<button type="button" class="icon-choice ${currentIcon[0] === icon[0] ? 'selected' : ''}" title="${icon[2]}" aria-label="${icon[2]}" aria-pressed="${currentIcon[0] === icon[0]}" data-action="task-icon" data-icon="${icon[0]}">${taskIconSvg(icon[0], 'task-icon-svg')}</button>`).join('')}</div>
        </form>`;
      function renderTaskCard(task) {
        const icon = icons.find(item => item[0] === task.icon) || icons[icons.length - 1];
        const scheduled = taskDayLabel(task);
        return `<article class="item-card ${task.done ? 'is-done' : ''}">
          <button class="check-button" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${task.done ? 'إلغاء إكمال' : 'إكمال'} ${esc(task.title)}">${task.done ? '✓' : ''}</button>
          <span class="item-icon" aria-hidden="true">${taskIconSvg(icon[0], 'task-icon-svg')}</span><div class="item-copy"><strong>${esc(task.title)}</strong>
          <span class="item-meta">
            ${task.category ? `<span class="task-category">🕒 ${esc(taskTimeLabel(task, prayerSchedule))}</span>` : ''}
            ${Number(task.points) > 0 ? `<span class="task-points">⭐ ${Number(task.points)} ${Number(task.points) === 1 ? 'نقطة' : 'نقاط'}</span>` : ''}
            ${task.daily && !task.defaultTask ? `<small class="task-streak">🔥 ${streak(task)} ${streak(task) === 1 ? 'يوم' : 'أيام'} التزام</small>` : ''}
            ${scheduled ? `<small>📅 ${esc(scheduled)}</small>` : ''}
          </span></div>
          <button class="delete-button" type="button" data-action="delete-task" data-id="${esc(task.id)}" aria-label="حذف ${esc(task.title)}">×</button>
        </article>`;
      }
      const prayerTaskGroups = [
        { category: 'الفجر', categories: ['الفجر'] },
        { category: 'الظهر', categories: ['الظهر'] },
        { category: 'العصر', categories: ['العصر'] },
        { category: 'المغرب', categories: ['المغرب'] },
        { category: 'العشاء', categories: ['العشاء', 'قيام الليل والوتر'] }
      ];
      const taskSections = prayerTaskGroups
        .filter(group => !activePrayer || group.category === activePrayer)
        .map(group => {
        const groupTasks = scheduledTasks.filter(task => group.categories.includes(task.category));
        const cards = sortTasksByPrayerTime(groupTasks.filter(task => !task.done), prayerSchedule)
          .concat(sortTasksByPrayerTime(groupTasks.filter(task => task.done), prayerSchedule))
          .map(renderTaskCard).join('');
        return `<section class="prayer-task-group" aria-label="مهام صلاة ${esc(group.category)}">
          <div class="prayer-task-group-head"><h4>صلاة ${esc(group.category)}</h4><span>${groupTasks.length} مهمة</span></div>
          ${cards || '<div class="prayer-task-empty">لا توجد مهام لهذه الصلاة اليوم.</div>'}
        </section>`;
      }).join('');
      const uncategorizedTasks = scheduledTasks.filter(task => !taskPrayerCategories.includes(task.category));
      const uncategorizedCards = sortTasksByPrayerTime(uncategorizedTasks.filter(task => !task.done), prayerSchedule)
        .concat(sortTasksByPrayerTime(uncategorizedTasks.filter(task => task.done), prayerSchedule))
        .map(renderTaskCard).join('');
      const uncategorizedSection = uncategorizedTasks.length
        ? `<section class="prayer-task-group" aria-label="مهام غير مرتبطة بصلاة">
            <div class="prayer-task-group-head"><h4>مهام أخرى</h4><span>${uncategorizedTasks.length} مهمة</span></div>
            ${uncategorizedCards}
          </section>`
        : '';
      const leaderboardEntries = defaultLeaderboard.concat(
        state.profile.name || state.profile.totalPoints
          ? [{ name: state.profile.name || 'ملفك الشخصي', points: state.profile.totalPoints, avatar: state.profile.avatar || './logo.png', isYou: true }]
          : []
      ).sort((a, b) => b.points - a.points);
      const profileView = `
        <section class="profile-page" aria-label="الملف الشخصي والنقاط">
          <div class="profile-score">
            <span class="profile-score-icon" aria-hidden="true">⭐</span>
            <div class="profile-score-copy"><strong>رصيد نقاطك</strong><small>استمر في إنجاز مهامك اليومية</small></div>
            <div class="profile-score-total"><strong>${state.profile.totalPoints}</strong><span>نقطة</span></div>
          </div>
          ${state.profileFormOpen ? `<form class="profile-form" data-form="profile">
            <div class="profile-form-heading"><span aria-hidden="true">✦</span><div><strong>بياناتك الشخصية</strong><small>أضف معلوماتك لتخصيص تجربتك</small></div></div>
            <div class="profile-avatar-row">
              <img class="profile-avatar" src="${state.profile.avatar || './logo.png'}" alt="معاينة الصورة الشخصية">
              <div class="profile-avatar-content"><strong>الصورة الشخصية</strong><small>اختر صورة واضحة لملفك</small>
                <div class="profile-avatar-actions"><label class="profile-photo-button">＋ تغيير الصورة<input type="file" name="profileAvatar" accept="image/*"></label>
                  ${state.profile.avatar ? '<button type="button" class="secondary profile-clear-photo" data-action="clear-profile-avatar">إزالة</button>' : ''}
                </div>
              </div>
            </div>
            <label class="profile-field">الاسم<input type="text" name="profileName" maxlength="80" autocomplete="name" value="${esc(state.profile.name)}" placeholder="الاسم الذي تفضّله"></label>
            <div class="profile-fields-row">
              <label class="profile-field">العمر <span class="profile-field-optional">اختياري</span><input type="number" name="profileAge" min="1" max="120" inputmode="numeric" value="${esc(state.profile.age)}" placeholder="مثال: ٢٥"></label>
              <label class="profile-field">رقم الهاتف <span class="profile-field-optional">اختياري</span><input type="tel" name="profilePhone" maxlength="24" autocomplete="tel" value="${esc(state.profile.phone)}" placeholder="أدخل رقم هاتفك"></label>
            </div>
            <button type="submit" class="primary profile-save"><span aria-hidden="true">✓</span> حفظ الملف على هذا الجهاز</button>
            <p class="profile-privacy"><span aria-hidden="true">🔒</span> بياناتك ونقاطك محفوظة على هذا الجهاز فقط، ولا تُرسل لأي جهة.</p>
          </form>` : `
            <section class="profile-summary" aria-label="بيانات الملف المحفوظة">
              <img class="profile-avatar" src="${state.profile.avatar || './logo.png'}" alt="الصورة الشخصية">
              <div class="profile-summary-copy">
                <small class="profile-summary-label">ملفك الشخصي</small>
                <strong>${esc(state.profile.name || 'أضف اسمك إلى ملفك الشخصي')}</strong>
                ${state.profile.age ? `<small>العمر · ${state.profile.age} سنة</small>` : '<small>أكمل بياناتك لتخصيص ملفك</small>'}
              </div>
              <div class="profile-summary-actions">
                <button type="button" class="primary" data-action="edit-profile">تعديل الملف</button>
                ${state.profile.avatar ? '<button type="button" class="secondary profile-clear-photo" data-action="clear-profile-avatar">إزالة الصورة</button>' : ''}
              </div>
            </section>
          `}
          <section class="leaderboard-card" aria-label="لوحة المتصدرين">
            <div class="leaderboard-heading"><span aria-hidden="true">🏆</span><div><strong>لوحة المتصدرين</strong><small>نماذج افتراضية تحفيزية</small></div></div>
            ${leaderboardEntries.map((entry, index) => `<div class="leaderboard-entry">
              <span class="leaderboard-rank">${String(index + 1).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit])}</span>
              <img src="${entry.avatar || './logo.png'}" alt="">
              <strong>${esc(entry.name)}${entry.isYou ? ' (أنت)' : ''}</strong>
              <b>${entry.points} نقطة</b>
            </div>`).join('')}
            <p class="profile-privacy">الأسماء والنقاط الافتراضية للعرض فقط، ويُضاف رصيدك المحفوظ على هذا الجهاز إلى القائمة.</p>
          </section>
          <section class="profile-backup" aria-label="حفظ واستعادة بيانات التطبيق">
            <div class="profile-backup-heading"><span aria-hidden="true">📦</span><div><strong>بياناتك ونسختك الاحتياطية</strong><small>احفظ تقدمك وانقله إلى جهاز آخر</small></div></div>
            <p>تشمل النسخة ملفك الشخصي والمهام والإعدادات والتقدم المحفوظ. أما ملفات الموقع فتُخزّن تلقائيًا داخل التطبيق لتعمل دون إنترنت.</p>
            <div class="profile-backup-actions">
              <button type="button" class="primary" data-action="export-app-data">حفظ نسخة على الجهاز</button>
              <label class="profile-import-button">استعادة نسخة<input type="file" accept=".json,application/json" data-app-backup-file></label>
            </div>
            <small class="profile-backup-note">سيُنزّل ملف باسم Qurany إلى مجلد التنزيلات. الاستعادة تستبدل بيانات التطبيق الحالية.</small>
          </section>
          ${storageError ? `<div class="error" role="alert">${esc(storageError)}</div>` : ''}
        </section>`;
      root.innerHTML = `
        <style>
          :host{display:block;color:var(--ink);font:14px/1.55 var(--font-ui,system-ui,sans-serif);direction:rtl}
          *{box-sizing:border-box}button,input,textarea,select{font:inherit}
          .app{padding:12px;display:grid;gap:12px}
          .hero{position:relative;overflow:hidden;padding:15px;border:1px solid color-mix(in srgb,var(--green) 25%,var(--line));border-radius:16px;background:linear-gradient(145deg,color-mix(in srgb,var(--green) 12%,var(--panel)),var(--card));}
          .hero:after{content:"";position:absolute;inset:auto -25px -48px auto;width:110px;height:110px;border:1px solid color-mix(in srgb,var(--green) 22%,transparent);border-radius:50%;box-shadow:0 0 0 14px color-mix(in srgb,var(--green) 5%,transparent),0 0 0 29px color-mix(in srgb,var(--green) 4%,transparent)}
          .hero-title{display:flex;align-items:center;gap:10px}.hero-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:color-mix(in srgb,var(--green) 13%,var(--panel));font-size:22px}
          h3,h4,p{margin:0}.hero h3{font-size:16px}.hero p{margin-top:3px;color:var(--muted);font-size:12px}
          .switch{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));padding:4px;gap:4px;border:1px solid var(--line);border-radius:12px;background:var(--panel-top)}
          button{cursor:pointer} .switch button,.chip,.day-chip{border:1px solid transparent;border-radius:9px;padding:8px 6px;background:transparent;color:var(--muted);font-size:12px;font-weight:800}
          .switch button{display:flex;align-items:center;justify-content:center;gap:7px;min-height:40px}
          .switch-icon{width:17px;height:17px;flex:none}
          .switch button[aria-pressed=true],.chip.selected,.day-chip.selected{background:color-mix(in srgb,var(--green) 12%,var(--panel));border-color:color-mix(in srgb,var(--green) 35%,var(--line));color:var(--green)}
          .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.stat{padding:9px 5px;text-align:center;border:1px solid var(--line);border-radius:11px;background:var(--card)}
          .stat b{display:block;color:var(--green);font-size:17px;line-height:1.2}.stat span{color:var(--muted);font-size:10px}
          .section-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.section-head h4{font-size:14px}
          .primary{border:0;border-radius:10px;background:var(--green);color:var(--on-green);font-weight:800;padding:9px 12px}
          .add-toggle{border:1px solid color-mix(in srgb,var(--green) 35%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--green) 9%,var(--panel));color:var(--green);font-size:12px;font-weight:800;padding:7px 10px}
          .form-card{display:grid;gap:9px;padding:12px;border:1px solid var(--line);border-radius:13px;background:var(--panel-top)}
          input,textarea,select{min-width:0;width:100%;padding:9px 10px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);outline:none}
          input:focus,textarea:focus,select:focus{border-color:var(--green);box-shadow:0 0 0 2px color-mix(in srgb,var(--green) 14%,transparent)}
          textarea{resize:vertical}.field-label,.date-row label span,.time-row span{font-size:11px;font-weight:800;color:var(--muted)}
          .input-row{display:flex;gap:7px}.input-row input{flex:1}.icon-only{width:42px;flex:none;font-size:22px;padding:2px}
          .option-row{display:flex;gap:6px;flex-wrap:wrap}.chip{display:inline-flex;align-items:center;justify-content:center;gap:6px;border-color:var(--line);background:var(--card);transition:color .16s ease,background .16s ease,border-color .16s ease,box-shadow .16s ease}
          .chip-icon{width:15px;height:15px;flex:none}
          .chip:focus-visible{outline:2px solid var(--green);outline-offset:2px}
          .chip.selected{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 12%,transparent)}
          .days-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.day-chip{border-color:var(--line);background:var(--card);padding:7px 3px}
          .hint{color:var(--muted);font-size:11px}.icon-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
          .icon-choice{display:grid;place-items:center;aspect-ratio:1;min-width:0;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--card);color:var(--muted);transition:color .16s ease,background .16s ease,border-color .16s ease,transform .16s ease,box-shadow .16s ease}
          .icon-choice:hover{border-color:color-mix(in srgb,var(--green) 45%,var(--line));color:var(--green);transform:translateY(-1px)}
          .icon-choice:focus-visible{outline:2px solid var(--green);outline-offset:2px}
          .icon-choice.selected{border-color:var(--green);background:color-mix(in srgb,var(--green) 11%,var(--panel));color:var(--green);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--green) 14%,transparent)}
          .task-icon-svg{display:block;width:20px;height:20px;flex:none}
          .item-list{display:grid;gap:5px}.item-card{display:flex;align-items:center;gap:6px;min-height:54px;padding:5px 7px;border:1px solid var(--line);border-radius:11px;background:var(--card)}
          .prayer-task-groups{display:grid;gap:14px}.prayer-task-group{display:grid;gap:6px;min-width:0}
          .prayer-task-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 4px;border-bottom:1px solid var(--line)}
          .prayer-task-group-head h4{margin:0;color:var(--green);font-size:13px;font-weight:900}
          .prayer-task-group-head span{color:var(--muted);font-size:10px;font-weight:700}
          .prayer-task-empty{padding:7px 4px;color:var(--muted);font-size:10px}
          .item-card.is-done{opacity:.72}.item-icon{display:grid;place-items:center;width:34px;height:34px;flex:none;border:1px solid color-mix(in srgb,var(--green) 14%,var(--line));border-radius:11px;background:color-mix(in srgb,var(--green) 8%,var(--panel));color:var(--green)}
          .item-icon .task-icon-svg{width:19px;height:19px}
          .item-copy{min-width:0;flex:1;display:grid;gap:3px}.item-copy strong{overflow-wrap:anywhere;font-size:12px;line-height:1.35}.item-copy small{color:var(--muted);font-size:10px;overflow-wrap:anywhere}
          .item-meta{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px;min-width:0}
          .task-category,.task-points{display:inline-flex;align-items:center;gap:3px;padding:1px 5px;border-radius:6px;font-size:10px;font-weight:800;line-height:1.4;white-space:nowrap}
          .task-category{color:var(--green);background:color-mix(in srgb,var(--green) 9%,var(--panel))}
          .task-points{color:var(--sub);background:color-mix(in srgb,var(--sub) 12%,var(--panel))}
          .prayer-schedule-note{margin:-3px 0 0;padding:8px 9px;border:1px solid color-mix(in srgb,var(--green) 18%,var(--line));border-radius:10px;background:color-mix(in srgb,var(--green) 6%,var(--panel));color:var(--muted);font-size:10px;line-height:1.55}
          .task-streak{color:var(--muted);font-size:10px}
          .is-done .item-copy strong{text-decoration:line-through}.check-button{width:23px;height:23px;flex:none;border:1.5px solid var(--green);border-radius:50%;background:transparent;color:var(--green);font-weight:900;padding:0}
          .is-done .check-button{background:var(--green);color:var(--on-green)}.delete-button{width:23px;height:23px;flex:none;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:18px}
          .delete-button:hover{background:color-mix(in srgb,var(--red) 12%,var(--panel));color:var(--red)}
          .empty{padding:18px 8px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:12px}
          .error{padding:9px;border-radius:9px;background:color-mix(in srgb,var(--red) 12%,var(--panel));color:var(--red);font-size:11px}
          .profile-page{display:grid;gap:12px;padding:2px 0 8px}
          .profile-score,.profile-form,.leaderboard-card{border:1px solid var(--line);border-radius:17px;background:var(--card);box-shadow:0 6px 20px rgba(40,34,26,.045)}
          .profile-score{display:flex;align-items:center;gap:11px;padding:14px;background:linear-gradient(125deg,color-mix(in srgb,var(--green) 8%,var(--card)),var(--card) 72%)}
          .profile-score-icon{display:grid;place-items:center;width:40px;height:40px;flex:none;border-radius:13px;background:color-mix(in srgb,var(--sub) 14%,var(--panel));font-size:19px}
          .profile-score-copy{display:grid;gap:3px;min-width:0;flex:1}.profile-score-copy strong{font-size:13px}.profile-score-copy small{color:var(--muted);font-size:10px}
          .profile-score-total{display:flex;align-items:baseline;gap:4px;padding:6px 10px;border:1px solid color-mix(in srgb,var(--green) 17%,var(--line));border-radius:11px;background:var(--panel)}
          .profile-score-total strong{color:var(--green);font-size:21px;line-height:1}.profile-score-total span{color:var(--muted);font-size:10px;font-weight:800}
          .profile-form{display:grid;gap:13px;padding:16px;border-color:color-mix(in srgb,var(--green) 20%,var(--line));background:linear-gradient(155deg,color-mix(in srgb,var(--green) 3%,var(--card)),var(--card) 48%)}
          .profile-form-heading{display:flex;align-items:center;gap:9px;padding-bottom:11px;border-bottom:1px solid var(--line)}
          .profile-form-heading>span{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:color-mix(in srgb,var(--green) 11%,var(--panel));color:var(--green);font-size:18px}
          .profile-form-heading strong,.profile-form-heading small{display:block}.profile-form-heading strong{font-size:13px}.profile-form-heading small{margin-top:2px;color:var(--muted);font-size:10px}
          .profile-avatar-row{display:flex;align-items:center;gap:13px;padding:11px;border:1px solid var(--line);border-radius:13px;background:color-mix(in srgb,var(--panel) 70%,var(--card))}
          .profile-avatar-content{display:grid;gap:4px;min-width:0;flex:1}.profile-avatar-content>strong{font-size:11px}.profile-avatar-content>small{color:var(--muted);font-size:10px}
          .profile-avatar-actions{display:flex;align-items:center;gap:7px;margin-top:3px}
          .profile-summary{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid color-mix(in srgb,var(--green) 19%,var(--line));border-radius:16px;background:linear-gradient(120deg,color-mix(in srgb,var(--green) 6%,var(--card)),var(--card) 68%);box-shadow:0 5px 16px rgba(40,34,26,.04)}
          .profile-summary-copy{display:grid;gap:4px;min-width:0;flex:1}.profile-summary-copy strong{overflow-wrap:anywhere;font-size:13px}
          .profile-summary-copy small{color:var(--muted);font-size:10px}.profile-summary-copy .profile-summary-label{color:var(--green);font-size:9px;font-weight:900}
          .profile-summary-actions{display:grid;gap:6px}.profile-summary-actions button{padding:8px 10px;font:inherit;font-size:10px;font-weight:800;white-space:nowrap}
          .profile-avatar{width:70px;height:70px;flex:none;border:3px solid var(--card);border-radius:50%;object-fit:cover;background:var(--panel);box-shadow:0 0 0 2px color-mix(in srgb,var(--green) 33%,var(--line))}
          .profile-photo-button,.profile-clear-photo{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 11px;border:1px solid color-mix(in srgb,var(--green) 28%,var(--line));border-radius:9px;background:color-mix(in srgb,var(--green) 7%,var(--panel));color:var(--green);font:inherit;font-size:10px;font-weight:900;cursor:pointer}
          .profile-photo-button input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
          .profile-photo-button:focus-within,.profile-clear-photo:focus-visible{outline:2px solid var(--green);outline-offset:2px}
          .profile-clear-photo{border-color:var(--line);background:var(--panel);color:var(--muted)}
          .profile-fields-row{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1.4fr);gap:10px}
          .profile-field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px;color:var(--ink);font-size:11px;font-weight:900}
          .profile-field input{grid-column:1/-1;min-height:43px;padding:10px 12px;border-radius:11px;background:var(--panel);font:inherit;font-size:12px;font-weight:700}
          .profile-field input::placeholder{color:var(--muted);font-weight:500;opacity:.8}
          .profile-field-optional{color:var(--muted);font-size:9px;font-weight:600}
          .profile-save{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:47px;border-radius:12px;font:inherit;font-size:13px;font-weight:900;box-shadow:0 5px 13px color-mix(in srgb,var(--green) 18%,transparent);transition:filter .15s,transform .15s}
          .profile-save:hover{filter:brightness(1.05);transform:translateY(-1px)}.profile-save>span{font-size:16px}
          .profile-privacy{display:flex;align-items:flex-start;gap:6px;margin:0;color:var(--muted);font-size:10px;line-height:1.6}.profile-privacy>span{flex:none}
          .leaderboard-card{display:grid;gap:11px;padding:14px}
          .leaderboard-heading{display:flex;align-items:center;gap:10px}.leaderboard-heading>span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--sub) 12%,var(--panel));font-size:20px}
          .leaderboard-heading strong,.leaderboard-heading small{display:block}.leaderboard-heading strong{font-size:13px}.leaderboard-heading small{margin-top:2px;color:var(--muted);font-size:10px}
          .leaderboard-entry{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid color-mix(in srgb,var(--sub) 23%,var(--line));border-radius:12px;background:linear-gradient(100deg,color-mix(in srgb,var(--sub) 7%,var(--panel)),var(--panel))}
          .leaderboard-rank{display:grid;place-items:center;width:25px;height:25px;flex:none;border-radius:8px;background:color-mix(in srgb,var(--sub) 14%,var(--card));color:var(--sub);font-size:12px;font-weight:900}
          .leaderboard-entry img{width:36px;height:36px;border:2px solid var(--card);border-radius:50%;object-fit:cover;box-shadow:0 0 0 1px var(--line)}
          .leaderboard-entry strong{min-width:0;flex:1;overflow-wrap:anywhere;font-size:11px}.leaderboard-entry b{color:var(--green);font-size:10px;white-space:nowrap}
          .profile-backup{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--card)}
          .profile-backup-heading{display:flex;align-items:center;gap:10px}.profile-backup-heading>span{display:grid;place-items:center;width:37px;height:37px;border-radius:12px;background:color-mix(in srgb,var(--green) 10%,var(--panel));font-size:19px}
          .profile-backup-heading strong,.profile-backup-heading small{display:block}.profile-backup-heading strong{font-size:12px}.profile-backup-heading small{margin-top:2px;color:var(--muted);font-size:10px}
          .profile-backup>p{margin:0;color:var(--muted);font-size:10px;line-height:1.65}
          .profile-backup-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.profile-backup-actions button,.profile-import-button{display:flex;align-items:center;justify-content:center;min-height:40px;padding:8px;border-radius:10px;font:inherit;font-size:10px;font-weight:900;cursor:pointer}
          .profile-import-button{border:1px solid color-mix(in srgb,var(--green) 28%,var(--line));background:color-mix(in srgb,var(--green) 7%,var(--panel));color:var(--green)}
          .profile-import-button input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
          .profile-import-button:focus-within{outline:2px solid var(--green);outline-offset:2px}
          .profile-backup-note{color:var(--muted);font-size:9px;line-height:1.55}
          @media(max-width:360px){.profile-fields-row{grid-template-columns:minmax(0,.55fr) minmax(0,1.45fr);gap:7px}.profile-form{padding:12px}.profile-avatar{width:60px;height:60px}.profile-summary{gap:9px;padding:11px}.profile-summary-actions button{padding:7px 8px}}
          @media(max-width:360px){.app{padding:9px}.stats{gap:4px}.icon-grid{grid-template-columns:repeat(6,minmax(0,1fr))}}
        </style>
        <main class="app">
          <header class="hero"><div class="hero-title"><span class="hero-icon">🌿</span><div><h3>رتّب يومك واطمئن</h3><p>خطوات صغيرة، وأوقات مباركة</p></div></div></header>
          <div class="switch" role="tablist" aria-label="المهام والملف الشخصي">
            <button type="button" role="tab" data-action="view" data-view="tasks" aria-pressed="${state.view === 'tasks'}"><svg class="switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4.5h6M8.5 12l2.2 2.2 4.8-4.8M8.5 17h7"/></svg><span>المهام</span></button>
            <button type="button" role="tab" data-action="view" data-view="profile" aria-pressed="${state.view === 'profile'}"><svg class="switch-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg><span>الملف الشخصي</span></button>
          </div>
          ${state.view === 'profile' ? profileView : `
            <div class="stats"><div class="stat"><b>${pendingTasks.length}</b><span>متبقية اليوم</span></div><div class="stat"><b>${completedTasks.length}</b><span>مكتملة اليوم</span></div><div class="stat"><b>${earnedPoints} / ${availablePoints}</b><span>النقاط المحققة</span></div></div>
          <p class="prayer-schedule-note" role="status">${prayerSchedule.fresh && activePrayer
            ? `تُعرض الآن مهام صلاة ${esc(activePrayer)} حسب مواقيت اليوم.`
            : prayerSchedule.error
              ? 'تعذرت قراءة مواقيت الصلاة؛ تظهر كل المهام مجمّعة حسب الصلاة حتى تحديث الجدول.'
              : prayerSchedule.fresh
                ? 'لم تتوفر مواقيت صحيحة لتحديد الصلاة الحالية؛ تظهر كل المهام مجمّعة حسب الصلاة.'
                : 'تظهر كل المهام مجمّعة حسب الصلاة حتى تحديث مواقيت اليوم من قسم الرئيسية.'}</p>
          <div class="section-head"><h4>مهام اليوم · ${scheduledTasks.length} مهمة</h4><button type="button" class="add-toggle" data-action="toggle-form">＋ مهمة جديدة</button></div>
          ${state.formOpen ? form : ''}
            ${scheduledTasks.length
              ? `<div class="prayer-task-groups">${taskSections}${uncategorizedSection}</div>`
              : `<div class="empty">${scheduledHidden
                ? `لا توجد مهام مجدولة لهذا اليوم. لديك ${scheduledHidden} مهام في أيام أخرى.`
                : 'لا توجد مهام مجدولة لليوم. أضف مهمة وحدد الصلاة المناسبة.'}</div>`}
          ${storageError ? `<div class="error" role="alert">${esc(storageError)}</div>` : ''}
          `}
        </main>`;
    }
    function captureForm() {
      const task = root.querySelector('[data-form="task"]');
      if (task) {
        state.taskDraft.title = task.elements.title.value;
        state.taskDraft.category = task.elements.category.value;
        state.taskDraft.points = Number(task.elements.points.value);
      }
    }
    function addTask() {
      const draft = state.taskDraft;
      const title = draft.title.trim();
      if (!title) {
        const input = root.getElementById('taskTitle');
        if (input) input.focus();
        return;
      }
      const points = Number(draft.points);
      if (!Number.isInteger(points) || points < 0 || points > 100 ||
          !taskPrayerCategories.includes(draft.category)) {
        storageError = 'تحقق من وقت المهمة والنقاط؛ يجب أن تكون النقاط بين صفر و١٠٠.';
        render();
        return;
      }
      const scheduled = validDays(draft.days);
      state.tasks.unshift({
        id: uid(), title: title.slice(0, 120), done: false, points: points, category: draft.category, createdAt: new Date().toISOString(),
        icon: icons.some(icon => icon[0] === draft.icon) ? draft.icon : 'star',
        daily: draft.daily, days: scheduled, day: todayKey(), hist: {}
      });
      state.taskDraft = { title: '', icon: 'star', points: 1, category: '', daily: false, days: [], daysOpen: false };
      state.formOpen = false;
      save();
      render();
    }
    let draftSaveTimer = 0;
    root.addEventListener('input', () => {
      captureForm();
      window.clearTimeout(draftSaveTimer);
      draftSaveTimer = window.setTimeout(save, 400);
    });
    root.addEventListener('change', () => {
      captureForm();
      save();
    });
    root.addEventListener('click', event => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      captureForm();
      const action = button.dataset.action;
      if (action === 'view') {
        state.view = button.dataset.view === 'profile' ? 'profile' : 'tasks';
        state.formOpen = false;
        save();
        render();
      } else if (action === 'clear-profile-avatar') {
        state.profile.avatar = '';
        if (save()) render();
      } else if (action === 'edit-profile') {
        state.profileFormOpen = true;
        storageError = '';
        render();
      } else if (action === 'export-app-data') {
        exportAppData();
      } else if (action === 'toggle-form') {
        state.formOpen = !state.formOpen;
        save();
        render();
        const input = root.querySelector('#taskTitle');
        if (input) input.focus();
      } else if (action === 'daily') {
        state.taskDraft.daily = !state.taskDraft.daily;
        save();
        render();
      } else if (action === 'task-days') {
        state.taskDraft.daysOpen = !state.taskDraft.daysOpen;
        save();
        render();
      } else if (action === 'task-day') {
        const day = Number(button.dataset.day);
        const selected = validDays(state.taskDraft.days);
        state.taskDraft.days = selected.includes(day) ? selected.filter(value => value !== day) : selected.concat(day);
        save();
        render();
      } else if (action === 'task-icon') {
        state.taskDraft.icon = button.dataset.icon;
        save();
        render();
      } else if (action === 'toggle-task') {
        const task = state.tasks.find(item => item.id === button.dataset.id);
        if (task) {
          task.done = !task.done;
            state.profile.totalPoints = Math.max(0, state.profile.totalPoints +
              (task.done ? 1 : -1) * (Number(task.points) || 0));
            task.day = todayKey();
          delete task.autoAzkarSource;
          delete task.autoAzkarAt;
          if (task.done && !task.hist) task.hist = {};
          save();
          render();
          if (task.done) playTaskCompletionSound();
        }
      } else if (action === 'delete-task') {
        if (window.confirm('هل تريد حذف هذه المهمة؟')) {
          state.tasks = state.tasks.filter(item => item.id !== button.dataset.id);
          save();
          render();
        }
      }
    });
    root.addEventListener('submit', event => {
      event.preventDefault();
      if (event.target.dataset.form === 'profile') {
        saveProfile(event.target);
        return;
      }
      captureForm();
      if (event.target.dataset.form === 'task') addTask();
    });
    root.addEventListener('change', event => {
      const backupFile = event.target.closest('[data-app-backup-file]');
      if (backupFile) {
        const file = backupFile.files && backupFile.files[0];
        importAppData(file).catch(error => {
          console.error('تعذر استعادة نسخة Qurany الاحتياطية.', error);
          storageError = 'تعذر استعادة النسخة الاحتياطية. أعد المحاولة بملف Qurany صالح.';
          render();
        }).finally(() => { backupFile.value = ''; });
      }
    });
    window.addEventListener('quran:azkar-progress', syncAzkarTask);
    seedDefaultTasks();
    rollTasks();
    save();
    render();
    window.addEventListener('quran-prayer-times-updated', () => {
      render();
      schedulePrayerRefresh();
    });
    window.addEventListener('storage', event => {
      if (event.key === 'quran_prayer_cache_v1' || event.key === 'quran_prayer_city_v1') {
        render();
        schedulePrayerRefresh();
      }
    });
    schedulePrayerRefresh();
  })();
