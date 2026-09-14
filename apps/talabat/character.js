/* ============================================================
   مساعد البيت الظريف — نظام الشخصية الكرتونية التفاعلية
   الشكل: طماطماية مرحة 🍅 — ضغطة مطولة تفتح قائمة (إخفاء/صوت).
   نظام مستقل Modular لا يغيّر أي UI موجود في التطبيق.
   Modules: CharacterState / CharacterAnimation / CharacterDialog
            CharacterSettings / CharacterController
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- CharacterSettings ---------------- */
  const CharacterSettings = {
    LS_KEY: 'naqisna_char',
    defaults: { show: true, talk: true, sound: true, roleJokes: true, pos: null },
    _cache: null,
    load() {
      try {
        const raw = localStorage.getItem(this.LS_KEY);
        this._cache = Object.assign({}, this.defaults, raw ? JSON.parse(raw) : {});
      } catch { this._cache = Object.assign({}, this.defaults); }
      try {
        const app = JSON.parse(localStorage.getItem('baytna_v2') || 'null');
        if (app) {
          if (app._charShow !== undefined) this._cache.show = app._charShow !== false;
          if (app._charTalk !== undefined) this._cache.talk = app._charTalk !== false;
          if (app._charSound !== undefined) this._cache.sound = app._charSound !== false;
          if (app._charRole !== undefined) this._cache.roleJokes = app._charRole !== false;
        }
      } catch {}
      return this._cache;
    },
    get(k) { return (this._cache || this.load())[k]; },
    save(patch) {
      this._cache = Object.assign(this._cache || this.load(), patch);
      try { localStorage.setItem(this.LS_KEY, JSON.stringify(this._cache)); } catch {}
    }
  };

  /* كتابة علم في state التطبيق حتى تتزامن مع شاشة الإعدادات */
  function setAppFlag(key, val) {
    try {
      const raw = localStorage.getItem('baytna_v2');
      if (!raw) return;
      const app = JSON.parse(raw);
      if (!app || typeof app !== 'object') return;
      app[key] = val;
      localStorage.setItem('baytna_v2', JSON.stringify(app));
    } catch {}
  }

  /* ---------------- CharacterState ---------------- */
  const CharacterState = {
    mood: 'idle',
    busyUntil: 0,
    lastAuto: 0,
    lastTap: 0,
    lastIdx: {},
    seenDelay: {},
    welcomed: false,
    AUTO_GAP: 30000,
    BUBBLE_MS: 4500,
    DELAY_MS: 20 * 3600 * 1000,
    MANY_AT: 6,
    WANDER_MS: 50000,
    LONGPRESS_MS: 600
  };

  /* ---------------- CharacterDialog ---------------- */
  const CharacterDialog = {
    NEW_REQUEST: [
      'تم تسجيل الطلب... وأشهد أنني لم أره أولًا! 😂',
      'وصل طلب جديد! 🫡 جاهزين؟',
      'اتسجل يا معلم! والقايمة بتكبر 😄',
      'طلب جديد في المنطقة! 📝😂',
      'حاضر! سجلته قبل ما تنساه 😎',
      'طلب جديد نزل الملعب! ⚽😂',
      'سجلتهولك... بس متقولش لحد 😄',
      'القايمة بتتقل... والمحفظة بتخف 😂💸'
    ],
    ROLE_HUSBAND_SENT: [
      'طلب جديد من المدير التنفيذي للبيت 😂',
      'الباشا طلب... يُنفذ فورًا 🫡😂'
    ],
    ROLE_WIFE_SENT: [
      'طلب جديد من الإدارة العليا 😂 حاضر يا فندم!',
      'الإدارة العليا أصدرت قرارًا جديدًا 🫡😂'
    ],
    SEND: [
      'مهمة جديدة وصلت! 🫡',
      'تم استلام الطلب... والضغط بدأ 😂',
      'حاضر يا كابتن البيت! 🫡',
      'القايمة اتبعتت... ربنا يكون في العون 😂'
    ],
    ACCEPT: [
      'تمت الموافقة! يوم سعيد للجميع 😂🎉'
    ],
    COMPLETE: [
      'Mission accomplished! 🥳',
      'واحد خلص... والباقي في الطريق 😂',
      'كده الكلام! 😎👏',
      'تم الإنجاز! 👏',
      'عاش يا بطل! 💪😂'
    ],
    ALL_DONE: [
      'خلصنا كل حاجة! يوم سعيد للجميع 😂🎉',
      'البيت كسب الجولة دي! 🏆😎'
    ],
    DELAY: [
      'أنا لسه مستني... والطلب كمان مستني 😂🕐',
      'الساعة بتعدي والطلب لسه هنا 😅🕐',
      'الطلب ده بقى من أصحاب البيت 😂'
    ],
    MANY: [
      'لحظة... مين طلب كل ده؟ 😂📝',
      'القايمة دي محتاجة شنطة سفر مش شنطة سوق 😂',
      'أنا اتلخبطت... رتبوهم انتوا 😵😂'
    ],
    EMPTY: [
      'أخيرًا... البيت هادي 😎',
      'مفيش طلبات؟ أنا هاخد بريك 😴',
      'البيت هادي النهارده... غريبة! 😂'
    ],
    TAP: [
      'أنا مجرد طماطماية... متدخلونيش في الخناقات 😂',
      'إزيك يا بطل؟ 🍅😄',
      'نصيحة اليوم: اللي يجيب الطلبات بدري ينام بدري 😂',
      'أنا هنا للضحك بس... والطلبات عليكم 😎',
      'مرة واحد راح السوبرماركت بالقايمة... رجع بحاجات مش في القايمة 😂',
      'دوس كمان مرة... يمكن أضحك 😄',
      'الطماطم غالية... بس ضحكتي ببلاش 😂🍅'
    ],
    WELCOME: [
      'أنا طماطماية البيت الظريفة! دوس عليّا... ولو طولت الدوسة هتلاقي مفاجأة 🍅😄'
    ],
    pick(poolKey) {
      const pool = this[poolKey] || [];
      if (!pool.length) return '';
      let i;
      const last = CharacterState.lastIdx[poolKey];
      do { i = Math.floor(Math.random() * pool.length); } while (i === last && pool.length > 1);
      CharacterState.lastIdx[poolKey] = i;
      return pool[i];
    }
  };

  /* ---------------- CharacterAnimation ---------------- */
  const CharacterAnimation = {
    el: null, timer: null,
    play(mood, ms) {
      if (!this.el) return;
      this.el.dataset.mood = mood;
      CharacterState.mood = mood;
      clearTimeout(this.timer);
      this.timer = setTimeout(() => {
        if (!this.el) return;
        this.el.dataset.mood = 'idle';
        CharacterState.mood = 'idle';
      }, ms || 2600);
    }
  };

  /* ---------------- صوت خفيف (WebAudio بدون ملفات) ---------------- */
  function blip() {
    if (!CharacterSettings.get('sound')) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = blip._ctx || (blip._ctx = new Ctx());
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      const t = ctx.currentTime;
      [660, 880].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.06, t + i * 0.09 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.1);
        o.connect(g); g.connect(ctx.destination);
        o.start(t + i * 0.09); o.stop(t + i * 0.09 + 0.12);
      });
    } catch {}
  }

  /* ---------------- CharacterController ---------------- */
  const MOOD_FOR = {
    NEW_REQUEST: 'happy', SEND: 'surprise', ACCEPT: 'celebrate',
    COMPLETE: 'laugh', ALL_DONE: 'celebrate', DELAY: 'waiting',
    MANY: 'confused', EMPTY: 'sleep', TAP: null, WELCOME: 'happy'
  };

  function prettySpots() {
    const w = window.innerWidth, h = window.innerHeight;
    const s = (CharacterController.root && CharacterController.root.offsetWidth) || 70;
    const nav = 76;
    return [
      { x: 12, y: h - nav - 70 - s },
      { x: 12, y: 108 },
      { x: w - s - 12, y: Math.round(h * 0.40) },
      { x: w - s - 12, y: h - nav - 70 - s }
    ];
  }

  const CharacterController = {
    root: null, bubble: null, menu: null, hideTimer: null, wanderTimer: null, spotIdx: 0,

    mount() {
      if (this.root || !document.body) return;
      const css = `
      #houseHelper{position:fixed;z-index:45;width:clamp(60px,18vw,80px);touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer;filter:drop-shadow(0 10px 16px rgba(190,30,40,.32));transition:opacity .25s}
      #houseHelper.hidden{display:none}
      #houseHelper.gliding{transition:left .9s cubic-bezier(.22,1,.36,1),top .9s cubic-bezier(.22,1,.36,1),opacity .25s}
      #houseHelper .hh-bubble{position:absolute;bottom:calc(100% + 10px);right:50%;transform:translateX(50%) scale(.9);transform-origin:bottom center;min-width:150px;max-width:230px;background:#fff;color:#1E1B2E;font-weight:800;font-size:12.5px;line-height:1.7;border-radius:16px 16px 16px 4px;padding:9px 12px;box-shadow:0 10px 26px rgba(30,27,46,.22);border:1.5px solid #FECDD3;opacity:0;pointer-events:none;transition:all .22s;text-align:center}
      #houseHelper .hh-bubble.show{opacity:1;transform:translateX(50%) scale(1)}
      #houseHelper .hh-bubble:after{content:'';position:absolute;top:100%;right:50%;transform:translateX(50%);border:7px solid transparent;border-top-color:#fff}
      #houseHelper .hh-tom{position:relative;width:100%;aspect-ratio:1/1.02;animation:hhBob 3.4s ease-in-out infinite}
      @keyframes hhBob{0%,100%{transform:translateY(0) rotate(-1.2deg)}50%{transform:translateY(-6px) rotate(1.2deg)}}
      #houseHelper .hh-body{position:absolute;inset:9% 2% 4% 2%;border-radius:50%/48% 48% 52% 52%;background:radial-gradient(circle at 32% 26%,#FCA5A5 0%,#EF4444 42%,#B91C1C 100%);box-shadow:inset -5px -8px 0 rgba(0,0,0,.14),inset 3px 5px 0 rgba(255,255,255,.22)}
      #houseHelper .hh-shine{position:absolute;top:16%;left:16%;width:16%;height:22%;background:rgba(255,255,255,.55);border-radius:50%;transform:rotate(-18deg);z-index:2}
      #houseHelper .hh-stem{position:absolute;top:2%;left:50%;width:9%;height:13%;background:linear-gradient(#16A34A,#15803D);border-radius:40% 40% 30% 30%;transform:translateX(-50%) rotate(6deg);z-index:2}
      #houseHelper .hh-leaf{position:absolute;top:8%;width:30%;height:11%;background:linear-gradient(#22C55E,#15803D);z-index:2;box-shadow:0 1px 2px rgba(0,0,0,.2)}
      #houseHelper .hh-leaf.l1{left:22%;border-radius:90% 10% 90% 10%;transform:rotate(-24deg)}
      #houseHelper .hh-leaf.l2{right:22%;border-radius:10% 90% 10% 90%;transform:rotate(24deg)}
      #houseHelper .hh-eye{position:absolute;top:40%;width:15%;aspect-ratio:1/1.3;background:#fff;border-radius:50%;overflow:hidden;z-index:2;box-shadow:0 1px 2px rgba(0,0,0,.25)}
      #houseHelper .hh-eye.l{left:29%} #houseHelper .hh-eye.r{right:29%}
      #houseHelper .hh-eye:after{content:'';position:absolute;left:50%;top:54%;width:54%;aspect-ratio:1;background:#241623;border-radius:50%;transform:translate(-50%,-50%);animation:hhBlink 4.2s ease-in-out infinite}
      @keyframes hhBlink{0%,94%,100%{transform:translate(-50%,-50%) scaleY(1)}96%,98%{transform:translate(-50%,-50%) scaleY(.08)}}
      #houseHelper .hh-cheek{position:absolute;top:56%;width:13%;aspect-ratio:1;background:#F9A8A8;opacity:.75;border-radius:50%;z-index:2}
      #houseHelper .hh-cheek.l{left:18%} #houseHelper .hh-cheek.r{right:18%}
      #houseHelper .hh-mouth{position:absolute;left:50%;top:59%;width:26%;height:13%;transform:translateX(-50%);border:2.5px solid #57161D;border-top:none;border-radius:0 0 40px 40px;z-index:2;transition:all .2s;background:rgba(255,255,255,.12)}
      #houseHelper .hh-arm{position:absolute;top:58%;width:10%;height:28%;background:#991B1B;border-radius:999px;transform-origin:top center;transition:transform .25s;z-index:1}
      #houseHelper .hh-arm.l{left:0;transform:rotate(16deg)} #houseHelper .hh-arm.r{right:0;transform:rotate(-16deg)}
      #houseHelper .hh-foot{position:absolute;bottom:0;width:20%;height:8%;background:#7F1D1D;border-radius:50%;z-index:1}
      #houseHelper .hh-foot.l{left:24%} #houseHelper .hh-foot.r{right:24%}
      #houseHelper .hh-zzz{position:absolute;top:4%;left:8%;font-size:15px;font-weight:900;color:#B91C1C;opacity:0}
      #houseHelper[data-mood="happy"] .hh-mouth{height:19%}
      #houseHelper[data-mood="laugh"] .hh-tom{animation:hhShake .45s ease-in-out infinite}
      #houseHelper[data-mood="laugh"] .hh-mouth{height:26%;background:#7F1D1D;border-radius:12px 12px 40px 40px}
      @keyframes hhShake{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) translateY(-3px)}}
      #houseHelper[data-mood="surprise"] .hh-tom{animation:hhPop .5s ease-out}
      #houseHelper[data-mood="surprise"] .hh-eye:after{transform:translate(-50%,-50%) scale(1.3)}
      #houseHelper[data-mood="surprise"] .hh-mouth{width:14%;height:16%;border:2.5px solid #57161D;border-radius:50%}
      @keyframes hhPop{0%{transform:scale(.85)}60%{transform:scale(1.06)}100%{transform:scale(1)}}
      #houseHelper[data-mood="think"] .hh-tom{animation:none;transform:rotate(-4deg)}
      #houseHelper[data-mood="think"] .hh-eye:after{transform:translate(-70%,-60%)}
      #houseHelper[data-mood="sleep"] .hh-tom{animation:hhBob 5s ease-in-out infinite}
      #houseHelper[data-mood="sleep"] .hh-eye:after{transform:translate(-50%,-50%) scaleY(.08);animation:none}
      #houseHelper[data-mood="sleep"] .hh-mouth{width:13%;height:12%;border-radius:50%;border:2.5px solid #57161D}
      #houseHelper[data-mood="sleep"] .hh-zzz{opacity:1;animation:hhZzz 2s ease-out infinite}
      @keyframes hhZzz{0%{transform:translateY(4px);opacity:0}30%{opacity:1}100%{transform:translateY(-12px);opacity:0}}
      #houseHelper[data-mood="celebrate"] .hh-tom{animation:hhJump .55s ease-in-out infinite}
      #houseHelper[data-mood="celebrate"] .hh-arm.l{transform:rotate(150deg)} #houseHelper[data-mood="celebrate"] .hh-arm.r{transform:rotate(-150deg)}
      @keyframes hhJump{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
      #houseHelper[data-mood="confused"] .hh-tom{animation:none;transform:rotate(7deg)}
      #houseHelper[data-mood="confused"] .hh-mouth{width:24%;height:8%;border:none;border-top:2.5px solid #57161D;border-radius:0;background:none}
      #houseHelper[data-mood="waiting"] .hh-tom{animation:hhSway 1.6s ease-in-out infinite}
      @keyframes hhSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
      #houseHelper[data-mood="facepalm"] .hh-arm.r{transform:rotate(-160deg) translateY(-8px)}
      #hhMenu{position:fixed;z-index:70;min-width:190px;background:#fff;border-radius:18px;border:1.5px solid #FECDD3;box-shadow:0 16px 44px rgba(30,27,46,.30);padding:6px;display:none;animation:hhMenuIn .18s ease-out}
      @keyframes hhMenuIn{from{transform:scale(.92);opacity:0}to{transform:scale(1);opacity:1}}
      #hhMenu.open{display:block}
      #hhMenu .hh-m-title{text-align:center;font-size:12px;font-weight:900;color:#B91C1C;padding:7px 4px 5px}
      #hhMenu button{display:flex;align-items:center;gap:9px;width:100%;padding:11px 12px;border-radius:12px;font-size:13.5px;font-weight:800;color:#1E1B2E;text-align:right}
      #hhMenu button:active{background:#FFF1F2}
      #hhMenu button.danger{color:#E11D48}
      #hhMenu .hh-m-note{text-align:center;font-size:10.5px;font-weight:700;color:#A8A3C0;padding:4px 6px 7px;line-height:1.7}
      @media (min-width:481px){#houseHelper{width:74px}}`;
      const st = document.createElement('style');
      st.id = 'houseHelperCSS';
      st.textContent = css;
      document.head.appendChild(st);

      const root = document.createElement('div');
      root.id = 'houseHelper';
      root.dataset.mood = 'idle';
      root.setAttribute('role', 'button');
      root.setAttribute('aria-label', 'طماطماية البيت الظريفة');
      root.innerHTML = `<div class="hh-bubble"></div>
        <div class="hh-tom">
          <div class="hh-stem"></div>
          <div class="hh-leaf l1"></div><div class="hh-leaf l2"></div>
          <div class="hh-body"></div><div class="hh-shine"></div>
          <div class="hh-eye l"></div><div class="hh-eye r"></div>
          <div class="hh-cheek l"></div><div class="hh-cheek r"></div>
          <div class="hh-mouth"></div>
          <div class="hh-arm l"></div><div class="hh-arm r"></div>
          <div class="hh-foot l"></div><div class="hh-foot r"></div>
          <div class="hh-zzz">Z</div>
        </div>`;
      document.body.appendChild(root);

      const menu = document.createElement('div');
      menu.id = 'hhMenu';
      menu.innerHTML = `<div class="hh-m-title">🍅 طماطماية البيت</div>
        <button data-hact="sound"><span>🔊</span><span>الصوت: يعمل</span></button>
        <button data-hact="hide" class="danger"><span>🙈</span><span>إخفاء المساعد</span></button>
        <button data-hact="close"><span>✕</span><span>إغلاق</span></button>
        <div class="hh-m-note">للإظهار مجددًا:<br>الإعدادات ← مساعد البيت الظريف</div>`;
      document.body.appendChild(menu);

      this.root = root;
      this.bubble = root.querySelector('.hh-bubble');
      this.menu = menu;
      this._place();
      this._bindDrag();
      this._bindMenu();
      this._startWander();
      root.addEventListener('click', () => {
        if (this._moved || this._lpFired) { this._lpFired = false; return; }
        this.tap();
      });
    },

    _place() {
      const s = CharacterSettings.load();
      if (s.pos && typeof s.pos.x === 'number') {
        this.root.style.left = s.pos.x + 'px';
        this.root.style.top = s.pos.y + 'px';
        this.root.style.bottom = 'auto';
      } else {
        const spots = prettySpots();
        const p = spots[0];
        this.root.style.left = p.x + 'px';
        this.root.style.top = p.y + 'px';
        this.root.style.bottom = 'auto';
        this.spotIdx = 0;
      }
      this.applySettings();
    },

    _startWander() {
      clearInterval(this.wanderTimer);
      this.wanderTimer = setInterval(() => {
        try {
          const s = CharacterSettings.load();
          if (!s.show || s.pos) return;
          if (document.hidden) return;
          if (this.bubble && this.bubble.classList.contains('show')) return;
          if (this.menu && this.menu.classList.contains('open')) return;
          if (CharacterState.mood !== 'idle') return;
          if (Date.now() - CharacterState.lastAuto < 20000) return;
          const spots = prettySpots();
          let n;
          do { n = Math.floor(Math.random() * spots.length); } while (n === this.spotIdx && spots.length > 1);
          this.spotIdx = n;
          this.root.classList.add('gliding');
          this.root.style.left = spots[n].x + 'px';
          this.root.style.top = spots[n].y + 'px';
          this.root.style.bottom = 'auto';
          setTimeout(() => this.root && this.root.classList.remove('gliding'), 1000);
        } catch {}
      }, CharacterState.WANDER_MS);
    },

    applySettings() {
      const s = CharacterSettings.load();
      if (!this.root) return;
      this.root.classList.toggle('hidden', !s.show);
      if (!s.show) this.hideMenu();
      const sb = this.menu && this.menu.querySelector('[data-hact="sound"] span:last-child');
      if (sb) {
        sb.textContent = s.sound ? 'الصوت: يعمل' : 'الصوت: متوقف';
        const ic = this.menu.querySelector('[data-hact="sound"] span:first-child');
        if (ic) ic.textContent = s.sound ? '🔊' : '🔇';
      }
    },

    /* قائمة الضغطة المطولة */
    showMenu() {
      if (!this.menu || !this.root) return;
      const r = this.root.getBoundingClientRect();
      this.menu.classList.add('open');
      const mw = 200, mh = 230;
      let x = Math.min(Math.max(8, r.left + r.width / 2 - mw / 2), window.innerWidth - mw - 8);
      let y = r.top - mh - 8;
      if (y < 8) y = Math.min(window.innerHeight - mh - 8, r.bottom + 8);
      this.menu.style.left = x + 'px';
      this.menu.style.top = Math.max(8, y) + 'px';
      this.applySettings();
    },
    hideMenu() {
      if (this.menu) this.menu.classList.remove('open');
      if (this._away) { document.removeEventListener('pointerdown', this._away, true); this._away = null; }
    },
    _bindMenu() {
      this.menu.querySelector('[data-hact="hide"]').onclick = () => {
        CharacterSettings.save({ show: false });
        setAppFlag('_charShow', false);
        this.hideMenu();
        this.applySettings();
        this.say('', null);
      };
      this.menu.querySelector('[data-hact="sound"]').onclick = () => {
        const on = !CharacterSettings.get('sound');
        CharacterSettings.save({ sound: on });
        setAppFlag('_charSound', on);
        this.applySettings();
      };
      this.menu.querySelector('[data-hact="close"]').onclick = () => this.hideMenu();
      this._away = (e) => {
        if (this.menu && !this.menu.contains(e.target) && !this.root.contains(e.target)) this.hideMenu();
      };
      document.addEventListener('pointerdown', (e) => {
        if (this.menu && this.menu.classList.contains('open') && !this.menu.contains(e.target) && !this.root.contains(e.target)) this.hideMenu();
      }, true);
    },

    _bindDrag() {
      const el = this.root;
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false, lpTimer = null;
      this._moved = false; this._lpFired = false;
      const cancelLp = () => { if (lpTimer) { clearTimeout(lpTimer); lpTimer = null; } };
      el.addEventListener('pointerdown', (e) => {
        dragging = true; this._moved = false; this._lpFired = false;
        sx = e.clientX; sy = e.clientY;
        const r = el.getBoundingClientRect();
        ox = r.left; oy = r.top;
        try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch {}
        cancelLp();
        lpTimer = setTimeout(() => {
          lpTimer = null;
          if (!dragging || this._moved) return;
          dragging = false;
          this._lpFired = true;
          try { navigator.vibrate && navigator.vibrate(30); } catch {}
          this.showMenu();
          CharacterAnimation.el = this.root;
          CharacterAnimation.play('surprise', 1200);
          setTimeout(() => { this._lpFired = false; }, 400);
        }, CharacterState.LONGPRESS_MS);
      });
      el.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 10) { this._moved = true; cancelLp(); }
        if (!this._moved) return;
        el.classList.remove('gliding');
        const nx = Math.min(Math.max(4, ox + dx), window.innerWidth - el.offsetWidth - 4);
        const ny = Math.min(Math.max(4, oy + dy), window.innerHeight - el.offsetHeight - 4);
        el.style.left = nx + 'px'; el.style.top = ny + 'px'; el.style.bottom = 'auto';
      });
      const end = () => {
        if (!dragging && !lpTimer) return;
        cancelLp();
        if (!dragging) return;
        dragging = false;
        if (this._moved) {
          const r = el.getBoundingClientRect();
          CharacterSettings.save({ pos: { x: Math.round(r.left), y: Math.round(r.top) } });
          setTimeout(() => { this._moved = false; }, 50);
        }
      };
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', () => { cancelLp(); dragging = false; });
    },

    say(text, mood, ms) {
      if (!this.root || !CharacterSettings.get('show')) return;
      if (text && CharacterSettings.get('talk')) {
        this.bubble.textContent = text;
        this.bubble.classList.add('show');
        clearTimeout(this.hideTimer);
        this.hideTimer = setTimeout(() => this.bubble.classList.remove('show'), ms || CharacterState.BUBBLE_MS);
      }
      if (mood) { CharacterAnimation.el = this.root; CharacterAnimation.play(mood); }
      blip();
    },

    _autoOk() {
      return Date.now() - CharacterState.lastAuto > CharacterState.AUTO_GAP;
    },
    _markAuto() { CharacterState.lastAuto = Date.now(); },

    notify(ev, data) {
      if (!this.root || !CharacterSettings.get('show')) return;
      data = data || {};
      if (['NEW_REQUEST', 'SEND', 'COMPLETE', 'ALL_DONE'].includes(ev)) {
        if (!this._autoOk()) return;
        this._markAuto();
      }
      if (ev === 'NEW_REQUEST') {
        let pool = 'NEW_REQUEST';
        try {
          const app = JSON.parse(localStorage.getItem('baytna_v2') || 'null');
          const viewerRole = (app && app.user && app.user.role) || data.role || '';
          const senderIsPartner = data.by && app && app.user && data.by !== app.user.name;
          if (CharacterSettings.get('roleJokes') && senderIsPartner && (viewerRole === 'husband' || viewerRole === 'wife')) {
            pool = viewerRole === 'husband' ? 'ROLE_WIFE_SENT' : 'ROLE_HUSBAND_SENT';
          }
        } catch {}
        this.say(CharacterDialog.pick(pool), MOOD_FOR.NEW_REQUEST);
      }
      else if (ev === 'SEND') this.say(CharacterDialog.pick('SEND'), MOOD_FOR.SEND);
      else if (ev === 'ACCEPT') this.say(CharacterDialog.pick('ACCEPT'), MOOD_FOR.ACCEPT);
      else if (ev === 'COMPLETE') this.say(CharacterDialog.pick('COMPLETE'), MOOD_FOR.COMPLETE);
      else if (ev === 'ALL_DONE') this.say(CharacterDialog.pick('ALL_DONE'), MOOD_FOR.ALL_DONE);
    },

    tap() {
      if (Date.now() - CharacterState.lastTap < 2500) return;
      CharacterState.lastTap = Date.now();
      const moods = ['happy', 'laugh', 'surprise', 'think', 'celebrate', 'confused'];
      const mood = moods[Math.floor(Math.random() * moods.length)];
      const text = Math.random() < 0.22 ? '' : CharacterDialog.pick('TAP');
      this.say(text, mood === 'happy' && !text ? 'laugh' : mood);
    },

    test() {
      this.say(CharacterDialog.pick('WELCOME'), 'celebrate', 5000);
    },

    _snap: null,
    watch() {
      let app = null;
      try { app = JSON.parse(localStorage.getItem('baytna_v2') || 'null'); } catch {}
      if (!app || !app.initialized) return;
      const orders = app.orders || [];
      const prev = this._snap;
      const ids = orders.map(o => o && o.id).filter(Boolean);
      const pending = orders.filter(o => o && o.status !== 'purchased');
      if (!prev) {
        this._snap = { ids, pending: pending.length };
        if (!CharacterState.welcomed && CharacterSettings.get('show')) {
          CharacterState.welcomed = true;
          setTimeout(() => { if (this._autoOk()) { this._markAuto(); this.say(CharacterDialog.pick('WELCOME'), 'happy', 5000); } }, 2500);
        }
        return;
      }
      const prevIds = new Set(prev.ids);
      const fresh = orders.filter(o => o && o.id && !prevIds.has(o.id) && o.status !== 'purchased');
      if (fresh.length && this._autoOk()) {
        const me = app.user && app.user.name;
        const fromPartner = fresh.find(o => o.createdBy && me && o.createdBy !== me);
        this._markAuto();
        if (fromPartner && CharacterSettings.get('roleJokes')) {
          const vr = app.user && app.user.role;
          const pool = vr === 'husband' ? 'ROLE_WIFE_SENT' : vr === 'wife' ? 'ROLE_HUSBAND_SENT' : 'NEW_REQUEST';
          this.say(CharacterDialog.pick(pool), 'surprise');
        } else {
          this.say(CharacterDialog.pick('NEW_REQUEST'), 'happy');
        }
      }
      if (prev.pending > 0 && pending.length === 0 && this._autoOk()) {
        this._markAuto();
        this.say(CharacterDialog.pick('ALL_DONE'), 'celebrate', 5500);
      }
      if (pending.length >= CharacterState.MANY_AT && prev.pending < CharacterState.MANY_AT && this._autoOk()) {
        this._markAuto();
        this.say(CharacterDialog.pick('MANY'), 'confused', 5500);
      }
      if (pending.length === 0 && prev.pending === 0 && !this._snap.emptySaid && orders.length === 0) {
        this._snap.emptySaid = true;
        if (this._autoOk()) { this._markAuto(); this.say(CharacterDialog.pick('EMPTY'), 'sleep', 5000); }
      }
      if (this._autoOk()) {
        const now = Date.now();
        const old = pending.find(o => {
          try {
            const t = new Date(o.createdAt).getTime();
            return now - t > CharacterState.DELAY_MS && !CharacterState.seenDelay[o.id];
          } catch { return false; }
        });
        if (old) {
          CharacterState.seenDelay[old.id] = 1;
          this._markAuto();
          this.say(CharacterDialog.pick('DELAY'), 'waiting', 5500);
        }
      }
      this._snap = { ids, pending: pending.length, emptySaid: this._snap.emptySaid };
    },

    boot() {
      CharacterSettings.load();
      const start = () => { this.mount(); setInterval(() => { try { this.watch(); } catch {} }, 2500); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
      else start();
    }
  };

  window.Character = CharacterController;
  window.CharacterState = CharacterState;
  window.CharacterAnimation = CharacterAnimation;
  window.CharacterDialog = CharacterDialog;
  window.CharacterSettings = CharacterSettings;
  window.CharacterController = CharacterController;
  CharacterController.boot();
})();
