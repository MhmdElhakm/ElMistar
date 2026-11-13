/* ======================================================================
 * Huda هدى — app.js
 * كل منطق التطبيق في ملف واحد. الأقسام بالترتيب الأصلي للتنفيذ (لا تغيّره):
 *   1) فايربيس / HudaCloud
 *   2) المهام اليومية (Tasks)
 *   3) دليل التجويد ومحلل الآيات
 *   4) المصحف الرئيسي (MushafRuntime)
 *   5) الخدمات المدمجة
 *   6) مواقيت الصلاة
 *   7) واجهة العبادة
 *   8) الأوفلاين وPWA
 * يعتمد على data.js (يُحمَّل قبله). كل قسم دالة IIFE مستقلة لا تتشارك متغيراتها.
 * ====================================================================== */

/* ======================================================================
 * 1. فايربيس / HudaCloud
 * لوحة المتصدرين التلقائية: دخول مجهول دون تسجيل، ومزامنة النقاط عند توفر الإنترنت فقط.
 * ====================================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
   * HudaCloud: لوحة المتصدرين التلقائية.
   *
   * المبادئ:
   *  1) لا تسجيل ولا كلمة مرور: يُنشأ حساب Firebase مجهول (Anonymous) تلقائيًا ويبقى على الجهاز.
   *  2) لا شيء يُرسل ولا يُحمَّل إلا عند توفر الإنترنت. دون إنترنت يعمل التطبيق محليًا بالكامل،
   *     وتبقى آخر نسخة من الترتيب محفوظة لتُعرض.
   *  3) مكتبات Firebase تُحمَّل عند الحاجة فقط (وليس بوسوم <script> ثابتة) فيتعافى التطبيق وحده
   *     إذا فُتح دون اتصال ثم عاد الإنترنت.
   *  4) أحدث حالة فقط تُرسل (دمج الطلبات)، وعند فشل الشبكة تُعاد المحاولة بتأخير متزايد.
   * ------------------------------------------------------------------- */
  var SDK_VERSION = '10.12.2';
  var SDK_URLS = ['app', 'auth', 'firestore'].map(function (name) {
    return 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/firebase-' + name + '-compat.js';
  });
  var firebaseConfig = {
    apiKey: 'AIzaSyCM41g90JX0Q0L9tBDrGO2VkqltRJmk9_M',
    authDomain: 'qurany-pro.firebaseapp.com',
    projectId: 'qurany-pro',
    storageBucket: 'qurany-pro.firebasestorage.app',
    messagingSenderId: '363693622415',
    appId: '1:363693622415:web:9eb88d7cb6690a09a3dcfa',
    measurementId: 'G-68ZJF1KWDK'
  };
  var BOARD_CACHE_KEY = 'huda.leaderboardCache.v1';
  var BOARD_LIMIT = 30;
  var SYNC_DEBOUNCE_MS = 700;
  var RETRY_DELAYS_MS = [4000, 12000, 30000, 90000, 300000];

  function isOnline() {
    return navigator.onLine !== false;
  }
  function toDigits(value) {
    return String(value).replace(/\d/g, function (digit) {
      return '٠١٢٣٤٥٦٧٨٩'[digit];
    });
  }
  /* اسم تلقائي ثابت لكل جهاز مشتق من معرّف الحساب المجهول، يُستخدم حتى يختار المستخدم اسمه */
  function autoNameFor(uid) {
    var hash = 0;
    for (var i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) >>> 0;
    return 'ضيف هدى ' + toDigits((hash % 9000) + 1000);
  }
  function safeAvatar(value) {
    return typeof value === 'string' && value.indexOf('data:image/') === 0 && value.length <= 150000 ? value : '';
  }
  function readBoardCache() {
    try {
      var list = JSON.parse(localStorage.getItem(BOARD_CACHE_KEY) || '[]');
      return Array.isArray(list) ? list.slice(0, BOARD_LIMIT) : [];
    } catch (error) {
      return [];
    }
  }
  function writeBoardCache(list) {
    try {
      // الصور المضمَّنة كبيرة؛ لا تُحفظ في نسخة الأوفلاين.
      localStorage.setItem(
        BOARD_CACHE_KEY,
        JSON.stringify(
          list.map(function (entry) {
            return {
              id: entry.id,
              name: entry.name,
              points: entry.points,
              avatar: entry.avatar && entry.avatar.indexOf('data:') === 0 ? './logo.png' : entry.avatar
            };
          })
        )
      );
    } catch (error) {
      /* التخزين ممتلئ أو معطّل: تُهمل النسخة المحفوظة فقط */
    }
  }

  var cloud = {
    user: null,
    online: isOnline(),
    connected: false,
    autoName: '',
    leaderboard: readBoardCache(),
    pending: null,
    queueSync: queueSync
  };
  window.HudaCloud = cloud;

  var auth = null,
    db = null,
    connecting = null,
    sdkPromise = null,
    unsubscribeBoard = null,
    syncTimer = 0,
    retryTimer = 0,
    retryStep = 0,
    syncing = false,
    version = 0;

  function notify() {
    window.dispatchEvent(new CustomEvent('huda-leaderboard-changed'));
  }

  var loadedScripts = Object.create(null);
  function loadScript(src) {
    if (loadedScripts[src]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      var timer = setTimeout(function () {
        script.remove();
        reject(new Error('انتهت مهلة تحميل ' + src));
      }, 20000);
      script.src = src;
      script.async = false;
      script.onload = function () {
        clearTimeout(timer);
        loadedScripts[src] = true;
        resolve();
      };
      script.onerror = function () {
        clearTimeout(timer);
        script.remove();
        reject(new Error('تعذر تحميل ' + src));
      };
      document.head.appendChild(script);
    });
  }
  function loadSdk() {
    if (window.firebase && firebase.auth && firebase.firestore) return Promise.resolve();
    if (!sdkPromise) {
      sdkPromise = SDK_URLS.reduce(function (chain, url) {
        return chain.then(function () {
          return loadScript(url);
        });
      }, Promise.resolve()).catch(function (error) {
        sdkPromise = null;
        throw error;
      });
    }
    return sdkPromise;
  }

  /* الاتصال: تحميل المكتبات ← دخول مجهول (أو استعادة الحساب المحفوظ) ← بدء متابعة الترتيب */
  function connect() {
    if (!isOnline()) return Promise.reject(new Error('لا يوجد اتصال بالإنترنت'));
    if (connecting) return connecting;
    connecting = loadSdk()
      .then(function () {
        if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        db = firebase.firestore();
        return new Promise(function (resolve, reject) {
          var unsubscribe = auth.onAuthStateChanged(function (user) {
            unsubscribe();
            resolve(user);
          }, reject);
        });
      })
      .then(function (user) {
        return (
          user ||
          auth.signInAnonymously().then(function (result) {
            return result.user;
          })
        );
      })
      .then(function (user) {
        cloud.user = user;
        cloud.autoName = autoNameFor(user.uid);
        cloud.connected = true;
        retryStep = 0;
        startBoard();
        notify();
        return user;
      })
      .catch(function (error) {
        connecting = null;
        cloud.connected = false;
        console.warn('تعذر الاتصال بلوحة المتصدرين؛ ستُعاد المحاولة تلقائيًا.', error);
        scheduleRetry();
        throw error;
      });
    return connecting;
  }

  function scheduleRetry() {
    if (retryTimer || !isOnline()) return;
    var delay = RETRY_DELAYS_MS[Math.min(retryStep, RETRY_DELAYS_MS.length - 1)];
    retryStep++;
    retryTimer = setTimeout(function () {
      retryTimer = 0;
      connect().then(flush, function () {});
    }, delay);
  }

  function startBoard() {
    if (unsubscribeBoard || !db || !isOnline()) return;
    unsubscribeBoard = db
      .collection('leaderboard')
      .orderBy('totalPoints', 'desc')
      .limit(BOARD_LIMIT)
      .onSnapshot(
        function (snapshot) {
          var uid = cloud.user && cloud.user.uid;
          cloud.leaderboard = snapshot.docs.map(function (item) {
            var data = item.data() || {};
            return {
              id: item.id,
              name: String(data.name || 'مستخدم هدى').slice(0, 80),
              points: Number(data.totalPoints) || 0,
              avatar: safeAvatar(data.avatar) || './logo.png',
              isYou: item.id === uid
            };
          });
          writeBoardCache(cloud.leaderboard);
          notify();
        },
        function (error) {
          console.warn('تعذرت قراءة لوحة المتصدرين من Firestore.', error);
          stopBoard();
        }
      );
  }
  function stopBoard() {
    if (unsubscribeBoard) {
      unsubscribeBoard();
      unsubscribeBoard = null;
    }
  }

  /* استقبال أحدث حالة من واجهة المهام (يُستدعى عند كل حفظ). لا يُرسل شيء قبل توفر الإنترنت. */
  function queueSync(state) {
    var profile = (state && state.profile) || {};
    cloud.pending = {
      name: String(profile.name || '').trim().slice(0, 80),
      avatar: safeAvatar(profile.avatar),
      points: Math.max(0, Math.floor(Number(profile.totalPoints) || 0)),
      phone: profile.phoneVisibility === 'public' ? String(profile.phone || '').slice(0, 24) : '',
      phoneVisibility: profile.phoneVisibility === 'public' ? 'public' : 'private',
      show: profile.showOnLeaderboard !== false
    };
    version++;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () {
      flush();
      if (cloud.account) cloud.syncAccount();
    }, SYNC_DEBOUNCE_MS);
  }

  function flush() {
    if (!cloud.pending || syncing || !isOnline()) return Promise.resolve();
    var job = cloud.pending,
      sentVersion = version;
    syncing = true;
    return connect()
      .then(function (user) {
        var userRef = db.collection('users').doc(user.uid);
        var boardRef = db.collection('leaderboard').doc(user.uid);
        var stamp = firebase.firestore.FieldValue.serverTimestamp();
        var batch = db.batch();
        batch.set(
          userRef,
          {
            name: job.name,
            avatar: job.avatar,
            totalPoints: job.points,
            phone: job.phone,
            phoneVisibility: job.phoneVisibility,
            publicProfile: job.show,
            anonymous: user.isAnonymous === true,
            updatedAt: stamp
          },
          { merge: true }
        );
        if (job.show) {
          batch.set(
            boardRef,
            {
              name: job.name || autoNameFor(user.uid),
              auto: !job.name,
              avatar: job.avatar,
              totalPoints: job.points,
              updatedAt: stamp
            },
            { merge: true }
          );
        } else {
          batch.delete(boardRef);
        }
        return batch.commit();
      })
      .then(function () {
        if (version === sentVersion) cloud.pending = null;
        retryStep = 0;
      })
      .catch(function (error) {
        console.warn('تعذرت مزامنة بيانات هدى؛ ستُعاد المحاولة عند توفر الاتصال.', error);
        scheduleRetry();
      })
      .then(function () {
        syncing = false;
        if (cloud.pending && version !== sentVersion) return flush();
      });
  }


  /* ===================== الحساب برقم الهاتف فقط + نسخة كاملة من بيانات التقدم في Firestore =====================
   * accounts/{phoneHash}   مستند الحساب (معرّفه بصمة الرقم SHA-256): الهاتف، وكل بيانات التقدم مضغوطة. يقرؤه صاحبه فقط.
   * phoneIndex/{phoneHash} مؤشر وجود الحساب (دون أي بيانات) ليعرف الجهاز هل الرقم مسجَّل أم جديد.
   * رقم واحد = حساب واحد. لا اسم ولا كلمة مرور: يُدخل المستخدم رقمه فيُنشأ الحساب أو يُفتح.
   * تنبيه أمني: الدخول بالرقم دون رمز تحقق (OTP) — من يعرف الرقم يستطيع الدخول لحسابه.
   * ------------------------------------------------------------------------------------------- */
  var ACCOUNT_KEY = 'huda.account';
  var ACCOUNT_SYNC_MS = 60000;
  var ACCOUNT_MAX_CHARS = 800000;

  function isAppDataKey(key) {
    return (
      key === 'quran_tasks_v1' ||
      key === 'baytna_v2' ||
      (key.indexOf('mq.') === 0 && key !== 'mq.offlineReady' && key !== 'mq.pagesPreparedV2') ||
      key.indexOf('quran_') === 0 ||
      key.indexOf('tq_') === 0
    );
  }
  function readAccount() {
    try {
      var value = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || 'null');
      return value && value.id && value.phoneHash ? value : null;
    } catch (error) {
      return null;
    }
  }
  function writeAccount(account) {
    try {
      if (account) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
      else localStorage.removeItem(ACCOUNT_KEY);
    } catch (error) {
      /* التخزين معطّل */
    }
    cloud.account = account;
    notify();
  }
  function phoneDigits(phone) {
    var latin = String(phone || '').replace(/[٠-٩]/g, function (d) {
      return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
    });
    return latin.replace(/\D/g, '').replace(/^00/, '');
  }
  /* نوحّد الرقم على آخر ٩ أرقام ليتطابق 010… مع +20 10… */
  function phoneKey(phone) {
    var digits = phoneDigits(phone);
    if (digits.length < 7) return '';
    return digits.slice(-9);
  }
  function sha256Hex(text) {
    var bytes = new TextEncoder().encode(text);
    return crypto.subtle.digest('SHA-256', bytes).then(function (buffer) {
      return Array.prototype.map
        .call(new Uint8Array(buffer), function (b) {
          return ('0' + b.toString(16)).slice(-2);
        })
        .join('');
    });
  }
  function hashPhone(phone) {
    var key = phoneKey(phone);
    if (!key) return Promise.reject(new Error('أدخل رقم هاتف صحيحًا (٧ أرقام على الأقل).'));
    return sha256Hex('huda-phone:' + key);
  }
  function collectAppData() {
    var data = {};
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && isAppDataKey(key)) data[key] = localStorage.getItem(key);
    }
    return JSON.stringify(data);
  }
  function toBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(binary);
  }
  function fromBase64(text) {
    var binary = atob(text),
      bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function pipeThrough(bytes, stream) {
    return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function (b) {
      return new Uint8Array(b);
    });
  }
  function packData(json) {
    var raw = new TextEncoder().encode(json);
    if (typeof CompressionStream === 'undefined')
      return Promise.resolve({ enc: 'raw', data: toBase64(raw) });
    return pipeThrough(raw, new CompressionStream('gzip')).then(function (zipped) {
      return { enc: 'gz', data: toBase64(zipped) };
    });
  }
  function unpackData(enc, text) {
    var bytes = fromBase64(text);
    if (enc !== 'gz') return Promise.resolve(new TextDecoder().decode(bytes));
    return pipeThrough(bytes, new DecompressionStream('gzip')).then(function (out) {
      return new TextDecoder().decode(out);
    });
  }

  cloud.account = readAccount();
  var accountSyncing = false,
    lastAccountPayload = '',
    accountTimer = 0;

  function needOnline() {
    if (!isOnline()) return Promise.reject(new Error('هذه الخطوة تحتاج اتصالًا بالإنترنت.'));
    return connect();
  }
  function stamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
  }
  function accountError(error) {
    var code = error && error.code;
    if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed')
      return new Error('فعّل «Anonymous» من Firebase Console ← Authentication ← Sign-in method، ثم أعد المحاولة.');
    if (code === 'permission-denied')
      return new Error('رفضت قاعدة البيانات العملية؛ تأكد من نشر قواعد firestore.rules الجديدة.');
    return error instanceof Error ? error : new Error('تعذرت العملية؛ حاول مرة أخرى.');
  }

  /* هل الرقم مسجَّل؟ (مؤشر الوجود فقط، دون قراءة بيانات الحساب) */
  function checkPhone(phone) {
    return hashPhone(phone)
      .then(function (hash) {
        return needOnline().then(function () {
          return db.collection('phoneIndex').doc(hash).get();
        });
      })
      .then(function (doc) {
        return !!doc.exists;
      })
      .catch(function (error) {
        throw accountError(error);
      });
  }

  /* إنشاء حساب جديد بالرقم وحفظ بيانات الجهاز الحالية فيه */
  function registerAccount(phone) {
    var phoneHash;
    return hashPhone(phone)
      .then(function (hash) {
        phoneHash = hash;
        return needOnline();
      })
      .then(function (user) {
        return packData(collectAppData()).then(function (packed) {
          if (packed.data.length > ACCOUNT_MAX_CHARS)
            throw new Error('حجم بياناتك كبير جدًا للحفظ السحابي؛ احذف بعض التعليقات أو العلامات.');
          var shown = String(phone).trim().slice(0, 24);
          var batch = db.batch();
          batch.set(db.collection('accounts').doc(phoneHash), {
            ownerUid: user.uid,
            phone: shown,
            phoneHash: phoneHash,
            enc: packed.enc,
            data: packed.data,
            updatedAt: stamp()
          });
          batch.set(db.collection('phoneIndex').doc(phoneHash), {
            ownerUid: user.uid,
            updatedAt: stamp()
          });
          return batch.commit().then(function () {
            lastAccountPayload = packed.data;
            var account = { id: phoneHash, phone: shown, phoneHash: phoneHash };
            writeAccount(account);
            return account;
          });
        });
      })
      .catch(function (error) {
        throw accountError(error);
      });
  }

  /* استلام ملكية الحساب لهذا الجهاز (بعد معرفة الرقم) */
  function claimAccount(id, phone) {
    var phoneHash;
    return hashPhone(phone)
      .then(function (hash) {
        phoneHash = hash;
        return needOnline();
      })
      .then(function (user) {
        var batch = db.batch();
        batch.update(db.collection('accounts').doc(id), {
          ownerUid: user.uid,
          claimPhoneHash: phoneHash
        });
        if (id === phoneHash) batch.update(db.collection('phoneIndex').doc(phoneHash), { ownerUid: user.uid });
        return batch.commit().then(function () {
          return { user: user, phoneHash: phoneHash };
        });
      });
  }

  /* دخول بالرقم: يستبدل بيانات الجهاز بنسخة الحساب */
  function loginAccount(phone) {
    var id;
    return hashPhone(phone)
      .then(function (hash) {
        id = hash;
        return claimAccount(id, phone);
      })
      .then(function (claim) {
        return db
          .collection('accounts')
          .doc(id)
          .get()
          .then(function (doc) {
            if (!doc.exists) throw new Error('الحساب غير موجود.');
            var info = doc.data() || {};
            return unpackData(info.enc, info.data || '').then(function (json) {
              var data = JSON.parse(json);
              if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('بيانات الحساب تالفة.');
              var keys = Object.keys(data).filter(function (k) {
                return isAppDataKey(k) && typeof data[k] === 'string';
              });
              // استبدال بيانات هذا الجهاز ببيانات الحساب
              var old = [];
              for (var i = 0; i < localStorage.length; i++) {
                var k = localStorage.key(i);
                if (k && isAppDataKey(k)) old.push(k);
              }
              old.forEach(function (k) {
                localStorage.removeItem(k);
              });
              keys.forEach(function (k) {
                localStorage.setItem(k, data[k]);
              });
              writeAccount({
                id: id,
                phone: String(info.phone || phone).slice(0, 24),
                phoneHash: claim.phoneHash
              });
              return true;
            });
          });
      })
      .catch(function (error) {
        throw accountError(error);
      });
  }

  function deleteAccountById(id, phone) {
    return claimAccount(id, phone)
      .then(function (claim) {
        var batch = db.batch();
        batch.delete(db.collection('accounts').doc(id));
        if (id === claim.phoneHash) batch.delete(db.collection('phoneIndex').doc(claim.phoneHash));
        else batch.delete(db.collection('phoneIndex').doc(claim.phoneHash).collection('accounts').doc(id));
        return batch.commit().then(function () {
          if (cloud.account && cloud.account.id === id) {
            lastAccountPayload = '';
            writeAccount(null);
          }
        });
      })
      .catch(function (error) {
        throw accountError(error);
      });
  }

  function logoutAccount() {
    lastAccountPayload = '';
    writeAccount(null);
  }

  /* رفع أحدث نسخة من بيانات الجهاز إلى الحساب (عند توفر الإنترنت وعند وجود تغيير فقط) */
  function syncAccount(force) {
    var account = cloud.account;
    if (!account || accountSyncing || !isOnline()) return Promise.resolve(false);
    var json = collectAppData();
    accountSyncing = true;
    return packData(json)
      .then(function (packed) {
        if (!force && packed.data === lastAccountPayload) return false;
        if (packed.data.length > ACCOUNT_MAX_CHARS) {
          console.warn('بيانات الحساب أكبر من الحد المسموح؛ لم تُرفع.');
          return false;
        }
        return connect().then(function () {
          var batch = db.batch();
          batch.update(db.collection('accounts').doc(account.id), {
            enc: packed.enc,
            data: packed.data,
            updatedAt: stamp()
          });
          return batch.commit().then(function () {
            lastAccountPayload = packed.data;
            return true;
          });
        });
      })
      .catch(function (error) {
        console.warn('تعذرت مزامنة الحساب؛ ستُعاد المحاولة.', error);
        return false;
      })
      .then(function (result) {
        accountSyncing = false;
        return result;
      });
  }
  function startAccountSync() {
    clearInterval(accountTimer);
    accountTimer = setInterval(function () {
      if (cloud.account && !document.hidden) syncAccount();
    }, ACCOUNT_SYNC_MS);
  }
  startAccountSync();
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && cloud.account) syncAccount();
  });
  window.addEventListener('online', function () {
    if (cloud.account) setTimeout(syncAccount, 1500);
  });

  cloud.registerAccount = registerAccount;
  cloud.checkPhone = checkPhone;
  cloud.loginAccount = loginAccount;
  cloud.deleteAccount = deleteAccountById;
  cloud.logoutAccount = logoutAccount;
  cloud.syncAccount = syncAccount;

  window.addEventListener('online', function () {
    cloud.online = true;
    retryStep = 0;
    clearTimeout(retryTimer);
    retryTimer = 0;
    connect().then(function () {
      startBoard();
      return flush();
    }, function () {});
    notify();
  });
  window.addEventListener('offline', function () {
    cloud.online = false;
    stopBoard();
    notify();
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && cloud.pending) flush();
  });

  // بدء الاتصال بهدوء إن كان الإنترنت متاحًا؛ وإلا ننتظر حدث online.
  if (isOnline()) {
    var start = function () {
      setTimeout(function () {
        connect().then(flush, function () {});
      }, 1500);
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start);
  }
})();


/* ======================================================================
 * 2. المهام اليومية (Tasks)
 * واجهة المهام والنقاط والإنجازات داخل Shadow DOM (كان tasks.js).
 * ====================================================================== */
(() => {
  'use strict';

  const host = document.getElementById('tasksApp');
  if (!host) return;
  const root = host.attachShadow({ mode: 'open' });
  const backupHost = document.getElementById('settingsBackupHost');
  const storageKey = 'quran_tasks_v1';
  const taskCompletionSound = new Audio('./note.mp3');
  taskCompletionSound.preload = 'auto';
  function playTaskCompletionSound() {
    taskCompletionSound.currentTime = 0;
    const playback = taskCompletionSound.play();
    if (playback && typeof playback.catch === 'function')
      playback.catch(error => {
        console.error('تعذر تشغيل صوت إكمال المهمة.', error);
        if (window.MushafRuntime && window.MushafRuntime.toast) {
          window.MushafRuntime.toast('تعذر تشغيل صوت إكمال المهمة.');
        }
      });
  }
  const days = [
    { value: 6, label: 'السبت' },
    { value: 0, label: 'الأحد' },
    { value: 1, label: 'الاثنين' },
    { value: 2, label: 'الثلاثاء' },
    { value: 3, label: 'الأربعاء' },
    { value: 4, label: 'الخميس' },
    { value: 5, label: 'الجمعة' }
  ];
  const defaultTaskSections = [
    {
      key: 'fajr',
      category: 'الفجر',
      icon: 'mosque',
      tasks: [
        ['أذكار الاستيقاظ', 1],
        ['السنة القبلية', 2],
        ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1],
        ['أذكار الصباح', 2],
        ['الضحى ٤ ركعات', 2]
      ]
    },
    {
      key: 'duhr',
      category: 'الظهر',
      icon: 'mosque',
      tasks: [
        ['السنة القبلية ٤ ركعات', 2],
        ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1],
        ['السنة البعدية', 2]
      ]
    },
    {
      key: 'asr',
      category: 'العصر',
      icon: 'mosque',
      tasks: [
        ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1],
        ['أذكار المساء', 2]
      ]
    },
    {
      key: 'magh',
      category: 'المغرب',
      icon: 'mosque',
      tasks: [
        ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1],
        ['السنة البعدية', 2]
      ]
    },
    {
      key: 'isha',
      category: 'العشاء',
      icon: 'mosque',
      tasks: [
        ['الجماعة الأولى', 2],
        ['أذكار بعد الصلاة', 1],
        ['السنة البعدية', 2]
      ]
    },
    {
      key: 'qiyam',
      category: 'قيام الليل والوتر',
      icon: 'moon',
      tasks: [
        ['ركعتان قيام ليل', 2],
        ['الوتر', 2]
      ]
    },
    {
      key: 'quran',
      category: 'الفجر',
      icon: 'book',
      tasks: [
        ['حفظ نصف صفحة', 2],
        ['الورد اليومي', 2]
      ]
    }
  ];
  const defaultTasks = defaultTaskSections.flatMap(section =>
    section.tasks.map((task, index) => ({
      id: 'daily-default-' + section.key + '-' + index,
      title: task[0],
      points: task[1],
      category: section.category,
      icon: section.icon,
      defaultTask: true,
      daily: true
    }))
  );
  // لقطة آمنة من حالة السحابة (قد لا تكون جاهزة أو الجهاز دون إنترنت).
  function cloudState() {
    const cloud = window.HudaCloud || {};
    return {
      online: navigator.onLine !== false,
      user: cloud.user || null,
      autoName: cloud.autoName || '',
      account: cloud.account || null,
      leaderboard: Array.isArray(cloud.leaderboard) ? cloud.leaderboard : []
    };
  }
  const defaultLeaderboard = [
    { name: 'قارئ مجتهد', points: 1200 },
    { name: 'محافظ على ورده', points: 950 },
    { name: 'طالب علم', points: 780 }
  ];
  const icons = [
    ['mosque', '🕌', 'صلاة'],
    ['sparkle', '📿', 'أذكار'],
    ['drop', '💧', 'مياه'],
    ['activity', '🏃', 'رياضة'],
    ['dumbbell', '💪', 'تمارين'],
    ['walk', '🚶', 'مشي'],
    ['book', '📖', 'قراءة'],
    ['moon', '🌙', 'نوم'],
    ['sun', '☀️', 'صباح'],
    ['leaf', '🥗', 'أكل صحي'],
    ['apple', '🍎', 'فاكهة'],
    ['pill', '💊', 'دواء'],
    ['heart', '❤️', 'صحة'],
    ['smile', '🙏', 'امتنان'],
    ['target', '🎯', 'هدف'],
    ['trophy', '🏆', 'إنجاز'],
    ['ban', '🚭', 'إقلاع'],
    ['flame', '🔥', 'حماس'],
    ['bolt', '⚡', 'طاقة'],
    ['star', '⭐', 'عام'],
    ['check', '✅', 'تم'],
    ['home', '🏠', 'بيت']
  ];
  const taskIconPaths = {
    mosque: '<path d="M3 20h18M5 20V10h14v10M8 10V7l4-3 4 3v3M10 20v-5h4v5M3 10l9-6 9 6"/>',
    sparkle:
      '<path d="M12 3 14 9l6 3-6 2-2 7-2-7-6-2 6-3 2-6Z"/><path d="m19 3 .7 2.3L22 6l-2.3.7L19 9l-.7-2.3L16 6l2.3-.7L19 3Z"/>',
    drop: '<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
    activity: '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
    dumbbell: '<path d="M6 9v6M3 10v4M18 9v6M21 10v4M6 12h12"/>',
    walk: '<circle cx="14" cy="5" r="2"/><path d="m12 9-3 4 3 2 1 5M12 10l4 3 3 1M9 13l-4 5M13 15l4 4"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6"/>',
    moon: '<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
    leaf: '<path d="M20 4c-9 0-15 3-15 10a6 6 0 0 0 6 6c7 0 10-7 9-16Z"/><path d="M5 20c3-5 7-8 12-11"/>',
    apple:
      '<path d="M12 8c-2-3-7-2-8 2-1 5 2 11 6 11 1 0 1.5-.5 2-.5s1 .5 2 .5c4 0 7-6 6-11-1-4-6-5-8-2Z"/><path d="M12 8c0-3 1-5 4-6-1 3-2 5-4 6Z"/>',
    pill: '<path d="M4.8 19.2a5 5 0 0 1 0-7.1l7.3-7.3a5 5 0 0 1 7.1 7.1l-7.3 7.3a5 5 0 0 1-7.1 0Z"/><path d="m8.3 8.6 7.1 7.1"/>',
    heart:
      '<path d="M20.8 8.8c0 5-8.8 11-8.8 11s-8.8-6-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z"/>',
    smile:
      '<path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/>',
    target:
      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m14 10 6-6m-4 0h4v4"/>',
    trophy:
      '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4m9-6h3v2a4 4 0 0 1-4 4"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
    flame:
      '<path d="M13 3c1 4-2 5-1 8 1-2 3-3 4-5 3 3 5 7 3 11a7.5 7.5 0 0 1-14-1c-1-4 1-8 5-11 0 4 1 5 2 6 1-3 2-5 1-8Z"/><path d="M10 17a2 2 0 0 0 4 0c0-1-1-2-2-3-1 1-2 2-2 3Z"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    check: '<path d="m5 12 4 4L19 6"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10"/>',
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-6v-7h-4v7H4a1 1 0 0 1-1-1V10Z"/>'
  };
  const taskIconSvg = (name, className) =>
    `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${taskIconPaths[name] || taskIconPaths.star}</svg>`;
  const esc = value =>
    String(value == null ? '' : value).replace(
      /[&<>"']/g,
      ch =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        })[ch]
    );
  const whatsappNumber = value =>
    String(value || '')
      .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit))
      .replace(/[^0-9]/g, '')
      .replace(/^00/, '');
  const whatsappHref = value => {
    const number = whatsappNumber(value);
    return number.length >= 7
      ? `https://wa.me/${number}?text=${encodeURIComponent('السلام عليكم، أتواصل معك من تطبيق Huda')}`
      : '';
  };
  const localDate = date => {
    const d = date || new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  };
  const validDays = values =>
    Array.isArray(values)
      ? [...new Set(values.map(Number).filter(value => Number.isInteger(value) && value >= 0 && value <= 6))]
      : [];
  const uid = () =>
    window.crypto && crypto.randomUUID
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
  const cleanTasks = value =>
    Array.isArray(value)
      ? value
          .filter(item => item && typeof item === 'object' && String(item.title || '').trim())
          .map(item =>
            Object.assign({}, item, {
              id: String(item.id || uid()),
              title: String(item.title).trim().slice(0, 120),
              done: item.done === true,
              points:
                Number.isInteger(Number(item.points)) &&
                Number(item.points) >= 0 &&
                Number(item.points) <= 100
                  ? Number(item.points)
                  : 0,
              days: validDays(item.days),
              hist: item.hist && typeof item.hist === 'object' ? item.hist : {}
            })
          )
      : [];
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
        phone: typeof (value && value.phone) === 'string' ? value.phone.slice(0, 24) : '',
        phoneVisibility: value && value.phoneVisibility === 'public' ? 'public' : 'private',
        showOnLeaderboard: !(value && value.showOnLeaderboard === false),
        avatar:
          typeof (value && value.avatar) === 'string' && value.avatar.indexOf('data:image/') === 0
            ? value.avatar
            : '',
        totalPoints:
          value && Number.isSafeInteger(Number(value.totalPoints)) && Number(value.totalPoints) >= 0
            ? Number(value.totalPoints)
            : (tasks || [])
                .filter(task => task.done)
                .reduce((total, task) => total + (Number(task.points) || 0), 0)
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
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          tasks: state.tasks,
          profile: state.profile,
          defaultTasksVersion: state.defaultTasksVersion,
          taskDraft: state.taskDraft,
          formOpen: state.formOpen
        })
      );
      if (window.HudaCloud && window.HudaCloud.queueSync) {
        window.HudaCloud.queueSync({ profile: state.profile, tasks: state.tasks });
      }
      storageError = '';
      return true;
    } catch (error) {
      console.error('تعذر حفظ بيانات المهام.', error);
      storageError = 'لم يتم حفظ التغيير؛ مساحة تخزين المتصفح غير متاحة أو ممتلئة.';
      render();
      return false;
    }
  }
  const backupFormat = 'huda-app-backup';
  const legacyBackupFormat = 'qurany-app-backup';
  const backupLimit = 20 * 1024 * 1024;
  function isAppStorageKey(key) {
    return (
      key === 'quran_tasks_v1' ||
      key === 'baytna_v2' ||
      (key.indexOf('mq.') === 0 && key !== 'mq.offlineReady' && key !== 'mq.pagesPreparedV2') ||
      key.indexOf('quran_') === 0 ||
      key.indexOf('tq_') === 0
    );
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
      link.download = 'Huda-backup-' + localDate() + '.json';
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      storageError = '';
      render();
    } catch (error) {
      console.error('تعذر إنشاء نسخة Huda الاحتياطية.', error);
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
      storageError = 'تعذر قراءة الملف. اختر نسخة Huda الاحتياطية بصيغة JSON.';
      render();
      return;
    }
    if (
      !backup ||
      (backup.format !== backupFormat && backup.format !== legacyBackupFormat) ||
      backup.version !== 1 ||
      !backup.data ||
      typeof backup.data !== 'object' ||
      Array.isArray(backup.data)
    ) {
      storageError = 'الملف المحدد ليس نسخة احتياطية صالحة من Huda.';
      render();
      return;
    }
    const entries = Object.entries(backup.data);
    if (
      entries.length > 500 ||
      entries.some(([key, value]) => !isAppStorageKey(key) || typeof value !== 'string')
    ) {
      storageError = 'تحتوي النسخة على بيانات غير صالحة أو غير متوافقة.';
      render();
      return;
    }
    if (
      !window.confirm('سيتم استبدال بيانات Huda على هذا الجهاز بمحتويات النسخة الاحتياطية. هل تريد المتابعة؟')
    )
      return;

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
      console.error('تعذر استعادة نسخة Huda الاحتياطية.', error);
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
  function todayKey() {
    return localDate();
  }
  const prayerIdsByTaskCategory = {
    الفجر: 'Fajr',
    الظهر: 'Dhuhr',
    العصر: 'Asr',
    المغرب: 'Maghrib',
    العشاء: 'Isha',
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
      if (
        !cached ||
        cached.format !== 'quran-prayer-cache' ||
        cached.version !== 1 ||
        !cached.items ||
        typeof cached.items !== 'object' ||
        Array.isArray(cached.items)
      ) {
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
    const hour = Number(match[1]),
      minute = Number(match[2]);
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
  /* أذكار لها نافذة وقت: الاستيقاظ (الفجر ← الشروق)، الصباح (الفجر ← الظهر)، المساء (العصر ← الفجر التالي).
     أذكار بعد الصلاة تُعرض مع الصلاة الحالية فقط (كما تعرض بقية مهام الصلاة). */
  function timedAzkarKind(task) {
    if (!task || !task.defaultTask) return '';
    const title = String(task.title || '');
    if (/أذكار\s*الاستيقاظ/.test(title)) return 'wake';
    if (/أذكار\s*الصباح/.test(title)) return 'morning';
    if (/أذكار\s*المساء/.test(title)) return 'evening';
    return '';
  }
  function timingMinutes(schedule, key) {
    const match = String((schedule.timings && schedule.timings[key]) || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }
  function timedAzkarVisible(task, schedule) {
    const kind = timedAzkarKind(task);
    if (!kind || !schedule.fresh || !schedule.timings) return true;
    const now = new Date(),
      current = now.getHours() * 60 + now.getMinutes();
    const fajr = timingMinutes(schedule, 'Fajr'),
      dhuhr = timingMinutes(schedule, 'Dhuhr'),
      asr = timingMinutes(schedule, 'Asr');
    if (kind === 'wake') {
      const sunrise = timingMinutes(schedule, 'Sunrise');
      const end = sunrise != null ? sunrise : fajr != null ? fajr + 120 : null;
      return fajr == null || end == null ? true : current >= fajr && current < end;
    }
    if (kind === 'morning') return fajr == null || dhuhr == null ? true : current >= fajr && current < dhuhr;
    if (kind === 'evening') return asr == null || fajr == null ? true : current >= asr || current < fajr;
    return true;
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
      const minutesUntilNextPrayer =
        nextMinutes == null
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
    const time =
      String(Math.floor(minutes / 60)).padStart(2, '0') + ':' + String(minutes % 60).padStart(2, '0');
    return displayName + ' · ' + time.replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit]);
  }
  function sortTasksByPrayerTime(tasks, schedule) {
    return tasks
      .map((task, index) => ({ task, index, minutes: prayerMinutesForTask(task, schedule) }))
      .sort(
        (a, b) =>
          (a.minutes == null ? 1440 : a.minutes) - (b.minutes == null ? 1440 : b.minutes) || a.index - b.index
      )
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
        state.tasks.push(
          Object.assign({}, task, {
            done: false,
            createdAt: new Date().toISOString(),
            day: today,
            days: [],
            hist: {}
          })
        );
      });
    } else {
      state.tasks = state.tasks.filter(
        task =>
          !(task.defaultTask && task.category === 'أذكار متنوعة') &&
          !String(task.id).startsWith('daily-default-azkar-')
      );
    }
    state.tasks = state.tasks.filter(
      task => task.title !== 'مهمة اختبار غير مصنفة' && task.title !== 'قراءة ستة أرباع'
    );
    const dailyWird = defaultTasks.find(task => task.id === 'daily-default-quran-1');
    const previousDailyWird = state.tasks.find(
      task =>
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
      return updated
        ? Object.assign({}, task, {
            title: updated.title,
            category: updated.category,
            icon: updated.icon
          })
        : task;
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
    const isDone = key => (key === todayKey() ? !!task.done : !!(task.hist && task.hist[key]));
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
    return selected.length === 7
      ? 'كل يوم'
      : days
          .filter(day => selected.includes(day.value))
          .map(day => day.label)
          .join(' • ');
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
      if (
        state.tasks.some(
          item => item.done && item.day === todayKey() && item.autoAzkarSource === source && taskVisible(item)
        )
      )
        return;
      task = state.tasks.find(item => !item.done && taskVisible(item) && titles.prayer.test(item.title));
    } else if (detail.completed) {
      if (
        state.tasks.some(
          item => item.done && item.day === todayKey() && item.autoAzkarSource === source && taskVisible(item)
        )
      )
        return;
      const match = titles[source];
      if (!match) return;
      task = state.tasks.find(item => !item.done && taskVisible(item) && match.test(item.title));
    } else {
      task = state.tasks
        .filter(item => item.done && item.autoAzkarSource === source && taskVisible(item))
        .sort((a, b) => (b.autoAzkarAt || 0) - (a.autoAzkarAt || 0))[0];
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
          canvas.toBlob(
            blob => {
              releaseUrl();
              if (!blob) {
                reject(new Error('تعذر ضغط الصورة المختارة.'));
                return;
              }
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result || ''));
              reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الصورة المختارة.'));
              reader.readAsDataURL(blob);
            },
            'image/jpeg',
            0.78
          );
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
  /* ===== واجهة الحساب (رقم الهاتف فقط: إنشاء أو دخول) ===== */
  const accountUi = { open: false, phone: '', busy: false, msg: '', error: false };
  function accountInnerHtml() {
    const account = cloudState().account;
    const online = navigator.onLine !== false;
    const note = accountUi.msg
      ? `<p class="account-msg${accountUi.error ? ' is-error' : ''}" role="status">${esc(accountUi.msg)}</p>`
      : '';
    const busy = accountUi.busy ? ' disabled' : '';
    if (account) {
      return `<section class="account-card" aria-label="حسابك">
        <div class="account-head"><span aria-hidden="true">☁</span><div><strong>حسابك</strong><small>رقم الهاتف: ${esc(account.phone || '')}</small></div></div>
        <p class="account-hint">جميع بياناتك (المهام والنقاط والعلامات والتعليقات والإعدادات) تُحفظ على قاعدة البيانات تلقائيًا كلما توفر الإنترنت.</p>
        <div class="account-actions">
          <button type="button" class="primary" data-action="account-sync"${busy}>مزامنة الآن</button>
          <button type="button" class="secondary" data-action="account-logout"${busy}>تسجيل الخروج</button>
          <button type="button" class="secondary account-danger" data-action="account-delete-own"${busy}>حذف الحساب</button>
        </div>
        ${online ? '' : '<p class="account-hint">لا يوجد اتصال؛ ستُرفع التغييرات عند عودة الإنترنت.</p>'}
        ${note}
      </section>`;
    }
    return `<section class="account-card" aria-label="الحساب السحابي">
      <div class="account-head"><span aria-hidden="true">☁</span><div><strong>الحساب السحابي</strong><small>أدخل رقم هاتفك لإنشاء حسابك أو الدخول إليه؛ يُحفظ تقدمك على Firestore</small></div></div>
      ${online ? '' : '<p class="account-hint">الإنشاء والدخول يحتاجان اتصالًا بالإنترنت.</p>'}
      <form class="account-form" data-form="account-phone">
        <label class="profile-field">رقم الهاتف<input type="tel" name="acctPhone" maxlength="24" autocomplete="tel" value="${esc(accountUi.phone || state.profile.phone)}" placeholder="مثال: +201012345678"></label>
        <button type="submit" class="primary"${busy}>متابعة</button>
      </form>
      <p class="account-hint account-warn">⚠ الدخول يتم بالرقم فقط دون رمز تحقق؛ لا تستخدم الحساب لبيانات حساسة.</p>
      ${note}
    </section>`;
  }
  function accountSectionHtml() {
    const account = cloudState().account;
    const title = account ? 'حسابك' : 'الحساب السحابي';
    const sub = account ? 'متصل — بياناتك تُحفظ تلقائيًا' : 'احفظ بياناتك وادخل من أي جهاز';
    return `<details class="account-fold"${accountUi.open ? ' open' : ''}>
      <summary><span class="account-fold-icon" aria-hidden="true">☁</span><span class="account-fold-copy"><strong>${title}</strong><small>${sub}</small></span><span class="account-fold-caret" aria-hidden="true">▾</span></summary>
      ${accountInnerHtml()}
    </details>`;
  }
  async function runAccountTask(task, successMessage) {
    accountUi.busy = true;
    accountUi.msg = 'جارٍ التنفيذ…';
    accountUi.error = false;
    render();
    try {
      const result = await task();
      accountUi.msg = successMessage || '';
      accountUi.error = false;
      return result;
    } catch (error) {
      accountUi.msg = (error && error.message) || 'تعذرت العملية.';
      accountUi.error = true;
      return undefined;
    } finally {
      accountUi.busy = false;
      render();
    }
  }
  const accountApi = () => window.HudaCloud || {};
  async function handleAccountForm(form) {
    const phone = form.elements.acctPhone.value.trim();
    accountUi.phone = phone;
    const api = accountApi();
    const exists = await runAccountTask(() => api.checkPhone(phone), '');
    if (exists === undefined) return;
    if (exists) {
      if (!window.confirm('يوجد حساب بهذا الرقم. سيتم استبدال بيانات هذا الجهاز ببيانات الحساب. هل تريد المتابعة؟')) {
        accountUi.msg = '';
        render();
        return;
      }
      const ok = await runAccountTask(() => api.loginAccount(phone), 'تم تسجيل الدخول.');
      if (ok) window.location.reload();
    } else {
      const done = await runAccountTask(() => api.registerAccount(phone), 'تم إنشاء الحساب وحفظ تقدمك.');
      if (done) {
        state.profile.phone = state.profile.phone || phone;
        accountUi.phone = '';
        save();
      }
    }
    render();
  }
  async function handleAccountAction(action, id) {
    const api = accountApi();
    if (action === 'account-delete-own') {
      const account = cloudState().account;
      if (!account) return;
      if (!window.confirm('حذف الحساب نهائي من قاعدة البيانات (تبقى بيانات هذا الجهاز). هل تريد المتابعة؟')) return;
      await runAccountTask(() => api.deleteAccount(account.id, account.phone), 'تم حذف الحساب.');
    } else if (action === 'account-logout') {
      api.logoutAccount();
      accountUi.msg = 'تم تسجيل الخروج؛ بياناتك ما زالت على هذا الجهاز.';
      accountUi.error = false;
      render();
    } else if (action === 'account-sync') {
      const ok = await runAccountTask(() => api.syncAccount(true), '');
      accountUi.msg = ok ? 'تمت المزامنة.' : 'تعذرت المزامنة؛ تحقق من الاتصال.';
      accountUi.error = !ok;
      render();
    }
  }
  async function saveProfile(form) {
    const name = form.elements.profileName.value.trim();
    const phone = form.elements.profilePhone.value.trim();
    const phoneVisibility = form.elements.profilePhoneVisibility.value === 'public' ? 'public' : 'private';
    const avatarFile = form.elements.profileAvatar.files[0];
    if (name.length > 80) {
      storageError = 'يجب ألا يتجاوز الاسم ٨٠ حرفًا.';
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
    state.profile.phone = phone;
    state.profile.phoneVisibility = phoneVisibility;
    state.profile.showOnLeaderboard = !!(
      form.elements.profileShowOnLeaderboard && form.elements.profileShowOnLeaderboard.checked
    );
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
    const taskDraftCategory = taskPrayerCategories.includes(state.taskDraft.category)
      ? state.taskDraft.category
      : activePrayer || 'الفجر';
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
          ${
            taskDays.length
              ? `<div class="hint">ستظهر في: ${esc(
                  taskDays.length === 7
                    ? 'كل يوم'
                    : days
                        .filter(day => taskDays.includes(day.value))
                        .map(day => day.label)
                        .join('، ')
                )}</div>`
              : ''
          }
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
        const groupTasks = scheduledTasks
          .filter(task => group.categories.includes(task.category))
          .filter(task => !activePrayer || (!timedAzkarKind(task) && !task.khatmaTask))
          .concat(
            activePrayer && group.category === activePrayer
              ? scheduledTasks.filter(
                  task =>
                    task.khatmaTask || (timedAzkarKind(task) && timedAzkarVisible(task, prayerSchedule))
                )
              : []
          );
        const cards = sortTasksByPrayerTime(
          groupTasks.filter(task => !task.done),
          prayerSchedule
        )
          .concat(
            sortTasksByPrayerTime(
              groupTasks.filter(task => task.done),
              prayerSchedule
            )
          )
          .map(renderTaskCard)
          .join('');
        return `<section class="prayer-task-group" aria-label="مهام صلاة ${esc(group.category)}">
          <div class="prayer-task-group-head"><h4>صلاة ${esc(group.category)}</h4><span>${groupTasks.length} مهمة</span></div>
          ${cards || '<div class="prayer-task-empty">لا توجد مهام لهذه الصلاة اليوم.</div>'}
        </section>`;
      })
      .join('');
    const uncategorizedTasks = scheduledTasks.filter(task => !taskPrayerCategories.includes(task.category));
    const uncategorizedCards = sortTasksByPrayerTime(
      uncategorizedTasks.filter(task => !task.done),
      prayerSchedule
    )
      .concat(
        sortTasksByPrayerTime(
          uncategorizedTasks.filter(task => task.done),
          prayerSchedule
        )
      )
      .map(renderTaskCard)
      .join('');
    const uncategorizedSection = uncategorizedTasks.length
      ? `<section class="prayer-task-group" aria-label="مهام غير مرتبطة بصلاة">
            <div class="prayer-task-group-head"><h4>مهام أخرى</h4><span>${uncategorizedTasks.length} مهمة</span></div>
            ${uncategorizedCards}
          </section>`
      : '';
    const cloud = cloudState();
    const showMe = state.profile.showOnLeaderboard !== false;
    const myName = state.profile.name || cloud.autoName || 'ملفك الشخصي';
    const me = {
      name: myName,
      points: state.profile.totalPoints,
      avatar: state.profile.avatar || './logo.png',
      isYou: true
    };
    // الترتيب الحقيقي من الخادم (أو آخر نسخة محفوظة)، وإلا النماذج التحفيزية حتى يتوفر الإنترنت.
    const hasRealBoard = cloud.leaderboard.length > 0;
    const realEntries = cloud.leaderboard.map(entry => (entry.isYou ? Object.assign({}, entry, me) : entry));
    const meListed = realEntries.some(entry => entry.isYou);
    const leaderboardEntries = (
      hasRealBoard
        ? realEntries.concat(showMe && !meListed && (cloud.user || state.profile.totalPoints) ? [me] : [])
        : defaultLeaderboard.concat(showMe ? [me] : [])
    ).sort((a, b) => b.points - a.points);
    const boardStatus = hasRealBoard
      ? cloud.online
        ? 'ترتيب مباشر يتحدث تلقائيًا'
        : 'غير متصل — آخر ترتيب محفوظ'
      : cloud.online
        ? 'جارٍ الاتصال بلوحة المتصدرين…'
        : 'غير متصل — نماذج تحفيزية حتى يتوفر الإنترنت';
    const boardNote = hasRealBoard
      ? showMe
        ? 'تنضم تلقائيًا إلى اللوحة باسم مستعار ويُحدَّث رصيدك كلما توفر الإنترنت. يمكنك تغيير اسمك أو إيقاف الظهور من «تعديل الملف».'
        : 'ظهورك في لوحة المتصدرين متوقف، ولا تُرسل نقاطك. فعّله من «تعديل الملف».'
      : 'الأسماء والنقاط الحالية نماذج للعرض فقط. عند توفر الإنترنت تظهر لوحة المتصدرين الحقيقية وتنضم إليها تلقائيًا.';
    const leaderboardPerson = (entry, rank, className = '') =>
      entry
        ? `<article class="leaderboard-person ${className}">
        <div class="leaderboard-person-avatar-wrap"><span class="leaderboard-medal" aria-hidden="true">${rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span><img src="${entry.avatar || './logo.png'}" alt=""></div>
        <strong>${esc(entry.name)}${entry.isYou ? ' (أنت)' : ''}</strong>
        <b>${entry.points} <small>نقطة</small></b>
      </article>`
        : '';
    const leaderboardTop = leaderboardEntries.slice(0, 3);
    const leaderboardRest = leaderboardEntries.slice(3);
    const profileView = `
        <section class="profile-page" aria-label="الملف الشخصي والنقاط">
          <div class="profile-score">
            <span class="profile-score-icon" aria-hidden="true">⭐</span>
            <div class="profile-score-copy"><strong>رصيد نقاطك</strong><small>استمر في إنجاز مهامك اليومية</small></div>
            <div class="profile-score-total"><strong>${state.profile.totalPoints}</strong><span>نقطة</span></div>
          </div>
          ${
            state.profileFormOpen
              ? `<div class="profile-form"><form class="profile-form-inner" data-form="profile">
            <div class="profile-form-heading"><span aria-hidden="true">✦</span><div><strong>بياناتك الشخصية</strong><small>أضف معلوماتك لتخصيص تجربتك</small></div></div>
            <div class="profile-avatar-row">
              <img class="profile-avatar" src="${state.profile.avatar || './logo.png'}" alt="معاينة الصورة الشخصية">
              <div class="profile-avatar-content"><strong>الصورة الشخصية</strong><small>اختر صورة واضحة لملفك</small>
                <div class="profile-avatar-actions"><label class="profile-photo-button">＋ تغيير الصورة<input type="file" name="profileAvatar" accept="image/*"></label>
                  ${state.profile.avatar ? '<button type="button" class="secondary profile-clear-photo" data-action="clear-profile-avatar">إزالة</button>' : ''}
                </div>
              </div>
            </div>
            <label class="profile-field">الاسم<input type="text" name="profileName" maxlength="80" autocomplete="name" value="${esc(state.profile.name)}" placeholder="${esc(cloudState().autoName || 'الاسم الذي تفضّله')}"></label>
            <label class="profile-check"><input type="checkbox" name="profileShowOnLeaderboard" ${state.profile.showOnLeaderboard !== false ? 'checked' : ''}><span>الظهور في لوحة المتصدرين <small>اتركه فارغًا ليظهر اسم تلقائي</small></span></label>
            <label class="profile-field">رقم الهاتف <span class="profile-field-optional">اختياري</span><input type="tel" name="profilePhone" maxlength="24" autocomplete="tel" value="${esc(state.profile.phone)}" placeholder="أدخل الرقم بالصيغة الدولية"></label>
            <label class="profile-field">ظهور رقم الهاتف
              <select name="profilePhoneVisibility">
                <option value="private" ${state.profile.phoneVisibility !== 'public' ? 'selected' : ''}>أنا فقط</option>
                <option value="public" ${state.profile.phoneVisibility === 'public' ? 'selected' : ''}>للعامة مع التواصل عبر واتساب</option>
              </select>
            </label>
            <button type="submit" class="primary profile-save"><span aria-hidden="true">✓</span> حفظ الملف على هذا الجهاز</button>
            <p class="profile-privacy"><span aria-hidden="true">🔒</span> بياناتك ونقاطك محفوظة على هذا الجهاز. عند توفر الإنترنت يُرسَل اسمك ونقاطك وصورتك فقط إلى لوحة المتصدرين (دون تسجيل)، ولا يُرسَل رقم هاتفك إلا إن اخترت إظهاره. أوقف الظهور بإلغاء الخيار أعلاه.</p>
          </form>${accountSectionHtml()}</div>`
              : `
            <div class="profile-data">
            <section class="profile-summary" aria-label="بيانات الملف المحفوظة">
              <img class="profile-avatar" src="${state.profile.avatar || './logo.png'}" alt="الصورة الشخصية">
              <div class="profile-summary-copy">
                <small class="profile-summary-label">ملفك الشخصي</small>
                <strong>${esc(state.profile.name || cloudState().autoName || 'أضف اسمك')}</strong>
                ${state.profile.phone ? `<small>${state.profile.phoneVisibility === 'public' ? `رقم الهاتف: ${esc(state.profile.phone)}` : 'رقم الهاتف خاص بك فقط'}</small>` : '<small>أكمل بياناتك لتخصيص ملفك</small>'}
                ${state.profile.phone && state.profile.phoneVisibility === 'public' && whatsappHref(state.profile.phone) ? `<a class="profile-whatsapp" href="${whatsappHref(state.profile.phone)}" target="_blank" rel="noopener">💬 التواصل عبر واتساب</a>` : ''}
              </div>
              <div class="profile-summary-actions">
                <button type="button" class="primary" data-action="edit-profile">تعديل الملف</button>
                ${state.profile.avatar ? '<button type="button" class="secondary profile-clear-photo" data-action="clear-profile-avatar">إزالة الصورة</button>' : ''}
              </div>
            </section>
            ${accountSectionHtml()}
            </div>
          `
          }
          <section class="leaderboard-card" aria-label="لوحة المتصدرين">
            <div class="leaderboard-heading"><span aria-hidden="true">🏆</span><div><strong>لوحة المتصدرين</strong><small>${boardStatus}</small></div></div>
            <div class="leaderboard-podium" aria-label="المراكز الثلاثة الأولى">
              ${leaderboardPerson(leaderboardTop[1], 2, 'is-second')}
              ${leaderboardPerson(leaderboardTop[0], 1, 'is-first')}
              ${leaderboardPerson(leaderboardTop[2], 3, 'is-third')}
            </div>
            ${
              leaderboardRest.length
                ? `<div class="leaderboard-rest" aria-label="بقية المتصدرين">${leaderboardRest
                    .map(
                      (entry, index) => `<div class="leaderboard-entry">
              <span class="leaderboard-rank">${String(index + 4).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit])}</span>
              <img src="${entry.avatar || './logo.png'}" alt="">
              <strong>${esc(entry.name)}${entry.isYou ? ' (أنت)' : ''}</strong>
              <b>${entry.points} نقطة</b>
            </div>`
                    )
                    .join('')}</div>`
                : ''
            }
            <p class="profile-privacy">${boardNote}</p>
          </section>
          <section class="profile-backup" aria-label="حفظ واستعادة بيانات التطبيق">
            <div class="profile-backup-heading"><span aria-hidden="true">📦</span><div><strong>بياناتك ونسختك الاحتياطية</strong><small>احفظ تقدمك وانقله إلى جهاز آخر</small></div></div>
            <p>تشمل النسخة ملفك الشخصي والمهام والإعدادات والتقدم المحفوظ. أما ملفات الموقع فتُخزّن تلقائيًا داخل التطبيق لتعمل دون إنترنت.</p>
            <div class="profile-backup-actions">
              <button type="button" class="primary" data-action="export-app-data">حفظ نسخة على الجهاز</button>
              <label class="profile-import-button">استعادة نسخة<input type="file" accept=".json,application/json" data-app-backup-file></label>
            </div>
                <small class="profile-backup-note">سيُنزّل ملف باسم Huda إلى مجلد التنزيلات. الاستعادة تستبدل بيانات التطبيق الحالية.</small>
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
          .task-streak{color:var(--muted);font-size:10px}
          .is-done .item-copy strong{text-decoration:line-through}.check-button{width:23px;height:23px;flex:none;border:1.5px solid var(--green);border-radius:50%;background:transparent;color:var(--green);font-weight:900;padding:0}
          .is-done .check-button{background:var(--green);color:var(--on-green)}.delete-button{width:23px;height:23px;flex:none;border:0;border-radius:7px;background:transparent;color:var(--muted);font-size:18px}
          .delete-button:hover{background:color-mix(in srgb,var(--red) 12%,var(--panel));color:var(--red)}
          .empty{padding:18px 8px;text-align:center;color:var(--muted);font-size:12px;border:1px dashed var(--line);border-radius:12px}
          .error{padding:9px;border-radius:9px;background:color-mix(in srgb,var(--red) 12%,var(--panel));color:var(--red);font-size:11px}
          .profile-page{display:grid;gap:12px;padding:2px 0 8px}
          .account-card{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:17px;background:var(--card);box-shadow:0 6px 20px rgba(40,34,26,.045)}
          .account-head{display:flex;align-items:center;gap:10px}.account-head>span{font-size:22px}.account-head div{display:grid;gap:2px}.account-head small{color:var(--muted);font-size:10px}
          .account-form{display:grid;gap:8px}.account-sub{font-size:12px}.account-actions{display:flex;flex-wrap:wrap;gap:8px}
          .account-hint{margin:0;color:var(--muted);font-size:10.5px;line-height:1.7}.account-warn{color:var(--red)}
          .account-msg{margin:0;padding:8px;border-radius:9px;background:color-mix(in srgb,var(--green) 10%,var(--panel));font-size:11px}.account-msg.is-error{background:color-mix(in srgb,var(--red) 12%,var(--panel));color:var(--red)}
          .account-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.account-list li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}.account-list li span{display:flex;gap:6px}
          .account-danger{color:var(--red)}
          .profile-form-inner{display:grid;gap:13px}.profile-data{display:grid;gap:10px}
          .account-fold{border:1px solid var(--line);border-radius:14px;background:var(--panel);overflow:hidden}
          .account-fold>summary{display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer;list-style:none}.account-fold>summary::-webkit-details-marker{display:none}
          .account-fold-icon{display:grid;place-items:center;width:32px;height:32px;border-radius:10px;background:color-mix(in srgb,var(--green) 11%,var(--card));font-size:17px}
          .account-fold-copy{display:grid;gap:2px;flex:1;min-width:0}.account-fold-copy strong{font-size:12.5px}.account-fold-copy small{color:var(--muted);font-size:10px}
          .account-fold-caret{color:var(--muted);transition:transform .2s}.account-fold[open] .account-fold-caret{transform:rotate(180deg)}
          .account-fold>.account-card{border:0;border-top:1px solid var(--line);border-radius:0;box-shadow:none;background:transparent}
          .account-head{display:none}
          .account-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
          .account-actions button,.account-list button,.account-form button{min-height:42px;padding:0 14px;border-radius:12px;font:inherit;font-size:12.5px;font-weight:800;cursor:pointer;transition:transform .12s,background .15s}
          .account-actions button:active,.account-list button:active,.account-form button:active{transform:scale(.97)}
          .account-actions .primary{grid-column:1/-1;border:0;background:var(--green);color:#fff}
          .account-actions .secondary{border:1px solid color-mix(in srgb,var(--green) 35%,var(--line));background:color-mix(in srgb,var(--green) 7%,var(--card));color:var(--green)}
          .account-actions .account-danger,.account-list .account-danger{border:1px solid color-mix(in srgb,var(--red) 40%,var(--line));background:color-mix(in srgb,var(--red) 8%,var(--card));color:var(--red)}
          .account-actions button:disabled,.account-list button:disabled,.account-form button:disabled{opacity:.55;cursor:default}
          .account-list button{min-height:36px;padding:0 12px}
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
          .profile-whatsapp{display:inline-flex;align-items:center;justify-content:center;width:max-content;padding:4px 7px;border-radius:7px;background:color-mix(in srgb,var(--green) 10%,var(--panel));color:var(--green);font-size:10px;font-weight:900;text-decoration:none}
          .profile-summary-actions{display:grid;gap:6px}.profile-summary-actions button{padding:8px 10px;font:inherit;font-size:10px;font-weight:800;white-space:nowrap}
          .profile-avatar{width:70px;height:70px;flex:none;border:3px solid var(--card);border-radius:50%;object-fit:cover;background:var(--panel);box-shadow:0 0 0 2px color-mix(in srgb,var(--green) 33%,var(--line))}
          .profile-photo-button,.profile-clear-photo{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:7px 11px;border:1px solid color-mix(in srgb,var(--green) 28%,var(--line));border-radius:9px;background:color-mix(in srgb,var(--green) 7%,var(--panel));color:var(--green);font:inherit;font-size:10px;font-weight:900;cursor:pointer}
          .profile-photo-button input{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
          .profile-photo-button:focus-within,.profile-clear-photo:focus-visible{outline:2px solid var(--green);outline-offset:2px}
          .profile-clear-photo{border-color:var(--line);background:var(--panel);color:var(--muted)}
          .profile-fields-row{display:grid;grid-template-columns:minmax(0,.6fr) minmax(0,1.4fr);gap:10px}
          .profile-field{display:grid;grid-template-columns:1fr auto;align-items:center;gap:6px;color:var(--ink);font-size:11px;font-weight:900}
          .profile-field input,.profile-field select{grid-column:1/-1;min-height:43px;padding:10px 12px;border-radius:11px;background:var(--panel);font:inherit;font-size:12px;font-weight:700}
          .profile-field input::placeholder{color:var(--muted);font-weight:500;opacity:.8}
          .profile-field-optional{color:var(--muted);font-size:9px;font-weight:600}
          .profile-save{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:47px;border-radius:12px;font:inherit;font-size:13px;font-weight:900;box-shadow:0 5px 13px color-mix(in srgb,var(--green) 18%,transparent);transition:filter .15s,transform .15s}
          .profile-save:hover{filter:brightness(1.05);transform:translateY(-1px)}.profile-save>span{font-size:16px}
          .profile-check{display:flex;align-items:center;gap:9px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--panel) 70%,var(--card));font-size:12px;font-weight:800;cursor:pointer}.profile-check input{width:18px;height:18px;flex:none;accent-color:var(--green)}.profile-check small{display:block;margin-top:2px;color:var(--muted);font-size:10px;font-weight:600}
          .profile-privacy{display:flex;align-items:flex-start;gap:6px;margin:0;color:var(--muted);font-size:10px;line-height:1.6}.profile-privacy>span{flex:none}
          .leaderboard-card{display:grid;gap:12px;padding:14px}
          .leaderboard-heading{display:flex;align-items:center;gap:10px}.leaderboard-heading>span{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:color-mix(in srgb,var(--sub) 12%,var(--panel));font-size:20px}
          .leaderboard-heading strong,.leaderboard-heading small{display:block}.leaderboard-heading strong{font-size:13px}.leaderboard-heading small{margin-top:2px;color:var(--muted);font-size:10px}
          .leaderboard-podium{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:end;gap:6px;padding:10px 0 0}
          .leaderboard-person{display:flex;min-width:0;flex-direction:column;align-items:center;gap:4px;text-align:center}
          .leaderboard-person-avatar-wrap{position:relative;display:grid;place-items:center}
          .leaderboard-person img{width:54px;height:54px;border:3px solid var(--card);border-radius:50%;object-fit:cover;background:var(--panel);box-shadow:0 0 0 2px color-mix(in srgb,var(--green) 35%,var(--line))}
          .leaderboard-medal{position:absolute;z-index:1;top:-13px;font-size:20px;line-height:1}
          .leaderboard-person strong{width:100%;min-height:30px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px}
          .leaderboard-person b{display:block;width:100%;padding:7px 3px 5px;border-radius:12px 12px 0 0;color:var(--ink);font-size:11px}
          .leaderboard-person b small{font-size:8px;font-weight:700}
          .leaderboard-person.is-first{order:2}.leaderboard-person.is-second{order:1}.leaderboard-person.is-third{order:3}
          .leaderboard-person.is-first b{min-height:82px;padding-top:29px;background:color-mix(in srgb,var(--green) 64%,var(--card));font-size:20px;color:var(--on-green)}
          .leaderboard-person.is-second b{min-height:61px;padding-top:18px;background:color-mix(in srgb,var(--sub) 25%,var(--card));font-size:16px}
          .leaderboard-person.is-third b{min-height:47px;padding-top:11px;background:color-mix(in srgb,var(--green) 24%,var(--card));font-size:14px}
          .leaderboard-rest{display:grid;gap:7px;padding-top:3px}
          .leaderboard-entry{display:flex;align-items:center;gap:9px;padding:9px 10px;border:1px solid color-mix(in srgb,var(--sub) 23%,var(--line));border-radius:12px;background:linear-gradient(100deg,color-mix(in srgb,var(--sub) 7%,var(--panel)),var(--panel))}
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
          ${
            state.view === 'profile'
              ? profileView
              : `
            <div class="stats"><div class="stat"><b>${pendingTasks.length}</b><span>متبقية اليوم</span></div><div class="stat"><b>${completedTasks.length}</b><span>مكتملة اليوم</span></div><div class="stat"><b>${earnedPoints} / ${availablePoints}</b><span>النقاط المحققة</span></div></div>
          <div class="section-head"><h4>مهام اليوم · ${scheduledTasks.length} مهمة</h4><button type="button" class="add-toggle" data-action="toggle-form">＋ مهمة جديدة</button></div>
          ${state.formOpen ? form : ''}
            ${
              scheduledTasks.length
                ? `<div class="prayer-task-groups">${taskSections}${uncategorizedSection}</div>`
                : `<div class="empty">${
                    scheduledHidden
                      ? `لا توجد مهام مجدولة لهذا اليوم. لديك ${scheduledHidden} مهام في أيام أخرى.`
                      : 'لا توجد مهام مجدولة لليوم. أضف مهمة وحدد الصلاة المناسبة.'
                  }</div>`
            }
          ${storageError ? `<div class="error" role="alert">${esc(storageError)}</div>` : ''}
          `
          }
        </main>`;
    const backupCard = root.querySelector('.profile-backup');
    if (backupCard && backupHost) backupHost.replaceChildren(backupCard);
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
    if (
      !Number.isInteger(points) ||
      points < 0 ||
      points > 100 ||
      !taskPrayerCategories.includes(draft.category)
    ) {
      storageError = 'تحقق من وقت المهمة والنقاط؛ يجب أن تكون النقاط بين صفر و١٠٠.';
      render();
      return;
    }
    const scheduled = validDays(draft.days);
    state.tasks.unshift({
      id: uid(),
      title: title.slice(0, 120),
      done: false,
      points: points,
      category: draft.category,
      createdAt: new Date().toISOString(),
      icon: icons.some(icon => icon[0] === draft.icon) ? draft.icon : 'star',
      daily: draft.daily,
      days: scheduled,
      day: todayKey(),
      hist: {}
    });
    state.taskDraft = {
      title: '',
      icon: 'star',
      points: 1,
      category: '',
      daily: false,
      days: [],
      daysOpen: false
    };
    state.formOpen = false;
    save();
    render();
  }
  let draftSaveTimer = 0;
  root.addEventListener(
    'toggle',
    event => {
      if (event.target.classList && event.target.classList.contains('account-fold')) accountUi.open = event.target.open;
    },
    true
  );
  root.addEventListener('input', event => {
    const field = event.target;
    if (field && field.name === 'acctName') accountUi.name = field.value;
    else if (field && field.name === 'acctPhone') accountUi.phone = field.value;
    else if (field && field.name === 'acctLoginPhone') accountUi.loginPhone = field.value;
    if (field && String(field.name || '').indexOf('acct') === 0) return;
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
    } else if (action.indexOf('account-') === 0) {
      handleAccountAction(action, button.dataset.id);
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
      state.taskDraft.days = selected.includes(day)
        ? selected.filter(value => value !== day)
        : selected.concat(day);
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
        state.profile.totalPoints = Math.max(
          0,
          state.profile.totalPoints + (task.done ? 1 : -1) * (Number(task.points) || 0)
        );
        task.day = todayKey();
        delete task.autoAzkarSource;
        delete task.autoAzkarAt;
        if (task.done && !task.hist) task.hist = {};
        save();
        render();
        if (task.khatmaTask)
          window.dispatchEvent(new CustomEvent('quran:khatma-task-toggled', { detail: { done: task.done } }));
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
    if (String(event.target.dataset.form).indexOf('account-') === 0) {
      handleAccountForm(event.target);
      return;
    }
    captureForm();
    if (event.target.dataset.form === 'task') addTask();
  });
  root.addEventListener('change', event => {
    const backupFile = event.target.closest('[data-app-backup-file]');
    if (backupFile) {
      const file = backupFile.files && backupFile.files[0];
      importAppData(file)
        .catch(error => {
          console.error('تعذر استعادة نسخة Huda الاحتياطية.', error);
          storageError = 'تعذر استعادة النسخة الاحتياطية. أعد المحاولة بملف Huda صالح.';
          render();
        })
        .finally(() => {
          backupFile.value = '';
        });
    }
  });
  if (backupHost) {
    backupHost.addEventListener('click', event => {
      const button = event.target.closest('button[data-action="export-app-data"]');
      if (button) exportAppData();
    });
    backupHost.addEventListener('change', event => {
      const backupFile = event.target.closest('[data-app-backup-file]');
      if (!backupFile) return;
      const file = backupFile.files && backupFile.files[0];
      importAppData(file)
        .catch(error => {
          console.error('تعذر استعادة نسخة Huda الاحتياطية.', error);
          storageError = 'تعذر استعادة النسخة الاحتياطية. أعد المحاولة بملف Huda صالح.';
          render();
        })
        .finally(() => {
          backupFile.value = '';
        });
    });
  }
  window.addEventListener('quran:azkar-progress', syncAzkarTask);
  /* ورد الختمة: مهمة يومية تُدار من خدمة «ختمتي» وتبقى ظاهرة في وقت الصلاة الحالي */
  function syncKhatmaTask(event) {
    const detail = event && event.detail;
    if (!detail) return;
    const id = 'khatma-wird';
    let task = state.tasks.find(item => item.id === id);
    if (!detail.enabled) {
      if (task) {
        state.tasks = state.tasks.filter(item => item.id !== id);
        if (save()) render();
      }
      return;
    }
    let changed = false;
    const today = todayKey();
    if (!task) {
      task = {
        id,
        title: String(detail.title || 'ورد الختمة'),
        points: Math.max(0, Number(detail.points) || 0),
        category: 'الفجر',
        icon: 'book',
        khatmaTask: true,
        daily: true,
        done: false,
        createdAt: new Date().toISOString(),
        day: today,
        days: [],
        hist: {}
      };
      state.tasks.push(task);
      changed = true;
    }
    if (task.day !== today) {
      if (task.day) task.hist[task.day] = !!task.done;
      task.done = false;
      task.day = today;
      changed = true;
    }
    const title = String(detail.title || 'ورد الختمة');
    if (task.title !== title) {
      task.title = title;
      changed = true;
    }
    if (!!detail.done !== task.done) {
      task.done = !!detail.done;
      state.profile.totalPoints = Math.max(
        0,
        state.profile.totalPoints + (task.done ? 1 : -1) * (Number(task.points) || 0)
      );
      changed = true;
    }
    if (changed && save()) render();
  }
  window.addEventListener('quran:khatma-task-sync', syncKhatmaTask);
  window.addEventListener('huda-leaderboard-changed', () => render());
  window.addEventListener('online', () => render());
  window.addEventListener('offline', () => render());
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


/* ======================================================================
 * 3. دليل التجويد ومحلل الآيات
 * TajweedGuide: قواعد التجويد وأمثلتها ودالة inspectAyah.
 * ====================================================================== */
/* Tajweed Guide & Rule Analyzer - دليل أحكام التجويد الملون ومحلل أحكام الآيات */
(function (window) {
  'use strict';

  var TAJWEED_RULES = {
    // 1. أحكام المدود
    madd_lazim: {
      id: 'madd_lazim',
      name: 'المد اللازم',
      category: 'madd',
      categoryName: 'أحكام المدود',
      harakat: '6 حركات (إشباعاً وجوباً)',
      color: '#c8283a',
      bg: 'rgba(200, 40, 58, 0.12)',
      desc: 'هو أن يأتي بعد حرف المد حرف ساكن سكوناً أصلياً (أو مشدد) في كلمة أو حرف، ومقداره ست حركات وجوباً عند جميع القراء.',
      types: [
        'كلمي مثقل (مثل: الحَاقَّة، الضَّالِّينَ)',
        'كلمي مخفف (مثل: آلْآنَ)',
        'حرفي مثقل (مثل: الم - اللام)',
        'حرفي مخفف (مثل: ص، ق، ن)'
      ],
      examples: [
        { word: 'وَلَا ٱلضَّآلِّينَ', surah: 'الفاتحة: 7', note: 'مد لازم كلمي مثقل 6 حركات' },
        { word: 'ٱلۡحَآقَّةُ', surah: 'الحاقة: 1', note: 'مد لازم كلمي مثقل 6 حركات' },
        { word: 'الٓمٓ', surah: 'البقرة: 1', note: 'مد لازم حرفي (لام وميم) 6 حركات لكل حرف' }
      ]
    },
    madd_wajib: {
      id: 'madd_wajib',
      name: 'المد الواجب المتصل',
      category: 'madd',
      categoryName: 'أحكام المدود',
      harakat: '4 أو 5 حركات (وجوباً)',
      color: '#e05666',
      bg: 'rgba(224, 86, 102, 0.12)',
      desc: 'هو أن يأتي حرف المد وتليه الهمزة في نفس الكلمة الواحدة، وحكمه وجوب المد بمقدار 4 أو 5 حركات لحفص عن عاصم.',
      types: [
        'متصل في وسط الكلمة (مثل: مَلَائِكَة، جِيءَ)',
        'متصل متطرف موقوف عليه (مثل: السَّمَاءِ، يَشَاءُ ويجوز فيه 6 حركات وقفاً)'
      ],
      examples: [
        { word: 'جَآءَ', surah: 'النصر: 1', note: 'مد متصل 4-5 حركات' },
        { word: 'ٱلسَّمَآءِ', surah: 'البقرة: 22', note: 'مد متصل 4-5 حركات' },
        { word: 'سُوٓءَ ٱلۡعَذَابِ', surah: 'البقرة: 49', note: 'مد متصل 4-5 حركات' }
      ]
    },
    madd_jaiz: {
      id: 'madd_jaiz',
      name: 'المد الجائز المنفصل ومد الصلة الكبرى',
      category: 'madd',
      categoryName: 'أحكام المدود',
      harakat: '4 أو 5 حركات (جوازاً)',
      color: '#e67e22',
      bg: 'rgba(230, 126, 34, 0.12)',
      desc: 'أن يأتي حرف المد في آخر الكلمة الأولى، وتليه الهمزة في أول الكلمة التي تليها، ومثله مد الصلة الكبرى (هاء الضمير بعدها همزة).',
      types: [
        'منفصل حقيقي (مثل: بِمَا أُنزِلَ)',
        'منفصل حكمي (مثل: هَـٰؤُلَاءِ، يَـٰأَيُّهَا)',
        'صلة كبرى (مثل: وَلَا يُشْرِكْ بِعِبَادَةِ رَبِّهِۦٓ أَحَدًا)'
      ],
      examples: [
        { word: 'إِنَّآ أَنزَلۡنَٰهُ', surah: 'القدر: 1', note: 'مد منفصل 4-5 حركات' },
        { word: 'يَـٰٓأَيُّهَا', surah: 'البقرة: 21', note: 'مد منفصل حكمي 4-5 حركات' },
        { word: 'عِندَهُۥٓ إِلَّا', surah: 'البقرة: 255', note: 'مد صلة كبرى 4-5 حركات' }
      ]
    },
    madd_aarid: {
      id: 'madd_aarid',
      name: 'المد العارض للسكون ومد اللين',
      category: 'madd',
      categoryName: 'أحكام المدود',
      harakat: '2 أو 4 أو 6 حركات (عند الوقف)',
      color: '#f39c12',
      bg: 'rgba(243, 156, 18, 0.12)',
      desc: 'هو أن يقع بعد حرف المد أو حرف اللين (الواو والياء الساكنتان المفتوح ما قبلهما) سكون عارض لأجل الوقف، ويجوز فيه القصر (حركتان) أو التوسط (4) أو الإشباع (6).',
      types: [
        'مد عارض للسكون (مثل: العَالَمِينَ، الرَّحِيمِ)',
        'مد اللين (مثل: قُرَيْشٍ، خَوْفٍ، الصَّيْفِ)'
      ],
      examples: [
        { word: 'ٱلۡعَٰلَمِينَ', surah: 'الفاتحة: 2', note: 'عارض للسكون عند الوقف 2، 4، 6 حركات' },
        { word: 'خَوۡفِۭ', surah: 'قريش: 4', note: 'مد لين عارض 2، 4، 6 حركات' }
      ]
    },

    // 2. أحكام النون الساكنة والتنوين
    idgham_ghunnah: {
      id: 'idgham_ghunnah',
      name: 'الإدغام بغنة',
      category: 'noon',
      categoryName: 'أحكام النون الساكنة والتنوين',
      harakat: 'حركتان (مقدار الغنة)',
      color: '#27ae60',
      bg: 'rgba(39, 174, 96, 0.12)',
      desc: 'دمج النون الساكنة أو التنوين في الحرف الذي يليها إذا كان من أحرف (ي، ن، م، و) المجموعة في كلمة (يَنْمُو)، مع بقاء الغنة رنانة تخرج من الخيشوم مقدار حركتين.',
      types: ['إدغام ناقص مع الياء والواو', 'إدغام كامل مع النون والميم'],
      examples: [
        { word: 'مَن يَقُولُ', surah: 'البقرة: 8', note: 'إدغام النون في الياء بغنة' },
        { word: 'مِّن مَّآءٖ', surah: 'الفرقان: 54', note: 'إدغام النون في الميم بغنة' },
        { word: 'هُدٗى لِّلۡمُتَّقِينَ', surah: 'البقرة: 2', note: 'تنوين مدغم' }
      ]
    },
    idgham_no_ghunnah: {
      id: 'idgham_no_ghunnah',
      name: 'الإدغام بغير غنة',
      category: 'noon',
      categoryName: 'أحكام النون الساكنة والتنوين',
      harakat: 'بدون غنة',
      color: '#7f8c8d',
      bg: 'rgba(127, 140, 141, 0.12)',
      desc: 'دمج النون الساكنة أو التنوين دمجاً كاملاً في حرفي (اللام، والراء) بغير غنة، بحيث يصيران حرفاً واحداً مشدداً.',
      types: ['مع اللام (مثل: مِن لَّدُنْهُ)', 'مع الراء (مثل: مِّن رَّبِّهِمْ)'],
      examples: [
        { word: 'مِّن رَّبِّهِمۡ', surah: 'البقرة: 5', note: 'إدغام النون في الراء بغير غنة' },
        { word: 'هُدٗى لِّلۡمُتَّقِينَ', surah: 'البقرة: 2', note: 'إدغام التنوين في اللام بغير غنة' }
      ]
    },
    ikhfa: {
      id: 'ikhfa',
      name: 'الإخفاء الحقيقي والشفوي',
      category: 'noon',
      categoryName: 'أحكام النون والميم الساكنة',
      harakat: 'حركتان (مقدار الغنة)',
      color: '#2ecc71',
      bg: 'rgba(46, 204, 113, 0.12)',
      desc: 'النطق بالنون الساكنة أو التنوين بحالة بين الإظهار والإدغام مع مراعاة بقاء الغنة عند حروف الإخفاء الـ 15 (صف ذا ثنا كم جاد شخص قد سما دم طيبا زد في تقى ضع ظالما)، وإخفاء الميم الساكنة عند الباء (إخفاء شفوي).',
      types: ['إخفاء حقيقي عند حروفه الـ 15', 'إخفاء شفوي (الميم الساكنة عند الباء)'],
      examples: [
        { word: 'يُنفِقُونَ', surah: 'البقرة: 3', note: 'إخفاء النون عند الفاء بغنة' },
        { word: 'أَندَادٗا', surah: 'البقرة: 22', note: 'إخفاء النون عند الدال بغنة' },
        { word: 'تَرۡمِيهِم بِحِجَارَةٖ', surah: 'الفيل: 4', note: 'إخفاء شفوي (ميم عند باء)' }
      ]
    },
    iqlab: {
      id: 'iqlab',
      name: 'الإقلاب',
      category: 'noon',
      categoryName: 'أحكام النون الساكنة والتنوين',
      harakat: 'حركتان (مقدار الغنة)',
      color: '#16a085',
      bg: 'rgba(22, 160, 133, 0.12)',
      desc: 'قلب النون الساكنة أو التنوين ميماً مخفاة بغنة إذا جاء بعدها حرف (الباء)، وتوضع ميم صغيرة قائمة (مـ) فوق النون أو التنوين في رسم المصحف.',
      types: ['في كلمة واحدة (مثل: أَنۢبِئْهُم)', 'في كلمتين (مثل: مِنۢ بَعْدِ)'],
      examples: [
        { word: 'مِنۢ بَعۡدِهِۦ', surah: 'البقرة: 27', note: 'قلب النون ميماً مخفاة عند الباء' },
        { word: 'عَلِيمُۢ بِذَاتِ', surah: 'آل عمران: 119', note: 'إقلاب التنوين ميماً عند الباء' }
      ]
    },
    idhar: {
      id: 'idhar',
      name: 'الإظهار الحلقي والشفوي',
      category: 'noon',
      categoryName: 'أحكام النون والميم الساكنة',
      harakat: 'بدون غنة زائدة',
      color: '#2c3e50',
      bg: 'rgba(44, 62, 80, 0.08)',
      desc: 'إخراج كل حرف من مخرجه الصحيح دون غنة إضافية، وذلك للنون الساكنة والتنوين عند حروف الحلق الستة (أ، هـ، ع، ح، غ، خ)، وللميم الساكنة عند بقية حروف الهجاء الـ 26.',
      types: ['إظهار حلقي (همز، هاء، عين، حاء، غين، خاء)', 'إظهار شفوي (الميم الساكنة عند غير الميم والباء)'],
      examples: [
        { word: 'مَنۡ ءَامَنَ', surah: 'البقرة: 62', note: 'إظهار النون عند الهمزة' },
        { word: 'عَلَيۡهِمۡ غَيۡرِ', surah: 'الفاتحة: 7', note: 'إظهار شفوي للميم عند الغين' }
      ]
    },

    // 3. الغنة المشددة
    ghunnah_mushaddad: {
      id: 'ghunnah_mushaddad',
      name: 'الغنة المشددة (النون والميم المشددتان)',
      category: 'ghunnah',
      categoryName: 'أحكام الغنن',
      harakat: 'حركتان (وجوباً)',
      color: '#1b8a43',
      bg: 'rgba(27, 138, 67, 0.12)',
      desc: 'وجوب إظهار الغنة بمقدار حركتين عند النطق بالنون المشددة (نّ) أو الميم المشددة (مّ) وصلاً ووقفاً، سواء وقعت في وسط الكلمة أو آخرها.',
      types: ['النون المشددة (مثل: إِنَّ، النَّاس)', 'الميم المشددة (مثل: ثُمَّ، عَمَّ)'],
      examples: [
        { word: 'إِنَّ', surah: 'البقرة: 6', note: 'نون مشددة تغن حركتين' },
        { word: 'ثُمَّ', surah: 'البقرة: 28', note: 'ميم مشددة تغن حركتين' },
        { word: 'مِنَ ٱلۡجِنَّةِ وَٱلنَّاسِ', surah: 'الناس: 6', note: 'غنة مشددة في النونين' }
      ]
    },

    // 4. أحكام القلقلة
    qalqalah: {
      id: 'qalqalah',
      name: 'القلقلة',
      category: 'qalqalah',
      categoryName: 'صفات الحروف وأحكامها',
      harakat: 'نبرة واضطراب في المخرج دون حركة',
      color: '#2980b9',
      bg: 'rgba(41, 128, 185, 0.12)',
      desc: 'اضطراب صوت الحرف عند النطق به ساكناً حتى يُسمع له نبرة قوية، وتختص بخمسة أحرف مجموعة في قولهم: (قُطْبُ جَدٍّ).',
      types: [
        'صغرى: إذا كان حرف القلقلة ساكناً في وسط الكلمة (مثل: يَطْمَعُونَ، يَقْضِي)',
        'كبرى: إذا كان حرف القلقلة ساكناً مخففاً موقوفاً عليه (مثل: الْفَلَقْ، مُحِيطْ)',
        'أكبر: إذا كان حرف القلقلة مشدداً موقوفاً عليه (مثل: تَبَّ وَتَبّْ، الْحَقّْ)'
      ],
      examples: [
        { word: 'يَقۡطَعُونَ', surah: 'البقرة: 27', note: 'قلقلة صغرى في القاف' },
        { word: 'قُلۡ أَعُوذُ بِرَبِّ ٱلۡفَلَقِ', surah: 'الفلق: 1', note: 'قلقلة كبرى عند الوقف على القاف' },
        {
          word: 'تَبَّتۡ يَدَآ أَبِي لَهَبٖ وَتَبَّ',
          surah: 'المسد: 1',
          note: 'قلقلة أكبر عند الوقف على الباء المشددة'
        }
      ]
    },

    // 5. الحروف التي لا تلفظ
    silent_letters: {
      id: 'silent_letters',
      name: 'الحروف التي لا تُلفظ (المهملة وصلاً)',
      category: 'silent',
      categoryName: 'رسم المصحف وضبطه',
      harakat: 'تُسقط في النطق وتُثبت في الرسم',
      color: '#95a5a6',
      bg: 'rgba(149, 165, 166, 0.12)',
      desc: 'حروف تُكتب في رسم المصحف العثماني ولكن لا يُنطق بها في حالة الوصل، مثل همزة الوصل، واللام الشمسية المدغمة، والألف الفارقة بعد واو الجماعة، وكراسي الهمزة، والياء أو الواو الزائدة رسماً.',
      types: [
        'همزة الوصل عند درج الكلام',
        'اللام الشمسية المدغمة (مثل: الشَّمْس، النَّاس)',
        'الألف الفارقة (مثل: قَالُواْ، ءَامَنُواْ)'
      ],
      examples: [
        { word: 'وَٱسۡتَعِينُواْ', surah: 'البقرة: 45', note: 'همزة الوصل والألف الفارقة لا تنطقان' },
        { word: 'ٱلصَّلَوٰةَ', surah: 'البقرة: 3', note: 'اللام الشمسية تدغم ولا تنطق' }
      ]
    }
  };

  var TAJWEED_CATEGORIES = [
    { id: 'all', name: 'جميع الأحكام', icon: '✨' },
    { id: 'madd', name: 'أحكام المدود', icon: '🔴' },
    { id: 'noon', name: 'النون الساكنة والتنوين', icon: '🟢' },
    { id: 'ghunnah', name: 'الغنن والمشدد', icon: '🟩' },
    { id: 'qalqalah', name: 'القلقلة (قطب جد)', icon: '🔵' },
    { id: 'silent', name: 'الحروف التي لا تلفظ', icon: '⚪' }
  ];

  /* Interactive Tajweed Rule Inspector for verse text */
  function inspectAyahTajweed(text) {
    if (!text) return [];
    var results = [];
    // Rule inspection patterns
    // Madd: characters with maddah ~
    var maddMatches =
      text.match(/[\u0627\u0648\u064A\u0670\u06E1][\u0653\u0654]?\S*[\u0653]/g) ||
      text.match(/\S*[\u0653]\S*/g);
    if (maddMatches && maddMatches.length > 0) {
      maddMatches.slice(0, 3).forEach(function (m) {
        var cleanM = m.replace(/[^\u0621-\u064A\u0653\u0670]/g, '');
        results.push({
          rule: TAJWEED_RULES.madd_wajib,
          match: cleanM,
          note: 'حرف مد مع همزة أو سكون يمد بمقدار 4 إلى 6 حركات'
        });
      });
    }

    // Ghunnah Mushaddadah: نّ or مّ
    var ghunnahMatches = text.match(/[\u0646\u0645]\u0651/g);
    if (ghunnahMatches) {
      results.push({
        rule: TAJWEED_RULES.ghunnah_mushaddad,
        match: 'نّ / مّ مشددتان',
        note: 'تغن بمقدار حركتين وصلاً ووقفاً'
      });
    }

    // Qalqalah: قطب جد with sukoon or at end
    var qalqalahMatches = text.match(/[\u0642\u0637\u0628\u062c\u062f][\u0652\u06df]/g);
    if (qalqalahMatches) {
      results.push({
        rule: TAJWEED_RULES.qalqalah,
        match: 'حرف قلقلة ساكن (ق، ط، ب، ج، د)',
        note: 'نبرة واضطراب في المخرج'
      });
    }

    // Iqlab: noon or tanween followed by meem sign or ba
    if (
      text.indexOf('ۢ') >= 0 ||
      text.indexOf('ۭ') >= 0 ||
      /[\u064B\u064C\u064D\u0646]\s*\u0628/.test(text)
    ) {
      results.push({
        rule: TAJWEED_RULES.iqlab,
        match: 'إقلاب النون أو التنوين ميماً مخفاة عند الباء',
        note: 'تقلب ميماً مخفاة بغنة حركتين'
      });
    }

    // Idgham with ghunnah: Tanween or noon followed by y, n, m, w
    if (
      /[\u064B\u064C\u064D\u0646]\s*[\u064A\u0646\u0645\u0648]/.test(text) ||
      text.indexOf('يَنْمُو') >= 0
    ) {
      results.push({
        rule: TAJWEED_RULES.idgham_ghunnah,
        match: 'إدغام بغنة (في أحرف: ينمو)',
        note: 'دمج الحرفين مع بقاء الغنة حركتين'
      });
    }

    // Ikhfa: noon or tanween followed by ikhfa letters
    if (
      /[\u064B\u064C\u064D\u0646]\s*[\u0635\u0630\u062B\u0643\u062C\u0634\u0642\u0633\u062F\u0637\u0632\u0641\u062A\u0636\u0638]/.test(
        text
      )
    ) {
      results.push({
        rule: TAJWEED_RULES.ikhfa,
        match: 'إخفاء حقيقي عند حروف الإخفاء الـ 15',
        note: 'حالة بين الإظهار والإدغام مع الغنة'
      });
    }

    // Fallback if none found
    if (results.length === 0) {
      results.push({
        rule: TAJWEED_RULES.idhar,
        match: 'إظهار وتلاوة محكمة',
        note: 'إخراج الحروف من مخارجها الصحيحة بأحكام الضبط والإتقان'
      });
    }

    return results;
  }

  window.TajweedGuide = {
    rules: TAJWEED_RULES,
    categories: TAJWEED_CATEGORIES,
    inspectAyah: inspectAyahTajweed,
    getRule: function (id) {
      return TAJWEED_RULES[id];
    }
  };
})(window);


/* ======================================================================
 * 4. المصحف الرئيسي (MushafRuntime)
 * المحرك الأساسي: الصفحات، الخطوط، البحث، العلامات، التسميع، التفسير، الإعدادات…
 * ====================================================================== */
(function () {
  /* عامل (Web Worker) مضمَّن: يبحث في meanings.json بعيدًا عن الخيط الرئيسي حتى لا تتجمد الواجهة.
   * كان ملفًا منفصلًا (word-data-worker.js)؛ صار دالة تُحوَّل إلى نص ثم Blob.
   * ⚠ جسم الدالة يعمل داخل الـ Worker فقط: لا يصله أي متغير من هذا الملف.
   * الرابط يُمرَّر مطلقًا لأن عامل الـ Blob لا يعرف المسار النسبي للصفحة. */
  function wordDataWorkerMain(meaningsUrl) {
    var meaningsPromise = null;

    function normalizeArabic(value) {
      return String(value || '')
        .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .replace(/ة/g, 'ه');
    }

    function normalizeWord(value) {
      return normalizeArabic(value).replace(/[^\u0621-\u064A\u0671]/g, '');
    }

    function loadMeanings() {
      if (!meaningsPromise) {
        meaningsPromise = fetch(meaningsUrl).then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        }).then(function (dataset) {
          if (!dataset || !dataset.license || !Array.isArray(dataset.data)) {
            throw new Error('تنسيق ملف معاني غريب القرآن غير صالح');
          }
          return dataset;
        }).catch(function (error) {
          meaningsPromise = null;
          throw error;
        });
      }
      return meaningsPromise;
    }

    function findMeaning(request) {
      return loadMeanings().then(function (dataset) {
        var entry = dataset.data.find(function (item) {
          return item && item.surah === request.surah && item.ayah === request.ayah;
        });
        var books = entry && Array.isArray(entry.meanings) ? entry.meanings : [];
        var selectedKey = normalizeWord(request.word);
        if (!selectedKey) return '';
        var supportedBookIds = [491, 327, 1424];
        var availableBooks = books.filter(function (book) {
          return book && book.book_info && supportedBookIds.indexOf(+book.book_info.id) >= 0 &&
            Array.isArray(book.words);
        });
        availableBooks.sort(function (a, b) {
          return (+a.book_info.id === +request.bookId ? -1 : 0) -
            (+b.book_info.id === +request.bookId ? -1 : 0);
        });
        for (var i = 0; i < availableBooks.length; i++) {
          var book = availableBooks[i];
          var match = book.words.find(function (item) {
            if (!item || !item.text || !item.meaning) return false;
            var entryKey = normalizeWord(item.text);
            var entryWords = item.text.split(/\s+/).map(normalizeWord);
            return entryKey === selectedKey || entryWords.indexOf(selectedKey) >= 0 ||
              (selectedKey.length >= 4 && entryKey.indexOf(selectedKey) >= 0);
          });
          if (match) return { text: match.meaning, word: match.text, book: book.book_info.name };
        }
        return '';
      });
    }

    self.addEventListener('message', function (event) {
      var request = event.data;
      if (!request || !Number.isInteger(request.id)) return;
      var operation = request.type === 'meaning' ? findMeaning(request) :
        Promise.reject(new Error('عملية بيانات غير معروفة'));
      operation.then(function (result) {
        self.postMessage({ id: request.id, result: result });
      }).catch(function (error) {
        self.postMessage({ id: request.id, error: error && error.message ? error.message : 'تعذر تحميل بيانات التحليل' });
      });
    });
  }
  function createWordDataWorker() {
    var meaningsUrl = new URL('./meanings.json', location.href).href;
    var source = '(' + wordDataWorkerMain + ')(' + JSON.stringify(meaningsUrl) + ');';
    var url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    var worker = new Worker(url);
    URL.revokeObjectURL(url);
    return worker;
  }
  var AR = '٠١٢٣٤٥٦٧٨٩';
  /* ======== 1) أدوات عامة: أرقام عربية، DOM، تخزين محلي (localStorage)، حساب مواقع الآيات والصفحات والأجزاء ======== */
  function ar(n) {
    return String(n).replace(/\d/g, function (d) {
      return AR[d];
    });
  }
  function parseNum(s) {
    s = String(s)
      .replace(/[٠-٩]/g, function (c) {
        return AR.indexOf(c);
      })
      .replace(/[^\d]/g, '');
    return s ? parseInt(s, 10) : NaN;
  }
  function $(id) {
    return document.getElementById(id);
  }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      localStorage.setItem(k, v);
    } catch (e) {}
    return null;
  }
  function load(k, def) {
    try {
      var x = JSON.parse(store(k) || 'null');
      return x == null ? def : x;
    } catch (e) {
      return def;
    }
  }

  var TOTAL = D.pages.length - 1;
  var JUZ = [
    'الأول',
    'الثاني',
    'الثالث',
    'الرابع',
    'الخامس',
    'السادس',
    'السابع',
    'الثامن',
    'التاسع',
    'العاشر',
    'الحادي عشر',
    'الثاني عشر',
    'الثالث عشر',
    'الرابع عشر',
    'الخامس عشر',
    'السادس عشر',
    'السابع عشر',
    'الثامن عشر',
    'التاسع عشر',
    'العشرون',
    'الحادي والعشرون',
    'الثاني والعشرون',
    'الثالث والعشرون',
    'الرابع والعشرون',
    'الخامس والعشرون',
    'السادس والعشرون',
    'السابع والعشرون',
    'الثامن والعشرون',
    'التاسع والعشرون',
    'الثلاثون'
  ];

  var START = [];
  (function () {
    var a = 1;
    D.surahs.forEach(function (s) {
      START.push(a);
      a += s[3];
    });
  })();
  function locate(id) {
    var lo = 0,
      hi = 113;
    while (lo < hi) {
      var m = (lo + hi + 1) >> 1;
      if (START[m] <= id) lo = m;
      else hi = m - 1;
    }
    return [lo + 1, id - START[lo] + 1];
  }
  function idOf(s, a) {
    return START[s - 1] + a - 1;
  }
  function pageOfId(id) {
    var lo = 1,
      hi = TOTAL;
    while (lo < hi) {
      var m = (lo + hi + 1) >> 1;
      if (D.pages[m - 1] <= id) lo = m;
      else hi = m - 1;
    }
    return lo;
  }
  function juzOfId(id) {
    var j = 0;
    while (j < 29 && D.juz[j + 1] <= id) j++;
    return j + 1;
  }
  function verseText(s, a) {
    return D.texts[s - 1][a - 1].replace(/ /g, '');
  }
  /* ======== تلوين لفظ الجلالة والرب ======== */
  var WORD_COUNTS = null;
  var DIVINE = { enabled: store('mq.divine') === '1', cache: Object.create(null) };
  function wordCountsMatch(v) {
    if (!WORD_COUNTS) {
      var cnt = Object.create(null);
      G.forEach(function (page) {
        page.forEach(function (l) {
          if (l[0] !== 'w') return;
          l[2].forEach(function (it) {
            if (it[0] && it[2] > 0 && it[2] > (cnt[it[0]] || 0)) cnt[it[0]] = it[2];
          });
        });
      });
      WORD_COUNTS = cnt;
    }
    var s = Math.floor(v / 1000),
      a = v % 1000;
    return !!D.texts[s - 1] && WORD_COUNTS[v] === verseText(s, a).split(/\s+/).filter(Boolean).length;
  }
  var DIVINE_RE = /^[وفبلكت]*(?:الله|لله|اللهم)$|^[وفبلك]*رب(?:ك|كم|كما|نا|ي|ه|ها|هم|هما)?$/;
  function isDivineWord(raw) {
    if (raw in DIVINE.cache) return DIVINE.cache[raw];
    var ok = DIVINE_RE.test(normalizeTasmeeWord(raw));
    DIVINE.cache[raw] = ok;
    return ok;
  }
  function refreshWordMarks(root) {
    (root || document).querySelectorAll('.w[data-v]').forEach(function (w) {
      var pos = +w.getAttribute('data-p');
      if (!(pos > 0)) return;
      var v = +w.getAttribute('data-v');
      var s = Math.floor(v / 1000),
        a = v % 1000;
      var divineOn = false;
      if (DIVINE.enabled && D.texts[s - 1] && wordCountsMatch(v)) {
        var raw = verseText(s, a).split(/\s+/).filter(Boolean)[pos - 1];
        divineOn = !!raw && isDivineWord(raw);
      }
      w.classList.toggle('w-divine', divineOn);
    });
  }
  function setDivineEnabled(on) {
    DIVINE.enabled = !!on;
    store('mq.divine', on ? '1' : '0');
    refreshWordMarks();
  }
  // الصفحات تُرسم تدريجيًا (وبعد تحميل الخطوط): نعيد وسم الكلمات عند إضافة عناصر جديدة.
  var wordMarkTimer = 0;
  new MutationObserver(function (records) {
    if (!DIVINE.enabled) return;
    clearTimeout(wordMarkTimer);
    wordMarkTimer = setTimeout(function () {
      refreshWordMarks();
    }, 120);
  }).observe(document.getElementById('pageList') || document.body, { childList: true, subtree: true });

  function fam(n) {
    return 'QCF4_Hafs_' + (n < 10 ? '0' : '') + n;
  }
  function hdrChar(s) {
    return String.fromCharCode(0xf100 + s - 1);
  }
  /* ---------- saved state ---------- */
  var COL = {
    red: ['#c8283a', 'الأحمر'],
    yellow: ['#d9a21b', 'الأصفر'],
    green: ['#3aa24a', 'الأخضر'],
    blue: ['#1f7fc4', 'الأزرق'],
    purple: ['#8a4fc7', 'البنفسجي'],
    orange: ['#e8782a', 'البرتقالي'],
    pink: ['#d94f8c', 'الوردي'],
    teal: ['#159a9a', 'الفيروزي']
  };
  var ANNOT_PALETTE = ['purple', 'blue', 'green', 'yellow', 'red'];
  var PALETTE = ANNOT_PALETTE.slice();
  var slots = load('mq.slots', []);
  if (!Array.isArray(slots)) slots = [];
  if (store('mq.marksCleared') !== '1') {
    slots = [];
    store('mq.slots', '[]');
    store('mq.marksCleared', '1');
  }
  slots = slots.filter(function (slot) {
    return slot.id !== 'red';
  });
  save('mq.slots', slots);
  try {
    localStorage.removeItem('mq.wird');
  } catch (e) {}
  var pageAnnotations = load('mq.annotations', {});
  var verseNotes = load('mq.verseNotes', {});
  if (!verseNotes || typeof verseNotes !== 'object' || Array.isArray(verseNotes)) verseNotes = {};
  var gharibBookId = load('mq.gharibBook', 491);
  if ([491, 327, 1424].indexOf(+gharibBookId) < 0) gharibBookId = 491;
  Object.keys(verseNotes).forEach(function (key) {
    var entry = verseNotes[key];
    if (!/^\d{4,6}$/.test(key) || !entry || typeof entry.text !== 'string') delete verseNotes[key];
    else entry.text = entry.text.slice(0, 1000);
  });
  var annotPrefs = load('mq.annotPrefs', {
    enabled: false,
    mode: 'word',
    type: 'highlight',
    color: 'yellow'
  });
  if (['word', 'verse'].indexOf(annotPrefs.mode) < 0) annotPrefs.mode = 'word';
  if (['highlight', 'underline', 'erase'].indexOf(annotPrefs.type) < 0) annotPrefs.type = 'highlight';
  if (ANNOT_PALETTE.indexOf(annotPrefs.color) < 0) annotPrefs.color = 'yellow';
  var annotEnabled = !!annotPrefs.enabled;
  function save(k, v) {
    store(k, JSON.stringify(v));
  }
  function saveSlots() {
    save('mq.slots', slots);
  }

  function slotById(id) {
    for (var i = 0; i < slots.length; i++) if (slots[i].id === id) return slots[i];
    return null;
  }
  function slotName(s) {
    if (s.nm) return s.nm;
    if (s.v) return 'سورة ' + D.surahs[Math.floor(s.v / 1000) - 1][1];
    return COL[s.c][1];
  }
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  var esc = escapeHtml;
  function addMarkSlot(color, name, verse) {
    var id = 'x' + Date.now();
    while (slotById(id)) id += 'x';
    var slot = { id: id, c: color, nm: name, v: verse || 0, ts: verse ? Date.now() : 0 };
    slots.push(slot);
    saveSlots();
    return slot;
  }
  function fmtTs(ts) {
    var d = new Date(ts),
      n = new Date();
    if (d.toDateString() === n.toDateString()) {
      var h = d.getHours(),
        m = d.getMinutes();
      return ar(h % 12 || 12) + ':' + ar((m < 10 ? '0' : '') + m) + ' ' + (h < 12 ? 'ص' : 'م');
    }
    return ar(d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate());
  }
  function slotSub(s) {
    return s.v ? fmtTs(s.ts) + '  ' + label(s.v) + ' - الصفحة ' + ar(pageOfV(s.v)) : '';
  }
  var BM_F = 'M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z';
  var BM_O = 'M17 3H7a2 2 0 0 0-2 2v16l7-3 7 3V5a2 2 0 0 0-2-2zm0 15-5-2.2L7 18V5h10z';
  function bmSvg(c, filled) {
    return (
      '<svg viewBox="0 0 24 24" fill="' + COL[c][0] + '"><path d="' + (filled ? BM_F : BM_O) + '"/></svg>'
    );
  }
  function label(v) {
    return D.surahs[Math.floor(v / 1000) - 1][1] + ':' + ar(v % 1000);
  }
  function pageOfV(v) {
    return pageOfId(idOf(Math.floor(v / 1000), v % 1000));
  }

  /* ---------- drawing ---------- */
  var pageEl = $('page'),
    pageList = $('pageList'),
    mEl = $('measure');
  var activeView = pageList.querySelector('.page-view'),
    sheet = activeView.querySelector('.sheet');
  var cur = 1,
    sel = 0,
    widths = {},
    renderQueue = Promise.resolve(),
    quranTextFallbackMode = false;
  var loadingPrevious = false;
  // طريقة تقليب الصفحات: vertical = تمرير رأسي متصل، horizontal = صفحة واحدة بالسحب الأفقي
  var scrollMode = store('mq.scrollMode') === 'horizontal' ? 'horizontal' : 'vertical';
  document.body.classList.toggle('hmode', scrollMode === 'horizontal');
  var autoScrollRestoreMode = null;

  function bannerSVG() {
    return (
      '<svg viewBox="0 0 1000 124" preserveAspectRatio="none" aria-hidden="true">' +
      '<rect class="f-frame" x="2" y="2" width="996" height="120" rx="9"/>' +
      '<rect class="f-inner" x="10" y="10" width="980" height="104" rx="5"/>' +
      '<rect class="f-arab" x="14" y="14" width="316" height="96"/><rect class="f-arab" x="670" y="14" width="316" height="96"/>' +
      '<use href="#flower" transform="translate(172 62) scale(1.02)"/><use href="#flower" transform="translate(828 62) scale(1.02)"/>' +
      '<path class="f-cart" d="M312 62 L352 10 H648 L688 62 L648 114 H352 Z"/>' +
      '<path class="f-inner" d="M328 62 L360 19 H640 L672 62 L640 105 H360 Z"/></svg>'
    );
  }

  function measureLine(l, key) {
    if (widths[key]) return widths[key];
    var ws = [];
    mEl.innerHTML = '';
    var spans = [];
    if (l[0] === 'w')
      l[2].forEach(function (it) {
        var s = document.createElement('span');
        s.style.fontFamily = fam(l[1]);
        s.textContent = it[1];
        mEl.appendChild(s);
        spans.push(s);
      });
    else if (l[0] === 'b') {
      var s = document.createElement('span');
      s.style.fontFamily = fam(1);
      s.textContent = l[1];
      mEl.appendChild(s);
      spans.push(s);
    } else {
      var s2 = document.createElement('span');
      s2.style.fontFamily = 'QCF4_QBSML';
      s2.textContent = hdrChar(l[1]);
      mEl.appendChild(s2);
      spans.push(s2);
    }
    spans.forEach(function (s) {
      ws.push(s.getBoundingClientRect().width);
    });
    mEl.innerHTML = '';
    widths[key] = ws;
    return ws;
  }

  /* ---------- إدارة خطوط التجويد الملون لمجمع الملك فهد لكل صفحة ---------- */
  var tajweedDownloaded = !!load('mq.tajweedDownloaded', false);
  var tajweedOn = tajweedDownloaded && !!load('mq.tajweed', false);
  var tajweedLegendVisible = load('mq.tajweedLegendVisible', false);
  var tajweedLoaded = {};
  var tajweedFontData = window.MushafTajweedData;
  var tajweedFontIndex = tajweedFontData && tajweedFontData.fonts;
  if (tajweedFontIndex && !Array.isArray(tajweedFontIndex)) tajweedFontIndex = tajweedFontIndex.value;
  var tajweedGlyphsByPage = {};
  /* كاش الملفات الثقيلة (خطوط المصحف والتجويد). يجب أن يطابق ASSET_CACHE في sw.js،
   * ومنفصل عن كاش الإصدار حتى لا تُحذف الخطوط مع كل تحديث للتطبيق. */
  var ASSET_CACHE_NAME = 'quran-assets-v1';
  var tajweedChunkPromises = {};
  var tajweedFontPromises = {};
  var tajweedPaletteStyle = document.createElement('style');
  document.head.appendChild(tajweedPaletteStyle);

  function getPageTajweedGlyphs(p) {
    if (tajweedGlyphsByPage[p]) return tajweedGlyphsByPage[p];
    var glyphText = tajweedFontData && tajweedFontData.glyphs && tajweedFontData.glyphs[p - 1];
    if (typeof glyphText !== 'string') throw new Error('بيانات رموز التجويد غير متوفرة للصفحة ' + p);
    var glyphs = glyphText.split('\u0000');
    var lines = G[p - 1] || [],
      expected = 0;
    lines.forEach(function (line) {
      if (line[0] === 'w') expected += line[2].length;
    });
    if (glyphs.length !== expected) {
      throw new Error('عدد رموز التجويد لا يطابق كلمات الصفحة ' + p);
    }
    tajweedGlyphsByPage[p] = glyphs;
    return glyphs;
  }

  function loadTajweedChunk(chunkIndex) {
    if (!tajweedChunkPromises[chunkIndex]) {
      var chunkName = 'c' + (chunkIndex < 10 ? '0' : '') + chunkIndex;
      var chunkUrl = './fonts/tajweed/' + chunkName + '.woff2';
      function requestChunk(retry) {
        var cachedChunk =
          'caches' in window
            ? caches.open(ASSET_CACHE_NAME).then(function (cache) {
                return cache.match(chunkUrl);
              })
            : Promise.resolve(null);
        return cachedChunk
          .then(function (response) {
            if (response) return response.arrayBuffer();
            return fetch(chunkUrl, retry ? { cache: 'reload' } : undefined).then(function (networkResponse) {
              if (!networkResponse.ok)
                throw new Error(
                  'تعذر تحميل ملف الخط ' + chunkName + ' (HTTP ' + networkResponse.status + ')'
                );
              var copy = networkResponse.clone();
              return networkResponse.arrayBuffer().then(function (buffer) {
                if ('caches' in window) {
                  return caches.open(ASSET_CACHE_NAME).then(function (cache) {
                    return cache.put(chunkUrl, copy).then(function () {
                      return buffer;
                    });
                  });
                }
                return buffer;
              });
            });
          })
          .then(function (buffer) {
            if (!buffer.byteLength) throw new Error('ملف الخط ' + chunkName + ' فارغ');
            return buffer;
          })
          .catch(function (error) {
            if (!retry)
              return new Promise(function (resolve) {
                setTimeout(resolve, 250);
              }).then(function () {
                return requestChunk(true);
              });
            throw error;
          });
      }
      tajweedChunkPromises[chunkIndex] = requestChunk(false).catch(function (error) {
        delete tajweedChunkPromises[chunkIndex];
        throw error;
      });
    }
    return tajweedChunkPromises[chunkIndex];
  }

  function registerTajweedPalettes(p, family) {
    var lightPalette = '--tjl' + p,
      darkPalette = '--tjd' + p;
    tajweedPaletteStyle.appendChild(
      document.createTextNode(
        '@font-palette-values ' +
          lightPalette +
          '{font-family:"' +
          family +
          '";base-palette:0;override-colors:10 #b79f7c,11 #f3eadb,12 #f3eadb}' +
          '@font-palette-values ' +
          darkPalette +
          '{font-family:"' +
          family +
          '";base-palette:1;override-colors:10 #8d7550,11 #2b251b,12 #2b251b}'
      )
    );
    // لوحتان حمراوان لتلوين لفظ الجلالة داخل المصحف الملوّن (كل ألوان الخط تُستبدل بالأحمر).
    var reds = function (hex) {
      var list = [];
      for (var i = 0; i < 48; i++) list.push(i + ' ' + hex);
      return list.join(',');
    };
    tajweedPaletteStyle.appendChild(
      document.createTextNode(
        '@font-palette-values --tjr' + p + '{font-family:"' + family + '";base-palette:0;override-colors:' + reds('#c62828') + '}' +
          '@font-palette-values --tjrd' + p + '{font-family:"' + family + '";base-palette:1;override-colors:' + reds('#ff6b6b') + '}'
      )
    );
    return { light: lightPalette, dark: darkPalette, divine: '--tjr' + p, divineDark: '--tjrd' + p };
  }

  function loadTajweedFont(p) {
    if (!p || p < 1 || p > TOTAL) return Promise.resolve(null);
    if (tajweedLoaded[p]) return Promise.resolve('TJ' + p);
    if (tajweedFontPromises[p]) return tajweedFontPromises[p];
    try {
      getPageTajweedGlyphs(p);
      if (!Array.isArray(tajweedFontIndex) || !Array.isArray(tajweedFontIndex[p - 1])) {
        throw new Error('فهرس خط التجويد غير متوفر للصفحة ' + p);
      }
      var fontInfo = tajweedFontIndex[p - 1];
      var chunkIndex = fontInfo[0],
        offset = fontInfo[1],
        length = fontInfo[2];
      if (
        !Number.isInteger(chunkIndex) ||
        !Number.isInteger(offset) ||
        !Number.isInteger(length) ||
        chunkIndex < 0 ||
        offset < 0 ||
        length <= 0
      ) {
        throw new Error('فهرس خط التجويد غير صالح للصفحة ' + p);
      }
      var family = 'TJ' + p;
      tajweedFontPromises[p] = loadTajweedChunk(chunkIndex)
        .then(function (buffer) {
          if (offset + length > buffer.byteLength)
            throw new Error('بيانات خط التجويد غير مكتملة للصفحة ' + p);
          return new FontFace(family, buffer.slice(offset, offset + length)).load();
        })
        .then(function (loaded) {
          document.fonts.add(loaded);
          tajweedLoaded[p] = registerTajweedPalettes(p, family);
          return family;
        })
        .catch(function (error) {
          delete tajweedFontPromises[p];
          throw error;
        });
      return tajweedFontPromises[p];
    } catch (error) {
      return Promise.reject(error);
    }
  }

  function ensureFonts(lines, p) {
    var need = { QCF4_QBSML: 'ا' };
    lines.forEach(function (l) {
      if (l[0] === 'w') need[fam(l[1])] = l[2][0][1];
      else if (l[0] === 'b') need[fam(1)] = l[1];
    });
    var proms = Object.keys(need).map(function (f) {
      return document.fonts.load('100px "' + f + '"', need[f]).then(function (faces) {
        if (
          !faces.some(function (face) {
            return face.family.replace(/["']/g, '') === f;
          })
        ) {
          throw new Error('تعذر تفعيل خط المصحف ' + f);
        }
      });
    });
    if (tajweedOn && p) {
      proms.push(
        loadTajweedFont(p).then(function (family) {
          if (!family) throw new Error('تعذر تفعيل خط التجويد للصفحة ' + p);
        })
      );
    }
    return Promise.all(proms);
  }

  /* ======== 2) عرض صفحات المصحف: إنشاء الصفحة، الخطوط، التمرير المتصل، التظليل ======== */
  function createPageView(p) {
    var view = document.createElement('section');
    view.className = 'page-view';
    view.setAttribute('data-page', String(p));
    view.innerHTML =
      '<div class="run"><button type="button" class="open-juz" aria-label="فتح فهرس السور"></button>' +
      '<svg class="bm" viewBox="0 0 24 24" hidden aria-label="صفحة عليها فاصل"><path d="M6 2h12a1 1 0 0 1 1 1v19l-7-4-7 4V3a1 1 0 0 1 1-1z"/></svg>' +
      '<span class="names"></span></div>' +
      '<div class="sheet"></div><div class="foot"><button type="button" class="badge" aria-label="فتح فهرس السور"></button></div>';
    return view;
  }

  function syncPageStatus(view, p) {
    if (DIVINE.enabled || view.querySelector('.w-divine')) refreshWordMarks(view);
    var lines = G[p - 1],
      secs = [],
      seen = {};
    lines.forEach(function (l) {
      if (l[0] === 'w')
        l[2].forEach(function (it) {
          if (it[0]) {
            var s = Math.floor(it[0] / 1000);
            if (!seen[s]) {
              seen[s] = 1;
              secs.push(s);
            }
          }
        });
    });
    view.querySelector('.open-juz').textContent = 'الجزء ' + JUZ[juzOfId(D.pages[p - 1]) - 1];
    view.querySelector('.names').textContent = secs
      .map(function (s) {
        return D.surahs[s - 1][1];
      })
      .join(' ');
    view.querySelector('.badge').textContent = ar(p);

    if (activeView === view) {
      if (document.activeElement !== $('pgIn')) $('pgIn').value = ar(p);
      $('pgTotal').textContent = '/ ' + ar(TOTAL);
      $('bPrev').disabled = p <= 1;
      $('bNext').disabled = p >= TOTAL;
      updateBm();
      document.querySelectorAll('#paneSurahs .srow[data-s]').forEach(function (r) {
        r.classList.toggle('here', secs.indexOf(+r.getAttribute('data-s')) >= 0);
      });
      syncIndexHighlights(p);
    }
  }

  function syncIndexHighlights(page) {
  }

  function ensureTajweedLegend(view) {
    if (view.querySelector('.tajweed-legend-bar')) return;
    var template = $('tajweedLegendBar');
    var foot = view.querySelector('.foot');
    if (!template || !foot) return;
    var legend = template.cloneNode(true);
    legend.removeAttribute('id');
    legend.hidden = !(tajweedOn && tajweedLegendVisible);
    legend.querySelectorAll('[id]').forEach(function (element) {
      element.removeAttribute('id');
    });
    foot.insertBefore(legend, foot.querySelector('.badge'));
  }

  function renderFallbackText(view, page) {
    var targetSheet = view.querySelector('.sheet');
    var firstAyah = +D.pages[page - 1];
    var lastAyah =
      page < TOTAL ? +D.pages[page] - 1 : START[START.length - 1] + D.surahs[D.surahs.length - 1][3] - 1;
    if (!Array.isArray(D.texts) || !firstAyah || lastAyah < firstAyah) {
      throw new Error('النص العربي المضمّن للمصحف غير متوفر');
    }
    var html = '';
    for (var ayahId = firstAyah; ayahId <= lastAyah; ayahId++) {
      var location = locate(ayahId),
        surah = location[0],
        ayah = location[1];
      var verseId = surah * 1000 + ayah;
      var text = D.texts[surah - 1] && D.texts[surah - 1][ayah - 1];
      if (typeof text !== 'string' || !text.trim()) continue;
      var words = text.trim().split(/\s+/);
      var wordHtml = words
        .map(function (word, index) {
          return (
            '<span class="w" data-v="' +
            verseId +
            '" data-p="' +
            (index + 1) +
            '">' +
            escapeHtml(word) +
            '</span>'
          );
        })
        .join(' ');
      html +=
        '<div class="ln fallback-ln" data-vs="' +
        verseId +
        '">' +
        wordHtml +
        '<span class="fallback-ayah-end" aria-label="نهاية الآية ' +
        ar(ayah) +
        '">﴿' +
        ar(ayah) +
        '﴾</span></div>';
    }
    if (!html) throw new Error('لا توجد نصوص لصفحة المصحف ' + page);
    targetSheet.classList.add('text-fallback');
    targetSheet.classList.remove('tajweed-active');
    targetSheet.style.removeProperty('--tajweed-light-palette');
    targetSheet.style.removeProperty('--tajweed-dark-palette');
    targetSheet.setAttribute('data-tajweed-mode', tajweedOn ? 'on' : 'off');
    targetSheet.innerHTML = html;
    var legend = view.querySelector('.tajweed-legend-bar');
    if (legend) legend.hidden = true;
    paintSel(targetSheet, page);
    paintSlots(targetSheet, page);
    paintAnnotations(targetSheet, page);
    applyTasmeeWordState(targetSheet);
    if (activeView === view) sheet = targetSheet;
  }

  function activatePage(view) {
    if (!view) return;
    var viewPage = +view.getAttribute('data-page');
    var renderedMode = view.querySelector('.sheet').getAttribute('data-tajweed-mode');
    if (renderedMode !== (tajweedOn ? 'on' : 'off')) render(view, viewPage);
    if (view === activeView) return;
    if (activeView) activeView.classList.remove('active');
    view.classList.add('active');
    activeView = view;
    sheet = view.querySelector('.sheet');
    cur = +view.getAttribute('data-page');
    store('mq.page', String(cur));
    if (document.activeElement !== $('pgIn')) $('pgIn').value = ar(cur);
    $('bPrev').disabled = cur <= 1;
    $('bNext').disabled = cur >= TOTAL;
    updateBm();
    var seen = {};
    sheet.querySelectorAll('.w[data-v]').forEach(function (w) {
      var v = +w.getAttribute('data-v');
      if (v) seen[Math.floor(v / 1000)] = 1;
    });
    document.querySelectorAll('#paneSurahs .srow[data-s]').forEach(function (r) {
      r.classList.toggle('here', !!seen[+r.getAttribute('data-s')]);
    });
    syncIndexHighlights(cur);
  }

  function render(view, p) {
    p = p || cur;
    view = view || activeView;
    var lines = G[p - 1],
      targetSheet = view.querySelector('.sheet');
    ensureTajweedLegend(view);
    targetSheet.setAttribute('data-tajweed-mode', tajweedOn ? 'on' : 'off');
    view.classList.toggle('opening', p <= 2);
    syncPageStatus(view, p);
    renderQueue = renderQueue
      .catch(function (error) {
        console.error('تعذر تجهيز الصفحة السابقة للمصحف:', error);
      })
      .then(function () {
        if (quranTextFallbackMode) {
          if (view.isConnected) renderFallbackText(view, p);
          return;
        }
        return ensureFonts(lines, p)
          .then(function () {
            if (!view.isConnected) return;
            targetSheet.classList.remove('text-fallback');
            var W = view.clientWidth,
              Wc = W * 0.968;
            var gapMin = 0.13,
              M = 0,
              info = [];
            lines.forEach(function (l, i) {
              if (l[0] !== 'w') {
                info.push(null);
                return;
              }
              var ws = measureLine(l, p + ':' + i),
                sum = 0;
              ws.forEach(function (x) {
                sum += x;
              });
              var em = sum / 100 + gapMin * (ws.length - 1);
              info.push({ ws: ws, em: em });
              if (em > M) M = em;
            });
            var fs = M ? Wc / M : W * 0.085;
            fs = Math.min(fs, W * 0.085);
            if (p <= 2) fs *= 0.85;
            var spaced = p > 2,
              html = '';
            var useTajweed = tajweedOn && tajweedLoaded[p];
            var tajweedGlyphs = useTajweed ? getPageTajweedGlyphs(p) : null;
            var tajweedWordIndex = 0;
            targetSheet.classList.toggle('tajweed-active', !!useTajweed);
            if (useTajweed) {
              targetSheet.style.setProperty('--tajweed-light-palette', tajweedLoaded[p].light);
              targetSheet.style.setProperty('--tajweed-dark-palette', tajweedLoaded[p].dark);
              targetSheet.style.setProperty('--tajweed-divine-palette', tajweedLoaded[p].divine);
              targetSheet.style.setProperty('--tajweed-divine-dark-palette', tajweedLoaded[p].divineDark);
            } else {
              targetSheet.style.removeProperty('--tajweed-light-palette');
              targetSheet.style.removeProperty('--tajweed-dark-palette');
            }

            lines.forEach(function (l, i) {
              if (l[0] === 'h') {
                var hw = measureLine(l, p + ':' + i)[0] / 100,
                  hs = Math.min(W * 0.078, (W * 0.3) / hw);
                html +=
                  '<div class="hdr">' +
                  bannerSVG() +
                  '<span class="hn" style="font-size:' +
                  hs.toFixed(2) +
                  'px">' +
                  hdrChar(l[1]) +
                  '</span></div>';
              } else if (l[0] === 'b') {
                var bw = measureLine(l, p + ':' + i)[0] / 100,
                  bs = Math.min(W * 0.092, (W * 0.58) / bw);
                html += '<div class="bis" style="font-size:' + bs.toFixed(2) + 'px">' + l[1] + '</div>';
              } else {
                var full = spaced && info[i].em >= 0.84 * M,
                  vs = {};
                var fontFam = useTajweed ? 'TJ' + p : fam(l[1]);
                var inner = l[2]
                  .map(function (it) {
                    if (it[0]) vs[it[0]] = 1;
                    var char = useTajweed ? tajweedGlyphs[tajweedWordIndex++] : it[1];
                    return (
                      '<span class="w" data-v="' +
                      it[0] +
                      '" data-p="' +
                      (it[2] || 0) +
                      '" style="font-family:' +
                      fontFam +
                      '">' +
                      char +
                      '</span>'
                    );
                  })
                  .join('');
                html +=
                  '<div class="ln ' +
                  (full ? 'full' : 'cen') +
                  '" data-vs="' +
                  Object.keys(vs).join(',') +
                  '" style="font-size:' +
                  fs.toFixed(2) +
                  'px">' +
                  inner +
                  '</div>';
              }
            });
            targetSheet.innerHTML = html;
            paintSel(targetSheet, p);
            paintSlots(targetSheet, p);
            paintAnnotations(targetSheet, p);
            applyTasmeeWordState(targetSheet);
            if (activeView === view) sheet = targetSheet;
            prefetch(p);
          })
          .catch(function (error) {
            console.error('تعذر تحميل خطوط صفحة المصحف ' + p + ':', error);
            quranTextFallbackMode = true;
            document.body.classList.add('quran-text-fallback');
            showQuranTextNotice('تعذر تحميل خط هذه الصفحة، فتُعرض مؤقتًا بالنص المبسّط.', {
              title: 'تعمل بالنص المبسّط',
              compact: true
            });
            if (view.isConnected) renderFallbackText(view, p);
          });
      });
  }

  function clearTasmeeMistake(verseId, position) {
    delete tasmeeRetainedMistakes[tasmeeMistakeKey(verseId, position)];
    var state = tasmeeSession && tasmeeSession.byId[String(verseId)];
    if (state) {
      delete state.mistakes[position];
      state.revealed[position] = true;
    }
    applyTasmeeWordState(pageList);
    if (refreshActiveWordMeaning) refreshActiveWordMeaning();
  }

  function hasTasmeeMistake(verseId, position) {
    var state = tasmeeSession && tasmeeSession.byId[String(verseId)];
    return (
      !!tasmeeRetainedMistakes[tasmeeMistakeKey(verseId, position)] || !!(state && state.mistakes[position])
    );
  }

  function renderInitialPage(p) {
    var firstOpen = !store('mq.pagesPreparedV2');
    pageList.innerHTML = '';
    if (firstOpen) {
      /* Render the visible page first and keep the rest lazy; render() uses
             embedded Arabic text whenever the Quran fonts are unavailable. */
      activeView = createPageView(p);
      pageList.appendChild(activeView);
      activeView.classList.add('active');
      sheet = activeView.querySelector('.sheet');
      cur = p;
      store('mq.page', String(p));
      render(activeView, p);
      appendNextPage();
      renderQueue.then(function () {
        store('mq.pagesPreparedV2', '1');
      });
    } else {
      activeView = createPageView(p);
      pageList.appendChild(activeView);
      activeView.classList.add('active');
      sheet = activeView.querySelector('.sheet');
      cur = p;
      store('mq.page', String(p));
      render(activeView, p);
      appendNextPage();
    }
  }

  function appendNextPage() {
    var last = pageList.lastElementChild,
      next = last ? +last.getAttribute('data-page') + 1 : cur + 1;
    if (next > TOTAL) return;
    var view = createPageView(next);
    pageList.appendChild(view);
    render(view, next);
  }

  function prependPreviousPage() {
    var first = pageList.firstElementChild,
      previous = first ? +first.getAttribute('data-page') - 1 : 0;
    if (previous < 1 || loadingPrevious) return;
    loadingPrevious = true;
    var rect = first.getBoundingClientRect(),
      view = createPageView(previous);
    pageList.insertBefore(view, first);
    render(view, previous);
    requestAnimationFrame(function () {
      var nextRect = first.getBoundingClientRect();
      window.scrollBy({ top: nextRect.top - rect.top, left: 0, behavior: 'auto' });
      loadingPrevious = false;
    });
  }

  function updateContinuousPages() {
    if (scrollMode === 'horizontal') return;
    var views = pageList.children,
      visible = null,
      first = pageList.firstElementChild,
      last = pageList.lastElementChild;
    var marker = window.scrollY + window.innerHeight * 0.38,
      lo = 0,
      hi = views.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (views[mid].offsetTop + views[mid].offsetHeight <= marker) lo = mid + 1;
      else hi = mid;
    }
    visible = views[lo];
    if (first && window.scrollY < window.innerHeight * 0.5 && +first.getAttribute('data-page') > 1)
      prependPreviousPage();
    if (
      last &&
      last.getBoundingClientRect().top < window.innerHeight * 2 &&
      +last.getAttribute('data-page') < TOTAL
    )
      appendNextPage();
    if (visible) activatePage(visible);
  }

  function prefetch(p) {
    [p - 1, p + 1].forEach(function (q) {
      if (q < 1 || q > TOTAL) return;
      var lines = G[q - 1],
        need = {};
      lines.forEach(function (l) {
        if (l[0] === 'w') need[fam(l[1])] = l[2][0][1];
      });
      Object.keys(need).forEach(function (f) {
        try {
          document.fonts.load('100px "' + f + '"', need[f]);
        } catch (e) {}
      });
    });
  }

  /* ======== 3) تحديد الآيات والعلامات (Bookmarks) والتعليقات (Annotations) ======== */
  function paintSel(targetSheet) {
    var targets = targetSheet ? [targetSheet] : pageList.querySelectorAll('.sheet');
    targets.forEach(function (target) {
      target.querySelectorAll('.hl:not(.slot-band)').forEach(function (n) {
        n.remove();
      });
    });
    if (!sel) return;
    targets.forEach(function (target) {
      target.querySelectorAll('.ln').forEach(function (el) {
        if (el.getAttribute('data-vs').split(',').indexOf(String(sel)) < 0) return;
        var ws = el.querySelectorAll('.w[data-v="' + sel + '"]');
        if (!ws.length) return;
        var lr = el.getBoundingClientRect(),
          fsz = parseFloat(el.style.fontSize) || 20,
          lo = 1e9,
          hi = -1e9;
        ws.forEach(function (w) {
          var r = w.getBoundingClientRect();
          if (r.left < lo) lo = r.left;
          if (r.right > hi) hi = r.right;
        });
        var pad = fsz * 0.2,
          i = document.createElement('i');
        i.className = 'hl';
        i.style.left = (lo - lr.left - pad).toFixed(1) + 'px';
        i.style.width = (hi - lo + pad * 2).toFixed(1) + 'px';
        el.insertBefore(i, el.firstChild);
      });
    });
  }
  function updateBm() {
    var f = null;
    slots.forEach(function (s) {
      if (!f && s.v && pageOfV(s.v) === cur) f = s;
    });
    var el = activeView.querySelector('.bm');
    el.hidden = !f;
    if (f) el.style.fill = COL[f.c][0];
  }
  function paintSlots(targetSheet, page) {
    var targets = targetSheet ? [targetSheet] : pageList.querySelectorAll('.sheet');
    targets.forEach(function (target) {
      var targetPage = page || +target.closest('.page-view').getAttribute('data-page');
      target.querySelectorAll('.slot-band').forEach(function (n) {
        n.remove();
      });
      slots.forEach(function (s) {
        if (!s.v || pageOfV(s.v) !== targetPage) return;
        var col = COL[s.c][0];
        target.querySelectorAll('.ln').forEach(function (el) {
          if (el.getAttribute('data-vs').split(',').indexOf(String(s.v)) < 0) return;
          var ws = el.querySelectorAll('.w[data-v="' + s.v + '"]');
          if (!ws.length) return;
          var lr = el.getBoundingClientRect(),
            fsz = parseFloat(el.style.fontSize) || 20,
            lo = 1e9,
            hi = -1e9;
          ws.forEach(function (w) {
            var r = w.getBoundingClientRect();
            if (r.left < lo) lo = r.left;
            if (r.right > hi) hi = r.right;
          });
          var pad = fsz * 0.2,
            i = document.createElement('i');
          i.className = 'hl slot-band';
          i.style.left = (lo - lr.left - pad).toFixed(1) + 'px';
          i.style.width = (hi - lo + pad * 2).toFixed(1) + 'px';
          var r = parseInt(col.slice(1, 3), 16),
            g = parseInt(col.slice(3, 5), 16),
            b = parseInt(col.slice(5, 7), 16);
          i.style.background = 'rgba(' + r + ', ' + g + ', ' + b + ', 0.07)';
          el.insertBefore(i, el.firstChild);
        });
      });
    });
  }

  function paintAnnotations(targetSheet, page) {
    var targets = targetSheet ? [targetSheet] : pageList.querySelectorAll('.sheet');
    targets.forEach(function (target) {
      var paintedVerseBands = new WeakMap();
      var targetPage = page || +target.closest('.page-view').getAttribute('data-page');
      target.querySelectorAll('.annot-verse-band').forEach(function (band) {
        band.remove();
      });
      target.querySelectorAll('.annot-note-band').forEach(function (band) {
        band.remove();
      });
      var words = target.querySelectorAll('.w');
      words.forEach(function (w) {
        w.classList.remove('annot-highlight', 'annot-underline');
        w.style.removeProperty('--annot-bg');
        w.style.removeProperty('--annot-color');
        var verse = w.getAttribute('data-v'),
          pos = w.getAttribute('data-p'),
          marks = pageAnnotations[targetPage] || [],
          mark = null;
        var note = verseNotes[String(verse)];
        if (note && note.text.trim()) {
          var noteLine = w.closest('.ln'),
            noteBand = noteLine.querySelector('.annot-note-band[data-v="' + verse + '"]');
          if (!noteBand) {
            var noteWords = noteLine.querySelectorAll('.w[data-v="' + verse + '"]');
            var noteLineRect = noteLine.getBoundingClientRect(),
              noteLeft = Infinity,
              noteRight = -Infinity;
            noteWords.forEach(function (noteWord) {
              var noteRect = noteWord.getBoundingClientRect();
              noteLeft = Math.min(noteLeft, noteRect.left);
              noteRight = Math.max(noteRight, noteRect.right);
            });
            noteBand = document.createElement('i');
            noteBand.className = 'annot-note-band';
            noteBand.setAttribute('data-v', verse);
            noteBand.setAttribute('aria-hidden', 'true');
            noteBand.title = 'لهذه الآية ملاحظة محفوظة';
            noteLine.insertBefore(noteBand, noteLine.firstChild);
            noteBand.style.left = (noteLeft - noteLineRect.left - 2).toFixed(1) + 'px';
            noteBand.style.width = (noteRight - noteLeft + 4).toFixed(1) + 'px';
          }
        }
        marks.forEach(function (m) {
          if (String(m.v) === verse && m.p === null) mark = m;
        });
        marks.forEach(function (m) {
          if (String(m.v) === verse && String(m.p) === pos) mark = m;
        });
        if (!mark || mark.t === 'erase') return;
        var color = COL[mark.c][0];
        w.style.setProperty('--annot-color', color);
        if (mark.t === 'highlight') {
          w.style.setProperty('--annot-bg', 'color-mix(in srgb, ' + color + ' 24%, transparent)');
          if (mark.p === null) {
            var line = w.closest('.ln'),
              lineBands = paintedVerseBands.get(line);
            if (!lineBands) {
              lineBands = Object.create(null);
              paintedVerseBands.set(line, lineBands);
            }
            if (!lineBands[verse]) {
              lineBands[verse] = true;
              var verseWords = line.querySelectorAll('.w[data-v="' + verse + '"]');
              var lineRect = line.getBoundingClientRect(),
                left = Infinity,
                right = -Infinity;
              verseWords.forEach(function (verseWord) {
                var rect = verseWord.getBoundingClientRect();
                left = Math.min(left, rect.left);
                right = Math.max(right, rect.right);
              });
              var band = document.createElement('i');
              band.className = 'annot-verse-band';
              band.setAttribute('data-v', verse);
              line.insertBefore(band, line.firstChild);
              band.style.left = (left - lineRect.left - 2).toFixed(1) + 'px';
              band.style.width = (right - left + 4).toFixed(1) + 'px';
              band.style.background = 'color-mix(in srgb, ' + color + ' 45%, transparent)';
            }
          } else w.classList.add('annot-highlight');
        } else if (mark.t === 'underline') w.classList.add('annot-underline');
      });
    });
  }

  function repaintAnnotationPage(page) {
    var view = pageList.querySelector('.page-view[data-page="' + page + '"]');
    var targetSheet = view && view.querySelector('.sheet');
    if (targetSheet) paintAnnotations(targetSheet, page);
  }

  function saveAnnotations() {
    save('mq.annotations', pageAnnotations);
  }
  function markVerseFromTap(w, page) {
    var verse = +w.getAttribute('data-v');
    if (!verse) return;
    page = page || cur;
    var marks = pageAnnotations[page] || (pageAnnotations[page] = []);
    var existing = marks.find(function (mark) {
      return mark.v === verse && mark.p === null && mark.t === 'highlight';
    });
    if (existing && existing.c === annotPrefs.color) {
      pageAnnotations[page] = marks.filter(function (mark) {
        return mark !== existing;
      });
      saveAnnotations();
      repaintAnnotationPage(page);
      return true;
    }
    marks = marks.filter(function (m) {
      return m.v !== verse;
    });
    marks.push({ v: verse, p: null, c: annotPrefs.color, t: 'highlight' });
    pageAnnotations[page] = marks;
    saveAnnotations();
    repaintAnnotationPage(page);
    return false;
  }
  function togglePopupMark(w, page, color) {
    var verse = +w.getAttribute('data-v');
    if (!verse) return false;
    page = page || cur;
    var marks = pageAnnotations[page] || (pageAnnotations[page] = []),
      found = -1;
    var position = +w.getAttribute('data-p');
    if (position > 0) {
      var verseMark = marks.some(function (mark) {
        return mark.v === verse && mark.p === null;
      });
      marks.forEach(function (mark, index) {
        if (mark.v === verse && mark.p === position && mark.t === 'highlight') found = index;
      });
      if (found >= 0 && marks[found].c === color && !verseMark) {
        pageAnnotations[page] = marks.filter(function (mark) {
          return !(mark.v === verse && mark.p === position);
        });
        saveAnnotations();
        repaintAnnotationPage(page);
        return true;
      }
      marks = marks.filter(function (mark) {
        return !(mark.v === verse && (mark.p === null || mark.p === position));
      });
      marks.push({ v: verse, p: position, c: color, t: 'highlight' });
      pageAnnotations[page] = marks;
      saveAnnotations();
      repaintAnnotationPage(page);
      return false;
    }
    marks.forEach(function (m, i) {
      if (m.v === verse && m.p === null && m.t === 'highlight') found = i;
    });
    if (found >= 0 && marks[found].c === color && marks[found].t === 'highlight') {
      pageAnnotations[page] = marks.filter(function (mark) {
        return mark.v !== verse;
      });
      saveAnnotations();
      repaintAnnotationPage(page);
      return true;
    }
    marks = marks.filter(function (mark) {
      return mark.v !== verse;
    });
    marks.push({ v: verse, p: null, c: color, t: 'highlight' });
    pageAnnotations[page] = marks;
    saveAnnotations();
    repaintAnnotationPage(page);
    return false;
  }
  function markFromTap(w, page) {
    var verse = +w.getAttribute('data-v'),
      pos = +w.getAttribute('data-p'),
      isVerse = annotPrefs.mode === 'verse';
    page = page || cur;
    var marks = pageAnnotations[page] || (pageAnnotations[page] = []);
    marks = marks.filter(function (m) {
      return isVerse ? m.v !== verse : !(m.v === verse && m.p === pos);
    });
    marks.push({ v: verse, p: isVerse ? null : pos, c: annotPrefs.color, t: annotPrefs.type });
    pageAnnotations[page] = marks;
    saveAnnotations();
    repaintAnnotationPage(page);
    toast(annotPrefs.type === 'erase' ? 'أُزيل التمييز' : 'حُفظ التمييز لهذه الصفحة');
  }

  /* ======== تقليب الصفحات الواقعي (العرض الأفقي): ورقة ثلاثية الأبعاد + ظلال + صوت ======== */
  var FLIP_SPEEDS = { slow: 900, normal: 560, fast: 320 };
  var FLIP_MAX = 100; // زاوية خروج الورقة (درجات) — بعد ٩٠° تصير الورقة خارج الشاشة
  /* الصوت مفعّل دائمًا مع التأثير، والسرعة بطيئة ثابتة؛ المتاح للمستخدم تفعيل التأثير أو إلغاؤه فقط */
  var flipPrefs = { fx: store('mq.flipFx') !== '0', snd: true, vol: 70, spd: 'slow' };
  var flipPending = 0;
  var flip = null; // حالة التقليب الجارية: { stage, leaf, shade, cast, w, angle, raf, committing, dir, target, view }

  /* --- الصوت: ملف محلي (page-flip.mp3) يُفكّ ترميزه مرة واحدة ويُشغَّل بـ WebAudio دون تأخير --- */
  var flipAudio = { ctx: null, buf: null, loading: false, last: 0 };
  function flipAudioUnlock() {
    if (!flipPrefs.snd) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    try {
      if (AC && !flipAudio.ctx) flipAudio.ctx = new AC();
      if (flipAudio.ctx && flipAudio.ctx.state === 'suspended') flipAudio.ctx.resume();
    } catch (x) {}
    if (flipAudio.buf || flipAudio.loading || !flipAudio.ctx) return;
    flipAudio.loading = true;
    fetch('page-flip.mp3')
      .then(function (r) {
        return r.arrayBuffer();
      })
      .then(function (ab) {
        return new Promise(function (res, rej) {
          flipAudio.ctx.decodeAudioData(ab, res, rej);
        });
      })
      .then(function (buf) {
        flipAudio.buf = buf;
      })
      .catch(function () {
        flipAudio.loading = false;
      });
  }
  function flipPlay() {
    if (!flipPrefs.snd || flipPrefs.vol <= 0) return;
    var now = Date.now();
    if (now - flipAudio.last < 110) return; // لا نكرر الصوت بصورة مزعجة عند التقليب السريع
    flipAudio.last = now;
    var rate = ({ slow: 0.86, normal: 1, fast: 1.18 })[flipPrefs.spd] * (0.97 + Math.random() * 0.06);
    try {
      var ctx = flipAudio.ctx;
      if (ctx && flipAudio.buf) {
        if (ctx.state === 'suspended') ctx.resume();
        var src = ctx.createBufferSource(),
          gain = ctx.createGain();
        src.buffer = flipAudio.buf;
        src.playbackRate.value = rate;
        gain.gain.value = flipPrefs.vol / 100;
        src.connect(gain);
        gain.connect(ctx.destination);
        src.start();
        return;
      }
      if (!flipAudio.ctx) {
        var a = new Audio('page-flip.mp3');
        a.volume = flipPrefs.vol / 100;
        a.playbackRate = rate;
        a.play().catch(function () {});
      } else flipAudioUnlock();
    } catch (x) {}
  }

  /* --- تجهيز الصفحات المجاورة مسبقًا لتجنب الصفحة الفارغة أثناء التقليب --- */
  function flipViewReady(v) {
    var s = v && v.isConnected && v.querySelector('.sheet');
    return !!(s && s.firstElementChild);
  }
  function ensureHView(p) {
    if (p < 1 || p > TOTAL) return null;
    var v = pageList.querySelector('.page-view[data-page="' + p + '"]');
    if (v) return v;
    v = createPageView(p);
    var before = null;
    for (var i = 0; i < pageList.children.length; i++) {
      if (+pageList.children[i].getAttribute('data-page') > p) {
        before = pageList.children[i];
        break;
      }
    }
    pageList.insertBefore(v, before);
    render(v, p);
    return v;
  }
  setTimeout(function () { hPrefetch(); }, 900);
  setTimeout(function () { hPrefetch(); }, 2800);
  function hPrefetch() {
    if (scrollMode !== 'horizontal') return;
    ensureHView(cur + 1);
    ensureHView(cur - 1);
  }

  /* الانتقال الفعلي للصفحة (دون حركة) */
  function commitTo(p, view) {
    if (scrollMode !== 'horizontal') {
      activatePage(view);
      paintSel();
      window.scrollTo(0, view.offsetTop);
      return;
    }
    activatePage(view);
    Array.prototype.slice.call(pageList.children).forEach(function (v) {
      if (Math.abs(+v.getAttribute('data-page') - p) > 2) v.remove();
    });
    var lastV = pageList.lastElementChild;
    if (lastV && +lastV.getAttribute('data-page') === p) appendNextPage();
    paintSel();
    window.scrollTo(0, 0);
    setTimeout(hPrefetch, 60);
  }

  function flipClone(view, off) {
    var c = view.cloneNode(true);
    if (off) c.style.marginTop = -off + 'px';
    c.removeAttribute('data-page');
    c.classList.remove('active');
    c.setAttribute('aria-hidden', 'true');
    c.querySelectorAll('[id]').forEach(function (n) {
      n.removeAttribute('id');
    });
    c.querySelectorAll('button,a,input').forEach(function (n) {
      n.tabIndex = -1;
    });
    return c;
  }
  function flipPaperColor(view) {
    var els = [view.querySelector('.sheet'), view, pageEl, document.body, document.documentElement];
    for (var i = 0; i < els.length; i++) {
      if (!els[i]) continue;
      var c = getComputedStyle(els[i]).backgroundColor;
      var m = c && c.match(/rgba?\(([^)]+)\)/);
      if (m) {
        var p = m[1].split(',');
        if (p.length < 4 || parseFloat(p[3]) >= 0.99) return c;
      }
    }
    return '#fdf8f0';
  }
  function flipDiv(cls, parent) {
    var d = document.createElement('div');
    d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }

  /* بناء مسرح الورقة: dir='next' الورقة الحالية تنقلب وتكشف التالية، 'prev' الورقة السابقة تنزل فوق الحالية */
  function flipBegin(dir, inn, p) {
    var out = activeView;
    if (flip || !out || !inn || out === inn) return null;
    var vert = scrollMode !== 'horizontal'; // التمرير الرأسي: مسرح ثابت بحجم الشاشة فوق الصفحات
    var outOff = vert ? Math.max(0, window.scrollY - out.offsetTop) : 0;
    if (!vert) window.scrollTo(0, 0);
    var w = pageList.clientWidth,
      h = window.innerHeight; // الظاهر فقط: طبقات أصغر = رسم أسرع بلا اهتزاز
    var stage = flipDiv('flip-stage');
    var paper = flipPaperColor(out);
    stage.style.setProperty('--flip-paper', paper);
    stage.style.height = h + 'px';
    if (vert) {
      var r = pageList.getBoundingClientRect();
      stage.classList.add('is-fixed');
      stage.style.left = r.left + 'px';
      stage.style.width = r.width + 'px';
      stage.style.right = 'auto';
    }
    // الطبقات: الصفحة المكشوفة ← ظل الطيّ على المكشوفة ← الورقة (مقصوصة) ← ظهر الورقة المطويّة
    var under = flipDiv('flip-under', stage);
    flipDiv('flip-inner', under).appendChild(dir === 'next' ? flipClone(inn, 0) : flipClone(out, outOff));
    var shadowSvg = flipSvg(w, h, stage);
    var leaf = flipDiv('flip-leaf', stage);
    flipDiv('flip-inner', leaf).appendChild(dir === 'next' ? flipClone(out, outOff) : flipClone(inn, 0));
    var wrap = flipDiv('flip-flapwrap', stage);
    var flapSvg = flipSvg(w, h, wrap);
    var gU = flipGrad(shadowSvg, [[0, 'rgba(30,18,4,.55)'], [0.35, 'rgba(30,18,4,.22)'], [1, 'rgba(30,18,4,0)']]);
    var pU = document.createElementNS(FLIP_NS, 'polygon');
    pU.setAttribute('fill', 'url(#' + gU.id + ')');
    shadowSvg.appendChild(pU);
    var pB = document.createElementNS(FLIP_NS, 'polygon');
    pB.setAttribute('fill', paper);
    flapSvg.appendChild(pB);
    var pT = document.createElementNS(FLIP_NS, 'polygon');
    pT.setAttribute('fill', 'rgba(150,112,52,.16)');
    flapSvg.appendChild(pT);
    var gF = flipGrad(flapSvg, [
      [0, 'rgba(40,25,5,.34)'],
      [0.16, 'rgba(255,255,255,.55)'],
      [0.5, 'rgba(255,255,255,0)'],
      [1, 'rgba(40,25,5,.16)']
    ]);
    var pF = document.createElementNS(FLIP_NS, 'polygon');
    pF.setAttribute('fill', 'url(#' + gF.id + ')');
    flapSvg.appendChild(pF);
    (vert ? document.body : pageList).appendChild(stage);
    flip = { stage: stage, leaf: leaf, wrap: wrap, shadowSvg: shadowSvg, gU: gU, pU: pU, gF: gF, pF: pF, pB: pB, pT: pT, yb: h, w: w, h: h, angle: 0, raf: 0, committing: false, dir: dir, target: p, view: inn };
    flipSetAngle(dir === 'next' ? 0 : FLIP_MAX);
    return flip;
  }
  var FLIP_NS = 'http://www.w3.org/2000/svg',
    flipGradId = 0;
  function flipSvg(w, h, parent) {
    var svg = document.createElementNS(FLIP_NS, 'svg');
    svg.setAttribute('class', 'flip-svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'none');
    parent.appendChild(svg);
    return svg;
  }
  function flipGrad(svg, stops) {
    var defs = document.createElementNS(FLIP_NS, 'defs'),
      g = document.createElementNS(FLIP_NS, 'linearGradient');
    g.id = 'flipg' + ++flipGradId;
    g.setAttribute('gradientUnits', 'userSpaceOnUse');
    stops.forEach(function (st) {
      var e = document.createElementNS(FLIP_NS, 'stop');
      e.setAttribute('offset', String(st[0]));
      e.setAttribute('stop-color', st[1].replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]+\)/, 'rgb($1,$2,$3)'));
      e.setAttribute('stop-opacity', st[1].match(/,([\d.]+)\)$/)[1]);
      g.appendChild(e);
    });
    defs.appendChild(g);
    svg.appendChild(defs);
    return g;
  }
  /* قصّ مضلّع بنصف مستوى: نُبقي النقاط التي sign*dot(p-M,n) >= 0 */
  function flipClipPoly(poly, n, M, sign) {
    var out = [];
    function d(p) {
      return sign * ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]);
    }
    for (var i = 0; i < poly.length; i++) {
      var A = poly[i],
        B = poly[(i + 1) % poly.length],
        da = d(A),
        db = d(B);
      if (da >= 0) out.push(A);
      if ((da >= 0) !== (db >= 0)) {
        var t = da / (da - db);
        out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]);
      }
    }
    return out;
  }
  function flipPts(poly) {
    return poly
      .map(function (p) {
        return p[0].toFixed(1) + ',' + p[1].toFixed(1);
      })
      .join(' ');
  }
  /* طيّ الزاوية: الزاوية السفلية اليسرى تُرفع وتنتقل إلى C على مسار قوسي،
     وخط الطيّ هو منصّف العمودي بين الزاوية ومكانها الجديد (قُطري ومتغيّر الميل) */
  function flipSetAngle(a) {
    var f = flip;
    if (!f) return;
    a = Math.max(0, Math.min(FLIP_MAX, a));
    f.angle = a;
    var t = a / FLIP_MAX,
      w = f.w,
      h = f.h,
      yb = f.yb;
    var gone = t >= 0.995,
      rest = t <= 0.004;
    f.shadowSvg.style.display = f.wrap.style.display = rest || gone ? 'none' : '';
    f.leaf.style.visibility = gone ? 'hidden' : '';
    if (rest || gone) {
      f.leaf.style.clipPath = 'none';
      return;
    }
    var cx = 2.06 * w * t,
      cy = yb - 0.46 * w * Math.sin(Math.PI * t) * (1 - t * 0.35);
    var dx = cx,
      dy = cy - yb,
      len = Math.hypot(dx, dy) || 1,
      n = [dx / len, dy / len],
      M = [cx / 2, (yb + cy) / 2];
    var rect = [[0, 0], [w, 0], [w, h], [0, h]];
    var kept = flipClipPoly(rect, n, M, 1),
      rev = flipClipPoly(rect, n, M, -1);
    var flap = rev.map(function (p) {
      var k = 2 * ((p[0] - M[0]) * n[0] + (p[1] - M[1]) * n[1]);
      return [p[0] - k * n[0], p[1] - k * n[1]];
    });
    f.leaf.style.clipPath = kept.length > 2 ? 'polygon(' + kept.map(function (p) { return p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px'; }).join(',') + ')' : 'polygon(0 0)';
    f.pU.setAttribute('points', flipPts(rev));
    var S = 46 + 70 * Math.sin(Math.PI * t);
    f.gU.setAttribute('x1', M[0]);
    f.gU.setAttribute('y1', M[1]);
    f.gU.setAttribute('x2', M[0] - n[0] * S);
    f.gU.setAttribute('y2', M[1] - n[1] * S);
    var pf = flipPts(flap);
    f.pB.setAttribute('points', pf);
    f.pT.setAttribute('points', pf);
    f.pF.setAttribute('points', pf);
    f.gF.setAttribute('x1', M[0]);
    f.gF.setAttribute('y1', M[1]);
    f.gF.setAttribute('x2', M[0] + n[0] * (len / 2));
    f.gF.setAttribute('y2', M[1] + n[1] * (len / 2));
  }
  function flipAnimate(to, kind, done) {
    var f = flip;
    if (!f) return;
    cancelAnimationFrame(f.raf);
    var from = f.angle,
      dist = Math.abs(to - from);
    if (dist < 0.5) {
      flipSetAngle(to);
      done();
      return;
    }
    var dur = Math.max(140, FLIP_SPEEDS[flipPrefs.spd] * Math.min(1, dist / FLIP_MAX) * (kind === 'out' ? 0.75 : 1)),
      t0 = performance.now();
    function step(now) {
      if (flip !== f) return;
      var k = Math.min(1, (now - t0) / dur),
        e = kind === 'out' ? 1 - Math.pow(1 - k, 3) : k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      flipSetAngle(from + (to - from) * e);
      if (k < 1) f.raf = requestAnimationFrame(step);
      else done();
    }
    f.raf = requestAnimationFrame(step);
  }
  function flipEnd(commit) {
    var f = flip;
    if (!f) return;
    cancelAnimationFrame(f.raf);
    flip = null;
    if (commit) commitTo(f.target, f.view);
    f.stage.remove();
  }
  /* الصفحة الحالية مع احتساب تقليبة جارية (تقليب سريع متكرر) */
  function curNow() {
    return flip && flip.committing ? flip.target : cur;
  }
  function flipFinishNow() {
    if (flip) flipEnd(flip.committing);
  }
  function flipAuto(dir, view, p) {
    var f = flipBegin(dir, view, p);
    if (!f) {
      commitTo(p, view);
      return;
    }
    flipPlay();
    f.committing = true;
    flipAnimate(dir === 'next' ? FLIP_MAX : 0, 'inout', function () {
      flipEnd(true);
    });
  }

  /* --- السحب بالإصبع أو الماوس (يتبع الورقةُ الإصبعَ) --- */
  var flipDrag = null,
    flipClickGuard = 0;
  function flipInteractive(el) {
    return !!el.closest('button,a,input,textarea,select,summary,.wp,.flip-stage');
  }
  pageEl.addEventListener('pointerdown', function (e) {
    flipAudioUnlock();
    if (scrollMode !== 'horizontal') return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (flipInteractive(e.target) && !e.target.closest('.flip-stage')) return;
    flipFinishNow(); // تقليب سريع متكرر: أنهِ الحركة السابقة فورًا
    hPrefetch();
    flipDrag = {
      id: e.pointerId,
      sx: e.clientX,
      sy: e.clientY,
      x0: e.clientX,
      t0: Date.now(),
      lx: e.clientX,
      lt: Date.now(),
      v: 0,
      w: pageList.clientWidth || window.innerWidth,
      started: false,
      dead: false,
      dir: null,
      f: null
    };
  });
  pageEl.addEventListener('pointermove', function (e) {
    var d = flipDrag;
    if (!d || e.pointerId !== d.id || d.dead) return;
    var dx = e.clientX - d.sx,
      dy = e.clientY - d.sy;
    if (!d.started) {
      if (Math.abs(dy) > 14 && Math.abs(dy) > Math.abs(dx)) {
        d.dead = true;
        return;
      }
      if (Math.abs(dx) < 12 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      d.dir = dx > 0 ? 'next' : 'prev';
      var target = cur + (dx > 0 ? 1 : -1);
      if (target < 1 || target > TOTAL) {
        d.dead = true;
        return;
      }
      d.started = true;
      d.x0 = e.clientX;
      lpCancel();
      if (e.pointerType === 'mouse') {
        try {
          pageEl.setPointerCapture(e.pointerId);
        } catch (x) {}
      }
      document.body.classList.add('flip-dragging');
      if (flipPrefs.fx) {
        var v = ensureHView(target);
        if (flipViewReady(v) && flipViewReady(activeView)) {
          d.f = flipBegin(d.dir, v, target);
          if (d.f) flipPlay();
        }
      }
    }
    var now = Date.now(),
      sign = d.dir === 'next' ? 1 : -1;
    if (now > d.lt) d.v = d.v * 0.6 + (sign * (e.clientX - d.lx) / (now - d.lt)) * 0.4;
    d.lx = e.clientX;
    d.lt = now;
    if (d.f && flip === d.f) {
      var prog = Math.max(0, Math.min(1.1, (sign * (e.clientX - d.x0)) / (d.w * 0.9)));
      flipSetAngle(d.dir === 'next' ? prog * FLIP_MAX : FLIP_MAX - prog * FLIP_MAX);
    }
  });
  function flipDragEnd(e, cancelled) {
    var d = flipDrag;
    if (!d || e.pointerId !== d.id) return;
    flipDrag = null;
    document.body.classList.remove('flip-dragging');
    if (!d.started) return;
    flipClickGuard = Date.now();
    var sign = d.dir === 'next' ? 1 : -1,
      total = sign * (e.clientX - d.sx);
    if (d.f && flip === d.f) {
      var commit = !cancelled && (total > d.w * 0.28 || (d.v > 0.5 && total > 24));
      flip.committing = commit;
      var to = commit ? (d.dir === 'next' ? FLIP_MAX : 0) : d.dir === 'next' ? 0 : FLIP_MAX;
      flipAnimate(to, 'out', function () {
        flipEnd(commit);
      });
    } else if (!cancelled && total > 70 && Date.now() - d.t0 < 700) {
      goTo(curNow() + sign);
    }
  }
  pageEl.addEventListener('pointerup', function (e) {
    flipDragEnd(e, false);
  });
  pageEl.addEventListener('pointercancel', function (e) {
    flipDragEnd(e, true);
  });
  /* النقر على طرف الصفحة: الطرف الأيسر = التالية، الأيمن = السابقة (اتجاه المصحف العربي) */
  pageEl.addEventListener(
    'click',
    function (e) {
      if (scrollMode !== 'horizontal') return;
      if (Date.now() - flipClickGuard < 400) {
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (flipInteractive(e.target)) return;
      var r = pageList.getBoundingClientRect();
      if (!r.width) return;
      var fx = (e.clientX - r.left) / r.width;
      if (fx < 0.09 || fx > 0.91) {
        e.stopPropagation();
        e.preventDefault();
        goTo(curNow() + (fx < 0.09 ? 1 : -1));
      }
    },
    true
  );

  function goTo(p, keepSel) {
    p = Math.max(1, Math.min(TOTAL, p | 0));
    if (!keepSel) sel = 0;
    closeWp();
    flipFinishNow();
    var view = pageList.querySelector('.page-view[data-page="' + p + '"]');
    if (!view) {
      if (scrollMode === 'horizontal' && Math.abs(p - cur) === 1) view = ensureHView(p);
      else {
        renderInitialPage(p);
        view = activeView;
      }
    }
    if (scrollMode === 'horizontal') {
      flipPending = 0;
      if (flipPrefs.fx && view !== activeView && Math.abs(p - cur) === 1 && flipViewReady(activeView)) {
        if (flipViewReady(view)) {
          flipAuto(p > cur ? 'next' : 'prev', view, p);
          return;
        }
        // الصفحة المجاورة قيد التجهيز (خطوطها تُحمَّل): ننتظرها قليلًا ثم نقلّب بدل الانتقال الفوري
        flipPending = p;
        var tries = 0;
        (function wait() {
          if (flipPending !== p) return;
          if (flipViewReady(view) || ++tries > 25) {
            flipPending = 0;
            if (flipViewReady(view) && view !== activeView && Math.abs(p - cur) === 1)
              flipAuto(p > cur ? 'next' : 'prev', view, p);
            else commitTo(p, view);
          } else setTimeout(wait, 40);
        })();
        return;
      }
      commitTo(p, view);
      return;
    }
    if (
      flipPrefs.fx &&
      view !== activeView &&
      Math.abs(p - cur) === 1 &&
      flipViewReady(view) &&
      flipViewReady(activeView)
    ) {
      flipAuto(p > cur ? 'next' : 'prev', view, p);
      return;
    }
    activatePage(view);
    paintSel();
    window.scrollTo({ top: view.offsetTop, behavior: 'smooth' });
  }
  function navigateToVerse(id) {
    var page = pageOfV(id);
    sel = id;
    goTo(page, true);
    renderQueue.then(function () {
      requestAnimationFrame(function () {
        var verse = pageList.querySelector('.page-view[data-page="' + page + '"] .w[data-v="' + id + '"]');
        if (verse) verse.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        paintSel();
      });
    });
  }

  /* ---------- verse sheet ---------- */
  var body = document.body;
  var screenWakeLock = null,
    screenWakeLockPending = false,
    screenWakeLockPageHidden = false,
    screenWakeLockRequestDenied = false;
  /* ======== 4) الشاشة وإبقاؤها مضاءة، toast، وتجهيز عناصر التسميع والتلاوة (القوائم والحدود والتفضيلات) ======== */
  function requestScreenWakeLock() {
    if (
      !navigator.wakeLock ||
      document.visibilityState !== 'visible' ||
      screenWakeLockPageHidden ||
      screenWakeLockPending ||
      screenWakeLockRequestDenied ||
      (screenWakeLock && !screenWakeLock.released)
    )
      return;
    screenWakeLockPending = true;
    navigator.wakeLock
      .request('screen')
      .then(function (lock) {
        if (screenWakeLockPageHidden || document.visibilityState !== 'visible') {
          return lock.release();
        }
        screenWakeLock = lock;
        lock.addEventListener('release', function () {
          if (screenWakeLock !== lock) return;
          screenWakeLock = null;
          if (document.visibilityState === 'visible' && !screenWakeLockPageHidden) {
            setTimeout(requestScreenWakeLock, 250);
          }
        });
      })
      .catch(function (error) {
        screenWakeLockRequestDenied = true;
        console.warn('تعذر إبقاء شاشة الجهاز مضاءة:', error);
      })
      .then(function () {
        screenWakeLockPending = false;
      });
  }
  function releaseScreenWakeLockForPageHide() {
    screenWakeLockPageHidden = true;
    var lock = screenWakeLock;
    screenWakeLock = null;
    if (lock && !lock.released) {
      lock.release().catch(function (error) {
        console.warn('تعذر تحرير قفل إبقاء الشاشة نشطة:', error);
      });
    }
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') screenWakeLockRequestDenied = false;
    requestScreenWakeLock();
  });
  document.addEventListener(
    'pointerdown',
    function () {
      if (!screenWakeLockRequestDenied) return;
      screenWakeLockRequestDenied = false;
      requestScreenWakeLock();
    },
    { passive: true }
  );
  window.addEventListener('pageshow', function () {
    if (screenWakeLockPageHidden) {
      screenWakeLockPageHidden = false;
      screenWakeLockRequestDenied = false;
    }
    requestScreenWakeLock();
  });
  window.addEventListener('pagehide', releaseScreenWakeLockForPageHide);
  requestScreenWakeLock();
  var toastEl = $('toast'),
    tt;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(tt);
    tt = setTimeout(function () {
      toastEl.classList.remove('show');
    }, 2200);
  }
  var recitationAudio = new Audio(),
    recitationRange = null,
    recitationAyah = 0,
    recitationRepeatCurrent = 1;
  var recitationSurah = $('recitationSurah'),
    recitationFrom = $('recitationFrom');
  var recitationTo = $('recitationTo'),
    recitationPlay = $('recitationPlay');
  var recitationDownload = $('downloadRecitation'),
    recitationDownloadGeneration = 0;
  var recitationRepeat = $('recitationRepeat');
  var recitationStatus = $('recitationStatus');
  var recitationPrefs = load('mq.recitationPrefs', {});
  var reciterSelect = $('reciterSelect');
  var tasmeeSection = $('tasmeeSection');
  var tasmeePanel = $('tasmeePanel'),
    tasmeeToggle = $('tasmeeToggle');
  var tasmeeClose = $('tasmeeClose');
  var tasmeePrompt = $('tasmeePrompt'),
    tasmeeStatus = $('tasmeeStatus');
  var tasmeeSurah = $('tasmeeSurah'),
    tasmeeFrom = $('tasmeeFrom'),
    tasmeeTo = $('tasmeeTo');
  var tasmeeEnabled = !!load('mq.tasmeeEnabled', true);
  var tasmeeWindowOpen = false;
  var tasmeePrefs = load('mq.tasmeePrefs', {});
  var tasmeeSession = null,
    tasmeeRecognition = null,
    tasmeeListening = false,
    tasmeeRecognitionStarted = false;
  var tasmeeRetainedMistakes = Object.create(null);
  var tasmeeRestartTimer = 0,
    tasmeeInterimTokens = [];
  var tasmeeMotivations = [
    'ما شاء الله، ثمرة اجتهادك واضحة اليوم. واصل بهذا النور.',
    'أحسنت! كل آية تحفظها ترفعك خطوة جديدة. استمر يا بطل.',
    'بارك الله في وقتك وجهدك؛ أتممت المقطع بقلب حاضر وعزيمة جميلة.',
    'إنجاز مبارك! اجعل هذا النجاح وقودًا لوردك القادم.',
    'رائع جدًا، لقد أثمرت مداومتك. القرآن يزداد رسوخًا في صدرك.'
  ];
  function showTasmeeCelebration() {
    window.QuranCelebrate.show({
      title: 'أتممت الحفظ بنجاح',
      message: tasmeeMotivations[Math.floor(Math.random() * tasmeeMotivations.length)]
    });
  }
  var wp = $('wp');
  var recitationTrackingMode = load('mq.recitationTrackingMode', 'word');
  if (['ayah', 'word'].indexOf(recitationTrackingMode) < 0) recitationTrackingMode = 'word';
  var recitationTrackingGroup = $('recitationTrackingGroup');
  function syncRecitationTrackingControls() {
    recitationTrackingGroup.querySelectorAll('[data-recitation-tracking]').forEach(function (button) {
      var selected = button.getAttribute('data-recitation-tracking') === recitationTrackingMode;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
  }
  syncRecitationTrackingControls();
  recitationTrackingGroup.addEventListener('click', function (event) {
    var button = event.target.closest('[data-recitation-tracking]');
    if (!button) return;
    recitationTrackingMode = button.getAttribute('data-recitation-tracking');
    save('mq.recitationTrackingMode', recitationTrackingMode);
    syncRecitationTrackingControls();
    if (!recitationRange || !recitationAyah) return;
    paintRecitationAyah(recitationAyah);
    if (
      recitationTrackingMode === 'word' &&
      isFinite(recitationAudio.duration) &&
      recitationAudio.duration > 0
    ) {
      updateRecitationWord(recitationAudio.currentTime / recitationAudio.duration);
    }
  });
  function cancelMarkLongPress() {
    clearTimeout(marksLongPressTimer);
    marksLongPressTimer = 0;
    marksLongPressStart = null;
  }
  wp.addEventListener('pointerdown', function (event) {
    var mark = event.target.closest('.wp-marks.wp-marks-compact .mk-slot-row .srow');
    if (!mark || (event.pointerType === 'mouse' && event.button !== 0)) return;
    cancelMarkLongPress();
    marksLongPressStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    marksLongPressTimer = setTimeout(function () {
      marksLongPressTimer = 0;
      if (!marksLongPressStart || !popWord) return;
      marksPopupExpanded = true;
      marksLongPressFired = true;
      setTimeout(function () {
        marksLongPressFired = false;
      }, 1200);
      var marks = wp.querySelector('.wp-marks');
      if (marks) marks.classList.remove('wp-marks-compact');
      placeWp(popWord);
    }, 500);
  });
  document.addEventListener(
    'pointermove',
    function (event) {
      if (!marksLongPressStart || event.pointerId !== marksLongPressStart.pointerId) return;
      if (
        Math.abs(event.clientX - marksLongPressStart.x) > 10 ||
        Math.abs(event.clientY - marksLongPressStart.y) > 10
      )
        cancelMarkLongPress();
    },
    true
  );
  document.addEventListener('pointerup', cancelMarkLongPress, true);
  document.addEventListener('pointercancel', cancelMarkLongPress, true);
  if (['1', '2', '3', '4', '5'].indexOf(String(recitationPrefs.repeat)) >= 0) {
    recitationRepeat.value = String(recitationPrefs.repeat);
  }
  function fillAyahSelect(select, count, value) {
    var selected = Math.max(1, Math.min(count, +value || 1));
    select.innerHTML = '';
    for (var i = 1; i <= count; i++) {
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = ar(i);
      if (i === selected) option.selected = true;
      select.appendChild(option);
    }
    if (select._refreshProfessionalSelect) select._refreshProfessionalSelect();
  }
  function professionalizeSelect(select) {
    if (!select || select.dataset.professionalSelect === 'true') return;
    select.dataset.professionalSelect = 'true';
    var wrap = document.createElement('div');
    wrap.className = 'pro-select';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('pro-select-native');
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'pro-select-button';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-label', select.getAttribute('aria-label') || 'اختر');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    var valueLabel = document.createElement('span');
    valueLabel.className = 'pro-select-value';
    button.appendChild(valueLabel);
    var menu = document.createElement('div');
    menu.className = 'pro-select-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');
    menu.id = (select.id || 'select') + 'Options';
    button.setAttribute('aria-controls', menu.id);
    wrap.appendChild(button);
    wrap.appendChild(menu);
    function refresh() {
      var current = String(select.value || '');
      var option = Array.prototype.find.call(select.options, function (item) {
        return String(item.value) === current;
      });
      valueLabel.textContent = option ? option.textContent : 'اختر';
      menu.innerHTML = '';
      Array.prototype.forEach.call(select.options, function (item) {
        var choice = document.createElement('button');
        choice.type = 'button';
        choice.className = 'pro-select-option' + (String(item.value) === current ? ' selected' : '');
        choice.textContent = item.textContent;
        choice.setAttribute('role', 'option');
        choice.tabIndex = -1;
        choice.setAttribute('aria-selected', String(String(item.value) === current));
        choice.addEventListener('click', function () {
          select.value = item.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          menu.hidden = true;
          wrap.classList.remove('open');
          wrap.classList.remove('open-up');
          button.setAttribute('aria-expanded', 'false');
          refresh();
          button.focus();
        });
        menu.appendChild(choice);
      });
    }
    function closeMenu(returnFocus) {
      menu.hidden = true;
      wrap.classList.remove('open', 'open-up');
      button.setAttribute('aria-expanded', 'false');
      if (returnFocus) button.focus();
    }
    function visibleChoices() {
      return Array.prototype.filter.call(menu.children, function (choice) {
        return choice.style.display !== 'none';
      });
    }
    function openMenu(focusIndex) {
      document.querySelectorAll('.pro-select-menu').forEach(function (other) {
        other.hidden = true;
      });
      document.querySelectorAll('.pro-select').forEach(function (other) {
        other.classList.remove('open', 'open-up');
      });
      document.querySelectorAll('.pro-select-button[aria-expanded="true"]').forEach(function (other) {
        other.setAttribute('aria-expanded', 'false');
      });
      var rect = wrap.getBoundingClientRect();
      wrap.classList.toggle(
        'open-up',
        window.innerHeight - rect.bottom < 190 && rect.top > window.innerHeight - rect.bottom
      );
      menu.hidden = false;
      wrap.classList.add('open');
      button.setAttribute('aria-expanded', 'true');
      var choices = visibleChoices();
      if (choices.length) choices[Math.max(0, Math.min(choices.length - 1, focusIndex))].focus();
    }
    button.addEventListener('click', function () {
      if (menu.hidden)
        openMenu(
          visibleChoices().findIndex(function (choice) {
            return choice.getAttribute('aria-selected') === 'true';
          })
        );
      else closeMenu(false);
    });
    button.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        var choices = visibleChoices();
        var selectedIndex = choices.findIndex(function (choice) {
          return choice.getAttribute('aria-selected') === 'true';
        });
        openMenu(event.key === 'ArrowUp' && selectedIndex >= 0 ? selectedIndex : Math.max(0, selectedIndex));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        openMenu(event.key === 'Home' ? 0 : visibleChoices().length - 1);
      }
    });
    menu.addEventListener('keydown', function (event) {
      var choice = event.target.closest('.pro-select-option');
      if (!choice) return;
      var choices = visibleChoices();
      var index = choices.indexOf(choice);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        choices[
          Math.max(0, Math.min(choices.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
        ].focus();
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        choices[event.key === 'Home' ? 0 : choices.length - 1].focus();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeMenu(true);
      } else if (event.key === 'Tab') {
        closeMenu(false);
      }
    });
    document.addEventListener('click', function (event) {
      if (wrap.contains(event.target)) return;
      if (!menu.hidden) closeMenu(false);
    });
    window.addEventListener('resize', function () {
      if (!menu.hidden) closeMenu(false);
    });
    select.addEventListener('change', refresh);
    select._refreshProfessionalSelect = refresh;
    refresh();
  }
  // قرّاء إضافيون بروايات أخرى (مجلدات EveryAyah).
  var EXTRA_RECITERS = [
    { id: 'warsh/warsh_ibrahim_aldosary_128kbps', label: '[ورش] إبراهيم الدوسري' },
    { id: 'warsh/warsh_yassin_al_jazaery_64kbps', label: '[ورش] ياسين الجزائري' },
    { id: 'warsh/warsh_Abdul_Basit_128kbps', label: '[ورش] عبدالباسط عبدالصمد' }
  ];
  function addReciterOptions(list) {
    list.forEach(function (r) {
      var exists = Array.prototype.some.call(reciterSelect.options, function (o) { return o.value === r.id; });
      if (exists) return;
      var option = document.createElement('option');
      option.value = r.id;
      option.textContent = r.label;
      reciterSelect.appendChild(option);
    });
  }
  addReciterOptions(EXTRA_RECITERS);
  var reciterIds = Array.prototype.map.call(reciterSelect.options, function (option) {
    return option.value;
  });
  if (reciterIds.indexOf(recitationPrefs.reciter) >= 0) reciterSelect.value = recitationPrefs.reciter;
  var initialSurah = Math.max(1, Math.min(D.surahs.length, +recitationPrefs.surah || 1));
  recitationSurah.innerHTML = D.surahs
    .map(function (surah) {
      return '<option value="' + surah[0] + '">' + escapeHtml(surah[1]) + '</option>';
    })
    .join('');
  recitationSurah.value = String(initialSurah);
  var initialTasmeeSurah = Math.max(1, Math.min(D.surahs.length, +tasmeePrefs.surah || initialSurah));
  tasmeeSurah.innerHTML = D.surahs
    .map(function (surah) {
      return '<option value="' + surah[0] + '">' + escapeHtml(surah[1]) + '</option>';
    })
    .join('');
  tasmeeSurah.value = String(initialTasmeeSurah);

  function updateRecitationBounds(reset) {
    var surah = +recitationSurah.value;
    var count = D.surahs[surah - 1][3];
    var from = reset ? 1 : Math.max(1, Math.min(count, +recitationFrom.value || 1));
    var to = reset ? from : Math.max(1, Math.min(count, +recitationTo.value || from));
    if (to < from) to = from;
    fillAyahSelect(recitationFrom, count, from);
    fillAyahSelect(recitationTo, count, to);
  }

  function updateTasmeeBounds(reset) {
    var surah = +tasmeeSurah.value;
    var count = D.surahs[surah - 1][3];
    var from = reset ? 1 : Math.max(1, Math.min(count, +tasmeeFrom.value || 1));
    var to = reset ? from : Math.max(1, Math.min(count, +tasmeeTo.value || from));
    if (to < from) to = from;
    fillAyahSelect(tasmeeFrom, count, from);
    fillAyahSelect(tasmeeTo, count, to);
  }

  function saveTasmeePrefs() {
    save('mq.tasmeePrefs', {
      surah: +tasmeeSurah.value,
      from: +tasmeeFrom.value,
      to: +tasmeeTo.value
    });
  }

  function setTasmeeVerse(verseId) {
    var surah = Math.floor(verseId / 1000),
      ayah = verseId % 1000;
    if (!D.surahs[surah - 1] || ayah < 1 || ayah > D.surahs[surah - 1][3]) return false;
    if (tasmeeListening) stopTasmeeRecognition();
    tasmeeSurah.value = String(surah);
    if (tasmeeSurah._refreshProfessionalSelect) tasmeeSurah._refreshProfessionalSelect();
    updateTasmeeBounds(true);
    tasmeeFrom.value = String(ayah);
    tasmeeTo.value = String(ayah);
    if (tasmeeFrom._refreshProfessionalSelect) tasmeeFrom._refreshProfessionalSelect();
    if (tasmeeTo._refreshProfessionalSelect) tasmeeTo._refreshProfessionalSelect();
    if (tasmeeSession) {
      tasmeeSession = null;
      clearTasmeeMarkings();
    }
    saveTasmeePrefs();
    tasmeeStatus.textContent =
      'تم اختيار سورة ' + D.surahs[surah - 1][1] + '، الآية ' + ar(ayah) + ' للتسميع.';
    syncTasmeeControls();
    return true;
  }

  function setRecitationVerse(verseId) {
    var surah = Math.floor(verseId / 1000),
      ayah = verseId % 1000;
    if (!D.surahs[surah - 1] || ayah < 1 || ayah > D.surahs[surah - 1][3]) return;
    stopRecitation('تم تحديد الآية المختارة للاستماع');
    recitationSurah.value = String(surah);
    recitationSurah._refreshProfessionalSelect();
    updateRecitationBounds(true);
    recitationFrom.value = String(ayah);
    recitationTo.value = String(ayah);
    recitationFrom._refreshProfessionalSelect();
    recitationTo._refreshProfessionalSelect();
    saveRecitationPrefs();
  }

  function saveRecitationPrefs() {
    save('mq.recitationPrefs', {
      surah: +recitationSurah.value,
      from: +recitationFrom.value,
      to: +recitationTo.value,
      repeat: +recitationRepeat.value,
      reciter: reciterSelect.value
    });
  }

  function setRecitationButton(playing) {
    recitationPlay.textContent = playing ? 'إيقاف مؤقت' : 'استماع';
    recitationPlay.setAttribute('aria-pressed', String(playing));
  }

  function recitationUrl(surah, ayah, reciter) {
    var surahNumber = ('00' + surah).slice(-3);
    var ayahNumber = ('00' + ayah).slice(-3);
    return (
      'https://everyayah.com/data/' +
      (reciter || reciterSelect.value).split('/').map(encodeURIComponent).join('/') +
      '/' +
      surahNumber +
      ayahNumber +
      '.mp3'
    );
  }

  var recitationWordGroups = [],
    activeRecitationWord = null;
  function stopRecitation(message) {
    recitationDownloadGeneration += 1;
    recitationDownload.disabled = false;
    recitationAudio.pause();
    recitationAudio.removeAttribute('src');
    recitationAudio.load();
    recitationRange = null;
    recitationAyah = 0;
    recitationRepeatCurrent = 1;
    recitationWordGroups = [];
    activeRecitationWord = null;
    paintRecitationAyah(0);
    setRecitationButton(false);
    if (message) recitationStatus.textContent = message;
  }

  function syncTasmeeControls() {
    tasmeePanel.hidden = !tasmeeEnabled;
    tasmeeSection.hidden = !tasmeeEnabled || !tasmeeWindowOpen;
    tasmeeToggle.disabled = !tasmeeEnabled;
    tasmeeToggle.setAttribute('aria-pressed', String(tasmeeListening));
    tasmeeToggle.textContent = tasmeeListening
      ? 'إيقاف التسميع'
      : tasmeeSession && !tasmeeSession.completed
        ? 'متابعة التسميع'
        : 'ابدأ التسميع';
    tasmeePrompt.disabled = !tasmeeEnabled || !tasmeeSession || tasmeeSession.completed;
    document.querySelectorAll('.tasmee-mic-indicator').forEach(function (icon) {
      icon.classList.toggle('is-active', tasmeeListening);
      icon.setAttribute('aria-label', tasmeeListening ? 'الميكروفون يعمل' : 'الميكروفون غير نشط');
      icon.setAttribute('title', tasmeeListening ? 'الميكروفون يعمل' : 'الميكروفون غير نشط');
    });
  }

  /* ======== 5) التسميع: التعرف على القراءة ومطابقتها بكلمات الآية وتمييز الأخطاء ======== */
  function clearTasmeeMarkings() {
    tasmeeRetainedMistakes = Object.create(null);
    pageList.querySelectorAll('.w.tasmee-hidden, .w.tasmee-mistake').forEach(function (word) {
      word.classList.remove('tasmee-hidden', 'tasmee-mistake');
      word.removeAttribute('aria-hidden');
    });
  }

  function tasmeeMistakeKey(verseId, position) {
    return verseId + ':' + position;
  }

  function retainTasmeeMistakes() {
    if (!tasmeeSession) return;
    tasmeeSession.ayahs.forEach(function (state) {
      Object.keys(state.mistakes).forEach(function (position) {
        if (state.mistakes[position]) tasmeeRetainedMistakes[tasmeeMistakeKey(state.id, position)] = true;
      });
    });
  }

  function applyTasmeeWordState(container) {
    if (!container) return;
    var words = container.querySelectorAll('.w[data-v]');
    words.forEach(function (word) {
      var verseId = word.getAttribute('data-v');
      var position = +word.getAttribute('data-p');
      var verse = tasmeeEnabled && tasmeeSession && tasmeeSession.byId[verseId];
      var hasSessionWord = verse && position >= 1 && position <= verse.words.length;
      var isMistake =
        !!tasmeeRetainedMistakes[tasmeeMistakeKey(verseId, position)] ||
        !!(hasSessionWord && verse.mistakes[position]);
      var isHidden = !!(hasSessionWord && !verse.revealed[position]);
      word.classList.toggle('tasmee-hidden', isHidden);
      word.classList.toggle('tasmee-mistake', isMistake);
      if (isHidden) word.setAttribute('aria-hidden', 'true');
      else word.removeAttribute('aria-hidden');
    });
  }

  function normalizeTasmeeWord(word) {
    var s = String(word || '');
    s = s.replace(/و[\u064B-\u065F]*\u0670/g, 'ا');
    s = s.replace(/[\u06E6\u06E7]/g, 'ي');
    s = s.replace(/[\u06E5]/g, 'و');
    s = s.replace(/(?:ه[\u064B-\u065F]*\u0670(?=[ذؤ]))/g, 'ه');
    s = s.replace(/(?:ذ[\u064B-\u065F]*\u0670(?=ل))/g, 'ذ');
    s = s.replace(/(?:رَّحۡ?مَ[\u064B-\u065F]*\u0670(?=ن))/g, 'رحم');
    s = s.replace(/(?:لَ[\u064B-\u065F]*\u0670(?=[كه]))/g, 'ل');
    s = s.replace(/(?:أُوْلَـ[\u064B-\u065F]*\u0670)/g, 'اول');
    s = s.replace(/ى[\u064B-\u065F]*\u0670/g, 'ي');
    s = s.replace(/\u0670/g, 'ا');
    s = s.replace(/[\u064B-\u065F\u06D6-\u06ED\u0640]/g, '');
    s = s.replace(/[أإآٱ]/g, 'ا');
    s = s.replace(/ة/g, 'ه');
    s = s.replace(/ى/g, 'ي');
    s = s.replace(/ؤ/g, 'و');
    s = s.replace(/ئ/g, 'ي');
    s = s.replace(/[^\u0621-\u064A]/g, '');
    // Common external-recognizer spellings in Quranic recitation.
    s = s.replace(/^(?:علا|عل|عالي|علية)$/, 'علي');
    s = s.replace(/^اولايك$/, 'اوليك');
    return s;
  }

  function tasmeeWordDistance(a, b, limit) {
    if (Math.abs(a.length - b.length) > limit) return limit + 1;
    var previous = [];
    for (var j = 0; j <= b.length; j++) previous[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var current = [i],
        rowMin = i;
      for (var k = 1; k <= b.length; k++) {
        var cost = a[i - 1] === b[k - 1] ? 0 : 1;
        current[k] = Math.min(current[k - 1] + 1, previous[k] + 1, previous[k - 1] + cost);
        rowMin = Math.min(rowMin, current[k]);
      }
      if (rowMin > limit) return limit + 1;
      previous = current;
    }
    return previous[b.length];
  }

  // تقريب الحروف المتشابهة صوتيًا التي يخلط بينها المتعرّف الصوتي (ث/س، ذ/ز، ض/ظ، ط/ت، ء/ع...).
  function tasmeePhoneticKey(key) {
    return key
      .replace(/[ثص]/g, 'س')
      .replace(/[ذظ]/g, 'ز')
      .replace(/ض/g, 'د')
      .replace(/ط/g, 'ت')
      .replace(/ق/g, 'ك')
      .replace(/ح/g, 'ه')
      .replace(/[ءع]/g, '')
      .replace(/[اوي]/g, '')
      .replace(/(.)\1+/g, '$1');
  }

  // التسميع بمستوى متسامح ثابت (لا خيار للمستخدم).
  var tasmeeStrictness = 'lenient';

  function tasmeeWordMatches(spoken, expected) {
    if (!spoken || !expected) return false;
    var spokenKey = normalizeTasmeeWord(spoken);
    var expectedKey = normalizeTasmeeWord(expected);
    if (spokenKey === expectedKey) return true;

    var compactSpoken = spokenKey.replace(/(.)\1+/g, '$1');
    var compactExpected = expectedKey.replace(/(.)\1+/g, '$1');
    if (compactSpoken === compactExpected) return true;

    var minLength = tasmeeStrictness === 'lenient' ? 3 : tasmeeStrictness === 'strict' ? 5 : 4;
    var shorter = Math.min(compactSpoken.length, compactExpected.length);
    var longer = Math.max(compactSpoken.length, compactExpected.length);
    if (shorter < minLength) return false;

    // تسامح نسبي مع طول الكلمة.
    var limit =
      tasmeeStrictness === 'strict' ? (longer >= 8 ? 1 : 0) : longer >= 7 ? 2 : 1;
    if (limit && tasmeeWordDistance(compactSpoken, compactExpected, limit) <= limit) return true;

    // تطابق صوتي (الحروف المتشابهة): ليس في الوضع الصارم.
    if (tasmeeStrictness !== 'strict') {
      var phoneticSpoken = tasmeePhoneticKey(compactSpoken);
      var phoneticExpected = tasmeePhoneticKey(compactExpected);
      if (phoneticSpoken.length >= 3 && phoneticSpoken === phoneticExpected) return true;
    }
    return false;
  }

  // هل تطابق الكلمة المسموعة الكلمة رقم index في الآية: صيغة حفص أو أي صيغة للرواية المختارة.
  function tasmeeMatchesAt(spoken, state, index) {
    var expected = state.words[index];
    if (!expected) return false;
    if (tasmeeWordMatches(spoken, expected)) return true;
    var alternatives = state.alts && state.alts[index];
    if (alternatives) {
      for (var i = 0; i < alternatives.length; i++) {
        if (tasmeeWordMatches(spoken, alternatives[i])) return true;
      }
    }
    return false;
  }

  // These are recitation tokens, not ordinary Arabic words. Keeping them
  // separate is essential for البقرة، مريم، الشعراء، القصص ويس.
  var tasmeeMuqattaat = {
    2: ['ألف', 'لام', 'ميم'],
    3: ['ألف', 'لام', 'ميم'],
    7: ['ألف', 'لام', 'ميم', 'صاد'],
    10: ['ألف', 'لام', 'را'],
    11: ['ألف', 'لام', 'را'],
    12: ['ألف', 'لام', 'را'],
    13: ['ألف', 'لام', 'را'],
    14: ['ألف', 'لام', 'را'],
    15: ['ألف', 'لام', 'را'],
    19: ['كاف', 'ها', 'يا', 'عين', 'صاد'],
    20: ['طا', 'ها'],
    26: ['طا', 'سين', 'ميم'],
    27: ['طا', 'سين'],
    28: ['طا', 'سين', 'ميم'],
    29: ['ألف', 'لام', 'ميم'],
    30: ['ألف', 'لام', 'ميم'],
    31: ['ألف', 'لام', 'ميم'],
    32: ['ألف', 'لام', 'ميم'],
    36: ['يا', 'سين'],
    38: ['صاد'],
    40: ['حا', 'ميم'],
    41: ['حا', 'ميم'],
    42: ['حا', 'ميم', 'عين', 'سين', 'قاف'],
    43: ['حا', 'ميم'],
    44: ['حا', 'ميم'],
    45: ['حا', 'ميم'],
    46: ['حا', 'ميم'],
    50: ['قاف'],
    68: ['نون']
  };

  function tokenizeTasmeeTranscript(transcript) {
    var raw = String(transcript || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    var merged = [];
    for (var i = 0; i < raw.length; i++) {
      var token = raw[i];
      if ((token === 'و' || token === 'ف') && i + 1 < raw.length) {
        merged.push(token + raw[i + 1]);
        i++;
      } else {
        merged.push(token);
      }
    }
    return merged.map(normalizeTasmeeWord).filter(Boolean);
  }

  // بيانات الرواية المختارة للجلسة الحالية (null = حفص). تُحمَّل قبل إنشاء الجلسة.
  var tasmeeRiwayaVariants = null;
  function createTasmeeSession() {
    var surah = +tasmeeSurah.value,
      from = +tasmeeFrom.value,
      to = +tasmeeTo.value;
    if (!D.surahs[surah - 1] || !from || !to || from > to) {
      tasmeeStatus.textContent = 'حدد سورة ونطاق آيات صحيحًا للتسميع أولًا.';
      return false;
    }
    var ayahs = [],
      byId = Object.create(null);
    for (var ayah = from; ayah <= to; ayah++) {
      var id = surah * 1000 + ayah;
      var words = (
        ayah === 1 && tasmeeMuqattaat[surah]
          ? tasmeeMuqattaat[surah]
          : D.texts[surah - 1][ayah - 1].split(/\s+/)
      )
        .map(normalizeTasmeeWord)
        .filter(Boolean);
      if (!words.length) {
        tasmeeStatus.textContent = 'تعذر تجهيز كلمات الآية ' + ar(ayah) + ' للتسميع.';
        return false;
      }
      var riwayaVariants = tasmeeRiwayaVariants && !(ayah === 1 && tasmeeMuqattaat[surah])
        ? tasmeeRiwayaVariants[surah + ':' + ayah]
        : null;
      var alts = [];
      if (riwayaVariants) {
        Object.keys(riwayaVariants).forEach(function (position) {
          alts[position - 1] = riwayaVariants[position].map(normalizeTasmeeWord).filter(Boolean);
        });
      }
      var state = {
        id: id,
        words: words,
        alts: alts,
        wordIndex: 0,
        revealed: Object.create(null),
        mistakes: Object.create(null),
        prompted: Object.create(null)
      };
      ayahs.push(state);
      byId[id] = state;
    }
    tasmeeSession = {
      surah: surah,
      from: from,
      to: to,
      ayahs: ayahs,
      byId: byId,
      verseIndex: 0,
      completed: false
    };
    clearTasmeeMarkings();
    return true;
  }

  function currentTasmeeAyah() {
    return tasmeeSession && tasmeeSession.ayahs[tasmeeSession.verseIndex];
  }

  function rewindTasmeeToUnrevealedWord() {
    for (var i = 0; i < tasmeeSession.ayahs.length; i++) {
      var state = tasmeeSession.ayahs[i];
      for (var position = 1; position <= state.words.length; position++) {
        if (state.revealed[position]) continue;
        tasmeeSession.verseIndex = i;
        state.wordIndex = position - 1;
        return state;
      }
    }
    return null;
  }

  function hasUnrevealedTasmeeWords() {
    return tasmeeSession.ayahs.some(function (state) {
      return state.words.some(function (word, index) {
        return !state.revealed[index + 1];
      });
    });
  }

  function promptTasmeeWord() {
    if (!tasmeeEnabled || !tasmeeSession || tasmeeSession.completed) return;
    var state = currentTasmeeAyah();
    if (!state) return;

    var targetPosition = -1;
    for (var p = state.wordIndex + 1; p <= state.words.length; p++) {
      if (!state.revealed[p]) {
        targetPosition = p;
        break;
      }
    }

    if (targetPosition < 0) {
      for (var a = tasmeeSession.verseIndex + 1; a < tasmeeSession.ayahs.length; a++) {
        var nextState = tasmeeSession.ayahs[a];
        for (var np = 1; np <= nextState.words.length; np++) {
          if (!nextState.revealed[np]) {
            tasmeeSession.verseIndex = a;
            state = nextState;
            targetPosition = np;
            break;
          }
        }
        if (targetPosition >= 1) break;
      }
    }

    if (targetPosition < 0) {
      var rewindState = rewindTasmeeToUnrevealedWord();
      if (rewindState) {
        state = rewindState;
        for (var rp = 1; rp <= state.words.length; rp++) {
          if (!state.revealed[rp]) {
            targetPosition = rp;
            break;
          }
        }
      }
    }

    if (targetPosition < 0) {
      finishTasmee();
      return;
    }

    state.revealed[targetPosition] = true;
    state.mistakes[targetPosition] = true;
    state.prompted = state.prompted || Object.create(null);
    state.prompted[targetPosition] = true;
    state.wordIndex = targetPosition;

    applyTasmeeWordState(pageList);
    navigateToVerse(state.id);

    var verse = pageList.querySelector('.w[data-v="' + state.id + '"][data-p="' + targetPosition + '"]');
    if (verse) verse.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

    tasmeeStatus.textContent = 'تم تلقين الكلمة المظللة؛ يمكنك قراءتها ومتابعة التسميع.';

    if (state.wordIndex >= state.words.length) {
      tasmeeSession.verseIndex += 1;
      if (tasmeeSession.verseIndex >= tasmeeSession.ayahs.length) {
        if (!rewindTasmeeToUnrevealedWord()) {
          finishTasmee();
        }
      }
    }
  }

  function stopTasmeeRecognition() {
    clearTimeout(tasmeeRestartTimer);
    tasmeeRestartTimer = 0;
    var recognition = tasmeeRecognition;
    tasmeeListening = false;
    tasmeeRecognition = null;
    if (recognition) {
      recognition.onend = null;
      if (tasmeeRecognitionStarted) recognition.stop();
    }
    tasmeeRecognitionStarted = false;
    tasmeeInterimTokens = [];
    syncTasmeeControls();
  }

  function finishTasmee() {
    if (!tasmeeSession) return;
    tasmeeSession.completed = true;
    stopTasmeeRecognition();
    var promptedCount = 0,
      totalWords = 0;
    tasmeeSession.ayahs.forEach(function (state) {
      totalWords += state.words.length;
      if (state.prompted) {
        promptedCount += Object.keys(state.prompted).length;
      }
    });
    var errors = tasmeeSession.errorCount || 0;
    var accuracy = totalWords ? Math.max(0, Math.round(((totalWords - errors - promptedCount) / totalWords) * 100)) : 100;
    var report = ' — الدقة ' + ar(accuracy) + '٪ (' + ar(totalWords) + ' كلمة، ' + ar(errors) + ' أخطاء، ' + ar(promptedCount) + ' تلقين).';
    tasmeeStatus.textContent =
      (promptedCount > 0 || errors > 0 ? 'أحسنت! اكتمل التسميع' : 'ممتاز! اكتمل تسميع النطاق دون أي خطأ أو تلقين') + report;
    showTasmeeCelebration();
  }

  // عدة رموز مسموعة متتالية (٢–٣) تُكوّن الكلمة المتوقعة. تُرجع عدد الرموز أو 0.
  function tasmeeSplitMatch(tokens, from, state, index) {
    for (var n = 2; n <= 3 && from + n <= tokens.length; n++) {
      if (tasmeeMatchesAt(tokens.slice(from, from + n).join(''), state, index)) return n;
    }
    return 0;
  }

  // رمز مسموع واحد يساوي كلمتين أو ثلاثًا متتالية من المصحف. تُرجع عدد الكلمات أو 0.
  function tasmeeMergeMatch(token, state, index) {
    var joined = state.words[index] || '';
    for (var n = 2; n <= 3 && index + n <= state.words.length; n++) {
      joined += state.words[index + n - 1];
      var blocked = false;
      for (var k = 0; k < n; k++) if (state.prompted && state.prompted[index + 1 + k]) blocked = true;
      if (!blocked && tasmeeWordMatches(token, joined)) return n;
    }
    return 0;
  }

  function processTasmeeTranscript(transcript, showFeedback, interim) {
    if (!tasmeeListening || !tasmeeSession || tasmeeSession.completed) return 0;
    var tokens = tokenizeTasmeeTranscript(transcript);
    if (!tokens.length) return 0;

    var matchedAny = false;
    var changedVerse = false;
    var tokenIdx = 0;
    var mismatchDetected = false;
    var splitLen = 0,
      mergeLen = 0;

    var state = currentTasmeeAyah();
    if (!state) return 0;

    // النتائج المؤقتة (interim) غير مستقرة: لا نسجّل منها أخطاءً، نكتفي بمطابقة الصحيح
    // ونترك الباقي ليُحسم عند النتيجة النهائية.
    while (!interim && tokenIdx < tokens.length && state.wordIndex > 0) {
      var matchedPrior = false;
      // تكرار كلمة سبق قراءتها (تلعثم/إعادة): يُتجاهل ولا يُعدّ خطأً، إلا إذا كانت هي نفسها الكلمة المتوقعة.
      if (!tasmeeMatchesAt(tokens[tokenIdx], state, state.wordIndex)) {
        for (var prior = Math.max(0, state.wordIndex - 3); prior < state.wordIndex; prior++) {
          if (tasmeeMatchesAt(tokens[tokenIdx], state, prior)) {
            matchedPrior = true;
            break;
          }
        }
      }
      if (matchedPrior) tokenIdx++;
      else break;
    }

    while (tokenIdx < tokens.length) {
      state = currentTasmeeAyah();
      if (!state) break;

      var expectedIndex = state.wordIndex;

      if (expectedIndex >= state.words.length) {
        tasmeeSession.verseIndex += 1;
        changedVerse = true;
        if (tasmeeSession.verseIndex >= tasmeeSession.ayahs.length) {
          if (rewindTasmeeToUnrevealedWord()) {
            changedVerse = true;
            state = currentTasmeeAyah();
            expectedIndex = state ? state.wordIndex : 0;
          } else {
            finishTasmee();
            return;
          }
        } else {
          state = currentTasmeeAyah();
          expectedIndex = state ? state.wordIndex : 0;
        }
        if (!state) break;
      }

      var token = tokens[tokenIdx];

      if (expectedIndex > 0 && state.prompted && state.prompted[expectedIndex]) {
        if (tasmeeMatchesAt(token, state, expectedIndex - 1)) {
          tokenIdx++;
          continue;
        }
      }

      // Only the current word may unlock the next word. Do not search
      // ahead: recognizing a later word must not hide missed words.
      var matchedIndex = tasmeeMatchesAt(token, state, expectedIndex) ? expectedIndex : -1;

      if (matchedIndex >= 0) {
        matchedAny = true;
        var position = matchedIndex + 1;
        state.revealed[position] = true;
        if (!state.prompted || !state.prompted[position]) {
          delete state.mistakes[position];
        }
        state.wordIndex = matchedIndex + 1;
        tokenIdx++;

        if (state.wordIndex >= state.words.length) {
          tasmeeSession.verseIndex += 1;
          changedVerse = true;
          if (tasmeeSession.verseIndex >= tasmeeSession.ayahs.length) {
            if (rewindTasmeeToUnrevealedWord()) changedVerse = true;
            else {
              applyTasmeeWordState(pageList);
              finishTasmee();
              return tokenIdx;
            }
          }
        }
      } else if ((splitLen = tasmeeSplitMatch(tokens, tokenIdx, state, expectedIndex)) > 0) {
        // انقسام: عدة كلمات مسموعة = كلمة واحدة في المصحف.
        matchedAny = true;
        state.revealed[expectedIndex + 1] = true;
        if (!state.prompted || !state.prompted[expectedIndex + 1]) delete state.mistakes[expectedIndex + 1];
        state.wordIndex = expectedIndex + 1;
        tokenIdx += splitLen;
      } else if ((mergeLen = tasmeeMergeMatch(token, state, expectedIndex)) > 0) {
        // اندماج (قراءة سريعة): كلمة مسموعة = عدة كلمات في المصحف.
        matchedAny = true;
        for (var m = 0; m < mergeLen; m++) {
          state.revealed[expectedIndex + 1 + m] = true;
          delete state.mistakes[expectedIndex + 1 + m];
        }
        state.wordIndex = expectedIndex + mergeLen;
        tokenIdx++;
      } else if (interim) {
        break;
      } else {
        // مزامنة ذكية: إن طابقت الكلمة المسموعة كلمة قادمة (خلال ٣ كلمات) فالقارئ تجاوز كلمات
        // أو أسقطها المتعرّف. الكلمات المتجاوزة تُوسَم أخطاءً وتبقى مخفية (يعود إليها التسميع في النهاية)،
        // وفي الوضع المتسامح تُقبل كلمة واحدة متجاوزة دون وسم.
        var ahead = 0;
        var maxAhead = token.length >= 4 ? 3 : 1;
        for (var k = 1; k <= maxAhead && expectedIndex + k < state.words.length; k++) {
          if (state.prompted && state.prompted[expectedIndex + k + 1]) break;
          if (tasmeeMatchesAt(token, state, expectedIndex + k)) {
            ahead = k;
            break;
          }
        }
        if (ahead) {
          var forgiven = tasmeeStrictness === 'lenient' && ahead === 1;
          for (var skip = 0; skip < ahead; skip++) {
            if (forgiven) {
              state.revealed[expectedIndex + 1 + skip] = true;
              delete state.mistakes[expectedIndex + 1 + skip];
            } else {
              state.mistakes[expectedIndex + 1 + skip] = true;
              mismatchDetected = true;
              tasmeeSession.errorCount = (tasmeeSession.errorCount || 0) + 1;
            }
          }
          matchedAny = true;
          state.revealed[expectedIndex + ahead + 1] = true;
          if (!state.prompted || !state.prompted[expectedIndex + ahead + 1])
            delete state.mistakes[expectedIndex + ahead + 1];
          state.wordIndex = expectedIndex + ahead + 1;
          tokenIdx++;
          if (state.wordIndex >= state.words.length) {
            tasmeeSession.verseIndex += 1;
            changedVerse = true;
            if (tasmeeSession.verseIndex >= tasmeeSession.ayahs.length) {
              if (rewindTasmeeToUnrevealedWord()) changedVerse = true;
              else {
                applyTasmeeWordState(pageList);
                finishTasmee();
                return tokenIdx;
              }
            }
          }
        } else {
          // كلمة خاطئة أو تكرار: نسم الكلمة المتوقعة فورًا.
          state.mistakes[expectedIndex + 1] = true;
          mismatchDetected = true;
          tasmeeSession.errorCount = (tasmeeSession.errorCount || 0) + 1;
          tokenIdx++;
        }
      }
    }

    if (matchedAny) {
      applyTasmeeWordState(pageList);
      var curAyah = currentTasmeeAyah();
      if (changedVerse && curAyah) navigateToVerse(curAyah.id);
      tasmeeStatus.textContent = mismatchDetected
        ? 'تمت مطابقة بعض الكلمات، ورُصد خطأ/تجاوز في كلمة أخرى؛ تابع من الكلمة المظللة.'
        : hasUnrevealedTasmeeWords()
          ? 'صحيح، تابع القراءة.'
          : 'أحسنت، اكتملت قراءة النطاق المحدد.';
    } else if (showFeedback !== false) {
      tasmeeStatus.textContent = mismatchDetected
        ? 'رُصد خطأ أو تجاوز/تكرار في الكلمة الحالية؛ أعد قراءتها بدقة.'
        : 'لم يتم التعرف على الكلمة؛ أعد المحاولة أو اضغط زر التلقين للمساعدة.';
    }
    if (mismatchDetected) applyTasmeeWordState(pageList);
    return tokenIdx;
  }

  function selectTasmeeSpeechAlternative(result) {
    if (!result || !result.length) return '';
    var state = currentTasmeeAyah();
    var expectedIndex = state ? state.wordIndex : 0;
    var bestText = result[0].transcript || '';
    var bestScore = -1;
    for (var alternativeIndex = 0; alternativeIndex < result.length; alternativeIndex++) {
      var candidate = result[alternativeIndex].transcript || '';
      var candidateTokens = tokenizeTasmeeTranscript(candidate);
      var score = 0;
      if (state) {
        for (var tokenIndex = 0; tokenIndex < candidateTokens.length && tokenIndex < 4; tokenIndex++) {
          var expectedWord = state.words[expectedIndex + tokenIndex];
          if (expectedWord && tasmeeMatchesAt(candidateTokens[tokenIndex], state, expectedIndex + tokenIndex))
            score += 3;
          else if (expectedWord) score -= 1;
        }
      }
      // نفضّل البديل الأكمل عند التساوي، ونرجّح بثقة المتعرّف.
      score += Math.min(candidateTokens.length, 4) * 0.05;
      score += (result[alternativeIndex].confidence || 0) * 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestText = candidate;
      }
    }
    return bestText;
  }

  // تلميحات سياقية: المتصفحات التي تدعم SpeechRecognitionPhrase تُرجّح الكلمات المتوقعة القادمة.
  function applyTasmeePhraseHints(recognition) {
    try {
      if (typeof window.SpeechRecognitionPhrase !== 'function') return;
      var state = currentTasmeeAyah();
      if (!state) return;
      var words = state.words.slice(state.wordIndex, state.wordIndex + 10);
      if (!words.length) return;
      recognition.phrases = words.map(function (word) {
        return new window.SpeechRecognitionPhrase(word, 4);
      });
    } catch (error) {
      /* غير مدعوم: يعمل التعرف بدونها */
    }
  }


  var tasmeeFailStreak = 0;

  // إعادة تشغيل المايك: سريعة (120ms) في الحالة العادية، وتصاعدية (حتى 4s) عند تكرار الفشل،
  // مع إعادة إنشاء الكائن فقط إذا رفض start().
  function scheduleTasmeeRestart(recognition, Recognition) {
    clearTimeout(tasmeeRestartTimer);
    var delay = Math.min(4000, tasmeeFailStreak ? 300 * Math.pow(2, tasmeeFailStreak - 1) : 120);
    if (document.hidden) delay = Math.max(delay, 1000);
    tasmeeRestartTimer = setTimeout(function () {
      if (!tasmeeListening || tasmeeRecognition !== recognition) return;
      if (tasmeeRecognitionStarted) return;
      applyTasmeePhraseHints(recognition);
      try {
        recognition.start();
      } catch (error) {
        if (error && error.name === 'InvalidStateError') return; // يعمل بالفعل
        tasmeeFailStreak++;
        tasmeeRecognition = null;
        startBrowserTasmeeRecognition(Recognition);
      }
    }, delay);
  }

  function resumeTasmeeIfStalled() {
    if (!tasmeeListening || !tasmeeRecognition || tasmeeRecognitionStarted) return;
    tasmeeFailStreak = 0;
    scheduleTasmeeRestart(tasmeeRecognition, window.SpeechRecognition || window.webkitSpeechRecognition);
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) resumeTasmeeIfStalled();
  });
  window.addEventListener('online', resumeTasmeeIfStalled);

  function startBrowserTasmeeRecognition(Recognition) {
    if (!tasmeeSession || tasmeeSession.completed) {
      if (!createTasmeeSession()) return;
    }
    var firstAyah = currentTasmeeAyah();
    if (firstAyah) {
      closeD();
      navigateToVerse(firstAyah.id);
    }
    stopRecitation('تم إيقاف الاستماع لبدء التسميع');
    tasmeeListening = true;
    tasmeeFailStreak = 0;
    tasmeeInterimTokens = [];
    applyTasmeeWordState(pageList);
    syncTasmeeControls();

    var recognition;
    try {
      recognition = new Recognition();
      recognition.lang = 'ar-SA';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 5;
      applyTasmeePhraseHints(recognition);
    } catch (error) {
      tasmeeStatus.textContent = 'تعذر تهيئة التعرف الصوتي.';
      stopTasmeeRecognition();
      return;
    }
    tasmeeRecognition = recognition;
    tasmeeRecognitionStarted = false;
    recognition.onstart = function () {
      tasmeeRecognitionStarted = true;
      tasmeeStatus.textContent = 'الميكروفون يعمل؛ ابدأ بتسميع الآيات غيبًا.';
      syncTasmeeControls();
    };
    recognition.onresult = function (event) {
      if (tasmeeRecognition !== recognition) return;
      tasmeeFailStreak = 0;
      var finalText = '',
        interimText = '';
      for (var i = event.resultIndex; i < event.results.length; i++) {
        var recognizedText = selectTasmeeSpeechAlternative(event.results[i]);
        if (event.results[i].isFinal) finalText += ' ' + recognizedText;
        else interimText += ' ' + recognizedText;
      }
      var interimTokens = tokenizeTasmeeTranscript(interimText);
      var common = 0;
      while (
        common < tasmeeInterimTokens.length &&
        common < interimTokens.length &&
        tasmeeInterimTokens[common] === interimTokens[common]
      )
        common++;
      // المؤقت: نطابق الصحيح فقط، وما لم يُطابَق يبقى خارج "المعالَج" ليُحسم في النتيجة النهائية.
      var consumed = 0;
      if (interimTokens.length > common) {
        consumed = processTasmeeTranscript(interimTokens.slice(common).join(' '), false, true);
      }
      tasmeeInterimTokens = interimTokens.slice(0, common + consumed);
      if (finalText.trim()) {
        var finalTokens = tokenizeTasmeeTranscript(finalText),
          finalCommon = 0;
        while (
          finalCommon < tasmeeInterimTokens.length &&
          finalCommon < finalTokens.length &&
          tasmeeInterimTokens[finalCommon] === finalTokens[finalCommon]
        )
          finalCommon++;
        if (finalTokens.length > finalCommon) {
          processTasmeeTranscript(finalTokens.slice(finalCommon).join(' '), true, false);
        }
        tasmeeInterimTokens = [];
      }
    };
    recognition.onerror = function (event) {
      if (tasmeeRecognition !== recognition) return;
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        tasmeeStatus.textContent = 'لم يُسمح بالمايك؛ فعّل إذن الميكروفون من إعدادات التطبيق ثم حاول مجددًا.';
        stopTasmeeRecognition();
        return;
      }
      if (event.error === 'audio-capture') {
        tasmeeStatus.textContent = 'لا يوجد ميكروفون متاح أو يستخدمه تطبيق آخر؛ جارٍ إعادة المحاولة…';
      } else if (event.error === 'network') {
        tasmeeStatus.textContent = 'التعرف الصوتي يحتاج اتصالًا بالإنترنت؛ جارٍ إعادة المحاولة…';
      } else {
        tasmeeStatus.textContent = 'تعذر التعرف مؤقتًا؛ جارٍ إعادة المحاولة…';
      }
      tasmeeFailStreak++;
    };
    recognition.onend = function () {
      if (tasmeeRecognition !== recognition) return;
      tasmeeRecognitionStarted = false;
      if (!tasmeeListening) return;
      scheduleTasmeeRestart(recognition, Recognition);
    };
    try {
      recognition.start();
    } catch (error) {
      tasmeeStatus.textContent = 'تعذر تشغيل الميكروفون؛ حاول مرة أخرى.';
      stopTasmeeRecognition();
    }
  }

  function startTasmeeRecognition() {
    var BrowserRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!BrowserRecognition) {
      tasmeeStatus.textContent =
        'هذا الجهاز لا يدعم التعرف الصوتي. استخدم Chrome أو حدّث Android System WebView.';
      return;
    }
    if (tasmeeSession && !tasmeeSession.completed) {
      startBrowserTasmeeRecognition(BrowserRecognition);
      return;
    }
    // جلسة جديدة.
    if (!createTasmeeSession()) return;
    startBrowserTasmeeRecognition(BrowserRecognition);
  }

  $('wp').addEventListener('click', function (event) {
    if (!event.target.closest('.wp-recitation-tasmee')) return;
    if (popWord) setTasmeeVerse(+popWord.getAttribute('data-v'));
    if (!tasmeeEnabled) {
      tasmeeEnabled = true;
      save('mq.tasmeeEnabled', true);
    }
    closeWp();
    tasmeeWindowOpen = true;
    syncTasmeeControls();
  });
  tasmeeClose.addEventListener('click', function () {
    if (tasmeeListening) stopTasmeeRecognition();
    retainTasmeeMistakes();
    tasmeeSession = null;
    tasmeeEnabled = false;
    save('mq.tasmeeEnabled', false);
    applyTasmeeWordState(pageList);
    tasmeeStatus.textContent = '';
    tasmeeWindowOpen = false;
    syncTasmeeControls();
  });
  var tasmeeDrag = null;
  tasmeeSection.addEventListener('pointerdown', function (event) {
    if (event.target.closest('button, select, input, textarea, a, .pro-select, .pro-select-menu')) return;
    var rect = tasmeeSection.getBoundingClientRect();
    tasmeeSection.style.right = 'auto';
    tasmeeSection.style.left = rect.left + 'px';
    tasmeeSection.style.top = rect.top + 'px';
    tasmeeSection.style.bottom = 'auto';
    tasmeeSection.style.transform = 'none';
    tasmeeDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    tasmeeSection.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  tasmeeSection.addEventListener('pointermove', function (event) {
    if (!tasmeeDrag || event.pointerId !== tasmeeDrag.pointerId) return;
    var maxLeft = Math.max(0, window.innerWidth - tasmeeSection.offsetWidth);
    var maxTop = Math.max(0, window.innerHeight - Math.min(tasmeeSection.offsetHeight, window.innerHeight));
    tasmeeSection.style.left = Math.max(0, Math.min(maxLeft, event.clientX - tasmeeDrag.offsetX)) + 'px';
    tasmeeSection.style.top = Math.max(0, Math.min(maxTop, event.clientY - tasmeeDrag.offsetY)) + 'px';
  });
  function endTasmeeDrag(event) {
    if (!tasmeeDrag || event.pointerId !== tasmeeDrag.pointerId) return;
    tasmeeDrag = null;
    try {
      tasmeeSection.releasePointerCapture(event.pointerId);
    } catch (x) {}
  }
  tasmeeSection.addEventListener('pointerup', endTasmeeDrag);
  tasmeeSection.addEventListener('pointercancel', endTasmeeDrag);

  tasmeeToggle.addEventListener('click', function () {
    if (!tasmeeEnabled) return;
    if (tasmeeListening) {
      stopTasmeeRecognition();
      tasmeeStatus.textContent = '';
      return;
    }
    startTasmeeRecognition();
  });
  tasmeePrompt.addEventListener('click', promptTasmeeWord);
  updateTasmeeBounds(false);
  tasmeeFrom.value = String(
    Math.max(1, Math.min(D.surahs[initialTasmeeSurah - 1][3], +tasmeePrefs.from || 1))
  );
  tasmeeTo.value = String(
    Math.max(
      +tasmeeFrom.value,
      Math.min(D.surahs[initialTasmeeSurah - 1][3], +tasmeePrefs.to || +tasmeeFrom.value)
    )
  );
  updateTasmeeBounds(false);
  tasmeeSurah.addEventListener('change', function () {
    updateTasmeeBounds(true);
    saveTasmeePrefs();
    if (tasmeeSession) {
      stopTasmeeRecognition();
      tasmeeSession = null;
      clearTasmeeMarkings();
      tasmeeStatus.textContent = 'تغير نطاق التسميع؛ ابدأ جلسة جديدة.';
      syncTasmeeControls();
    }
  });
  [tasmeeFrom, tasmeeTo].forEach(function (select) {
    select.addEventListener('change', function () {
      updateTasmeeBounds(false);
      saveTasmeePrefs();
      if (!tasmeeSession) return;
      stopTasmeeRecognition();
      tasmeeSession = null;
      clearTasmeeMarkings();
      tasmeeStatus.textContent = 'تغير نطاق التسميع؛ ابدأ جلسة جديدة.';
      syncTasmeeControls();
    });
  });
  syncTasmeeControls();

  /* ======== 6) التلاوة الصوتية: تشغيل آية آية وتظليل الكلمة الجارية وتنزيل المقطع ======== */
  function paintRecitationAyah(ayah) {
    pageList.querySelectorAll('.w.recitation-active').forEach(function (word) {
      word.classList.remove('recitation-active');
    });
    pageList.querySelectorAll('.recitation-verse-band').forEach(function (band) {
      band.remove();
    });
    recitationWordGroups = [];
    activeRecitationWord = null;
    if (!ayah || !recitationRange) return;
    var id = recitationRange.surah * 1000 + ayah;
    var page = pageOfV(id),
      target = pageList.querySelector('.page-view[data-page="' + page + '"]');
    if (!target || page !== cur) {
      navigateToVerse(id);
      renderQueue.then(function () {
        requestAnimationFrame(function () {
          paintRecitationAyah(ayah);
        });
      });
      return;
    }
    var words = target.querySelectorAll('.w[data-v="' + id + '"]');
    if (!words.length) return;
    var groups = {};
    words.forEach(function (word) {
      var position = +word.getAttribute('data-p');
      if (position <= 0) return;
      if (!groups[position]) groups[position] = { position: position, elements: [], weight: 0 };
      groups[position].elements.push(word);
      groups[position].weight += Math.max(1, Array.from(word.textContent).length);
    });
    recitationWordGroups = Object.keys(groups)
      .map(function (position) {
        return groups[position];
      })
      .sort(function (a, b) {
        return a.position - b.position;
      });
    if (recitationTrackingMode === 'ayah') {
      var verseWords = Array.prototype.filter.call(words, function (word) {
        return +word.getAttribute('data-p') > 0;
      });
      var verseLines = [];
      verseWords.forEach(function (word) {
        var line = word.closest('.ln'),
          lineGroup = null;
        verseLines.some(function (group) {
          if (group.line === line) {
            lineGroup = group;
            return true;
          }
          return false;
        });
        if (!lineGroup) {
          lineGroup = { line: line, words: [] };
          verseLines.push(lineGroup);
        }
        lineGroup.words.push(word);
      });
      verseLines.forEach(function (group) {
        var lineRect = group.line.getBoundingClientRect(),
          left = Infinity,
          right = -Infinity;
        group.words.forEach(function (word) {
          var rect = word.getBoundingClientRect();
          left = Math.min(left, rect.left);
          right = Math.max(right, rect.right);
        });
        var band = document.createElement('i');
        band.className = 'recitation-verse-band';
        band.setAttribute('aria-hidden', 'true');
        band.style.left = (left - lineRect.left - 2).toFixed(1) + 'px';
        band.style.width = (right - left + 4).toFixed(1) + 'px';
        group.line.insertBefore(band, group.line.firstChild);
      });
      if (verseWords.length) {
        var rect = verseWords[0].getBoundingClientRect();
        if (rect.top < 72 || rect.bottom > window.innerHeight - 48) {
          verseWords[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    } else if (recitationWordGroups.length) {
      updateRecitationWord(0);
    }
  }

  function updateRecitationWord(progress) {
    if (!recitationWordGroups.length) return;
    var totalWeight = recitationWordGroups.reduce(function (total, group) {
      return total + group.weight;
    }, 0);
    var elapsedWeight = Math.max(0, Math.min(0.999999, progress)) * totalWeight;
    var selected = recitationWordGroups[0];
    for (var i = 0, accumulated = 0; i < recitationWordGroups.length; i++) {
      accumulated += recitationWordGroups[i].weight;
      if (elapsedWeight < accumulated) {
        selected = recitationWordGroups[i];
        break;
      }
    }
    if (selected === activeRecitationWord) return;
    if (activeRecitationWord)
      activeRecitationWord.elements.forEach(function (word) {
        word.classList.remove('recitation-active');
      });
    activeRecitationWord = selected;
    selected.elements.forEach(function (word) {
      word.classList.add('recitation-active');
    });
    var rect = selected.elements[0].getBoundingClientRect();
    if (rect.top < 72 || rect.bottom > window.innerHeight - 48) {
      selected.elements[0].scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }

  function playRecitationAyah() {
    if (!recitationRange) return;
    paintRecitationAyah(recitationAyah);
    var repeatCount = +recitationRepeat.value || 1;
    recitationStatus.textContent =
      (repeatCount > 1 ? 'التكرار ' + ar(recitationRepeatCurrent) + ' من ' + ar(repeatCount) + ' — ' : '') +
      'الآية ' +
      ar(recitationAyah) +
      ' من ' +
      ar(recitationRange.to);
    recitationAudio.src = recitationUrl(recitationRange.surah, recitationAyah);
    recitationAudio.load();
    var playback = recitationAudio.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(function () {
        if (!recitationRange) return;
        stopRecitation('تعذّر تشغيل التلاوة؛ تحقق من اتصال الإنترنت وحاول مجددًا');
        toast('تعذّر تشغيل التلاوة');
      });
    }
  }

  async function downloadRecitationClip() {
    var surah = +recitationSurah.value;
    var from = +recitationFrom.value;
    var to = +recitationTo.value;
    if (!surah || !from || !to || from > to) {
      toast('حدد نطاقًا صحيحًا للآيات');
      return;
    }

    stopRecitation('جارٍ تحضير المقطع للتنزيل…');
    var generation = ++recitationDownloadGeneration;
    var reciter = reciterSelect.value;
    recitationDownload.disabled = true;
    try {
      var chunks = [];
      var totalBytes = 0;
      for (var ayah = from; ayah <= to; ayah++) {
        if (generation !== recitationDownloadGeneration) return;
        recitationStatus.textContent =
          'جارٍ تحميل الآية ' + ar(ayah - from + 1) + ' من ' + ar(to - from + 1) + '…';
        var response = await fetch(recitationUrl(surah, ayah, reciter));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var chunk = await response.arrayBuffer();
        totalBytes += chunk.byteLength;
        if (totalBytes > 50 * 1024 * 1024) throw new Error('SIZE_LIMIT');
        chunks.push(chunk);
      }
      if (generation !== recitationDownloadGeneration) return;
      var blob = new Blob(chunks, { type: 'audio/mpeg' });
      var objectUrl = URL.createObjectURL(blob);
      var link = document.createElement('a');
      var surahName = D.surahs[surah - 1][1].replace(/[\\/:*?"<>|]/g, '-');
      link.href = objectUrl;
      link.download = 'تلاوة-' + surahName + '-' + from + '-' + to + '.mp3';
      link.click();
      setTimeout(function () {
        URL.revokeObjectURL(objectUrl);
      }, 60000);
      recitationStatus.textContent = 'تم تنزيل المقطع الصوتي المحدد';
    } catch (error) {
      if (generation !== recitationDownloadGeneration) return;
      console.error('تعذر تنزيل المقطع الصوتي:', error);
      recitationStatus.textContent =
        error.message === 'SIZE_LIMIT'
          ? 'النطاق كبير جدًا لملف واحد؛ قلّل عدد الآيات ثم حاول مجددًا'
          : 'تعذر تنزيل المقطع؛ تحقق من اتصال الإنترنت وحاول مجددًا';
      toast(recitationStatus.textContent);
    } finally {
      if (generation === recitationDownloadGeneration) recitationDownload.disabled = false;
    }
  }

  recitationAudio.preload = 'none';
  recitationAudio.addEventListener('timeupdate', function () {
    if (
      recitationTrackingMode !== 'word' ||
      !recitationRange ||
      !recitationWordGroups.length ||
      !isFinite(recitationAudio.duration) ||
      recitationAudio.duration <= 0
    )
      return;
    updateRecitationWord(recitationAudio.currentTime / recitationAudio.duration);
  });
  recitationAudio.addEventListener('ended', function () {
    if (!recitationRange) return;
    var repeatCount = +recitationRepeat.value || 1;
    if (recitationAyah < recitationRange.to) {
      recitationAyah += 1;
      playRecitationAyah();
      return;
    }
    if (recitationRepeatCurrent < repeatCount) {
      recitationRepeatCurrent += 1;
      recitationAyah = recitationRange.from;
      playRecitationAyah();
      return;
    }
    recitationRange = null;
    recitationAyah = 0;
    paintRecitationAyah(0);
    setRecitationButton(false);
    recitationStatus.textContent = 'اكتمل الاستماع إلى النطاق المحدد';
  });
  recitationAudio.addEventListener('error', function () {
    if (!recitationRange) return;
    stopRecitation('تعذّر تحميل التلاوة؛ تحقق من الاتصال أو اختر قارئًا آخر');
    toast('تعذّر تحميل الآية');
  });

  recitationSurah.addEventListener('change', function () {
    stopRecitation('تم تغيير السورة؛ حدد الآيات ثم ابدأ الاستماع');
    updateRecitationBounds(true);
    saveRecitationPrefs();
  });
  recitationFrom.addEventListener('change', function () {
    stopRecitation('تم تغيير نطاق الآيات؛ ابدأ الاستماع');
    updateRecitationBounds(false);
    saveRecitationPrefs();
  });
  recitationTo.addEventListener('change', function () {
    stopRecitation('تم تغيير نطاق الآيات؛ ابدأ الاستماع');
    updateRecitationBounds(false);
    saveRecitationPrefs();
  });
  reciterSelect.addEventListener('change', function () {
    stopRecitation('تم تغيير القارئ؛ ابدأ الاستماع');
    saveRecitationPrefs();
  });
  recitationRepeat.addEventListener('change', function () {
    stopRecitation('تم تغيير عدد مرات التكرار؛ ابدأ الاستماع');
    saveRecitationPrefs();
  });
  recitationDownload.addEventListener('click', downloadRecitationClip);
  recitationPlay.addEventListener('click', function () {
    if (tasmeeListening) {
      stopTasmeeRecognition();
      tasmeeStatus.textContent = '';
    }
    if (!recitationAudio.paused) {
      recitationAudio.pause();
      setRecitationButton(false);
      recitationStatus.textContent = 'التلاوة متوقفة مؤقتًا';
      return;
    }
    if (recitationRange) {
      setRecitationButton(true);
      var playback = recitationAudio.play();
      if (playback && typeof playback.catch === 'function') {
        playback.catch(function () {
          if (!recitationRange) return;
          stopRecitation('تعذّر استئناف التلاوة؛ تحقق من اتصال الإنترنت وحاول مجددًا');
          toast('تعذّر استئناف التلاوة');
        });
      }
      return;
    }
    updateRecitationBounds(false);
    var from = +recitationFrom.value,
      to = +recitationTo.value;
    if (!from || !to || from > to) {
      toast('حدد نطاقًا صحيحًا للآيات');
      return;
    }
    saveRecitationPrefs();
    closeD();
    recitationRange = { surah: +recitationSurah.value, from: from, to: to };
    recitationAyah = from;
    recitationRepeatCurrent = 1;
    setRecitationButton(true);
    playRecitationAyah();
  });
  updateRecitationBounds(true);
  recitationFrom.value = String(
    Math.max(1, Math.min(D.surahs[initialSurah - 1][3], +recitationPrefs.from || 1))
  );
  recitationTo.value = String(
    Math.max(
      +recitationFrom.value,
      Math.min(D.surahs[initialSurah - 1][3], +recitationPrefs.to || +recitationFrom.value)
    )
  );
  tasmeeSurah.value = String(initialTasmeeSurah);
  professionalizeSelect(tasmeeSurah);
  professionalizeSelect(tasmeeFrom);
  professionalizeSelect(tasmeeTo);
  professionalizeSelect(reciterSelect);
  professionalizeSelect(recitationSurah);
  professionalizeSelect(recitationRepeat);
  professionalizeSelect(recitationFrom);
  professionalizeSelect(recitationTo);
  var gharibBookSelect = $('gharibBookSelect');
  gharibBookSelect.value = String(gharibBookId);
  professionalizeSelect(gharibBookSelect);
  gharibBookSelect.addEventListener('change', function () {
    gharibBookId = +gharibBookSelect.value;
    save('mq.gharibBook', gharibBookId);
    if (refreshActiveWordMeaning) refreshActiveWordMeaning();
  });
  var bScreen = $('bScreen');
  function syncScreenButton() {
    var active = !!document.fullscreenElement;
    bScreen.setAttribute('aria-pressed', String(active));
    var label = active ? 'إيقاف ملء الشاشة' : 'ملء الشاشة';
    bScreen.setAttribute('aria-label', active ? label : 'ملء الشاشة والتدوير أفقيًا');
    bScreen.title = active ? label : 'ملء الشاشة والتدوير أفقيًا';
    $('screenLabel').textContent = label;
  }
  bScreen.addEventListener('click', function () {
    if (document.fullscreenElement) {
      var currentOrientation = window.screen && window.screen.orientation;
      if (currentOrientation && typeof currentOrientation.unlock === 'function') currentOrientation.unlock();
      if (typeof document.exitFullscreen !== 'function') {
        toast('لا يدعم هذا المتصفح الخروج من وضع ملء الشاشة');
        return;
      }
      document.exitFullscreen().catch(function () {
        toast('تعذر إيقاف وضع ملء الشاشة');
      });
      return;
    }
    if (typeof document.documentElement.requestFullscreen !== 'function') {
      toast('لا يدعم هذا المتصفح وضع ملء الشاشة؛ يمكنك تدوير الجهاز من إعداداته');
      return;
    }
    document.documentElement
      .requestFullscreen()
      .then(function () {
        syncScreenButton();
        var currentOrientation = window.screen && window.screen.orientation;
        if (currentOrientation && typeof currentOrientation.lock === 'function') {
          return currentOrientation
            .lock('landscape')
            .then(function () {
              toast('تم تفعيل العرض الأفقي بملء الشاشة');
            })
            .catch(function () {
              toast('تم تفعيل ملء الشاشة؛ فعّل التدوير من إعدادات الجهاز إذا لم تدر الشاشة');
            });
        }
        toast('تم تفعيل ملء الشاشة؛ أدر الجهاز لتغيير اتجاه العرض');
      })
      .catch(function () {
        toast('تعذر تفعيل ملء الشاشة؛ تحقق من دعم المتصفح');
      });
  });
  document.addEventListener('fullscreenchange', syncScreenButton);

  function openV(v) {
    openVerseDrawer(v);
  }
  function closeV() {
    if (body.classList.contains('vs')) body.classList.remove('vs');
  }

  function setSlot(id, v) {
    var s = slotById(id);
    if (!s) return false;
    if (s.v === v) {
      s.v = 0;
      s.ts = 0;
      saveSlots();
      return false;
    }
    s.v = v;
    s.ts = Date.now();
    saveSlots();
    return true;
  }
  function copyText(t, ok) {
    function fb() {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      var copied = false;
      try {
        copied = document.execCommand('copy');
      } catch (e) {}
      ta.remove();
      toast(copied ? ok : 'تعذر النسخ');
    }
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(t).then(function () {
        toast(ok);
      }, fb);
    else fb();
  }
  $('copyRecitationRange').addEventListener('click', function () {
    var surahNumber = +recitationSurah.value,
      surah = D.surahs[surahNumber - 1];
    var from = Math.max(1, Math.min(surah[3], +recitationFrom.value || 0));
    var to = Math.max(1, Math.min(surah[3], +recitationTo.value || 0));
    if (!from || !to || from > to) {
      toast('حدد نطاقًا صحيحًا للآيات');
      return;
    }
    var text = [];
    for (var ayah = from; ayah <= to; ayah++) {
      text.push('﴿' + verseText(surahNumber, ayah) + '﴾ [' + surah[1] + ': ' + ar(ayah) + ']');
    }
    copyText(text.join('\n'), from === to ? 'تم نسخ الآية' : 'تم نسخ الآيات');
  });

  /* ---------- drawer ---------- */
  var drawer = $('drawer');
  function syncPageModeButtons() {
    document.querySelectorAll('[data-page-mode]').forEach(function (button) {
      var on = button.getAttribute('data-page-mode') === scrollMode;
      button.setAttribute('aria-pressed', String(on));
      button.classList.toggle('active', on);
    });
    var lbl = document.getElementById('pageModeLabel');
    if (lbl) lbl.textContent = scrollMode === 'horizontal' ? 'عرض أفقي' : 'تمرير رأسي';
  }
  /* ======== 7) أنماط الصفحة والتمرير التلقائي ======== */
  function setPageMode(mode, temp) {
    mode = mode === 'horizontal' ? 'horizontal' : 'vertical';
    if (!temp) {
      store('mq.scrollMode', mode);
      autoScrollRestoreMode = null;
      if (autoScrollFrame && mode !== scrollMode) stopAutoScroll();
    }
    if (mode === scrollMode) {
      syncPageModeButtons();
      return;
    }
    scrollMode = mode;
    document.body.classList.toggle('hmode', mode === 'horizontal');
    renderInitialPage(cur);
    pageList.scrollLeft = 0;
    window.scrollTo(0, 0);
    syncPageModeButtons();
    requestAnimationFrame(updateContinuousPages);
    if (mode === 'horizontal') setTimeout(hPrefetch, 250);
  }
  syncPageModeButtons();
  var scrollSpeedOptions = [15, 30, 50, 80];
  var savedScrollSpeed = +store('mq.scrollSpeed') || 15;
  var scrollSpeed = scrollSpeedOptions.reduce(function (closest, speed) {
    return Math.abs(speed - savedScrollSpeed) < Math.abs(closest - savedScrollSpeed) ? speed : closest;
  }, scrollSpeedOptions[0]);
  var autoScrollFrame = 0,
    autoScrollTime = 0,
    autoScrollPosition = 0,
    autoScrollHeld = false,
    autoScrollInteractionActive = false,
    autoScrollResumeTimer = 0;
  var scrollToggle = $('scrollToggle'),
    scrollSpeedOptionsEl = $('scrollSpeedOptions');
  function syncScrollControls() {
    var running = !!autoScrollFrame;
    scrollToggle.setAttribute('aria-pressed', String(running));
    $('scrollToggleLabel').textContent = running ? 'إيقاف التمرير' : 'بدء التمرير';
    $('scrollToggleIcon').innerHTML = running
      ? '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>'
      : '<path d="M8 5v14l11-7z"/>';
    scrollSpeedOptionsEl.querySelectorAll('[data-scroll-speed]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(+button.getAttribute('data-scroll-speed') === scrollSpeed));
    });
  }
  function stopAutoScroll() {
    if (!autoScrollFrame) return;
    cancelAnimationFrame(autoScrollFrame);
    autoScrollFrame = 0;
    autoScrollTime = 0;
    if (autoScrollRestoreMode) {
      var back = autoScrollRestoreMode;
      autoScrollRestoreMode = null;
      setPageMode(back, true);
    }
    syncScrollControls();
  }
  function pauseAutoScrollForInteraction() {
    if (!autoScrollFrame) return;
    autoScrollHeld = true;
    autoScrollInteractionActive = true;
    clearTimeout(autoScrollResumeTimer);
    autoScrollResumeTimer = 0;
    stopAutoScroll();
  }
  function scheduleAutoScrollResume() {
    if (!autoScrollHeld) return;
    autoScrollInteractionActive = false;
    clearTimeout(autoScrollResumeTimer);
    autoScrollResumeTimer = setTimeout(function () {
      autoScrollResumeTimer = 0;
      resumeAutoScrollAfterInteraction();
    }, 220);
  }
  function resumeAutoScrollAfterInteraction() {
    if (!autoScrollHeld) return;
    clearTimeout(autoScrollResumeTimer);
    autoScrollResumeTimer = 0;
    autoScrollHeld = false;
    if (!body.classList.contains('open') && !body.classList.contains('vs') && scrollMode === 'vertical')
      startAutoScroll();
  }
  function autoScrollStep(time) {
    if (!autoScrollFrame) return;
    if (body.classList.contains('open') || body.classList.contains('vs')) {
      stopAutoScroll();
      return;
    }
    if (!autoScrollTime) autoScrollTime = time;
    var elapsed = Math.min(250, time - autoScrollTime);
    autoScrollTime = time;
    var maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    var atEnd = window.scrollY >= maxScroll - 1;
    if (
      pageList.lastElementChild &&
      +pageList.lastElementChild.getAttribute('data-page') === TOTAL &&
      atEnd
    ) {
      stopAutoScroll();
      toast('وصلت إلى نهاية المصحف');
      return;
    }
    if (loadingPrevious || window.scrollY > autoScrollPosition + 2) autoScrollPosition = Math.max(autoScrollPosition, window.scrollY);
    autoScrollPosition = Math.min(maxScroll, autoScrollPosition + (scrollSpeed * elapsed) / 1000);
    window.scrollTo({ top: autoScrollPosition, left: 0, behavior: 'auto' });
    autoScrollFrame = requestAnimationFrame(autoScrollStep);
  }
  function startAutoScroll() {
    if (autoScrollFrame) return;
    autoScrollPosition = window.scrollY;
    autoScrollTime = 0;
    autoScrollFrame = requestAnimationFrame(autoScrollStep);
    syncScrollControls();
  }
  scrollToggle.addEventListener('click', function () {
    if (autoScrollFrame) {
      stopAutoScroll();
      return;
    }
    closeD();
    closeV();
    if (scrollMode !== 'vertical') {
      autoScrollRestoreMode = scrollMode;
      setPageMode('vertical', true);
    }
    startAutoScroll();
  });
  scrollSpeedOptionsEl.addEventListener('click', function (event) {
    var button = event.target.closest('[data-scroll-speed]');
    if (!button) return;
    scrollSpeed = +button.getAttribute('data-scroll-speed');
    store('mq.scrollSpeed', String(scrollSpeed));
    syncScrollControls();
  });
  document.addEventListener(
    'touchstart',
    function (e) {
      var target = e.target instanceof Element ? e.target : null;
      if (target && target.closest('#pageList, .page-view, .sheet')) pauseAutoScrollForInteraction();
    },
    { passive: true }
  );
  document.addEventListener(
    'pointerdown',
    function (e) {
      var target = e.target instanceof Element ? e.target : null;
      if (target && target.closest('#pageList, .page-view, .sheet')) pauseAutoScrollForInteraction();
    },
    true
  );
  ['touchend', 'touchcancel', 'pointerup'].forEach(function (type) {
    document.addEventListener(
      type,
      function (e) {
        var target = e.target instanceof Element ? e.target : null;
        if ((target && target.closest('#pageList, .page-view, .sheet')) || autoScrollHeld)
          scheduleAutoScrollResume();
      },
      { passive: true }
    );
  });
  document.addEventListener(
    'pointercancel',
    function (event) {
      if (event.pointerType !== 'touch') scheduleAutoScrollResume();
    },
    { passive: true }
  );
  window.addEventListener(
    'scroll',
    function () {
      if (autoScrollHeld && !autoScrollInteractionActive) scheduleAutoScrollResume();
    },
    { passive: true }
  );
  window.addEventListener(
    'wheel',
    function () {
      if (autoScrollFrame) {
        autoScrollHeld = true;
        autoScrollInteractionActive = false;
        stopAutoScroll();
      }
      if (autoScrollHeld && !autoScrollInteractionActive) scheduleAutoScrollResume();
    },
    { passive: true }
  );
  syncScrollControls();
  /* ======== 8) القائمة الجانبية: الفهرس والبحث في الآيات والعلامات ======== */
  function openD() {
    if (body.classList.contains('open')) return;
    stopAutoScroll();
    closeV();
    body.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    show('settings');
    var h = document.querySelector('#paneSurahs .srow.here');
    if (h && !$('paneSurahs').hidden)
      setTimeout(function () {
        h.scrollIntoView({ block: 'center' });
      }, 30);
  }
  function closeD() {
    body.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
  }
  function norm(s) {
    return String(s || '')
      .normalize('NFKC')
      .replace(/\p{M}/gu, '')
      .replace(/\u0640/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ء/g, '')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي');
  }
  function cleanVerseSearchText(s) {
    return norm(s)
      .replace(/[^\u0621-\u064A\u0660-\u0669\u06F0-\u06F9a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  var paneS = $('paneSurahs');
  var surahIndexRows = D.surahs
    .map(function (s) {
      var row = '';
      /* يظهر اسم الجزء عند أول سورة تبدأ فيه، كما في الفهرس الورقي. */
      D.juz.forEach(function (startId, juzIndex) {
        var position = locate(startId);
        if (position[0] === s[0]) {
          row +=
            '<button type="button" class="surah-juz-heading" data-verse="' +
            (position[0] * 1000 + position[1]) +
            '">الجزء ' +
            JUZ[juzIndex] +
            '</button>';
        }
      });
      return (
        row +
        '<button type="button" class="srow" data-s="' +
        s[0] +
        '" data-n="' +
        norm(s[1]) +
        '"><span class="num">' +
        ar(s[0]) +
        '</span><span><div class="sname">' +
        s[1] +
        '</div><div class="smeta">الصفحة ' +
        ar(s[4]) +
        ' - آياتها ' +
        ar(s[3]) +
        ' - ' +
        (s[2] ? 'مكية' : 'مدنية') +
        '</div></span></button>'
      );
    })
    .join('');
  paneS.innerHTML =
    '<div class="sections-content" id="sectionsContent">' +
    surahIndexRows +
    '<div class="empty" id="noHit" hidden>لا توجد سورة بهذا الاسم.</div></div>';
  var sectionsContent = $('sectionsContent');
  var rows = paneS.querySelectorAll('.srow[data-s]');
  syncIndexHighlights(cur);
  var searchPanel = document.createElement('div');
  searchPanel.className = 'surah-search-panel';
  searchPanel.innerHTML =
    '<div class="surah-search-head"><button type="button" class="surah-search-clear" id="surahSearchClear" hidden>مسح البحث</button></div>';
  var searchInput = $('search');
  searchPanel.appendChild(searchInput);
  paneS.insertBefore(searchPanel, sectionsContent);
  var searchClear = $('surahSearchClear');
  var searchHead = searchClear.parentNode;
  searchHead.hidden = true;
  searchClear.addEventListener('click', function () {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    searchInput.focus();
  });
  var verseSearchResults = document.createElement('div');
  verseSearchResults.id = 'verseSearchResults';
  verseSearchResults.hidden = true;
  paneS.insertBefore(verseSearchResults, sectionsContent);
  var matchingVerses = [],
    renderedVerseCount = 0;
  var verseBatchSize = 100;
  $('search').placeholder = 'ابحث عن كلمة أو عبارة في آية';
  $('search').setAttribute('aria-label', $('search').placeholder);
  function drawVerseResults(reset) {
    if (reset) {
      renderedVerseCount = 0;
      verseSearchResults.innerHTML =
        '<div class="search-results-info">عدد الآيات المطابقة: ' + ar(matchingVerses.length) + '</div>';
    }
    var end = Math.min(matchingVerses.length, renderedVerseCount + verseBatchSize),
      html = '';
    for (var i = renderedVerseCount; i < end; i++) {
      var result = matchingVerses[i],
        surah = D.surahs[result.surah - 1],
        page = pageOfV(result.id);
      html +=
        '<button type="button" class="srow" data-verse="' +
        result.id +
        '"><span class="num">' +
        ar(i + 1) +
        '</span><span><div class="sname q">' +
        escapeHtml(verseText(result.surah, result.ayah)) +
        '</div><div class="smeta">سورة ' +
        escapeHtml(surah[1]) +
        ' - الآية ' +
        ar(result.ayah) +
        ' - الصفحة ' +
        ar(page) +
        '</div></span></button>';
    }
    var more = verseSearchResults.querySelector('.search-more');
    if (more) more.remove();
    verseSearchResults.insertAdjacentHTML('beforeend', html);
    renderedVerseCount = end;
    if (renderedVerseCount < matchingVerses.length) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-more';
      button.setAttribute('data-search-more', 'true');
      button.textContent = 'عرض المزيد من النتائج';
      verseSearchResults.appendChild(button);
    }
  }
  function searchVerses(raw) {
    var query = cleanVerseSearchText(raw);
    matchingVerses = [];
    if (query) {
      D.texts.forEach(function (surah, surahIndex) {
        surah.forEach(function (text, ayahIndex) {
          var normalized = cleanVerseSearchText(text);
          if (normalized.indexOf(query) >= 0) {
            matchingVerses.push({
              id: (surahIndex + 1) * 1000 + ayahIndex + 1,
              surah: surahIndex + 1,
              ayah: ayahIndex + 1
            });
          }
        });
      });
    }
    drawVerseResults(true);
    verseSearchResults.hidden = false;
    sectionsContent.hidden = true;
  }
  paneS.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-more]')) {
      drawVerseResults(false);
      return;
    }
    var verseButton = e.target.closest('[data-verse]');
    if (verseButton) {
      closeD();
      navigateToVerse(+verseButton.getAttribute('data-verse'));
      return;
    }
    var b = e.target.closest('.srow[data-s]');
    if (!b) return;
    closeD();
    navigateToVerse(+b.getAttribute('data-s') * 1000 + 1);
  });
  $('search').addEventListener('input', function () {
    var raw = this.value.trim();
    searchHead.hidden = !raw;
    searchClear.hidden = !raw;
    if (raw) {
      rows.forEach(function (r) {
        r.hidden = true;
      });
      $('noHit').hidden = true;
      searchVerses(raw);
    } else {
      verseSearchResults.hidden = true;
      sectionsContent.hidden = false;
      rows.forEach(function (r) {
        r.hidden = false;
      });
      $('noHit').hidden = true;
    }
  });

  var paneM = $('paneMarks');
  var editing = false;
  var newDrawerMarkColor = PALETTE[0],
    newDrawerMarkName = '';
  function buildMarks() {
    var h = slots
      .map(function (s) {
        var row =
          '<div class="mk-slot"><div class="mk-slot-row"><button type="button" class="srow' +
          (s.v === sel ? ' selected' : '') +
          '" data-id="' +
          s.id +
          '" aria-pressed="' +
          (s.v === sel) +
          '">' +
          bmSvg(s.c, !!s.v) +
          '<span><div class="sname" data-mark-name="' +
          s.id +
          '">' +
          escapeHtml(slotName(s)) +
          '</div>' +
          (s.v ? '<div class="smeta">' + slotSub(s) + '</div>' : '') +
          '</span></button>' +
          (s.v
            ? '<button type="button" class="mk-go" data-goto-slot="' +
              s.id +
              '" aria-label="الانتقال إلى ' +
              escapeHtml(label(s.v)) +
              '" title="الانتقال إلى ' +
              escapeHtml(label(s.v)) +
              '">انتقال</button>'
            : '') +
          '</div>';
        if (editing) {
          var swatches = PALETTE.map(function (c) {
            return (
              '<button type="button" data-slot-color="' +
              s.id +
              '" data-color="' +
              c +
              '" aria-label="' +
              COL[c][1] +
              '" title="' +
              COL[c][1] +
              '" aria-pressed="' +
              (s.c === c) +
              '" style="background:' +
              COL[c][0] +
              '"></button>'
            );
          }).join('');
          row +=
            '<div class="mk-edit"><input type="text" value="' +
            escapeHtml(s.nm || '') +
            '" placeholder="' +
            escapeHtml(slotName(s)) +
            '" data-nm="' +
            s.id +
            '" aria-label="اسم العلامة"><div class="sw">' +
            swatches +
            '</div>' +
            (s.v ? '<button type="button" data-clr="' + s.id + '">مسح الموضع</button>' : '') +
            '<button type="button" data-rm="' +
            s.id +
            '">حذف العلامة</button></div>';
        }
        row += '</div>';
        return row;
      })
      .join('');
    var add = editing
      ? '<div class="mk-add"><label class="mk-add-name">اسم العلامة<input type="text" maxlength="40" value="' +
        escapeHtml(newDrawerMarkName) +
        '" data-new-mark-name placeholder="اكتب اسمًا واضحًا للعلامة" autocomplete="off"></label><span>اختر لون العلامة</span><div class="sw">' +
        PALETTE.map(function (c) {
          return (
            '<button type="button" data-new-mark-color="' +
            c +
            '" aria-pressed="' +
            (c === newDrawerMarkColor) +
            '" style="background:' +
            COL[c][0] +
            '" aria-label="' +
            COL[c][1] +
            '" title="' +
            COL[c][1] +
            '"></button>'
          );
        }).join('') +
        '</div><button type="button" class="mark-create-submit" data-create-mark>إضافة العلامة</button></div>'
      : '';
    var empty =
      !slots.length && !editing ? '<p class="mk-empty">لا توجد علامات مضافة بعد.</p>' : '';
    paneM.innerHTML = '<div class="mk-card">' + h + add + empty + '</div>';
  }
  paneM.addEventListener('click', function (e) {
    if (marksLongPressFired && e.target.closest('.mk-slot-row .srow')) {
      marksLongPressFired = false;
      e.preventDefault();
      return;
    }
    var go = e.target.closest('[data-goto-slot]');
    if (go) {
      var destination = slotById(go.getAttribute('data-goto-slot'));
      if (!destination || !destination.v) return;
      if (typeof wp !== 'undefined' && wp.contains(paneM)) closeWp();
      closeD();
      navigateToVerse(destination.v);
      return;
    }
    var a = e.target.closest('[data-create-mark]'),
      c = e.target.closest('[data-clr]'),
      r = e.target.closest('[data-rm]'),
      color = e.target.closest('[data-slot-color]'),
      newColor = e.target.closest('[data-new-mark-color]');
    if (a) {
      var name = newDrawerMarkName.trim();
      if (!name) {
        var nameInput = paneM.querySelector('[data-new-mark-name]');
        if (nameInput) nameInput.focus();
        toast('اكتب اسم العلامة أولًا');
        return;
      }
      addMarkSlot(newDrawerMarkColor, name);
      newDrawerMarkName = '';
      buildMarks();
      toast('تمت إضافة العلامة');
      return;
    }
    if (newColor) {
      newDrawerMarkColor = newColor.getAttribute('data-new-mark-color');
      paneM.querySelectorAll('[data-new-mark-color]').forEach(function (button) {
        button.setAttribute('aria-pressed', String(button === newColor));
      });
      return;
    }
    if (color) {
      var colored = slotById(color.getAttribute('data-slot-color'));
      if (!colored) return;
      colored.c = color.getAttribute('data-color');
      saveSlots();
      buildMarks();
      updateBm();
      paintSlots();
      toast('تم تغيير لون العلامة');
      return;
    }
    if (c) {
      var s0 = slotById(c.getAttribute('data-clr'));
      if (!s0) return;
      s0.v = 0;
      s0.ts = 0;
      saveSlots();
      buildMarks();
      updateBm();
      paintSlots();
      return;
    }
    if (r) {
      var id = r.getAttribute('data-rm');
      slots = slots.filter(function (x) {
        return x.id !== id;
      });
      saveSlots();
      buildMarks();
      updateBm();
      paintSlots();
      return;
    }
    if (e.target.closest('.mk-edit')) return;
    var b = e.target.closest('.srow');
    if (!b || editing) return;
    var s = slotById(b.getAttribute('data-id'));
    if (wp.contains(paneM)) {
      if (!sel) return;
      var assigned = setSlot(s.id, sel);
      buildMarks();
      updateBm();
      paintSlots();
      toast(assigned ? 'حُفظت العلامة ' + slotName(s) : 'أُزيل موضع العلامة');
      return;
    }
    if (!s.v) {
      toast('اختر آية أولًا لتعيين موضع العلامة');
      return;
    }
    closeD();
    navigateToVerse(s.v);
  });
  paneM.addEventListener('input', function (e) {
    if (e.target.matches('[data-new-mark-name]')) {
      newDrawerMarkName = e.target.value;
      return;
    }
    var i = e.target.closest('[data-nm]');
    if (!i) return;
    var slot = slotById(i.getAttribute('data-nm'));
    if (!slot) return;
    slot.nm = i.value.trim();
    saveSlots();
    updateBm();
    var name = paneM.querySelector('[data-mark-name="' + slot.id + '"]');
    if (name) name.textContent = slotName(slot);
  });
  buildMarks();

  var paneSettings = $('paneSettings');
  var paneWorship = $('paneWorship');
  var paneTasks = $('paneTasks');
  var homeTasmeeSection = paneSettings.querySelector('#tasmeeSection');
  var homeRecitationPanel = paneSettings.querySelector('.recitation-panel');
  var homeAutoScrollPanel = paneSettings.querySelector('[aria-label="التمرير التلقائي"]');
  paneTasks.appendChild(paneSettings.querySelector('.settings'));
  paneTasks.appendChild($('settingsBackupHost'));

  // ===== إعدادات خط القائمة الجانبية + القارئ المخصص =====
  (function () {
    var UI_FONTS = [
      ['', 'الافتراضي (Tajawal)', ''],
      ['Cairo', 'القاهرة (Cairo)', 'Cairo:wght@400;500;700;800'],
      ['Alexandria', 'الإسكندرية (Alexandria)', 'Alexandria:wght@400;500;700;800'],
      ['Tajawal', 'تجوال (Tajawal)', 'Tajawal:wght@400;500;700;800'],
      ['Almarai', 'المراعي (Almarai)', 'Almarai:wght@400;700;800'],
      ['Changa', 'تشانغا (Changa)', 'Changa:wght@400;500;700;800'],
      ['El Messiri', 'المسيري (El Messiri)', 'El+Messiri:wght@400;500;700'],
      ['Harmattan', 'هرمتان (Harmattan)', 'Harmattan:wght@400;500;700'],
      ['IBM Plex Sans Arabic', 'IBM Plex Sans Arabic', 'IBM+Plex+Sans+Arabic:wght@400;500;700'],
      ['Noto Kufi Arabic', 'نوتو كوفي (Noto Kufi)', 'Noto+Kufi+Arabic:wght@400;500;700;800'],
      ['Noto Naskh Arabic', 'نوتو نسخ (Noto Naskh)', 'Noto+Naskh+Arabic:wght@400;500;700'],
      ['Noto Sans Arabic', 'نوتو سانس (Noto Sans)', 'Noto+Sans+Arabic:wght@400;500;700;800'],
      ['Amiri', 'أميري (Amiri)', 'Amiri:wght@400;700'],
      ['Lateef', 'لطيف (Lateef)', 'Lateef:wght@400;700;800'],
      ['Scheherazade New', 'شهرزاد (Scheherazade)', 'Scheherazade+New:wght@400;500;700'],
      ['Reem Kufi', 'ريم كوفي (Reem Kufi)', 'Reem+Kufi:wght@400;500;700'],
      ['Readex Pro', 'ريدكس (Readex Pro)', 'Readex+Pro:wght@400;500;700'],
      ['Rubik', 'روبيك (Rubik)', 'Rubik:wght@400;500;700;800'],
      ['Mada', 'مدى (Mada)', 'Mada:wght@400;500;700;900'],
      ['Baloo Bhaijaan 2', 'بالو (Baloo Bhaijaan)', 'Baloo+Bhaijaan+2:wght@400;500;700;800'],
      ['Lemonada', 'ليمونادا (Lemonada)', 'Lemonada:wght@400;500;700'],
      ['Vazirmatn', 'وزير (Vazirmatn)', 'Vazirmatn:wght@400;500;700;800'],
      ['system-ui', 'خط النظام', '']
    ];
    var KEY = 'mq.uiFont';
    var prefs = { family: '', size: 100, weight: '' };
    try {
      prefs = Object.assign(prefs, JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) {}
    var drawerEl = $('drawer');

    function loadFontFace(entry) {
      if (!entry || !entry[2] || !navigator.onLine) return;
      var id = 'uiFont-' + entry[0].replace(/\s+/g, '');
      if (document.getElementById(id)) return;
      var link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=' + entry[2] + '&display=swap';
      document.head.appendChild(link);
    }
    function apply() {
      var entry = UI_FONTS.filter(function (f) { return f[0] === prefs.family; })[0] || UI_FONTS[0];
      loadFontFace(entry);
      var st = drawerEl.style;
      if (entry[0]) st.setProperty('--ui-font', '"' + entry[0] + '", "Tajawal", system-ui, sans-serif');
      else st.removeProperty('--ui-font');
      drawerEl.classList.toggle('ui-custom-font', !!entry[0]);
      st.setProperty('--ui-zoom', String(prefs.size / 100));
      drawerEl.classList.toggle('ui-custom-size', +prefs.size !== 100);
      if (prefs.weight) st.setProperty('--ui-weight', prefs.weight);
      drawerEl.classList.toggle('ui-custom-weight', !!prefs.weight);
    }
    function persist() {
      try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {}
      apply();
    }

    var card = document.createElement('details');
    card.className = 'qas-card ufs-card ui-font-details';
    card.id = 'uiFontCard';
    var WEIGHTS = [['', 'الافتراضي'], ['400', 'عادي'], ['500', 'متوسط'], ['700', 'عريض'], ['800', 'عريض جدًا']];
    card.innerHTML =
      '<summary class="qas-summary"><span class="qas-ico ufs-ico" aria-hidden="true">Aa</span>' +
      '<span class="qas-titles"><strong>خط القائمة الجانبية</strong><small id="uiFontSummary"></small></span>' +
      '<svg class="qas-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>' +
      '<div class="qas-body">' +
      '<div class="ufs-preview" aria-hidden="true"><strong>معاينة الخط</strong><span>الحمد لله رب العالمين، حمدًا كثيرًا طيبًا مباركًا فيه</span></div>' +
      '<div class="qas-field"><span class="qas-label">نوع الخط</span><select id="uiFontFamily" aria-label="نوع الخط"></select></div>' +
      '<div class="qas-field"><span class="qas-label">حجم الخط <output id="uiFontSizeOut"></output></span>' +
      '<div class="ufs-stepper"><button type="button" class="ufs-step" data-ufs-step="-5" aria-label="تصغير الخط">−</button>' +
      '<input class="qas-range" type="range" id="uiFontSize" min="80" max="150" step="5" aria-label="حجم الخط">' +
      '<button type="button" class="ufs-step" data-ufs-step="5" aria-label="تكبير الخط">+</button></div></div>' +
      '<div class="qas-field"><span class="qas-label">سمك الخط</span><div class="qas-chips" id="uiFontWeight" role="group" aria-label="سمك الخط">' +
      WEIGHTS.map(function (w) {
        return '<button type="button" class="ufs-chip" data-ufs-weight="' + w[0] + '">' + w[1] + '</button>';
      }).join('') + '</div></div>' +
      '<button type="button" id="uiFontReset" class="ui-font-reset">↺ استعادة الإعدادات الافتراضية</button>' +
      '</div>';
    var host = $('settingsBody') || paneTasks;
    var trackingGroup = $('recitationTrackingGroup');
    var trackingCard = trackingGroup && trackingGroup.closest('.settings-card');
    // مطوي افتراضيًا، أسفل قسم تتبّع التلاوة.
    if (trackingCard && trackingCard.parentNode) trackingCard.parentNode.insertBefore(card, trackingCard.nextSibling);
    else host.appendChild(card);


    var famSel = card.querySelector('#uiFontFamily'),
      sizeIn = card.querySelector('#uiFontSize'),
      sizeOut = card.querySelector('#uiFontSizeOut'),
      summaryEl = card.querySelector('#uiFontSummary');
    famSel.innerHTML = UI_FONTS.map(function (f) {
      return '<option value="' + f[0] + '">' + f[1] + '</option>';
    }).join('');
    function sync() {
      famSel.value = prefs.family;
      sizeIn.value = prefs.size;
      sizeOut.textContent = prefs.size + '%';
      card.querySelectorAll('[data-ufs-weight]').forEach(function (b) {
        var on = b.getAttribute('data-ufs-weight') === String(prefs.weight || '');
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      var entry = UI_FONTS.filter(function (f) { return f[0] === prefs.family; })[0] || UI_FONTS[0];
      var wl = WEIGHTS.filter(function (w) { return w[0] === String(prefs.weight || ''); })[0];
      summaryEl.textContent = entry[1].replace(/\s*\(.*\)$/, '') + ' · ' + prefs.size + '٪' + (wl && wl[0] ? ' · ' + wl[1] : '');
    }
    famSel.addEventListener('change', function () { prefs.family = famSel.value; persist(); sync(); });
    sizeIn.addEventListener('input', function () { prefs.size = +sizeIn.value; persist(); sync(); });
    card.querySelectorAll('[data-ufs-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        prefs.size = Math.max(80, Math.min(150, (+prefs.size || 100) + Number(b.getAttribute('data-ufs-step'))));
        persist();
        sync();
      });
    });
    card.querySelectorAll('[data-ufs-weight]').forEach(function (b) {
      b.addEventListener('click', function () {
        prefs.weight = b.getAttribute('data-ufs-weight');
        persist();
        sync();
      });
    });
    card.querySelector('#uiFontReset').addEventListener('click', function () {
      prefs = { family: '', size: 100, weight: '' };
      persist();
      sync();
    });
    window.addEventListener('online', apply);
    sync();
    apply();

  })();

  // ===== بطاقة طريقة تقليب الصفحات =====
  (function () {
    var card = document.createElement('div');
    card.className = 'settings-card';
    card.id = 'pageModeCard';
    card.innerHTML =
      '<div class="settings-card-head"><span aria-hidden="true">📖</span><span>طريقة تقليب الصفحات:</span><span class="st-val" id="pageModeLabel"></span></div>' +
      '<div class="settings-toggle-group" role="group" aria-label="طريقة تقليب الصفحات">' +
      '<button type="button" class="st-btn" data-page-mode="vertical"><span class="st-dot" style="background:#27ae60"></span><span>تمرير رأسي</span></button>' +
      '<button type="button" class="st-btn" data-page-mode="horizontal"><span class="st-dot" style="background:#2980b9"></span><span>عرض أفقي</span></button></div>';
    var font = document.getElementById('uiFontCard');
    if (font && font.parentNode) font.parentNode.insertBefore(card, font);
    else (document.getElementById('settingsBody') || paneTasks).appendChild(card);
    card.addEventListener('click', function (e) {
      var b = e.target.closest('[data-page-mode]');
      if (b) setPageMode(b.getAttribute('data-page-mode'));
    });
    syncPageModeButtons();
  })();

  // ===== بطاقة تأثير تقليب الورق (تفعيل/إلغاء فقط) =====
  (function () {
    var card = document.createElement('div');
    card.className = 'settings-card';
    card.id = 'flipCard';
    card.innerHTML =
      '<div class="settings-card-head"><span aria-hidden="true">📄</span><span>تأثير تقليب الورق:</span><span class="st-val"></span></div>' +
      '<div class="settings-toggle-group" role="group" aria-label="تأثير تقليب الورق">' +
      '<button type="button" class="st-btn" data-v="1"><span class="st-dot" style="background:#27ae60"></span><span>مفعّل</span></button>' +
      '<button type="button" class="st-btn" data-v="0"><span class="st-dot" style="background:var(--muted)"></span><span>معطّل</span></button></div>';
    var anchor = document.getElementById('pageModeCard');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(card, anchor.nextSibling);
    else (document.getElementById('settingsBody') || paneTasks).appendChild(card);
    function sync() {
      card.querySelector('.st-val').textContent = flipPrefs.fx ? 'مفعّل' : 'معطّل';
      card.querySelectorAll('button').forEach(function (b) {
        var on = b.getAttribute('data-v') === (flipPrefs.fx ? '1' : '0');
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('active', on);
      });
    }
    card.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      flipPrefs.fx = b.getAttribute('data-v') === '1';
      store('mq.flipFx', b.getAttribute('data-v'));
      if (flipPrefs.fx) {
        flipAudioUnlock();
        setTimeout(flipPlay, 250);
      }
      sync();
    });
    sync();
  })();

  // ===== بطاقة بسيطة (أزرار تفعيل/إيقاف): تلوين لفظ الجلالة =====
  (function () {
    function addCard(id, title, enabled, onChange, extraBtn) {
      var card = document.createElement('div');
      card.className = 'settings-card';
      card.id = id;
      card.innerHTML =
        '<div class="settings-card-head"><span>' + title + ':</span><span class="st-val"></span></div>' +
        '<div class="settings-toggle-group">' +
        '<button type="button" class="st-btn" data-on="1"><span class="st-dot" style="background:#27ae60"></span><span>مفعّل</span></button>' +
        '<button type="button" class="st-btn" data-on="0"><span class="st-dot" style="background:var(--muted)"></span><span>معطّل</span></button>' +
        (extraBtn ? '<button type="button" class="st-btn" data-extra="1"><span>' + extraBtn.label + '</span></button>' : '') +
        '</div>';
      var font = document.getElementById('uiFontCard');
      if (font && font.parentNode) font.parentNode.insertBefore(card, font);
      else (document.getElementById('settingsBody') || paneTasks).appendChild(card);
      function sync(on) {
        card.querySelector('.st-val').textContent = on ? 'مفعّلة' : 'معطّلة';
        card.querySelectorAll('[data-on]').forEach(function (b) {
          var act = (b.getAttribute('data-on') === '1') === !!on;
          b.classList.toggle('active', act);
          b.setAttribute('aria-pressed', String(act));
        });
      }
      sync(enabled);
      card.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.hasAttribute('data-extra')) { extraBtn.run(); return; }
        var on = b.getAttribute('data-on') === '1';
        sync(on);
        onChange(on);
      });
    }
    addCard('divineCard', 'تلوين لفظ الجلالة (الله، رب)', DIVINE.enabled, setDivineEnabled);
  })();
  if (homeAutoScrollPanel) paneSettings.appendChild(homeAutoScrollPanel);
  if (homeTasmeeSection) document.body.appendChild(homeTasmeeSection);
  if (homeRecitationPanel) paneSettings.appendChild(homeRecitationPanel);
  var panes = { settings: paneSettings, surahs: paneS, worship: paneWorship, tasks: paneTasks };
  var tabSettings = $('tabSettings'),
    tabS = $('tabS'),
    tabWorship = $('tabWorship'),
    tabTasks = $('tabTasks');
  function show(k) {
    if (k === 'surahs') {
      $('search').dispatchEvent(new Event('input'));
    }
    tabS.setAttribute('aria-selected', String(k === 'surahs'));
    tabSettings.setAttribute('aria-selected', String(k === 'settings'));
    tabWorship.setAttribute('aria-selected', String(k === 'worship'));
    tabTasks.setAttribute('aria-selected', String(k === 'tasks'));
    Object.keys(panes).forEach(function (n) {
      panes[n].hidden = n !== k;
    });
    $('search').hidden = k !== 'surahs';
    body.classList.toggle('titled', k !== 'surahs');
    body.classList.toggle('surahs-index', k === 'surahs');
    $('dTitleT').textContent =
      k === 'settings' ? 'الرئيسية' : k === 'worship' ? 'الأذكار والمسبحة' : k === 'tasks' ? 'الإعدادات' : '';
    $('dTitleT').hidden = k === 'surahs';
  }
  tabS.addEventListener('click', function () {
    show('surahs');
  });
  tabSettings.addEventListener('click', function () {
    show('settings');
  });
  tabWorship.addEventListener('click', function () {
    show('worship');
  });
  tabTasks.addEventListener('click', function () {
    show('tasks');
  });

  var appServiceView = $('appServiceView'),
    appServiceContent = $('appServiceContent'),
    appServiceTitle = $('appServiceTitle'),
    appServiceStatus = $('appServiceStatus'),
    appServicePrayer = $('appServicePrayer'),
    appServiceClose = $('appServiceClose'),
    appServiceReturnFocus = null,
    previousBodyOverflow = '',
    appServiceCleanup = null;
  var appServices = {
    prayer: { title: 'مواقيت الصلاة', status: 'طريقة الحساب: الهيئة المصرية العامة للمساحة' },
    radio: { title: 'إذاعة القرآن الكريم', status: 'البث المباشر يحتاج إلى اتصال بالإنترنت' },
    khatma: { title: 'ختمتي', status: 'خطّة ختمة بورد يومي وتذكير بالإشعارات' }
  };
  function closeAppService() {
    if (appServiceView.hidden) return;
    if (window.QuranPrayerTimes) window.QuranPrayerTimes.close();
    if (appServiceCleanup) {
      appServiceCleanup();
      appServiceCleanup = null;
    }
    appServiceContent.hidden = true;
    appServicePrayer.hidden = true;
    appServiceView.hidden = true;
    document.body.style.overflow = previousBodyOverflow;
    var returnFocus = appServiceReturnFocus;
    openD();
    show('settings');
    if (returnFocus && returnFocus.isConnected) {
      requestAnimationFrame(function () {
        returnFocus.focus();
      });
    }
    appServiceReturnFocus = null;
  }
  function openAppService(key, trigger) {
    var service = appServices[key];
    if (!service) return;
    appServiceReturnFocus = trigger;
    appServiceTitle.textContent = service.title;
    appServiceStatus.textContent = service.status;
    appServiceView.hidden = false;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeD();
    if (key === 'prayer') {
      appServiceContent.hidden = true;
      appServicePrayer.hidden = false;
      if (!window.QuranPrayerTimes) {
        appServiceStatus.textContent = 'تعذر تحميل مكوّن مواقيت الصلاة. أعد تحميل التطبيق.';
        return;
      }
      window.QuranPrayerTimes.open(appServicePrayer, function (message) {
        appServiceStatus.textContent = message;
      });
      appServiceClose.focus();
      return;
    }
    appServicePrayer.hidden = true;
    appServiceContent.hidden = false;
    if (key === 'khatma') {
      if (!window.QuranKhatma) {
        appServiceStatus.textContent = 'تعذر تحميل خدمة الختمة. أعد تحميل التطبيق.';
        return;
      }
      appServiceContent.style.overflow = 'auto';
      appServiceCleanup = window.QuranKhatma.mount(appServiceContent, function (message) {
        appServiceStatus.textContent = message;
      });
      appServiceClose.focus();
      return;
    }
    appServiceContent.style.overflow = '';
    if (!window.QuranIntegratedServices) {
      appServiceStatus.textContent = 'تعذر تحميل الخدمة المدمجة. أعد تحميل التطبيق.';
      return;
    }
    try {
      appServiceCleanup = window.QuranIntegratedServices.mount(key, appServiceContent);
      appServiceStatus.textContent = service.status;
    } catch (error) {
      appServiceStatus.textContent =
        'تعذر فتح الخدمة: ' + (error && error.message ? error.message : 'خطأ غير معروف');
      throw error;
    }
    appServiceClose.focus();
  }
  paneSettings.addEventListener('click', function (event) {
    var trigger = event.target.closest('[data-app-service]');
    if (trigger) openAppService(trigger.getAttribute('data-app-service'), trigger);
  });
  appServiceClose.addEventListener('click', closeAppService);
  /* فتح صفحة من المصحف من خارج الملف (خدمة الختمة) وفتح خدمة من الإشعارات */
  window.QuranOpenPage = function (page) {
    if (!appServiceView.hidden) {
      appServiceCleanup && (appServiceCleanup(), (appServiceCleanup = null));
      appServiceContent.hidden = true;
      appServiceView.hidden = true;
      document.body.style.overflow = previousBodyOverflow;
      appServiceReturnFocus = null;
    }
    closeD();
    goTo(page);
  };
  window.QuranOpenService = function (key) {
    if (!appServices[key]) return;
    if (!appServiceView.hidden) closeAppService();
    openAppService(key, null);
  };
  appServiceView.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAppService();
    }
  });

  /* ---------- controls ---------- */
  /* Verse details open only when the ayah number is held. */
  var marksPopupHome = $('marksPopupHome'),
    recitationPanel = document.querySelector('.recitation-panel'),
    recitationPanelHome = recitationPanel && recitationPanel.parentNode,
    recitationPanelNext = recitationPanel && recitationPanel.nextSibling,
    MU = window.MUYASSAR_DATA || null,
    meaningLoadFailed = false,
    popWord = null,
    lpT = 0,
    lpX = 0,
    lpY = 0,
    lpFired = false,
    marksPopupExpanded = false,
    marksLongPressTimer = 0,
    marksLongPressStart = null,
    marksLongPressFired = false;
  var gharibMeanings = Object.create(null),
    gharibMeaningRequests = Object.create(null),
    gharibLoadFailed = false,
    refreshActiveWordMeaning = null;
  var wordDataWorker = null,
    wordDataRequestId = 0,
    wordDataRequests = Object.create(null);
  /* ======== 9) معاني الكلمات (غريب القرآن) والتفسير الميسر وقائمة الكلمة المنبثقة ======== */
  function loadMeanings() {
    return Promise.resolve(MU);
  }
  function requestWordData(type, data) {
    return new Promise(function (resolve, reject) {
      try {
        if (!wordDataWorker) {
          wordDataWorker = createWordDataWorker();
          wordDataWorker.addEventListener('message', function (event) {
            var response = event.data,
              pending = response && wordDataRequests[response.id];
            if (!pending) return;
            delete wordDataRequests[response.id];
            if (pending.timer) clearTimeout(pending.timer);
            if (response.error) pending.reject(new Error(response.error));
            else pending.resolve(response.result);
          });
          wordDataWorker.addEventListener('error', function (event) {
            var error = new Error(event.message || 'تعذر تشغيل عامل بيانات الكلمات');
            Object.keys(wordDataRequests).forEach(function (id) {
              if (wordDataRequests[id].timer) clearTimeout(wordDataRequests[id].timer);
              wordDataRequests[id].reject(error);
              delete wordDataRequests[id];
            });
            wordDataWorker.terminate();
            wordDataWorker = null;
          });
        }
        var id = ++wordDataRequestId;
        wordDataRequests[id] = {
          resolve: resolve,
          reject: reject,
          timer: setTimeout(function () {
            var pending = wordDataRequests[id];
            if (!pending) return;
            delete wordDataRequests[id];
            if (wordDataWorker) {
              wordDataWorker.terminate();
              wordDataWorker = null;
            }
            reject(new Error('انتهت مهلة تحميل بيانات الكلمة'));
          }, 10000)
        };
        wordDataWorker.postMessage(Object.assign({ id: id, type: type }, data));
      } catch (error) {
        reject(error);
      }
    });
  }
  function normalizeGharibWord(word) {
    return normArabic(word).replace(/[^\u0621-\u064A\u0671]/g, '');
  }
  function gharibMeaningKey(surah, ayah, selectedWord) {
    return surah + ':' + ayah + ':' + +gharibBookId + ':' + normalizeGharibWord(selectedWord);
  }
  function findGharibWordMeaning(surah, ayah, selectedWord) {
    return gharibMeanings[gharibMeaningKey(surah, ayah, selectedWord)] || '';
  }
  function hasGharibMeaning(surah, ayah, selectedWord) {
    return Object.prototype.hasOwnProperty.call(gharibMeanings, gharibMeaningKey(surah, ayah, selectedWord));
  }
  function loadGharibWordMeaning(surah, ayah, selectedWord) {
    var key = gharibMeaningKey(surah, ayah, selectedWord);
    if (hasGharibMeaning(surah, ayah, selectedWord)) return Promise.resolve(gharibMeanings[key]);
    if (gharibMeaningRequests[key]) return gharibMeaningRequests[key];
    gharibLoadFailed = false;
    gharibMeaningRequests[key] = requestWordData('meaning', {
      surah: surah,
      ayah: ayah,
      word: selectedWord,
      bookId: +gharibBookId
    })
      .then(function (meaning) {
        gharibMeanings[key] = meaning || '';
        delete gharibMeaningRequests[key];
        return gharibMeanings[key];
      })
      .catch(function (error) {
        gharibLoadFailed = true;
        delete gharibMeaningRequests[key];
        throw error;
      });
    return gharibMeaningRequests[key];
  }
  function gharibBookName(bookId) {
    var names = {
      491: 'السراج في بيان غريب القرآن',
      327: 'التبيان في تفسير غريب القرآن',
      1424: 'كلمات القرآن'
    };
    return names[bookId] || 'غريب القرآن';
  }
  function normArabic(s) {
    return String(s)
      .replace(/[ً-ٰٟۖ-ۭـ]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه');
  }
  function wordMeaningArabic(s, a, pos, tafsir) {
    var verseWords = verseText(s, a).split(/\s+/);
    var word = verseWords[pos - 1] || '',
      key = normArabic(word);
    if (s === 72 && a === 14 && key === normArabic('ٱلۡقَٰسِطُونَ')) {
      return 'الجائرون الظالمون الذين حادوا عن طريق الحق';
    }
    if (key.length > 2 && tafsir) {
      var clauses = tafsir.split(/[،؛.!؟]/),
        fallback = '';
      for (var i = 0; i < clauses.length; i++) {
        if (normArabic(clauses[i]).indexOf(key) < 0) continue;
        var clause = clauses[i].trim();
        if (!fallback) fallback = clause;
        if (/﴿[^﴿﴾]*﴾/.test(clause)) return clause.replace(/﴿[^﴿﴾]*﴾/g, '').trim() || clause;
      }
      if (fallback) return fallback;
      var tafsirWords = tafsir
        .split(/\s+/)
        .map(function (part) {
          return { text: part, key: normArabic(part).replace(/[^\u0621-\u064A]/g, '') };
        })
        .filter(function (part) {
          return part.key;
        });
      var particles =
        'أن أو به بها بهما بهم بهن في من عن على إلى هو هي هم هن هذا هذه ذلك الذي التي الذين اللاتي وهو وهي وهم وهن'
          .split(/\s+/)
          .map(normArabic);
      for (var distance = 1; distance <= 1; distance++) {
        var anchors = [pos - 1 - distance, pos - 1 + distance];
        for (var side = 0; side < anchors.length; side++) {
          var verseIndex = anchors[side];
          if (verseIndex < 0 || verseIndex >= verseWords.length) continue;
          var anchor = normArabic(verseWords[verseIndex]).replace(/[^\u0621-\u064A]/g, '');
          if (anchor.length < 3 || particles.indexOf(anchor) >= 0) continue;
          if (
            verseWords.filter(function (part) {
              return normArabic(part).replace(/[^\u0621-\u064A]/g, '') === anchor;
            }).length !== 1 ||
            tafsirWords.filter(function (part) {
              return part.key === anchor;
            }).length !== 1
          )
            continue;
          var direction = verseIndex < pos - 1 ? 1 : -1;
          for (var tafsirIndex = 0; tafsirIndex < tafsirWords.length; tafsirIndex++) {
            if (tafsirWords[tafsirIndex].key !== anchor) continue;
            for (var step = 1; step <= 2; step++) {
              var candidate = tafsirWords[tafsirIndex + direction * step];
              if (!candidate || candidate.key.length < 3 || particles.indexOf(candidate.key) >= 0) continue;
              if (candidate.key !== key) {
                return candidate.text.replace(/^[،؛.!؟:()[\]{}«»]+|[،؛.!؟:()[\]{}«»]+$/g, '');
              }
            }
          }
        }
      }
    }
    return '';
  }
  function verseMeaningArabic(s, a, tafsir) {
    var meaning = wordMeaningArabic(s, a, 1, tafsir);
    if (meaning || !tafsir) return meaning;
    var context = String(tafsir || '')
      .split(/[.!؟]/)[0]
      .trim();
    return context.length > 150 ? context.slice(0, 150) + '…' : context;
  }
  function closeWp() {
    wp.hidden = true;
    wp.classList.remove('open');
    refreshActiveWordMeaning = null;
    if (recitationPanel && recitationPanelHome && recitationPanel.parentNode !== recitationPanelHome) {
      recitationPanelHome.insertBefore(
        recitationPanel,
        recitationPanelNext && recitationPanelNext.parentNode === recitationPanelHome
          ? recitationPanelNext
          : null
      );
    }
    if (paneM.parentNode !== marksPopupHome) marksPopupHome.appendChild(paneM);
    marksPopupHome.hidden = true;
    if (popWord) {
      popWord.classList.remove('pop');
      popWord = null;
    }
  }
  function placeWp(w) {
    var pr = pageEl.getBoundingClientRect(),
      wr = w.getBoundingClientRect();
    wp.style.visibility = 'hidden';
    wp.hidden = false;
    var h = wp.offsetHeight,
      wd = wp.offsetWidth,
      cx = wr.left + wr.width / 2 - pr.left;
    var left = Math.max(8, Math.min(pr.width - wd - 8, cx - wd / 2));
    var below = wr.bottom + h + 14 < window.innerHeight || wr.top - h - 14 < 0;
    var top = below ? wr.bottom - pr.top + 10 : wr.top - pr.top - h - 10;
    wp.style.left = left + 'px';
    wp.style.top = top + 'px';
    wp.style.setProperty('--ax', Math.max(22, Math.min(wd - 22, cx - left)) + 'px');
    wp.classList.remove('below', 'above');
    wp.classList.add(below ? 'below' : 'above');
    wp.style.visibility = '';
  }
  function showWp(w) {
    var v = +w.getAttribute('data-v'),
      pos = +w.getAttribute('data-p');
    if (!v) return;
    if (paneM.parentNode !== marksPopupHome) marksPopupHome.appendChild(paneM);
    marksPopupHome.hidden = true;
    var s = Math.floor(v / 1000),
      a = v % 1000;
    marksPopupExpanded = false;
    marksLongPressFired = false;
    if (popWord) popWord.classList.remove('pop');
    wp.classList.remove('open');
    if (pos <= 0) {
      sel = v;
      paintSel();
    }
    popWord = w;
    w.classList.add('pop');
    var ff = w.style.fontFamily,
      glyph = w.textContent;
    var pageFont = /^TJ([0-9]+)$/.exec(ff);
    var glyphClasses = 'wp-g' + (pageFont ? ' tajweed-page-font' : '');
    var glyphStyle = 'font-family:' + ff;
    if (pageFont)
      glyphStyle +=
        ';--tajweed-light-palette:--tjl' + pageFont[1] + ';--tajweed-dark-palette:--tjd' + pageFont[1];
    var glyphMarkup =
      '<span class="' + glyphClasses + '" style="' + glyphStyle + '">' + esc(glyph) + '</span>';
    var hideAyahTafsir = a === 15;
    var recitationDetailsWasOpen = false;
    function draw() {
      var tf = MU && MU[s - 1] ? MU[s - 1][a - 1] : '';
      var h = '';
      var selectedWord = pos > 0 ? verseText(s, a).split(/\s+/)[pos - 1] || glyph : '';
      // لا توجد علامات مضافة: يظهر القسم أعلى النافذة (بكامل رأسه) مع زر لإضافة علامة.
      if (pos <= 0)
        h +=
          '<section class="wp-marks' +
          (marksPopupExpanded || !slots.length ? '' : ' wp-marks-compact') +
          '"><div class="wp-marks-head"><strong>علامات الآية</strong><button type="button" id="wpMarksEdit">' +
          (editing ? 'تم' : slots.length ? 'تحرير' : 'إضافة علامة') +
          '</button></div><div class="wp-marks-list" id="wpMarksList"></div></section>';
      if (pos <= 0) {
        if (!hideAyahTafsir)
          h +=
            '<div class="wp-m wp-ayah-meaning"><small>معنى الآية</small>' +
            (tf
              ? esc(verseMeaningArabic(s, a, tf))
              : meaningLoadFailed
                ? 'تعذر تحميل التفسير المحلي.'
                : MU
                  ? 'لا يتوفر تفسير لهذه الآية.'
                  : 'جارٍ تحميل التفسير المحلي…') +
            '</div>';
      } else {
        h += '<div class="wp-h wp-word-head">' + glyphMarkup + '</div>';
        var gharibMeaning = findGharibWordMeaning(s, a, selectedWord);
        var wordMeaning = gharibMeaning
          ? gharibMeaning.text
          : hasGharibMeaning(s, a, selectedWord)
            ? ''
            : gharibLoadFailed
              ? tf
                ? wordMeaningArabic(s, a, pos, tf)
                : 'تعذر تحميل مصدر المعاني.'
              : 'جارٍ تحميل معنى الكلمة من المصدر المختار…';
        if (wordMeaning) {
          h +=
            '<div class="wp-m">' +
            (gharibMeaning && gharibMeaning.book !== 'السراج في بيان غريب القرآن'
              ? '<small>' + esc(gharibMeaning.book || gharibBookName(+gharibBookId)) + '</small>'
              : '') +
            esc(wordMeaning) +
            '</div>';
        }
        if (!hideAyahTafsir)
          h +=
            '<details class="wp-v"><summary>التفسير المختصر للآية</summary><div class="wp-v-content">' +
            (tf
              ? esc(tf)
              : meaningLoadFailed
                ? 'تعذر تحميل التفسير المحلي.'
                : MU
                  ? 'لا يتوفر تفسير لهذه الآية.'
                  : 'جارٍ تحميل التفسير المحلي…') +
            '</div></details>';
      }
      if (pos <= 0 && !hideAyahTafsir)
        h +=
          '<details class="wp-v"><summary>التفسير المختصر للآية</summary><div class="wp-v-content">' +
          (tf
            ? esc(tf)
            : meaningLoadFailed
              ? 'تعذر تحميل التفسير المحلي.'
              : MU
                ? 'لا يتوفر تفسير لهذه الآية.'
                : 'جارٍ تحميل التفسير المحلي…') +
          '</div></details>';
      h +=
        '<div class="wp-mark"><span>تظليل ' +
        (pos <= 0 ? 'الآية' : 'الكلمة') +
        '</span><div class="wp-colors" aria-label="اختيار لون التظليل">' +
        ANNOT_PALETTE.map(function (c) {
          return (
            '<button type="button" data-wp-color="' +
            c +
            '" aria-label="' +
            COL[c][1] +
            '" title="' +
            COL[c][1] +
            '" style="background:' +
            COL[c][0] +
            '"></button>'
          );
        }).join('') +
        '</div></div>';
      if (pos > 0 && hasTasmeeMistake(v, pos)) {
        h += '<button type="button" class="wp-clear-tasmee-highlight">إزالة تظليل الخطأ</button>';
      }
      var micLabel = tasmeeListening ? 'الميكروفون يعمل' : 'الميكروفون غير نشط';
      h +=
        '<div class="wp-recitation-row"><details class="wp-recitation"><summary>تشغيل الآيات</summary><div class="wp-recitation-mount"></div></details><button type="button" class="wp-recitation-tasmee" aria-label="تسميع"><svg class="tasmee-mic-indicator' +
        (tasmeeListening ? ' is-active' : '') +
        '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="' +
        micLabel +
        '" title="' +
        micLabel +
        '"><rect x="9" y="2" width="6" height="12" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"></path></svg><span>تسميع</span></button></div>';
      var previousRecitationDetails = wp.querySelector('.wp-recitation');
      recitationDetailsWasOpen = !!(previousRecitationDetails && previousRecitationDetails.open);
      wp.innerHTML = h;
      if (recitationPanel) wp.querySelector('.wp-recitation-mount').appendChild(recitationPanel);
      var recitationDetails = wp.querySelector('.wp-recitation');
      if (recitationDetails) {
        var tasmeeButton = recitationDetails.parentElement.querySelector('.wp-recitation-tasmee');
        function syncRecitationTasmeeButton() {
          if (tasmeeButton) tasmeeButton.hidden = recitationDetails.open;
        }
        recitationDetails.addEventListener('toggle', function () {
          syncRecitationTasmeeButton();
          if (recitationDetails.open) setRecitationVerse(v);
        });
        recitationDetails.open = recitationDetailsWasOpen;
        syncRecitationTasmeeButton();
        if (recitationDetailsWasOpen) setRecitationVerse(v);
      }
      if (pos <= 0) {
        buildMarks();
        var marksList = wp.querySelector('#wpMarksList');
        if (marksList) marksList.appendChild(paneM);
        else marksPopupHome.appendChild(paneM);
        marksPopupHome.hidden = true;
      }
      placeWp(w);
    }
    draw();
    refreshActiveWordMeaning = function () {
      if (popWord === w) draw();
    };
    if (pos > 0) {
      var wordForMeaning = verseText(s, a).split(/\s+/)[pos - 1] || glyph;
      loadGharibWordMeaning(s, a, wordForMeaning)
        .then(function () {
          if (popWord === w) draw();
        })
        .catch(function (error) {
          console.error('تعذر تحميل معنى الكلمة من مصدر غريب القرآن:', error);
          if (popWord === w) draw();
        });
    }
    if (!MU && !hideAyahTafsir)
      loadMeanings().then(function () {
        if (popWord === w) draw();
      });
  }
  function openVerseDrawer(v) {
    sel = v;
    paintSel();
    closeWp();
    show('settings');
    openD();
  }
  wp.addEventListener('click', function (e) {
    var clearTasmeeHighlight = e.target.closest('.wp-clear-tasmee-highlight');
    if (clearTasmeeHighlight && popWord) {
      clearTasmeeMistake(+popWord.getAttribute('data-v'), +popWord.getAttribute('data-p'));
      toast('تمت إزالة تظليل الخطأ');
      return;
    }
    var recitationToggle = e.target.closest('.wp-recitation > summary');
    if (recitationToggle) {
      requestAnimationFrame(function () {
        if (popWord) placeWp(popWord);
      });
      return;
    }
    var editMarks = e.target.closest('#wpMarksEdit');
    if (editMarks) {
      editing = !editing;
      editMarks.textContent = editing ? 'تم' : slots.length ? 'تحرير' : 'إضافة علامة';
      buildMarks();
      requestAnimationFrame(function () {
        if (popWord) placeWp(popWord);
      });
      return;
    }
    var colorButton = e.target.closest('[data-wp-color]');
    if (colorButton && popWord) {
      annotPrefs.color = colorButton.getAttribute('data-wp-color');
      annotPrefs.type = 'highlight';
      var view = popWord.closest('.page-view');
      var markPage = view && +view.getAttribute('data-page');
      var removed = togglePopupMark(popWord, markPage, annotPrefs.color);
      var targetIsVerse = +popWord.getAttribute('data-p') <= 0;
      popWord.classList.remove('pop');
      annotEnabled = false;
      annotTransient = false;
      annotTarget = null;
      saveAnnotPrefs();
      syncAnnotControls();
      toast(
        removed
          ? targetIsVerse
            ? 'تم محو تظليل الآية'
            : 'تم محو تظليل الكلمة'
          : targetIsVerse
            ? 'تم تظليل الآية'
            : 'تم تظليل الكلمة'
      );
      return;
    }
  });
  // أي ضغطة جديدة داخل النافذة المنبثقة تُلغي "ضغطة ما بعد الضغط المطوّل" حتى لا تُبتلع
  // أول نقرة على لون التظليل (كانت تتطلب ضغطًا مطوّلًا على آية أخرى لتظهر).
  wp.addEventListener(
    'pointerdown',
    function () {
      lpFired = false;
    },
    true
  );
  function lpCancel() {
    clearTimeout(lpT);
    lpT = 0;
  }
  pageList.addEventListener('pointerdown', function (e) {
    var view = e.target.closest('.page-view');
    if (view) activatePage(view);
    var w = e.target.closest('.w');
    lpFired = false;
    lpCancel();
    if (!w || !+w.getAttribute('data-v') || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'touch') {
      e.preventDefault();
      try {
        pageList.setPointerCapture(e.pointerId);
      } catch (x) {}
    }
    lpX = e.clientX;
    lpY = e.clientY;
    lpT = setTimeout(function () {
      lpFired = true;
      lpT = 0;
      if (navigator.vibrate)
        try {
          navigator.vibrate(12);
        } catch (x) {}
      closeV();
      showWp(w);
    }, 420);
  });
  pageList.addEventListener('pointermove', function (e) {
    if (lpT && (Math.abs(e.clientX - lpX) > 10 || Math.abs(e.clientY - lpY) > 10)) lpCancel();
  });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    pageList.addEventListener(n, function (e) {
      lpCancel();
      if (n === 'pointerup') {
        try {
          pageList.releasePointerCapture(e.pointerId);
        } catch (x) {}
      }
    });
  });
  pageList.addEventListener('contextmenu', function (e) {
    if (e.target.closest('.w')) e.preventDefault();
  });
  var popupDismissPointer = null;
  var popupDismissPointerTimer = 0;
  document.addEventListener(
    'pointerdown',
    function (event) {
      window.clearTimeout(popupDismissPointerTimer);
      popupDismissPointerTimer = 0;
      if (wp.hidden) {
        popupDismissPointer = null;
        return;
      }
      var target = event.target instanceof Element ? event.target : null;
      popupDismissPointer = {
        inside: !!(target && target.closest('#wp')),
        x: event.clientX,
        y: event.clientY,
        moved: false
      };
    },
    true
  );
  document.addEventListener(
    'pointermove',
    function (event) {
      if (!popupDismissPointer || popupDismissPointer.moved) return;
      if (
        Math.abs(event.clientX - popupDismissPointer.x) > 10 ||
        Math.abs(event.clientY - popupDismissPointer.y) > 10
      )
        popupDismissPointer.moved = true;
    },
    true
  );
  document.addEventListener(
    'click',
    function (event) {
      window.clearTimeout(popupDismissPointerTimer);
      popupDismissPointerTimer = 0;
      if (lpFired) {
        lpFired = false;
        popupDismissPointer = null;
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      var target = event.target instanceof Element ? event.target : null;
      var pointer = popupDismissPointer;
      popupDismissPointer = null;
      if (
        wp.hidden ||
        (target && target.closest('#wp')) ||
        (event.detail > 0 && pointer && (pointer.inside || pointer.moved))
      )
        return;
      closeWp();
      event.preventDefault();
      event.stopImmediatePropagation();
    },
    true
  );
  document.addEventListener(
    'pointerup',
    function () {
      window.clearTimeout(popupDismissPointerTimer);
      popupDismissPointerTimer = window.setTimeout(function () {
        popupDismissPointer = null;
        popupDismissPointerTimer = 0;
      }, 500);
    },
    true
  );
  document.addEventListener(
    'pointercancel',
    function () {
      window.clearTimeout(popupDismissPointerTimer);
      popupDismissPointerTimer = 0;
      popupDismissPointer = null;
    },
    true
  );
  var continuousUpdateFrame = 0;
  function scheduleContinuousPages() {
    if (continuousUpdateFrame) return;
    continuousUpdateFrame = requestAnimationFrame(function () {
      continuousUpdateFrame = 0;
      updateContinuousPages();
    });
  }
  window.addEventListener(
    'scroll',
    function () {
      scheduleContinuousPages();
    },
    { passive: true }
  );

  pageList.addEventListener('click', function (e) {
    var view = e.target.closest('.page-view');
    if (!view) return;
    activatePage(view);
    if (e.target.closest('.open-juz, .badge')) {
      openD();
      return;
    }
    if (lpFired) {
      lpFired = false;
      e.preventDefault();
      return;
    }
    var w = e.target.closest('.w');
    if (annotEnabled && w && +w.getAttribute('data-v')) {
      closeWp();
      if (+w.getAttribute('data-p') <= 0) markVerseFromTap(w, +view.getAttribute('data-page'));
      else markFromTap(w, +view.getAttribute('data-page'));
      e.preventDefault();
      return;
    }
    if (w && +w.getAttribute('data-v')) {
      closeWp();
      openD();
      return;
    }
    if (!wp.hidden) {
      closeWp();
      if (!w) return;
    }
    var s = window.getSelection && String(window.getSelection());
    if (s) return;
  });
  pageList.addEventListener('dblclick', function (e) {
    var w = e.target.closest('.w');
    if (!w || !+w.getAttribute('data-v')) return;
    e.preventDefault();
    openV(+w.getAttribute('data-v'));
  });
  pageEl.addEventListener('click', function (e) {
    if (e.target.closest('.w, .wp, .run, .hdr, .bis, .foot, button, input, label')) return;
    openD();
  });
  var bMenu = $('bMenu'),
    menuPointerHandled = false;
  bMenu.addEventListener('pointerup', function (event) {
    if (event.pointerType !== 'touch') return;
    menuPointerHandled = true;
    openD();
    setTimeout(function () {
      menuPointerHandled = false;
    }, 0);
  });
  bMenu.addEventListener('click', function (event) {
    if (menuPointerHandled) {
      menuPointerHandled = false;
      event.preventDefault();
      return;
    }
    openD();
  });
  $('scrim').addEventListener('click', function () {
    closeD();
    closeV();
  });
  $('bNext').addEventListener('click', function () {
    goTo(curNow() + 1);
  });
  $('bPrev').addEventListener('click', function () {
    goTo(curNow() - 1);
  });
  var annotControls = $('annotControls'),
    annotColors = $('annotColors'),
    annotTarget = null,
    annotTransient = false;
  var annotDrag = $('annotDrag'),
    annotDragState = null,
    annotPosition = load('mq.annotPosition', null);
  function placeAnnotControls(left, top) {
    var pad = 8,
      maxLeft = Math.max(pad, window.innerWidth - annotControls.offsetWidth - pad);
    var maxTop = Math.max(pad, window.innerHeight - annotControls.offsetHeight - pad);
    left = Math.max(pad, Math.min(maxLeft, left));
    top = Math.max(pad, Math.min(maxTop, top));
    annotControls.style.left = left + 'px';
    annotControls.style.top = top + 'px';
    annotControls.style.right = 'auto';
    annotControls.style.bottom = 'auto';
    annotControls.style.transform = 'none';
    return { left: left, top: top };
  }
  function restoreAnnotPosition() {
    if (!annotPosition || !isFinite(+annotPosition.left) || !isFinite(+annotPosition.top)) return;
    annotPosition = placeAnnotControls(+annotPosition.left, +annotPosition.top);
  }
  function saveAnnotPosition() {
    var rect = annotControls.getBoundingClientRect();
    annotPosition = { left: Math.round(rect.left), top: Math.round(rect.top) };
    save('mq.annotPosition', annotPosition);
  }
  annotDrag.addEventListener('pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    var rect = annotControls.getBoundingClientRect();
    annotDragState = { id: e.pointerId, x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
    annotDrag.setPointerCapture(e.pointerId);
    annotControls.classList.add('dragging');
    e.preventDefault();
  });
  annotDrag.addEventListener('pointermove', function (e) {
    if (!annotDragState || e.pointerId !== annotDragState.id) return;
    placeAnnotControls(
      annotDragState.left + e.clientX - annotDragState.x,
      annotDragState.top + e.clientY - annotDragState.y
    );
  });
  function endAnnotDrag(e) {
    if (!annotDragState || e.pointerId !== annotDragState.id) return;
    annotDragState = null;
    annotControls.classList.remove('dragging');
    saveAnnotPosition();
  }
  annotDrag.addEventListener('pointerup', endAnnotDrag);
  annotDrag.addEventListener('pointercancel', endAnnotDrag);
  annotDrag.addEventListener('lostpointercapture', endAnnotDrag);
  annotDrag.addEventListener('keydown', function (e) {
    var rect = annotControls.getBoundingClientRect(),
      step = e.shiftKey ? 32 : 12;
    var dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
    var dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
    if (!dx && !dy) return;
    placeAnnotControls(rect.left + dx, rect.top + dy);
    saveAnnotPosition();
    e.preventDefault();
  });
  function saveAnnotPrefs() {
    if (!annotTransient) annotPrefs.enabled = annotEnabled;
    save('mq.annotPrefs', annotPrefs);
  }
  function syncAnnotControls() {
    annotControls.hidden = !annotEnabled;
    if (annotEnabled) requestAnimationFrame(restoreAnnotPosition);
    annotControls.querySelectorAll('[data-annot-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-annot-mode') === annotPrefs.mode));
    });
    annotControls.querySelectorAll('[data-annot-type]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-annot-type') === annotPrefs.type));
    });
  }
  annotColors.innerHTML = ANNOT_PALETTE.map(function (c) {
    return (
      '<button type="button" data-annot-color="' +
      c +
      '" aria-label="' +
      COL[c][1] +
      '" title="' +
      COL[c][1] +
      '" style="background:' +
      COL[c][0] +
      '"></button>'
    );
  }).join('');
  annotColors.addEventListener('click', function (e) {
    var b = e.target.closest('[data-annot-color]');
    if (!b) return;
    annotPrefs.color = b.getAttribute('data-annot-color');
    annotPrefs.type = 'highlight';
    saveAnnotPrefs();
    syncAnnotControls();
    annotColors.querySelectorAll('button').forEach(function (x) {
      x.setAttribute('aria-pressed', String(x === b));
    });
    if (annotTarget) {
      var targetWord = pageList.querySelector(
        '.page-view[data-page="' + annotTarget.page + '"] .w[data-v="' + annotTarget.verse + '"]'
      );
      if (targetWord) markVerseFromTap(targetWord, annotTarget.page);
    }
  });
  annotControls.addEventListener('click', function (e) {
    var mode = e.target.closest('[data-annot-mode]'),
      type = e.target.closest('[data-annot-type]');
    if (mode) annotPrefs.mode = mode.getAttribute('data-annot-mode');
    if (type) annotPrefs.type = type.getAttribute('data-annot-type');
    if (mode || type) {
      saveAnnotPrefs();
      syncAnnotControls();
    }
  });
  $('annotClose').addEventListener('click', function () {
    annotEnabled = false;
    annotTransient = false;
    annotTarget = null;
    saveAnnotPrefs();
    syncAnnotControls();
    closeWp();
  });
  annotColors.querySelectorAll('button').forEach(function (b) {
    b.setAttribute('aria-pressed', String(b.getAttribute('data-annot-color') === annotPrefs.color));
  });
  syncAnnotControls();
  function syncThemeButton() {
    var root = document.documentElement,
      dark =
        root.getAttribute('data-theme') === 'dark' ||
        (!root.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    $('themeLabel').textContent = dark ? 'الوضع النهاري' : 'الوضع الليلي';
    $('bTheme').setAttribute('aria-label', dark ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي');
    $('bTheme').setAttribute('aria-pressed', String(dark));
  }
  $('bTheme').addEventListener('click', function () {
    var r = document.documentElement,
      dark =
        r.getAttribute('data-theme') === 'dark' ||
        (!r.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var next = dark ? 'light' : 'dark';
    r.setAttribute('data-theme', next);
    store('mq.theme', next);
    syncThemeButton();
    toast(next === 'dark' ? 'تم تفعيل الوضع الليلي' : 'تم تفعيل الوضع النهاري');
  });
  var th = store('mq.theme');
  if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th);
  syncThemeButton();

  var pgIn = $('pgIn');
  pgIn.addEventListener('focus', function () {
    pgIn.select();
  });
  /* ======== 10) التحكم بالتنقل والمظهر وتحضير المصحف وإظهاره بعد التحميل ======== */
  function commitPage() {
    var n = parseNum(pgIn.value);
    if (!isNaN(n)) goTo(n);
    else pgIn.value = ar(cur);
  }
  pgIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      commitPage();
      pgIn.blur();
    }
  });
  pgIn.addEventListener('change', commitPage);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closeD();
      closeV();
      return;
    }
    if (
      (body.classList.contains('open') && window.innerWidth < 900) ||
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))
    )
      return;
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && body.classList.contains('vs')) closeV();
    if (e.key === 'ArrowLeft') {
      stopAutoScroll();
      goTo(curNow() + 1);
    } else if (e.key === 'ArrowRight') {
      stopAutoScroll();
      goTo(curNow() - 1);
    }
  });
  var rt,
    lastW = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      if (annotEnabled && annotPosition) restoreAnnotPosition();
      if (pageEl.clientWidth !== lastW) {
        lastW = pageEl.clientWidth;
        renderInitialPage(cur);
        window.scrollTo(0, 0);
      }
    }, 120);
  });

  var saved = parseInt(store('mq.page') || '', 10);
  cur = saved >= 1 && saved <= TOTAL ? saved : 1;
  lastW = pageEl.clientWidth;

  var quranLoading = $('quranLoading'),
    quranLoadingText = $('quranLoadingText'),
    quranLoadingBar = $('quranLoadingBar'),
    quranLoadingStarted = Date.now();
  var quranTextNotice = $('quranTextNotice'),
    quranTextNoticeMessage = $('quranTextNoticeMessage'),
    quranTextNoticeTitle = $('quranTextNoticeTitle'),
    quranTextNoticeDetail = $('quranTextNoticeDetail'),
    quranTextDismiss = $('quranTextDismiss');
  var lastQuranLoadError = '';
  /* options: { title, detail, compact }
   * compact=true يعرض شريطًا سفليًا صغيرًا لا يحجب القراءة (وضع النص المبسّط). */
  function showQuranTextNotice(message, options) {
    options = options || {};
    if (quranTextNoticeMessage && message) quranTextNoticeMessage.textContent = message;
    if (quranTextNoticeTitle) quranTextNoticeTitle.textContent = options.title || 'ملفات المصحف غير مكتملة';
    if (quranTextNoticeDetail) {
      quranTextNoticeDetail.textContent = options.detail || '';
      quranTextNoticeDetail.hidden = !options.detail;
    }
    if (quranTextDismiss) quranTextDismiss.hidden = !options.compact;
    if (quranTextNotice) {
      quranTextNotice.classList.toggle('is-compact', !!options.compact);
      quranTextNotice.hidden = false;
    }
  }
  function hideQuranTextNotice() {
    if (quranTextNotice) quranTextNotice.hidden = true;
  }
  if (quranTextDismiss) quranTextDismiss.addEventListener('click', hideQuranTextNotice);
  function revealQuran() {
    document.body.classList.remove('quran-preparing');
    if (quranLoading) quranLoading.classList.add('is-ready');
    requestAnimationFrame(updateContinuousPages);
  }
  function updateQuranLoading(percent, message) {
    if (quranLoadingBar) quranLoadingBar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    if (quranLoadingText && message) {
      quranLoadingText.innerHTML =
        message === 'اكتمل تجهيز النصوص، مرحبًا بك في المصحف'
          ? 'اكتمل تجهيز النصوص،<br>مرحبًا بك في المصحف'
          : message;
    }
  }
  function preloadAllQuranContent() {
    var complete =
      Array.isArray(D.texts) &&
      D.texts.length === 114 &&
      Array.isArray(D.surahs) &&
      D.surahs.length === 114 &&
      Array.isArray(G) &&
      G.length === 604 &&
      tajweedFontIndex &&
      tajweedFontIndex.length === 604 &&
      tajweedFontData &&
      Array.isArray(tajweedFontData.glyphs) &&
      tajweedFontData.glyphs.length === 604;
    if (!complete) return Promise.reject(new Error('بيانات المصحف أو فهرس الخطوط غير مكتمل'));
    var ayahCount = 0;
    for (var i = 0; i < D.texts.length; i++) {
      if (
        !Array.isArray(D.texts[i]) ||
        D.texts[i].length !== D.surahs[i][3] ||
        D.texts[i].some(function (text) {
          return typeof text !== 'string' || !text.trim();
        })
      ) {
        return Promise.reject(new Error('نصوص سورة ' + D.surahs[i][1] + ' غير مكتملة'));
      }
      ayahCount += D.texts[i].length;
    }
    if (ayahCount !== 6236)
      return Promise.reject(new Error('عدد آيات المصحف غير مكتمل: ' + ayahCount + ' من 6236'));
    var fonts = ['QCF4_QBSML'];
    var samples = { QCF4_QBSML: 'ا' };
    for (var n = 1; n <= 47; n++) {
      var family = 'QCF4_Hafs_' + (n < 10 ? '0' : '') + n;
      fonts.push(family);
      samples[family] = '';
    }
    for (var pageIndex = 0; pageIndex < G.length; pageIndex++) {
      var lines = G[pageIndex];
      var expectedGlyphs = 0;
      lines.forEach(function (line) {
        if (line[0] === 'w') {
          expectedGlyphs += line[2].length;
          var fontName = 'QCF4_Hafs_' + (line[1] < 10 ? '0' : '') + line[1];
          if (!samples[fontName]) samples[fontName] = line[2][0][1];
        } else if (line[0] === 'b') {
          if (!samples.QCF4_Hafs_01) samples.QCF4_Hafs_01 = line[1];
        }
      });
      getPageTajweedGlyphs(pageIndex + 1);
      if (
        tajweedFontIndex[pageIndex].length !== 3 ||
        !Number.isInteger(tajweedFontIndex[pageIndex][0]) ||
        !Number.isInteger(tajweedFontIndex[pageIndex][1]) ||
        !Number.isInteger(tajweedFontIndex[pageIndex][2]) ||
        tajweedFontIndex[pageIndex][0] < 0 ||
        tajweedFontIndex[pageIndex][0] > 60 ||
        tajweedFontIndex[pageIndex][1] < 0 ||
        tajweedFontIndex[pageIndex][2] <= 0 ||
        typeof tajweedFontData.glyphs[pageIndex] !== 'string'
      ) {
        return Promise.reject(new Error('بيانات خط التجويد غير صالحة للصفحة ' + (pageIndex + 1)));
      }
      if (!expectedGlyphs) return Promise.reject(new Error('صفحة المصحف فارغة: ' + (pageIndex + 1)));
    }
    var loaded = 0;
    updateQuranLoading(2, 'التحقق من نصوص المصحف كاملةً…');
    return Promise.all(
      fonts.map(function (font) {
        if (!samples[font]) return Promise.reject(new Error('لا يوجد نموذج للتحقق من الخط ' + font));
        return document.fonts.load('100px "' + font + '"', samples[font]).then(function (faces) {
          if (
            !faces.some(function (face) {
              return face.family.replace(/["']/g, '') === font;
            })
          ) {
            throw new Error('تعذر تحميل الخط ' + font);
          }
          loaded++;
          updateQuranLoading(
            2 + (loaded / fonts.length) * 28,
            'تم تحميل خطوط المصحف: ' + Math.round((loaded / fonts.length) * 100) + '%'
          );
        });
      })
    )
      .then(function () {
        if (tajweedOn && load('mq.tajweedDownloaded', false)) {
          // خط التجويد اختياري: إن تعذّر تحميله يُفتح المصحف العادي بدل حجب القراءة،
          // ويُعاد وسم التجويد «غير منزَّل» ليُعرض زر التنزيل من جديد.
          return loadTajweedFont(cur).catch(function (error) {
            console.warn('تعذر تحميل خط التجويد؛ فُتح المصحف العادي:', error);
            tajweedOn = false;
            save('mq.tajweedDownloaded', false);
            setTimeout(function () {
              toast('ملفات التجويد غير مكتملة؛ فُتح المصحف العادي. أعد تنزيلها من الإعدادات.');
            }, 1500);
            return null;
          });
        }
        return null;
      })
      .then(function () {
        tajweedChunkPromises = {};
        return document.fonts.ready;
      });
  }
  function openQuranWhenReady(assetsReady, suppressNotice) {
    return Promise.resolve(assetsReady)
      .then(function () {
        updateQuranLoading(1, 'يتم تنزيل النصوص والخطوط المطلوبة…');
        return preloadAllQuranContent();
      })
      .then(function () {
        updateQuranLoading(55, 'يتم تجهيز صفحات المصحف قبل العرض…');
        quranTextFallbackMode = false;
        document.body.classList.remove('quran-text-fallback');
        renderInitialPage(cur);
        return renderQueue;
      })
      .then(function () {
        if (quranTextFallbackMode) {
          throw new Error('تعذر تجهيز خطوط صفحات المصحف كاملة');
        }
        hideQuranTextNotice();
        updateQuranLoading(100, 'اكتمل تجهيز النصوص، مرحبًا بك في المصحف');
        setTimeout(revealQuran, Math.max(0, 1000 - (Date.now() - quranLoadingStarted)));
        if (!store('mq.hint')) {
          store('mq.hint', '1');
          toast('اسحب لتقليب الصفحات، واضغط على آية لخياراتها');
        }
        return true;
      })
      .catch(function (error) {
        console.error('Unable to prepare the Quran text and fonts:', error);
        lastQuranLoadError = (error && error.message) || String(error);
        updateQuranLoading(0, 'تعذر تجهيز المصحف كاملًا');
        if (!suppressNotice) {
          showQuranTextNotice(
            'لم يكتمل تحميل نصوص المصحف أو خطوطه، لذلك سيبقى المصحف مغلقًا. تحقق من اتصالك ثم اضغط «إعادة المحاولة».'
          );
        }
        return false;
      });
  }

  /* الوضع الآمن (نص مبسّط): يفتح المصحف بنص الآيات العادي دون خطوط QCF عندما يتعذر تحميلها،
   * بدل إبقاء التطبيق مقفلًا. يعود تلقائيًا للمصحف الكامل عند نجاح إعادة التجهيز. */
  function openQuranTextMode() {
    quranTextFallbackMode = true;
    document.body.classList.add('quran-text-fallback');
    try {
      renderInitialPage(cur);
    } catch (error) {
      console.error('تعذر عرض النص المبسّط:', error);
      return false;
    }
    updateQuranLoading(100, 'تم فتح المصحف بالنص المبسّط');
    revealQuran();
    return true;
  }

  window.MushafRuntime = {
    $: $,
    showNotice: showQuranTextNotice,
    hideNotice: hideQuranTextNotice,
    openTextMode: openQuranTextMode,
    isTextMode: function () {
      return quranTextFallbackMode;
    },
    getLoadError: function () {
      return lastQuranLoadError;
    },
    store: store,
    data: D,
    toast: toast,
    openWhenReady: openQuranWhenReady,
    updateLoading: updateQuranLoading,
    assetCacheName: ASSET_CACHE_NAME,
    isTajweedDownloaded: function () {
      return !!load('mq.tajweedDownloaded', false);
    },
    setTajweedDownloaded: function (val) {
      save('mq.tajweedDownloaded', !!val);
    },
    isTajweedOn: function () {
      return tajweedOn;
    },
    isTajweedLegendVisible: function () {
      return tajweedLegendVisible;
    },
    setTajweedLegendVisible: function (visible) {
      tajweedLegendVisible = !!visible;
      save('mq.tajweedLegendVisible', tajweedLegendVisible);
      document.querySelectorAll('.page-view .tajweed-legend-bar').forEach(function (legend) {
        legend.hidden = !(tajweedOn && tajweedLegendVisible);
      });
    },
    setTajweed: function (enabled) {
      tajweedOn = enabled;
      save('mq.tajweed', tajweedOn);
      document.querySelectorAll('.page-view').forEach(function (view) {
        var p = +view.getAttribute('data-page');
        if (!p) return;
        var bounds = view.getBoundingClientRect();
        var nearViewport = bounds.bottom >= -window.innerHeight && bounds.top <= window.innerHeight * 2;
        if (view === activeView || nearViewport) render(view, p);
      });
    },
    closeDrawer: closeD,
    goTo: goTo,
    getCurrentPage: function () {
      return cur;
    },
    body: body,
    tabS: tabS,
    tabSettings: tabSettings,
    tabWorship: tabWorship,
    paneS: paneS,
    paneSettings: paneSettings,
    paneWorship: paneWorship,
    paneM: paneM
  };
})();


/* ======================================================================
 * 5. الخدمات المدمجة
 * QuranIntegratedServices.mount: تركيب خدمة (الراديو) داخل Shadow DOM.
 * ====================================================================== */
/* integrated-services.js */
(function (global) {
  'use strict';

  var services = global.QuranIntegratedServiceData;
  if (!services) throw new Error('بيانات الخدمات المدمجة غير محمّلة');
  var SERVICE_TITLES = {
    radio: 'إذاعة القرآن الكريم'
  };
  var CAIRO_FONT_FACES = (
    services.radio.css.match(/@font-face\s*\{[^}]*font-family:\s*['"]Cairo['"][^}]*\}/g) || []
  ).join('\n');
  var globalFontStyle = document.createElement('style');
  globalFontStyle.textContent =
    CAIRO_FONT_FACES +
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
    style.textContent =
      CAIRO_FONT_FACES +
      ':host{display:block;flex:1;min-height:0;overflow-x:hidden;overflow-y:auto;overscroll-behavior-y:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:0!important}' +
      scopedStyles(service.css) +
      '.integrated-service-root{position:relative;width:100%;min-height:100%}' +
      ':host .integrated-service-root,:host .integrated-service-root *{font-family:"Cairo","Segoe UI",Tahoma,Arial,sans-serif!important}' +
      (key === 'radio'
        ? ':host{display:flex;justify-content:center;align-items:center;width:100%;max-width:100%;min-width:0}' +
          ':host .integrated-service-root{display:grid;place-items:center;width:100%;min-width:0}' +
          ':host .integrated-service-root>.app{width:min(100%,430px);margin:0 auto}'
        : '') +
      (key === 'radio'
        ? ':host{--bg:var(--panel,#f5f8fb);--ink:inherit;--muted:inherit;--line:inherit;--blue:var(--green,#14634a);--blue2:color-mix(in srgb,var(--green,#14634a) 78%,#123);--blue-soft:color-mix(in srgb,var(--green,#14634a) 12%,var(--panel,#fff));}' +
          ':host .hero,:host .tile,:host .st,:host .lib,:host .back{background:var(--card,var(--panel,#fff));border-color:var(--line)}' +
          ':host .t-blue,:host .t-green{--tc:var(--green,#14634a);--tint:color-mix(in srgb,var(--green,#14634a) 12%,var(--panel,#fff))}' +
          ':host .t-purple,:host .t-orange{--tc:var(--sub,#a58b62);--tint:color-mix(in srgb,var(--sub,#a58b62) 14%,var(--panel,#fff))}' +
          ':host .st.on{background:var(--blue-soft)}:host .lt .dl{background:var(--panel,#f5f8fb)}' +
          ':host .logo rect:nth-of-type(2){fill:var(--green,#14634a)}:host .logo #lg stop:first-child{stop-color:var(--green,#14634a)}:host .logo #lg stop:last-child{stop-color:var(--g900,#0b3d2e)}' +
          ':host .mini{background:var(--green,#14634a);color:var(--on-green,#fff)}:host .mini .mp svg{fill:var(--on-green,#fff)}'
        : '') +
      ':host{background-color:var(--bg)!important;color:var(--ink)!important}' +
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
      root.querySelectorAll('audio').forEach(function (audio) {
        audio.pause();
      });
      root.replaceChildren();
    }

    return dispose;
  }

  global.QuranIntegratedServices = { mount: mount };
})(window);


/* ======================================================================
 * 6. مواقيت الصلاة
 * الحساب والإشعارات والتنبيهات.
 * ====================================================================== */
/* prayer-times.js */
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
  var DEFAULT_CITY =
    CITIES.find(function (city) {
      return city.id === 'aswan';
    }) || CITIES[0];
  var CACHE_KEY = 'quran_prayer_cache_v1';
  var CITY_KEY = 'quran_prayer_city_v1';
  var prayerStoragePersistenceRequested = false;
  var ALERTS_KEY = 'quran_prayer_alerts_v1';
  var ALERT_CACHE = 'quran-prayer-audio-v1';
  var AUDIO_PATH = './audio-cache/';
  var ALERT_PRAYERS = PRAYERS.slice();
  var ADHAN_VOICE_ID = 'adhan-makkah';
  var CUSTOM_VOICES_KEY = 'quran_adhan_custom_v1';
  var ADHAN_VOICES = {
    'adhan-makkah': {
      label: 'أذان المسجد الحرام · مكة',
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Adhan%2C_Great_Mosque_of_Mecca_-_Jan_21%2C_2013.webm',
      extension: 'webm',
      page: 'https://commons.wikimedia.org/wiki/File:Adhan,_Great_Mosque_of_Mecca_-_Jan_21,_2013.webm',
      credit: 'Seyfula Islam',
      licenseName: 'CC BY 3.0',
      license: 'https://creativecommons.org/licenses/by/3.0/'
    }
  };
  // أصوات إضافية: ملف adhan-voices.json (اختياري) + أصوات يضيفها المستخدم من جهازه (تُحفظ في Cache API).
  function readCustomVoices() {
    try {
      var list = JSON.parse(localStorage.getItem(CUSTOM_VOICES_KEY) || '[]');
      return Array.isArray(list)
        ? list.filter(function (v) {
            return v && /^custom-[a-z0-9]+$/.test(v.id) && v.label;
          })
        : [];
    } catch (error) {
      return [];
    }
  }
  function registerCustomVoices() {
    readCustomVoices().forEach(function (v) {
      ADHAN_VOICES[v.id] = { label: v.label, custom: true, extension: v.ext || 'mp3' };
    });
  }
  registerCustomVoices();
  function loadVoiceManifest() {
    return fetch('./adhan-voices.json', { cache: 'no-cache' })
      .then(function (r) {
        return r.ok ? r.json() : { voices: [] };
      })
      .then(function (json) {
        (json.voices || []).forEach(function (v) {
          if (v && /^[a-z0-9-]+$/.test(v.id || '') && v.label && v.url) {
            ADHAN_VOICES[v.id] = {
              label: v.label,
              url: v.url,
              extension: v.extension || String(v.url).split('?')[0].split('.').pop(),
              credit: v.credit || '',
              licenseName: v.license || ''
            };
          }
        });
      })
      .catch(function () {});
  }
  var DEFAULT_ALERTS = {
    enabled: { Fajr: false, Sunrise: false, Dhuhr: false, Asr: false, Maghrib: false, Isha: false },
    sound: true,
    voice: ADHAN_VOICE_ID,
    volume: 1,
    fullscreen: true,
    advance: 0,
    notifications: false
  };
  var activeContainer = null;
  var activeStatus = null;
  var countdownTimer = null;
  var alertTimer = null;
  var adhanAudio = new Audio();
  var adhanScreen = document.getElementById('adhanScreen');
  var adhanScreenTitle = document.getElementById('adhanScreenTitle');
  var adhanScreenTime = document.getElementById('adhanScreenTime');
  var adhanScreenClose = document.getElementById('adhanScreenClose');
  var adhanScreenReplay = document.getElementById('adhanScreenReplay');
  var activeAdhanPrayer = PRAYERS[0];
  var adhanWakeLock = null;
  var audioLoadPromises = Object.create(null);
  var adhanObjectUrls = Object.create(null);
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
    return (
      '<button type="button" class="qpt-bell' +
      (enabled ? ' is-enabled' : '') +
      '" data-qpt-prayer-toggle="' +
      prayer.id +
      '" aria-label="' +
      label +
      '" aria-pressed="' +
      enabled +
      '">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>' +
      (enabled ? '' : '<path class="qpt-bell-slash" d="M4 4l16 16"/>') +
      '</svg></button>'
    );
  }

  function togglePrayerAlert(button) {
    var prayerId = button.getAttribute('data-qpt-prayer-toggle');
    if (!prayerId) return;
    var prayer = ALERT_PRAYERS.find(function (item) {
      return item.id === prayerId;
    });
    if (!prayer) return;
    var alerts = readAlerts();
    alerts.enabled[prayerId] = !alerts.enabled[prayerId];
    if (!saveAlerts(alerts)) return;
    var updatedButton = prayerBellButton(prayer, alerts.enabled[prayerId]);
    var wrapper = document.createElement('div');
    wrapper.innerHTML = updatedButton;
    button.replaceWith(wrapper.firstChild);
    var box = document.querySelector('[data-adhan-prayer="' + prayerId + '"]');
    if (box) box.checked = alerts.enabled[prayerId];
    setAlertStatus(
      alerts.enabled[prayerId]
        ? 'تم تفعيل تنبيه صلاة ' + prayer.name + '.'
        : 'تم إيقاف تنبيه صلاة ' + prayer.name + '.',
      'success'
    );
    startAlertScheduler();
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function selectedCity() {
    var id = DEFAULT_CITY.id;
    try {
      id = localStorage.getItem(CITY_KEY) || id;
    } catch (error) {}
    return (
      CITIES.find(function (city) {
        return city.id === id;
      }) || DEFAULT_CITY
    );
  }

  function requestPrayerStoragePersistence() {
    if (prayerStoragePersistenceRequested || !navigator.storage) return;
    prayerStoragePersistenceRequested = true;
    if (typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(function () {});
    }
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return {};
      var data = JSON.parse(raw);
      if (
        !data ||
        data.format !== 'quran-prayer-cache' ||
        data.version !== 1 ||
        !data.items ||
        typeof data.items !== 'object' ||
        Array.isArray(data.items)
      ) {
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
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          format: 'quran-prayer-cache',
          version: 1,
          items: items
        })
      );
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
      if (!saved || typeof saved !== 'object' || Array.isArray(saved))
        throw new Error('إعدادات التنبيه غير صالحة');
      return {
        enabled: ALERT_PRAYERS.reduce(function (enabled, prayer) {
          enabled[prayer.id] =
            saved.enabled && typeof saved.enabled[prayer.id] === 'boolean'
              ? saved.enabled[prayer.id]
              : DEFAULT_ALERTS.enabled[prayer.id];
          return enabled;
        }, {}),
        sound: typeof saved.sound === 'boolean' ? saved.sound : DEFAULT_ALERTS.sound,
        voice: ADHAN_VOICES[saved.voice] ? saved.voice : ADHAN_VOICE_ID,
        volume: typeof saved.volume === 'number' && saved.volume >= 0.1 && saved.volume <= 1 ? saved.volume : 1,
        fullscreen: saved.fullscreen !== false,
        advance: [0, 5, 10, 15, 20, 30].indexOf(Number(saved.advance)) !== -1 ? Number(saved.advance) : 0,
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
    var status = document.getElementById('adhanSetStatus');
    if (status) {
      status.textContent = kind === 'success' || kind === 'info' ? message : message;
      status.dataset.kind = kind || 'info';
    }
    if (activeStatus && (kind === 'warning' || kind === 'error')) activeStatus(message, kind);
  }

  function audioCacheUrl(voiceId) {
    var voice = ADHAN_VOICES[voiceId];
    var extension =
      (voice && voice.extension) || (voice && voice.url.split('?')[0].split('.').pop()) || 'ogg';
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
        if (cached) {
          if (adhanObjectUrls[voiceId]) URL.revokeObjectURL(adhanObjectUrls[voiceId]);
          adhanObjectUrls[voiceId] = URL.createObjectURL(await cached.blob());
          return adhanObjectUrls[voiceId];
        }
        if (voice.custom) throw new Error('ملف هذا الصوت غير موجود على الجهاز؛ أعد إضافته.');
        var response = await fetch(voice.url, { mode: 'cors', cache: 'force-cache' });
        if (!response.ok || response.type === 'opaque') {
          throw new Error('تعذر تنزيل التسجيل المرخّص. تحقق من اتصال الإنترنت ثم أعد المحاولة.');
        }
        await cache.put(localUrl, response.clone());
        if (adhanObjectUrls[voiceId]) URL.revokeObjectURL(adhanObjectUrls[voiceId]);
        adhanObjectUrls[voiceId] = URL.createObjectURL(await response.blob());
        return adhanObjectUrls[voiceId];
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
      var selectedUrl = audioCacheUrl(readAlerts().voice);
      return cache.keys().then(function (keys) {
        return Promise.all(
          keys
            .filter(function (request) {
              return request.url !== selectedUrl && request.url.indexOf('/custom-') === -1;
            })
            .map(function (request) {
              return cache.delete(request);
            })
        );
      });
    });
  }

  function showAdhanScreen(prayer, preview) {
    if (!adhanScreen) return;
    activeAdhanPrayer = prayer || PRAYERS[0];
    adhanScreenTitle.textContent = activeAdhanPrayer.name;
    adhanScreenTime.textContent = preview ? 'معاينة الأذان' : 'حان الآن وقت صلاة ' + activeAdhanPrayer.name;
    adhanScreen.hidden = false;
    document.body.classList.add('adhan-screen-open');
    // شاشة كاملة حقيقية وإبقاء الشاشة مضاءة (قد يرفضهما المتصفح دون لمسة المستخدم؛ تبقى الواجهة بملء الشاشة).
    try {
      if (adhanScreen.requestFullscreen && !document.fullscreenElement)
        adhanScreen.requestFullscreen().catch(function () {});
    } catch (error) {
      /* غير مدعوم */
    }
    try {
      if (navigator.wakeLock)
        navigator.wakeLock.request('screen').then(function (lock) {
          adhanWakeLock = lock;
        }, function () {});
    } catch (error) {
      /* غير مدعوم */
    }
  }

  function hideAdhanScreen() {
    if (!adhanScreen) return;
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      if (adhanWakeLock) adhanWakeLock.release();
    } catch (error) {
      /* تجاهل */
    }
    adhanWakeLock = null;
    adhanScreen.hidden = true;
    document.body.classList.remove('adhan-screen-open');
    adhanAudio.pause();
    adhanAudio.currentTime = 0;
  }

  function playSelectedAdhan(prayer, preview, skipScreen) {
    if (!skipScreen) showAdhanScreen(prayer, preview === true);
    var chosen = readAlerts();
    adhanAudio.volume = chosen.volume;
    loadAdhanVoice(chosen.voice)
      .then(function (url) {
        adhanAudio.src = url;
        adhanAudio.currentTime = 0;
        return adhanAudio.play();
      })
      .catch(function (error) {
        console.error('تعذر تشغيل الأذان عند موعد الصلاة.', error);
        setAlertStatus('تعذر تشغيل تسجيل الأذان تلقائيًا. افتح التطبيق وتحقق من اتصال الإنترنت.', 'warning');
      });
  }

  function previewAdhan() {
    var cache = readCache()[selectedCity().id];
    var next = cache && cache.timings ? prayerRange(cache.timings).next : null;
    playSelectedAdhan(next && next.prayer ? next.prayer : PRAYERS[0], true);
  }

  if (adhanScreenClose) adhanScreenClose.addEventListener('click', hideAdhanScreen);
  if (adhanScreenReplay)
    adhanScreenReplay.addEventListener('click', function () {
      playSelectedAdhan(activeAdhanPrayer, true);
    });

  function sendNotification(prayer, isAdvance) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var title = isAdvance ? 'اقترب موعد صلاة ' + prayer.name : 'حان الآن وقت صلاة ' + prayer.name;
    var options = {
      body: isAdvance ? 'باقي ' + readAlerts().advance + ' دقائق على الصلاة.' : 'حيّ على الصلاة.',
      icon: './logo.png',
      badge: './logo.png',
      tag: 'quran-prayer-' + prayer.id + (isAdvance ? '-reminder' : ''),
      renotify: false,
      requireInteraction: !isAdvance,
      vibrate: [300, 120, 300, 120, 500],
      data: { url: './' }
    };
    var notification;
    try {
      notification =
        navigator.serviceWorker && navigator.serviceWorker.ready
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
        var key =
          'quran_prayer_alert_fired_' +
          cityId +
          '_' +
          today +
          '_' +
          prayer.id +
          (item.isAdvance ? '_before' : '');
        if (firedAlertKeys[key]) return;
        try {
          if (localStorage.getItem(key)) return;
          localStorage.setItem(key, '1');
        } catch (error) {
          console.error('تعذر تسجيل تنبيه الصلاة لمنع تكراره.', error);
          setAlertStatus('تعذر حفظ سجل التنبيه؛ سيعمل منع التكرار حتى إغلاق الصفحة فقط.', 'warning');
        }
        firedAlertKeys[key] = true;
        if (!item.isAdvance && alerts.fullscreen) showAdhanScreen(prayer, false);
        if (alerts.sound) {
          if (item.isAdvance) {
            /* التذكير المسبق إشعار فقط دون صوت الأذان */
          } else playSelectedAdhan(prayer, false, !alerts.fullscreen);
        }
        if (alerts.notifications) sendNotification(prayer, item.isAdvance);
        if (!alerts.notifications && !alerts.sound) {
          setAlertStatus('حان وقت صلاة ' + prayer.name + '.', 'info');
        } else {
          setAlertStatus(
            item.isAdvance
              ? 'تذكير: بقي ' + item.minutes + ' دقائق على صلاة ' + prayer.name + '.'
              : 'حان وقت صلاة ' + prayer.name + '.',
            'success'
          );
        }
      });
    });
  }

  function startAlertScheduler() {
    if (alertTimer) return;
    checkPrayerAlerts();
    alertTimer = setInterval(checkPrayerAlerts, 15000);
  }

  /* ===== قسم إعدادات الأذان (في تبويب الإعدادات) ===== */
  var ADVANCE_OPTIONS = [
    [0, 'وقت الصلاة فقط'],
    [5, 'قبلها بـ٥ دقائق'],
    [10, 'قبلها بـ١٠ دقائق'],
    [15, 'قبلها بـ١٥ دقيقة'],
    [20, 'قبلها بـ٢٠ دقيقة'],
    [30, 'قبلها بـ٣٠ دقيقة']
  ];

  function notificationState() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.permission === 'granted' && readAlerts().notifications ? 'on' : 'off';
  }

  function voiceOptionsHtml(selected) {
    return Object.keys(ADHAN_VOICES)
      .map(function (id) {
        return (
          '<option value="' + id + '"' + (id === selected ? ' selected' : '') + '>' +
          escapeHtml(ADHAN_VOICES[id].label) + '</option>'
        );
      })
      .join('');
  }

  function adhanSwitch(attr, checked, title, hint, extra) {
    return (
      '<label class="qas-switch"><span class="qas-sw-text"><strong>' + title + '</strong>' +
      (hint ? '<small>' + hint + '</small>' : '') +
      '</span><input type="checkbox" ' + attr + (checked ? ' checked' : '') + (extra || '') + ' role="switch"><i class="qas-track" aria-hidden="true"></i></label>'
    );
  }

  function adhanSummaryText(alerts) {
    var count = ALERT_PRAYERS.filter(function (p) {
      return alerts.enabled[p.id];
    }).length;
    var adv = ADVANCE_OPTIONS.filter(function (o) {
      return o[0] === alerts.advance;
    })[0];
    return (
      (alerts.sound ? 'الصوت مفعّل' : 'الصوت متوقف') +
      ' · ' + (count ? 'تنبيه لـ' + count + ' صلوات' : 'لا تنبيهات') +
      (adv && adv[0] ? ' · ' + adv[1] : '')
    );
  }

  function renderAdhanSettings() {
    var card = adhanCard;
    if (!card) return;
    var alerts = readAlerts();
    var voice = ADHAN_VOICES[alerts.voice] || ADHAN_VOICES[ADHAN_VOICE_ID];
    var note = notificationState();
    var openNow = card.open;
    card.innerHTML =
      '<summary class="qas-summary"><span class="qas-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="18" cy="18" r="2"/></svg></span>' +
      '<span class="qas-titles"><strong>إعدادات الأذان والتنبيهات</strong><small>' + adhanSummaryText(alerts) + '</small></span><svg class="qas-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>' +
      '<div class="qas-body">' +
      // —— الصوت ——
      '<section class="qas-group"><h4><span aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg></span>صوت الأذان</h4>' +
      adhanSwitch('data-adhan-sound', alerts.sound, 'تشغيل صوت الأذان', 'يُشغَّل عند دخول وقت الصلاة والتطبيق مفتوح') +
      '<div class="qas-field"><span class="qas-label">الصوت المختار</span><div class="qas-inline">' +
      '<select data-adhan-voice aria-label="صوت الأذان">' + voiceOptionsHtml(alerts.voice) + '</select>' +
      '<button type="button" class="qas-play" data-adhan-preview aria-label="معاينة الأذان" title="معاينة الأذان">&#9654;</button></div></div>' +
      '<div class="qas-actions"><label class="qas-file">＋ إضافة صوت من جهازك<input type="file" accept="audio/*" data-adhan-add></label>' +
      (voice.custom ? '<button type="button" class="qas-danger" data-adhan-remove>حذف هذا الصوت</button>' : '') + '</div>' +
      '<div class="qas-field"><span class="qas-label">مستوى الصوت <output data-adhan-volume-out>' + Math.round(alerts.volume * 100) + '٪</output></span>' +
      '<input class="qas-range" type="range" min="10" max="100" step="5" value="' + Math.round(alerts.volume * 100) + '" data-adhan-volume aria-label="مستوى صوت الأذان"></div>' +
      '</section>' +
      // —— التنبيه ——
      '<section class="qas-group"><h4><span aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></span>التنبيه</h4>' +
      '<div class="qas-field"><span class="qas-label">التذكير قبل الصلاة</span><select data-adhan-advance aria-label="التذكير قبل الصلاة">' +
      ADVANCE_OPTIONS.map(function (o) {
        return '<option value="' + o[0] + '"' + (alerts.advance === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></div>' +
      adhanSwitch('data-adhan-fullscreen', alerts.fullscreen, 'شاشة الأذان الكاملة', 'تظهر عند دخول الوقت مع إبقاء الشاشة مضاءة') +
      (note === 'unsupported'
        ? ''
        : adhanSwitch('data-adhan-notify', note === 'on', 'إشعارات النظام',
            note === 'denied' ? 'محظورة؛ فعّلها من إعدادات المتصفح لهذا الموقع' : 'إشعار يبقى حتى تفتحه عند دخول الوقت',
            note === 'denied' ? ' disabled' : '')) +
      '</section>' +
      // —— الصلوات ——
      '<section class="qas-group"><h4><span aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></span>الصلوات المفعّل لها التنبيه</h4><div class="qas-chips">' +
      ALERT_PRAYERS.map(function (prayer) {
        return '<label class="qas-chip"><input type="checkbox" data-adhan-prayer="' + prayer.id + '"' + (alerts.enabled[prayer.id] ? ' checked' : '') + '><span>' + prayer.name + '</span></label>';
      }).join('') + '</div></section>' +
      '<p class="adhan-set-status" id="adhanSetStatus" role="status" aria-live="polite"></p>' +
      '<p class="adhan-set-credit">' + (voice.credit ? 'التسجيل: ' + escapeHtml(voice.credit) + (voice.licenseName ? ' · ' + escapeHtml(voice.licenseName) : '') : voice.custom ? 'ملف صوتي من جهازك.' : '') + '</p>' +
      '</div>';
    card.open = openNow;
  }

  function refreshBells() {
    var alerts = readAlerts();
    ALERT_PRAYERS.forEach(function (prayer) {
      var button = document.querySelector('[data-qpt-prayer-toggle="' + prayer.id + '"]');
      if (!button) return;
      var wrapper = document.createElement('div');
      wrapper.innerHTML = prayerBellButton(prayer, alerts.enabled[prayer.id]);
      button.replaceWith(wrapper.firstChild);
    });
  }

  function addCustomVoice(file) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setAlertStatus('حجم الملف كبير؛ اختر ملفًا أقل من ٨ ميجابايت.', 'warning');
      return;
    }
    var id = 'custom-' + Date.now().toString(36);
    var ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'mp3';
    var label = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'صوت مخصص';
    caches
      .open(ALERT_CACHE)
      .then(function (cache) {
        ADHAN_VOICES[id] = { label: label, custom: true, extension: ext };
        return cache.put(
          audioCacheUrl(id),
          new Response(file, { headers: { 'Content-Type': file.type || 'audio/mpeg' } })
        );
      })
      .then(function () {
        var list = readCustomVoices();
        list.push({ id: id, label: label, ext: ext });
        localStorage.setItem(CUSTOM_VOICES_KEY, JSON.stringify(list));
        var alerts = readAlerts();
        alerts.voice = id;
        saveAlerts(alerts);
        renderAdhanSettings();
        setAlertStatus('تمت إضافة الصوت واختياره.', 'success');
      })
      .catch(function (error) {
        delete ADHAN_VOICES[id];
        console.error('تعذرت إضافة الصوت.', error);
        setAlertStatus('تعذرت إضافة الملف الصوتي.', 'error');
      });
  }

  function removeCustomVoice(id) {
    var url = audioCacheUrl(id);
    delete ADHAN_VOICES[id];
    delete audioLoadPromises[id];
    try {
      localStorage.setItem(
        CUSTOM_VOICES_KEY,
        JSON.stringify(
          readCustomVoices().filter(function (v) {
            return v.id !== id;
          })
        )
      );
    } catch (error) {
      /* تجاهل */
    }
    var alerts = readAlerts();
    if (alerts.voice === id) alerts.voice = ADHAN_VOICE_ID;
    saveAlerts(alerts);
    return caches
      .open(ALERT_CACHE)
      .then(function (cache) {
        return cache.delete(url);
      })
      .catch(function () {})
      .then(function () {
        renderAdhanSettings();
        setAlertStatus('تم حذف الصوت.', 'success');
      });
  }

  function onAdhanSettingsChange(event) {
    var el = event.target;
    var alerts = readAlerts();
    if (el.hasAttribute('data-adhan-add')) {
      addCustomVoice(el.files && el.files[0]);
      return;
    }
    if (el.hasAttribute('data-adhan-sound')) alerts.sound = el.checked;
    else if (el.hasAttribute('data-adhan-voice')) {
      alerts.voice = ADHAN_VOICES[el.value] ? el.value : ADHAN_VOICE_ID;
      if (saveAlerts(alerts)) {
        renderAdhanSettings();
        // تنزيل الصوت المختار مسبقًا ليعمل دون إنترنت
        loadAdhanVoice(alerts.voice).catch(function () {
          setAlertStatus('تعذر تنزيل هذا الصوت الآن؛ سيُحمَّل عند توفر الإنترنت.', 'warning');
        });
      }
      return;
    } else if (el.hasAttribute('data-adhan-volume')) {
      alerts.volume = Number(el.value) / 100;
      var out = document.querySelector('[data-adhan-volume-out]');
      if (out) out.textContent = Math.round(alerts.volume * 100) + '٪';
      adhanAudio.volume = alerts.volume;
    } else if (el.hasAttribute('data-adhan-advance')) alerts.advance = Number(el.value);
    else if (el.hasAttribute('data-adhan-fullscreen')) alerts.fullscreen = el.checked;
    else if (el.hasAttribute('data-adhan-prayer')) {
      alerts.enabled[el.getAttribute('data-adhan-prayer')] = el.checked;
      saveAlerts(alerts);
      refreshBells();
      startAlertScheduler();
      return;
    } else if (el.hasAttribute('data-adhan-notify')) {
      toggleNotifications(el.checked);
      return;
    } else return;
    if (saveAlerts(alerts)) setAlertStatus('حُفظت الإعدادات على هذا الجهاز.', 'success');
    startAlertScheduler();
  }

  function toggleNotifications(on) {
    if (!('Notification' in window)) return;
    var current = readAlerts();
    if (!on) {
      current.notifications = false;
      saveAlerts(current);
      renderAdhanSettings();
      return;
    }
    (Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission())
      .then(function (permission) {
        current = readAlerts();
        current.notifications = permission === 'granted';
        saveAlerts(current);
        renderAdhanSettings();
        if (permission !== 'granted') setAlertStatus('لم يُمنح إذن الإشعارات.', 'warning');
        else startAlertScheduler();
      })
      .catch(function () {
        setAlertStatus('تعذر طلب إذن الإشعارات من المتصفح.', 'error');
      });
  }

  var adhanCard = null;
  function mountAdhanSettings() {
    if (adhanCard) return;
    var card = document.createElement('details');
    card.className = 'qas-card';
    card.id = 'adhanSettingsCard';
    adhanCard = card;
    card.addEventListener('change', onAdhanSettingsChange);
    card.addEventListener('input', function (event) {
      if (event.target.hasAttribute('data-adhan-volume')) onAdhanSettingsChange(event);
    });
    card.addEventListener('click', function (event) {
      if (event.target.closest('[data-adhan-preview]')) previewAdhan();
      var rm = event.target.closest('[data-adhan-remove]');
      if (rm) removeCustomVoice(readAlerts().voice);
    });
    renderAdhanSettings();
    loadVoiceManifest().then(renderAdhanSettings);
  }
  mountAdhanSettings();

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
    return [hours, minutes, rest]
      .map(function (value) {
        return String(value).padStart(2, '0');
      })
      .join(':');
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
      return (
        '<div class="qpt-row"><span class="qpt-row-name">' +
        prayer.name +
        '</span><span class="qpt-row-time">' +
        escapeHtml(formatted.time) +
        '<small>' +
        escapeHtml(formatted.period) +
        '</small></span>' +
        prayerBellButton(prayer, Boolean(alerts.enabled[prayer.id])) +
        '</div>'
      );
    }).join('');

    var month = data.hijri && data.hijri.month ? data.hijri.month.ar : '';
    hijri.textContent =
      data.hijri && data.hijri.day
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
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      var timeout = setTimeout(function () {
        resolve(null);
      }, 8000);
      navigator.geolocation.getCurrentPosition(
        function (position) {
          clearTimeout(timeout);
          resolve(position);
        },
        function () {
          clearTimeout(timeout);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 }
      );
    });
  }

  async function loadTimes(force) {
    if (!activeContainer) return;
    var requestId = ++activeRequestId;
    var city = selectedCity();
    var cache = readCache()[city.id] || null;
    var today = todayKey();
    var offline = navigator.onLine === false;
    if (cache && cache.timings) {
      var freshForToday = cache.day === today;
      drawTimes(cache, !freshForToday && !offline);
      if (offline) setStatus('المواقيت المحفوظة متاحة دون اتصال.', 'info');
      else if (freshForToday) setStatus('مواقيت اليوم محفوظة على هذا الجهاز.', 'info');
      else
        setStatus(
          'المعروض آخر مواقيت محفوظة من ' + (cache.day || 'يوم سابق') + '، وقد لا تناسب تاريخ اليوم.',
          'warning'
        );
    }
    if (offline) {
      if (!cache || !cache.timings) {
        setStatus('لا يوجد اتصال ولم تُحفظ مواقيت لهذه المدينة بعد.', 'warning');
      }
      return;
    }
    if (!force && cache && cache.day === today) {
      setStatus('مواقيت اليوم محفوظة؛ جارٍ التحقق من وجود تحديث.', 'info');
    } else if (!cache) {
      setStatus('جارٍ تحميل مواقيت الصلاة للمدينة المحددة…', 'info');
    }

    if (requestController) requestController.abort();
    requestController = typeof AbortController === 'function' ? new AbortController() : null;
    var timeout = requestController
      ? setTimeout(function () {
          requestController.abort();
        }, 12000)
      : null;
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
      var date =
        String(now.getDate()).padStart(2, '0') +
        '-' +
        String(now.getMonth() + 1).padStart(2, '0') +
        '-' +
        now.getFullYear();
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
      if (!result || !result.timings || !result.timings.Fajr)
        throw new Error('بيانات مواقيت الصلاة غير مكتملة');
      var saved = {
        timings: result.timings,
        hijri: (result.date && result.date.hijri) || null,
        day: today,
        lat: lat,
        lng: lng,
        place: place,
        city: city.name
      };
      drawTimes(saved, false);
      var persisted = writeCache(city.id, saved);
      setStatus(
        persisted
          ? 'حُدّثت المواقيت وحُفظت على هذا الجهاز دون إنترنت.'
          : 'تم تحميل المواقيت، لكن تعذر حفظها على هذا الجهاز.',
        persisted ? 'success' : 'warning'
      );
    } catch (error) {
      if (requestId !== activeRequestId || !activeContainer) return;
      if (error && error.name === 'AbortError' && !activeContainer) return;
      if (cache && cache.timings && cache.day === today) {
        drawTimes(cache, false);
        setStatus('تعذر الاتصال؛ نعرض مواقيت اليوم المحفوظة دون إنترنت.', 'warning');
      } else if (cache && cache.timings) {
        drawTimes(cache, true);
        setStatus(
          'لا يتوفر اتصال لتحديث مواقيت اليوم. المعروض آخر حفظ من ' + (cache.day || 'يوم سابق') + '.',
          'warning'
        );
      } else {
        setStatus(
          cacheReadFailed
            ? 'تعذرت قراءة المواقيت المحفوظة، ولم يتم استبدالها. تحقق من الاتصال ثم أعد المحاولة.'
            : 'تعذر جلب المواقيت. تحقق من الاتصال ثم أعد المحاولة.',
          'error'
        );
        var list = activeContainer && activeContainer.querySelector('[data-qpt-list]');
        if (list)
          list.innerHTML =
            '<div class="qpt-row"><span class="qpt-row-name">لم تُحمّل مواقيت اليوم بعد.</span></div>';
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
    requestPrayerStoragePersistence();
    removeUnusedAdhanCacheEntries().catch(function (error) {
      console.error('تعذر حذف تسجيلات الأذان غير المختارة من التخزين المؤقت.', error);
      setAlertStatus('تعذر حذف التسجيلات الصوتية القديمة من هذا الجهاز.', 'warning');
    });
    var city = selectedCity();
    container.innerHTML =
      '<section class="qpt" aria-label="مواقيت الصلاة">' +
      '<header class="qpt-head"><div class="qpt-head-copy"><h2>صلواتي</h2><div class="qpt-date" data-qpt-date></div></div>' +
      '<label class="qpt-city-label">المدينة<select class="qpt-city" data-qpt-city aria-label="اختر المحافظة أو موقعك"></select></label></header>' +
      '<div class="qpt-hero"><div class="qpt-ring-wrap"><svg class="qpt-ring" viewBox="0 0 170 170" aria-hidden="true">' +
      '<circle class="qpt-ring-bg" cx="85" cy="85" r="75"></circle><circle class="qpt-ring-fg" data-qpt-ring cx="85" cy="85" r="75"></circle></svg>' +
      '<div class="qpt-ring-copy"><b class="qpt-next-label" data-qpt-next>جارٍ التجهيز</b><span class="qpt-countdown" data-qpt-countdown dir="ltr">--:--:--</span></div></div>' +
      '<div class="qpt-remaining">الوقت المتبقي للصلاة القادمة</div><div class="qpt-hijri" data-qpt-hijri></div></div>' +
      '<div class="qpt-status" data-qpt-status role="status" aria-live="polite"></div>' +
      '<div class="qpt-list" data-qpt-list aria-label="مواقيت الصلاة"></div>' +
      '<div class="qpt-adhan" data-qpt-adhan></div>' +
      '<div class="qpt-actions"><button type="button" class="qpt-retry" data-qpt-retry>تحديث المواقيت</button></div>' +
      '<p class="qpt-note">طريقة الحساب: الهيئة المصرية العامة للمساحة — قد تختلف المواقيت باختلاف الموقع المحلي.</p>' +
      '</section>';
    var adhanHost = container.querySelector('[data-qpt-adhan]');
    if (adhanHost && adhanCard) {
      adhanHost.appendChild(adhanCard);
      renderAdhanSettings();
    }
    var select = container.querySelector('[data-qpt-city]');
    select.innerHTML = CITIES.map(function (item) {
      return (
        '<option value="' +
        item.id +
        '"' +
        (item.id === city.id ? ' selected' : '') +
        '>' +
        escapeHtml(item.name) +
        '</option>'
      );
    }).join('');
    var dateElement = container.querySelector('[data-qpt-date]');
    dateElement.textContent = new Date().toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    activeStatus = onStatus || null;
    select.addEventListener('change', function () {
      try {
        localStorage.setItem(CITY_KEY, select.value);
      } catch (error) {
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


/* ======================================================================
 * 7. واجهة العبادة
 * واجهة الأذكار وتبويباتها.
 * ====================================================================== */
/* worship-ui.js */
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
    [
      'تنزيه الله يملأ الميزان — سبّح',
      'كل تسبيحة نخلة في الجنة',
      'سبحان الله وبحمده تحط الخطايا',
      'واصل — الملائكة تسبح معك'
    ],
    ['بالحمد تدوم النعم — احمد', 'الحمد لله تملأ الميزان', 'من حمد الله رضي عنه', 'احمد بقلبك قبل لسانك'],
    ['الله أكبر من كل هم — كبّر', 'تكبيرك يصغّر كل خوف', 'الله أكبر مما يشغلك', 'كبّر وارتقِ درجة'],
    ['أفضل الذكر — هلّل', 'كلمة التوحيد مفتاح الجنة', 'جدّد إيمانك مع كل مرة', 'خير ما قاله النبيون'],
    [
      'الاستغفار يفتح الأبواب — استغفر',
      'من لزم الاستغفار فُرّج همّه',
      'استغفر تُمحَ ذنوبك',
      'زد استغفارك يزد رزقك'
    ],
    [
      'صلاة واحدة بعشر — صلِّ على النبي ﷺ',
      'عشر صلوات تُدركك بها الشفاعة',
      'الصلاة عليه تفرّج الكروب',
      'صلاتك تبلغه ويرد السلام'
    ]
  ];
  var mic = $('worshipTasbeehMic');
  var hint = $('worshipTasbeehHint');
  var micWanted = false,
    micStream = null,
    audioContext = null,
    analyser = null,
    voiceTimer = null;
  var noiseFloor = 0.006,
    speaking = false,
    speakStart = 0,
    lastAbove = 0,
    aboveFrames = 0;
  var storageWarningShown = false;

  function arabicNumber(value) {
    return String(value).replace(/\d/g, function (digit) {
      return AR[digit];
    });
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
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      showStorageError('تعذر قراءة الإعداد المحفوظ: ' + key, error);
      return null;
    }
  }
  function writeStoredText(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return true;
    } catch (error) {
      showStorageError('تعذر حفظ الإعداد: ' + key, error);
      return false;
    }
  }
  function readStored(key) {
    try {
      return JSON.parse(readStoredText(key) || 'null');
    } catch (error) {
      console.error('تعذر قراءة البيانات المحفوظة: ' + key, error);
      return null;
    }
  }
  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      showStorageError('تعذر حفظ البيانات: ' + key, error);
      return false;
    }
  }

  function readTasbeehState() {
    var saved = readStored('mq.worshipTasbeeh');
    if (
      saved &&
      Number.isInteger(saved.index) &&
      Number.isInteger(saved.count) &&
      saved.index >= 0 &&
      saved.index < dhikrPhrases.length &&
      saved.count >= 0
    )
      return saved;
    return { index: 0, count: 0 };
  }
  function paintTasbeeh() {
    var state = readTasbeehState();
    var phrase = $('worshipDhikrPhrase');
    phrase.innerHTML = escapeHTML(dhikrPhrases[state.index]) + '<small>اضغط لتغيير الذكر</small>';
    $('worshipTasbeehCount').textContent = arabicNumber(state.count);
    $('worshipTasbeehMotivation').textContent =
      motivations[state.index][Math.floor(state.count / 3) % motivations[state.index].length];
    $('worshipCountButton').setAttribute(
      'aria-label',
      'زيادة عدّ ' + dhikrPhrases[state.index] + '؛ العدد ' + state.count
    );
  }
  function updateTasbeeh(change) {
    var state = readTasbeehState();
    change(state);
    writeStored('mq.worshipTasbeeh', state);
    paintTasbeeh();
  }
  $('worshipCountButton').addEventListener('click', function () {
    updateTasbeeh(function (state) {
      state.count++;
    });
  });
  $('worshipDhikrPhrase').addEventListener('click', function () {
    updateTasbeeh(function (state) {
      state.index = (state.index + 1) % dhikrPhrases.length;
      state.count = 0;
    });
  });
  function getAzkarList(categoryId) {
    return data.azkar[categoryId] || data.extra[categoryId] || [];
  }
  function readAzkarProgress() {
    var progress = readStored('mq.worshipAzkarProgress');
    if (!progress || progress.day !== todayKey() || !progress.counts || typeof progress.counts !== 'object') {
      progress = { day: todayKey(), counts: {} };
    }
    return progress;
  }
  function countsFor(categoryId, list, progress) {
    var counts = progress.counts[categoryId];
    if (!Array.isArray(counts) || counts.length !== list.length) {
      counts = list.map(function () {
        return 0;
      });
      progress.counts[categoryId] = counts;
    }
    return counts;
  }
  function playAzkarCompletionFeedback() {
    if (typeof navigator.vibrate === 'function') {
      try {
        if (navigator.vibrate(18)) return;
      } catch (error) {
        console.warn('تعذر تشغيل الاهتزاز عند إكمال الذكر.', error);
      }
    }

    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    var context;
    try {
      context = new AudioContextClass();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 660;
      gain.gain.setValueAtTime(0.035, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.onended = function () {
        context.close().catch(function (error) {
          console.error('تعذر إغلاق مؤثر إكمال الذكر الصوتي.', error);
        });
      };
      context
        .resume()
        .then(function () {
          oscillator.start();
          oscillator.stop(context.currentTime + 0.09);
        })
        .catch(function (error) {
          console.error('تعذر تشغيل مؤثر إكمال الذكر الصوتي.', error);
          context.close().catch(function (closeError) {
            console.error('تعذر إغلاق مؤثر إكمال الذكر الصوتي.', closeError);
          });
        });
    } catch (error) {
      console.error('تعذر تجهيز مؤثر إكمال الذكر الصوتي.', error);
      if (context && context.state !== 'closed') {
        context.close().catch(function (closeError) {
          console.error('تعذر إغلاق مؤثر إكمال الذكر الصوتي.', closeError);
        });
      }
    }
  }
  function animateAzkarCount(index, completed) {
    var item = azkarList.querySelector('[data-worship-azkar-item="' + index + '"]');
    var button = item && item.querySelector('.worship-azkar-action');
    if (!item || !button) return;
    button.classList.add('is-counting');
    window.setTimeout(function () {
      button.classList.remove('is-counting');
    }, 350);
    if (completed) {
      item.classList.add('just-completed');
      window.setTimeout(function () {
        item.classList.remove('just-completed');
      }, 650);
      playAzkarCompletionFeedback();
    }
  }
  function syncAzkarTask(list, counts) {
    var completed =
      list.length > 0 &&
      list.every(function (item, index) {
        return counts[index] >= Math.max(1, Number(item.c) || 1);
      });
    window.dispatchEvent(
      new CustomEvent('quran:azkar-progress', {
        detail: { categoryId: categoryId, completed: completed, day: todayKey() }
      })
    );
  }
  function selectedCategoryId() {
    var saved = readStoredText('mq.worshipAzkarCategory');
    if (
      data.categories.some(function (category) {
        return category.id === saved;
      })
    )
      return saved;
    var preferred = new Date().getHours() < 12 ? 'morning' : 'evening';
    return data.categories.some(function (category) {
      return category.id === preferred;
    })
      ? preferred
      : data.categories[0].id;
  }
  var categoryId = selectedCategoryId();
  var categoryTrigger = $('worshipAzkarCategoryTrigger');
  var categoryWrap = $('worshipAzkarCategories');
  var categoryList = $('worshipAzkarCategoryList');
  var azkarList = $('worshipAzkarList');
  var categoryCloseTimer = 0;
  var azkarTouchStart = null;
  var azkarSwipeClickBlock = null;
  function paintCategoryOptions() {
    categoryList.innerHTML = data.categories
      .map(function (category) {
        return (
          '<button type="button" class="azkar-category-option" data-worship-category="' +
          escapeHTML(category.id) +
          '" aria-pressed="' +
          (category.id === categoryId) +
          '">' +
          '<span aria-hidden="true">' +
          escapeHTML(category.ico) +
          '</span><span>' +
          escapeHTML(category.title) +
          '</span><small>' +
          arabicNumber(getAzkarList(category.id).length) +
          ' أذكار</small></button>'
        );
      })
      .join('');
  }
  function paintAzkar() {
    var category = data.categories.find(function (item) {
      return item.id === categoryId;
    });
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
      syncAzkarTask(list, counts);
      return;
    }

    azkarList.innerHTML =
      list
        .map(function (item, index) {
          var target = Math.max(1, Number(item.c) || 1);
          var current = counts[index];
          var remaining = target - current;
          var done = remaining === 0;
          var active = index === activeIndex;
          var showSkip = !done && target > 10;
          return (
            '<article class="worship-azkar-item' +
            (done ? ' is-complete' : '') +
            (active ? ' is-active' : '') +
            '" data-worship-azkar-item="' +
            index +
            '">' +
            '<div class="worship-azkar-top"><span class="worship-azkar-number">' +
            (done ? '✓' : arabicNumber(index + 1)) +
            '</span>' +
            (active ? '<span class="worship-azkar-remaining">الذكر الحالي</span>' : '') +
            '</div>' +
            '<div class="worship-azkar-text">' +
            escapeHTML(item.t) +
            '</div>' +
            '<div class="worship-azkar-footer">' +
            (item.v
              ? '<span class="worship-azkar-benefit">' + escapeHTML(item.v) + '</span>'
              : '<span class="worship-azkar-benefit"></span>') +
            (showSkip
              ? '<button type="button" class="worship-azkar-skip" data-worship-azkar-skip="' +
                index +
                '" aria-label="تخطي هذا الذكر">⏭ تخطي</button>'
              : '') +
            '<span class="worship-azkar-count">' +
            (done ? 'اكتمل' : 'باقي ' + arabicNumber(remaining)) +
            '</span><button type="button" class="worship-azkar-action" data-worship-azkar-count="' +
            index +
            '" aria-label="' +
            (done ? 'إعادة الذكر' : 'تسجيل تكرار') +
            '">' +
            (done ? '✓' : arabicNumber(remaining)) +
            '</button></div></article>'
          );
        })
        .join('') +
      (activeIndex === -1
        ? '<div class="worship-complete">🤲 تقبّل الله منك — أتممت ' +
          escapeHTML(category ? category.title : 'الأذكار') +
          '<br><small>اللهم أعنا على ذكرك وشكرك وحسن عبادتك</small></div>'
        : '');
    syncAzkarTask(list, counts);
  }

  categoryTrigger.addEventListener('click', function () {
    var expanded = categoryTrigger.getAttribute('aria-expanded') === 'true';
    categoryTrigger.setAttribute('aria-expanded', String(!expanded));
    if (categoryCloseTimer) window.clearTimeout(categoryCloseTimer);
    categoryWrap.hidden = false;
    categoryWrap.classList.toggle('open', !expanded);
    if (expanded)
      categoryCloseTimer = window.setTimeout(function () {
        if (categoryTrigger.getAttribute('aria-expanded') === 'false') categoryWrap.hidden = true;
      }, 300);
  });
  categoryList.addEventListener('click', function (event) {
    var button = event.target.closest('[data-worship-category]');
    if (!button) return;
    var nextCategory = button.getAttribute('data-worship-category');
    if (
      !data.categories.some(function (item) {
        return item.id === nextCategory;
      })
    )
      return;
    categoryId = nextCategory;
    writeStoredText('mq.worshipAzkarCategory', categoryId);
    if (categoryCloseTimer) window.clearTimeout(categoryCloseTimer);
    categoryTrigger.setAttribute('aria-expanded', 'false');
    categoryWrap.classList.remove('open');
    categoryCloseTimer = window.setTimeout(function () {
      categoryWrap.hidden = true;
    }, 300);
    paintAzkar();
  });
  azkarList.addEventListener(
    'touchstart',
    function (event) {
      if (event.touches.length !== 1) {
        azkarTouchStart = null;
        return;
      }
      var target = event.target;
      var card = target.closest('[data-worship-azkar-item]');
      if (!card || target.closest('button')) {
        azkarTouchStart = null;
        return;
      }
      azkarTouchStart = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        card: card
      };
    },
    { passive: true }
  );
  azkarList.addEventListener(
    'touchend',
    function (event) {
      if (!azkarTouchStart || event.changedTouches.length !== 1) {
        azkarTouchStart = null;
        return;
      }
      var start = azkarTouchStart;
      azkarTouchStart = null;
      var touch = event.changedTouches[0];
      var deltaY = start.y - touch.clientY;
      var deltaX = Math.abs(start.x - touch.clientX);
      if (deltaY < 34 || deltaX > 56) return;

      var nextCard = start.card.nextElementSibling;
      if (!nextCard || !nextCard.matches('[data-worship-azkar-item]')) return;
      azkarSwipeClickBlock = { cards: [start.card, nextCard], until: Date.now() + 250 };
      nextCard.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'nearest'
      });
      nextCard.classList.remove('is-swipe-target');
      void nextCard.offsetWidth;
      nextCard.classList.add('is-swipe-target');
      window.setTimeout(function () {
        nextCard.classList.remove('is-swipe-target');
      }, 500);
    },
    { passive: true }
  );
  azkarList.addEventListener(
    'touchcancel',
    function () {
      azkarTouchStart = null;
    },
    { passive: true }
  );
  azkarList.addEventListener('click', function (event) {
    var clickedCard = event.target.closest('[data-worship-azkar-item]');
    if (
      azkarSwipeClickBlock &&
      Date.now() < azkarSwipeClickBlock.until &&
      event.detail > 0 &&
      azkarSwipeClickBlock.cards.indexOf(clickedCard) !== -1
    ) {
      azkarSwipeClickBlock = null;
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    var skip = event.target.closest('[data-worship-azkar-skip]');
    var action = event.target.closest('[data-worship-azkar-count]');
    var card = event.target.closest('[data-worship-azkar-item]');
    var index = Number(
      (skip || action || card || {}).dataset &&
        (skip || action || card).dataset[
          skip ? 'worshipAzkarSkip' : action ? 'worshipAzkarCount' : 'worshipAzkarItem'
        ]
    );
    var list = getAzkarList(categoryId);
    if (!Number.isInteger(index) || !list[index]) return;
    var progress = readAzkarProgress();
    var counts = countsFor(categoryId, list, progress);
    var target = Math.max(1, Number(list[index].c) || 1);
    var completedByPress = !skip && counts[index] < target && counts[index] + 1 >= target;
    if (skip) counts[index] = target;
    else if (counts[index] >= target) counts[index] = 0;
    else counts[index]++;
    writeStored('mq.worshipAzkarProgress', progress);
    paintAzkar();
    if (action) animateAzkarCount(index, completedByPress);
  });
  function stopVoiceCount() {
    if (voiceTimer) window.clearInterval(voiceTimer);
    voiceTimer = null;
    if (micStream)
      micStream.getTracks().forEach(function (track) {
        track.stop();
      });
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
      hint.textContent =
        error && error.name === 'NotAllowedError'
          ? 'لم يُسمح بالميكروفون. فعّل الإذن من إعدادات المتصفح ثم حاول مجددًا.'
          : 'تعذّر تشغيل الميكروفون. تحقق من توصيله ثم حاول مجددًا.';
      console.error('تعذر بدء العدّ الصوتي', error);
      return;
    }
    if (
      !micWanted ||
      document.hidden ||
      $('paneWorship').hidden ||
      !document.body.classList.contains('open')
    ) {
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
      return;
    }
    var AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
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
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
        await context.close();
        return;
      }
      micStream = stream;
      audioContext = context;
      analyser = analyzer;
    } catch (error) {
      stream.getTracks().forEach(function (track) {
        track.stop();
      });
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
          updateTasbeeh(function (state) {
            state.count++;
          });
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
    if (view !== 'azkar' && view !== 'tasbeeh') view = 'azkar';
    var isAzkar = view === 'azkar';
    var isTasbeeh = view === 'tasbeeh';
    $('worshipAzkar').hidden = !isAzkar;
    $('worshipTasbeeh').hidden = !isTasbeeh;
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
  var savedView = readStoredText('mq.worshipView');
  setWorshipView(savedView === 'tasbeeh' ? savedView : 'azkar');
})();


/* ======================================================================
 * 8. الأوفلاين وPWA
 * تنزيل ملفات المصحف للعمل دون إنترنت، زر التثبيت، تسجيل الـ service worker، التحكم بالتجويد.
 * ====================================================================== */
/* ---------- offline: on first open, download every Quran text/font so the Mushaf works without internet ---------- */
(function () {
  var runtime = window.MushafRuntime;
  if (!runtime) throw new Error('Mushaf runtime is unavailable');
  var $ = runtime.$,
    store = runtime.store;
  var toast = runtime.toast;
  // ملفات المصحف الثقيلة تُحفظ في كاش مستقل عن إصدار التطبيق (يطابق ASSET_CACHE في sw.js)
  // حتى لا تُحذف الخطوط مع كل تحديث. يُغيَّر الرقم فقط إذا تغيّرت ملفات الخطوط نفسها.
  var CACHE = runtime.assetCacheName,
    DONE_KEY = 'mq.offlineReady',
    AR = '٠١٢٣٤٥٦٧٨٩',
    VER = '78';
  function ar(n) {
    return String(n).replace(/\d/g, function (d) {
      return AR[d];
    });
  }
  // ملفات التطبيق الصغيرة يحفظها الـ service worker نفسه؛ هنا الثقيلة فقط.
  var urls = (function () {
    var a = ['./meanings.json'];
    for (var i = 1; i <= 47; i++) a.push('./fonts/QCF4_Hafs_' + (i < 10 ? '0' : '') + i + '_W.woff2');
    a.push('./fonts/QCF4_QBSML.woff2');
    return a;
  })();
  /* طلب تخزين دائم: يمنع المتصفح من حذف الخطوط تلقائيًا عند امتلاء مساحة الجهاز. */
  function requestPersistentStorage() {
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
    } catch (e) {}
  }
  requestPersistentStorage();
  var chip = document.getElementById('dlChip'),
    bar = document.getElementById('dlBar'),
    pct = document.getElementById('dlPct'),
    lbl = document.getElementById('dlLabel');
  var done = 0,
    running = false,
    runningPromise = null,
    failed = [],
    firstError = '';

  function markDone() {
    try {
      localStorage.setItem(DONE_KEY, VER);
    } catch (e) {}
  }
  function update() {
    var p = Math.round((done / urls.length) * 100);
    if (bar) bar.style.width = p + '%';
    if (pct) pct.textContent = ar(p) + '٪';
  }
  function show() {
    if (chip) {
      chip.hidden = false;
      update();
    }
  }
  function hideLater(ms) {
    setTimeout(function () {
      if (chip) chip.hidden = true;
    }, ms);
  }
  function finish() {
    done = urls.length;
    update();
    if (lbl) lbl.textContent = 'اكتمل حفظ ملفات المصحف — أصبح جاهزًا دون إنترنت';
    hideLater(2600);
  }
  function fail(have) {
    var msg =
      (typeof have === 'number' ? 'تم تحميل ' + ar(have) + ' من ' + ar(urls.length) + ' — ' : '') +
      'سيُستأنف التحميل تلقائيًا عند الفتح التالي';
    if (firstError) msg += ' — ' + firstError;
    if (lbl) lbl.textContent = msg;
    hideLater(6000);
  }

  function grab(cache, url) {
    return fetch(url).then(
      function (r) {
        if (!r || !(r.ok || r.type === 'opaque')) throw new Error('HTTP ' + (r && r.status));
        return cache.put(url, r.clone()).catch(function (e) {
          throw new Error('cache:' + ((e && e.message) || e));
        });
      },
      function (e) {
        throw new Error('net:' + ((e && e.message) || e));
      }
    );
  }
  function grabTwice(cache, url) {
    return grab(cache, url).catch(function () {
      return grab(cache, url).catch(function (e) {
        if (!firstError) firstError = url.replace('./', '') + ' — ' + ((e && e.message) || String(e));
        throw e;
      });
    });
  }

  function download(cache, queue) {
    return new Promise(function (resolve) {
      function next() {
        if (!queue.length) return Promise.resolve();
        var url = queue.shift();
        return grabTwice(cache, url)
          .then(
            function () {
              done++;
              update();
            },
            function (e) {
              failed.push({ url: url, err: (e && e.message) || String(e) });
            }
          )
          .then(next);
      }
      var workers = [];
      for (var i = 0; i < 4; i++) workers.push(next());
      Promise.all(workers).then(resolve);
    });
  }
  function cached(cache, u) {
    var opts = { ignoreSearch: true, ignoreVary: true };
    return cache.match(u, opts).then(function (m) {
      return !!m;
    });
  }
  function verify(cache) {
    return Promise.all(
      urls.map(function (u) {
        return cached(cache, u);
      })
    ).then(function (hits) {
      return hits.filter(Boolean).length;
    });
  }
  function startUI(queue) {
    done = urls.length - queue.length;
    show();
    return queue;
  }

  function run() {
    if (running) return runningPromise;
    if ((location.protocol !== 'http:' && location.protocol !== 'https:') || !('caches' in window)) {
      return Promise.resolve(true);
    }
    running = true;
    failed = [];
    firstError = '';
    runningPromise = caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          urls.map(function (url) {
            return cached(cache, url);
          })
        ).then(function (hits) {
          done = hits.filter(Boolean).length;
          if (done === urls.length) {
            update();
            markDone();
            return;
          }
          var queue = urls.filter(function (url, index) {
            return !hits[index];
          });
          startUI(queue);
          return download(cache, queue).then(function () {
            if (failed.length) {
              var firstFailed = failed[0];
              throw new Error('تعذر تنزيل ' + firstFailed.url + ' — ' + firstFailed.err);
            }
            return verify(cache).then(function (verified) {
              if (verified !== urls.length)
                throw new Error('اكتمل التنزيل جزئيًا فقط (' + verified + ' من ' + urls.length + ' ملفًا)');
              markDone();
              finish();
            });
          });
        });
      })
      .catch(function (error) {
        running = false;
        fail(done);
        throw error;
      })
      .then(
        function (result) {
          running = false;
          return result;
        },
        function (error) {
          running = false;
          throw error;
        }
      );
    return runningPromise;
  }

  /* keep the service worker (offline cache) alive even when the Mushaf is opened directly */
  var installButton = $('installAppButton'),
    installHelp = $('installAppHelp');
  var installPromptEvent = null;
  function isInstalledApp() {
    return (
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      navigator.standalone === true
    );
  }
  function syncInstallButton() {
    if (isInstalledApp()) {
      installButton.disabled = true;
      installButton.textContent = 'التطبيق مثبت بالفعل';
      installHelp.textContent = 'يمكنك فتح Huda هدى من شاشة التطبيقات.';
    } else {
      installButton.disabled = false;
      installButton.textContent = installPromptEvent ? 'تثبيت التطبيق' : 'كيفية تثبيت التطبيق';
    }
  }
  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPromptEvent = event;
    installHelp.textContent = 'التطبيق جاهز للتثبيت على جهازك.';
    syncInstallButton();
  });
  window.addEventListener('appinstalled', function () {
    installPromptEvent = null;
    syncInstallButton();
    toast('تم تثبيت Huda هدى');
  });
  installButton.addEventListener('click', function () {
    if (isInstalledApp()) {
      syncInstallButton();
      return;
    }
    if (installPromptEvent) {
      var promptEvent = installPromptEvent;
      installPromptEvent = null;
      promptEvent.prompt();
      promptEvent.userChoice.then(
        function (choice) {
          if (choice.outcome === 'accepted') toast('جارٍ تثبيت Huda هدى');
          else toast('يمكنك تثبيت التطبيق لاحقًا من هنا');
          syncInstallButton();
        },
        function (error) {
          console.error('Unable to show the app installation prompt:', error);
          toast('تعذر فتح نافذة التثبيت؛ استخدم قائمة المتصفح');
          syncInstallButton();
        }
      );
      return;
    }
    if (
      location.protocol !== 'https:' &&
      location.hostname !== 'localhost' &&
      location.hostname !== '127.0.0.1'
    ) {
      installHelp.textContent = 'يتطلب التثبيت فتح التطبيق عبر HTTPS أو localhost، وليس من ملف محلي.';
      toast('افتح التطبيق عبر HTTPS أو localhost لتثبيته');
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.MSStream) {
      installHelp.textContent = 'في Safari اضغط «مشاركة»، ثم اختر «إضافة إلى الشاشة الرئيسية».';
      toast('من Safari اختر مشاركة ثم إضافة إلى الشاشة الرئيسية');
    } else {
      installHelp.textContent = 'من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».';
      toast('استخدم قائمة المتصفح لتثبيت التطبيق');
    }
  });
  syncInstallButton();
  /* ---- فتح المصحف ----
   * مبدأ مهم: فتح المصحف لا يتوقف على نجاح «نسخة الأوفلاين». حفظ الملفات (run) عملية خلفية
   * قد تفشل جزئيًا (شبكة ضعيفة، مساحة تخزين) دون أن تمنع القراءة؛ بينما التحقق الفعلي من أن
   * خطوط المصحف تُحمَّل يتم داخل runtime.openWhenReady. وإن تعذر ذلك يُفتح النص المبسّط. */
  function saveOfflineCopy() {
    return run().catch(function (error) {
      console.warn('تعذر حفظ نسخة الأوفلاين كاملة حاليًا؛ ستُستأنف لاحقًا:', error);
      return null;
    });
  }

  var quranTextDownload = $('quranTextDownload');
  var retryingQuran = false;
  // هل ملفات خطوط المصحف متاحة فعلًا الآن؟ (نفحص أول وآخر خط بدل تنزيل الكل مرة ثانية)
  function fontsReachable() {
    var fontUrls = urls.filter(function (u) {
      return u.indexOf('./fonts/') === 0;
    });
    return Promise.all(
      [fontUrls[0], fontUrls[fontUrls.length - 1]].map(function (u) {
        return fetch(u, { cache: 'no-cache' }).then(
          function (r) {
            return r.ok;
          },
          function () {
            return false;
          }
        );
      })
    ).then(function (flags) {
      return flags.every(Boolean);
    });
  }
  function retryQuranFiles(silent) {
    if (retryingQuran) return Promise.resolve(false);
    retryingQuran = true;
    quranTextDownload.disabled = true;
    quranTextDownload.textContent = 'جارٍ التنزيل…';
    /* في النص المبسّط: المتصفح يتذكر أن الخط فشل تحميله ولا يعيد المحاولة داخل الصفحة نفسها،
     * لذلك إذا أصبحت الخطوط متاحة نُعيد تحميل الصفحة لتبدأ نظيفة بالمصحف الكامل. */
    var attemptRun = runtime.isTextMode()
      ? saveOfflineCopy()
          .then(fontsReachable)
          .then(function (reachable) {
            if (!reachable) return false;
            if (!silent) toast('اكتمل تنزيل الخطوط؛ جارٍ فتح المصحف الكامل');
            setTimeout(function () {
              location.reload();
            }, 500);
            return true;
          })
      : runtime.openWhenReady(saveOfflineCopy(), true);
    return attemptRun
      .then(function (ready) {
        if (ready) {
          runtime.hideNotice();
          if (!silent) toast('اكتمل تنزيل ملفات المصحف');
          return true;
        }
        showSafeModeNotice();
        return false;
      })
      .catch(function (error) {
        console.error('تعذر إعادة تنزيل ملفات المصحف:', error);
        showSafeModeNotice();
        return false;
      })
      .then(function (ready) {
        retryingQuran = false;
        quranTextDownload.disabled = false;
        quranTextDownload.textContent = 'إعادة المحاولة';
        return ready;
      });
  }
  quranTextDownload.addEventListener('click', function () {
    retryQuranFiles(false);
  });
  // عند عودة الإنترنت نكمل تلقائيًا إن كنا في النص المبسّط.
  window.addEventListener('online', function () {
    if (runtime.isTextMode()) retryQuranFiles(true);
  });

  function showSafeModeNotice() {
    var reason = firstError || runtime.getLoadError();
    var offline = navigator.onLine === false;
    runtime.showNotice(
      offline
        ? 'لا يوجد اتصال بالإنترنت وخطوط المصحف غير محفوظة بعد. تعمل الآن بنص الآيات المبسّط، وسيكتمل المصحف تلقائيًا عند عودة الاتصال.'
        : 'تعذر تحميل خطوط المصحف، فتعمل الآن بنص الآيات المبسّط. اضغط «إعادة المحاولة» لتحميلها.',
      { title: 'تعمل بالنص المبسّط', compact: true, detail: reason }
    );
  }

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.protocol === 'http:')) {
    navigator.serviceWorker.register('./sw.js').catch(function (error) {
      console.error('Unable to register the Huda service worker:', error);
      installHelp.textContent = 'تعذر تجهيز التثبيت في هذا المتصفح. افتح الصفحة عبر HTTPS أو localhost.';
    });
  }

  var OPEN_ATTEMPTS = 3;
  function prepareAndOpen() {
    function attempt(number) {
      return runtime.openWhenReady(saveOfflineCopy(), true).then(function (ready) {
        if (ready) return true;
        if (number >= OPEN_ATTEMPTS) return false;
        runtime.updateLoading(1, 'تعذّر تجهيز بعض الملفات؛ جارٍ إعادة المحاولة تلقائيًا…');
        return new Promise(function (resolve) {
          setTimeout(resolve, number * 1500);
        }).then(function () {
          return attempt(number + 1);
        });
      });
    }
    function enterSafeMode(error) {
      if (error) console.error('تعذر تجهيز المصحف الكامل:', error);
      runtime.openTextMode();
      showSafeModeNotice();
    }
    attempt(1).then(function (ready) {
      if (!ready) enterSafeMode();
    }, enterSafeMode);
  }
  if (document.readyState === 'complete') setTimeout(prepareAndOpen, 400);
  else
    window.addEventListener('load', function () {
      setTimeout(prepareAndOpen, 400);
    });

  /* ==================== دوال التحكم بالتجويد ==================== */
  function updateTajweedUI() {
    var coloredMushaf = runtime.isTajweedOn();
    var fontStrokeCard = $('fontStrokeCard');
    if (fontStrokeCard) fontStrokeCard.hidden = coloredMushaf;
    var legendSettingsCard = $('tajweedLegendSettingsCard');
    if (legendSettingsCard) legendSettingsCard.hidden = !coloredMushaf;
    if (coloredMushaf && (currentFontStroke > 0 || parseFloat(store('mq.stroke')) > 0)) {
      setFontStroke('0', 'عادي');
    }
    var btn = $('bTajweedToggle');
    if (btn) {
      btn.classList.toggle('active', runtime.isTajweedOn());
      btn.setAttribute('aria-pressed', String(runtime.isTajweedOn()));
      btn.title = runtime.isTajweedOn()
        ? 'ألوان التجويد (مفعّلة) — اضغط للإيقاف'
        : 'ألوان التجويد (معطّلة) — اضغط للتفعيل';
    }
    var btnOn = $('btnTajweedOn'),
      btnOff = $('btnTajweedOff'),
      lbl = $('tajweedModeLabel');
    if (btnOn && btnOff) {
      btnOn.classList.toggle('active', runtime.isTajweedOn());
      btnOn.setAttribute('aria-pressed', String(runtime.isTajweedOn()));
      btnOff.classList.toggle('active', !runtime.isTajweedOn());
      btnOff.setAttribute('aria-pressed', String(!runtime.isTajweedOn()));
    }
    if (lbl) lbl.textContent = runtime.isTajweedOn() ? 'مفعّلة (ملوّن)' : 'معطّلة (عادي)';
    var legendVisible = runtime.isTajweedLegendVisible();
    var legendButton = $('btnTajweedLegendVisibility');
    var legendLabel = $('tajweedLegendVisibilityLabel');
    if (legendButton) {
      legendButton.classList.toggle('active', legendVisible);
      legendButton.setAttribute('aria-pressed', String(legendVisible));
      legendButton.textContent = legendVisible ? 'إخفاء مفتاح الألوان' : 'إظهار مفتاح الألوان';
    }
    if (legendLabel) legendLabel.textContent = legendVisible ? 'ظاهر' : 'مخفي';
    var barEl = $('tajweedLegendBar');
    if (barEl) barEl.hidden = true;
    document.querySelectorAll('.page-view .tajweed-legend-bar').forEach(function (legend) {
      legend.hidden = !(runtime.isTajweedOn() && legendVisible);
    });
  }

  /* التحكم في سمك خط المصحف */
  var currentFontStroke = 0;

  function applyFontStroke(num) {
    currentFontStroke = num;
    var pageWidth = $('page').clientWidth || window.innerWidth || 400;
    var strokeWidth = (num * 1.25 * pageWidth) / 400;
    var stroke = strokeWidth.toFixed(2) + 'px';
    document.body.style.setProperty('--quran-font-stroke', stroke);
    document.body.style.setProperty(
      '--quran-font-stroke-shadow',
      stroke +
        ' 0 currentColor, -' +
        stroke +
        ' 0 currentColor, 0 ' +
        stroke +
        ' currentColor, 0 -' +
        stroke +
        ' currentColor'
    );
    document.body.classList.toggle('quran-bold', num > 0);
  }

  function setFontStroke(strokeVal, label) {
    var parsed = parseFloat(strokeVal);
    var num = isFinite(parsed) ? Math.max(0, Math.min(1.5, parsed)) : 0;
    num = Math.round(num * 10) / 10;
    var selectedButton = document.querySelector('#fontStrokeGroup .st-btn[data-stroke="' + num + '"]');
    label =
      label ||
      (selectedButton && selectedButton.getAttribute('data-label')) ||
      (num === 0 ? 'عادي' : num <= 0.4 ? 'متوسط' : 'عريض');
    applyFontStroke(num);
    store('mq.stroke', String(num));
    store('mq.strokeLabel', label);
    var lbl = $('strokeValLabel');
    if (lbl) lbl.textContent = label + (num ? ' · ' + ar(num.toFixed(1)) + 'px' : '');
    document.querySelectorAll('#fontStrokeGroup .st-btn').forEach(function (b) {
      var s = parseFloat(b.getAttribute('data-stroke')) || 0;
      var match = Math.abs(s - num) < 0.05;
      b.classList.toggle('active', match);
      b.setAttribute('aria-pressed', String(match));
    });
  }

  window.addEventListener('resize', function () {
    applyFontStroke(currentFontStroke);
  });

  /* نافذة والموافقة على تحميل خطوط التجويد */
  var tajweedDlModal = $('tajweedDlModal');
  var tajweedDlPromptView = $('tajweedDlPromptView');
  var tajweedDlProgressView = $('tajweedDlProgressView');
  var tajweedDlProgressBar = $('tajweedDlProgressBar');
  var tajweedDlStatusText = $('tajweedDlStatusText');
  var tajweedDlCountText = $('tajweedDlCountText');
  var tajweedDlPctText = $('tajweedDlPctText');
  var tajweedDlErrorBox = $('tajweedDlErrorBox');
  var tajweedDlErrorMessage = $('tajweedDlErrorMessage');
  var isTajweedDlRunning = false;

  function openTajweedDlModal() {
    if (!tajweedDlModal) return;
    if (tajweedDlPromptView) tajweedDlPromptView.hidden = false;
    if (tajweedDlProgressView) tajweedDlProgressView.hidden = true;
    if (tajweedDlErrorBox) tajweedDlErrorBox.hidden = true;
    tajweedDlModal.hidden = false;
    tajweedDlModal.setAttribute('aria-hidden', 'false');
  }

  function closeTajweedDlModal() {
    if (isTajweedDlRunning) {
      if (!confirm('جارٍ تحميل ملفات التجويد، هل تريد التوقف؟')) return;
      isTajweedDlRunning = false;
    }
    if (tajweedDlModal) {
      tajweedDlModal.hidden = true;
      tajweedDlModal.setAttribute('aria-hidden', 'true');
    }
    updateTajweedUI();
  }

  function startTajweedDownload() {
    if (isTajweedDlRunning) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      alert('افتح التطبيق عبر خادم محلي (localhost) أو HTTPS ليتمكن المتصفح من حفظ الملفات.');
      return;
    }
    if (!navigator.onLine) {
      alert('يرجى الاتصال بالإنترنت لتحميل ملفات المصحف الملون لأول مرة.');
      return;
    }
    if (!('caches' in window)) {
      alert('هذا المتصفح لا يدعم التخزين بدون إنترنت.');
      return;
    }

    if (tajweedDlPromptView) tajweedDlPromptView.hidden = true;
    if (tajweedDlProgressView) tajweedDlProgressView.hidden = false;
    if (tajweedDlErrorBox) tajweedDlErrorBox.hidden = true;
    isTajweedDlRunning = true;

    var tajweedUrls = [];
    for (var chunk = 0; chunk <= 60; chunk++) {
      tajweedUrls.push('./fonts/tajweed/c' + (chunk < 10 ? '0' : '') + chunk + '.woff2');
    }

    var total = tajweedUrls.length;
    var completed = 0;
    var failed = false;

    caches
      .open(CACHE)
      .then(function (cache) {
        return Promise.all(
          tajweedUrls.map(function (u) {
            return cache.match(u, { ignoreSearch: true, ignoreVary: true }).then(function (m) {
              return !!m;
            });
          })
        ).then(function (hits) {
          var queue = [];
          tajweedUrls.forEach(function (u, idx) {
            if (hits[idx]) completed++;
            else queue.push(u);
          });

          function updateDlUI() {
            var p = Math.round((completed / total) * 100);
            if (tajweedDlProgressBar) tajweedDlProgressBar.style.width = p + '%';
            if (tajweedDlPctText) tajweedDlPctText.textContent = ar(p) + '٪';
            if (tajweedDlCountText)
              tajweedDlCountText.textContent = ar(completed) + ' من ' + ar(total) + ' ملفاً';
            if (tajweedDlStatusText)
              tajweedDlStatusText.textContent =
                'جارٍ تحميل وحفظ ملفات التجويد (' + ar(completed) + ' / ' + ar(total) + ')...';
          }

          updateDlUI();

          if (queue.length === 0) {
            finishDl();
            return;
          }

          function fetchNext() {
            if (!isTajweedDlRunning || failed) return Promise.resolve();
            if (queue.length === 0) return Promise.resolve();
            var url = queue.shift();
            return fetch(url)
              .then(function (res) {
                if (!res || !res.ok)
                  throw new Error('فشل جلب ملف الخط (HTTP ' + (res ? res.status : '?') + ')');
                return cache.put(url, res.clone()).then(function () {
                  completed++;
                  updateDlUI();
                });
              })
              .then(fetchNext);
          }

          var workers = [];
          for (var w = 0; w < 4; w++) workers.push(fetchNext());

          return Promise.all(workers).then(function () {
            if (failed || !isTajweedDlRunning) return;
            if (completed === total) {
              finishDl();
            } else {
              throw new Error('لم يكتمل تحميل كافة الملفات (' + completed + ' من ' + total + ')');
            }
          });
        });
      })
      .catch(function (err) {
        if (!isTajweedDlRunning) return;
        failed = true;
        isTajweedDlRunning = false;
        if (tajweedDlErrorBox) {
          tajweedDlErrorBox.hidden = false;
          if (tajweedDlErrorMessage) {
            tajweedDlErrorMessage.textContent =
              'حدث خطأ: ' +
              ((err && err.message) || 'فشل التحميل') +
              ' — تم حفظ ' +
              ar(completed) +
              ' ملفاً حتى الآن.';
          }
        }
      });

    function finishDl() {
      isTajweedDlRunning = false;
      runtime.setTajweedDownloaded(true);
      if (tajweedDlStatusText) tajweedDlStatusText.textContent = '✅ اكتمل تحميل وحفظ خطوط التجويد بنجاح!';
      if (tajweedDlProgressBar) tajweedDlProgressBar.style.width = '100%';
      if (tajweedDlPctText) tajweedDlPctText.textContent = '١٠٠٪';
      setTimeout(function () {
        if (tajweedDlModal) tajweedDlModal.hidden = true;
        runtime.setTajweed(true);
        updateTajweedUI();
        toast('تم تفعيل المصحف الملوّن وحفظ ملفاته على جهازك دائماً.');
      }, 900);
    }
  }

  function toggleTajweed(force) {
    var targetState = typeof force === 'boolean' ? force : !runtime.isTajweedOn();
    if (targetState) {
      if (runtime.isTajweedDownloaded()) {
        runtime.setTajweed(true);
        updateTajweedUI();
        toast('تم تفعيل الخط الملوّن بأحكام التجويد (مجمع الملك فهد)');
      } else {
        openTajweedDlModal();
      }
    } else {
      runtime.setTajweed(false);
      updateTajweedUI();
      toast('تم إيقاف ألوان التجويد (الخط العادي)');
    }
  }

  /* نافذة دليل أحكام التجويد */
  var tajweedModal = $('tajweedModal');
  var tajweedBody = $('tajweedBody');
  var currentTajweedTab = 'all';

  function openTajweedGuide(ruleId) {
    if (!tajweedModal) return;
    tajweedModal.hidden = false;
    tajweedModal.setAttribute('aria-hidden', 'false');
    if (ruleId && window.TajweedGuide && window.TajweedGuide.rules[ruleId]) {
      currentTajweedTab = window.TajweedGuide.rules[ruleId].category || 'all';
    } else if (ruleId) {
      currentTajweedTab = 'all';
    }
    renderTajweedGuide(currentTajweedTab, ruleId);
  }

  function closeTajweedGuide() {
    if (!tajweedModal) return;
    tajweedModal.hidden = true;
    tajweedModal.setAttribute('aria-hidden', 'true');
  }

  function renderTajweedGuide(tabKey, targetRuleId) {
    if (!tajweedBody || !window.TajweedGuide) return;
    var tajweedFilter = $('tajweedTabs');
    if (tajweedFilter && tajweedFilter.value !== tabKey) tajweedFilter.value = tabKey;
    var rulesObj = window.TajweedGuide.rules;
    var ruleKeys = Object.keys(rulesObj);
    if (tabKey && tabKey !== 'all') {
      ruleKeys = ruleKeys.filter(function (k) {
        return rulesObj[k].category === tabKey;
      });
    }

    tajweedBody.innerHTML = ruleKeys
      .map(function (k) {
        var r = rulesObj[k];
        var isHighlight = targetRuleId === k;
        return (
          '<details class="tajweed-rule-card ' +
          (isHighlight ? 'highlighted' : '') +
          '" id="ruleCard_' +
          r.id +
          '" ' +
          (isHighlight ? 'open ' : '') +
          'style="' +
          (isHighlight ? 'border-color:' + r.color + ';' : '') +
          '">' +
          '<summary aria-label="' +
          r.name +
          '، ' +
          r.harakat +
          '">' +
          '<div class="tajweed-rule-head">' +
          '<div class="tajweed-rule-title">' +
          '<span class="tajweed-rule-swatch" style="background:' +
          r.color +
          '"></span>' +
          '<span>' +
          r.name +
          '</span>' +
          '</div>' +
          '<span class="tajweed-rule-harakat">' +
          r.harakat +
          '</span>' +
          '</div><span class="tajweed-rule-chevron" aria-hidden="true"></span>' +
          '</summary><div class="tajweed-rule-content">' +
          '<div class="tajweed-rule-desc">' +
          r.desc +
          '</div>' +
          (r.types && r.types.length
            ? '<div class="tajweed-rule-types">' +
              r.types
                .map(function (t) {
                  return '<span class="tajweed-rule-type-pill">' + t + '</span>';
                })
                .join('') +
              '</div>'
            : '') +
          (r.examples && r.examples.length
            ? '<div class="tajweed-rule-examples">' +
              '<div class="tajweed-rule-examples-title">أمثلة قرآنية:</div>' +
              r.examples
                .map(function (ex) {
                  return (
                    '<div class="tajweed-example-item">' +
                    '<span class="tajweed-example-word">' +
                    ex.word +
                    '</span>' +
                    '<span class="tajweed-example-note">' +
                    ex.surah +
                    ' — ' +
                    ex.note +
                    '</span>' +
                    '</div>'
                  );
                })
                .join('') +
              '</div>'
            : '') +
          '</div></details>'
        );
      })
      .join('');
    tajweedBody.scrollTop = 0;

    if (targetRuleId) {
      setTimeout(function () {
        var targetEl = $('ruleCard_' + targetRuleId);
        if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }

  /* ربط الأحداث للأزرار الجديدة */
  var btnTajweed = $('bTajweedToggle');
  if (btnTajweed)
    btnTajweed.addEventListener('click', function () {
      toggleTajweed();
    });
  var btnTOn = $('btnTajweedOn'),
    btnTOff = $('btnTajweedOff');
  if (btnTOn)
    btnTOn.addEventListener('click', function () {
      toggleTajweed(true);
    });
  if (btnTOff)
    btnTOff.addEventListener('click', function () {
      toggleTajweed(false);
    });
  var btnLegendVisibility = $('btnTajweedLegendVisibility');
  if (btnLegendVisibility)
    btnLegendVisibility.addEventListener('click', function () {
      runtime.setTajweedLegendVisible(!runtime.isTajweedLegendVisible());
      updateTajweedUI();
      toast(
        runtime.isTajweedLegendVisible()
          ? 'تم إظهار مفتاح ألوان التجويد أعلى رقم الصفحة'
          : 'تم إخفاء مفتاح ألوان التجويد'
      );
    });

  var strokeGroup = $('fontStrokeGroup');
  if (strokeGroup) {
    strokeGroup.addEventListener('click', function (e) {
      var btn = e.target.closest('.st-btn');
      if (!btn) return;
      var stroke = btn.getAttribute('data-stroke') || '0';
      setFontStroke(stroke, btn.getAttribute('data-label'));
      toast('تم ضبط سُمْك الخط: ' + $('strokeValLabel').textContent);
    });
  }
  var initStroke = store('mq.stroke') || '0';
  if (initStroke === '0.6') initStroke = '0.4';
  else if (initStroke === '1.2' || initStroke === '0.5') initStroke = '0.6';
  setFontStroke(initStroke);

  var btnOpenGuide = $('openTajweedGuideBtn');
  if (btnOpenGuide)
    btnOpenGuide.addEventListener('click', function () {
      openTajweedGuide();
    });

  var btnCloseT = $('closeTajweedModal');
  if (btnCloseT) btnCloseT.addEventListener('click', closeTajweedGuide);

  if (tajweedModal) {
    tajweedModal.addEventListener('click', function (e) {
      if (e.target === tajweedModal) closeTajweedGuide();
    });
  }

  // تصفية أحكام التجويد حسب التصنيف
  var tajweedTabsEl = $('tajweedTabs');
  if (tajweedTabsEl) {
    tajweedTabsEl.addEventListener('change', function () {
      currentTajweedTab = tajweedTabsEl.value;
      renderTajweedGuide(currentTajweedTab);
    });
  }

  // النقر على عناصر دليل ألوان التجويد أسفل صفحات المصحف
  var barLegend = $('pageList');
  if (barLegend) {
    barLegend.addEventListener('click', function (e) {
      if (e.target.closest('.tajweed-legend-info-btn')) {
        openTajweedGuide();
        return;
      }
      var item = e.target.closest('[data-rule]');
      if (item) {
        var ruleId = item.getAttribute('data-rule');
        openTajweedGuide(ruleId);
      }
    });
  }

  // أحداث نافذة تحميل التجويد
  var btnCloseDl = $('closeTajweedDlModal'),
    btnCancelDl = $('btnCancelTajweedDl');
  if (btnCloseDl) btnCloseDl.addEventListener('click', closeTajweedDlModal);
  if (btnCancelDl) btnCancelDl.addEventListener('click', closeTajweedDlModal);
  var btnStartDl = $('btnStartTajweedDl');
  if (btnStartDl) btnStartDl.addEventListener('click', startTajweedDownload);
  var btnRetryDl = $('btnRetryTajweedDl');
  if (btnRetryDl) btnRetryDl.addEventListener('click', startTajweedDownload);
  if (tajweedDlModal) {
    tajweedDlModal.addEventListener('click', function (e) {
      if (e.target === tajweedDlModal) closeTajweedDlModal();
    });
  }

  // إغلاق النوافذ عند الضغط على Escape
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (tajweedModal && !tajweedModal.hidden) closeTajweedGuide();
      if (tajweedDlModal && !tajweedDlModal.hidden) closeTajweedDlModal();
    }
  });

  // تحديث حالة الواجهة الأولية للتجويد
  updateTajweedUI();
})();



/* ======================================================================
 * شاشة الاحتفال المشتركة: علامة صح متحركة + قصاصات ملوّنة + صوت تشجيع (celebrate.mp3)
 * window.QuranCelebrate.show({ title, message, stats:[[قيمة,وصف],..], button, sound })
 * ====================================================================== */
(function () {
  var overlay = null,
    raf = 0,
    audio = null,
    closeFn = null;
  var COLORS = ['#0e7c3a', '#d4a72c', '#2f9e6a', '#f2d06b', '#ffffff', '#6fcf97'];
  function esc(v) {
    return String(v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function burst(canvas) {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    var ctx = canvas.getContext('2d'),
      dpr = Math.min(2, window.devicePixelRatio || 1),
      W = (canvas.width = innerWidth * dpr),
      H = (canvas.height = innerHeight * dpr),
      parts = [],
      start = performance.now();
    for (var i = 0; i < 90; i++) {
      var ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      var sp = (6 + Math.random() * 9) * dpr;
      parts.push({
        x: W / 2,
        y: H * 0.42,
        vx: Math.cos(ang) * sp * (0.6 + Math.random()),
        vy: Math.sin(ang) * sp,
        w: (5 + Math.random() * 6) * dpr,
        h: (3 + Math.random() * 4) * dpr,
        r: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.4,
        c: COLORS[(Math.random() * COLORS.length) | 0]
      });
    }
    function frame(now) {
      var t = now - start;
      ctx.clearRect(0, 0, W, H);
      parts.forEach(function (p) {
        p.vy += 0.28 * dpr;
        p.vx *= 0.992;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - t / 3200);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (t < 3200 && overlay) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, W, H);
    }
    raf = requestAnimationFrame(frame);
  }
  function hide() {
    if (!overlay) return;
    cancelAnimationFrame(raf);
    if (audio) {
      try {
        audio.pause();
      } catch (e) {}
    }
    var el = overlay;
    overlay = null;
    el.classList.remove('is-in');
    setTimeout(function () {
      el.remove();
    }, 260);
    if (closeFn) {
      var fn = closeFn;
      closeFn = null;
      try {
        fn();
      } catch (e) {}
    }
  }
  function show(opts) {
    opts = opts || {};
    if (overlay) hide();
    var el = document.createElement('div');
    el.className = 'cel';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', opts.title || 'تهنئة');
    var stats = (opts.stats || [])
      .map(function (s) {
        return '<span><b>' + esc(s[0]) + '</b>' + esc(s[1]) + '</span>';
      })
      .join('');
    el.innerHTML =
      '<canvas aria-hidden="true"></canvas><div class="cel-card">' +
      '<svg class="cel-badge" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="40"/><path d="M26 43l11 11 21-23"/></svg>' +
      '<h2>' + esc(opts.title || 'مبارك!') + '</h2><p>' + esc(opts.message || '') + '</p>' +
      (stats ? '<div class="cel-stats">' + stats + '</div>' : '') +
      '<button type="button" class="cel-btn">' + esc(opts.button || 'متابعة') + '</button></div>';
    document.body.appendChild(el);
    overlay = el;
    closeFn = opts.onClose || null;
    el.querySelector('.cel-btn').addEventListener('click', hide);
    el.addEventListener('click', function (e) {
      if (e.target === el) hide();
    });
    el.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') hide();
    });
    requestAnimationFrame(function () {
      el.classList.add('is-in');
      el.querySelector('.cel-btn').focus();
      burst(el.querySelector('canvas'));
    });
    if (opts.sound !== false) {
      try {
        audio = audio || new Audio('./celebrate.mp3');
        audio.currentTime = 0;
        audio.volume = 0.8;
        var pr = audio.play();
        if (pr && pr.catch) pr.catch(function () {});
      } catch (e) {}
    }
  }
  window.QuranCelebrate = { show: show, hide: hide };
})();

/* ======================================================================
 * ختمتي: خطة ختمة بورد يومي + تذكير بالإشعارات + ربط بالمهام
 * ====================================================================== */
(function () {
  'use strict';
  var KEY = 'quran_khatma_v1',
    TOTAL = 604,
    POINTS = 3,
    TASK_EVENT = 'quran:khatma-task-sync';
  var PRESETS = [10, 15, 20, 30, 60];

  function pad(n) {
    return String(n).padStart(2, '0');
  }
  function dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function parseDay(k) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  }
  function diffDays(a, b) {
    return Math.round((parseDay(a) - parseDay(b)) / 86400000);
  }
  function ar(n) {
    return String(n).replace(/\d/g, function (d) {
      return '٠١٢٣٤٥٦٧٨٩'[d];
    });
  }
  function esc(v) {
    return String(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function norm(v) {
    v = v && typeof v === 'object' ? v : {};
    var a = v.active && typeof v.active === 'object' ? v.active : null;
    if (a) {
      a = {
        name: String(a.name || 'ختمة').slice(0, 40),
        start: parseDay(a.start) ? a.start : dayKey(),
        days: Math.min(365, Math.max(1, parseInt(a.days, 10) || 30)),
        read: Math.min(TOTAL, Math.max(0, parseInt(a.read, 10) || 0)),
        doneDates: Array.isArray(a.doneDates) ? a.doneDates.slice(-400) : [],
        added: Math.max(0, parseInt(a.added, 10) || 0),
        addedDay: a.addedDay || ''
      };
    }
    var r = v.remind && typeof v.remind === 'object' ? v.remind : {};
    return {
      active: a,
      history: Array.isArray(v.history) ? v.history.slice(0, 60) : [],
      remind: {
        enabled: r.enabled === true,
        time: /^\d{2}:\d{2}$/.test(r.time) ? r.time : '20:00',
        followup: r.followup !== false
      },
      taskOn: v.taskOn !== false
    };
  }
  var st = (function () {
    try {
      return norm(JSON.parse(localStorage.getItem(KEY) || 'null'));
    } catch (e) {
      return norm(null);
    }
  })();
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(st));
    } catch (e) {}
    if (window.HudaCloud && window.HudaCloud.queueSync) {
      try {
        window.HudaCloud.queueSync();
      } catch (e) {}
    }
  }
  function perDay(a) {
    return Math.ceil(TOTAL / a.days);
  }
  function doneToday(a) {
    return !!a && a.doneDates.indexOf(dayKey()) !== -1;
  }
  /* صفحات ورد اليوم: إن أُتمّ اليوم نعرض ما قُرئ اليوم، وإلا ما بعد آخر صفحة مقروءة */
  function wirdRange(a) {
    var pd = perDay(a);
    if (doneToday(a)) {
      var from = Math.max(1, a.read - a.added + 1);
      return [from, Math.max(from, a.read)];
    }
    var f = Math.min(TOTAL, a.read + 1);
    return [f, Math.min(TOTAL, a.read + pd)];
  }
  function streak(a) {
    if (!a) return 0;
    var d = new Date(),
      c = 0;
    if (a.doneDates.indexOf(dayKey(d)) === -1) d.setDate(d.getDate() - 1);
    while (a.doneDates.indexOf(dayKey(d)) !== -1) {
      c++;
      d.setDate(d.getDate() - 1);
    }
    return c;
  }
  function behind(a) {
    var elapsed = Math.max(0, diffDays(dayKey(), a.start)) + (doneToday(a) ? 1 : 0);
    var expected = Math.min(TOTAL, perDay(a) * elapsed);
    return Math.max(0, expected - a.read);
  }
  function wirdTitle() {
    var a = st.active;
    if (!a) return 'ورد الختمة';
    var r = wirdRange(a);
    return 'ورد الختمة: ص ' + ar(r[0]) + (r[1] > r[0] ? '–' + ar(r[1]) : '');
  }
  function syncTask() {
    var a = st.active;
    window.dispatchEvent(
      new CustomEvent(TASK_EVENT, {
        detail: {
          enabled: !!a && st.taskOn,
          title: wirdTitle(),
          points: POINTS,
          done: doneToday(a)
        }
      })
    );
  }

  /* ---------- إجراءات ---------- */
  var ui = null; // { root, say }
  function render() {
    if (ui) draw();
    drawHome();
  }
  /* بطاقة الصفحة الرئيسية أسفل قسم الخدمات */
  function drawHome() {
    var el = document.getElementById('khatmaHome');
    if (!el) return;
    var a = st.active,
      h;
    if (!a) {
      h =
        '<button type="button" class="kh-home kh-home-empty" data-app-service="khatma"><span class="kh-home-ico" aria-hidden="true">' + icon('book') + '</span>' +
        '<span class="kh-home-copy"><b>ختمتي</b><small>ابدأ ختمة بورد يومي ثابت وتذكير بالإشعارات</small></span>' +
        '<span class="kh-home-go">ابدأ ‹</span></button>';
    } else {
      var pct = Math.round((a.read / TOTAL) * 100),
        r = wirdRange(a),
        done = doneToday(a);
      h =
        '<div class="kh-home' +
        (done ? ' is-done' : '') +
        '"><button type="button" class="kh-home-main" data-app-service="khatma" aria-label="فتح ختمتي">' +
        '<span class="kh-home-ring">' +
        ring(pct) +
        '<b>' +
        ar(pct) +
        '٪</b></span><span class="kh-home-copy"><small>ختمتي · ' +
        esc(a.name) +
        '</small><b>' +
        (done ? 'أتممت ورد اليوم' : 'ورد اليوم: ص ' + ar(r[0]) + (r[1] > r[0] ? '–' + ar(r[1]) : '')) +
        '</b><small>' + icon('flame', 'kh-inl') +
        ar(streak(a)) +
        ' يوم · بقي ' +
        ar(TOTAL - a.read) +
        ' صفحة</small></span></button>' +
        (done
          ? ''
          : '<button type="button" class="kh-home-done" data-khatma-done>' + icon('check') + 'تم</button>') +
        '</div>';
    }
    el.innerHTML = h;
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[data-khatma-done]')) {
      e.stopPropagation();
      markDone();
    }
  });
  function start(name, days) {
    st.active = norm({
      active: {
        name: name || 'ختمة رمضان',
        start: dayKey(),
        days: days,
        read: 0,
        doneDates: []
      }
    }).active;
    save();
    syncTask();
    render();
  }
  function finish() {
    var a = st.active;
    if (!a) return;
    var total = Math.max(1, diffDays(dayKey(), a.start) + 1);
    st.history.unshift({ name: a.name, start: a.start, end: dayKey(), days: total, planned: a.days });
    st.active = null;
    save();
    syncTask();
    render();
    var count = st.history.length;
    if (window.QuranCelebrate)
      window.QuranCelebrate.show({
        title: 'ما شاء الله، ختمتَ القرآن!',
        message: 'تقبّل الله منك، وجعله نورًا لك وشفيعًا يوم القيامة.',
        stats: [
          [ar(total), 'يومًا'],
          [ar(count), count === 1 ? 'ختمة' : 'ختمات']
        ],
        button: 'آمين'
      });
  }
  function markDone() {
    var a = st.active;
    if (!a || doneToday(a)) return;
    var add = Math.min(perDay(a), TOTAL - a.read);
    a.read += add;
    a.added = add;
    a.addedDay = dayKey();
    a.doneDates.push(dayKey());
    save();
    if (a.read >= TOTAL) {
      finish();
      return;
    }
    syncTask();
    render();
    if (ui) ui.say('تقبّل الله ورد اليوم — بقي ' + ar(TOTAL - a.read) + ' صفحة');
  }
  function undoDone() {
    var a = st.active;
    if (!a || !doneToday(a)) return;
    if (a.addedDay === dayKey()) a.read = Math.max(0, a.read - a.added);
    a.doneDates = a.doneDates.filter(function (d) {
      return d !== dayKey();
    });
    a.added = 0;
    a.addedDay = '';
    save();
    syncTask();
    render();
  }
  window.addEventListener('quran:khatma-task-toggled', function (e) {
    if (!st.active) return;
    if (e.detail && e.detail.done) markDone();
    else undoDone();
  });

  /* ---------- الإشعارات ---------- */
  function notify(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var options = {
      body: body,
      icon: './logo.png',
      badge: './logo.png',
      tag: tag,
      renotify: true,
      vibrate: [200, 100, 200],
      data: { url: './', service: 'khatma' }
    };
    var p =
      navigator.serviceWorker && navigator.serviceWorker.ready
        ? navigator.serviceWorker.ready.then(function (reg) {
            return reg.showNotification(title, options);
          })
        : Promise.resolve(new Notification(title, options));
    p.catch(function (e) {
      console.error('تعذر عرض إشعار الختمة.', e);
    });
  }
  function minutesOf(t) {
    var m = /^(\d{2}):(\d{2})$/.exec(t);
    return m ? +m[1] * 60 + +m[2] : null;
  }
  function checkReminders() {
    var a = st.active,
      r = st.remind;
    if (!a || !r.enabled || doneToday(a)) return;
    var now = new Date(),
      cur = now.getHours() * 60 + now.getMinutes(),
      t = minutesOf(r.time);
    if (t == null || cur < t) return;
    var day = dayKey(),
      k1 = 'quran_khatma_fired_' + day,
      k2 = 'quran_khatma_follow_' + day;
    var follow = r.followup && cur >= t + 120 && cur < 24 * 60;
    try {
      if (follow && !localStorage.getItem(k2)) {
        localStorage.setItem(k2, '1');
        localStorage.setItem(k1, '1');
        var left = behind(a);
        notify(
          'لا تنسَ وردك اليوم 📖',
          'لم تُتمّ ' + wirdTitle().replace('ورد الختمة: ', 'ورد اليوم (') + ')' + (left > perDay(a) ? ' — متأخر ' + ar(left) + ' صفحة.' : '.'),
          'quran-khatma-follow'
        );
      } else if (!localStorage.getItem(k1)) {
        localStorage.setItem(k1, '1');
        notify('حان وقت وردك من القرآن 📖', wirdTitle().replace('ورد الختمة: ', '') + ' · ' + a.name, 'quran-khatma');
      }
    } catch (e) {}
  }
  function pruneFired() {
    try {
      var today = dayKey();
      Object.keys(localStorage).forEach(function (k) {
        var m = /^quran_khatma_(?:fired|follow)_(.+)$/.exec(k);
        if (m && m[1] !== today) localStorage.removeItem(k);
      });
    } catch (e) {}
  }

  /* ---------- الواجهة ---------- */
  function ring(pct) {
    var c = 2 * Math.PI * 52,
      off = c * (1 - pct / 100);
    return (
      '<svg class="kh-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="kh-ring-bg"/>' +
      '<circle cx="60" cy="60" r="52" class="kh-ring-fg" stroke-dasharray="' +
      c.toFixed(1) +
      '" stroke-dashoffset="' +
      off.toFixed(1) +
      '" transform="rotate(-90 60 60)"/></svg>'
    );
  }
  function fmtDate(d) {
    try {
      return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long' });
    } catch (e) {
      return dayKey(d);
    }
  }
  var IC = {
    book: '<path d="M4 5.500A2.500 2.500 0 0 1 6.500 3H20v15H6.500A2.500 2.500 0 0 0 4 20.500z"/><path d="M4 20.500A2.500 2.500 0 0 0 6.500 23H20v-5"/><path d="M9 8h7"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.500 7.500 2.500 7.500h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.900 4.900 7 7M17 17l2.100 2.100M4.900 19.100 7 17M17 7l2.100-2.100"/>',
    flame: '<path d="M12 22c4 0 7-2.800 7-6.800 0-3-1.800-5-3.400-6.700-.6 1.600-1.600 2.500-2.600 2.900.4-3.300-1-6.500-3.600-8.400.2 3.200-1.600 5-3 6.800C5.200 11.600 5 13.200 5 15.200 5 19.200 8 22 12 22z"/>',
    pages: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.200"/>',
    medal: '<circle cx="12" cy="9" r="6"/><path d="M8.500 14.300 7 22l5-3 5 3-1.500-7.700"/><path d="m10 9 1.500 1.500L14.500 7.500"/>',
    clock: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.500 1.500M5 3.500 2.500 6M19 3.500 21.500 6"/>',
    check: '<path d="m5 12.500 4.500 4.500L19 7.500"/>'
  };
  function icon(name, cls) {
    return '<svg class="kh-svg' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>';
  }
  function juzOf(page) {
    return Math.min(30, page <= 21 ? 1 : Math.floor((page - 2) / 20) + 1);
  }
  function sw(k, on) {
    return '<span class="kh-sw"><input type="checkbox" data-k="' + k + '"' + (on ? ' checked' : '') + '><i></i></span>';
  }
  function reminderCard() {
    var r = st.remind,
      perm = 'Notification' in window ? Notification.permission : 'unsupported';
    var note =
      perm === 'unsupported'
        ? 'متصفحك لا يدعم الإشعارات.'
        : perm === 'denied'
          ? 'الإشعارات محظورة من إعدادات المتصفح — فعّلها للموقع ثم أعد المحاولة.'
          : 'تصل التذكيرات أثناء فتح التطبيق أو بقائه في الخلفية، وقد لا تصل إن أُغلق تمامًا.';
    return (
      '<details class="kh-panel kh-manage"><summary><span class="kh-ico">' + icon('bell') + '</span><b>التذكير والمهام</b><span class="kh-chev" aria-hidden="true"></span></summary>' +
      '<label class="kh-line"><span><b>تذكير يومي بالورد</b><small>إشعار في الوقت الذي تختاره</small></span>' +
      sw('remind', r.enabled) +
      '</label>' +
      '<label class="kh-line"><span><b>وقت التذكير</b><small>يتكرر كل يوم</small></span><input class="kh-time" type="time" data-k="time" value="' +
      esc(r.time) +
      '"></label>' +
      '<label class="kh-line"><span><b>تذكير ثانٍ</b><small>بعد ساعتين إن لم يُنجز الورد</small></span>' +
      sw('follow', r.followup) +
      '</label>' +
      '<label class="kh-line"><span><b>إظهار الورد في المهام</b><small>مهمة يومية بثلاث نقاط</small></span>' +
      sw('task', st.taskOn) +
      '</label><p class="kh-note">' +
      esc(note) +
      '</p></details>'
    );
  }
  function week(a) {
    var out = '';
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      var on = a.doneDates.indexOf(dayKey(d)) !== -1,
        lbl = '';
      try {
        lbl = d.toLocaleDateString('ar-EG', { weekday: 'short' });
      } catch (e) {}
      out +=
        '<span class="kh-day' + (on ? ' on' : '') + (i === 0 ? ' today' : '') + '"><i>' + (on ? icon('check') : '') + '</i><small>' + esc(lbl) + '</small></span>';
    }
    return out;
  }
  function previewText(days) {
    var pd = Math.ceil(TOTAL / days),
      fin = new Date();
    fin.setDate(fin.getDate() + days - 1);
    return '<b>' + ar(pd) + '</b> صفحة يوميًا · تنتهي في <b>' + esc(fmtDate(fin)) + '</b>';
  }
  function chosenDays() {
    var cv = parseInt(ui.root.querySelector('[data-k="custom"]').value, 10);
    var on = ui.root.querySelector('[data-days].on');
    return cv > 0 ? Math.min(365, cv) : on ? +on.getAttribute('data-days') : 30;
  }
  function draw() {
    var a = st.active,
      h = '';
    if (!a) {
      h +=
        '<header class="kh-hero"><div class="kh-hero-glow" aria-hidden="true"></div><span class="kh-hero-ico" aria-hidden="true">' + icon('book') + '</span>' +
        '<h2>ابدأ ختمة جديدة</h2><p>٦٠٤ صفحات تُقسَّم إلى ورد يومي ثابت، مع تذكير يرافقك حتى الختم.</p></header>' +
        '<section class="kh-panel"><label class="kh-fld"><span>اسم الختمة</span><input type="text" data-k="name" maxlength="40" value="ختمة جديدة"></label>' +
        '<div class="kh-sub">مدة الختمة</div><div class="kh-chips" role="group">' +
        PRESETS.map(function (d) {
          return (
            '<button type="button" class="kh-chip' + (d === 30 ? ' on' : '') + '" data-days="' + d + '"><b>' + ar(d) + '</b><small>يومًا</small><em>' + ar(Math.ceil(TOTAL / d)) + ' ص/يوم</em></button>'
          );
        }).join('') +
        '<label class="kh-chip kh-chip-custom"><b>مخصّص</b><input type="number" min="1" max="365" inputmode="numeric" data-k="custom" placeholder="أيام"></label></div>' +
        '<div class="kh-preview" data-k="preview">' + previewText(30) + '</div>' +
        '<button type="button" class="kh-cta" data-act="start">ابدأ الختمة</button></section>';
    } else {
      var pct = Math.round((a.read / TOTAL) * 100),
        r = wirdRange(a),
        done = doneToday(a),
        pd = perDay(a),
        lag = behind(a),
        remainDays = Math.ceil((TOTAL - a.read) / pd),
        fin = new Date();
      fin.setDate(fin.getDate() + remainDays - (done ? 0 : 1));
      var dayNo = Math.max(1, diffDays(dayKey(), a.start) + 1);
      h +=
        '<header class="kh-hero kh-hero-act"><div class="kh-hero-glow" aria-hidden="true"></div>' +
        '<div class="kh-hero-top"><div><small>' + esc(a.name) + '</small><h2>اليوم ' + ar(Math.min(dayNo, a.days)) + ' من ' + ar(a.days) + '</h2></div>' +
        '<div class="kh-bigring">' + ring(pct) + '<b>' + ar(pct) + '٪</b></div></div>' +
        '<div class="kh-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="kh-hero-foot"><span>قُرئ <b>' + ar(a.read) + '</b> من ' + ar(TOTAL) + '</span><span>الانتهاء <b>' + esc(fmtDate(fin)) + '</b></span></div></header>' +
        '<section class="kh-today' + (done ? ' done' : '') + '"><div class="kh-today-h"><span>ورد اليوم</span><em>الجزء ' + ar(juzOf(r[0])) + '</em></div>' +
        '<div class="kh-range"><div><small>من صفحة</small><b>' + ar(r[0]) + '</b></div><span aria-hidden="true">←</span><div><small>إلى صفحة</small><b>' + ar(r[1]) + '</b></div></div>' +
        '<div class="kh-week">' + week(a) + '</div>' +
        (done
          ? '<div class="kh-doneline">' + icon('check') + 'أتممت ورد اليوم — تقبّل الله</div><div class="kh-two"><button type="button" class="kh-sec" data-act="open">افتح في المصحف</button><button type="button" class="kh-sec" data-act="undo">تراجع</button></div>'
          : '<button type="button" class="kh-cta" data-act="done">' + icon('check') + 'أتممت ورد اليوم</button><button type="button" class="kh-sec wide" data-act="open">' + icon('book') + 'افتح الصفحة في المصحف</button>') +
        '</section>';
      if (lag > pd && !done)
        h += '<div class="kh-alert"><span>' + icon('clock') + '</span><p>متأخر نحو <b>' + ar(lag) + '</b> صفحة عن الخطة. زد وردك قليلًا لتلحق بها.</p></div>';
      h +=
        '<section class="kh-stats"><div><span>' + icon('flame') + '</span><b>' + ar(streak(a)) + '</b><small>أيام متتالية</small></div>' +
        '<div><span>' + icon('pages') + '</span><b>' + ar(TOTAL - a.read) + '</b><small>صفحة متبقية</small></div>' +
        '<div><span>' + icon('target') + '</span><b>' + ar(pd) + '</b><small>صفحات يوميًا</small></div></section>';
    }
    h += reminderCard();
    if (a)
      h +=
        '<details class="kh-panel kh-manage"><summary><span class="kh-ico">' + icon('gear') + '</span><b>إدارة الختمة</b><span class="kh-chev" aria-hidden="true"></span></summary><div class="kh-two"><button type="button" class="kh-sec" data-act="restart">إعادة من البداية</button><button type="button" class="kh-sec danger" data-act="cancel">إلغاء الختمة</button></div></details>';
    if (st.history.length)
      h +=
        '<section class="kh-panel"><div class="kh-panel-h"><span class="kh-ico">' + icon('medal') + '</span><b>ختماتي</b><em>' + ar(st.history.length) + '</em></div><ul class="kh-hist">' +
        st.history
          .slice(0, 10)
          .map(function (x) {
            var d = parseDay(x.end);
            return '<li><span class="kh-medal">' + icon('medal') + '</span><b>' + esc(x.name) + '</b><small>' + ar(x.days) + ' يومًا · ' + esc(d ? fmtDate(d) : x.end) + '</small></li>';
          })
          .join('') +
        '</ul></section>';
    ui.root.innerHTML = '<div class="kh">' + h + '</div>';
  }

  function onClick(e) {
    var chip = e.target.closest('[data-days]');
    if (chip) {
      ui.root.querySelectorAll('[data-days]').forEach(function (c) {
        c.classList.toggle('on', c === chip);
      });
      var custom = ui.root.querySelector('[data-k="custom"]');
      if (custom) custom.value = '';
      var pv = ui.root.querySelector('[data-k="preview"]');
      if (pv) pv.innerHTML = previewText(chosenDays());
      return;
    }
    var btn = e.target.closest('[data-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-act');
    if (act === 'start') {
      var name = (ui.root.querySelector('[data-k="name"]').value || '').trim() || 'ختمة جديدة';
      start(name, chosenDays());
    } else if (act === 'done') markDone();
    else if (act === 'undo') undoDone();
    else if (act === 'open') {
      var r = wirdRange(st.active);
      if (window.QuranOpenPage) window.QuranOpenPage(r[0]);
    } else if (act === 'restart') {
      if (window.confirm('إعادة الختمة من الصفحة الأولى؟ سيُصفَّر التقدّم الحالي.')) start(st.active.name, st.active.days);
    } else if (act === 'cancel') {
      if (window.confirm('إلغاء الختمة الحالية؟ سيُحذف تقدّمها.')) {
        st.active = null;
        save();
        syncTask();
        render();
      }
    }
  }
  function onChange(e) {
    var k = e.target.getAttribute && e.target.getAttribute('data-k');
    if (!k) return;
    if (k === 'remind') {
      if (e.target.checked) {
        if (!('Notification' in window)) {
          e.target.checked = false;
          return draw();
        }
        var go = function (perm) {
          st.remind.enabled = perm === 'granted';
          save();
          draw();
          if (st.remind.enabled) {
            if (ui) ui.say('تم تفعيل التذكير اليومي');
            notify('تم تفعيل تذكير الورد ✅', 'سنذكّرك يوميًا الساعة ' + ar(st.remind.time), 'quran-khatma-on');
            checkReminders();
          }
        };
        if (Notification.permission === 'granted') go('granted');
        else if (Notification.permission === 'denied') go('denied');
        else Notification.requestPermission().then(go, function () { go('denied'); });
      } else {
        st.remind.enabled = false;
        save();
        draw();
      }
    } else if (k === 'time') {
      if (/^\d{2}:\d{2}$/.test(e.target.value)) st.remind.time = e.target.value;
      save();
    } else if (k === 'follow') {
      st.remind.followup = e.target.checked;
      save();
    } else if (k === 'task') {
      st.taskOn = e.target.checked;
      save();
      syncTask();
    }
  }
  function mount(root, say) {
    ui = { root: root, say: say || function () {} };
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', function (e) {
      if (e.target.getAttribute && e.target.getAttribute('data-k') === 'custom' && e.target.value) {
        root.querySelectorAll('[data-days]').forEach(function (c) {
          c.classList.remove('on');
        });
        var pv = root.querySelector('[data-k="preview"]');
        if (pv) pv.innerHTML = previewText(chosenDays());
      }
    });
    draw();
    return function () {
      root.removeEventListener('click', onClick);
      root.removeEventListener('change', onChange);
      root.replaceChildren();
      ui = null;
    };
  }
  window.QuranKhatma = { mount: mount };

  /* ---------- تشغيل ---------- */
  function tick() {
    var before = wirdTitle();
    syncTask();
    checkReminders();
    if (ui && before) render();
  }
  function boot() {
    drawHome();
    pruneFired();
    syncTask();
    checkReminders();
    setInterval(function () {
      syncTask();
      checkReminders();
    }, 60000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) tick();
    });
    if (navigator.serviceWorker)
      navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'open-service' && window.QuranOpenService) window.QuranOpenService(e.data.service);
      });
    if (/[?&]khatma=1/.test(location.search) && window.QuranOpenService)
      setTimeout(function () {
        window.QuranOpenService('khatma');
      }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 400); });
  else setTimeout(boot, 400);
})();
