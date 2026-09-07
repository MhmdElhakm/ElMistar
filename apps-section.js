// ============================================
// WEB APPS SECTION - ElMistar
// Firestore collection: webApps
// ============================================

const WebApps = (function () {
  let allApps = [];

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDefaultImage() {
    return 'img/logo.png';
  }

  function formatDate(d) {
    if (!d) return '—';
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
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

  // ═══════════════════════════════════════════════
  // CACHE & DOCUMENT BUILDER
  // ═══════════════════════════════════════════════
  const CACHE_KEY = 'elmistar_web_apps_cache';

  function getCachedApps() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return null;
  }

  function setCachedApps(apps) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(apps));
    } catch (e) {
      try {
        const slim = (apps || []).map(function (a) {
          const c = Object.assign({}, a);
          if (c.thumbnail && c.thumbnail.length > 50000) c.thumbnail = '';
          if (c.favicon && c.favicon.length > 50000) c.favicon = '';
          return c;
        });
        localStorage.setItem(CACHE_KEY, JSON.stringify(slim));
      } catch (e2) {
        try { localStorage.removeItem(CACHE_KEY); } catch (e3) {}
      }
    }
  }

  function getAppUrl(app) {
    if (app && app.slug) {
      return 'view.html?id=' + encodeURIComponent(app.slug);
    }
    return 'view.html?id=' + encodeURIComponent((app && app.id) || '');
  }

  function safePreviewStore(app) {
    try {
      const copy = Object.assign({}, app);
      delete copy.thumbnail;
      sessionStorage.setItem('elmistar_app_preview', JSON.stringify(copy));
    } catch (e) {
      try { sessionStorage.setItem('elmistar_app_preview', JSON.stringify(app)); } catch (e2) {}
    }
  }

  function buildCompleteAppDocument(app) {
    if (!app) return '';
    const html = (app.htmlCode || '').trim();
    let css = (app.cssCode || '').trim();
    let js = (app.jsCode || '').trim();

    if (!html && !css && !js) return '';

    css = css.replace(/<\/style/gi, '<\\/style');
    js = js.replace(/<\/script/gi, '<\\/script');

    const isFullDoc = /<!DOCTYPE\s+html|<html[\s>]/i.test(html);

    if (isFullDoc) {
      let doc = html;

      if (css) {
        const styleTag = '\n<style id="elmistar-app-custom-css">\n' + css + '\n</style>\n';
        if (/<\/head>/i.test(doc)) {
          doc = doc.replace(/<\/head>/i, styleTag + '</head>');
        } else if (/<body/i.test(doc)) {
          doc = doc.replace(/<body/i, styleTag + '<body');
        } else {
          doc += styleTag;
        }
      }

      if (js) {
        const scriptTag = '\n<script id="elmistar-app-custom-js">\n' + js + '\n<\/script>\n';
        if (/<\/body>/i.test(doc)) {
          doc = doc.replace(/<\/body>/i, scriptTag + '</body>');
        } else {
          doc += scriptTag;
        }
      }

      if (app.favicon && !/rel=["'](?:shortcut )?icon["']/i.test(doc)) {
        const favTag = '\n<link rel="icon" href="' + app.favicon + '">\n';
        if (/<\/head>/i.test(doc)) {
          doc = doc.replace(/<\/head>/i, favTag + '</head>');
        }
      }

      return doc;
    }

    const hasArabic = /[\u0600-\u06FF]/.test(html + ' ' + (app.title || ''));
    const dir = hasArabic ? 'rtl' : 'ltr';
    const lang = hasArabic ? 'ar' : 'en';

    return '<!DOCTYPE html>\n' +
      '<html lang="' + lang + '" dir="' + dir + '">\n' +
      '<head>\n' +
      '  <meta charset="UTF-8">\n' +
      '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '  <title>' + (app.title ? escapeHtml(app.title) : 'تطبيق') + '</title>\n' +
      (app.favicon ? '  <link rel="icon" href="' + app.favicon + '">\n' : '') +
      '  <link rel="preconnect" href="https://fonts.googleapis.com">\n' +
      '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">\n' +
      '  <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet">\n' +
      (css ? '  <style>\n' + css + '\n  </style>\n' : '') +
      '</head>\n' +
      '<body>\n' +
      html + '\n' +
      (js ? '  <script>\n' + js + '\n  <\/script>\n' : '') +
      '</body>\n' +
      '</html>';
  }

  // ═══════════════════════════════════════════════
  // PUBLIC SECTION (index.html)
  // ═══════════════════════════════════════════════
  let _publicAppsListenerSetup = false;
  function _setupPublicAppsListener() {
    if (_publicAppsListenerSetup || !window.db) return;
    _publicAppsListenerSetup = true;

    try {
      window.db.collection('webApps').onSnapshot(function (snapshot) {
        allApps = [];
        snapshot.forEach(function (doc) {
          const a = doc.data();
          a.id = doc.id;
          allApps.push(a);
        });
        allApps.sort(function (a, b) {
          return (Number(a.order) || 0) - (Number(b.order) || 0);
        });
        setCachedApps(allApps);
        renderPublic();
      }, function (err) {
        console.warn('[WebApps] onSnapshot error:', err);
      });
    } catch (e) {
      console.warn('[WebApps] snapshot error:', e);
    }
  }

  function loadPublicApps() {
    window.__fbTracker && window.__fbTracker.add();

    // 1. Instant render from local cache if available
    const cached = getCachedApps();
    if (cached) {
      allApps = cached;
      renderPublic();
    }

    // 2. Poll/wait for window.db
    let retries = 0;
    function tryFetch() {
      if (!window.db) {
        retries++;
        if (retries < 15) {
          setTimeout(tryFetch, 200);
          return;
        }
        window.__fbTracker && window.__fbTracker.done();
        if (!cached || cached.length === 0) {
          hideSkeleton();
          showEmptyState();
        }
        return;
      }

      window.db.collection('webApps').get()
        .then(function (snapshot) {
          window.__fbTracker && window.__fbTracker.done();
          allApps = [];
          snapshot.forEach(function (doc) {
            const a = doc.data();
            a.id = doc.id;
            allApps.push(a);
          });
          allApps.sort(function (a, b) {
            return (Number(a.order) || 0) - (Number(b.order) || 0);
          });
          setCachedApps(allApps);
          renderPublic();
          _setupPublicAppsListener();
        })
        .catch(function (err) {
          window.__fbTracker && window.__fbTracker.done();
          console.error('[WebApps] load error:', err);
          if (!cached || cached.length === 0) {
            hideSkeleton();
            showEmptyState();
          }
        });
    }

    tryFetch();
  }

  function hideSkeleton() {
    const sk = document.querySelector('.apps-skeleton');
    if (sk) sk.style.display = 'none';
  }

  function showEmptyState() {
    const empty = document.getElementById('apps-empty-state');
    if (empty) empty.style.display = 'block';
  }

  function renderPublic() {
    hideSkeleton();
    const container = document.getElementById('apps-cards-grid');
    const emptyState = document.getElementById('apps-empty-state');
    const visible = allApps.filter(function (a) {
      return a.isActive !== false && a.isActive !== 'false';
    });

    if (visible.length === 0) {
      if (container) container.innerHTML = '';
      showEmptyState();
      return;
    }
    if (emptyState) emptyState.style.display = 'none';

    if (container) {
      container.innerHTML = '';
      visible.forEach(function (app) {
        container.appendChild(buildAppCard(app));
      });
    }
  }

  function buildAppCard(app) {
    const card = document.createElement('div');
    card.className = 'apps-card apps-card-visible';

    const imgUrl = (app.thumbnail && (app.thumbnail.startsWith('http') || app.thumbnail.startsWith('data:')))
      ? app.thumbnail : getDefaultImage();

    const techTags = [];
    if (app.htmlCode) techTags.push('<span class="apps-tech-tag apps-tech-html"><i class="bx bxl-html5"></i> HTML</span>');
    if (app.cssCode) techTags.push('<span class="apps-tech-tag apps-tech-css"><i class="bx bxl-css3"></i> CSS</span>');
    if (app.jsCode) techTags.push('<span class="apps-tech-tag apps-tech-js"><i class="bx bxl-javascript"></i> JS</span>');

    const appTargetUrl = getAppUrl(app);

    card.innerHTML =
      '<div class="apps-card-img-wrap" style="cursor:pointer;" title="اضغط لتشغيل التطبيق">' +
        '<img class="apps-card-img" src="' + imgUrl + '" alt="' + escapeHtml(app.title || '') + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + getDefaultImage() + '\';">' +
        '<span class="apps-card-badge">مجاني</span>' +
      '</div>' +
      '<div class="apps-card-body">' +
        '<h3 class="apps-card-title" style="cursor:pointer;" title="اضغط لتشغيل التطبيق">' + escapeHtml(app.title || 'بدون عنوان') + '</h3>' +
        (app.description ? '<p class="apps-card-desc">' + escapeHtml(app.description) + '</p>' : '') +
        (techTags.length ? '<div class="apps-card-tech">' + techTags.join('') + '</div>' : '') +
      '</div>' +
      '<div class="apps-card-footer">' +
        '<a href="' + appTargetUrl + '" target="_blank" class="apps-card-btn apps-card-btn-run" style="flex:1;text-decoration:none;">' +
          '<i class="bx bx-play-circle"></i> افتح التطبيق' +
        '</a>' +
      '</div>';

    function openFull(e) {
      if (e) e.preventDefault();
      window.open(appTargetUrl, '_blank');
    }
    card.querySelector('.apps-card-img-wrap').addEventListener('click', openFull);
    card.querySelector('.apps-card-title').addEventListener('click', openFull);
    card.querySelector('.apps-card-btn-run').addEventListener('click', function(e) {
      if (e) e.preventDefault();
      window.open(appTargetUrl, '_blank');
    });

    return card;
  }

  function openAppPreview(app) {
    const overlay = document.getElementById('apps-preview-overlay');
    if (!overlay) return;

    const frame = document.getElementById('apps-preview-frame');
    const fullDoc = buildCompleteAppDocument(app);

    if (frame) {
      frame.style.background = '#0b0c10';
      frame.srcdoc = fullDoc;
    }

    overlay.classList.add('active');
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    overlay._currentApp = app;
  }

  // ═══════════════════════════════════════════════
  // ADMIN SECTION (admin.html)
  // ═══════════════════════════════════════════════
  function loadAdminApps() {
    window.__fbTracker && window.__fbTracker.add();

    const cached = getCachedApps();
    if (cached && allApps.length === 0) {
      allApps = cached;
      renderAdminStats();
      renderAdminTable();
    }

    let retries = 0;
    function tryFetchAdmin() {
      if (!window.db) {
        retries++;
        if (retries < 15) {
          setTimeout(tryFetchAdmin, 200);
        }
        return;
      }

      window.db.collection('webApps').get()
        .then(function (snapshot) {
          window.__fbTracker && window.__fbTracker.done();
          allApps = [];
          snapshot.forEach(function (doc) {
            const a = doc.data();
            a.id = doc.id;
            allApps.push(a);
          });
          allApps.sort(function (a, b) {
            return (Number(a.order) || 0) - (Number(b.order) || 0);
          });
          setCachedApps(allApps);
          renderAdminStats();
          renderAdminTable();
        })
        .catch(function (err) {
          window.__fbTracker && window.__fbTracker.done();
          console.error('[WebApps] admin load error:', err);
        });
    }

    tryFetchAdmin();
  }

  function renderAdminStats() {
    const totalEl = document.getElementById('apps-stat-total');
    const activeEl = document.getElementById('apps-stat-active');
    const draftsEl = document.getElementById('apps-stat-drafts');
    const total = allApps.length;
    const active = allApps.filter(function (a) { return a.isActive; }).length;
    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (draftsEl) draftsEl.textContent = total - active;
  }

  function renderAdminTable() {
    const grid = document.getElementById('admin-apps-grid');
    const emptyEl = document.getElementById('admin-apps-empty');
    if (!grid) return;

    const search = (document.getElementById('apps-admin-search') || {}).value || '';
    const sort = (document.getElementById('apps-admin-sort') || {}).value || 'order';

    let filtered = allApps.slice();

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(function (a) {
        return (a.title || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
      });
    }

    if (sort === 'order-desc') {
      filtered.sort(function (a, b) { return (b.order || 0) - (a.order || 0); });
    } else if (sort === 'title') {
      filtered.sort(function (a, b) { return (a.title || '').localeCompare(b.title || '', 'ar'); });
    } else {
      filtered.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    }

    const countEl = document.getElementById('apps-count');
    if (countEl) countEl.textContent = filtered.length;

    if (filtered.length === 0) {
      grid.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    grid.innerHTML = '';
    filtered.forEach(function (app, idx) {
      const card = document.createElement('div');
      card.className = 'admin-app-card';
      card.setAttribute('data-id', app.id);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', 'عرض تفاصيل ' + (app.title || ''));

      const thumbUrl = (app.thumbnail && (app.thumbnail.startsWith('http') || app.thumbnail.startsWith('data:')))
        ? app.thumbnail : getDefaultImage();

      var techBadges = '';
      if (app.htmlCode) techBadges += '<span class="admin-tech-badge html"><i class="bx bxl-html5"></i> HTML</span>';
      if (app.cssCode) techBadges += '<span class="admin-tech-badge css"><i class="bx bxl-css3"></i> CSS</span>';
      if (app.jsCode) techBadges += '<span class="admin-tech-badge js"><i class="bx bxl-javascript"></i> JS</span>';

      card.innerHTML =
        '<div class="admin-card-thumb">' +
          '<img src="' + thumbUrl + '" alt="' + escapeHtml(app.title || '') + '" loading="lazy" onerror="this.src=\'' + getDefaultImage() + '\'">' +
          '<span class="admin-card-status ' + (app.isActive ? 'active' : 'draft') + '">' + (app.isActive ? 'منشور' : 'مسودة') + '</span>' +
          '<span class="admin-card-order">#' + (app.order || 0) + '</span>' +
        '</div>' +
        '<div class="admin-card-body">' +
          '<h3 class="admin-card-title">' + escapeHtml(app.title || 'بدون عنوان') + '</h3>' +
          (app.description ? '<p class="admin-card-desc">' + escapeHtml(app.description.substring(0, 80)) + (app.description.length > 80 ? '...' : '') + '</p>' : '') +
          '<div class="admin-card-tech">' + techBadges + '</div>' +
          (app.slug ? '<div class="admin-card-slug"><i class="bx bx-link"></i> ' + escapeHtml(app.slug) + '</div>' : '') +
        '</div>' +
        '<div class="admin-card-actions">' +
          '<button class="admin-card-btn edit apps-edit-btn" data-id="' + app.id + '" title="تعديل"><i class="bx bx-edit"></i> تعديل</button>' +
          '<button class="admin-card-btn delete apps-delete-btn" data-id="' + app.id + '" title="حذف"><i class="bx bx-trash"></i></button>' +
        '</div>';

      card.addEventListener('click', function(e) {
        if (e.target.closest('.apps-edit-btn') || e.target.closest('.apps-delete-btn')) return;
        openAppDetail(app.id);
      });

      card.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAppDetail(app.id);
        }
      });

      grid.appendChild(card);
    });

    grid.querySelectorAll('.apps-edit-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const app = allApps.find(function (a) { return a.id === id; });
        if (app) openAppsForm(app);
      });
    });

    grid.querySelectorAll('.apps-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const app = allApps.find(function (a) { return a.id === id; });
        if (app && confirm('هل أنت متأكد من حذف "' + (app.title || '') + '"؟')) {
          dbOp('webApps', 'delete', id)
            .then(function () {
              if (typeof showToast === 'function') showToast('✅ تم حذف التطبيق');
              loadAdminApps();
            })
            .catch(function (err) {
              console.error('[WebApps] delete error:', err);
              if (typeof showToast === 'function') showToast('خطأ في الحفظ', 'error');
            });
        }
      });
    });

    setupDetailModalNav();
  }

  function openAppDetail(appId) {
    var modal = document.getElementById('admin-app-detail-modal');
    var body = document.getElementById('detail-modal-body');
    if (!modal || !body) return;

    var app = allApps.find(function (a) { return a.id === appId; });
    if (!app) return;

    var filtered = getFilteredApps();
    var idx = filtered.findIndex(function (a) { return a.id === appId; });

    modal._currentIdx = idx;
    modal._filteredApps = filtered;

    renderAppDetail(app, idx, filtered.length);

    modal.classList.remove('hidden');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function getFilteredApps() {
    var search = (document.getElementById('apps-admin-search') || {}).value || '';
    var sort = (document.getElementById('apps-admin-sort') || {}).value || 'order';
    var filtered = allApps.slice();

    if (search) {
      var q = search.toLowerCase();
      filtered = filtered.filter(function (a) {
        return (a.title || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
      });
    }

    if (sort === 'order-desc') {
      filtered.sort(function (a, b) { return (b.order || 0) - (a.order || 0); });
    } else if (sort === 'title') {
      filtered.sort(function (a, b) { return (a.title || '').localeCompare(b.title || '', 'ar'); });
    } else {
      filtered.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    }
    return filtered;
  }

  function renderAppDetail(app, idx, total) {
    var title = document.getElementById('detail-modal-title');
    var body = document.getElementById('detail-modal-body');
    var counter = document.getElementById('detail-counter');
    var prevBtn = document.getElementById('detail-prev-btn');
    var nextBtn = document.getElementById('detail-next-btn');

    if (title) title.innerHTML = '<i class="bx bx-code-alt" style="color:var(--accent);"></i> ' + escapeHtml(app.title || 'تفاصيل التطبيق');
    if (counter) counter.textContent = (idx + 1) + ' / ' + total;
    if (prevBtn) prevBtn.style.display = idx > 0 ? '' : 'none';
    if (nextBtn) nextBtn.style.display = idx < total - 1 ? '' : 'none';

    var thumbUrl = (app.thumbnail && (app.thumbnail.startsWith('http') || app.thumbnail.startsWith('data:')))
      ? app.thumbnail : getDefaultImage();

    var htmlSize = app.htmlCode ? (new Blob([app.htmlCode]).size / 1024).toFixed(1) : 0;
    var cssSize = app.cssCode ? (new Blob([app.cssCode]).size / 1024).toFixed(1) : 0;
    var jsSize = app.jsCode ? (new Blob([app.jsCode]).size / 1024).toFixed(1) : 0;
    var totalSize = (parseFloat(htmlSize) + parseFloat(cssSize) + parseFloat(jsSize)).toFixed(1);

    var favHtml = '';
    if (app.favicon) {
      favHtml = '<div class="detail-info-row"><span class="detail-label"><i class="bx bx-image"></i> الأيقونة</span><img src="' + app.favicon + '" style="width:24px;height:24px;border-radius:4px;vertical-align:middle;"></div>';
    }

    var appPageUrl = getAppUrl(app);

    body.innerHTML =
      '<div class="detail-app-header">' +
        '<img class="detail-app-thumb" src="' + thumbUrl + '" alt="" onerror="this.src=\'' + getDefaultImage() + '\'">' +
        '<div class="detail-app-info">' +
          '<h3>' + escapeHtml(app.title || 'بدون عنوان') + '</h3>' +
          (app.description ? '<p>' + escapeHtml(app.description) + '</p>' : '') +
          '<div class="detail-badges">' +
            '<span class="admin-card-status ' + (app.isActive ? 'active' : 'draft') + '">' + (app.isActive ? 'منشور' : 'مسودة') + '</span>' +
            (app.slug ? '<span class="detail-slug-badge"><i class="bx bx-link"></i> ' + escapeHtml(app.slug) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<h4><i class="bx bx-bar-chart-alt-2"></i> معلومات</h4>' +
        '<div class="detail-info-grid">' +
          '<div class="detail-info-row"><span class="detail-label"><i class="bx bx-sort"></i> الترتيب</span><span class="detail-value">' + (app.order || 0) + '</span></div>' +
          '<div class="detail-info-row"><span class="detail-label"><i class="bx bx-file"></i> الحجم الكلي</span><span class="detail-value">' + totalSize + ' KB</span></div>' +
          '<div class="detail-info-row"><span class="detail-label"><i class="bx bx-calendar"></i> تاريخ الإنشاء</span><span class="detail-value">' + formatDate(app.createdAt) + '</span></div>' +
          '<div class="detail-info-row"><span class="detail-label"><i class="bx bx-time"></i> آخر تعديل</span><span class="detail-value">' + formatDate(app.updatedAt) + '</span></div>' +
          favHtml +
        '</div>' +
      '</div>' +

      '<div class="detail-section">' +
        '<h4><i class="bx bx-code-alt"></i> الأكواد</h4>' +
        '<div class="detail-code-grid">' +
          '<div class="detail-code-item html"><div class="detail-code-header"><i class="bx bxl-html5"></i> HTML<span>' + htmlSize + ' KB</span></div><pre class="detail-code-preview">' + escapeHtml((app.htmlCode || '').substring(0, 300)) + ((app.htmlCode || '').length > 300 ? '...' : '') + '</pre></div>' +
          '<div class="detail-code-item css"><div class="detail-code-header"><i class="bx bxl-css3"></i> CSS<span>' + cssSize + ' KB</span></div><pre class="detail-code-preview">' + escapeHtml((app.cssCode || '').substring(0, 300)) + ((app.cssCode || '').length > 300 ? '...' : '') + '</pre></div>' +
          '<div class="detail-code-item js"><div class="detail-code-header"><i class="bx bxl-javascript"></i> JavaScript<span>' + jsSize + ' KB</span></div><pre class="detail-code-preview">' + escapeHtml((app.jsCode || '').substring(0, 300)) + ((app.jsCode || '').length > 300 ? '...' : '') + '</pre></div>' +
        '</div>' +
      '</div>' +

      '<div class="detail-actions" style="display:flex;gap:10px;flex-wrap:wrap;">' +
        '<button class="btn btn-primary detail-action-btn" onclick="WebApps.openAppsForm(allApps.find(function(a){return a.id===\'' + app.id + '\'}));document.getElementById(\'admin-app-detail-modal\').classList.add(\'hidden\');document.body.style.overflow=\'\';"><i class="bx bx-edit"></i> تعديل التطبيق</button>' +
        '<a href="' + appPageUrl + '" target="_blank" class="btn btn-outline detail-action-btn"><i class="bx bx-link-external"></i> تشغيل في صفحة مستقلة</a>' +
        '<button class="btn btn-outline detail-action-btn" onclick="WebApps.openAppPreview(allApps.find(function(a){return a.id===\'' + app.id + '\'}));document.getElementById(\'admin-app-detail-modal\').classList.add(\'hidden\');"><i class="bx bx-show"></i> معاينة سريعة</button>' +
      '</div>';
  }

  function setupDetailModalNav() {
    var modal = document.getElementById('admin-app-detail-modal');
    if (!modal || modal._navSetup) return;
    modal._navSetup = true;

    document.getElementById('detail-close-btn').addEventListener('click', function() {
      modal.classList.add('hidden');
      modal.classList.remove('active');
      document.body.style.overflow = '';
    });

    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        modal.classList.add('hidden');
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    document.getElementById('detail-prev-btn').addEventListener('click', function() {
      var idx = modal._currentIdx;
      var apps = modal._filteredApps;
      if (idx > 0) {
        modal._currentIdx = idx - 1;
        renderAppDetail(apps[idx - 1], idx - 1, apps.length);
      }
    });

    document.getElementById('detail-next-btn').addEventListener('click', function() {
      var idx = modal._currentIdx;
      var apps = modal._filteredApps;
      if (idx < apps.length - 1) {
        modal._currentIdx = idx + 1;
        renderAppDetail(apps[idx + 1], idx + 1, apps.length);
      }
    });

    document.addEventListener('keydown', function(e) {
      if (modal.classList.contains('hidden')) return;
      if (e.key === 'ArrowRight') document.getElementById('detail-prev-btn').click();
      if (e.key === 'ArrowLeft') document.getElementById('detail-next-btn').click();
      if (e.key === 'Escape') {
        modal.classList.add('hidden');
        document.body.style.overflow = '';
      }
    });
  }

  function openAppsForm(app) {
    const modal = document.getElementById('apps-form-modal');
    if (!modal) return;

    document.getElementById('apps-id').value = app ? app.id : '';
    document.getElementById('apps-title').value = app ? (app.title || '') : '';
    document.getElementById('apps-desc').value = app ? (app.description || '') : '';
    document.getElementById('apps-slug').value = app ? (app.slug || '') : '';
    document.getElementById('apps-html-code').value = app ? (app.htmlCode || '') : '';
    document.getElementById('apps-css-code').value = app ? (app.cssCode || '') : '';
    document.getElementById('apps-js-code').value = app ? (app.jsCode || '') : '';
    document.getElementById('apps-order').value = app ? (app.order || 0) : 0;
    document.getElementById('apps-is-active').checked = app ? !!app.isActive : true;

    const thumbImg = document.getElementById('apps-thumb-preview');
    const thumbRemove = document.getElementById('apps-remove-thumb');
    const thumbHidden = document.getElementById('apps-thumb-url');
    if (app && app.thumbnail) {
      thumbHidden.value = app.thumbnail;
      thumbImg.src = app.thumbnail;
      thumbImg.style.display = 'block';
      thumbRemove.style.display = 'inline-block';
    } else {
      thumbHidden.value = '';
      thumbImg.src = '';
      thumbImg.style.display = 'none';
      thumbRemove.style.display = 'none';
    }

    const favImg = document.getElementById('apps-favicon-preview');
    const favRemove = document.getElementById('apps-remove-favicon');
    const favHidden = document.getElementById('apps-favicon-url');
    if (app && app.favicon) {
      favHidden.value = app.favicon;
      favImg.src = app.favicon;
      favImg.style.display = 'block';
      favRemove.style.display = 'inline-block';
    } else {
      favHidden.value = '';
      favImg.src = '';
      favImg.style.display = 'none';
      favRemove.style.display = 'none';
    }

    var codeTypes = ['html', 'css', 'js'];
    codeTypes.forEach(function (type) {
      var fileInput = document.getElementById('apps-' + type + '-file');
      var info = document.getElementById('apps-' + type + '-file-info');
      var zone = document.getElementById('apps-' + type + '-upload-zone');
      if (fileInput) fileInput.value = '';
      if (info) info.style.display = 'none';
      if (zone) zone.style.borderColor = '';
    });

    const titleEl = document.getElementById('apps-modal-title');
    if (titleEl) titleEl.innerHTML = app
      ? '<i class="bx bx-edit"></i> تعديل التطبيق'
      : '<i class="bx bx-plus-circle" style="color:var(--accent);"></i> إضافة تطبيق جديد';

    const submitBtn = modal.querySelector('#apps-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = app
      ? '<i class="bx bx-save"></i> حفظ التعديلات'
      : '<i class="bx bx-save"></i> إضافة التطبيق';

    modal.classList.remove('hidden');
    modal.classList.add('active');
  }

  function handleAppsFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('apps-id').value;
    const title = (document.getElementById('apps-title').value || '').trim();
    if (!title) {
      if (typeof showToast === 'function') showToast('يرجى إدخال اسم التطبيق', 'error');
      return;
    }

    let slug = (document.getElementById('apps-slug').value || '').trim().toLowerCase().replace(/[^a-z0-9\-]/g, '').replace(/\-+/g, '-').replace(/^\-+|\-+$/g, '');
    if (!slug) {
      const latin = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/\-+/g, '-').replace(/^\-+|\-+$/g, '');
      slug = latin || ('app-' + Date.now().toString(36));
    }

    const data = {
      title: title,
      description: (document.getElementById('apps-desc').value || '').trim(),
      slug: slug,
      htmlCode: document.getElementById('apps-html-code').value || '',
      cssCode: document.getElementById('apps-css-code').value || '',
      jsCode: document.getElementById('apps-js-code').value || '',
      thumbnail: (document.getElementById('apps-thumb-url').value || '').trim(),
      favicon: (document.getElementById('apps-favicon-url').value || '').trim(),
      order: parseInt(document.getElementById('apps-order').value) || 0,
      isActive: document.getElementById('apps-is-active').checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (!id) data.createdAt = firebase.firestore.FieldValue.serverTimestamp();

    dbOp('webApps', id ? 'update' : 'add', id || null, data)
      .then(function (result) {
        if (typeof showToast === 'function') showToast(id ? '✅ تم تعديل التطبيق' : '✅ تم إضافة التطبيق');
        const modal = document.getElementById('apps-form-modal');
        if (modal) { modal.classList.add('hidden'); modal.classList.remove('active'); }

        // Update in-memory and local cache immediately
        const savedId = id || (result && result.id ? result.id : ('app_' + Date.now()));
        const cachedItem = Object.assign({}, data, { id: savedId });
        const existingIdx = allApps.findIndex(function(a) { return a.id === savedId || a.slug === slug; });
        if (existingIdx >= 0) {
          allApps[existingIdx] = cachedItem;
        } else {
          allApps.push(cachedItem);
        }
        allApps.sort(function(a, b) { return (Number(a.order) || 0) - (Number(b.order) || 0); });
        setCachedApps(allApps);

        loadAdminApps();
      })
      .catch(function (err) {
        console.error('[WebApps] save error:', err);
        if (typeof showToast === 'function') showToast('خطأ في الحفظ', 'error');
      });
  }

  function setupAdminEvents() {
    const addBtn = document.getElementById('apps-add-btn');
    if (addBtn) addBtn.addEventListener('click', function () { openAppsForm(null); });

    const modal = document.getElementById('apps-form-modal');
    const closeBtn = document.getElementById('apps-close');
    const cancelBtn = document.getElementById('apps-cancel');
    if (closeBtn) closeBtn.addEventListener('click', function () { modal.classList.add('hidden'); modal.classList.remove('active'); });
    if (cancelBtn) cancelBtn.addEventListener('click', function () { modal.classList.add('hidden'); modal.classList.remove('active'); });
    if (modal) modal.addEventListener('click', function (e) { if (e.target === modal) { modal.classList.add('hidden'); modal.classList.remove('active'); } });

    const form = document.getElementById('apps-form');
    if (form) form.addEventListener('submit', handleAppsFormSubmit);

    const searchEl = document.getElementById('apps-admin-search');
    const sortEl = document.getElementById('apps-admin-sort');
    if (searchEl) searchEl.addEventListener('input', renderAdminTable);
    if (sortEl) sortEl.addEventListener('change', renderAdminTable);

    setupAppsImageUpload();
    setupFaviconUpload();
    setupCodeFileUploads();
  }

  function setupFaviconUpload() {
    const fileInput = document.getElementById('apps-favicon-file');
    const preview = document.getElementById('apps-favicon-preview');
    const removeBtn = document.getElementById('apps-remove-favicon');
    const hiddenInput = document.getElementById('apps-favicon-url');
    const uploadZone = document.getElementById('apps-favicon-upload-zone');
    if (!fileInput || !hiddenInput) return;

    fileInput.addEventListener('change', function (e) {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (file.size > 1 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('حجم الملف يتجاوز 1 ميجا', 'error');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = function (ev) {
        hiddenInput.value = ev.target.result;
        if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (uploadZone) uploadZone.style.borderColor = '#f59e0b';
      };
      reader.onerror = function () {
        if (typeof showToast === 'function') showToast('فشل في قراءة الملف', 'error');
      };
      reader.readAsDataURL(file);
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
        uploadZone.style.borderColor = '#f59e0b';
      });
      uploadZone.addEventListener('dragleave', function () {
        uploadZone.style.borderColor = '';
      });
      uploadZone.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadZone.style.borderColor = '';
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) {
          fileInput.files = e.dataTransfer.files;
          fileInput.dispatchEvent(new Event('change'));
        }
      });
    }
  }

  function setupCodeFileUploads() {
    var types = ['html', 'css', 'js'];
    types.forEach(function (type) {
      var fileInput = document.getElementById('apps-' + type + '-file');
      var zone = document.getElementById('apps-' + type + '-upload-zone');
      var info = document.getElementById('apps-' + type + '-file-info');
      var textarea = document.getElementById('apps-' + type + '-code');
      if (!fileInput || !textarea) return;

      fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
          if (typeof showToast === 'function') showToast('حجم الملف يتجاوز 2 ميجا', 'error');
          fileInput.value = '';
          return;
        }
        var reader = new FileReader();
        reader.onload = function (ev) {
          textarea.value = ev.target.result;
          if (info) {
            info.querySelector('.apps-file-name').textContent = file.name;
            info.style.display = 'block';
          }
          if (zone) zone.style.borderColor = '#22c55e';
        };
        reader.onerror = function () {
          if (typeof showToast === 'function') showToast('فشل في قراءة الملف', 'error');
        };
        reader.readAsText(file);
      });

      if (zone) {
        zone.addEventListener('dragover', function (e) {
          e.preventDefault();
          zone.style.borderColor = 'var(--accent, #6c63ff)';
        });
        zone.addEventListener('dragleave', function () {
          zone.style.borderColor = '';
        });
        zone.addEventListener('drop', function (e) {
          e.preventDefault();
          zone.style.borderColor = '';
          var file = e.dataTransfer.files && e.dataTransfer.files[0];
          if (file) {
            fileInput.files = e.dataTransfer.files;
            fileInput.dispatchEvent(new Event('change'));
          }
        });
      }
    });

    document.querySelectorAll('.apps-remove-file-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-target');
        var fileInput = document.getElementById('apps-' + type + '-file');
        var info = document.getElementById('apps-' + type + '-file-info');
        var zone = document.getElementById('apps-' + type + '-upload-zone');
        var textarea = document.getElementById('apps-' + type + '-code');
        if (fileInput) fileInput.value = '';
        if (info) info.style.display = 'none';
        if (zone) zone.style.borderColor = '';
        if (textarea) textarea.value = '';
      });
    });
  }

  function setupAppsImageUpload() {
    const fileInput = document.getElementById('apps-thumb-file');
    const preview = document.getElementById('apps-thumb-preview');
    const removeBtn = document.getElementById('apps-remove-thumb');
    const hiddenInput = document.getElementById('apps-thumb-url');
    const uploadZone = document.getElementById('apps-upload-zone');
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
        if (uploadZone) uploadZone.style.borderColor = 'var(--accent, #6c63ff)';
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
        uploadZone.style.borderColor = 'var(--accent, #6c63ff)';
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

  // Preview overlay close
  function setupPreviewOverlay() {
    const overlay = document.getElementById('apps-preview-overlay');
    if (!overlay) return;
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAppPreview();
    });
    const backBtn = document.getElementById('apps-preview-back');
    if (backBtn) backBtn.addEventListener('click', closeAppPreview);
  }

  function closeAppPreview() {
    const overlay = document.getElementById('apps-preview-overlay');
    const frame = document.getElementById('apps-preview-frame');
    if (overlay) { overlay.classList.remove('active'); overlay.classList.add('hidden'); }
    if (frame) { frame.srcdoc = ''; }
    document.body.style.overflow = '';
  }

  // ─── Init ──────────────────────────────────────
  function init() {
    const isAdmin = !!document.getElementById('apps-view');
    if (isAdmin) {
      loadAdminApps();
      setupAdminEvents();
    } else if (document.querySelector('#apps-section')) {
      loadPublicApps();
    }
    setupPreviewOverlay();
  }

  return {
    init: init,
    renderAdminTable: renderAdminTable,
    openAppsForm: openAppsForm,
    openAppDetail: openAppDetail,
    openAppPreview: openAppPreview,
    getAppUrl: getAppUrl,
    buildCompleteAppDocument: buildCompleteAppDocument
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  WebApps.init();
});
