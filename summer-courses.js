// ============================================
// SUMMER COURSES SYSTEM - ElMistar
// Firestore is the ONLY source of truth.
// ============================================

const SummerCourses = (function () {
  // ─── State ─────────────────────────────────────
  let allCourses = [];
  let publicCourses = [];
  let subscriptions = [];
  let userSubscribedIds = {}; // phone+courseId -> true for quick lookup
  let currentSubFilter = 'all';

  // ─── Init ──────────────────────────────────────
  function init() {
    console.log('[SC] SummerCourses.init() called');
    console.log('[SC] window.db available:', !!window.db);
    if (document.querySelector('.summer-section')) {
      loadPublicCourses();
    }
    if (document.getElementById('summer-courses-view')) {
      loadAdminCourses();
      loadSubscriptions();
      // Subscription filter tabs
      document.querySelectorAll('[data-sub-filter]').forEach(function (tab) {
        tab.addEventListener('click', function () {
          document.querySelectorAll('[data-sub-filter]').forEach(function (t) { t.classList.remove('active'); });
          tab.classList.add('active');
          currentSubFilter = tab.getAttribute('data-sub-filter');
          renderSubscriptions();
        });
      });
    }
  }

  // ─── Helpers ───────────────────────────────────
  // Match phones stored with or without a leading zero (legacy data)
  function getPhoneVariants(phone) {
    var cleaned = (phone || '').toString().replace(/\D/g, '');
    if (!cleaned) return [];
    var noZero = cleaned.replace(/^0+/, '');
    var withZero = '0' + noZero;
    return withZero === noZero ? [withZero] : [withZero, noZero];
  }

  function queryByPhone(collectionName, field, phone) {
    var variants = getPhoneVariants(phone);
    if (variants.length === 0) return Promise.resolve(null);
    if (variants.length === 1) {
      return window.db.collection(collectionName).where(field, '==', variants[0]).get();
    }
    return window.db.collection(collectionName).where(field, 'in', variants).get();
  }

  function formatDate(d) {
    if (!d) return '—';
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function timeAgo(date) {
    if (!date) return '';
    const now = new Date();
    const d = date.toDate ? date.toDate() : new Date(date);
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return 'الآن';
    if (diff < 3600) return 'منذ ' + Math.floor(diff / 60) + ' دقيقة';
    if (diff < 86400) return 'منذ ' + Math.floor(diff / 3600) + ' ساعة';
    if (diff < 2592000) return 'منذ ' + Math.floor(diff / 86400) + ' يوم';
    return 'منذ ' + Math.floor(diff / 2592000) + ' شهر';
  }

  function validateUrl(url) {
    return url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'));
  }

  function getDefaultImage() {
    return 'img/logo.png';
  }

  function getPaymentMethodLabel(method) {
    var labels = { cash: 'نقداً', online: 'أونلاين', both: 'نقداً / أونلاين' };
    return labels[method] || method;
  }

  function getGradeName(g) {
    if (!g) return '';
    var str = g.toString().trim();
    var names = {
      "0": "مرحلة الكي جي والتأسيس", "تأسيس": "مرحلة الكي جي والتأسيس", "مرحلة التأسيس": "مرحلة الكي جي والتأسيس", "تأسيس / KG": "مرحلة الكي جي والتأسيس", "kg": "مرحلة الكي جي والتأسيس", "مرحلة الكي جي والتأسيس": "مرحلة الكي جي والتأسيس",
      "1": "الصف الأول الابتدائي", "g1": "الصف الأول الابتدائي", "الصف الأول": "الصف الأول الابتدائي", "أول ابتدائي": "الصف الأول الابتدائي", "الأول الابتدائي": "الصف الأول الابتدائي", "الصف الأول الابتدائي": "الصف الأول الابتدائي",
      "2": "الصف الثاني الابتدائي", "g2": "الصف الثاني الابتدائي", "الصف الثاني": "الصف الثاني الابتدائي", "ثاني ابتدائي": "الصف الثاني الابتدائي", "الثاني الابتدائي": "الصف الثاني الابتدائي", "الصف الثاني الابتدائي": "الصف الثاني الابتدائي",
      "3": "الصف الثالث الابتدائي", "g3": "الصف الثالث الابتدائي", "الصف الثالث": "الصف الثالث الابتدائي", "ثالث ابتدائي": "الصف الثالث الابتدائي", "الثالث الابتدائي": "الصف الثالث الابتدائي", "الصف الثالث الابتدائي": "الصف الثالث الابتدائي",
      "4": "الصف الرابع الابتدائي", "g4": "الصف الرابع الابتدائي", "الصف الرابع": "الصف الرابع الابتدائي", "رابع ابتدائي": "الصف الرابع الابتدائي", "الرابع الابتدائي": "الصف الرابع الابتدائي", "الصف الرابع الابتدائي": "الصف الرابع الابتدائي",
      "5": "الصف الخامس الابتدائي", "g5": "الصف الخامس الابتدائي", "الصف الخامس": "الصف الخامس الابتدائي", "خامس ابتدائي": "الصف الخامس الابتدائي", "الخامس الابتدائي": "الصف الخامس الابتدائي", "الصف الخامس الابتدائي": "الصف الخامس الابتدائي",
      "6": "الصف السادس الابتدائي", "g6": "الصف السادس الابتدائي", "الصف السادس": "الصف السادس الابتدائي", "سادس ابتدائي": "الصف السادس الابتدائي", "السادس الابتدائي": "الصف السادس الابتدائي", "الصف السادس الابتدائي": "الصف السادس الابتدائي"
    };
    return names[str] || g;
  }

  function loadUserSubscriptions(user) {
    userSubscribedIds = {};
    if (!window.db || !user || !user.phone) { renderPublicCourses(); return; }
    var phone = user.phone.toString().trim();
    var name = (user.name || '').trim();
    var grade = getGradeName((user.grade || '').trim());
    queryByPhone('courseSubscriptions', 'phone', phone)
      .then(function (snapshot) {
        if (!snapshot) return;
        snapshot.forEach(function (doc) {
          var data = doc.data();
          if (data.courseId &&
              (data.name || '').trim() === name &&
              getGradeName((data.grade || '').trim()) === grade) {
            userSubscribedIds[data.courseId] = data.status || 'pending';
          }
        });
        renderPublicCourses();
      })
      .catch(function (err) {
        console.error('[SC] loadUserSubscriptions error:', err);
        renderPublicCourses();
      });
  }

  function getPaymentMethodBadge(method) {
    var colors = {
      cash: { bg: '#fef3c7', text: '#92400e' },
      online: { bg: '#dbeafe', text: '#1e40af' },
      both: { bg: '#d1fae5', text: '#065f46' }
    };
    var c = colors[method] || { bg: '#f1f5f9', text: '#475569' };
    return '<span style="background:' + c.bg + ';color:' + c.text + ';padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;">' + getPaymentMethodLabel(method) + '</span>';
  }

  // ─── Image Upload & Compression ──────────────
  function compressImage(file, maxWidth, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !file.type.startsWith('image/')) {
        reject(new Error('Invalid file type'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          var dataUrl = canvas.toDataURL('image/jpeg', quality || 0.7);
          resolve(dataUrl);
        };
        img.onerror = function () { reject(new Error('Failed to load image')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    });
  }

  function setupImageUpload() {
    var fileInput = document.getElementById('cf-image-file');
    var preview = document.getElementById('cf-image-preview');
    var removeBtn = document.getElementById('cf-remove-image');
    var hiddenInput = document.getElementById('cf-image-url');
    var uploadZone = document.getElementById('cf-upload-zone');
    if (!fileInput || !preview || !hiddenInput) return;

    fileInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('حجم الصورة يتجاوز 5 ميجا', 'error');
        fileInput.value = '';
        return;
      }
      compressImage(file, 800, 0.7).then(function (dataUrl) {
        hiddenInput.value = dataUrl;
        preview.src = dataUrl;
        preview.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (uploadZone) uploadZone.style.borderColor = '#6c63ff';
      }).catch(function (err) {
        console.error('[SC] Image compress error:', err);
        if (typeof showToast === 'function') showToast('فشل في معالجة الصورة', 'error');
      });
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        hiddenInput.value = '';
        preview.src = '';
        preview.style.display = 'none';
        removeBtn.style.display = 'none';
        fileInput.value = '';
        if (uploadZone) uploadZone.style.borderColor = '';
      });
    }

    if (uploadZone) {
      uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        this.style.borderColor = '#6c63ff';
        this.style.background = 'rgba(108,99,255,0.06)';
      });
      uploadZone.addEventListener('dragleave', function () {
        this.style.borderColor = '';
        this.style.background = '';
      });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        this.style.borderColor = '';
        this.style.background = '';
        var file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change'));
        }
      });
    }
  }

  // ───────────────────────────────────────────────
  // PUBLIC SECTION (index.html)
  // ───────────────────────────────────────────────
  function loadPublicCourses() {
    console.log('[SC] loadPublicCourses() — checking window.db:', !!window.db);
    window.__fbTracker && window.__fbTracker.add();
    if (!window.db) {
      console.error('[SC] window.db is not available! Firebase not initialized.');
      window.__fbTracker && window.__fbTracker.done();
      hideSkeleton();
      showEmptyState();
      return;
    }

    console.log('[SC] Fetching from Firestore collection: summerCourses');
    window.db.collection('summerCourses')
      .orderBy('createdAt', 'desc')
      .get()
      .then(function (snapshot) {
        console.log('[SC] Snapshot received! Size:', snapshot.size);
        allCourses = [];
        snapshot.forEach(function (doc) {
          var courseData = doc.data();
          courseData.id = doc.id;
          allCourses.push(courseData);
        });
        console.log('[SC] All courses loaded:', allCourses.length);
        publicCourses = allCourses.filter(function (c) {
          return c.isActive === true;
        });
        console.log('[SC] Active courses for public:', publicCourses.length);
        var stored = null;
        try { stored = JSON.parse(localStorage.getItem('el_mistar_current_user')); } catch (e) {}
        if (stored && stored.phone && stored.name) {
          loadUserSubscriptions(stored);
        } else {
          userSubscribedIds = {};
          renderPublicCourses();
        }
        window.__fbTracker && window.__fbTracker.done();
        // Now set up real-time listener for subsequent updates
        _setupPublicCoursesListener();
      })
      .catch(function (err) {
        window.__fbTracker && window.__fbTracker.done();
        console.error('[SC] Firestore snapshot error:', err);
        console.error('[SC] Error code:', err.code);
        console.error('[SC] Error message:', err.message);
        hideSkeleton();
        showEmptyState();
        if (typeof showToast === 'function') {
          showToast('خطأ في تحميل الكورسات: ' + (err.message || err.code), 'error');
        }
      });
  }

  var _publicCoursesListenerSetup = false;
  function _setupPublicCoursesListener() {
    if (_publicCoursesListenerSetup) return;
    _publicCoursesListenerSetup = true;
    window.db.collection('summerCourses')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        allCourses = [];
        snapshot.forEach(function (doc) {
          var courseData = doc.data();
          courseData.id = doc.id;
          allCourses.push(courseData);
        });
        publicCourses = allCourses.filter(function (c) {
          return c.isActive === true;
        });
        var stored = null;
        try { stored = JSON.parse(localStorage.getItem('el_mistar_current_user')); } catch (e) {}
        if (stored && stored.phone && stored.name) {
          loadUserSubscriptions(stored);
        } else {
          userSubscribedIds = {};
          renderPublicCourses();
        }
      }, function (err) {
        console.error('[SC] Realtime listener error:', err);
      });
  }

  function hideSkeleton() {
    var skeleton = document.querySelector('.summer-skeleton');
    if (skeleton) skeleton.style.display = 'none';
  }

  function showEmptyState() {
    var emptyState = document.querySelector('.summer-empty-state');
    if (emptyState) emptyState.style.display = 'block';
  }

  function renderPublicCourses() {
    var container = document.querySelector('.summer-courses-grid');
    var skeleton = document.querySelector('.summer-skeleton');
    var emptyState = document.querySelector('.summer-empty-state');

    // Always hide skeleton when rendering
    if (skeleton) skeleton.style.display = 'none';

    if (!container) {
      console.warn('[SC] .summer-courses-grid container not found');
      return;
    }

    if (publicCourses.length === 0) {
      container.innerHTML = '';
      showEmptyState();
      console.log('[SC] No active courses to display');
      return;
    }

    if (emptyState) emptyState.style.display = 'none';

    console.log('[SC] Rendering', publicCourses.length, 'courses');
    container.innerHTML = '';

    publicCourses.forEach(function (course, index) {
      var card = document.createElement('div');
      card.className = 'summer-card';
      card.style.animationDelay = (index * 0.1) + 's';

      var imgUrl = validateUrl(course.imageUrl) ? course.imageUrl : getDefaultImage();
      var priceText = course.price ? course.price + ' ج.م' : 'مجاناً';
      var badgeClass = course.isActive ? 'active' : 'inactive';
      var badgeText = course.isActive ? '🚀 متاح' : '🔴 غير متاح';
      var audienceHtml = course.targetAudience
        ? '<div class="summer-audience-badge"><i class="bx bx-user"></i> ' + course.targetAudience + '</div>'
        : '';

      card.innerHTML =
        '<div class="summer-card-img-wrap">' +
          '<img src="' + imgUrl + '" alt="' + (course.title || '') + '" class="summer-card-img" loading="lazy" onerror="this.src=\'' + getDefaultImage() + '\';this.onerror=null;">' +
          '<div class="summer-card-badge ' + badgeClass + '">' + badgeText + '</div>' +
        '</div>' +
        '<div class="summer-card-body">' +
          '<h3 class="summer-card-title">' + (course.title || 'بدون عنوان') + '</h3>' +
          audienceHtml +
          '<p class="summer-card-desc">' + (course.shortDescription || '') + '</p>' +
          '<div class="summer-card-meta">' +
            '<span class="summer-price">' + priceText + '</span>' +
            getPaymentMethodBadge(course.paymentMethod) +
          '</div>' +
          '<div class="summer-card-footer">' +
            '<span class="summer-duration"><i class="bx bx-time"></i> ' + (course.duration || '—') + '</span>' +
            '<span class="summer-lessons"><i class="bx bx-book-open"></i> ' + (course.lessonsCount || 0) + ' حصة</span>' +
          '</div>' +
          (function () {
            var subStatus = userSubscribedIds[course.id];
            if (subStatus === 'confirmed') {
              return '<button class="summer-subscribe-btn subscribed" disabled>' +
                '<i class="bx bx-check-circle"></i> تم الاشتراك ✓' +
                '</button>';
            } else if (subStatus === 'pending') {
              return '<button class="summer-subscribe-btn pending" disabled>' +
                '<i class="bx bx-time"></i> تم تقديم طلب الاشتراك بنجاح' +
                '</button>';
            }
            return '<button class="summer-subscribe-btn" data-id="' + course.id + '">' +
              '<i class="bx bx-plus-circle"></i> اشترك الان' +
              '</button>';
          })() +
        '</div>';

      container.appendChild(card);

      // Animate on scroll
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('summer-card-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1 });
      observer.observe(card);
    });

    // Subscribe buttons
    document.querySelectorAll('.summer-subscribe-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var course = publicCourses.find(function (c) { return c.id === id; });
        if (course) openSubscribeModal(course);
      });
    });

    console.log('[SC] Public courses rendered successfully');
  }

  // ─── Subscribe Modal ───────────────────────────
  function openSubscribeModal(course) {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem('el_mistar_current_user')); } catch (e) { stored = null; }

    if (stored && stored.name) {
      directSubscribe(course, stored);
    } else {
      localStorage.setItem('pendingSummerCourseId', course.id);
      var authOverlay = document.getElementById('authOverlay');
      if (authOverlay) authOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function directSubscribe(course, user) {
    if (!window.db || !user.phone) {
      if (typeof showToast === 'function') showToast('بيانات المستخدم غير مكتملة', 'error');
      return;
    }

    var phone = user.phone.toString().trim();
    var name = (user.name || '').trim();
    var grade = getGradeName((user.grade || '').trim());

    if (course.paymentMethod === 'cash') {
      // Save subscription directly without payment
      window.db.collection('courseSubscriptions').add({
        courseId: course.id,
        courseTitle: course.title,
        name: name,
        phone: phone,
        grade: grade,
        email: user.email || '',
        paymentMethod: 'cash',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function () {
        userSubscribedIds[course.id] = 'pending';
        renderPublicCourses();
        if (typeof showToast === 'function') showToast('✅ تم التسجيل بنجاح! سيتم التواصل معك قريباً.', 'success');
      }).catch(function (err) {
        console.error('[SC] Subscribe error:', err);
        if (typeof showToast === 'function') showToast('حدث خطأ أثناء التسجيل', 'error');
      });
      return;
    }

    if (course.paymentMethod === 'both') {
      // Show subscribe modal with pre-filled data so user can choose cash or online
      var subModal = document.getElementById('subscribe-modal');
      if (subModal) {
        document.getElementById('sub-course-name').textContent = course.title || '';
        document.getElementById('sub-course-price').textContent = (course.price ? course.price + ' ج.م' : 'مجاناً');
        document.getElementById('sub-name').value = name;
        document.getElementById('sub-phone').value = phone;
        document.getElementById('sub-grade').value = grade;
        document.getElementById('sub-email').value = user.email || '';
        subModal.setAttribute('data-course-id', course.id);
        // Reset and show payment info based on default method
        var info = document.getElementById('sub-payment-info');
        if (info) {
          info.innerHTML = '📌 سيتم الدفع داخل السنتر. سنتواصل معك قريباً.';
          info.style.background = '#fef3c7';
          info.style.color = '#92400e';
          info.style.display = 'block';
        }
        document.getElementById('sub-payment-method').value = 'cash';
        subModal.classList.add('active');
      }
      return;
    }

    // paymentMethod === 'online' or default: show payment modal
    var payModal = document.getElementById('payment-modal');
    var amountInput = document.getElementById('payment-amount');
    if (amountInput) amountInput.value = course.price || 0;
    if (payModal) {
      payModal.setAttribute('data-summer-pending-course-id', course.id);
      payModal.setAttribute('data-summer-pending-title', course.title || '');
      payModal.setAttribute('data-summer-pending-phone', phone);
      payModal.setAttribute('data-summer-pending-name', name);
      payModal.setAttribute('data-summer-pending-grade', grade);
      payModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function handleSubscribeSubmit(e) {
    e.preventDefault();
    var modal = document.getElementById('subscribe-modal');
    var courseId = modal ? modal.getAttribute('data-course-id') : '';
    var course = publicCourses.find(function (c) { return c.id === courseId; });
    if (!course) return;

    var name = (document.getElementById('sub-name') || {}).value || '';
    var phone = (document.getElementById('sub-phone') || {}).value || '';
    var grade = (document.getElementById('sub-grade') || {}).value || '';
    var email = (document.getElementById('sub-email') || {}).value || '';
    var method = course.paymentMethod === 'both'
      ? ((document.getElementById('sub-payment-method') || {}).value || 'cash')
      : course.paymentMethod;

    name = name.trim();
    phone = phone.trim();
    email = email.trim();
    grade = getGradeName(grade).trim();

    if (!name || !phone || !grade) {
      if (typeof showToast === 'function') showToast('يرجى ملء الحقول المطلوبة', 'error');
      return;
    }

    // Check duplicate (query by phone, filter name+grade+courseId client-side)
    queryByPhone('courseSubscriptions', 'phone', phone)
      .then(function (snapshot) {
        var alreadySubscribed = false;
        if (snapshot) {
          snapshot.forEach(function (doc) {
          var d = doc.data();
          if (d.courseId === courseId &&
              (d.name || '').trim() === name &&
              (d.grade || '').trim() === grade) {
            alreadySubscribed = true;
          }
        });
        }
        if (alreadySubscribed) {
          if (typeof showToast === 'function') showToast('هذا الطالب مشترك بالفعل في هذا الكورس ✅', 'error');
          return;
        }

        var subData = {
          courseId: courseId,
          courseTitle: course.title,
          name: name,
          phone: phone,
          grade: grade,
          email: email,
          paymentMethod: method,
          status: 'pending',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (method === 'online') {
          // Don't create subscription yet - show payment modal and let script.js handle creation with receipt
          if (modal) modal.classList.remove('active');
          var payModal = document.getElementById('payment-modal');
          var amountInput = document.getElementById('payment-amount');
          if (amountInput) amountInput.value = course.price || 0;
          if (payModal) {
            payModal.setAttribute('data-summer-pending-course-id', courseId);
            payModal.setAttribute('data-summer-pending-title', course.title || '');
            payModal.setAttribute('data-summer-pending-phone', phone);
            payModal.setAttribute('data-summer-pending-name', name);
            payModal.setAttribute('data-summer-pending-grade', grade);
            payModal.classList.add('active');
            document.body.style.overflow = 'hidden';
          }
          return;
        }

        // Cash: save subscription directly
        window.db.collection('courseSubscriptions').add(subData).then(function () {
          if (modal) modal.classList.remove('active');
          var info = document.getElementById('sub-payment-info');
          if (info) {
            info.innerHTML = '📌 سيتم الدفع داخل السنتر. سنتواصل معك قريباً.';
            info.style.display = 'block';
          }
          userSubscribedIds[courseId] = 'pending';
          renderPublicCourses();
          if (typeof showToast === 'function') showToast('✅ تم التسجيل بنجاح! سنتواصل معك قريباً.', 'success');
        }).catch(function (err) {
          console.error('[SC] Subscribe error:', err);
          if (typeof showToast === 'function') showToast('حدث خطأ أثناء التسجيل', 'error');
        });
      })
      .catch(function (err) {
        console.error('[SC] Duplicate check error:', err);
        if (typeof showToast === 'function') showToast('حدث خطأ في التحقق', 'error');
      });
  }

  // ───────────────────────────────────────────────
  // ADMIN SECTION (admin.html)
  // ───────────────────────────────────────────────
  function loadAdminCourses() {
    window.__fbTracker && window.__fbTracker.add();
    if (!window.db) { window.__fbTracker && window.__fbTracker.done(); return; }
    var _acDone = false;
    window.db.collection('summerCourses')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        if (!_acDone) { _acDone = true; window.__fbTracker && window.__fbTracker.done(); }
        console.log('[SC Admin] Snapshot received, size:', snapshot.size);
        allCourses = [];
        snapshot.forEach(function (doc) {
          var courseData = doc.data();
          courseData.id = doc.id;
          allCourses.push(courseData);
        });
        renderAdminCourses();
        loadAdminStats();
      }, function (err) {
        if (!_acDone) { _acDone = true; window.__fbTracker && window.__fbTracker.done(); }
        console.error('[SC Admin] Error:', err);
      });
  }

  function renderAdminCourses() {
    var tbody = document.querySelector('#summer-courses-table tbody');
    if (!tbody) return;

    var filtered = allCourses.slice();

    var searchEl = document.getElementById('sc-search');
    var filterEl = document.getElementById('sc-filter');
    var sortEl = document.getElementById('sc-sort');

    var searchVal = searchEl ? searchEl.value.toLowerCase().trim() : '';
    var statusFilter = filterEl ? filterEl.value : 'all';
    var sortVal = sortEl ? sortEl.value : 'createdAt';

    if (searchVal) {
      filtered = filtered.filter(function (c) {
        return (c.title || '').toLowerCase().indexOf(searchVal) !== -1 ||
               (c.shortDescription || '').toLowerCase().indexOf(searchVal) !== -1;
      });
    }
    if (statusFilter === 'active') filtered = filtered.filter(function (c) { return c.isActive; });
    else if (statusFilter === 'inactive') filtered = filtered.filter(function (c) { return !c.isActive; });

    if (sortVal === 'price-asc') filtered.sort(function (a, b) { return (a.price || 0) - (b.price || 0); });
    else if (sortVal === 'price-desc') filtered.sort(function (a, b) { return (b.price || 0) - (a.price || 0); });
    else if (sortVal === 'title') filtered.sort(function (a, b) { return (a.title || '').localeCompare(b.title || '', 'ar'); });
    else filtered.sort(function (a, b) {
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });

    var chip = document.getElementById('sc-count');
    if (chip) chip.textContent = filtered.length + ' كورس';

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="bx bx-search-alt" style="font-size:40px;display:block;margin-bottom:10px;"></i>لا توجد كورسات</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(function (course) {
      var tr = document.createElement('tr');
      var imgUrl = validateUrl(course.imageUrl) ? course.imageUrl : getDefaultImage();
      var activeStyle = course.isActive ? 'var(--green)' : 'var(--text-muted)';
      var activeLabel = course.isActive ? 'نشط' : 'غير نشط';
      var activeIcon = course.isActive ? 'bx-toggle-right' : 'bx-toggle-left';

      tr.innerHTML =
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
          '<img src="' + imgUrl + '" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid var(--border);" onerror="this.src=\'' + getDefaultImage() + '\';this.onerror=null;">' +
          '<strong>' + (course.title || 'بدون عنوان') + '</strong>' +
        '</div></td>' +
        '<td>' + (course.price ? course.price + ' ج.م' : 'مجاناً') + '</td>' +
        '<td>' + (course.duration || '—') + '</td>' +
        '<td>' + (course.lessonsCount || 0) + '</td>' +
        '<td style="font-size:13px;">' + (course.targetAudience || '—') + '</td>' +
        '<td>' + getPaymentMethodBadge(course.paymentMethod) + '</td>' +
        '<td>' +
          '<button class="btn-icon toggle-course-btn" data-id="' + course.id + '" data-active="' + course.isActive + '" style="color:' + activeStyle + ';" title="' + (course.isActive ? 'إلغاء التفعيل' : 'تفعيل') + '">' +
            '<i class="bx ' + activeIcon + '"></i>' +
          '</button> ' +
          '<span style="font-size:12px;font-weight:700;color:' + activeStyle + '">' + activeLabel + '</span>' +
        '</td>' +
        '<td><div style="display:flex;gap:6px;">' +
          '<button class="btn-icon edit-course-btn" data-id="' + course.id + '" title="تعديل"><i class="bx bx-edit"></i></button>' +
          '<button class="btn-icon duplicate-course-btn" data-id="' + course.id + '" title="نسخ"><i class="bx bx-copy"></i></button>' +
          '<button class="btn-icon danger delete-course-btn" data-id="' + course.id + '" title="حذف"><i class="bx bx-trash"></i></button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });

    attachAdminCourseEvents();
  }

  function attachAdminCourseEvents() {
    document.querySelectorAll('.edit-course-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var course = allCourses.find(function (c) { return c.id === id; });
        if (course) openCourseForm(course);
      });
    });

    document.querySelectorAll('.delete-course-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var course = allCourses.find(function (c) { return c.id === id; });
        if (course && confirm('هل أنت متأكد من حذف "' + course.title + '"؟')) {
          SyncService.executeDbOperation('summerCourses', 'delete', id, null)
            .then(function () { if (typeof showToast === 'function') showToast('✅ تم حذف الكورس'); })
            .catch(function (err) { console.error('[SC] Delete error:', err); if (typeof showToast === 'function') showToast('خطأ في الحذف', 'error'); });
        }
      });
    });

    document.querySelectorAll('.toggle-course-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var isActive = this.getAttribute('data-active') === 'true';
        SyncService.executeDbOperation('summerCourses', 'update', id, { isActive: !isActive })
          .then(function () { if (typeof showToast === 'function') showToast(isActive ? 'تم إلغاء التفعيل' : 'تم التفعيل'); })
          .catch(function (err) { console.error('[SC] Toggle error:', err); if (typeof showToast === 'function') showToast('خطأ في التحديث', 'error'); });
      });
    });

    document.querySelectorAll('.duplicate-course-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        var course = allCourses.find(function (c) { return c.id === id; });
        if (!course) return;
        var data = {};
        for (var key in course) {
          if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt') {
            data[key] = course[key];
          }
        }
        data.title = data.title + ' (نسخة)';
        data.isActive = false;
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        SyncService.executeDbOperation('summerCourses', 'add', null, data)
          .then(function () { if (typeof showToast === 'function') showToast('✅ تم نسخ الكورس'); })
          .catch(function (err) { console.error('[SC] Duplicate error:', err); if (typeof showToast === 'function') showToast('خطأ في النسخ', 'error'); });
      });
    });
  }

  // ─── Course Form (Add/Edit) ────────────────────
  function openCourseForm(course) {
    var modal = document.getElementById('course-form-modal');
    if (!modal) return;
    var form = document.getElementById('course-form');
    if (form) form.reset();

    document.getElementById('cf-id').value = course ? course.id : '';
    document.getElementById('cf-title').value = course ? (course.title || '') : '';
    document.getElementById('cf-short-desc').value = course ? (course.shortDescription || '') : '';
    document.getElementById('cf-image-url').value = course ? (course.imageUrl || '') : '';
    document.getElementById('cf-price').value = course ? (course.price || '') : '';
    document.getElementById('cf-payment-method').value = course ? (course.paymentMethod || 'cash') : 'cash';
    document.getElementById('cf-duration').value = course ? (course.duration || '') : '';
    document.getElementById('cf-lessons').value = course ? (course.lessonsCount || '') : '';
    document.getElementById('cf-target-audience').value = course ? (course.targetAudience || '') : '';
    document.getElementById('cf-is-active').checked = course ? !!course.isActive : true;

    if (course && course.startDate) {
      var sd = course.startDate.toDate ? course.startDate.toDate() : new Date(course.startDate);
      document.getElementById('cf-start-date').value = sd.toISOString().split('T')[0];
    } else {
      document.getElementById('cf-start-date').value = '';
    }
    if (course && course.endDate) {
      var ed = course.endDate.toDate ? course.endDate.toDate() : new Date(course.endDate);
      document.getElementById('cf-end-date').value = ed.toISOString().split('T')[0];
    } else {
      document.getElementById('cf-end-date').value = '';
    }

    var preview = document.getElementById('cf-image-preview');
    var removeBtn = document.getElementById('cf-remove-image');
    if (course && course.imageUrl) {
      preview.src = course.imageUrl;
      preview.style.display = 'block';
      removeBtn.style.display = 'inline-block';
    } else {
      preview.src = '';
      preview.style.display = 'none';
      removeBtn.style.display = 'none';
    }

    document.getElementById('cf-modal-title').textContent = course ? 'تعديل الكورس' : 'إضافة كورس جديد';
    modal.classList.remove('hidden');
  }

  function handleCourseFormSubmit(e) {
    e.preventDefault();
    var form = e.target;
    var id = document.getElementById('cf-id').value;
    var title = (document.getElementById('cf-title').value || '').trim();
    var shortDescription = (document.getElementById('cf-short-desc').value || '').trim();
    var imageUrl = (document.getElementById('cf-image-url').value || '').trim();
    var price = parseFloat(document.getElementById('cf-price').value) || 0;
    var paymentMethod = document.getElementById('cf-payment-method').value;
    var duration = (document.getElementById('cf-duration').value || '').trim();
    var lessonsCount = parseInt(document.getElementById('cf-lessons').value) || 0;
    var targetAudience = (document.getElementById('cf-target-audience').value || '').trim();
    var startDate = document.getElementById('cf-start-date').value;
    var endDate = document.getElementById('cf-end-date').value;
    var isActive = document.getElementById('cf-is-active').checked;

    if (!title) {
      if (typeof showToast === 'function') showToast('يرجى إدخال عنوان الكورس', 'error');
      return;
    }

    var submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'جاري الحفظ... <i class="bx bx-loader-alt bx-spin"></i>';
    }

    var data = {
      title: title,
      shortDescription: shortDescription,
      imageUrl: imageUrl,
      price: price,
      paymentMethod: paymentMethod,
      duration: duration,
      lessonsCount: lessonsCount,
      targetAudience: targetAudience,
      startDate: startDate ? firebase.firestore.Timestamp.fromDate(new Date(startDate)) : null,
      endDate: endDate ? firebase.firestore.Timestamp.fromDate(new Date(endDate)) : null,
      isActive: isActive,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var action = id ? 'update' : 'add';
    var docId = id || null;
    if (!id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    SyncService.executeDbOperation('summerCourses', action, docId, data)
      .then(function () {
        console.log('[SC] Course saved successfully:', action, title);
        if (typeof showToast === 'function') showToast(id ? '✅ تم تعديل الكورس' : '✅ تم إضافة الكورس');
        document.getElementById('course-form-modal').classList.add('hidden');
      })
      .catch(function (err) {
        console.error('[SC] Save course error:', err);
        if (typeof showToast === 'function') showToast('حدث خطأ في الحفظ', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = id ? 'تعديل الكورس' : 'إضافة الكورس';
        }
      });
  }

  // ─── Admin Stats ──────────────────────────────
  function loadAdminStats() {
    var total = allCourses.length;
    var active = allCourses.filter(function (c) { return c.isActive; }).length;
    var inactive = total - active;

    var totalEl = document.getElementById('sc-stat-total');
    var activeEl = document.getElementById('sc-stat-active');
    var inactiveEl = document.getElementById('sc-stat-inactive');
    var subsEl = document.getElementById('sc-stat-subs');

    if (totalEl) animateCount(totalEl, total);
    if (activeEl) animateCount(activeEl, active);
    if (inactiveEl) animateCount(inactiveEl, inactive);
    if (subsEl) animateCount(subsEl, subscriptions.length);

    var topCourseEl = document.getElementById('sc-stat-top');
    if (topCourseEl && subscriptions.length > 0) {
      var counts = {};
      subscriptions.forEach(function (s) {
        counts[s.courseId] = (counts[s.courseId] || 0) + 1;
      });
      var entries = Object.entries(counts).sort(function (a, b) { return b[1] - a[1]; });
      var topId = entries[0][0];
      var topCourse = allCourses.find(function (c) { return c.id === topId; });
      topCourseEl.textContent = topCourse ? topCourse.title + ' (' + entries[0][1] + ' مشترك)' : 'لا توجد بيانات';
    } else if (topCourseEl) {
      topCourseEl.textContent = 'لا توجد اشتراكات';
    }
  }

  function loadSubscriptions() {
    window.__fbTracker && window.__fbTracker.add();
    if (!window.db) { window.__fbTracker && window.__fbTracker.done(); return; }
    var _subDone = false;
    window.db.collection('courseSubscriptions')
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        if (!_subDone) { _subDone = true; window.__fbTracker && window.__fbTracker.done(); }
        subscriptions = [];
        snapshot.forEach(function (doc) {
          var subData = doc.data();
          subData.id = doc.id;
          subscriptions.push(subData);
        });
        loadAdminStats();
        renderSubscriptions();
        updateSummerBadge();
      }, function (err) {
        if (!_subDone) { _subDone = true; window.__fbTracker && window.__fbTracker.done(); }
        console.error('[SC] Subscriptions error:', err);
      });
  }

  function renderSubscriptions() {
    var container = document.getElementById('sc-subscriptions-list');
    if (!container) return;

    // Filter by selected tab
    var filtered = subscriptions;
    if (currentSubFilter === 'pending') {
      filtered = subscriptions.filter(function (s) { return s.status === 'pending'; });
    } else if (currentSubFilter === 'confirmed') {
      filtered = subscriptions.filter(function (s) { return s.status === 'confirmed'; });
    }

    if (filtered.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);">لا توجد اشتراكات في هذا القسم</div>';
      return;
    }

    container.innerHTML = '';
    filtered.slice(0, 50).forEach(function (sub) {
      var card = document.createElement('div');
      card.className = 'sub-card';
      var statusLabel = sub.status === 'pending' ? 'قيد الانتظار' : 'مؤكد';
      var actionsHtml = '';
      actionsHtml =
        '<button class="btn-icon edit-sub-btn" data-phone="' + (sub.phone || '') + '" title="تعديل بيانات الطالب" style="background:var(--accent-dim);color:var(--accent);border:1px solid var(--border-active);font-size:12px;padding:4px 8px;border-radius:6px;cursor:pointer;"><i class="bx bx-edit"></i></button>';
      if (sub.status === 'pending') {
        actionsHtml +=
          '<button class="btn btn-success btn-sm confirm-sub-btn" data-id="' + sub.id + '" style="padding:4px 12px;font-size:12px;">تأكيد</button>' +
          '<button class="btn btn-danger btn-sm delete-sub-btn" data-id="' + sub.id + '" style="padding:4px 12px;font-size:12px;">حذف</button>';
      } else {
        actionsHtml +=
          '<button class="btn btn-danger btn-sm delete-sub-btn" data-id="' + sub.id + '" style="padding:4px 12px;font-size:12px;">حذف</button>';
      }

      var receiptHtml = '';
      if (sub.receiptImage) {
        receiptHtml = '<div class="sub-receipt"><img src="' + sub.receiptImage + '" class="sub-receipt-thumb" data-sub-id="' + sub.id + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border);" title="عرض الإيصال"></div>';
      }

      card.innerHTML =
        '<div class="sub-card-header">' +
          '<strong>' + (sub.name || '—') + '</strong>' +
          '<span class="sub-status ' + (sub.status || 'pending') + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="sub-card-body">' +
          '<span><i class="bx bxs-phone"></i> ' + (sub.phone || '—') + '</span>' +
          '<span><i class="bx bxs-graduation"></i> ' + (getGradeName(sub.grade) || '—') + '</span>' +
          '<span>📚 ' + (sub.courseTitle || '—') + '</span>' +
          '<span>💰 ' + getPaymentMethodLabel(sub.paymentMethod) + '</span>' +
          (sub.receiptImage ? '<span class="sub-receipt-row">🧾 الإيصال: ' + receiptHtml + '</span>' : '') +
        '</div>' +
        '<div class="sub-card-footer">' +
          '<small>' + timeAgo(sub.createdAt) + '</small>' +
          actionsHtml +
        '</div>';
      container.appendChild(card);
    });

    document.querySelectorAll('.confirm-sub-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        SyncService.executeDbOperation('courseSubscriptions', 'update', id, { status: 'confirmed' })
          .then(function () { if (typeof showToast === 'function') showToast('✅ تم تأكيد الاشتراك'); })
          .catch(function (err) { if (typeof showToast === 'function') showToast('خطأ', 'error'); });
      });
    });

    document.querySelectorAll('.delete-sub-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = this.getAttribute('data-id');
        if (confirm('حذف هذا الاشتراك؟')) {
          SyncService.executeDbOperation('courseSubscriptions', 'delete', id, null)
            .then(function () { if (typeof showToast === 'function') showToast('تم الحذف'); })
            .catch(function (err) { if (typeof showToast === 'function') showToast('خطأ', 'error'); });
        }
      });
    });

    document.querySelectorAll('.edit-sub-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var phone = this.getAttribute('data-phone');
        if (!phone) return;
        var cleanPhone = phone.toString().replace(/\D/g, '');
        var student = null;
        if (typeof studentsData !== 'undefined') {
          student = studentsData.find(function (s) {
            return (s.phone || '').toString().replace(/\D/g, '') === cleanPhone;
          });
        }
        if (student && typeof openEditModal === 'function') {
          openEditModal(student);
        } else {
          if (typeof showToast === 'function') showToast('لم يتم العثور على الطالب في قاعدة البيانات', 'error');
        }
      });
    });

    // Receipt thumbnail click handler
    container.querySelectorAll('.sub-receipt-thumb').forEach(function (img) {
      img.addEventListener('click', function () {
        var subId = this.getAttribute('data-sub-id');
        var sub = subscriptions.find(function (s) { return s.id === subId; });
        if (!sub || !sub.receiptImage) return;
        var existing = document.getElementById('receipt-viewer-overlay');
        if (existing) existing.remove();
        var overlay = document.createElement('div');
        overlay.id = 'receipt-viewer-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        overlay.innerHTML =
          '<div style="position:relative;max-width:90vw;max-height:90vh;">' +
            '<button id="rv-close" style="position:absolute;top:-40px;right:0;background:none;border:none;color:#fff;font-size:30px;cursor:pointer;">✕</button>' +
            '<img src="' + sub.receiptImage + '" style="max-width:100%;max-height:90vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.5);">' +
          '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay || e.target.id === 'rv-close') overlay.remove();
        });
      });
    });
  }

  // ─── Badge: Update pending subscription count ─
  function updateSummerBadge() {
    var pendingCount = subscriptions.filter(function (s) { return s.status === 'pending'; }).length;
    var badges = ['summer-badge', 'summer-badge-mobile', 'summer-badge-mobile2'];
    badges.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = pendingCount;
        el.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
    });
  }

  // ─── Utility: Animate Count ──────────────────
  function animateCount(el, target, duration) {
    duration = duration || 800;
    if (!el) return;
    var start = performance.now();
    function step(now) {
      var progress = Math.min((now - start) / duration, 1);
      var ease = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(ease * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ─── Refresh user subscriptions (one-time fetch, no new listener) ──
  function refreshUserSubscriptions() {
    try {
      var stored = JSON.parse(localStorage.getItem('el_mistar_current_user'));
      if (stored && stored.phone && stored.name) {
        loadUserSubscriptions(stored);
      } else {
        userSubscribedIds = {};
        renderPublicCourses();
      }
    } catch (e) {
      userSubscribedIds = {};
      renderPublicCourses();
    }
  }

  // ─── Public API ────────────────────────────────
  return {
    init: init,
    loadPublicCourses: loadPublicCourses,
    renderAdminCourses: renderAdminCourses,
    openSubscribeModal: openSubscribeModal,
    directSubscribe: directSubscribe,
    handleSubscribeSubmit: handleSubscribeSubmit,
    openCourseForm: openCourseForm,
    handleCourseFormSubmit: handleCourseFormSubmit,
    setupImageUpload: setupImageUpload,
    refreshUserSubscriptions: refreshUserSubscriptions,
    setUserSubscribed: function (courseId) {
      userSubscribedIds[courseId] = 'pending';
      renderPublicCourses();
    }
  };
})();

// ─── Auto-init on DOMContentLoaded ─────────────
document.addEventListener('DOMContentLoaded', function () {
  SummerCourses.init();

  // Subscribe modal
  var subModal = document.getElementById('subscribe-modal');
  if (subModal) {
    var subClose = document.getElementById('sub-close');
    if (subClose) subClose.addEventListener('click', function () {
      subModal.classList.remove('active');
      var info = document.getElementById('sub-payment-info');
      if (info) info.style.display = 'none';
    });
    subModal.addEventListener('click', function (e) {
      if (e.target === this) {
        this.classList.remove('active');
        var info = document.getElementById('sub-payment-info');
        if (info) info.style.display = 'none';
      }
    });
    var subForm = document.getElementById('sub-form');
    if (subForm) subForm.addEventListener('submit', SummerCourses.handleSubscribeSubmit);
    // Show/hide payment info when payment method changes
    var subPayMethod = document.getElementById('sub-payment-method');
    if (subPayMethod) {
      subPayMethod.addEventListener('change', function () {
        var info = document.getElementById('sub-payment-info');
        if (info) {
          if (this.value === 'cash') {
            info.innerHTML = '📌 سيتم الدفع داخل السنتر. سنتواصل معك قريباً.';
            info.style.background = '#fef3c7';
            info.style.color = '#92400e';
          } else {
            info.innerHTML = '📌 بعد إتمام الحجز، سيطلب منك رفع إيصال الدفع أونلاين.';
            info.style.background = '#eff6ff';
            info.style.color = '#1e40af';
          }
          info.style.display = 'block';
        }
      });
    }
  }

  // Course form modal (admin)
  var cfModal = document.getElementById('course-form-modal');
  if (cfModal) {
    var cfClose = document.getElementById('cf-close');
    if (cfClose) cfClose.addEventListener('click', function () { cfModal.classList.add('hidden'); });
    var cfCancel = document.getElementById('cf-cancel');
    if (cfCancel) cfCancel.addEventListener('click', function () { cfModal.classList.add('hidden'); });
    cfModal.addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });
    var cfForm = document.getElementById('course-form');
    if (cfForm) cfForm.addEventListener('submit', SummerCourses.handleCourseFormSubmit);
    SummerCourses.setupImageUpload();
  }

  // Admin search/filter/sort — re-render on change
  var scSearch = document.getElementById('sc-search');
  var scFilter = document.getElementById('sc-filter');
  var scSort = document.getElementById('sc-sort');
  if (scSearch) scSearch.addEventListener('input', function () { renderAdminCoursesGlobal(); });
  if (scFilter) scFilter.addEventListener('change', function () { renderAdminCoursesGlobal(); });
  if (scSort) scSort.addEventListener('change', function () { renderAdminCoursesGlobal(); });

  // Admin add course button
  var scAddBtn = document.getElementById('sc-add-btn');
  if (scAddBtn) scAddBtn.addEventListener('click', function () { SummerCourses.openCourseForm(null); });

});

function renderAdminCoursesGlobal() {
  if (typeof SummerCourses.renderAdminCourses === 'function') {
    SummerCourses.renderAdminCourses();
  }
}

// ─── Expose to global scope ────────────────────
window.SummerCourses = SummerCourses;
