(function () {
  var runtime = window.MushafRuntime;
  var data = window.QuranWorshipData;
  if (!runtime || !data || !data.azkar || !data.extra || !Array.isArray(data.categories)) {
    console.error('بيانات المسبحة والأذكار غير متاحة');
    if (runtime && runtime.toast) runtime.toast('تعذر تحميل بيانات المسبحة والأذكار');
    return;
  }

  var $ = runtime.$;
  var AR = '٠١٢٣٤٥٦٧٨٩';
  var dhikrPhrases = [
    'سُبْحَانَ الله',
    'الْحَمْدُ لله',
    'اللهُ أَكْبَر',
    'لَا إِلَهَ إِلَّا الله',
    'أَسْتَغْفِرُ الله',
    'اللَّهُمَّ صَلِّ عَلَى مُحَمَّد'
  ];
  var motivations = [
    ['تنزيه الله يملأ الميزان — سبّح', 'كل تسبيحة نخلة في الجنة', 'سبحان الله وبحمده تحط الخطايا', 'واصل — الملائكة تسبح معك'],
    ['بالحمد تدوم النعم — احمد', 'الحمد لله تملأ الميزان', 'من حمد الله رضي عنه', 'احمد بقلبك قبل لسانك'],
    ['الله أكبر من كل هم — كبّر', 'تكبيرك يصغّر كل خوف', 'الله أكبر مما يشغلك', 'كبّر وارتقِ درجة'],
    ['أفضل الذكر — هلّل', 'كلمة التوحيد مفتاح الجنة', 'جدّد إيمانك مع كل مرة', 'خير ما قاله النبيون'],
    ['الاستغفار يفتح الأبواب — استغفر', 'من لزم الاستغفار فُرّج همّه', 'استغفر تُمحَ ذنوبك', 'زد استغفارك يزد رزقك'],
    ['صلاة واحدة بعشر — صلِّ على النبي ﷺ', 'عشر صلوات تُدركك بها الشفاعة', 'الصلاة عليه تفرّج الكروب', 'صلاتك تبلغه ويرد السلام']
  ];
  var mic = $('worshipTasbeehMic');
  var hint = $('worshipTasbeehHint');
  var micWanted = false, micStream = null, audioContext = null, analyser = null, voiceTimer = null;
  var noiseFloor = 0.006, speaking = false, speakStart = 0, lastAbove = 0, aboveFrames = 0;
  var storageWarningShown = false;

  function arabicNumber(value) {
    return String(value).replace(/\d/g, function (digit) { return AR[digit]; });
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"]/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character];
    });
  }
  function todayKey() {
    var date = new Date();
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }
  function showStorageError(message, error) {
    console.error(message, error);
    if (!storageWarningShown && runtime.toast) runtime.toast('تعذر الوصول إلى التخزين المحلي على هذا الجهاز');
    storageWarningShown = true;
  }
  function readStoredText(key) {
    try { return window.localStorage.getItem(key); }
    catch (error) {
      showStorageError('تعذر قراءة الإعداد المحفوظ: ' + key, error);
      return null;
    }
  }
  function writeStoredText(key, value) {
    try { window.localStorage.setItem(key, value); return true; }
    catch (error) { showStorageError('تعذر حفظ الإعداد: ' + key, error); return false; }
  }
  function readStored(key) {
    try { return JSON.parse(readStoredText(key) || 'null'); }
    catch (error) {
      console.error('تعذر قراءة البيانات المحفوظة: ' + key, error);
      return null;
    }
  }
  function writeStored(key, value) {
    try { window.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (error) { showStorageError('تعذر حفظ البيانات: ' + key, error); return false; }
  }

  function readTasbeehState() {
    var saved = readStored('mq.worshipTasbeeh');
    if (saved && Number.isInteger(saved.index) && Number.isInteger(saved.count) &&
        saved.index >= 0 && saved.index < dhikrPhrases.length && saved.count >= 0) return saved;
    return { index: 0, count: 0 };
  }
  function paintTasbeeh() {
    var state = readTasbeehState();
    var phrase = $('worshipDhikrPhrase');
    phrase.innerHTML = escapeHTML(dhikrPhrases[state.index]) + '<small>اضغط لتغيير الذكر</small>';
    $('worshipTasbeehCount').textContent = arabicNumber(state.count);
    $('worshipTasbeehMotivation').textContent =
      motivations[state.index][Math.floor(state.count / 3) % motivations[state.index].length];
    $('worshipCountButton').setAttribute('aria-label',
      'زيادة عدّ ' + dhikrPhrases[state.index] + '؛ العدد ' + state.count);
  }
  function updateTasbeeh(change) {
    var state = readTasbeehState();
    change(state);
    writeStored('mq.worshipTasbeeh', state);
    paintTasbeeh();
  }
  $('worshipCountButton').addEventListener('click', function () {
    updateTasbeeh(function (state) { state.count++; });
  });
  $('worshipDhikrPhrase').addEventListener('click', function () {
    updateTasbeeh(function (state) {
      state.index = (state.index + 1) % dhikrPhrases.length;
      state.count = 0;
    });
  });
  $('worshipTasbeehReset').addEventListener('click', function () {
    if (!window.confirm('هل تريد تصفير عدّ المسبحة لهذا الذكر؟')) return;
    updateTasbeeh(function (state) { state.count = 0; });
  });

  function getAzkarList(categoryId) {
    return data.azkar[categoryId] || data.extra[categoryId] || [];
  }
  function readAzkarProgress() {
    var progress = readStored('mq.worshipAzkarProgress');
    if (!progress || progress.day !== todayKey() || !progress.counts ||
        typeof progress.counts !== 'object') {
      progress = { day: todayKey(), counts: {} };
    }
    return progress;
  }
  function countsFor(categoryId, list, progress) {
    var counts = progress.counts[categoryId];
    if (!Array.isArray(counts) || counts.length !== list.length) {
      counts = list.map(function () { return 0; });
      progress.counts[categoryId] = counts;
    }
    return counts;
  }
  function selectedCategoryId() {
    var saved = readStoredText('mq.worshipAzkarCategory');
    if (data.categories.some(function (category) { return category.id === saved; })) return saved;
    var preferred = new Date().getHours() < 12 ? 'morning' : 'evening';
    return data.categories.some(function (category) { return category.id === preferred; })
      ? preferred : data.categories[0].id;
  }
  var categoryId = selectedCategoryId();
  var categoryTrigger = $('worshipAzkarCategoryTrigger');
  var categoryWrap = $('worshipAzkarCategories');
  var categoryList = $('worshipAzkarCategoryList');
  var azkarList = $('worshipAzkarList');
  var categoryCloseTimer = 0;

  function paintCategoryOptions() {
    categoryList.innerHTML = data.categories.map(function (category) {
      return '<button type="button" class="azkar-category-option" data-worship-category="' +
        escapeHTML(category.id) + '" aria-pressed="' + (category.id === categoryId) + '">' +
        '<span aria-hidden="true">' + escapeHTML(category.ico) + '</span><span>' +
        escapeHTML(category.title) + '</span><small>' + arabicNumber(getAzkarList(category.id).length) +
        ' أذكار</small></button>';
    }).join('');
  }
  function paintAzkar() {
    var category = data.categories.find(function (item) { return item.id === categoryId; });
    var list = getAzkarList(categoryId);
    var progress = readAzkarProgress();
    var counts = countsFor(categoryId, list, progress);
    var activeIndex = -1;

    list.forEach(function (item, index) {
      var target = Math.max(1, Number(item.c) || 1);
      counts[index] = Math.min(target, Math.max(0, Number(counts[index]) || 0));
      if (counts[index] < target && activeIndex === -1) activeIndex = index;
    });
    writeStored('mq.worshipAzkarProgress', progress);

    $('worshipAzkar').classList.toggle('is-evening', categoryId === 'evening');
    paintCategoryOptions();

    if (!list.length) {
      azkarList.innerHTML = '<div class="worship-empty">لا توجد أذكار في هذه المجموعة.</div>';
      return;
    }

    azkarList.innerHTML = list.map(function (item, index) {
      var target = Math.max(1, Number(item.c) || 1);
      var current = counts[index];
      var remaining = target - current;
      var done = remaining === 0;
      var active = index === activeIndex;
      var showSkip = !done && target > 10;
      return '<article class="worship-azkar-item' + (done ? ' is-complete' : '') +
        (active ? ' is-active' : '') + '" data-worship-azkar-item="' + index + '">' +
        '<div class="worship-azkar-top"><span class="worship-azkar-number">' +
        (done ? '✓' : arabicNumber(index + 1)) + '</span>' +
        (active ? '<span class="worship-azkar-remaining">الذكر الحالي</span>' : '') + '</div>' +
        '<div class="worship-azkar-text">' + escapeHTML(item.t) + '</div>' +
        '<div class="worship-azkar-footer">' +
        (item.v ? '<span class="worship-azkar-benefit">' + escapeHTML(item.v) + '</span>' :
          '<span class="worship-azkar-benefit"></span>') +
        (showSkip ? '<button type="button" class="worship-azkar-skip" data-worship-azkar-skip="' +
          index + '" aria-label="تخطي هذا الذكر">⏭ تخطي</button>' : '') +
        '<span class="worship-azkar-count">' + (done ? 'اكتمل' : 'باقي ' + arabicNumber(remaining)) +
        '</span><button type="button" class="worship-azkar-action" data-worship-azkar-count="' +
        index + '" aria-label="' + (done ? 'إعادة الذكر' : 'تسجيل تكرار') + '">' +
        (done ? '✓' : arabicNumber(remaining)) + '</button></div></article>';
    }).join('') + (activeIndex === -1
      ? '<div class="worship-complete">🤲 تقبّل الله منك — أتممت ' +
        escapeHTML(category ? category.title : 'الأذكار') +
        '<br><small>اللهم أعنا على ذكرك وشكرك وحسن عبادتك</small></div>' : '');
  }

  categoryTrigger.addEventListener('click', function () {
    var expanded = categoryTrigger.getAttribute('aria-expanded') === 'true';
    categoryTrigger.setAttribute('aria-expanded', String(!expanded));
    if (categoryCloseTimer) window.clearTimeout(categoryCloseTimer);
    categoryWrap.hidden = false;
    categoryWrap.classList.toggle('open', !expanded);
    if (expanded) categoryCloseTimer = window.setTimeout(function () {
      if (categoryTrigger.getAttribute('aria-expanded') === 'false') categoryWrap.hidden = true;
    }, 300);
  });
  categoryList.addEventListener('click', function (event) {
    var button = event.target.closest('[data-worship-category]');
    if (!button) return;
    var nextCategory = button.getAttribute('data-worship-category');
    if (!data.categories.some(function (item) { return item.id === nextCategory; })) return;
    categoryId = nextCategory;
    writeStoredText('mq.worshipAzkarCategory', categoryId);
    if (categoryCloseTimer) window.clearTimeout(categoryCloseTimer);
    categoryTrigger.setAttribute('aria-expanded', 'false');
    categoryWrap.classList.remove('open');
    categoryCloseTimer = window.setTimeout(function () { categoryWrap.hidden = true; }, 300);
    paintAzkar();
  });
  azkarList.addEventListener('click', function (event) {
    var skip = event.target.closest('[data-worship-azkar-skip]');
    var action = event.target.closest('[data-worship-azkar-count]');
    var card = event.target.closest('[data-worship-azkar-item]');
    var index = Number((skip || action || card || {}).dataset &&
      (skip || action || card).dataset[skip ? 'worshipAzkarSkip' :
        (action ? 'worshipAzkarCount' : 'worshipAzkarItem')]);
    var list = getAzkarList(categoryId);
    if (!Number.isInteger(index) || !list[index]) return;
    var progress = readAzkarProgress();
    var counts = countsFor(categoryId, list, progress);
    var target = Math.max(1, Number(list[index].c) || 1);
    if (skip) counts[index] = target;
    else if (counts[index] >= target) counts[index] = 0;
    else counts[index]++;
    writeStored('mq.worshipAzkarProgress', progress);
    paintAzkar();
  });
  function stopVoiceCount() {
    if (voiceTimer) window.clearInterval(voiceTimer);
    voiceTimer = null;
    if (micStream) micStream.getTracks().forEach(function (track) { track.stop(); });
    micStream = null;
    if (audioContext) {
      var closingContext = audioContext;
      audioContext = null;
      closingContext.close().catch(function (error) {
        console.error('تعذر إغلاق سياق الصوت', error);
      });
    }
    analyser = null;
    speaking = false;
    aboveFrames = 0;
    mic.classList.remove('on', 'speaking');
    mic.setAttribute('aria-pressed', 'false');
  }
  function rms(buffer) {
    var sum = 0;
    for (var index = 0; index < buffer.length; index++) sum += buffer[index] * buffer[index];
    return Math.sqrt(sum / buffer.length);
  }
  async function startVoiceCount() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      hint.textContent = 'متصفحك لا يدعم الميكروفون — استخدم العدّ اليدوي.';
      return;
    }
    var stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
    } catch (error) {
      micWanted = false;
      stopVoiceCount();
      hint.textContent = error && error.name === 'NotAllowedError'
        ? 'لم يُسمح بالميكروفون. فعّل الإذن من إعدادات المتصفح ثم حاول مجددًا.'
        : 'تعذّر تشغيل الميكروفون. تحقق من توصيله ثم حاول مجددًا.';
      console.error('تعذر بدء العدّ الصوتي', error);
      return;
    }
    if (!micWanted || document.hidden || $('paneWorship').hidden ||
        !document.body.classList.contains('open')) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      return;
    }
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'متصفحك لا يدعم العدّ الصوتي — استخدم العدّ اليدوي.';
      return;
    }
    var context;
    try {
      context = new AudioContextClass();
      if (context.state === 'suspended') await context.resume();
      var source = context.createMediaStreamSource(stream);
      var analyzer = context.createAnalyser();
      analyzer.fftSize = 512;
      analyzer.smoothingTimeConstant = 0;
      source.connect(analyzer);
      if (!micWanted) {
        stream.getTracks().forEach(function (track) { track.stop(); });
        await context.close();
        return;
      }
      micStream = stream;
      audioContext = context;
      analyser = analyzer;
    } catch (error) {
      stream.getTracks().forEach(function (track) { track.stop(); });
      if (context && context.state !== 'closed') context.close().catch(function () {});
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'تعذّر تهيئة العدّ الصوتي. استخدم العدّ اليدوي أو حاول مرة أخرى.';
      console.error('تعذر تهيئة العدّ الصوتي', error);
      return;
    }
    var buffer = new Float32Array(analyser.fftSize);
    noiseFloor = 0.006;
    speaking = false;
    aboveFrames = 0;
    hint.textContent = 'العدّ الصوتي يعمل محليًا — تكفي وقفة قصيرة بين التسبيحات.';
    voiceTimer = window.setInterval(function () {
      if (!micWanted || !analyser) return;
      analyser.getFloatTimeDomainData(buffer);
      var level = rms(buffer);
      var now = performance.now();
      var threshold = Math.max(noiseFloor * 2.8, 0.012);
      if (!speaking && level > threshold) {
        aboveFrames++;
        if (aboveFrames < 2) return;
        speaking = true;
        speakStart = now - 25;
        lastAbove = now;
        mic.classList.add('speaking');
        return;
      }
      if (speaking && level > threshold * 0.65) {
        lastAbove = now;
      } else if (speaking && now - lastAbove >= 80) {
        speaking = false;
        mic.classList.remove('speaking');
        if (lastAbove - speakStart >= 120) {
          updateTasbeeh(function (state) { state.count++; });
          hint.textContent = 'أُضيفت تسبيحة — واصل.';
        }
        aboveFrames = 0;
      } else if (!speaking) {
        aboveFrames = 0;
        noiseFloor += (level - noiseFloor) * (level < noiseFloor ? 0.12 : 0.008);
      }
    }, 20);
  }
  mic.addEventListener('click', function () {
    if (micWanted) {
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'اضغط الميكروفون وقل الذكر مع وقفة قصيرة بين التسبيحات.';
      return;
    }
    micWanted = true;
    mic.classList.add('on');
    mic.setAttribute('aria-pressed', 'true');
    hint.textContent = 'بانتظار إذن الميكروفون…';
    startVoiceCount();
  });

  function setWorshipView(view) {
    var isAzkar = view === 'azkar';
    $('worshipAzkar').hidden = !isAzkar;
    $('worshipTasbeeh').hidden = isAzkar;
    document.querySelectorAll('[data-worship-view]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-worship-view') === view));
    });
    writeStoredText('mq.worshipView', view);
    if (isAzkar && micWanted) {
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'أوقفنا الميكروفون عند فتح الأذكار.';
    }
  }
  document.querySelector('.worship-switch').addEventListener('click', function (event) {
    var button = event.target.closest('[data-worship-view]');
    if (button) setWorshipView(button.getAttribute('data-worship-view'));
  });
  var paneObserver = new MutationObserver(function () {
    if ($('paneWorship').hidden && micWanted) {
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'أوقفنا الميكروفون عند مغادرة قسم الأذكار.';
    }
  });
  paneObserver.observe($('paneWorship'), { attributes: true, attributeFilter: ['hidden'] });
  var drawerObserver = new MutationObserver(function () {
    if (!document.body.classList.contains('open') && micWanted) {
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'أوقفنا الميكروفون عند إغلاق القائمة.';
    }
  });
  drawerObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && micWanted) {
      micWanted = false;
      stopVoiceCount();
      hint.textContent = 'أوقفنا الميكروفون عند إخفاء التطبيق.';
    }
  });
  window.addEventListener('pagehide', function () {
    micWanted = false;
    stopVoiceCount();
  });

  paintTasbeeh();
  paintAzkar();
  setWorshipView(readStoredText('mq.worshipView') === 'azkar' ? 'azkar' : 'tasbeeh');
})();
