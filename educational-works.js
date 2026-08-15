// ============================================
// EDUCATIONAL WORKS SYSTEM - ElMistar
// Firestore is the ONLY source of truth.
// Collections:
//   - educationalWorks            (works/memos/curricula)
//   - settings/educationalWorksConfig (categories array)
//   - workbookPurchases           (purchase requests with receipts)
// ============================================

const EducationalWorks = (function () {
  // ─── State ─────────────────────────────────────
  let allWorks = [];
  let categories = [];
  let purchases = [];
  let userPurchases = {}; // workId -> { status, id }
  let currentFilter = 'all';
  let currentSearch = '';

  // ─── Helpers ───────────────────────────────────
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function validateUrl(url) {
    return url && typeof url === 'string' &&
      (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/'));
  }

  function getDefaultImage() {
    return 'img/logo.png';
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

  function getPhoneVariants(phone) {
    const cleaned = (phone || '').toString().replace(/\D/g, '');
    if (!cleaned) return [];
    const noZero = cleaned.replace(/^0+/, '');
    const withZero = '0' + noZero;
    return withZero === noZero ? [withZero] : [withZero, noZero];
  }

  function getCurrentUser() {
    try {
      const stored = localStorage.getItem('el_mistar_current_user');
      if (stored && stored !== 'undefined') return JSON.parse(stored);
    } catch (e) { }
    return null;
  }

  function getCategoryLabel(id) {
    if (!id) return '';
    const c = categories.find(function (x) { return x.id === id; });
    return c ? c.label : '';
  }

  // Database wrapper with offline support (SyncService) + direct fallback
  function dbOp(collection, action, docId, data) {
    if (window.SyncService && typeof window.SyncService.executeDbOperation === 'function') {
      return window.SyncService.executeDbOperation(collection, action, docId, data);
    }
    if (!window.db) return Promise.reject('Firestore not initialized');
    const col = window.db.collection(collection);
    if (action === 'add') return col.add(data);
    if (action === 'update') return col.doc(docId).update(data);
    if (action === 'delete') return col.doc(docId).delete();
    if (action === 'set') return col.doc(docId).set(data);
    return Promise.reject('Unknown action');
  }

  function compressImage(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = function () { reject(new Error('Failed to load image')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Failed to read file')); };
      reader.readAsDataURL(file);
    });
  }

  // ─── Categories (shared) ───────────────────────
  function fetchCategories() {
    return window.db.collection('settings').doc('educationalWorksConfig').get()
      .then(function (doc) {
        categories = (doc.exists && Array.isArray(doc.data().categories)) ? doc.data().categories.slice() : [];
        categories.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
        return categories;
      })
      .catch(function (err) {
        console.error('[EW] categories fetch error:', err);
        categories = [];
        return categories;
      });
  }

  // ═══════════════════════════════════════════════
  // PUBLIC SECTION (index.html)
  // ═══════════════════════════════════════════════
  function loadPublicWorks() {
    window.__fbTracker && window.__fbTracker.add();
    if (!window.db) {
      console.error('[EW] window.db is not available!');
      window.__fbTracker && window.__fbTracker.done();
      hideSkeleton();
      showEmptyState();
      return;
    }
    Promise.all([
      window.db.collection('educationalWorks').get(),
      fetchCategories()
    ]).then(function (results) {
      window.__fbTracker && window.__fbTracker.done();
      const snapshot = results[0];
      allWorks = [];
      snapshot.forEach(function (doc) {
        const w = doc.data();
        w.id = doc.id;
        allWorks.push(w);
      });
      renderPublic();
      const user = getCurrentUser();
      if (user && user.phone) {
        loadUserPurchases(user.phone);
      } else {
        userPurchases = {};
      }
    }).catch(function (err) {
      window.__fbTracker && window.__fbTracker.done();
      console.error('[EW] load public works error:', err);
      hideSkeleton();
      showEmptyState();
      if (typeof showToast === 'function') {
        showToast('خطأ في تحميل الأعمال التعليمية', 'error');
      }
    });
  }

  function loadUserPurchases(phone) {
    const variants = getPhoneVariants(phone);
    if (variants.length === 0) return;
    const q = variants.length === 1
      ? window.db.collection('workbookPurchases').where('studentPhone', '==', variants[0])
      : window.db.collection('workbookPurchases').where('studentPhone', 'in', variants);
    q.onSnapshot(function (snap) {
      userPurchases = {};
      snap.forEach(function (doc) {
        const p = doc.data();
        userPurchases[p.workId] = { status: p.status || 'pending', id: doc.id };
      });
      renderCards();
    }, function (err) {
      console.error('[EW] purchases snapshot error:', err);
    });
  }

  function hideSkeleton() {
    const sk = document.querySelector('.ew-skeleton');
    if (sk) sk.style.display = 'none';
  }

  function showEmptyState() {
    const es = document.querySelector('.ew-empty-state');
    if (es) es.style.display = 'block';
    const container = document.querySelector('.ew-cards-grid');
    if (container) container.innerHTML = '';
  }

  function ensureFilterBar() {
    if (document.querySelector('.ew-filter-bar')) return;
    const section = document.querySelector('#educational-works-section');
    if (!section) return;
    const bar = document.createElement('div');
    bar.className = 'ew-filter-bar';
    let catOptions = '<option value="all">كل التصنيفات</option>';
    categories.forEach(function (c) {
      catOptions += '<option value="' + c.id + '">' + escapeHtml(c.label) + '</option>';
    });
    bar.innerHTML =
      '<div class="ew-search-wrap">' +
        '<i class="bx bx-search"></i>' +
        '<input type="text" class="ew-search-input" id="ew-search-input" placeholder="ابحث عن ملزمة أو منهج...">' +
      '</div>' +
      '<div class="ew-category-select-wrap">' +
        '<select class="ew-category-select" id="ew-category-select">' + catOptions + '</select>' +
      '</div>';
    const refNode = section.querySelector('.ew-skeleton') || section.querySelector('.ew-cards-grid');
    if (refNode && refNode.parentNode === section) {
      section.insertBefore(bar, refNode);
    } else {
      section.appendChild(bar);
    }
    const searchInput = document.getElementById('ew-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        currentSearch = this.value.trim();
        renderCards();
      });
    }
    const catSelect = document.getElementById('ew-category-select');
    if (catSelect) {
      catSelect.addEventListener('change', function () {
        currentFilter = this.value;
        renderCards();
      });
    }
  }

  function renderPublic() {
    hideSkeleton();
    renderCards();
  }

  function renderCards() {
    const container = document.querySelector('.ew-cards-grid');
    const emptyState = document.querySelector('.ew-empty-state');
    if (!container) return;

    let visible = allWorks.filter(function (w) { return w.isActive === true; });

    if (currentFilter !== 'all') {
      visible = visible.filter(function (w) { return (w.category || '') === currentFilter; });
    }
    const q = currentSearch.toLowerCase();
    if (q) {
      visible = visible.filter(function (w) {
        return (w.title || '').toLowerCase().indexOf(q) !== -1 ||
               (w.description || '').toLowerCase().indexOf(q) !== -1 ||
               (w.targetAudience || '').toLowerCase().indexOf(q) !== -1;
      });
    }
    visible.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });

    if (visible.length === 0) {
      container.innerHTML = '';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    container.innerHTML = '';
    visible.forEach(function (work) {
      container.appendChild(buildWorkCard(work));
    });
    bindCardEvents(container);
  }

  function buildWorkCard(work) {
    const card = document.createElement('div');
    card.className = 'ew-card ew-card-visible';

    const imgUrl = validateUrl(work.imageUrl) ? work.imageUrl : getDefaultImage();
    const priceBadge = work.price > 0 ? escapeHtml(work.price) + '<small> ج.م</small>' : 'مجاني';
    const priceClass = work.price > 0 ? '' : ' ew-price-free';
    const catLabel = getCategoryLabel(work.category);
    const audience = work.targetAudience || '';

    const state = userPurchases[work.id] || null;
    const confirmed = state && state.status === 'confirmed';
    const pending = state && state.status === 'pending';

    let actions = '';
    if (work.price > 0) {
      if (confirmed) {
        let cols = '';
        if (work.previewUrl) {
          cols += '<a class="ew-card-btn ew-card-btn-preview ew-card-btn-preview-sm" href="' + work.previewUrl + '" target="_blank" rel="noopener"><i class="bx bx-book-open"></i> معاينة</a>';
        }
        if (work.linkUrl) {
          cols += '<a class="ew-card-btn ew-card-btn-download" href="' + work.linkUrl + '" target="_blank" rel="noopener"><i class="bx bx-download"></i> تحميل</a>';
        }
        if (!cols) cols = '<span class="ew-card-btn" style="background:#cbd5e1!important;cursor:default;box-shadow:none;">تم الشراء ✓</span>';
        actions = '<div class="ew-btn-group-2col">' + cols + '</div>' +
          '<span class="ew-purchase-confirmed-badge">✅ تم شراؤه وتفعيله</span>';
      } else if (pending) {
        actions = '<button type="button" class="ew-card-btn ew-card-btn-buy" style="opacity:.8;"><i class="bx bx-time-five"></i> قيد المراجعة</button>' +
          '<span class="ew-purchase-confirmed-badge" style="color:#d97706;">⏳ بانتظار تأكيد الدفع</span>';
      } else {
        actions = '<button type="button" class="ew-card-btn ew-card-btn-buy" data-id="' + work.id + '"><i class="bx bx-cart-add"></i> شراء الملزمة</button>';
      }
    } else {
      let cols = '';
      if (work.previewUrl) {
        cols += '<a class="ew-card-btn ew-card-btn-preview ew-card-btn-preview-sm" href="' + work.previewUrl + '" target="_blank" rel="noopener"><i class="bx bx-book-open"></i> معاينة</a>';
      }
      if (work.linkUrl) {
        cols += '<a class="ew-card-btn ew-card-btn-download" href="' + work.linkUrl + '" target="_blank" rel="noopener"><i class="bx bx-download"></i> تحميل مجاني</a>';
      }
      if (!cols) cols = '<span class="ew-card-btn" style="background:#cbd5e1!important;cursor:default;box-shadow:none;">تواصل معنا للتفاصيل</span>';
      actions = '<div class="ew-btn-group-2col">' + cols + '</div>';
    }

    card.innerHTML =
      '<div class="ew-card-img-wrap">' +
        '<img class="ew-card-img" src="' + imgUrl + '" alt="' + escapeHtml(work.title || '') + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + getDefaultImage() + '\';">' +
        (catLabel ? '<span class="ew-card-badge">' + escapeHtml(catLabel) + '</span>' : '') +
        '<span class="ew-price-badge' + priceClass + '">' + priceBadge + '</span>' +
      '</div>' +
      '<div class="ew-card-body">' +
        (audience ? '<span class="ew-audience-badge">🎯 ' + escapeHtml(audience) + '</span>' : '') +
        '<h3 class="ew-card-title">' + escapeHtml(work.title || 'بدون عنوان') + '</h3>' +
        (work.description ? '<p class="ew-card-desc">' + escapeHtml(work.description) + '</p>' : '') +
        (work.details ? '<div class="ew-details-toggle"><button type="button" class="ew-details-btn">التفاصيل ▾</button><div class="ew-details-content" style="display:none;">' + escapeHtml(work.details) + '</div></div>' : '') +
        '<div class="ew-card-actions"><div class="ew-btn-group">' + actions + '</div></div>' +
      '</div>';
    return card;
  }

  function bindCardEvents(container) {
    container.querySelectorAll('.ew-card-btn-buy').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        if (!id) return;
        const work = allWorks.find(function (w) { return w.id === id; });
        if (work) startPurchase(work);
      });
    });
    container.querySelectorAll('.ew-details-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const content = btn.nextElementSibling;
        if (!content) return;
        const isOpen = content.style.display !== 'none';
        content.style.display = isOpen ? 'none' : 'block';
        btn.textContent = isOpen ? 'التفاصيل ▾' : 'التفاصيل ▴';
      });
    });
  }

  function startPurchase(work) {
    const user = getCurrentUser();
    if (!user) {
      if (typeof showToast === 'function') {
        showToast('يرجى تسجيل الدخول أولاً لشراء الملزمة', 'error');
      }
      if (typeof openModal === 'function') {
        openModal('authOverlay');
      } else {
        const ao = document.getElementById('authOverlay');
        if (ao) ao.classList.add('active');
      }
      return;
    }
    const payModal = document.getElementById('payment-modal');
    if (!payModal) {
      if (typeof showToast === 'function') showToast('نظام الدفع غير متاح حالياً', 'error');
      return;
    }
    payModal.setAttribute('data-workbook-pending-work-id', work.id);
    payModal.setAttribute('data-workbook-pending-title', work.title || '');
    payModal.setAttribute('data-workbook-pending-price', work.price || 0);
    const amount = document.getElementById('payment-amount');
    if (amount) amount.value = work.price || 0;
    const submitBtn = document.getElementById('submit-payment-btn');
    if (submitBtn) submitBtn.disabled = true;
    if (typeof openModal === 'function') {
      openModal('payment-modal');
    } else {
      payModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    if (typeof showToast === 'function') {
      showToast('أرفق صورة إيصال الدفع لتأكيد شراء "' + (work.title || '') + '"', 'info');
    }
  }

  // ═══════════════════════════════════════════════
  // ADMIN SECTION (admin.html)
  // ═══════════════════════════════════════════════
  function loadCategories() {
    if (!window.db) return;
    fetchCategories().then(function () {
      populateCategorySelects();
    });
  }

  function populateCategorySelects() {
    const catSelect = document.getElementById('ew-category');
    const filterSelect = document.getElementById('ew-admin-filter');
    let options = '<option value="">بدون تصنيف</option>';
    categories.forEach(function (c) {
      options += '<option value="' + c.id + '">' + escapeHtml(c.label) + '</option>';
    });
    if (catSelect) catSelect.innerHTML = options;
    if (filterSelect) {
      filterSelect.innerHTML = '<option value="all">الكل</option>' + options;
    }
    renderAdminTable();
    renderCategoriesModalList();
  }

  function loadAdminWorks() {
    window.__fbTracker && window.__fbTracker.add();
    if (!window.db) { window.__fbTracker && window.__fbTracker.done(); return; }
    let _ewDone = false;
    window.db.collection('educationalWorks')
      .onSnapshot(function (snapshot) {
        if (!_ewDone) { _ewDone = true; window.__fbTracker && window.__fbTracker.done(); }
        allWorks = [];
        snapshot.forEach(function (doc) {
          const w = doc.data();
          w.id = doc.id;
          allWorks.push(w);
        });
        renderAdminTable();
        renderAdminStats();
      }, function (err) {
        if (!_ewDone) { _ewDone = true; window.__fbTracker && window.__fbTracker.done(); }
        console.error('[EW] works snapshot error:', err);
      });
  }

  function renderAdminTable() {
    const tbody = document.querySelector('#ew-table tbody');
    if (!tbody) return;

    let filtered = allWorks.slice();
    const searchEl = document.getElementById('ew-admin-search');
    const filterEl = document.getElementById('ew-admin-filter');
    const sortEl = document.getElementById('ew-admin-sort');
    const searchVal = searchEl ? searchEl.value.toLowerCase().trim() : '';
    const catFilter = filterEl ? filterEl.value : 'all';
    const sortVal = sortEl ? sortEl.value : 'order';

    if (searchVal) {
      filtered = filtered.filter(function (w) {
        return (w.title || '').toLowerCase().indexOf(searchVal) !== -1 ||
               (w.description || '').toLowerCase().indexOf(searchVal) !== -1 ||
               (w.targetAudience || '').toLowerCase().indexOf(searchVal) !== -1;
      });
    }
    if (catFilter !== 'all') {
      filtered = filtered.filter(function (w) { return (w.category || '') === catFilter; });
    }
    if (sortVal === 'title') {
      filtered.sort(function (a, b) { return (a.title || '').localeCompare(b.title || '', 'ar'); });
    } else if (sortVal === 'order-desc') {
      filtered.sort(function (a, b) { return (b.order || 0) - (a.order || 0); });
    } else {
      filtered.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    }

    const countEl = document.getElementById('ew-count');
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);"><i class="bx bx-search-alt" style="font-size:40px;display:block;margin-bottom:10px;"></i>لا توجد أعمال</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    filtered.forEach(function (w) {
      const tr = document.createElement('tr');
      const imgUrl = validateUrl(w.imageUrl) ? w.imageUrl : getDefaultImage();
      const price = w.price > 0 ? escapeHtml(w.price) + ' ج.م' : '<span style="color:var(--green);font-weight:800;">مجاني</span>';
      const catLabel = getCategoryLabel(w.category) || '—';
      const statusColor = w.isActive ? 'var(--green)' : 'var(--text-muted)';
      const statusLabel = w.isActive ? 'منشور' : 'مسودة';
      let links = '';
      if (w.previewUrl) {
        links += '<a href="' + w.previewUrl + '" target="_blank" rel="noopener" class="btn-icon" title="معاينة" style="color:#10b981;"><i class="bx bx-book-open"></i></a> ';
      }
      if (w.linkUrl) {
        links += '<a href="' + w.linkUrl + '" target="_blank" rel="noopener" class="btn-icon" title="رابط العمل" style="color:#3b82f6;"><i class="bx bx-link-external"></i></a> ';
      }
      if (!links) links = '—';

      tr.innerHTML =
        '<td><div style="display:flex;align-items:center;gap:10px;">' +
          '<img src="' + imgUrl + '" style="width:44px;height:44px;border-radius:10px;object-fit:cover;border:1px solid var(--border);" onerror="this.src=\'' + getDefaultImage() + '\';this.onerror=null;">' +
          '<div><strong>' + escapeHtml(w.title || 'بدون عنوان') + '</strong><div style="font-size:12px;color:var(--text-muted);max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(w.description || '') + '</div></div>' +
        '</div></td>' +
        '<td>' + catLabel + '</td>' +
        '<td>' + price + '</td>' +
        '<td>' + escapeHtml(w.targetAudience || '—') + '</td>' +
        '<td>' + (w.order || 0) + '</td>' +
        '<td>' + links + '</td>' +
        '<td>' +
          '<button type="button" class="btn-icon toggle-ew-btn" data-id="' + w.id + '" data-active="' + !!w.isActive + '" style="color:' + statusColor + ';" title="' + (w.isActive ? 'إخفاء' : 'نشر') + '"><i class="bx ' + (w.isActive ? 'bx-toggle-right' : 'bx-toggle-left') + '"></i></button> ' +
          '<span style="font-size:12px;font-weight:700;color:' + statusColor + '">' + statusLabel + '</span>' +
        '</td>' +
        '<td><div style="display:flex;gap:6px;">' +
          '<button type="button" class="btn-icon edit-ew-btn" data-id="' + w.id + '" title="تعديل"><i class="bx bx-edit"></i></button>' +
          '<button type="button" class="btn-icon danger delete-ew-btn" data-id="' + w.id + '" title="حذف"><i class="bx bx-trash"></i></button>' +
        '</div></td>';
      tbody.appendChild(tr);
    });
    bindAdminRowEvents(tbody);
  }

  function bindAdminRowEvents(tbody) {
    tbody.querySelectorAll('.toggle-ew-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        const isActive = btn.getAttribute('data-active') === 'true';
        dbOp('educationalWorks', 'update', id, { isActive: !isActive })
          .then(function () {
            if (typeof showToast === 'function') showToast(isActive ? 'تم الإخفاء' : '✅ تم النشر');
          })
          .catch(function (err) {
            console.error('[EW] toggle error:', err);
            if (typeof showToast === 'function') showToast('خطأ في التحديث', 'error');
          });
      });
    });
    tbody.querySelectorAll('.edit-ew-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const w = allWorks.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        if (w) openEWForm(w);
      });
    });
    tbody.querySelectorAll('.delete-ew-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const w = allWorks.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        if (w && confirm('هل أنت متأكد من حذف "' + (w.title || '') + '"؟')) {
          dbOp('educationalWorks', 'delete', w.id, null)
            .then(function () {
              if (typeof showToast === 'function') showToast('✅ تم الحذف');
            })
            .catch(function (err) {
              console.error('[EW] delete error:', err);
              if (typeof showToast === 'function') showToast('خطأ في الحذف', 'error');
            });
        }
      });
    });
  }

  function renderAdminStats() {
    const totalEl = document.getElementById('ew-stat-total');
    const activeEl = document.getElementById('ew-stat-active');
    const draftsEl = document.getElementById('ew-stat-drafts');
    const total = allWorks.length;
    const active = allWorks.filter(function (w) { return w.isActive; }).length;
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (draftsEl) draftsEl.textContent = total - active;
  }

  function openEWForm(work) {
    const modal = document.getElementById('ew-form-modal');
    if (!modal) return;

    document.getElementById('ew-id').value = work ? work.id : '';
    document.getElementById('ew-title').value = work ? (work.title || '') : '';
    document.getElementById('ew-desc').value = work ? (work.description || '') : '';
    document.getElementById('ew-link-url').value = work ? (work.linkUrl || '') : '';
    document.getElementById('ew-preview-url').value = work ? (work.previewUrl || '') : '';
    document.getElementById('ew-target-audience').value = work ? (work.targetAudience || '') : '';
    document.getElementById('ew-price').value = work ? (work.price || 0) : 0;
    document.getElementById('ew-details').value = work ? (work.details || '') : '';
    document.getElementById('ew-order').value = work ? (work.order || 0) : 0;
    document.getElementById('ew-is-active').checked = work ? !!work.isActive : true;

    const catSelect = document.getElementById('ew-category');
    if (catSelect) catSelect.value = work ? (work.category || '') : '';

    const imgUrlInput = document.getElementById('ew-image-url');
    const preview = document.getElementById('ew-image-preview');
    const removeBtn = document.getElementById('ew-remove-image');
    if (work && work.imageUrl) {
      imgUrlInput.value = work.imageUrl;
      preview.src = work.imageUrl;
      preview.style.display = 'block';
      removeBtn.style.display = 'inline-block';
    } else {
      imgUrlInput.value = '';
      preview.src = '';
      preview.style.display = 'none';
      removeBtn.style.display = 'none';
    }

    const titleEl = document.getElementById('ew-modal-title');
    if (titleEl) titleEl.innerHTML = work
      ? '<i class="bx bx-edit"></i> تعديل العمل'
      : '<i class="bx bx-plus-circle" style="color:var(--accent);"></i> إضافة عمل جديد';

    const submitBtn = modal.querySelector('#ew-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = work
      ? '<i class="bx bx-save"></i> حفظ التعديلات'
      : '<i class="bx bx-save"></i> إضافة العمل';

    modal.classList.remove('hidden');
  }

  function handleEWFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('ew-id').value;
    const title = (document.getElementById('ew-title').value || '').trim();
    if (!title) {
      if (typeof showToast === 'function') showToast('يرجى إدخال عنوان العمل', 'error');
      return;
    }
    const data = {
      title: title,
      description: (document.getElementById('ew-desc').value || '').trim(),
      imageUrl: (document.getElementById('ew-image-url').value || '').trim(),
      linkUrl: (document.getElementById('ew-link-url').value || '').trim(),
      previewUrl: (document.getElementById('ew-preview-url').value || '').trim(),
      targetAudience: (document.getElementById('ew-target-audience').value || '').trim(),
      price: parseFloat(document.getElementById('ew-price').value) || 0,
      details: (document.getElementById('ew-details').value || '').trim(),
      category: document.getElementById('ew-category').value,
      order: parseInt(document.getElementById('ew-order').value) || 0,
      isActive: document.getElementById('ew-is-active').checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    dbOp('educationalWorks', id ? 'update' : 'add', id || null, data)
      .then(function () {
        if (typeof showToast === 'function') showToast(id ? '✅ تم تعديل العمل' : '✅ تم إضافة العمل');
        const modal = document.getElementById('ew-form-modal');
        if (modal) modal.classList.add('hidden');
      })
      .catch(function (err) {
        console.error('[EW] save error:', err);
        if (typeof showToast === 'function') showToast('خطأ في الحفظ', 'error');
      });
  }

  // ─── Categories Manager ────────────────────────
  function renderCategoriesModalList() {
    const list = document.getElementById('ew-cat-list');
    if (!list) return;
    if (categories.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);">لا توجد تصنيفات بعد</div>';
      return;
    }
    list.innerHTML = '';
    categories.forEach(function (c, i) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--bg-card);';
      row.innerHTML =
        '<span style="font-weight:700;flex:1;">' + escapeHtml(c.label) + '</span>' +
        '<button type="button" class="btn-icon ew-cat-up" data-id="' + c.id + '" title="أعلى" ' + (i === 0 ? 'disabled style="opacity:.4;cursor:default;"' : '') + '><i class="bx bx-chevron-up"></i></button>' +
        '<button type="button" class="btn-icon ew-cat-down" data-id="' + c.id + '" title="أسفل" ' + (i === categories.length - 1 ? 'disabled style="opacity:.4;cursor:default;"' : '') + '><i class="bx bx-chevron-down"></i></button>' +
        '<button type="button" class="btn-icon ew-cat-edit" data-id="' + c.id + '" title="تعديل"><i class="bx bx-edit"></i></button>' +
        '<button type="button" class="btn-icon danger ew-cat-del" data-id="' + c.id + '" title="حذف"><i class="bx bx-trash"></i></button>';
      list.appendChild(row);
    });

    list.querySelectorAll('.ew-cat-up').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        const idx = categories.findIndex(function (c) { return c.id === btn.getAttribute('data-id'); });
        if (idx <= 0) return;
        const tmp = categories[idx - 1];
        categories[idx - 1] = categories[idx];
        categories[idx] = tmp;
        saveCategories();
      });
    });
    list.querySelectorAll('.ew-cat-down').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        const idx = categories.findIndex(function (c) { return c.id === btn.getAttribute('data-id'); });
        if (idx === -1 || idx >= categories.length - 1) return;
        const tmp = categories[idx + 1];
        categories[idx + 1] = categories[idx];
        categories[idx] = tmp;
        saveCategories();
      });
    });
    list.querySelectorAll('.ew-cat-edit').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const c = categories.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        if (!c) return;
        document.getElementById('ew-cat-id').value = c.id;
        document.getElementById('ew-cat-label').value = c.label || '';
        document.getElementById('ew-cat-order').value = c.order || 0;
        document.getElementById('ew-cat-save-btn').innerHTML = '<i class="bx bx-check"></i> حفظ';
        document.getElementById('ew-cat-label').focus();
      });
    });
    list.querySelectorAll('.ew-cat-del').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        if (!confirm('حذف هذا التصنيف؟ (الأعمال المرتبطة به لن تُحذف)')) return;
        categories = categories.filter(function (c) { return c.id !== id; });
        saveCategories();
      });
    });
  }

  function handleCategorySave() {
    const id = document.getElementById('ew-cat-id').value;
    const label = (document.getElementById('ew-cat-label').value || '').trim();
    if (!label) {
      if (typeof showToast === 'function') showToast('أدخل اسم التصنيف', 'error');
      return;
    }
    const order = parseInt(document.getElementById('ew-cat-order').value) || 0;
    if (id) {
      const c = categories.find(function (x) { return x.id === id; });
      if (c) { c.label = label; c.order = order; }
    } else {
      categories.push({ id: 'cat_' + Date.now(), label: label, order: order });
    }
    document.getElementById('ew-cat-id').value = '';
    document.getElementById('ew-cat-label').value = '';
    document.getElementById('ew-cat-order').value = '';
    document.getElementById('ew-cat-save-btn').innerHTML = '<i class="bx bx-plus"></i> إضافة';
    saveCategories();
  }

  function saveCategories() {
    categories.forEach(function (c, i) { c.order = i; });
    dbOp('settings', 'set', 'educationalWorksConfig', {
      categories: categories,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    })
      .then(function () {
        if (typeof showToast === 'function') showToast('✅ تم حفظ التصنيفات');
        populateCategorySelects();
      })
      .catch(function (err) {
        console.error('[EW] categories save error:', err);
        if (typeof showToast === 'function') showToast('خطأ في حفظ التصنيفات', 'error');
      });
  }

  // ─── Purchases (admin) ────────────────────────
  function loadPurchases() {
    if (!window.db) return;
    window.db.collection('workbookPurchases')
      .onSnapshot(function (snapshot) {
        purchases = [];
        snapshot.forEach(function (doc) {
          const p = doc.data();
          p.id = doc.id;
          purchases.push(p);
        });
        renderPurchases();
        updatePurchasesBadge();
      }, function (err) {
        console.error('[EW] purchases error:', err);
      });
  }

  function renderPurchases() {
    const container = document.getElementById('ew-purchases-list');
    if (!container) return;

    if (purchases.length === 0) {
      container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);"><i class="bx bx-cart" style="font-size:36px;display:block;margin-bottom:8px;"></i>لا توجد طلبات شراء بعد</div>';
      updatePurchasesStats();
      return;
    }

    purchases.sort(function (a, b) {
      return ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0);
    });

    container.innerHTML = '';
    purchases.slice(0, 50).forEach(function (p) {
      const card = document.createElement('div');
      card.className = 'sub-card';
      const isConfirmed = p.status === 'confirmed';
      const statusLabel = isConfirmed ? 'مؤكد' : 'قيد الانتظار';
      const statusClass = isConfirmed ? 'confirmed' : 'pending';

      let actions = '';
      if (!isConfirmed) {
        actions += '<button type="button" class="btn btn-success btn-sm confirm-purchase-btn" data-id="' + p.id + '" style="padding:4px 12px;font-size:12px;">تأكيد الدفع</button>';
      }
      actions += '<button type="button" class="btn btn-danger btn-sm delete-purchase-btn" data-id="' + p.id + '" style="padding:4px 12px;font-size:12px;">حذف</button>';

      const receiptHtml = p.receiptImage
        ? '<span class="sub-receipt-row">🧾 الإيصال: <img src="' + p.receiptImage + '" class="sub-receipt-thumb ew-purchase-receipt" data-id="' + p.id + '" style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid var(--border);" title="عرض الإيصال"></span>'
        : '<span style="color:var(--text-muted);font-size:12px;">بدون إيصال</span>';

      let waLink = '';
      const phoneDigits = (p.studentPhone || '').toString().replace(/\D/g, '').replace(/^0/, '');
      if (phoneDigits) waLink = 'https://wa.me/20' + phoneDigits;

      card.innerHTML =
        '<div class="sub-card-header">' +
          '<strong>' + escapeHtml(p.studentName || p.studentPhone || '—') + '</strong>' +
          '<span class="sub-status ' + statusClass + '">' + statusLabel + '</span>' +
        '</div>' +
        '<div class="sub-card-body">' +
          '<span><i class="bx bxs-book"></i> ' + escapeHtml(p.workTitle || '—') + '</span>' +
          '<span><i class="bx bxs-phone"></i> ' + escapeHtml(p.studentPhone || '—') + '</span>' +
          '<span>💰 ' + (p.price ? escapeHtml(p.price) + ' ج.م' : 'مجاني') + '</span>' +
          '<span>💳 ' + escapeHtml(p.paymentMethod || '—') + '</span>' +
          receiptHtml +
        '</div>' +
        '<div class="sub-card-footer">' +
          '<small>' + timeAgo(p.createdAt) + '</small>' +
          (waLink ? '<a href="' + waLink + '" target="_blank" rel="noopener" style="color:#25D366;font-weight:700;font-size:12px;display:inline-flex;align-items:center;gap:4px;"><i class="bx bxl-whatsapp"></i> واتساب</a>' : '') +
          '<div style="display:flex;gap:6px;">' + actions + '</div>' +
        '</div>';
      container.appendChild(card);
    });
    bindPurchaseEvents(container);
    updatePurchasesStats();
  }

  function bindPurchaseEvents(container) {
    container.querySelectorAll('.confirm-purchase-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        dbOp('workbookPurchases', 'update', id, { status: 'confirmed' })
          .then(function () {
            if (typeof showToast === 'function') showToast('✅ تم تأكيد الدفع وتمكين المعاينة');
          })
          .catch(function (err) {
            console.error('[EW] confirm purchase error:', err);
            if (typeof showToast === 'function') showToast('خطأ في التحديث', 'error');
          });
      });
    });
    container.querySelectorAll('.delete-purchase-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const id = btn.getAttribute('data-id');
        if (confirm('حذف طلب الشراء هذا؟')) {
          dbOp('workbookPurchases', 'delete', id, null)
            .then(function () {
              if (typeof showToast === 'function') showToast('تم الحذف');
            })
            .catch(function (err) {
              console.error('[EW] delete purchase error:', err);
              if (typeof showToast === 'function') showToast('خطأ في الحذف', 'error');
            });
        }
      });
    });
    container.querySelectorAll('.ew-purchase-receipt').forEach(function (img) {
      img.addEventListener('click', function () {
        const p = purchases.find(function (x) { return x.id === img.getAttribute('data-id'); });
        if (!p || !p.receiptImage) return;
        const existing = document.getElementById('receipt-viewer-overlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'receipt-viewer-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;';
        overlay.innerHTML =
          '<div style="position:relative;max-width:90vw;max-height:90vh;">' +
            '<button type="button" style="position:absolute;top:-40px;right:0;background:none;border:none;color:#fff;font-size:30px;cursor:pointer;">✕</button>' +
            '<img src="' + p.receiptImage + '" style="max-width:100%;max-height:90vh;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.5);">' +
          '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function (e) {
          if (e.target === overlay || e.target.tagName === 'BUTTON') overlay.remove();
        });
      });
    });
  }

  function updatePurchasesStats() {
    const totalEl = document.getElementById('ew-purchases-total');
    const pendingEl = document.getElementById('ew-purchases-pending');
    const confirmedEl = document.getElementById('ew-purchases-confirmed');
    const total = purchases.length;
    const pending = purchases.filter(function (p) { return p.status !== 'confirmed'; }).length;
    if (totalEl) totalEl.textContent = total;
    if (pendingEl) pendingEl.textContent = pending;
    if (confirmedEl) confirmedEl.textContent = total - pending;
  }

  function updatePurchasesBadge() {
    const pending = purchases.filter(function (p) { return p.status !== 'confirmed'; }).length;
    const el = document.getElementById('ew-purchases-count');
    if (el) {
      el.textContent = pending;
      el.style.display = pending > 0 ? 'inline-block' : 'none';
    }
  }

  // ─── Admin modal events & image upload ────────
  function setupAdminModalEvents() {
    const addBtn = document.getElementById('ew-add-btn');
    if (addBtn) addBtn.addEventListener('click', function () { openEWForm(null); });

    const catBtn = document.getElementById('ew-manage-categories-btn');
    if (catBtn) {
      catBtn.addEventListener('click', function () {
        const modal = document.getElementById('ew-categories-modal');
        if (modal) {
          modal.classList.remove('hidden');
          renderCategoriesModalList();
        }
      });
    }

    const ewModal = document.getElementById('ew-form-modal');
    const ewClose = document.getElementById('ew-close');
    const ewCancel = document.getElementById('ew-cancel');
    if (ewClose) ewClose.addEventListener('click', function () { ewModal.classList.add('hidden'); });
    if (ewCancel) ewCancel.addEventListener('click', function () { ewModal.classList.add('hidden'); });
    if (ewModal) ewModal.addEventListener('click', function (e) { if (e.target === ewModal) ewModal.classList.add('hidden'); });

    const ewForm = document.getElementById('ew-form');
    if (ewForm) ewForm.addEventListener('submit', handleEWFormSubmit);

    const catModal = document.getElementById('ew-categories-modal');
    const catClose = document.getElementById('ew-cat-close');
    if (catClose) catClose.addEventListener('click', function () { catModal.classList.add('hidden'); });
    if (catModal) catModal.addEventListener('click', function (e) { if (e.target === catModal) catModal.classList.add('hidden'); });

    const catSave = document.getElementById('ew-cat-save-btn');
    if (catSave) catSave.addEventListener('click', handleCategorySave);
    const catLabelInput = document.getElementById('ew-cat-label');
    if (catLabelInput) {
      catLabelInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); handleCategorySave(); }
      });
    }

    const searchEl = document.getElementById('ew-admin-search');
    const filterEl = document.getElementById('ew-admin-filter');
    const sortEl = document.getElementById('ew-admin-sort');
    if (searchEl) searchEl.addEventListener('input', renderAdminTable);
    if (filterEl) filterEl.addEventListener('change', renderAdminTable);
    if (sortEl) sortEl.addEventListener('change', renderAdminTable);
  }

  function setupEWImageUpload() {
    const fileInput = document.getElementById('ew-image-file');
    const preview = document.getElementById('ew-image-preview');
    const removeBtn = document.getElementById('ew-remove-image');
    const hiddenInput = document.getElementById('ew-image-url');
    const uploadZone = document.getElementById('ew-upload-zone');
    if (!fileInput || !hiddenInput) return;

    fileInput.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('حجم الصورة يتجاوز 5 ميجا', 'error');
        fileInput.value = '';
        return;
      }
      compressImage(file, 800, 0.7).then(function (dataUrl) {
        hiddenInput.value = dataUrl;
        if (preview) { preview.src = dataUrl; preview.style.display = 'block'; }
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (uploadZone) uploadZone.style.borderColor = '#6c63ff';
      }).catch(function () {
        if (typeof showToast === 'function') showToast('فشل في معالجة الصورة', 'error');
      });
    });

    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        hiddenInput.value = '';
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
        removeBtn.style.display = 'none';
        fileInput.value = '';
        if (uploadZone) uploadZone.style.borderColor = '';
      });
    }

    if (uploadZone) {
      uploadZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadZone.style.borderColor = '#6c63ff';
      });
      uploadZone.addEventListener('dragleave', function () {
        uploadZone.style.borderColor = '';
      });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadZone.style.borderColor = '';
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change'));
        }
      });
    }
  }

  // ─── Init ──────────────────────────────────────
  function init() {
    const isAdmin = !!document.getElementById('educational-works-view');
    if (isAdmin) {
      loadCategories();
      loadAdminWorks();
      loadPurchases();
      setupAdminModalEvents();
      setupEWImageUpload();
    } else if (document.querySelector('#educational-works-section')) {
      loadPublicWorks();
    }
  }

  // ─── Public API ────────────────────────────────
  return {
    init: init,
    renderAdminTable: renderAdminTable,
    openEWForm: openEWForm,
    refreshUserPurchases: function () {
      const user = getCurrentUser();
      if (user && user.phone) {
        loadUserPurchases(user.phone);
      } else {
        userPurchases = {};
        renderCards();
      }
    }
  };
})();

// ─── Auto-init on DOMContentLoaded ─────────────
document.addEventListener('DOMContentLoaded', function () {
  EducationalWorks.init();
});
