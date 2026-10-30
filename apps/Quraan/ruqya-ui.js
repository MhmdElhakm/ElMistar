(function (global) {
  'use strict';

  var quranItems = [
    { title: 'سورة الفاتحة', refs: [[1, 1, 7]] },
    { title: 'آية الكرسي', refs: [[2, 255, 255]] },
    { title: 'أواخر سورة البقرة', refs: [[2, 285, 286]] },
    { title: 'الأعراف / ١١٧ - ١٢٢', refs: [[7, 117, 122]] },
    { title: 'يونس / ٧٩ - ٨٢', refs: [[10, 79, 82]] },
    { title: 'طه / ٦٥ - ٧٠', refs: [[20, 65, 70]] },
    { title: 'أوائل سورة الصافات', refs: [[37, 1, 10]] },
    { title: 'سورة الكافرون', refs: [[109, 1, 6]] },
    { title: 'سورة الإخلاص', refs: [[112, 1, 4]] },
    { title: 'سورة الفلق', refs: [[113, 1, 5]] },
    { title: 'سورة الناس', refs: [[114, 1, 6]] },
    { title: 'البقرة / ١٣٧ - ١٣٨', refs: [[2, 137, 138]] },
    { title: 'البقرة / ١٥٥ - ١٥٧', refs: [[2, 155, 157]] },
    { title: 'يونس / ٥٧ - ٥٨', refs: [[10, 57, 58]] },
    { title: 'الإسراء / ٨٢', refs: [[17, 82, 82]] },
    { title: 'فصلت / ٤٤', refs: [[41, 44, 44]] },
    { title: 'الحشر / ٢١ - ٢٤', refs: [[59, 21, 24]] },
    { title: 'الأنبياء / ٨٣ - ٨٨', refs: [[21, 83, 88]] }
  ];

  var duaItems = [
    {
      title: 'أسأل الله العظيم رب العرش العظيم أن يشفيك',
      text: 'أَسْأَلُ اللهَ العَظِيمَ رَبَّ العَرْشِ العَظِيمِ أَنْ يَشْفِيَكَ.',
      source: 'يُقال سبع مرات للمريض. رواه أبو داود والترمذي.'
    },
    {
      title: 'بسم الله أرقيك',
      text: 'بِسْمِ اللهِ أَرْقِيكَ، مِنْ كُلِّ شَيْءٍ يُؤْذِيكَ، مِنْ شَرِّ كُلِّ نَفْسٍ أَوْ عَيْنِ حَاسِدٍ، اللهُ يَشْفِيكَ، بِسْمِ اللهِ أَرْقِيكَ.',
      source: 'رواه مسلم.'
    },
    {
      title: 'دعاء الشفاء',
      text: 'اللَّهُمَّ رَبَّ النَّاسِ، أَذْهِبِ البَأْسَ، وَاشْفِ أَنْتَ الشَّافِي، لَا شِفَاءَ إِلَّا شِفَاؤُكَ، شِفَاءً لَا يُغَادِرُ سَقَمًا.',
      source: 'رواه البخاري ومسلم.'
    },
    {
      title: 'دعاء الألم',
      text: 'ضَعْ يَدَكَ عَلَى الَّذِي تَأَلَّمَ مِنْ جَسَدِكَ، وَقُلْ: بِسْمِ اللهِ ثَلَاثًا، وَقُلْ سَبْعَ مَرَّاتٍ: أَعُوذُ بِاللهِ وَقُدْرَتِهِ مِنْ شَرِّ مَا أَجِدُ وَأُحَاذِرُ.',
      source: 'رواه مسلم.'
    },
    {
      title: 'التعوذ من شر المخلوقات',
      text: 'أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.',
      source: 'رواه مسلم.'
    },
    {
      title: 'التعوذ من العين والشيطان',
      text: 'أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّةِ مِنْ كُلِّ شَيْطَانٍ وَهَامَّةٍ، وَمِنْ كُلِّ عَيْنٍ لَامَّةٍ.',
      source: 'رواه البخاري.'
    },
    {
      title: 'دعاء الحفظ',
      text: 'بِسْمِ اللهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ العَلِيمُ.',
      source: 'يُقال ثلاث مرات صباحًا ومساءً. رواه أبو داود والترمذي.'
    },
    {
      title: 'التعوذ من الغضب والشر',
      text: 'أَعُوذُ بِكَلِمَاتِ اللهِ التَّامَّاتِ مِنْ غَضَبِهِ وَعِقَابِهِ، وَشَرِّ عِبَادِهِ، وَمِنْ هَمَزَاتِ الشَّيَاطِينِ وَأَنْ يَحْضُرُونِ.',
      source: 'رواه أبو داود والترمذي.'
    },
    {
      title: 'دعاء آدم عليه السلام',
      text: 'رَبَّنَا ظَلَمْنَا أَنْفُسَنَا وَإِنْ لَمْ تَغْفِرْ لَنَا وَتَرْحَمْنَا لَنَكُونَنَّ مِنَ الخَاسِرِينَ.',
      source: 'سورة الأعراف، الآية ٢٣.'
    },
    {
      title: 'دعاء أيوب عليه السلام',
      text: 'أَنِّي مَسَّنِيَ الضُّرُّ وَأَنْتَ أَرْحَمُ الرَّاحِمِينَ.',
      source: 'سورة الأنبياء، الآية ٨٣.'
    },
    {
      title: 'دعاء ذي النون عليه السلام',
      text: 'لَا إِلَهَ إِلَّا أَنْتَ سُبْحَانَكَ إِنِّي كُنْتُ مِنَ الظَّالِمِينَ.',
      source: 'سورة الأنبياء، الآية ٨٧.'
    },
    {
      title: 'دعاء أيوب عليه السلام',
      text: 'أَنِّي مَسَّنِيَ الشَّيْطَانُ بِنُصْبٍ وَعَذَابٍ.',
      source: 'سورة ص، الآية ٤١.'
    }
  ];

  var reciters = [
    { id: 'Abdul_Basit_Murattal_192kbps', name: 'عبد الباسط عبد الصمد — مرتل' },
    { id: 'Abdul_Basit_Mujawwad_128kbps', name: 'عبد الباسط عبد الصمد — مجوّد' },
    { id: 'Abdullah_Basfar_192kbps', name: 'عبد الله بصفر' },
    { id: 'Abdurrahmaan_As-Sudais_192kbps', name: 'عبد الرحمن السديس' },
    { id: 'Abdullaah_3awwaad_Al-Juhaynee_128kbps', name: 'عبد الله عواد الجهني' },
    { id: 'Abdullah_Matroud_128kbps', name: 'عبد الله المطرود' },
    { id: 'Abu_Bakr_Ash-Shaatree_128kbps', name: 'أبو بكر الشاطري' },
    { id: 'Ahmed_Neana_128kbps', name: 'أحمد نعينع' },
    { id: 'Ahmed_ibn_Ali_al-Ajamy_128kbps_ketaballah.net', name: 'أحمد بن علي العجمي' },
    { id: 'Akram_AlAlaqimy_128kbps', name: 'أكرم العلاقمي' },
    { id: 'Alafasy_128kbps', name: 'مشاري العفاسي' },
    { id: 'Ali_Hajjaj_AlSuesy_128kbps', name: 'علي حجاج السويسي' },
    { id: 'Ali_Jaber_64kbps', name: 'علي جابر' },
    { id: 'Ayman_Sowaid_64kbps', name: 'أيمن سويد' },
    { id: 'aziz_alili_128kbps', name: 'عزيز عليلي' },
    { id: 'Fares_Abbad_64kbps', name: 'فارس عباد' },
    { id: 'Ghamadi_40kbps', name: 'سعد الغامدي' },
    { id: 'Hani_Rifai_192kbps', name: 'هاني الرفاعي' },
    { id: 'Hudhaify_128kbps', name: 'علي الحذيفي' },
    { id: 'Husary_128kbps', name: 'محمود خليل الحصري — مرتل' },
    { id: 'Husary_128kbps_Mujawwad', name: 'محمود خليل الحصري — مجوّد' },
    { id: 'Ibrahim_Akhdar_64kbps', name: 'إبراهيم الأخضر' },
    { id: 'Karim_Mansoori_40kbps', name: 'كريم منصوري' },
    { id: 'Khaalid_Abdullaah_al-Qahtaanee_192kbps', name: 'خالد القحطاني' },
    { id: 'khalefa_al_tunaiji_64kbps', name: 'خليفة الطنيجي' },
    { id: 'MaherAlMuaiqly128kbps', name: 'ماهر المعيقلي' },
    { id: 'mahmoud_ali_al_banna_32kbps', name: 'محمود علي البنا' },
    { id: 'Minshawy_Murattal_128kbps', name: 'محمد صديق المنشاوي — مرتل' },
    { id: 'Minshawy_Mujawwad_192kbps', name: 'محمد صديق المنشاوي — مجوّد' },
    { id: 'Mohammad_al_Tablaway_128kbps', name: 'محمد الطبلاوي' },
    { id: 'Muhammad_AbdulKareem_128kbps', name: 'محمد عبد الكريم' },
    { id: 'Muhammad_Ayyoub_128kbps', name: 'محمد أيوب' },
    { id: 'Muhammad_Jibreel_128kbps', name: 'محمد جبريل' },
    { id: 'Muhsin_Al_Qasim_192kbps', name: 'محسن القاسم' },
    { id: 'Mustafa_Ismail_48kbps', name: 'مصطفى إسماعيل' },
    { id: 'Nabil_Rifa3i_48kbps', name: 'نبيل الرفاعي' },
    { id: 'Nasser_Alqatami_128kbps', name: 'ناصر القطامي' },
    { id: 'Parhizgar_48kbps', name: 'شهريار پرهیزگار' },
    { id: 'Sahl_Yassin_128kbps', name: 'سهل ياسين' },
    { id: 'Salaah_AbdulRahman_Bukhatir_128kbps', name: 'صلاح عبد الرحمن بو خاطر' },
    { id: 'Salah_Al_Budair_128kbps', name: 'صلاح البدير' },
    { id: 'Saood_ash-Shuraym_128kbps', name: 'سعود الشريم' },
    { id: 'Yaser_Salamah_128kbps', name: 'ياسر سلامة' },
    { id: 'Yasser_Ad-Dussary_128kbps', name: 'ياسر الدوسري' }
  ];

  var css = [
    '.ruqya{--rq-green:var(--green,#0b7a3b);--rq-panel:var(--panel,#fdf8f0);--rq-card:var(--card,#fffdf8);--rq-line:var(--line,#e9dfd0);--rq-muted:var(--muted,#6f655a);min-height:0;padding:14px;color:var(--ink,#0d0a07);background:var(--rq-panel)}',
    '.ruqya-head{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid var(--rq-line);border-radius:18px;background:var(--rq-card);box-shadow:0 6px 18px rgba(0,0,0,.045)}',
    '.ruqya-mark{display:grid;place-items:center;flex:none;width:44px;height:44px;border-radius:14px;background:color-mix(in srgb,var(--rq-green) 12%,var(--rq-panel));color:var(--rq-green);font-size:23px}',
    '.ruqya-head h2{margin:0;font-size:17px;font-weight:900}.ruqya-head p{margin:3px 0 0;color:var(--rq-muted);font-size:11px;line-height:1.6}',
    '.ruqya-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin:12px 0;padding:4px;border:1px solid var(--rq-line);border-radius:14px;background:var(--rq-card)}',
    '.ruqya-tabs button{min-height:40px;border:0;border-radius:10px;background:transparent;color:var(--rq-muted);font:inherit;font-size:12px;font-weight:800;cursor:pointer}',
    '.ruqya-tabs button[aria-selected=true]{background:var(--rq-green);color:var(--on-green,#fff);box-shadow:0 3px 9px rgba(0,0,0,.1)}',
    '.ruqya-search{position:relative;margin-bottom:10px}.ruqya-search input{width:100%;min-height:42px;padding:8px 38px 8px 12px;border:1px solid var(--rq-line);border-radius:12px;background:var(--rq-card);color:inherit;font:inherit;font-size:12px;outline:none}',
    '.ruqya-search input:focus{border-color:var(--rq-green);box-shadow:0 0 0 3px color-mix(in srgb,var(--rq-green) 12%,transparent)}.ruqya-search span{position:absolute;right:13px;top:50%;transform:translateY(-50%);color:var(--rq-muted)}',
    '.ruqya-count{margin:0 2px 7px;color:var(--rq-muted);font-size:11px;font-weight:700}',
    '.ruqya-list{display:grid;gap:7px}.ruqya-item{display:flex;width:100%;min-height:46px;align-items:center;gap:9px;padding:9px 10px;border:1px solid var(--rq-line);border-radius:14px;background:var(--rq-card);color:inherit;text-align:right;font:inherit;cursor:pointer;transition:border-color .15s,background .15s}',
    '.ruqya-item:hover,.ruqya-item[aria-expanded=true]{border-color:color-mix(in srgb,var(--rq-green) 45%,var(--rq-line));background:color-mix(in srgb,var(--rq-green) 7%,var(--rq-card))}',
    '.ruqya-number{display:grid;place-items:center;flex:none;width:24px;height:24px;border-radius:8px;background:color-mix(in srgb,var(--rq-green) 10%,var(--rq-panel));color:var(--rq-green);font-size:10px;font-weight:900}',
    '.ruqya-item-label{min-width:0;flex:1;font-size:12px;font-weight:800;line-height:1.65}.ruqya-item-meta{display:block;color:var(--rq-muted);font-size:10px;font-weight:600}',
    '.ruqya-detail{margin:0 0 10px;padding:10px 2px;border:0;border-radius:0;background:transparent;box-shadow:none}',
    '.ruqya-detail[hidden]{display:none}.ruqya-detail h3{margin:0 0 9px;font-size:14px;font-weight:900}',
    '.ruqya-verses{display:block;font-family:"QCF4_Hafs_01_W","Traditional Arabic",serif;font-size:21px;line-height:2.15;text-align:justify}.ruqya-verse{display:inline;margin:0;padding:0;border:0;border-radius:0;background:transparent;font:inherit;line-height:inherit;text-align:inherit}.ruqya-verse small{display:inline;margin-inline-start:4px;color:var(--rq-muted);font-family:inherit;font-size:10px;white-space:nowrap}',
    '.ruqya-dua{margin:0;padding:0;border:0;border-radius:0;background:transparent;font-size:18px;font-weight:700;line-height:2;text-align:justify}',
    '.ruqya-source{margin:8px 1px 0;color:var(--rq-muted);font-size:11px;line-height:1.7}',
    '.ruqya-audio{display:grid;gap:9px;margin-top:12px;padding:12px;border:1px solid var(--rq-line);border-radius:13px;background:var(--rq-card)}',
    '.ruqya-audio label{font-size:11px;font-weight:800}.ruqya-audio select{width:100%;min-height:40px;padding:7px 10px;border:1px solid var(--rq-line);border-radius:10px;background:var(--rq-panel);color:inherit;font:inherit;font-size:12px}',
    '.ruqya-audio-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ruqya-audio-actions button{min-height:40px;padding:8px;border:1px solid var(--rq-line);border-radius:10px;background:var(--rq-panel);color:var(--rq-green);font:inherit;font-size:11px;font-weight:800;cursor:pointer}',
    '.ruqya-audio-actions button:first-child{background:var(--rq-green);color:var(--on-green,#fff);border-color:var(--rq-green)}.ruqya-audio-actions button:disabled{opacity:.55;cursor:wait}',
    '.ruqya-audio audio{width:100%;height:38px}.ruqya-audio-status{min-height:18px;margin:0;color:var(--rq-muted);font-size:10px;line-height:1.6}',
    '.ruqya-back{margin-top:11px;padding:8px 13px;border:1px solid var(--rq-line);border-radius:10px;background:var(--rq-card);color:var(--rq-green);font:inherit;font-size:11px;font-weight:800;cursor:pointer}',
    '.ruqya-empty{padding:18px;border:1px dashed var(--rq-line);border-radius:13px;color:var(--rq-muted);font-size:12px;text-align:center}',
    '.ruqya-note{margin:12px 2px 0;color:var(--rq-muted);font-size:10px;line-height:1.7}',
    '@media(max-width:380px){.ruqya{padding:10px}.ruqya-verses{font-size:19px}}',
    '@media(prefers-reduced-motion:reduce){.ruqya-item{transition:none}}'
  ].join('');

  var markup = '<main class="ruqya" dir="rtl" lang="ar">' +
    '<header class="ruqya-head"><span class="ruqya-mark" aria-hidden="true">۞</span><div><h2>الرقية الشرعية</h2><p>آيات من القرآن وأدعية مأثورة، اقرأها بتدبّر ويقين.</p></div></header>' +
    '<div class="ruqya-tabs" role="tablist" aria-label="نوع الرقية">' +
    '<button type="button" role="tab" data-ruqya-tab="quran" aria-selected="true">الرقية بالقرآن</button>' +
    '<button type="button" role="tab" data-ruqya-tab="dua" aria-selected="false">الأدعية والأذكار</button></div>' +
    '<label class="ruqya-search"><span aria-hidden="true">⌕</span><input type="search" id="ruqyaSearch" placeholder="ابحث في الرقية..." autocomplete="off" aria-label="ابحث في الرقية"></label>' +
    '<section class="ruqya-detail" id="ruqyaDetail" aria-live="polite" hidden></section>' +
    '<p class="ruqya-count" id="ruqyaCount"></p><div class="ruqya-list" id="ruqyaList"></div>' +
    '<p class="ruqya-note">هذه مجموعة من الآيات والأدعية الواردة في القرآن والسنة. تشغيل الصوت وتنزيله يتطلب اتصالًا بالإنترنت، والرقية لا تغني عن مراجعة الطبيب عند الحاجة.</p>' +
    '</main>';

  function run(doc, win) {
    var root = doc.querySelector('.ruqya');
    var list = doc.getElementById('ruqyaList');
    var detail = doc.getElementById('ruqyaDetail');
    var count = doc.getElementById('ruqyaCount');
    var search = doc.getElementById('ruqyaSearch');
    var tabs = doc.querySelectorAll('[data-ruqya-tab]');
    var activeTab = 'quran';
    var selectedIndex = -1;
    var selectedReciter = 'Alafasy_128kbps';
    var audioQueue = [];
    var audioPosition = 0;
    var downloadGeneration = 0;
    var audioStatusElement = null;
    var downloadButton = null;
    var audio = doc.createElement('audio');
    audio.controls = true;
    audio.preload = 'none';
    var quran = win.MushafRuntime && win.MushafRuntime.data;
    var arabicDigits = '٠١٢٣٤٥٦٧٨٩';

    if (!root || !list || !detail || !count || !search || !quran || !Array.isArray(quran.texts)) {
      throw new Error('تعذر تجهيز بيانات الرقية الشرعية');
    }

    function number(value) {
      return String(value).replace(/\d/g, function (digit) { return arabicDigits[digit]; });
    }
    function normalize(value) {
      return String(value).toLowerCase().replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي');
    }
    function getItems() { return activeTab === 'quran' ? quranItems : duaItems; }
    function getVerseText(surah, ayah) {
      var text = quran.texts[surah - 1] && quran.texts[surah - 1][ayah - 1];
      if (typeof text !== 'string' || !text.trim()) {
        throw new Error('نص الآية غير متاح: ' + surah + ':' + ayah);
      }
      return text.replace(/ /g, '');
    }
    function audioUrl(surah, ayah) {
      var chapter = String(surah).padStart(3, '0');
      var verse = String(ayah).padStart(3, '0');
      return 'https://everyayah.com/data/' + encodeURIComponent(selectedReciter) + '/' +
        chapter + verse + '.mp3';
    }
    function resetAudio() {
      downloadGeneration++;
      audio.pause();
      audioQueue = [];
      audioPosition = 0;
      audio.removeAttribute('src');
      audio.load();
      audioStatusElement = null;
      downloadButton = null;
    }
    function setAudioStatus(message) {
      if (audioStatusElement && audioStatusElement.isConnected) audioStatusElement.textContent = message;
    }
    function playCurrentVerse() {
      var verse = audioQueue[audioPosition];
      if (!verse) {
        setAudioStatus('اكتمل تشغيل المقطع.');
        return;
      }
      var generation = downloadGeneration;
      audio.src = audioUrl(verse[0], verse[1]);
      audio.load();
      audio.play().then(function () {
        if (generation === downloadGeneration) {
          setAudioStatus('يُشغَّل الآن · الآية ' + number(verse[1]) + ' من سورة ' +
            quran.surahs[verse[0] - 1][1]);
        }
      }).catch(function (error) {
        if (generation !== downloadGeneration) return;
        console.error('تعذر تشغيل تلاوة الرقية:', error);
        setAudioStatus('تعذر تشغيل الصوت. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
      });
    }
    function createAudioPlayer() {
      var panel = doc.createElement('section');
      panel.className = 'ruqya-audio';
      var label = doc.createElement('label');
      label.setAttribute('for', 'ruqyaReciter');
      label.textContent = 'اختر القارئ';
      var select = doc.createElement('select');
      select.id = 'ruqyaReciter';
      select.setAttribute('aria-label', 'اختر قارئ القرآن');
      var mainReciterSelect = global.document && global.document.getElementById('reciterSelect');
      var mainReciters = mainReciterSelect && mainReciterSelect.options.length
        ? Array.prototype.slice.call(mainReciterSelect.options).map(function (option) {
          return { id: option.value, name: option.textContent };
        })
        : reciters;
      mainReciters.forEach(function (reciter) {
        var option = doc.createElement('option');
        option.value = reciter.id;
        option.textContent = reciter.name;
        option.selected = reciter.id === selectedReciter;
        select.appendChild(option);
      });
      var actions = doc.createElement('div');
      actions.className = 'ruqya-audio-actions';
      var playButton = doc.createElement('button');
      playButton.type = 'button';
      playButton.setAttribute('data-ruqya-play', '');
      playButton.textContent = 'استمع للمقطع';
      var saveButton = doc.createElement('button');
      saveButton.type = 'button';
      saveButton.setAttribute('data-ruqya-download', '');
      saveButton.textContent = 'تحميل المقطع';
      var status = doc.createElement('p');
      status.className = 'ruqya-audio-status';
      status.setAttribute('data-ruqya-audio-status', '');
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.textContent = 'اختر قارئًا ثم استمع أو حمّل المقطع.';
      actions.appendChild(playButton);
      actions.appendChild(saveButton);
      panel.appendChild(label);
      panel.appendChild(select);
      panel.appendChild(actions);
      panel.appendChild(audio);
      panel.appendChild(status);
      audioStatusElement = status;
      downloadButton = saveButton;
      return panel;
    }
    function queueFor(item) {
      var queue = [];
      item.refs.forEach(function (range) {
        for (var ayah = range[1]; ayah <= range[2]; ayah++) queue.push([range[0], ayah]);
      });
      return queue;
    }
    async function downloadSelectedPassage() {
      if (selectedIndex < 0 || activeTab !== 'quran') return;
      var item = quranItems[selectedIndex];
      var queue = queueFor(item);
      var generation = ++downloadGeneration;
      if (downloadButton) downloadButton.disabled = true;
      audio.pause();
      setAudioStatus('جارٍ تحميل المقطع…');
      try {
        var chunks = [];
        for (var i = 0; i < queue.length; i++) {
          if (generation !== downloadGeneration) return;
          setAudioStatus('جارٍ تحميل الآية ' + number(i + 1) + ' من ' + number(queue.length) + '…');
          var response = await win.fetch(audioUrl(queue[i][0], queue[i][1]));
          if (!response.ok) throw new Error('HTTP ' + response.status);
          chunks.push(await response.arrayBuffer());
        }
        if (generation !== downloadGeneration) return;
        var blob = new win.Blob(chunks, { type: 'audio/mpeg' });
        var objectUrl = global.URL.createObjectURL(blob);
        var link = doc.createElement('a');
        var filename = item.title.replace(/[\\/:*?"<>|]/g, '-');
        link.href = objectUrl;
        link.download = 'الرقية-' + filename + '.mp3';
        link.click();
        win.setTimeout(function () { global.URL.revokeObjectURL(objectUrl); }, 60000);
        setAudioStatus('تم تجهيز المقطع وتنزيله على جهازك.');
      } catch (error) {
        if (generation !== downloadGeneration) return;
        console.error('تعذر تنزيل مقطع الرقية:', error);
        setAudioStatus('تعذر تنزيل المقطع. تحقق من اتصال الإنترنت وحاول مرة أخرى.');
      } finally {
        if (generation === downloadGeneration && downloadButton && downloadButton.isConnected) {
          downloadButton.disabled = false;
        }
      }
    }
    function renderDetail() {
      if (selectedIndex < 0) {
        detail.hidden = true;
        detail.replaceChildren();
        return;
      }
      var item = getItems()[selectedIndex];
      if (!item) {
        selectedIndex = -1;
        detail.hidden = true;
        detail.replaceChildren();
        return;
      }

      detail.replaceChildren();
      var heading = doc.createElement('h3');
      heading.textContent = item.title;
      detail.appendChild(heading);
      if (activeTab === 'quran') {
        var verses = doc.createElement('div');
        verses.className = 'ruqya-verses';
        item.refs.forEach(function (range) {
          for (var ayah = range[1]; ayah <= range[2]; ayah++) {
            var verse = doc.createElement('p');
            verse.className = 'ruqya-verse';
            verse.textContent = getVerseText(range[0], ayah);
            var reference = doc.createElement('small');
            reference.textContent = 'سورة ' + quran.surahs[range[0] - 1][1] + ' · الآية ' + number(ayah);
            verse.appendChild(reference);
            verses.appendChild(verse);
          }
        });
        detail.appendChild(verses);
        detail.appendChild(createAudioPlayer());
      } else {
        var text = doc.createElement('p');
        text.className = 'ruqya-dua';
        text.textContent = item.text;
        detail.appendChild(text);
        var source = doc.createElement('p');
        source.className = 'ruqya-source';
        source.textContent = item.source;
        detail.appendChild(source);
      }
      var back = doc.createElement('button');
      back.type = 'button';
      back.className = 'ruqya-back';
      back.setAttribute('data-ruqya-back', '');
      back.textContent = 'العودة إلى القائمة';
      detail.appendChild(back);
      detail.hidden = false;
    }
    function renderList() {
      var query = normalize(search.value.trim());
      var items = getItems();
      var filtered = items.map(function (item, index) {
        return { item: item, index: index };
      }).filter(function (entry) {
        if (!query) return true;
        var searchable = entry.item.title + ' ' + (entry.item.source || '');
        if (activeTab === 'dua') searchable += ' ' + entry.item.text;
        else entry.item.refs.forEach(function (range) {
          for (var ayah = range[1]; ayah <= range[2]; ayah++) {
            searchable += ' ' + getVerseText(range[0], ayah);
          }
        });
        return normalize(searchable).indexOf(query) !== -1;
      });

      count.textContent = 'عدد العناصر: ' + number(filtered.length);
      list.replaceChildren();
      if (selectedIndex >= 0 && !filtered.some(function (entry) { return entry.index === selectedIndex; })) {
        resetAudio();
        selectedIndex = -1;
        renderDetail();
      }
      if (!filtered.length) {
        var empty = doc.createElement('p');
        empty.className = 'ruqya-empty';
        empty.textContent = 'لا توجد نتائج مطابقة. جرّب كلمة أخرى.';
        list.appendChild(empty);
        return;
      }
      filtered.forEach(function (entry) {
        var button = doc.createElement('button');
        button.type = 'button';
        button.className = 'ruqya-item';
        button.setAttribute('data-ruqya-item', String(entry.index));
        button.setAttribute('aria-expanded', String(entry.index === selectedIndex));
        var index = doc.createElement('span');
        index.className = 'ruqya-number';
        index.textContent = number(entry.index + 1);
        var label = doc.createElement('span');
        label.className = 'ruqya-item-label';
        label.textContent = entry.item.title;
        if (entry.item.source) {
          var meta = doc.createElement('small');
          meta.className = 'ruqya-item-meta';
          meta.textContent = entry.item.source.indexOf('سورة ') === 0 ? 'من القرآن' : 'دعاء مأثور';
          label.appendChild(meta);
        }
        button.appendChild(index);
        button.appendChild(label);
        button.appendChild(doc.createTextNode(entry.index === selectedIndex ? '−' : '›'));
        list.appendChild(button);
      });
    }
    function selectTab(tab) {
      if (activeTab === tab) return;
      resetAudio();
      activeTab = tab;
      selectedIndex = -1;
      search.value = '';
      tabs.forEach(function (button) {
        var selected = button.getAttribute('data-ruqya-tab') === tab;
        button.setAttribute('aria-selected', String(selected));
      });
      renderDetail();
      renderList();
    }

    tabs.forEach(function (button) {
      button.addEventListener('click', function () {
        selectTab(button.getAttribute('data-ruqya-tab'));
      });
    });
    search.addEventListener('input', renderList);
    list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-ruqya-item]');
      if (!button) return;
      var index = Number(button.getAttribute('data-ruqya-item'));
      resetAudio();
      selectedIndex = selectedIndex === index ? -1 : index;
      renderDetail();
      renderList();
      if (selectedIndex >= 0) detail.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    detail.addEventListener('click', function (event) {
      if (event.target.closest('[data-ruqya-back]')) {
        resetAudio();
        selectedIndex = -1;
        renderDetail();
        renderList();
      } else if (event.target.closest('[data-ruqya-play]')) {
        if (!audio.paused) {
          audio.pause();
          setAudioStatus('تم إيقاف التشغيل مؤقتًا.');
        } else if (audioQueue.length && audio.src) {
          audio.play().catch(function (error) {
            console.error('تعذر استئناف تلاوة الرقية:', error);
            setAudioStatus('تعذر تشغيل الصوت. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
          });
        } else {
          audioQueue = queueFor(quranItems[selectedIndex]);
          audioPosition = 0;
          playCurrentVerse();
        }
      } else if (event.target.closest('[data-ruqya-download]')) {
        downloadSelectedPassage();
      }
    });
    detail.addEventListener('change', function (event) {
      if (event.target.id !== 'ruqyaReciter') return;
      selectedReciter = event.target.value;
      resetAudio();
      audioStatusElement = detail.querySelector('[data-ruqya-audio-status]');
      downloadButton = detail.querySelector('[data-ruqya-download]');
      setAudioStatus('تم اختيار القارئ. اضغط استمع أو تحميل لبدء المقطع.');
    });
    audio.addEventListener('ended', function () {
      audioPosition++;
      if (audioPosition < audioQueue.length) playCurrentVerse();
      else {
        audioQueue = [];
        audioPosition = 0;
        setAudioStatus('اكتمل تشغيل المقطع.');
      }
    });
    audio.addEventListener('error', function () {
      if (audio.src) setAudioStatus('تعذر تحميل الصوت. تحقق من اتصال الإنترنت أو جرّب قارئًا آخر.');
    });
    root.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && selectedIndex >= 0) {
        resetAudio();
        selectedIndex = -1;
        renderDetail();
        renderList();
      }
    });
    renderList();
  }

  global.QuranRuqyaService = { css: css, markup: markup, run: run };
})(window);
