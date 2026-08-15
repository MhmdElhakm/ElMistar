// Firebase is initialized in admin.html inline script
console.log('✅ admin.js loaded!');

// Helper to normalize phone
function normalizePhone(phone) {
    if (!phone) return "";
    let p = phone.toString().replace(/\D/g, '');
    if (p.length > 0 && !p.startsWith('0')) p = '0' + p;
    return p;
}

// Phone variants (with/without leading zero) to match both stored formats
function getPhoneVariants(phone) {
    const cleaned = (phone || '').toString().replace(/\D/g, '');
    if (!cleaned) return [];
    const noZero = cleaned.replace(/^0+/, '');
    const withZero = '0' + noZero;
    return withZero === noZero ? [withZero] : [withZero, noZero];
}

// Query a collection by phone matching either stored format (with/without leading zero)
function getSnapshotByPhone(collectionName, phone) {
    const variants = getPhoneVariants(phone);
    if (variants.length === 0) return Promise.resolve(null);
    if (variants.length === 1) {
        return window.db.collection(collectionName).where('phone', '==', variants[0]).get();
    }
    return window.db.collection(collectionName).where('phone', 'in', variants).get();
}

// ============================================
// SIGNUP NOTES TEMPLATES
// ============================================
var _noteTemplates = {
    attendance: '1- الحضور بكامل الأدوات 👇\n2- عدم الغياب إلا للضرورة القصوى (وتبلغني قبلها) برسالة على الواتس.\n3- الغياب حصتين ورا بعض بدون عذر مقبول استبعاد نهائي من الدرس.',
    pricing: '4- سعر الحصة {price} ج فقط "الشهر 8 حصص {monthly} ج".',
    communication: '5- التواصل واتس فقط ⚠️.\n6- متابعة ولي الأمر للطفل أول بأول والاطلاع على الكراسة بعد كل حصة.',
    books: '7- إحضار الكراسة والقلم في كل حصة.\n8- مراجعة الدرس في نفس اليوم لضمان التثبيت.'
};

function insertNoteTemplate(type) {
    var msgEl = document.getElementById('settings-notes-message');
    if (!msgEl) return;
    var template = _noteTemplates[type] || '';
    if (msgEl.value.trim() === '') {
        msgEl.value = template;
    } else {
        msgEl.value = msgEl.value.trim() + '\n' + template;
    }
    msgEl.focus();
    _updateNotesPreview();
}

function _updateNotesPreview() {
    var msgEl = document.getElementById('settings-notes-message');
    var previewEl = document.getElementById('notes-live-preview');
    var charsEl = document.getElementById('notes-chars-count');
    var lineCountEl = document.getElementById('notes-line-count');
    if (!msgEl || !previewEl) return;
    
    var message = msgEl.value || '';
    var lines = message.split('\n').map(function(l){ return l.trim(); }).filter(Boolean);
    
    // Update counts
    if (charsEl) charsEl.textContent = message.length + ' حرف';
    if (lineCountEl) {
        lineCountEl.textContent = lines.length + ' ملاحظة';
        lineCountEl.style.display = lines.length > 0 ? 'inline-block' : 'none';
    }
    
    // Update preview
    var contentEl = previewEl.querySelector('.auth-notes-content') || previewEl;
    if (lines.length === 0) {
        contentEl.innerHTML = '<p style="color:var(--text-muted);font-size:12px;font-style:italic;">ستظهر الملاحظات هنا...</p>';
        return;
    }
    
    // Get session price for preview
    var sessionPrice = 15; // default
    var monthlyTotal = 120;
    try {
        var priceEl = document.getElementById('settings-price-current');
        var sessionsEl = document.getElementById('settings-sessions-current');
        if (priceEl && sessionsEl) {
            sessionPrice = parseInt(priceEl.value) || 15;
            monthlyTotal = sessionPrice * (parseInt(sessionsEl.value) || 8);
        }
    } catch(e) {}
    
    var html = '<ul style="list-style:none;display:flex;flex-direction:column;gap:8px;margin:0;padding:0;">';
    lines.forEach(function(line) {
        var safe = line
            .replace(/\{price\}/g, sessionPrice)
            .replace(/\{monthly\}/g, monthlyTotal)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        html += '<li style="font-size:0.9rem;font-weight:700;color:#1E293B;padding:6px 10px;background:rgba(255,251,235,0.6);border-radius:8px;border:1px dashed #FCD34D;">' + safe + '</li>';
    });
    html += '</ul>';
    contentEl.innerHTML = html;
}

// Professional Toast Notification
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `
        <i class='bx ${type === 'error' ? 'bx-error-circle' : 'bx-check-circle'}'></i>
        <span>${message}</span>
    `;
    container.appendChild(toast);

    // Auto remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    }, 3000);

    // Manual remove on click
    toast.addEventListener('click', () => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 400);
    });
}

// Admin Dashboard - Auto Load (No Login Required)
console.log('✅ admin.js loaded, auto-loading dashboard!');

// Initialize everything after DOM and Firebase are ready
document.addEventListener('DOMContentLoaded', function() {
    // Password gate
    var gate = document.getElementById('password-gate');
    var passInput = document.getElementById('admin-password-input');
    var passSubmit = document.getElementById('admin-password-submit');
    var passError = document.getElementById('password-gate-error');

    function checkPassword() {
        if (passInput.value === '439512') {
            gate.style.display = 'none';
            if (passError) passError.style.display = 'none';
            initAdminDashboard();
        } else {
            if (passError) passError.style.display = 'block';
            passInput.value = '';
            passInput.focus();
        }
    }

    if (gate) {
        passSubmit.addEventListener('click', checkPassword);
        passInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') checkPassword();
        });
        passInput.focus();
        return;
    }

    initAdminDashboard();
});

function initAdminDashboard() {
    console.log('=== Page fully loaded, initializing dashboard ===');
    try {
        console.log('✅ window.db is:', window.db);

        // إذا لم تكن قاعدة البيانات مرتبطة بعد، اعرض شاشة الربط
        if (!window.db) {
            console.warn('⚠️ لا توجد قاعدة بيانات مرتبطة — عرض شاشة الربط');
            showDatabaseSetupScreen();
            return;
        }



        // Global View Selection
        const navLinks = document.querySelectorAll('.nav-links li');
        const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
        const views = document.querySelectorAll('.view-section');
        const pageTitle = document.getElementById('page-title');

        // Add click events to all nav items
        [...navLinks, ...mobileNavItems].forEach(item => {
            item.addEventListener('click', () => {
                const target = item.getAttribute('data-target');
                const title = item.querySelector('span') ? item.querySelector('span').textContent : item.textContent.trim();
                switchView(target, title, navLinks, mobileNavItems, views, pageTitle);
            });
        });

        // Mobile Menu Toggle
        const menuBtn = document.getElementById('mobile-menu-btn');
        const sidebarEl = document.querySelector('.sidebar');
        const scrimEl = document.getElementById('mobile-scrim');

        if (menuBtn) {
            menuBtn.addEventListener('click', () => {
                sidebarEl.classList.add('open');
                scrimEl.classList.remove('hidden');
            });
        }

        if (scrimEl) {
            scrimEl.addEventListener('click', () => {
                sidebarEl.classList.remove('open');
                scrimEl.classList.add('hidden');
            });
        }

        // Close menu when a nav item is clicked on mobile
        navLinks.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebarEl.classList.remove('open');
                    scrimEl.classList.add('hidden');
                }
            });
        });

        // Tab switching for payments
        document.querySelectorAll('[data-pay-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-pay-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentPaymentTab = tab.getAttribute('data-pay-tab');
                renderPaymentsTable();
            });
        });

        // Search filtering (payments)
        document.getElementById('search-payments')?.addEventListener('input', renderPaymentsTable);

        // Tab switching for combined-requests (التسجيل / الدفع / الالتحاق)
        document.querySelectorAll('[data-combined-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-combined-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-combined-tab');
                document.querySelectorAll('#combined-requests-view .combined-tab-content').forEach(c => c.style.display = 'none');
                const tabMap = { requests: 'combined-requests-tab', payments: 'combined-payments-tab', enrollments: 'combined-enrollments-tab' };
                const el = document.getElementById(tabMap[target]);
                if (el) el.style.display = 'block';
                if (target === 'payments') renderPaymentsTable();
                if (target === 'enrollments') loadEnrollments();
            });
        });

        // Tab switching for educational works (المحتوى / المبيعات)
        document.querySelectorAll('[data-ew-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-ew-tab]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const target = tab.getAttribute('data-ew-tab');
                document.querySelectorAll('#educational-works-view .combined-tab-content').forEach(c => c.style.display = 'none');
                const tabMap = { works: 'ew-works-tab', purchases: 'ew-purchases-tab' };
                const el = document.getElementById(tabMap[target]);
                if (el) el.style.display = 'block';
            });
        });

        // Settings accordions (قوائم منسدلة للعام والواتساب)
        setupSettingsAccordions();
        setupFirebaseConfigEvents();
        loadFirebaseConfig();
        setupSheetsSyncEvents();

        // Student search and grade filter
        const applyStudentFilters = window.applyStudentFilters = () => {
            let filtered = [...studentsData];
            const searchTerm = document.getElementById('search-student')?.value.toLowerCase().trim() || '';
            const gradeFilter = document.getElementById('grade-filter')?.value || '';
            const groupFilter = document.getElementById('group-filter')?.value || '';

            if (searchTerm) {
                filtered = filtered.filter(student => 
                    (student.name || '').toLowerCase().includes(searchTerm) ||
                    (student.phone || '').toLowerCase().includes(searchTerm)
                );
            }

            if (gradeFilter) {
                filtered = filtered.filter(student => getGradeNameSafe(student.grade) === gradeFilter);
            }

            if (groupFilter) {
                filtered = filtered.filter(student => student.groupId === groupFilter);
            }

            renderStudentsTable(filtered);
        };

        document.getElementById('search-student')?.addEventListener('input', window.applyStudentFilters);
        document.getElementById('grade-filter')?.addEventListener('change', window.applyStudentFilters);

        // Year tabs
        document.querySelectorAll('.year-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentYearTab = tab.getAttribute('data-year');
                // Update groups dropdown to show only relevant category
                if (typeof window.updateGroupsDropdown === 'function') {
                    window.updateGroupsDropdown();
                }
                // Reset group filter when switching tabs
                const groupFilter = document.getElementById('group-filter');
                if (groupFilter) groupFilter.value = '';
                applyStudentFilters();
            });
        });

        // Request filter tabs
        document.querySelectorAll('[data-request-filter]').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-request-filter]').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentRequestFilter = tab.getAttribute('data-request-filter');
                // Clear selections when switching tabs
                document.querySelectorAll('.request-checkbox:checked').forEach(cb => cb.checked = false);
                updateRequestsBulkToolbar();
                applyRequestFilters();
            });
        });

        // Request search
        document.getElementById('search-requests')?.addEventListener('input', applyRequestFilters);
        document.getElementById('requests-grade-filter')?.addEventListener('change', applyRequestFilters);

        // Add student modal events
        document.getElementById('open-add-modal-btn')?.addEventListener('click', () => {
            document.getElementById('add-student-modal')?.classList.remove('hidden');
            document.getElementById('student-name')?.focus();
        });
        document.getElementById('close-add-modal')?.addEventListener('click', () => document.getElementById('add-student-modal')?.classList.add('hidden'));
        document.getElementById('cancel-add-btn')?.addEventListener('click', () => document.getElementById('add-student-modal')?.classList.add('hidden'));
        document.getElementById('add-student-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

        // Group filter
        document.getElementById('group-filter')?.addEventListener('change', applyStudentFilters);

        // Payment filter


        // Group modal buttons
        document.getElementById('open-group-modal-btn')?.addEventListener('click', openGroupModal);
        document.getElementById('close-group-modal')?.addEventListener('click', () => document.getElementById('group-modal')?.classList.add('hidden'));
        document.getElementById('group-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });
        document.getElementById('add-group-btn')?.addEventListener('click', () => openGroupFormModal());
        document.getElementById('close-group-form-modal')?.addEventListener('click', () => document.getElementById('group-form-modal')?.classList.add('hidden'));
        document.getElementById('group-form-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });
        document.getElementById('cancel-group-form-btn')?.addEventListener('click', () => document.getElementById('group-form-modal')?.classList.add('hidden'));

        // Group WhatsApp modal
        document.getElementById('group-wa-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });

        // Groups view - new group button
        document.getElementById('open-group-modal-btn-2')?.addEventListener('click', () => openGroupFormModal());

        // Groups view - tab filtering
        document.querySelectorAll('.group-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                currentGroupTab = tab.getAttribute('data-cat');
                renderGroupsView();
            });
        });

        // Group form submit
        document.getElementById('group-form')?.addEventListener('submit', handleGroupFormSubmit);

        // Group template buttons in edit form
        document.getElementById('group-form-modal')?.addEventListener('click', function(e) {
            var btn = e.target.closest('.group-tpl-btn');
            if (!btn) return;
            var type = btn.getAttribute('data-type');
            var groupId = document.getElementById('group-form-id').value;
            if (!groupId) return;
            var group = groupsData.find(function(g) { return g.id === groupId; });
            if (group) copyGroupMessage(group, type);
        });

        // Color picker
        document.querySelectorAll('.color-option').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('group-color').value = btn.getAttribute('data-color');
            });
        });

        // Initialize data loading
        loadSessionSettings();
        loadProfileSettings();
        loadSocialLinksSettings();
        setupProfileImageUpload();
        loadStudentsData();
        initHomeView();
        loadGroupsData();
        loadAnnouncements();
        loadEnrollments();
        loadEnrollmentToggleSetting();
        loadCongratsToggleSetting();
        loadRegistrationToggleSetting();
        loadCurriculumToggleSetting();

        // Announcement modal events
        document.getElementById('ann-add-btn')?.addEventListener('click', () => openAnnouncementFormModal());
        document.getElementById('close-ann-form-modal')?.addEventListener('click', () => document.getElementById('announcement-form-modal')?.classList.add('hidden'));
        document.getElementById('announcement-form-modal')?.addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.classList.add('hidden'); });
        document.getElementById('cancel-ann-form-btn')?.addEventListener('click', () => document.getElementById('announcement-form-modal')?.classList.add('hidden'));
        document.getElementById('announcement-form')?.addEventListener('submit', handleAnnouncementFormSubmit);

        // Setup announcement image upload
        setupAnnouncementImageUpload();

        // Initialize enrollment reject modal
        initEnrollRejectModal();

        // Enrollment toggle listener
        document.getElementById('enrollment-toggle')?.addEventListener('change', function (e) {
            saveEnrollmentToggleSetting(e.target.checked);
            showToast(e.target.checked ? '✅ تم إظهار قسم الالتحاق للطلاب' : '✅ تم إخفاء قسم الالتحاق عن الطلاب');
        });

        // Congrats toggle listener
        document.getElementById('congrats-toggle')?.addEventListener('change', function (e) {
            saveCongratsToggleSetting(e.target.checked);
            showToast(e.target.checked ? '✅ تم إظهار رسالة التهنئة' : '✅ تم إخفاء رسالة التهنئة');
        });

        // Registration toggle listener
        document.getElementById('registration-toggle')?.addEventListener('change', function (e) {
            saveRegistrationToggleSetting(e.target.checked);
            var label = document.getElementById('registration-toggle-label');
            if (label) label.textContent = e.target.checked ? 'التسجيل متاح' : 'التسجيل غير متاح';
            showToast(e.target.checked ? '✅ تم تفعيل التسجيل في الموقع' : '✅ تم تعطيل التسجيل في الموقع');
        });

        // Curriculum visibility toggle listener
        document.getElementById('curriculum-toggle')?.addEventListener('change', function (e) {
            saveCurriculumToggleSetting(e.target.checked);
            var label = document.getElementById('curriculum-toggle-label');
            if (label) label.textContent = e.target.checked ? 'مرئي' : 'مخفي';
        });

        // Registration notes
        loadNotesSetting();
        document.getElementById('save-notes-btn')?.addEventListener('click', saveNotesSetting);
        document.getElementById('reset-notes-btn')?.addEventListener('click', resetNotesSetting);
        
        // Live preview for notes
        document.getElementById('settings-notes-message')?.addEventListener('input', _updateNotesPreview);
        document.getElementById('settings-notes-title')?.addEventListener('input', function() {
            var previewEl = document.getElementById('notes-live-preview');
            if (previewEl) {
                var summaryEl = previewEl.querySelector('summary');
                if (summaryEl) summaryEl.textContent = this.value || 'إضغط هنا لقراءة ملاحظات هامة جداً ⚠️';
            }
        });

        // Per-grade save button
        document.getElementById('save-per-grade-btn')?.addEventListener('click', _savePerGradeSettings);

        // Initialize bulk actions
        initBulkActions();

        console.log('✅ All dashboard initializations done!');
    } catch (error) {
        console.error('❌ Error initializing dashboard:', error);
        showToast('حدث خطأ أثناء تحميل البيانات، يرجى تحديث الصفحة', 'error');
    }
}

// Settings Accordions (قوائم منسدلة احترافية)
function setupSettingsAccordions() {
    var allSections = document.querySelectorAll('#settings-view .collapsible-settings');
    var sections = Array.prototype.slice.call(allSections);
    sections.sort(function(a, b) {
        return a.contains(b) ? 1 : b.contains(a) ? -1 : 0;
    });
    sections.forEach(function(section) {
        var hasToggle = section.querySelector('input[type="checkbox"]');
        var defaultOpen = section.getAttribute('data-default-open') === 'true';
        makeCollapsible(section, '.settings-section-header, .settings-tab-header', !!hasToggle);
        if (defaultOpen) {
            var body = section.querySelector('.settings-collapse-body');
            var trigger = section.querySelector('.settings-collapse-trigger');
            if (body && trigger) {
                body.classList.add('open');
                section.classList.remove('collapsed');
                trigger.classList.add('open');
            }
        }
    });
}

function makeCollapsible(container, headerSelector, guardInteractives) {
    const header = container.querySelector(headerSelector);
    if (!header) return;
    const siblings = Array.prototype.slice.call(container.children);
    const headerIndex = siblings.indexOf(header);
    const bodyChildren = siblings.slice(headerIndex + 1);
    if (bodyChildren.length === 0) return;

    const body = document.createElement('div');
    body.className = 'settings-collapse-body';
    bodyChildren.forEach(function (el) { body.appendChild(el); });
    container.appendChild(body);

    container.classList.add('settings-collapsible', 'collapsed');

    const chevron = document.createElement('span');
    chevron.className = 'settings-collapse-chevron';
    chevron.innerHTML = '<i class="bx bx-chevron-down"></i>';
    header.appendChild(chevron);
    header.classList.add('settings-collapse-trigger');

    header.addEventListener('click', function (e) {
        if (guardInteractives && e.target.closest('input, label, button, a, select, textarea')) return;
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open');
        container.classList.toggle('collapsed', isOpen);
        header.classList.toggle('open', !isOpen);
        if (!isOpen) {
            closeOtherSections(container);
        }
    });
}

function closeOtherSections(currentSection) {
    var parent = currentSection.parentElement;
    if (!parent) return;
    var siblings = parent.querySelectorAll('.collapsible-settings');
    siblings.forEach(function(sibling) {
        if (sibling === currentSection) return;
        if (!sibling.classList.contains('collapsed')) {
            var body = sibling.querySelector('.settings-collapse-body');
            var trigger = sibling.querySelector('.settings-collapse-trigger');
            if (body) body.classList.remove('open');
            sibling.classList.add('collapsed');
            if (trigger) trigger.classList.remove('open');
        }
    });
}

// Global View Selection Logic
function switchView(target, title, navLinks, mobileNavItems, views, pageTitle) {
    // Update Desktop Nav
    navLinks.forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-target') === target);
    });

    // Update Mobile Nav
    mobileNavItems.forEach(l => {
        l.classList.toggle('active', l.getAttribute('data-target') === target);
    });

    // Update Views
    views.forEach(v => {
        v.classList.remove('active');
        if (v.id === target) v.classList.add('active');
    });

    // Update Title
    if (pageTitle) pageTitle.textContent = title;

    // Scroll to top
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.scrollTop = 0;
}

// Students Data Management
let studentsData = [];
let pendingRequests = [];
let rejectedStudents = [];
let allSignups = [];
let currentRequestFilter = 'all';
let groupsData = [];
let currentYearTab = 'current';
let gradeOrder = [
    "مرحلة الكي جي والتأسيس",
    "الصف الأول الابتدائي",
    "الصف الثاني الابتدائي",
    "الصف الثالث الابتدائي",
    "الصف الرابع الابتدائي",
    "الصف الخامس الابتدائي",
    "الصف السادس الابتدائي"
];
let invalidGradeStudents = [];
let fixedStudents = [];
let sessionSettings = {
    current: { sessionPrice: 15, sessionsPerMonth: 8, discount: 0 },
    previous: { sessionPrice: 10, sessionsPerMonth: 4, discount: 0 },
    summer: { sessionPrice: 20, sessionsPerMonth: 12, discount: 0 }
};
let settingsLoaded = false;

function getPriceForYear(year) {
    var key = year || 'current';
    return (sessionSettings[key] && sessionSettings[key].sessionPrice) || 15;
}

function getSessionsForYear(year) {
    var key = year || 'current';
    return (sessionSettings[key] && sessionSettings[key].sessionsPerMonth) || 8;
}

function getSettingsForStudent(student) {
    var year = (student && student.academicYear) || 'current';
    return {
        sessionPrice: getPriceForYear(year),
        sessionsPerMonth: getSessionsForYear(year),
        discount: (sessionSettings[year] && sessionSettings[year].discount) || 0
    };
}

function getGradeOrderIndex(grade) {
    const index = gradeOrder.indexOf(grade);
    return index === -1 ? gradeOrder.length : index;
}

function loadStudentsData() {
    console.log('🔄 Loading students data...');
    window.db.collection("students").onSnapshot((snapshot) => {
        console.log('✅ Got students snapshot, size:', snapshot.size);
        studentsData = [];
        pendingRequests = [];
        rejectedStudents = [];
        allSignups = [];
        invalidGradeStudents = [];
        let activeCount = 0;

        snapshot.forEach((doc) => {
            const student = doc.data();
            student.id = doc.id;

            if (student.isActivated === true) {
                studentsData.push(student);
                activeCount++;
                allSignups.push(student);
                // Check if grade is invalid
                if (!gradeOrder.includes(student.grade)) {
                    invalidGradeStudents.push(student);
                }
            } else if (student.status === 'rejected') {
                rejectedStudents.push(student);
                allSignups.push(student);
            } else {
                pendingRequests.push(student);
                allSignups.push(student);
            }
        });

        console.log("Students loaded:", studentsData.length, "Pending requests:", pendingRequests.length);
        console.log("Students with invalid grades:", invalidGradeStudents);

        // Sort active students first by grade order, then by name
        studentsData.sort((a, b) => {
            const gradeAIndex = getGradeOrderIndex(a.grade);
            const gradeBIndex = getGradeOrderIndex(b.grade);
            if (gradeAIndex !== gradeBIndex) {
                return gradeAIndex - gradeBIndex;
            }
            // If same grade, sort by name
            return (a.name || "").localeCompare(b.name || "", 'ar');
        });

        try { applyStudentFilters(); } catch (e) { console.error('applyStudentFilters error:', e); }
        try { applyRequestFilters(); } catch (e) { console.error('applyRequestFilters error:', e); }
        updateDashboardStats(studentsData);


        // Update combined requests badge (sidebar)
        const sidebarBadge = document.getElementById('combined-requests-badge');
        const mobileBadge = document.getElementById('combined-requests-badge-mobile');
        const mobileBadge2 = document.getElementById('combined-requests-badge-mobile2');
        const combinedTabBadge = document.getElementById('combined-requests-count');

        const count = pendingRequests.length;
        if (sidebarBadge) {
            sidebarBadge.textContent = count;
            sidebarBadge.style.display = count > 0 ? 'inline-block' : 'none';
        }
        if (mobileBadge) {
            mobileBadge.textContent = count;
            mobileBadge.classList.toggle('hidden', count === 0);
        }
        if (mobileBadge2) {
            mobileBadge2.textContent = count;
            mobileBadge2.classList.toggle('hidden', count === 0);
        }
        if (combinedTabBadge) {
            combinedTabBadge.textContent = count;
        }

        loadPaymentRequests();
        updatePerGradeCountsDisplay();
    }, (error) => {
        console.error('❌ Error loading students:', error);
        showToast('خطأ في تحميل بيانات الطلاب: ' + error.message, 'error');
    });
}

let currentPaymentTab = 'pending';
let allPaymentRequests = [];

function loadPaymentRequests() {
    console.log('🔄 Loading payment requests...');
    window.db.collection("payment_requests").orderBy("timestamp", "desc").onSnapshot((snapshot) => {
        console.log('✅ Got payment requests snapshot, size:', snapshot.size);
        allPaymentRequests = [];
        snapshot.forEach(doc => {
            allPaymentRequests.push({ id: doc.id, ...doc.data() });
        });

        renderPaymentsTable();
    }, (error) => {
        console.error('❌ Error loading payment requests:', error);
        showToast('خطأ في تحميل طلبات الدفع: ' + error.message, 'error');
    });
}

function renderPaymentsTable() {
    const paymentsGrid = document.getElementById('payments-cards-container');
    const badgeInner = document.querySelector('.payments-tab.active .badge');
    if (!paymentsGrid) return;

    const searchTerm = document.getElementById('search-payments')?.value.toLowerCase() || "";

    // Filter by tab status and search term
    const filtered = allPaymentRequests.filter(req => {
        const matchesStatus = (currentPaymentTab === 'pending') ? (req.status === 'pending') : (req.status === 'approved');
        const matchesSearch = req.studentName.toLowerCase().includes(searchTerm) ||
            req.studentPhone.toLowerCase().includes(searchTerm);
        return matchesStatus && matchesSearch;
    });

    // Update Badges (Show pending count only)
    const pendingCount = allPaymentRequests.filter(r => r.status === 'pending').length;
    if (badgeInner) badgeInner.textContent = pendingCount;
    const combinedPaymentsBadge = document.getElementById('combined-payments-count');
    if (combinedPaymentsBadge) {
        combinedPaymentsBadge.textContent = pendingCount;
    }

    paymentsGrid.innerHTML = '';
    if (filtered.length === 0) {
        paymentsGrid.innerHTML = `<div style="text-align: center; padding: 40px; color: var(--text-muted);"><i class='bx bxs-wallet' style="font-size: 48px; margin-bottom: 12px;"></i><p>لا توجد بيانات متاحة حالياً</p></div>`;
        return;
    }

    filtered.forEach(req => {
        const date = req.timestamp ? new Date(req.timestamp.seconds * 1000).toLocaleString('ar-EG') : 'قيد المعالجة';
        const card = document.createElement('div');
        card.className = 'payment-card-new';

        const actionBtns = req.status === 'pending'
            ? `
                <div class="payment-card-actions-new">
                    <button class="btn-reject-new reject-pay-btn" data-id="${req.id}">
                        <i class='bx bx-trash'></i> حذف
                    </button>
                    <button class="btn-confirm-new approve-pay-btn" data-id="${req.id}" data-phone="${req.studentPhone}">
                        <i class='bx bx-check-circle'></i> تأكيد
                    </button>
                    <button class="btn-view-receipt-new view-receipt-btn" data-img="${req.receiptImage}">
                        <i class='bx bx-image'></i> إيصال
                    </button>
                </div>
            `
            : `
                <div class="payment-card-actions-new">
                    <button class="btn-reject-new delete-log-btn" data-id="${req.id}">
                        <i class='bx bx-trash'></i> حذف من السجل
                    </button>
                </div>
            `;

        card.innerHTML = `
            <div class="payment-card-content-new">
                <div class="payment-card-right-new">
                    <h3 class="payment-name-new">${req.studentName}</h3>
                    <div class="payment-details-list-new">
                        <div class="payment-detail-row-new">
                            <span class="payment-label-new">الحالة:</span>
                            <span class="payment-method-badge-new">${req.paymentMethod || 'محفظة إلكترونية'}</span>
                        </div>
                        <div class="payment-detail-row-new">
                            <span class="payment-label-new">التفاصيل:</span>
                            <span class="payment-value-new">${req.studentPhone}</span>
                        </div>
                        <div class="payment-detail-row-new">
                            <span class="payment-label-new">المبلغ المستلم:</span>
                            <span class="payment-amount-new">
                                ${req.status === 'pending' 
                                    ? `<input type="number" class="payment-amount-input-new" value="${req.amountPaid || 160}"> ج`
                                    : `${req.amountPaid} ج`
                                }
                            </span>
                        </div>
                        <div class="payment-detail-row-new">
                            <span class="payment-label-new">التاريخ:</span>
                            <span class="payment-value-new">${date}</span>
                        </div>
                    </div>
                </div>
                ${actionBtns}
            </div>
        `;
        paymentsGrid.appendChild(card);
    });

    attachPaymentEvents();
    renderReportsTransactions();
}

function renderReportsTransactions() {
    const tbody = document.getElementById('report-transactions-tbody');
    if (!tbody) return;

    // Get only approved payments, limited to 15 recent
    const history = allPaymentRequests
        .filter(r => r.status === 'approved')
        .slice(0, 15);

    tbody.innerHTML = '';
    if (history.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد عمليات مؤكدة بعد</td></tr>`;
        return;
    }

    history.forEach(req => {
        const date = req.confirmedAt ? new Date(req.confirmedAt.seconds * 1000).toLocaleString('ar-EG') : (req.timestamp ? new Date(req.timestamp.seconds * 1000).toLocaleDateString('ar-EG') : '---');
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${req.studentName}</strong></td>
            <td><strong style="color:var(--green);">${req.amountPaid} ج.م</strong></td>
            <td><span class="badge" style="background:var(--bg-elevated); color:var(--text-primary); border:none;">${req.paymentMethod || 'محفظة'}</span></td>
            <td><small>${date}</small></td>
            <td><span style="color:var(--green); font-weight:bold;">مكتمل ✅</span></td>
        `;
        tbody.appendChild(tr);
    });
}



// Filter and sort students helper
function filterAndSortStudents() {
    let filtered = [...studentsData];
    const searchInput = document.getElementById('search-student');
    const gradeSelect = document.getElementById('grade-filter');

    if (searchInput && searchInput.value.trim()) {
        const term = searchInput.value.toLowerCase().trim();
        filtered = filtered.filter(s => 
            (s.name || '').toLowerCase().includes(term) ||
            (s.phone || '').toLowerCase().includes(term)
        );
    }

    if (gradeSelect && gradeSelect.value) {
        filtered = filtered.filter(s => getGradeNameSafe(s.grade) === gradeSelect.value);
    }

    renderStudentsTable(filtered);
}

// Create Backup
function createBackup() {
    if (!confirm("هل تريد إنشاء نسخة احتياطية من بيانات الطلاب؟")) return;
    showToast("جاري إنشاء النسخة الاحتياطية...", "success");

    const backupData = {
        students: studentsData,
        pendingRequests: pendingRequests,
        timestamp: new Date().toISOString(),
        allPaymentRequests: allPaymentRequests
    };

    const backupStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([backupStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `el-mistar-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast("✅ تم إنشاء النسخة الاحتياطية بنجاح");
}

// Open Clean Data Modal
function openCleanDataModal() {
    let invalidStudentsHTML = '';

    if (invalidGradeStudents.length === 0) {
        invalidStudentsHTML = '<p style="text-align:center; color:var(--text-muted);">لا توجد طلاب بأصناف غير صالحة!</p>';
    } else {
        invalidStudentsHTML = '<div style="display:flex; flex-direction:column; gap:12px;">';
        invalidGradeStudents.forEach(student => {
            invalidStudentsHTML += `
                <div class="doodle-card" style="padding:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
                        <div>
                            <h4 style="color:var(--text-primary); margin:0;">${student.name}</h4>
                            <small style="color:var(--text-muted);">الصف الحالي: ${student.grade || 'غير محدد'}</small>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="fixStudentGrade('${student.id}')">
                            <i class="bx bx-edit"></i> تصحيح الصف
                        </button>
                    </div>
                </div>
            `;
        });
        invalidStudentsHTML += '</div>';
    }

    // Calculate distribution stats
    const gradeStats = {};
    gradeOrder.forEach(grade => {
        gradeStats[grade] = 0;
    });
    studentsData.forEach(student => {
        const safeGrade = getGradeNameSafe(student.grade);
        if (gradeStats[safeGrade] !== undefined) {
            gradeStats[safeGrade]++;
        }
    });

    let statsHTML = '<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:20px;">';
    gradeOrder.forEach(grade => {
        statsHTML += `
            <div class="doodle-card" style="padding:16px; text-align:center;">
                <h4 style="color:var(--accent); margin:0 0 8px;">${grade}</h4>
                <p style="color:var(--text-primary); font-size:24px; font-weight:800; margin:0;">${gradeStats[grade]} طالب</p>
            </div>
        `;
    });
    statsHTML += '</div>';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.zIndex = '9999';
    modal.innerHTML = `
        <div class="modal-sheet doodle-card" style="max-width:900px;">
            <div class="modal-head" style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; color:var(--text-primary);">
                    <i class="bx bx-data" style="color:var(--accent);"></i> فحص وتنظيف البيانات وتقرير التوزيع
                </h3>
                <button class="modal-close-btn" id="close-clean-modal" style="font-size:28px; border:none; background:transparent; cursor:pointer; color:var(--text-muted);">&times;</button>
            </div>
            <div class="modal-body" style="overflow-y:auto; max-height:70vh;">
                <h4 style="color:var(--text-primary);">تقرير توزيع الطلاب على الصفوف:</h4>
                ${statsHTML}
                <hr style="border-color:var(--border); margin:16px 0;">
                <h4 style="color:var(--text-primary);">الطلاب بأصناف غير صالحة (${invalidGradeStudents.length}):</h4>
                ${invalidStudentsHTML}
                <hr style="border-color:var(--border); margin:16px 0;">
                <h4 style="color:var(--text-primary);">الإجراءات المتاحة:</h4>
                <div style="display:flex; gap:12px; flex-wrap:wrap;">
                    <button class="btn btn-outline btn-sm" onclick="autoFixGrades()">
                        <i class="bx bx-wand"></i> تصحيح تلقائي (إستخدام getGradeNameSafe)
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    document.getElementById('close-clean-modal').addEventListener('click', () => {
        modal.remove();
    });
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

window.fixStudentGrade = function(studentId) {
    const student = studentsData.find(s => s.id === studentId);
    if (!student) return;
    openEditModal(student);
}

async function autoFixGrades() {
    if (!confirm("هل تريد تصحيح جميع الطلاب بأصناف غير صالحة تلقائياً؟")) return;
    showToast("جاري التصحيح التلقائي...", "success");

    let fixedCount = 0;
    for (let student of invalidGradeStudents) {
        const fixedGrade = getGradeNameSafe(student.grade);
        if (gradeOrder.includes(fixedGrade)) {
            try {
                await SyncService.executeDbOperation("students", "update", student.id, { grade: fixedGrade });
                fixedStudents.push(student);
                fixedCount++;
            } catch (err) {
                console.error(err);
                showToast(`حدث خطأ أثناء تصحيح ${student.name}`, "error");
            }
        }
    }

    showToast(`✅ تم تصحيح ${fixedCount} طالب`);
}

function attachPaymentEvents() {
    document.querySelectorAll('.view-receipt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const imgSrc = e.currentTarget.getAttribute('data-img');
            const win = window.open("", "الإيصال", "width=600,height=800");
            win.document.write(`<html><body style="margin:0; display:flex; align-items:center; justify-content:center; background:#000;"><img src="${imgSrc}" style="max-width:100%; height:auto; box-shadow:0 0 20px rgba(255,255,255,0.2);"></body></html>`);
        });
    });

    document.querySelectorAll('.approve-pay-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const phone = normalizePhone(e.currentTarget.getAttribute('data-phone'));
            const card = e.currentTarget.closest('.payment-card-new');
            const amountInput = card.querySelector('.payment-amount-input-new');
            const amount = amountInput ? parseInt(amountInput.value) || 0 : 0;

            if (confirm(`تأكيد استلام مبلغ ${amount} ج؟ سيتم تحديث رصيد الطالب ونقل الطلب للسجل.`)) {
                try {
                    // 1. Update Student Balance
                    let res1 = { offline: false };
                    const studentSnap = await getSnapshotByPhone("students", phone);
                    if (!studentSnap || studentSnap.empty) {
                        showToast('لم يتم العثور على الطالب بهذا الرقم', 'error');
                        return;
                    }
                        const doc = studentSnap.docs[0];
                        const studentData = doc.data();
                        
                        let currentPaid = studentData.paid || 0;
                        let attendance = studentData.attendance || [];
                        let otherExpenses = studentData.otherExpenses || 0;
                        
                        let totalPaymentPool = amount + currentPaid;
                        
                        // 1. Pay booklet / other expenses first
                        if (otherExpenses > 0) {
                            if (totalPaymentPool >= otherExpenses) {
                                totalPaymentPool -= otherExpenses;
                                otherExpenses = 0;
                            } else {
                                otherExpenses -= totalPaymentPool;
                                totalPaymentPool = 0;
                            }
                        }
                        
                        // 2. Pay for sessions (price depends on student's academic year)
                        var yearPrice = getPriceForYear(studentData.academicYear);
                        let sessionsPaid = Math.floor(totalPaymentPool / yearPrice);
                        if (sessionsPaid > 0) {
                            if (Array.isArray(attendance)) {
                                attendance = attendance.slice(sessionsPaid);
                            } else if (typeof attendance === 'number') {
                                attendance = Math.max(0, attendance - sessionsPaid);
                            }
                            totalPaymentPool -= (sessionsPaid * yearPrice);
                        }
                        
                        const newPaid = totalPaymentPool;
                        
                        res1 = await SyncService.executeDbOperation("students", "update", doc.id, {
                            paid: newPaid,
                            attendance: attendance,
                            otherExpenses: otherExpenses,
                            isActivated: true // Activate if they were pending
                        });

                    // 2. Update Request Status (Don't delete)
                    const res2 = await SyncService.executeDbOperation("payment_requests", "update", id, {
                        status: 'approved',
                        amountPaid: amount, // Save finalized amount
                        confirmedAt: 'SERVER_TIMESTAMP'
                    });

                    if ((!res1 || !res1.offline) && res2 && !res2.offline) {
                        showToast("✅ تم التأكيد وتحديث الحساب المالي");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("حدث خطأ أثناء التأكيد", "error");
                }
            }
        });
    });

    document.querySelectorAll('.reject-pay-btn, .delete-log-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("هل أنت متأكد من حذف هذا السجل نهائياً؟")) {
                try {
                    const result = await SyncService.executeDbOperation("payment_requests", "delete", id, null);
                    if (result && !result.offline) {
                        showToast("تم الحذف بنجاح");
                    }
                } catch (err) { showToast("خطأ في الحذف", "error"); }
            }
        });
    });
}

function getGradeNameSafe(g) {
    if (!g) return "غير محدد";
    const gradeStr = g.toString().trim();
    const names = {
        "teacher": "معلم لغة انجليزية",
        "0": "مرحلة الكي جي والتأسيس", "تأسيس": "مرحلة الكي جي والتأسيس", "مرحلة التأسيس": "مرحلة الكي جي والتأسيس", "تأسيس / KG": "مرحلة الكي جي والتأسيس",
        "1": "الصف الأول الابتدائي", "g1": "الصف الأول الابتدائي", "الصف الأول": "الصف الأول الابتدائي", "أول ابتدائي": "الصف الأول الابتدائي", "الأول الابتدائي": "الصف الأول الابتدائي",
        "2": "الصف الثاني الابتدائي", "g2": "الصف الثاني الابتدائي", "الصف الثاني": "الصف الثاني الابتدائي", "ثاني ابتدائي": "الصف الثاني الابتدائي", "الثاني الابتدائي": "الصف الثاني الابتدائي",
        "3": "الصف الثالث الابتدائي", "g3": "الصف الثالث الابتدائي", "الصف الثالث": "الصف الثالث الابتدائي", "ثالث ابتدائي": "الصف الثالث الابتدائي", "الثالث الابتدائي": "الصف الثالث الابتدائي",
        "4": "الصف الرابع الابتدائي", "g4": "الصف الرابع الابتدائي", "الصف الرابع": "الصف الرابع الابتدائي", "رابع ابتدائي": "الصف الرابع الابتدائي", "الرابع الابتدائي": "الصف الرابع الابتدائي",
        "5": "الصف الخامس الابتدائي", "g5": "الصف الخامس الابتدائي", "الصف الخامس": "الصف الخامس الابتدائي", "خامس ابتدائي": "الصف الخامس الابتدائي", "الخامس الابتدائي": "الصف الخامس الابتدائي",
        "6": "الصف السادس الابتدائي", "g6": "الصف السادس الابتدائي", "الصف السادس": "الصف السادس الابتدائي", "سادس ابتدائي": "الصف السادس الابتدائي", "السادس الابتدائي": "الصف السادس الابتدائي",
        "kg": "مرحلة الكي جي والتأسيس",
        "مرحلة الكي جي والتأسيس": "مرحلة الكي جي والتأسيس",
        "الصف الأول الابتدائي": "الصف الأول الابتدائي",
        "الصف الثاني الابتدائي": "الصف الثاني الابتدائي",
        "الصف الثالث الابتدائي": "الصف الثالث الابتدائي",
        "الصف الرابع الابتدائي": "الصف الرابع الابتدائي",
        "الصف الخامس الابتدائي": "الصف الخامس الابتدائي",
        "الصف السادس الابتدائي": "الصف السادس الابتدائي"
    };
    return names[gradeStr] || gradeStr;
}

function getFinancialStatus(student) {
    const attendanceRaw = student.attendance || [];
    const attendanceCount = Array.isArray(attendanceRaw) ? attendanceRaw.length : (parseInt(attendanceRaw) || 0);
    const paid = student.paid || 0;
    const otherExpenses = student.otherExpenses || 0;
    const paidPool = Math.max(0, paid - otherExpenses);
    var price = getPriceForYear(student.academicYear);
    const paidSessions = Math.floor(paidPool / price);
    const unpaidSessions = Math.max(0, attendanceCount - paidSessions);

    if (unpaidSessions === 0) return { status: 'clear', label: 'خالص 🟢', unpaid: 0 };
    if (unpaidSessions <= 4) return { status: 'late-1-4', label: `${unpaidSessions} حصة 🟡`, unpaid: unpaidSessions };
    if (unpaidSessions <= 7) return { status: 'late-5-7', label: `${unpaidSessions} حصة 🟠`, unpaid: unpaidSessions };
    return { status: 'late-8', label: `${unpaidSessions} حصة 🔴`, unpaid: unpaidSessions };
}

function getGroupInfo(groupId) {
    if (!groupId) return null;
    return groupsData.find(g => g.id === groupId);
}

function renderStudentsTable(data) {
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Filter by year tab
    let filtered = data;
    if (currentYearTab === 'current') {
        filtered = data.filter(s => !s.academicYear || s.academicYear === 'current');
    } else if (currentYearTab === 'previous') {
        filtered = data.filter(s => s.academicYear === 'previous');
    } else if (currentYearTab === 'summer') {
        filtered = data.filter(s => s.academicYear === 'summer');
    }

    const chip = document.getElementById('students-count-chip');
    if (chip) chip.textContent = `${filtered.length} طالب`;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" class="empty-state-td"><i class='bx bx-search-alt'></i><p>لا يوجد طلاب في هذا القسم</p></td></tr>`;
        return;
    }

    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;

    filtered.forEach(student => {
        const rawPhone = student.phone || "";
        let cleanPhone = rawPhone.toString().replace(/\D/g, '');
        if (cleanPhone.startsWith('0')) {
            cleanPhone = cleanPhone.substring(1);
        }
        const whatsappUrl = cleanPhone ? `https://wa.me/20${cleanPhone}` : "";

        const safeGrade = getGradeNameSafe(student.grade);

        // Financial status
        const finStatus = getFinancialStatus(student);
        let finColorClass = 'status-clear';
        let finLabel = '<span class="financial-badge clear">خالص 🟢</span>';
        if (finStatus.status === 'late-1-4') {
            finColorClass = 'status-late-1-4';
            finLabel = `<span class="financial-badge late">${finStatus.label}</span>`;
        } else if (finStatus.status === 'late-5-7') {
            finColorClass = 'status-late-5-7';
            finLabel = `<span class="financial-badge late">${finStatus.label}</span>`;
        } else if (finStatus.status === 'late-8') {
            finColorClass = 'status-late-8';
            finLabel = `<span class="financial-badge overdue">${finStatus.label}</span>`;
        }

        const warningIcon = finStatus.unpaid >= 8
            ? `<span class="financial-warning-icon" title="${finStatus.unpaid} حصص غير مسددة"><i class='bx bxs-error-circle'></i></span>`
            : '';

        // Group info
        const group = getGroupInfo(student.groupId);
        const groupHtml = group
            ? `<span class="group-badge" style="background:${group.color}">${group.name}</span>`
            : `<span style="color:var(--text-muted);font-size:12px;">—</span>`;

        const tr = document.createElement('tr');
        tr.draggable = true;
        tr.dataset.studentId = student.id;
        tr.innerHTML = `
            <td class="student-photo-cell" style="text-align:center;">
                ${student.profileImage
                    ? '<img src="' + student.profileImage + '" class="student-photo-avatar" style="width:42px;height:42px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);cursor:pointer;" onclick="StudentPhotoLightbox.open(this.src, \'' + (student.name || 'طالب') + '\')" alt="' + (student.name || 'طالب') + '">'
                    : '<div class="student-avatar-placeholder" style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#3b82f6),var(--accent-dark,#1d4ed8));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:16px;">' + (student.name || '?')[0] + '</div>'
                }
            </td>
            <td colspan="2" class="student-name-cell">
                <input type="checkbox" class="student-checkbox" data-id="${student.id}" title="تحديد الطالب">
                <span class="student-name-financial ${finColorClass}">${student.name}</span>
                ${warningIcon}
            </td>
            <td colspan="3" class="student-badges-cell">
                <span class="grade-badge">${safeGrade}</span>
                ${groupHtml}
                ${finLabel}
            </td>
            <td class="action-btns-cell">
                <div class="action-btns-inner">
                    ${whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" class="btn-icon success" title="تواصل عبر الواتساب"><i class='bx bxl-whatsapp'></i></a>` : ''}
                    <button class="btn-icon folder-btn" data-id="${student.id}" title="عرض ملف الطالب">
                        <i class='bx bx-folder-open'></i>
                    </button>
                    ${(student.academicYear || 'current') !== 'summer' ? `<button class="btn-icon summer-transfer-btn" data-id="${student.id}" title="نقل إلى الكورس الصيفي" style="color:var(--amber);border-color:rgba(245,158,11,0.3);"><i class='bx bxs-sun'></i></button>` : ''}
                    <button class="btn-icon edit-btn" data-id="${student.id}" title="تعديل"><i class='bx bx-edit'></i></button>
                    <button class="btn-icon danger delete-btn" data-id="${student.id}" title="حذف الطالب"><i class='bx bx-trash'></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);

        // Checkbox change event
        const checkbox = tr.querySelector('.student-checkbox');
        checkbox.addEventListener('change', updateBulkActionsToolbar);

        // Drag & drop events
        tr.addEventListener('dragstart', handleDragStart);
        tr.addEventListener('dragend', handleDragEnd);
        tr.addEventListener('dragover', handleDragOver);
        tr.addEventListener('dragleave', handleDragLeave);
        tr.addEventListener('drop', handleDrop);
    });

    // Render horizontal cards view (desktop only)
    const horizontalView = document.getElementById('students-horizontal-view');
    if (horizontalView) {
        horizontalView.innerHTML = '';
        if (filtered.length === 0) {
            horizontalView.innerHTML = `<div class="horizontal-empty-state"><i class='bx bx-search-alt'></i><p>لا يوجد طلاب في هذا القسم</p></div>`;
        } else {
            filtered.forEach(student => {
                const rawPhone = student.phone || "";
                let cleanPhone = rawPhone.toString().replace(/\D/g, '');
                if (cleanPhone.startsWith('0')) {
                    cleanPhone = cleanPhone.substring(1);
                }
                const whatsappUrl = cleanPhone ? `https://wa.me/20${cleanPhone}` : "";
                const safeGrade = getGradeNameSafe(student.grade);
                const finStatus = getFinancialStatus(student);
                let finColorClass = 'status-clear';
                let finLabel = '<span class="financial-badge clear">خالص 🟢</span>';
                if (finStatus.status === 'late-1-4') {
                    finColorClass = 'status-late-1-4';
                    finLabel = `<span class="financial-badge late">${finStatus.label}</span>`;
                } else if (finStatus.status === 'late-5-7') {
                    finColorClass = 'status-late-5-7';
                    finLabel = `<span class="financial-badge late">${finStatus.label}</span>`;
                } else if (finStatus.status === 'late-8') {
                    finColorClass = 'status-late-8';
                    finLabel = `<span class="financial-badge overdue">${finStatus.label}</span>`;
                }
                const warningIcon = finStatus.unpaid >= 8
                    ? `<span class="financial-warning-icon" title="${finStatus.unpaid} حصص غير مسددة"><i class='bx bxs-error-circle'></i></span>`
                    : '';
                const group = getGroupInfo(student.groupId);
                const groupHtml = group
                    ? `<span class="group-badge" style="background:${group.color}">${group.name}</span>`
                    : `<span style="color:var(--text-muted);font-size:12px;">—</span>`;

                const card = document.createElement('div');
                card.className = 'horizontal-student-card';
                card.dataset.studentId = student.id;
                card.draggable = true;
                var _avatarHtml = student.profileImage
                    ? '<img src="' + student.profileImage + '" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);flex-shrink:0;cursor:pointer;" onclick="StudentPhotoLightbox.open(this.src, \'' + (student.name || 'طالب') + '\')" alt="' + (student.name || 'طالب') + '">'
                    : '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--accent),var(--accent-dark));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.9rem;flex-shrink:0;">' + (student.name || '?')[0] + '</div>';
                card.innerHTML = `
                    <div class="hcard-header">
                        <input type="checkbox" class="student-checkbox" data-id="${student.id}" title="تحديد الطالب">
                        ${_avatarHtml}
                        <span class="student-name-financial ${finColorClass}">${student.name}</span>
                        ${warningIcon}
                    </div>
                    <div class="hcard-badges">
                        <span class="grade-badge">${safeGrade}</span>
                        ${groupHtml}
                        ${finLabel}
                    </div>
                    <div class="hcard-actions">
                        ${whatsappUrl ? `<a href="${whatsappUrl}" target="_blank" class="btn-icon success" title="تواصل عبر الواتساب"><i class='bx bxl-whatsapp'></i></a>` : ''}
                        <button class="btn-icon folder-btn" data-id="${student.id}" title="عرض ملف الطالب"><i class='bx bx-folder-open'></i></button>
                        ${(student.academicYear || 'current') !== 'summer' ? `<button class="btn-icon summer-transfer-btn" data-id="${student.id}" title="نقل إلى الكورس الصيفي" style="color:var(--amber);border-color:rgba(245,158,11,0.3);"><i class='bx bxs-sun'></i></button>` : ''}
                        <button class="btn-icon edit-btn" data-id="${student.id}" title="تعديل"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon danger delete-btn" data-id="${student.id}" title="حذف الطالب"><i class='bx bx-trash'></i></button>
                    </div>
                `;
                horizontalView.appendChild(card);

                // Checkbox change event
                const checkbox = card.querySelector('.student-checkbox');
                checkbox.addEventListener('change', updateBulkActionsToolbar);

                // Drag & drop events
                card.addEventListener('dragstart', handleDragStart);
                card.addEventListener('dragend', handleDragEnd);
                card.addEventListener('dragover', handleDragOver);
                card.addEventListener('dragleave', handleDragLeave);
                card.addEventListener('drop', handleDrop);
            });
        }
    }

    // Select all checkbox (remove old listener to avoid duplicates)
    if (selectAllCheckbox) {
        selectAllCheckbox.onchange = function() {
            const checked = this.checked;
            document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = checked);
            updateBulkActionsToolbar();
        };
    }

    attachTableEvents();
    attachFolderEvents();
    attachTransferEvents();
    updateBulkActionsToolbar();
}

function updateBulkActionsToolbar() {
    const toolbar = document.getElementById('bulk-actions-toolbar');
    const countEl = document.getElementById('bulk-selected-count');
    const checked = document.querySelectorAll('.student-checkbox:checked');
    const count = checked.length;
    if (countEl) countEl.textContent = count;
    if (toolbar) {
        toolbar.style.display = count > 0 ? 'flex' : 'none';
    }
}

function getSelectedStudentIds() {
    const ids = [];
    document.querySelectorAll('.student-checkbox:checked').forEach(cb => ids.push(cb.getAttribute('data-id')));
    return ids;
}

// Open bulk transfer dialog
function openBulkTransferDialog() {
    const ids = getSelectedStudentIds();
    if (ids.length === 0) {
        showToast('يرجى تحديد طالب واحد على الأقل', 'error');
        return;
    }

    const selectedStudents = ids.map(id => studentsData.find(s => s.id === id)).filter(Boolean);

    const groupOptions = '<option value="">بدون مجموعة</option>' +
        groupsData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const years = ['current', 'previous', 'summer'];
    const yearLabels = { current: 'العام الحالي', previous: 'العام الماضي', summer: 'الكورس الصيفي' };

    const namesList = selectedStudents.map(s => `• ${s.name}`).join('\n');

    const html = `
        <div style="padding:10px 0;">
            <h3 style="margin-bottom:8px;color:var(--text-primary);font-weight:800;">
                <i class='bx bx-transfer'></i> نقل جماعي للطلاب
            </h3>
            <div style="background:var(--bg-input);padding:12px 16px;border-radius:var(--r-sm);margin-bottom:16px;font-size:13px;color:var(--text-secondary);white-space:pre-line;max-height:120px;overflow-y:auto;border:1px solid var(--border);">
                ${namesList}
            </div>
            <div class="input-group">
                <label>نقل إلى العام الدراسي</label>
                <select id="bulk-transfer-year" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;">
                    ${years.map(y => `<option value="${y}">${yearLabels[y]}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>نقل إلى المجموعة (اختياري)</label>
                <select id="bulk-transfer-group" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;">
                    ${groupOptions}
                </select>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="btn btn-primary" id="confirm-bulk-transfer-btn" style="flex:1;">
                    <i class='bx bx-transfer'></i> نقل ${selectedStudents.length} طالب
                </button>
                <button class="btn btn-outline" id="cancel-bulk-transfer-btn">إلغاء</button>
            </div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'bulk-transfer-modal';
    overlay.innerHTML = `<div class="modal-sheet doodle-card" style="max-width:480px;">${html}</div>`;
    document.body.appendChild(overlay);

    document.getElementById('cancel-bulk-transfer-btn')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('confirm-bulk-transfer-btn')?.addEventListener('click', async () => {
        const newYear = document.getElementById('bulk-transfer-year')?.value || 'current';
        const newGroup = document.getElementById('bulk-transfer-group')?.value || '';
        const btn = document.getElementById('confirm-bulk-transfer-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = 'جاري النقل... <i class="bx bx-loader-alt bx-spin"></i>'; }

        let successCount = 0;
        let failCount = 0;

        for (const student of selectedStudents) {
            try {
                await SyncService.executeDbOperation('students', 'update', student.id, {
                    academicYear: newYear,
                    groupId: newGroup || student.groupId || ''
                });
                successCount++;
            } catch (err) {
                console.error('Bulk transfer error:', student.name, err);
                failCount++;
            }
        }

        overlay.remove();
        if (failCount === 0) {
            showToast(`✅ تم نقل ${successCount} طالب بنجاح إلى ${yearLabels[newYear]}`);
        } else {
            showToast(`✅ تم نقل ${successCount} طالب، فشل ${failCount} طالب`, 'error');
        }
    });
}

function initBulkActions() {
    document.getElementById('bulk-transfer-btn')?.addEventListener('click', openBulkTransferDialog);
    document.getElementById('bulk-clear-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.student-checkbox:checked').forEach(cb => cb.checked = false);
        updateBulkActionsToolbar();
    });

    // Requests bulk actions
    document.getElementById('requests-bulk-activate-btn')?.addEventListener('click', openRequestsBulkActivate);
    document.getElementById('requests-bulk-transfer-btn')?.addEventListener('click', openRequestsBulkTransfer);
    document.getElementById('requests-bulk-clear-btn')?.addEventListener('click', () => {
        document.querySelectorAll('.request-checkbox:checked').forEach(cb => cb.checked = false);
        updateRequestsBulkToolbar();
    });
}

function updateRequestsBulkToolbar() {
    const toolbar = document.getElementById('requests-bulk-toolbar');
    const countEl = document.getElementById('requests-bulk-count');
    const checked = document.querySelectorAll('.request-checkbox:checked');
    const count = checked.length;
    if (countEl) countEl.textContent = count;
    if (toolbar) {
        toolbar.style.display = count > 0 ? 'flex' : 'none';
    }
}

function getSelectedRequestIds() {
    const ids = [];
    document.querySelectorAll('.request-checkbox:checked').forEach(cb => ids.push(cb.getAttribute('data-id')));
    return ids;
}

function openRequestsBulkActivate() {
    const ids = getSelectedRequestIds();
    if (ids.length === 0) {
        showToast('يرجى تحديد طالب واحد على الأقل', 'error');
        return;
    }

    const allSelected = ids.map(id => allSignups.find(s => s.id === id)).filter(Boolean);
    const toActivate = allSelected.filter(s => s.isActivated !== true);
    const alreadyActivated = allSelected.filter(s => s.isActivated === true);

    if (toActivate.length === 0) {
        showToast('جميع الطلاب المحددين مفعلون بالفعل', 'error');
        return;
    }

    let msg = `هل أنت متأكد من تفعيل ${toActivate.length} طالب؟`;
    if (alreadyActivated.length > 0) {
        msg += `\n(${alreadyActivated.length} طالب مفعل بالفعل وسيتم تخطيهم)`;
    }
    if (!confirm(msg)) return;

    const btn = document.getElementById('requests-bulk-activate-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = 'جاري التفعيل... <i class="bx bx-loader-alt bx-spin"></i>'; }

    let successCount = 0;
    let failCount = 0;

    const promises = toActivate.map(s =>
        SyncService.executeDbOperation('students', 'update', s.id, {
            isActivated: true,
            status: '',
            rejectionReason: ''
        }).then(() => successCount++).catch(err => { console.error(err); failCount++; })
    );

    Promise.all(promises).finally(() => {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bx bx-user-check"></i> تفعيل'; }
        document.querySelectorAll('.request-checkbox:checked').forEach(cb => cb.checked = false);
        updateRequestsBulkToolbar();
        if (failCount === 0) {
            showToast(`✅ تم تفعيل ${successCount} طالب بنجاح`);
        } else {
            showToast(`✅ تم تفعيل ${successCount} طالب، فشل ${failCount} طالب`, 'error');
        }
    });
}

function openRequestsBulkTransfer() {
    const ids = getSelectedRequestIds();
    if (ids.length === 0) {
        showToast('يرجى تحديد طالب واحد على الأقل', 'error');
        return;
    }

    const selectedStudents = ids.map(id => allSignups.find(s => s.id === id)).filter(Boolean);
    const groupOptions = '<option value="">بدون مجموعة</option>' +
        groupsData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const years = ['current', 'previous', 'summer'];
    const yearLabels = { current: 'العام الحالي', previous: 'العام الماضي', summer: 'الكورس الصيفي' };
    const namesList = selectedStudents.map(s => `• ${s.name}`).join('\n');

    const html = `
        <div style="padding:10px 0;">
            <h3 style="margin-bottom:8px;color:var(--text-primary);font-weight:800;">
                <i class='bx bx-transfer'></i> نقل جماعي للطلاب المسجلين
            </h3>
            <div style="background:var(--bg-input);padding:12px 16px;border-radius:var(--r-sm);margin-bottom:16px;font-size:13px;color:var(--text-secondary);white-space:pre-line;max-height:120px;overflow-y:auto;border:1px solid var(--border);">
                ${namesList}
            </div>
            <div class="input-group">
                <label>نقل إلى العام الدراسي</label>
                <select id="req-bulk-transfer-year" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;">
                    ${years.map(y => `<option value="${y}">${yearLabels[y]}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>نقل إلى المجموعة (اختياري)</label>
                <select id="req-bulk-transfer-group" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;">
                    ${groupOptions}
                </select>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="btn btn-primary" id="confirm-req-bulk-transfer-btn" style="flex:1;">
                    <i class='bx bx-transfer'></i> نقل ${selectedStudents.length} طالب
                </button>
                <button class="btn btn-outline" id="cancel-req-bulk-transfer-btn">إلغاء</button>
            </div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'req-bulk-transfer-modal';
    overlay.innerHTML = `<div class="modal-sheet doodle-card" style="max-width:480px;">${html}</div>`;
    document.body.appendChild(overlay);

    document.getElementById('cancel-req-bulk-transfer-btn')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('confirm-req-bulk-transfer-btn')?.addEventListener('click', async () => {
        const newYear = document.getElementById('req-bulk-transfer-year')?.value || 'current';
        const newGroup = document.getElementById('req-bulk-transfer-group')?.value || '';
        const btn = document.getElementById('confirm-req-bulk-transfer-btn');
        if (btn) { btn.disabled = true; btn.innerHTML = 'جاري النقل... <i class="bx bx-loader-alt bx-spin"></i>'; }

        let successCount = 0;
        let failCount = 0;

        for (const student of selectedStudents) {
            try {
                const updates = {
                    academicYear: newYear,
                    groupId: newGroup || student.groupId || ''
                };
                // Preserve existing activation/rejection status when transferring
                await SyncService.executeDbOperation('students', 'update', student.id, updates);
                successCount++;
            } catch (err) {
                console.error('Bulk request transfer error:', student.name, err);
                failCount++;
            }
        }

        overlay.remove();
        document.querySelectorAll('.request-checkbox:checked').forEach(cb => cb.checked = false);
        updateRequestsBulkToolbar();
        if (failCount === 0) {
            showToast(`✅ تم نقل ${successCount} طالب بنجاح إلى ${yearLabels[newYear]}`);
        } else {
            showToast(`✅ تم نقل ${successCount} طالب، فشل ${failCount} طالب`, 'error');
        }
    });
}

// Drag & Drop handlers
let draggedStudentId = null;

function handleDragStart(e) {
    draggedStudentId = e.currentTarget.dataset.studentId;
    e.currentTarget.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedStudentId);
}

function handleDragEnd(e) {
    e.currentTarget.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    if (target.dataset.studentId !== draggedStudentId) {
        target.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const targetStudentId = e.currentTarget.dataset.studentId;
    if (!draggedStudentId || draggedStudentId === targetStudentId) return;

    // Open transfer dialog
    const student = studentsData.find(s => s.id === draggedStudentId);
    if (student) {
        openTransferDialog(student);
    }
    draggedStudentId = null;
}

function attachTransferEvents() {
    // Summer transfer button
    document.querySelectorAll('.summer-transfer-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = this.getAttribute('data-id');
            var student = studentsData.find(function (s) { return s.id === id; });
            if (!student) return;
            if (confirm('نقل الطالب "' + student.name + '" إلى الكورس الصيفي؟')) {
                SyncService.executeDbOperation('students', 'update', id, { academicYear: 'summer' })
                    .then(function () {
                        if (typeof showToast === 'function') showToast('✅ تم نقل ' + student.name + ' إلى الكورس الصيفي');
                    })
                    .catch(function (err) {
                        console.error('Summer transfer error:', err);
                        if (typeof showToast === 'function') showToast('حدث خطأ أثناء النقل', 'error');
                    });
            }
        });
    });
}

function openTransferDialog(student) {
    let groupOptions = '<option value="">بدون مجموعة</option>';
    groupsData.forEach(g => {
        groupOptions += `<option value="${g.id}">${g.name}</option>`;
    });

    const currentYear = student.academicYear || 'current';
    const years = ['current', 'previous', 'summer'];
    const yearLabels = { current: 'العام الحالي', previous: 'العام الماضي', summer: 'الكورس الصيفي' };

    const html = `
        <div style="padding:10px 0;">
            <h3 style="margin-bottom:16px;color:var(--text-primary);font-weight:800;">نقل الطالب: ${student.name}</h3>
            <div class="input-group">
                <label>نقل إلى العام الدراسي</label>
                <select id="transfer-year" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;">
                    ${years.map(y => `<option value="${y}" ${y === currentYear ? 'selected' : ''}>${yearLabels[y]}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>نقل إلى المجموعة</label>
                <select id="transfer-group" style="width:100%;padding:10px;border-radius:var(--r-sm);border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-family:inherit;">
                    ${groupOptions}
                </select>
            </div>
            <div style="display:flex;gap:10px;margin-top:16px;">
                <button class="btn btn-primary" id="confirm-transfer-btn" style="flex:1;">
                    <i class='bx bx-transfer'></i> نقل
                </button>
                <button class="btn btn-outline" id="cancel-transfer-btn">إلغاء</button>
            </div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'transfer-modal';
    overlay.innerHTML = `<div class="modal-sheet doodle-card" style="max-width:450px;">${html}</div>`;
    document.body.appendChild(overlay);

    document.getElementById('cancel-transfer-btn')?.addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    document.getElementById('confirm-transfer-btn')?.addEventListener('click', async () => {
        const newYear = document.getElementById('transfer-year')?.value || 'current';
        const newGroup = document.getElementById('transfer-group')?.value || '';

        try {
            await SyncService.executeDbOperation('students', 'update', student.id, {
                academicYear: newYear,
                groupId: newGroup
            });
            showToast(`✅ تم نقل ${student.name} بنجاح`);
            overlay.remove();
        } catch (err) {
            showToast('حدث خطأ أثناء النقل', 'error');
        }
    });
}

function showOverdueStudents() {
    const overdue = studentsData.filter(s => {
        const fin = getFinancialStatus(s);
        return fin.unpaid >= 8;
    });

    if (overdue.length === 0) {
        showToast('لا يوجد طلاب متأخرين 8 حصص فأكثر ✅');
        return;
    }

    const names = overdue.map(s => `• ${s.name} (${s.phone || 'بدون هاتف'})`).join('\n');
    if (confirm(`الطلاب المتأخرين (${overdue.length}):\n\n${names}\n\nهل تريد عرضهم في القائمة؟`)) {
        // Switch to students view and show only overdue
        switchView('students-view', 'إدارة الطلاب');
        // Temporarily override currentYearTab to show all
        const savedTab = currentYearTab;
        currentYearTab = 'all';
        renderStudentsTable(overdue);
        currentYearTab = savedTab;
        showToast(`تم عرض ${overdue.length} طالب متأخر`);
    }
}

function timeAgo(date) {
    if (!date) return "";
    const now = new Date();
    const d = date instanceof Date ? date : (date.seconds ? new Date(date.seconds * 1000) : new Date(date));
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return "الآن";
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 2592000) return `منذ ${Math.floor(diff / 86400)} يوم`;
    return `منذ ${Math.floor(diff / 2592000)} شهر`;
}

function getGradeColor(grade) {
    const colors = {
        "مرحلة الكي جي والتأسيس": { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
        "الصف الأول الابتدائي": { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
        "الصف الثاني الابتدائي": { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
        "الصف الثالث الابتدائي": { bg: '#ede9fe', text: '#5b21b6', border: '#8b5cf6' },
        "الصف الرابع الابتدائي": { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
        "الصف الخامس الابتدائي": { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
        "الصف السادس الابتدائي": { bg: '#ccfbf1', text: '#115e59', border: '#14b8a6' }
    };
    return colors[grade] || { bg: '#f1f5f9', text: '#475569', border: '#94a3b8' };
}

function getStatusInfo(student) {
    if (student.isActivated === true) return { label: 'مفعل', class: 'status-activated' };
    if (student.status === 'rejected') return { label: 'مرفوض', class: 'status-rejected' };
    return { label: 'قيد الانتظار', class: 'status-pending' };
}

function renderRequestsTable(data) {
    const grid = document.getElementById('requests-grid');
    const emptyState = document.getElementById('requests-empty-state');
    const countEl = document.getElementById('requests-count');
    if (!grid) return;

    grid.innerHTML = '';

    if (countEl) countEl.textContent = data.length;

    if (data.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
        grid.classList.add('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    grid.classList.remove('hidden');

    const sorted = [...data].sort((a, b) => {
        const gradeOrder = { "مرحلة الكي جي والتأسيس": 0, "الصف الأول الابتدائي": 1, "الصف الثاني الابتدائي": 2, "الصف الثالث الابتدائي": 3, "الصف الرابع الابتدائي": 4, "الصف الخامس الابتدائي": 5, "الصف السادس الابتدائي": 6 };
        const gradeA = gradeOrder[getGradeNameSafe(a.grade)] ?? 99;
        const gradeB = gradeOrder[getGradeNameSafe(b.grade)] ?? 99;
        if (gradeA !== gradeB) return gradeA - gradeB;
        const timeA = a.createdAt?.seconds || 0;
        const timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
    });

    sorted.forEach(req => {
        const card = document.createElement('div');
        card.className = 'request-card';
        card.dataset.studentId = req.id;
        const gradeName = getGradeNameSafe(req.grade);
        const gc = getGradeColor(gradeName);
        const timeStr = timeAgo(req.createdAt);
        const statusInfo = getStatusInfo(req);

        // Show checkbox for all statuses (including activated/rejected)
        const showCheckbox = true;
        const checkboxHtml = showCheckbox
            ? `<input type="checkbox" class="request-checkbox" data-id="${req.id}" title="تحديد الطالب" style="width:18px;height:18px;cursor:pointer;accent-color:var(--accent);">`
            : '';

        let actionsHtml = '';
        if (req.isActivated === true) {
            actionsHtml = `
                <button class="btn btn-outline view-student-btn" data-id="${req.id}" style="flex:1;">
                    <i class='bx bx-show'></i> عرض
                </button>
            `;
        } else if (req.status === 'rejected') {
            const reason = req.rejectionReason ? ` (${req.rejectionReason})` : '';
            actionsHtml = `
                <button class="btn btn-outline" style="flex:0.5;cursor:default;opacity:0.7;" title="سبب الرفض: ${reason}">
                    <i class='bx bx-x-circle'></i> مرفوض
                </button>
                <button class="btn req-btn-delete permanently-delete-btn" data-id="${req.id}" title="حذف نهائي">
                    <i class='bx bx-trash'></i> حذف
                </button>
            `;
        } else {
            actionsHtml = `
                <a href="${buildWhatsAppUrl(req.phone, getNewRequestMessage(req))}" target="_blank" class="btn whatsapp-contact-btn" title="تواصل مع ولي الأمر" style="color:#fff;background:#25D366;border:none;flex:0.5;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:12px;padding:10px 14px;font-weight:700;">
                    <i class='bx bxl-whatsapp'></i> واتساب
                </a>
                <button class="btn btn-primary edit-request-btn" data-id="${req.id}">
                    <i class='bx bx-user-check'></i> تفعيل
                </button>
                <button class="btn req-btn-reject delete-request-btn" data-id="${req.id}" title="رفض الطلب">
                    <i class='bx bx-x'></i> رفض
                </button>
            `;
        }

        card.innerHTML = `
            ${checkboxHtml}
            <div class="req-card-top">
                <div class="req-avatar" style="background:${gc.bg};color:${gc.text};border-color:${gc.border};">
                    ${req.profileImage
                        ? '<img src="' + req.profileImage + '" style="width:100%;height:100%;object-fit:cover;border-radius:12px;cursor:pointer;" onclick="StudentPhotoLightbox.open(this.src, \'' + (req.name || 'طالب') + '\')" alt="' + (req.name || 'طالب') + '">'
                        : (req.name || '؟').charAt(0)}
                </div>
                <div class="req-time-badge">${timeStr}</div>
            </div>
            <div class="req-card-body">
                <h3 class="req-name">${req.name || 'غير مشخص'}</h3>
                <div class="req-meta">
                    <span class="req-phone"><i class='bx bxs-phone'></i> ${req.phone}</span>
                    <span class="req-grade-tag" style="background:${gc.bg};color:${gc.text};border:1px solid ${gc.border};">${gradeName}</span>
                    <span class="req-status-tag ${statusInfo.class}">${statusInfo.label}</span>
                </div>
            </div>
            <div class="req-card-actions">
                ${actionsHtml}
            </div>
        `;
        grid.appendChild(card);

        // Checkbox change event
        if (showCheckbox) {
            const cb = card.querySelector('.request-checkbox');
            cb.addEventListener('change', updateRequestsBulkToolbar);
        }
    });

    attachRequestEvents();
    updateRequestsBulkToolbar();

    // Select All checkbox - not applicable for cards, so we skip it
}

function applyRequestFilters() {
    const searchInput = document.getElementById('search-requests');
    const gradeFilter = document.getElementById('requests-grade-filter');
    const term = searchInput?.value?.toLowerCase().trim() || '';
    const grade = gradeFilter?.value || '';

    let filtered;
    if (currentRequestFilter === 'pending') {
        filtered = [...pendingRequests];
    } else if (currentRequestFilter === 'activated') {
        filtered = allSignups.filter(s => s.isActivated === true);
    } else if (currentRequestFilter === 'rejected') {
        filtered = [...rejectedStudents];
    } else {
        filtered = [...allSignups];
    }

    // Show/hide bulk activate button based on tab
    const bulkActivateBtn = document.getElementById('requests-bulk-activate-btn');
    if (bulkActivateBtn) {
        if (currentRequestFilter === 'activated' || currentRequestFilter === 'rejected') {
            bulkActivateBtn.style.display = 'none';
        } else {
            bulkActivateBtn.style.display = '';
        }
    }

    if (term) {
        filtered = filtered.filter(s =>
            (s.name || '').toLowerCase().includes(term) ||
            (s.phone || '').includes(term)
        );
    }
    if (grade) {
        filtered = filtered.filter(s => getGradeNameSafe(s.grade) === grade);
    }

    renderRequestsTable(filtered);
}

function attachRequestEvents() {
    document.querySelectorAll('.delete-request-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            rejectionStudentId = id;
            document.getElementById('rejection-reason').value = '';
            document.getElementById('rejection-modal').classList.remove('hidden');
        });
    });

    document.querySelectorAll('.edit-request-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const student = (pendingRequests.find(s => s.id === id) || allSignups.find(s => s.id === id));
            if (student) {
                openEditModal(student);
            }
        });
    });

    document.querySelectorAll('.view-student-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const student = allSignups.find(s => s.id === id);
            if (student) {
                openEditModal(student);
            }
        });
    });

    document.querySelectorAll('.permanently-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const student = allSignups.find(s => s.id === id);
            const name = student?.name || 'هذا الطالب';
            if (!confirm(`هل أنت متأكد من حذف ${name} نهائياً؟\n\nلا يمكن التراجع عن هذا الإجراء.`)) return;
            if (!confirm(`تأكيد نهائي: حذف ${name} بشكل دائم من قاعدة البيانات؟`)) return;
            try {
                await SyncService.executeDbOperation('students', 'delete', id, null);
                showToast(`تم حذف ${name} نهائياً`);
            } catch (err) {
                console.error('Delete Error:', err);
                showToast('حدث خطأ أثناء الحذف', 'error');
            }
        });
    });
}

// Rejection modal logic
let rejectionStudentId = null;
const rejectionModal = document.getElementById('rejection-modal');
if (rejectionModal) {
    document.getElementById('confirm-rejection-btn')?.addEventListener('click', async () => {
        const reason = document.getElementById('rejection-reason').value.trim();
        if (!reason) {
            showToast('يرجى إدخال سبب الرفض', 'error');
            return;
        }
        try {
            await SyncService.executeDbOperation("students", "update", rejectionStudentId, {
                status: 'rejected',
                rejectionReason: reason,
                rejectedAt: 'SERVER_TIMESTAMP'
            });
            rejectionModal.classList.add('hidden');
            showToast('تم رفض الطلب بنجاح');
        } catch (err) {
            console.error("Rejection Error:", err);
            showToast('حدث خطأ أثناء الرفض', 'error');
        }
    });
    document.getElementById('close-rejection-modal')?.addEventListener('click', () => {
        rejectionModal.classList.add('hidden');
    });
    document.getElementById('cancel-rejection-btn')?.addEventListener('click', () => {
        rejectionModal.classList.add('hidden');
    });
}

// Attach Edit/Delete Events
function attachTableEvents() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("هل أنت متأكد أنك تريد حذف هذا الطالب نهائياً؟")) {
                try {
                    const result = await SyncService.executeDbOperation("students", "delete", id, null);
                    if (result && !result.offline) {
                        showToast("تم حذف الطالب بنجاح");
                    }
                } catch (error) {
                    showToast("حدث خطأ أثناء الحذف", "error");
                }
            }
        });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const student = studentsData.find(s => s.id === id);
            if (student) {
                openEditModal(student);
            }
        });
    });
}

// Attach Folder Events
function attachFolderEvents() {
    document.querySelectorAll('.folder-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const student = studentsData.find(s => s.id === id);
            if (student) {
                openStudentFileModal(student);
            }
        });
    });
}

// Student File Modal
const studentFileModal = document.getElementById('student-file-modal');
const closeStudentFileBtn = document.getElementById('close-student-file-modal');
const studentFileContent = document.getElementById('student-file-content');

if (closeStudentFileBtn) {
    closeStudentFileBtn.addEventListener('click', () => {
        studentFileModal.classList.add('hidden');
    });
}

if (studentFileModal) {
    studentFileModal.addEventListener('click', (e) => {
        if (e.target === studentFileModal) {
            studentFileModal.classList.add('hidden');
        }
    });
}

function openStudentFileModal(student) {
    const safeGrade = getGradeNameSafe(student.grade);
    const attendanceRaw = student.attendance || [];
    const attendanceCount = Array.isArray(attendanceRaw) ? attendanceRaw.length : (parseInt(attendanceRaw) || 0);
    const paid = student.paid || 0;
    const yearPrice = getPriceForYear(student.academicYear);
    const yearSessions = getSessionsForYear(student.academicYear);
    const requiredSoFar = (attendanceCount * yearPrice) + (student.otherExpenses || 0);
    const debt = Math.max(0, requiredSoFar - paid);
    const totalSessions = student.totalSessions || yearSessions;
    const attendancePercentage = totalSessions > 0 ? Math.round((attendanceCount / totalSessions) * 100) : 0;

    let paymentStatusBadge;
    let statCardClass;
    if (debt === 0 && attendanceCount > 0) {
        paymentStatusBadge = '<span class="badge" style="background: var(--green-dim); color: var(--green);">خالص ✅</span>';
        statCardClass = 'stat-green';
    } else if (debt > 0) {
        paymentStatusBadge = `<span class="badge" style="background: var(--red-dim); color: var(--red);">متبقي ${debt} ج</span>`;
        statCardClass = 'stat-red';
    } else {
        paymentStatusBadge = '<span class="badge" style="background: var(--bg-elevated); color: var(--text-muted);">لا توجد مدفوعات حتى الآن</span>';
        statCardClass = '';
    }

    // Render attendance dots summary
    let attendedArray = [];
    if (Array.isArray(attendanceRaw)) {
        attendedArray = attendanceRaw;
    } else if (typeof attendanceRaw === 'number') {
        for (let i = 1; i <= attendanceRaw; i++) attendedArray.push(i);
    }

    let attendanceHtml = '';
    const paidPool = Math.max(0, paid - (student.otherExpenses || 0));
    const totalPaidSessions = Math.floor(paidPool / yearPrice);
    const rows = Math.ceil(totalSessions / yearSessions);

    for (let r = 0; r < rows; r++) {
        let rowHtml = '';
        for (let i = 1; i <= yearSessions; i++) {
            const index = (r * 8) + i;
            if (index > totalSessions) break;

            const isAttended = attendedArray.includes(index);
            const isPaid = index <= totalPaidSessions;

            let color, textColor, border;
            if (isAttended && isPaid) {
                color = 'var(--green)';
                textColor = 'white';
                border = 'none';
            } else if (isAttended && !isPaid) {
                color = 'var(--red)';
                textColor = 'white';
                border = 'none';
            } else if (!isAttended && isPaid) {
                color = 'var(--accent)';
                textColor = 'white';
                border = 'none';
            } else {
                color = 'var(--bg-elevated)';
                textColor = 'var(--text-muted)';
                border = '1px solid var(--border)';
            }

            rowHtml += `<span class="attendance-dot" style="background: ${color}; color: ${textColor}; border: ${border};">${i}</span>`;
        }

        attendanceHtml += `
            <div class="month-group">
                <div class="month-label"><i class='bx bx-calendar'></i> الشهر رقم ${r + 1}</div>
                <div class="attendance-dots-row">${rowHtml}</div>
            </div>`;
    }

    studentFileContent.innerHTML = `
        <div class="student-file-header">
            <div class="student-avatar" style="overflow:hidden;display:flex;align-items:center;justify-content:center;">
                ${student.profileImage
                    ? '<img src="' + student.profileImage + '" style="width:100%;height:100%;object-fit:cover;">'
                    : (student.name ? student.name.charAt(0) : '?')
                }
            </div>
            <div class="student-file-title">
                <h3><span class="student-name-text">${student.name || 'غير مشخص'}</span> <span class="student-level-badge">${safeGrade}</span></h3>
                <span>كود الطالب: ${student.code || 'غير محدد'}</span>
            </div>
        </div>

        <!-- Statistics Grid -->
        <div class="student-file-stats-grid">
            <div class="student-file-stat-card">
                <label>الصف الدراسي</label>
                <div class="stat-value"><i class='bx bx-graduation'></i>${safeGrade}</div>
            </div>
            <div class="student-file-stat-card">
                <label>رقم ولي الأمر</label>
                <div class="stat-value"><i class='bx bx-phone-call'></i>${student.phone || 'غير محدد'}</div>
            </div>
            <div class="student-file-stat-card">
                <label>الحضور</label>
                <div class="stat-value"><i class='bx bx-calendar-check' style="color: var(--accent);"></i>${attendanceCount} / ${totalSessions} حصص</div>
                <div class="student-file-progress">
                    <div class="student-file-progress-bar" style="width: ${attendancePercentage}%;"></div>
                </div>
            </div>
            <div class="student-file-stat-card ${statCardClass}">
                <label>المبلغ المدفوع</label>
                <div class="stat-value"><i class='bx bx-money-withdraw' style="color: var(--green);"></i>${paid} ج</div>
            </div>
            <div class="student-file-stat-card ${statCardClass}">
                <label>الحالة المالية</label>
                <div class="stat-value">${paymentStatusBadge}</div>
            </div>
            ${student.academicYear !== 'previous' ? `
            <div class="student-file-stat-card">
                <label>مستوى الطالب</label>
                <div class="stat-value"><i class='bx bx-star' style="color: var(--amber);"></i>${student.level || 'لم يتم التحديد'}</div>
            </div>
            ` : ''}
            ${student.academicYear !== 'previous' && (student.day || student.hour) ? `
            <div class="student-file-stat-card" style="grid-column: 1 / -1;">
                <label>موعد الحصة</label>
                <div class="stat-value"><i class='bx bx-time-five' style="color: var(--accent);"></i>${student.day || ''} ${student.hour || ''}</div>
            </div>
            ` : ''}
        </div>

        <!-- Attendance Details -->
        <div class="student-file-attendance doodle-card">
            <h4 class="student-file-section-title"><i class='bx bx-calendar-check'></i> تفاصيل الحضور والمتابعة</h4>
            <div class="student-file-legend">
                <div class="legend-item">
                    <span class="legend-dot" style="background: var(--green);"></span>
                    <span>حضر ودفع</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background: var(--red);"></span>
                    <span>حضر ولم يدفع</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background: var(--accent);"></span>
                    <span>دفع مقدماً</span>
                </div>
                <div class="legend-item">
                    <span class="legend-dot" style="background: var(--bg-elevated); border: 1px solid var(--border);"></span>
                    <span>لم يحضر</span>
                </div>
            </div>
            ${attendanceHtml}
        </div>

        <!-- Reports & Notes -->
        <div class="student-file-notes-grid">
            ${student.report ? `
            <div class="student-file-note-card">
                <h4><i class='bx bx-comment-detail' style="color: var(--accent);"></i> تقرير لولي الأمر</h4>
                <p>${student.report}</p>
            </div>
            ` : ''}
            ${student.notes ? `
            <div class="student-file-note-card">
                <h4><i class='bx bx-note' style="color: var(--green);"></i> ملاحظات المعلم (داخلية)</h4>
                <p>${student.notes}</p>
            </div>
            ` : ''}
        </div>

        <div class="student-file-actions">
            <div class="wa-actions-row">
                ${student.phone ? `
                <a href="${buildWhatsAppUrl(student.phone, getReminderMessage(student))}" target="_blank" class="wa-action-btn reminder">
                    <i class='bx bx-bell'></i> تذكير بالحصة
                </a>
                <a href="${buildWhatsAppUrl(student.phone, getLatePaymentMessage(student))}" target="_blank" class="wa-action-btn late-payment">
                    <i class='bx bxl-whatsapp'></i> رسالة تأخر المدفوعات
                </a>
                <a href="${buildWhatsAppUrl(student.phone, getQuickMessage(student))}" target="_blank" class="wa-action-btn quick-msg">
                    <i class='bx bx-message-rounded'></i> رسالة سريعة
                </a>
                <a href="${buildWhatsAppUrl(student.phone, getAbsenceMessage(student))}" target="_blank" class="wa-action-btn absence">
                    <i class='bx bx-user-x'></i> تذكير بالغياب
                </a>
                ` : '<span style="color:var(--text-muted);font-size:12px;">لا يوجد رقم واتساب</span>'}
            </div>
            <div style="display:flex;gap:8px;">
                <button class="btn btn-outline" onclick="document.getElementById('student-file-modal').classList.add('hidden');"><i class='bx bx-x'></i> إغلاق</button>
                <button class="btn btn-primary" onclick="const id = '${student.id}'; const student = studentsData.find(s => s.id === id); if (student) { document.getElementById('student-file-modal').classList.add('hidden'); openEditModal(student); }"><i class='bx bx-edit'></i> تعديل البيانات</button>
            </div>
        </div>
    `;

    studentFileModal.classList.remove('hidden');
}

// Attendance Modal Logic
const attendanceModal = document.getElementById('attendance-modal');
const openAttendanceBtn = document.getElementById('open-attendance-btn');
const closeAttendanceBtn = document.getElementById('close-attendance-modal');
const cancelAttendanceBtn = document.getElementById('cancel-attendance-btn');
const attendanceStudentsList = document.getElementById('attendance-students-list');
const attendanceDateInput = document.getElementById('attendance-date');
const attendanceGradeFilter = document.getElementById('attendance-grade-filter');
const attendanceCountBadge = document.getElementById('attendance-count-badge');
const saveAttendanceBtn = document.getElementById('save-attendance-btn');

// Set today's date by default
function setDefaultDate() {
    if (attendanceDateInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        attendanceDateInput.value = `${yyyy}-${mm}-${dd}`;
    }
}

// Populate attendance group dropdown from groupsData
function populateAttendanceGroupFilter() {
    if (!attendanceGradeFilter) return;
    const prev = attendanceGradeFilter.value;
    const catLabels = { current: '— العام الحالي —', previous: '— العام الماضي —', foundation: '— التأسيس —' };
    let html = '<option value="">كل الطلاب</option>';
    ['current', 'previous', 'foundation'].forEach(function(cat) {
        var catGroups = groupsData.filter(function(g) { return (g.category || 'current') === cat; });
        if (catGroups.length === 0) return;
        html += '<option value="" disabled style="font-weight:800;color:var(--accent);background:var(--accent-dim);">' + catLabels[cat] + '</option>';
        catGroups.forEach(function(g) {
            html += '<option value="group:' + g.id + '">' + g.name + '</option>';
        });
    });
    html += '<option value="" disabled style="font-weight:800;color:var(--accent);background:var(--accent-dim);">— حسب الصف —</option>';
    html += '<option value="grade:مرحلة الكي جي والتأسيس">مرحلة الكي جي والتأسيس</option>';
    html += '<option value="grade:الصف الأول الابتدائي">الصف الأول الابتدائي</option>';
    html += '<option value="grade:الصف الثاني الابتدائي">الصف الثاني الابتدائي</option>';
    html += '<option value="grade:الصف الثالث الابتدائي">الصف الثالث الابتدائي</option>';
    html += '<option value="grade:الصف الرابع الابتدائي">الصف الرابع الابتدائي</option>';
    html += '<option value="grade:الصف الخامس الابتدائي">الصف الخامس الابتدائي</option>';
    html += '<option value="grade:الصف السادس الابتدائي">الصف السادس الابتدائي</option>';
    attendanceGradeFilter.innerHTML = html;
    attendanceGradeFilter.value = prev;
}

// Render students for attendance
function renderAttendanceStudents() {
    if (!attendanceStudentsList) return;
    const filterVal = attendanceGradeFilter.value;
    let filteredStudents = studentsData;

    if (filterVal) {
        if (filterVal.startsWith('group:')) {
            const groupId = filterVal.replace('group:', '');
            filteredStudents = studentsData.filter(student => student.groupId === groupId);
        } else if (filterVal.startsWith('grade:')) {
            const gradeName = filterVal.replace('grade:', '');
            filteredStudents = studentsData.filter(student => getGradeNameSafe(student.grade) === gradeName);
        }
    }

    attendanceStudentsList.innerHTML = '';
    attendanceCountBadge.textContent = `${filteredStudents.length} طالب`;

    const selectAllCb = document.getElementById('attendance-select-all');
    if (selectAllCb) selectAllCb.checked = false;
    const selectAllSession = document.getElementById('attendance-select-all-session');
    if (selectAllSession) selectAllSession.value = '1';

    filteredStudents.forEach(student => {
        let attendance = student.attendance || [];
        if (!Array.isArray(attendance)) {
            attendance = [];
            for (let i = 1; i <= student.attendance; i++) attendance.push(i);
        }
        const currentCount = attendance.length;
        const groupName = student.groupId ? (getGroupInfo(student.groupId)?.name || '') : '';
        const spm = getSessionsForYear('current');
        const totalSess = student.totalSessions || spm;
        const monthCount = Math.ceil(totalSess / spm);
        const currentMonth = 1;
        const monthStart = (currentMonth - 1) * spm + 1;
        const monthEnd = currentMonth * spm;

        const studentCard = document.createElement('div');
        studentCard.style.cssText = 'display:flex;flex-direction:column;gap:10px;padding:15px;margin-bottom:10px;background:var(--bg-input);border-radius:var(--r-lg);border:1px solid var(--border);';
        studentCard.dataset.studentId = student.id;
        studentCard.dataset.newSessions = '[]';
        studentCard.dataset.month = currentMonth;

        // --- Header row: avatar + name + buttons ---
        const headerRow = document.createElement('div');
        headerRow.style.cssText = 'display:flex;align-items:center;gap:10px;width:100%;';
        const groupLabel = groupName ? `<span style="color:var(--green);font-weight:700;">${groupName}</span> | ` : '';
        headerRow.innerHTML = `
            ${student.profileImage
                ? '<img src="' + student.profileImage + '" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:1.5px solid var(--accent);flex-shrink:0;cursor:pointer;" onclick="StudentPhotoLightbox.open(this.src, \'' + (student.name || 'طالب') + '\')" alt="' + (student.name || 'طالب') + '">'
                : '<div style="width:40px;height:40px;font-size:16px;border-radius:50%;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;border:1.5px solid var(--border-active);flex-shrink:0;">' + (student.name || '؟').charAt(0) + '</div>'
            }
            <div style="flex:1;min-width:0;">
                <div style="font-weight:800;color:var(--text-primary);">${student.name || 'غير مشخص'}</div>
                <div style="font-size:12px;color:var(--text-muted);">${groupLabel}${getGradeNameSafe(student.grade)} | <span style="color:var(--accent);">حضر ${currentCount} / ${totalSess} حصص</span></div>
            </div>
            <div style="display:flex;gap:5px;flex-shrink:0;">
                <button type="button" class="att-del-month-btn" data-sid="${student.id}" title="حذف شهر" style="width:30px;height:30px;border-radius:8px;border:1.5px solid var(--red);background:rgba(239,68,68,.08);color:var(--red);cursor:pointer;font-size:14px;display:${monthCount > 1 ? 'flex' : 'none'};align-items:center;justify-content:center;"><i class="bx bx-minus"></i></button>
                <button type="button" class="att-add-month-btn" data-sid="${student.id}" title="إضافة شهر" style="width:30px;height:30px;border-radius:8px;border:1.5px solid var(--green);background:rgba(34,197,94,.08);color:var(--green);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;"><i class="bx bx-plus"></i></button>
                <button type="button" class="att-edit-student-btn" data-sid="${student.id}" title="تعديل" style="width:30px;height:30px;border-radius:8px;border:1.5px solid var(--accent);background:rgba(59,130,246,.08);color:var(--accent);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;"><i class="bx bx-edit"></i></button>
            </div>
        `;
        studentCard.appendChild(headerRow);

        // --- Month navigation (if multiple months) ---
        if (monthCount > 1) {
            const monthNav = document.createElement('div');
            monthNav.className = 'att-month-nav';
            monthNav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;width:100%;';
            monthNav.innerHTML = `
                <button type="button" class="att-month-prev" data-sid="${student.id}" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-primary);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;"><i class="bx bx-chevron-right"></i></button>
                <span class="att-month-label" data-sid="${student.id}" style="font-size:12px;font-weight:800;color:var(--accent);">شهر 1 / ${monthCount}</span>
                <button type="button" class="att-month-next" data-sid="${student.id}" style="width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-primary);cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;"><i class="bx bx-chevron-left"></i></button>
            `;
            studentCard.appendChild(monthNav);
        }

        // --- Controls ---
        const attendanceControls = document.createElement('div');
        attendanceControls.style.cssText = 'display:flex;flex-direction:column;gap:6px;align-items:flex-end;width:100%;';

        const legend = document.createElement('div');
        legend.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-muted);display:flex;gap:10px;';
        legend.innerHTML = '<span style="color:var(--green);">● مسجل</span><span style="color:var(--accent);">● جديد</span>';
        attendanceControls.appendChild(legend);

        // --- Session buttons (always 8) ---
        const sessionsContainer = document.createElement('div');
        sessionsContainer.className = 'att-sessions-row';
        sessionsContainer.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;width:100%;';

        for (let i = monthStart; i <= monthEnd; i++) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'att-sess-btn';
            btn.dataset.sid = student.id;
            btn.dataset.ses = i;
            btn.textContent = i - monthStart + 1;
            btn.style.cssText = 'width:40px;height:40px;border-radius:var(--r-sm);font-weight:800;font-size:15px;cursor:pointer;border:2px solid var(--border);background:var(--bg-elevated);color:var(--text-primary);transition:all 0.15s;flex:1;max-width:48px;';

            if (attendance.includes(i)) {
                btn.style.background = 'var(--green)';
                btn.style.color = '#fff';
                btn.style.border = '2px solid var(--green)';
                btn.style.boxShadow = '0 4px 12px rgba(34,197,94,0.25)';
            }

            sessionsContainer.appendChild(btn);
        }

        attendanceControls.appendChild(sessionsContainer);

        const selectedDisplay = document.createElement('div');
        selectedDisplay.className = 'sel-sess-disp';
        selectedDisplay.dataset.sid = student.id;
        selectedDisplay.style.cssText = 'display:none;font-size:12px;color:var(--accent);font-weight:800;';
        selectedDisplay.innerHTML = '<i class="bx bx-plus-circle"></i> حصص جديدة: <span class="sn"></span>';
        attendanceControls.appendChild(selectedDisplay);

        studentCard.appendChild(attendanceControls);
        attendanceStudentsList.appendChild(studentCard);
    });

    attachSessionButtonListeners();

    // Edit student button
    attendanceStudentsList.querySelectorAll('.att-edit-student-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const sid = this.dataset.sid;
            const student = studentsData.find(s => s.id === sid);
            if (student) openEditModal(student);
        });
    });

    // Add month button
    attendanceStudentsList.querySelectorAll('.att-add-month-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const sid = this.dataset.sid;
            const student = studentsData.find(s => s.id === sid);
            if (!student) return;
            const spm = getSessionsForYear(student.academicYear);
            const newTotal = (student.totalSessions || spm) + spm;
            try {
                await SyncService.executeDbOperation('students', 'update', sid, { totalSessions: newTotal });
                student.totalSessions = newTotal;
                showToast('✅ تمت إضافة شهر جديد');
                renderAttendanceStudents();
            } catch (err) {
                showToast('حدث خطأ', 'error');
            }
        });
    });

    // Remove month button
    attendanceStudentsList.querySelectorAll('.att-del-month-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const sid = this.dataset.sid;
            const student = studentsData.find(s => s.id === sid);
            if (!student) return;
            const spm = getSessionsForYear(student.academicYear);
            const cur = student.totalSessions || spm;
            if (cur <= spm) {
                showToast('لا يمكن حذف الشهر الوحيد', 'error');
                return;
            }
            const newTotal = cur - spm;
            try {
                await SyncService.executeDbOperation('students', 'update', sid, { totalSessions: newTotal });
                student.totalSessions = newTotal;
                showToast('✅ تم حذف شهر');
                renderAttendanceStudents();
            } catch (err) {
                showToast('حدث خطأ', 'error');
            }
        });
    });

    // Month navigation
    attendanceStudentsList.querySelectorAll('.att-month-prev, .att-month-next').forEach(btn => {
        btn.addEventListener('click', function() {
            const sid = this.dataset.sid;
            const card = this.closest('[data-student-id]');
            const student = studentsData.find(s => s.id === sid);
            if (!student) return;
            const spm = getSessionsForYear(student.academicYear);
            const totalSess = student.totalSessions || spm;
            const monthCount = Math.ceil(totalSess / spm);
            let curMonth = parseInt(card.dataset.month) || 1;

            if (this.classList.contains('att-month-prev')) {
                curMonth = Math.max(1, curMonth - 1);
            } else {
                curMonth = Math.min(monthCount, curMonth + 1);
            }
            card.dataset.month = curMonth;

            // Update label
            const label = card.querySelector('.att-month-label');
            if (label) label.textContent = 'شهر ' + curMonth + ' / ' + monthCount;

            // Update session buttons
            const container = card.querySelector('.att-sessions-row');
            const student2 = studentsData.find(s => s.id === sid);
            let attendance = student2.attendance || [];
            if (!Array.isArray(attendance)) {
                attendance = [];
                for (let i = 1; i <= student2.attendance; i++) attendance.push(i);
            }
            const monthStart = (curMonth - 1) * spm + 1;
            const monthEnd = curMonth * spm;

            container.innerHTML = '';
            for (let i = monthStart; i <= monthEnd; i++) {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'att-sess-btn';
                b.dataset.sid = sid;
                b.dataset.ses = i;
                b.textContent = i - monthStart + 1;
                b.style.cssText = 'width:40px;height:40px;border-radius:var(--r-sm);font-weight:800;font-size:15px;cursor:pointer;border:2px solid var(--border);background:var(--bg-elevated);color:var(--text-primary);transition:all 0.15s;flex:1;max-width:48px;';
                if (attendance.includes(i)) {
                    b.style.background = 'var(--green)';
                    b.style.color = '#fff';
                    b.style.border = '2px solid var(--green)';
                    b.style.boxShadow = '0 4px 12px rgba(34,197,94,0.25)';
                }
                container.appendChild(b);
            }

            // Re-attach session button listeners
            container.querySelectorAll('.att-sess-btn').forEach(sessBtn => {
                sessBtn.addEventListener('click', function() {
                    const ses = parseInt(this.dataset.ses);
                    const card2 = this.closest('[data-student-id]');
                    const disp = card2.querySelector('.sel-sess-disp');
                    const st = studentsData.find(s => s.id === sid);
                    if (!st) return;
                    let existing = st.attendance || [];
                    if (!Array.isArray(existing)) {
                        existing = [];
                        for (let j = 1; j <= st.attendance; j++) existing.push(j);
                    }
                    let newSessions = [];
                    try { newSessions = JSON.parse(card2.dataset.newSessions || '[]'); } catch(e) {}
                    const isExisting = existing.includes(ses);
                    const isNew = newSessions.includes(ses);
                    if (isExisting) {
                        newSessions = isNew ? newSessions.filter(s => s !== ses) : [...newSessions, ses];
                    } else {
                        newSessions = isNew ? newSessions.filter(s => s !== ses) : [...newSessions, ses];
                    }
                    card2.dataset.newSessions = JSON.stringify(newSessions);
                    card2.querySelectorAll('.att-sess-btn').forEach(b2 => {
                        const s2 = parseInt(b2.dataset.ses);
                        const bEx = existing.includes(s2);
                        const bNw = newSessions.includes(s2);
                        if (bEx && !bNw) {
                            b2.style.background = 'var(--green)';
                            b2.style.color = '#fff';
                            b2.style.border = '2px solid var(--green)';
                            b2.style.boxShadow = '0 4px 12px rgba(34,197,94,0.25)';
                        } else if (bNw) {
                            b2.style.background = 'var(--accent)';
                            b2.style.color = '#fff';
                            b2.style.border = '2px solid var(--accent)';
                            b2.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                        } else {
                            b2.style.background = 'var(--bg-elevated)';
                            b2.style.color = 'var(--text-primary)';
                            b2.style.border = '2px solid var(--border)';
                            b2.style.boxShadow = 'none';
                        }
                    });
                    if (newSessions.length > 0) {
                        disp.querySelector('.sn').textContent = newSessions.join(', ');
                        disp.style.display = 'block';
                    } else {
                        disp.style.display = 'none';
                    }
                });
            });
        });
    });
}

function attachSessionButtonListeners() {
    document.querySelectorAll('.att-sess-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const sid = this.dataset.sid;
            const ses = parseInt(this.dataset.ses);
            const card = this.closest('[data-student-id]');
            const disp = card.querySelector('.sel-sess-disp');
            const student = studentsData.find(s => s.id === sid);
            if (!student) return;

            let existing = student.attendance || [];
            if (!Array.isArray(existing)) {
                existing = [];
                for (let i = 1; i <= student.attendance; i++) existing.push(i);
            }

            let newSessions = [];
            try { newSessions = JSON.parse(card.dataset.newSessions || '[]'); } catch(e) { newSessions = []; }

            const isExisting = existing.includes(ses);
            const isNew = newSessions.includes(ses);

            if (isExisting) {
                // Toggle OFF existing attendance (mark for removal)
                if (isNew) {
                    newSessions = newSessions.filter(s => s !== ses);
                } else {
                    newSessions.push(ses);
                }
            } else {
                // Toggle new session
                if (isNew) {
                    newSessions = newSessions.filter(s => s !== ses);
                } else {
                    newSessions.push(ses);
                }
            }

            card.dataset.newSessions = JSON.stringify(newSessions);

            // Update button visuals
            card.querySelectorAll('.att-sess-btn').forEach(b => {
                const s = parseInt(b.dataset.ses);
                const bIsExisting = existing.includes(s);
                const bIsNew = newSessions.includes(s);

                if (bIsExisting && !bIsNew) {
                    // Saved (green)
                    b.style.background = 'var(--green)';
                    b.style.color = '#fff';
                    b.style.border = '2px solid var(--green)';
                    b.style.boxShadow = '0 4px 12px rgba(34,197,94,0.25)';
                } else if (bIsNew) {
                    // New selection (blue) or toggle off existing (blue strikethrough)
                    b.style.background = 'var(--accent)';
                    b.style.color = '#fff';
                    b.style.border = '2px solid var(--accent)';
                    b.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                } else {
                    // Unselected
                    b.style.background = 'var(--bg-elevated)';
                    b.style.color = 'var(--text-primary)';
                    b.style.border = '2px solid var(--border)';
                    b.style.boxShadow = 'none';
                }
            });

            // Update display
            if (newSessions.length > 0) {
                disp.querySelector('.sn').textContent = newSessions.join(', ');
                disp.style.display = 'block';
            } else {
                disp.style.display = 'none';
            }
        });
    });
}

// Open attendance modal
if (openAttendanceBtn) {
    openAttendanceBtn.addEventListener('click', () => {
        setDefaultDate();
        populateAttendanceGroupFilter();
        renderAttendanceStudents();
        attendanceModal.classList.remove('hidden');
    });
}

// Close attendance modal
function closeAttendanceModal() {
    attendanceModal.classList.add('hidden');
}
if (closeAttendanceBtn) closeAttendanceBtn.addEventListener('click', closeAttendanceModal);
if (cancelAttendanceBtn) cancelAttendanceBtn.addEventListener('click', closeAttendanceModal);
if (attendanceModal) {
    attendanceModal.addEventListener('click', (e) => {
        if (e.target === attendanceModal) closeAttendanceModal();
    });
}

// Filter change
if (attendanceGradeFilter) {
    attendanceGradeFilter.addEventListener('change', renderAttendanceStudents);
}

// Save attendance
if (saveAttendanceBtn) {
    saveAttendanceBtn.addEventListener('click', async () => {
        const studentCards = document.querySelectorAll('#attendance-students-list [data-student-id]');
        let updatedCount = 0;

        for (const studentCard of studentCards) {
            const studentId = studentCard.dataset.studentId;
            let newSessions = [];
            try { newSessions = JSON.parse(studentCard.dataset.newSessions || '[]'); } catch(e) { continue; }
            if (newSessions.length === 0) continue;

            const student = studentsData.find(s => s.id === studentId);
            if (!student) continue;

            let attendance = student.attendance || [];
            if (!Array.isArray(attendance)) {
                attendance = [];
                for (let i = 1; i <= (student.attendance || 0); i++) attendance.push(i);
            }

            // Apply new sessions (add new, remove toggled-off existing)
            newSessions.forEach(ses => {
                if (attendance.includes(ses)) {
                    attendance = attendance.filter(s => s !== ses);
                } else {
                    attendance.push(ses);
                }
            });
            attendance.sort((a, b) => a - b);

            try {
                await SyncService.executeDbOperation('students', 'update', studentId, { attendance });
                student.attendance = attendance;
                updatedCount++;

                // Update button visuals to reflect final state
                studentCard.querySelectorAll('.att-sess-btn').forEach(btn => {
                    const s = parseInt(btn.dataset.ses);
                    if (attendance.includes(s)) {
                        btn.style.background = 'var(--green)';
                        btn.style.color = '#fff';
                        btn.style.border = '2px solid var(--green)';
                        btn.style.boxShadow = '0 4px 12px rgba(34,197,94,0.25)';
                    } else {
                        btn.style.background = 'var(--bg-elevated)';
                        btn.style.color = 'var(--text-primary)';
                        btn.style.border = '2px solid var(--border)';
                        btn.style.boxShadow = 'none';
                    }
                });

                studentCard.dataset.newSessions = '[]';
                const disp = studentCard.querySelector('.sel-sess-disp');
                if (disp) disp.style.display = 'none';

            } catch (err) {
                console.error(err);
            }
        }

        showToast(`✅ تم تسجيل حضور ${updatedCount} طالب`);
        applyStudentFilters();
        updateDashboardStats(studentsData);
    });
}

// Select All checkbox — selects the SAME session number for all students
const attendanceSelectAllCb = document.getElementById('attendance-select-all');
const attendanceSelectAllSession = document.getElementById('attendance-select-all-session');
if (attendanceSelectAllCb) {
    attendanceSelectAllCb.addEventListener('change', function() {
        if (!attendanceSelectAllSession) return;
        const ses = parseInt(attendanceSelectAllSession.value) || 1;
        const studentCards = document.querySelectorAll('#attendance-students-list [data-student-id]');

        studentCards.forEach(card => {
            const sid = card.dataset.studentId;
            const student = studentsData.find(s => s.id === sid);
            if (!student) return;

            let existing = student.attendance || [];
            if (!Array.isArray(existing)) {
                existing = [];
                for (let i = 1; i <= student.attendance; i++) existing.push(i);
            }

            let newSessions = [];
            if (this.checked) {
                // Toggle: add if not existing, remove if existing
                if (existing.includes(ses)) {
                    newSessions = [ses];
                } else {
                    newSessions = [ses];
                }
            }
            card.dataset.newSessions = JSON.stringify(newSessions);

            // Update button visuals
            card.querySelectorAll('.att-sess-btn').forEach(btn => {
                const s = parseInt(btn.dataset.ses);
                const isExisting = existing.includes(s);
                const isNew = newSessions.includes(s);

                if (isExisting && !isNew) {
                    btn.style.background = 'var(--green)';
                    btn.style.color = '#fff';
                    btn.style.border = '2px solid var(--green)';
                    btn.style.boxShadow = '0 4px 12px rgba(34,197,94,0.25)';
                } else if (isNew) {
                    btn.style.background = 'var(--accent)';
                    btn.style.color = '#fff';
                    btn.style.border = '2px solid var(--accent)';
                    btn.style.boxShadow = '0 4px 12px rgba(59,130,246,0.3)';
                } else {
                    btn.style.background = 'var(--bg-elevated)';
                    btn.style.color = 'var(--text-primary)';
                    btn.style.border = '2px solid var(--border)';
                    btn.style.boxShadow = 'none';
                }
            });

            const disp = card.querySelector('.sel-sess-disp');
            if (disp) {
                if (newSessions.length > 0) {
                    disp.querySelector('.sn').textContent = newSessions.join(', ');
                    disp.style.display = 'block';
                } else {
                    disp.style.display = 'none';
                }
            }
        });
    });
}
if (attendanceSelectAllSession) {
    attendanceSelectAllSession.addEventListener('change', function() {
        if (attendanceSelectAllCb && attendanceSelectAllCb.checked) {
            attendanceSelectAllCb.dispatchEvent(new Event('change'));
        }
    });
}

// Bulk Reset All Attendance (تصفير حصص الكل)
const bulkResetAttendanceBtn = document.getElementById('bulk-reset-attendance-btn');
if (bulkResetAttendanceBtn) {
    bulkResetAttendanceBtn.addEventListener('click', async () => {
        let targets = studentsData;
        if (currentYearTab === 'current') {
            targets = studentsData.filter(s => !s.academicYear || s.academicYear === 'current');
        } else if (currentYearTab === 'previous') {
            targets = studentsData.filter(s => s.academicYear === 'previous');
        } else if (currentYearTab === 'summer') {
            targets = studentsData.filter(s => s.academicYear === 'summer');
        }

        const confirmed = confirm(`هل أنت متأكد من تصفير حصص ${targets.length} طالب في "${currentYearTab === 'current' ? 'العام الحالي' : currentYearTab === 'previous' ? 'العام الماضي' : 'الكورس الصيفي'}"؟`);
        if (!confirmed) return;

        let resetCount = 0;
        for (const student of targets) {
            const att = student.attendance || [];
            const hasAtt = Array.isArray(att) ? att.length > 0 : !!att;
            if (!hasAtt) continue;
            try {
                await SyncService.executeDbOperation('students', 'update', student.id, { attendance: [] });
                student.attendance = [];
                resetCount++;
            } catch (err) {
                console.error('Reset attendance error for', student.id, err);
            }
        }

        showToast(`✅ تم تصفير حصص ${resetCount} طالب`);
        applyStudentFilters();
        updateDashboardStats(studentsData);
    });
}

// Edit Modal Logic
const editModal = document.getElementById('edit-modal');
const closeEditBtn = document.getElementById('close-edit-modal');
const editForm = document.getElementById('edit-student-form');

// Attendance Tracker Interaction
const attendanceContainer = document.getElementById('attendance-months-container');
const attendanceHiddenInput = document.getElementById('edit-student-attendance');
const totalSessionsHiddenInput = document.getElementById('edit-student-total-sessions');

function getEditModalYear() {
    var el = document.getElementById('edit-student-year');
    return el ? el.value : 'current';
}

function renderAttendanceDots(current, total) {
    if (!attendanceContainer) return;
    attendanceContainer.innerHTML = '';

    // Convert current to array if it's a number (legacy support)
    let attendedArray = [];
    if (Array.isArray(current)) {
        attendedArray = current;
    } else if (typeof current === 'number') {
        for (let i = 1; i <= current; i++) attendedArray.push(i);
    }

    // Store as JSON in hidden input to preserve array structure
    attendanceHiddenInput.value = JSON.stringify(attendedArray);

    // Calculate Paid Sessions (use year from edit modal)
    var modalYear = getEditModalYear();
    const paid = parseInt(document.getElementById('edit-student-paid')?.value) || 0;
    const otherExpenses = parseInt(document.getElementById('edit-student-other-expenses')?.value) || 0;
    const paidPool = Math.max(0, paid - otherExpenses);
    const totalPaidSessions = Math.floor(paidPool / getPriceForYear(modalYear));

    var spm = getSessionsForYear(modalYear);
    const rows = Math.ceil(total / spm);
    for (let r = 0; r < rows; r++) {
        const monthWrapper = document.createElement('div');
        monthWrapper.style.background = 'var(--bg-input)';
        monthWrapper.style.padding = '15px';
        monthWrapper.style.borderRadius = '16px';
        monthWrapper.style.marginBottom = '10px';
        monthWrapper.style.border = '1px solid var(--border)';

        const monthLabel = document.createElement('div');
        monthLabel.style.fontSize = '12px';
        monthLabel.style.fontWeight = '800';
        monthLabel.style.color = 'var(--accent)';
        monthLabel.style.marginBottom = '10px';
        monthLabel.style.textAlign = 'left';
        monthLabel.textContent = `الشهر رقم ${r + 1}`;
        monthWrapper.appendChild(monthLabel);

        const rowDiv = document.createElement('div');
        rowDiv.className = 'attendance-tracker-row';
        rowDiv.style.display = 'flex';
        rowDiv.style.gap = '8px';
        rowDiv.style.flexWrap = 'nowrap';
        rowDiv.style.justifyContent = 'space-between';
        rowDiv.style.flexDirection = 'row-reverse'; // Match RTL numbering from image

        for (let i = 1; i <= spm; i++) {
            const index = (r * spm) + i;
            if (index > total) break;

            const isAttended = attendedArray.includes(index);
            const isPaid = index <= totalPaidSessions;

            const dot = document.createElement('span');
            dot.className = `attendance-dot`;
            dot.setAttribute('data-index', index);
            dot.textContent = i;
            
            // Base styles for dots
            dot.style.width = '32px';
            dot.style.height = '32px';
            dot.style.borderRadius = '50%';
            dot.style.display = 'flex';
            dot.style.alignItems = 'center';
            dot.style.justifyContent = 'center';
            dot.style.fontSize = '12px';
            dot.style.fontWeight = '800';
            dot.style.cursor = 'pointer';
            dot.style.transition = 'all 0.2s';
            dot.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)';

            // Apply Color Logic
            if (isAttended && isPaid) {
                dot.style.background = '#10b981'; // Green (attended & paid)
                dot.style.color = 'white';
                dot.style.border = 'none';
            } else if (isAttended && !isPaid) {
                dot.style.background = '#ef4444'; // Red (attended but not paid)
                dot.style.color = 'white';
                dot.style.border = 'none';
                dot.style.boxShadow = '0 4px 10px rgba(239, 68, 68, 0.3)';
            } else if (!isAttended && isPaid) {
                dot.style.background = '#3b82f6'; // Blue (paid in advance)
                dot.style.color = 'white';
                dot.style.border = 'none';
            } else {
                dot.style.background = 'var(--bg-elevated)'; // Empty
                dot.style.color = 'var(--text-muted)';
                dot.style.border = '1px solid var(--border)';
            }

            dot.addEventListener('click', () => {
                const clickedIndex = parseInt(dot.getAttribute('data-index'));
                let currentAtt = JSON.parse(attendanceHiddenInput.value || "[]");

                if (currentAtt.includes(clickedIndex)) {
                    currentAtt = currentAtt.filter(id => id !== clickedIndex);
                } else {
                    currentAtt.push(clickedIndex);
                }

                attendanceHiddenInput.value = JSON.stringify(currentAtt);
                calculateSmartPayment();
            });

            rowDiv.appendChild(dot);
        }
        monthWrapper.appendChild(rowDiv);
        attendanceContainer.appendChild(monthWrapper);
    }
}

const addMonthBtn = document.querySelector('.add-month-btn');
if (addMonthBtn) {
    addMonthBtn.addEventListener('click', () => {
        var spm = getSessionsForYear(getEditModalYear());
        let total = parseInt(totalSessionsHiddenInput.value) || spm;
        total += spm;
        totalSessionsHiddenInput.value = total;

        let currentAtt = [];
        try { currentAtt = JSON.parse(attendanceHiddenInput.value || "[]"); } catch (e) { }

        renderAttendanceDots(currentAtt, total);
        showToast("تمت إضافة شهر جديد (" + spm + " حصص إضافية) ➕");
    });
}

const delMonthBtn = document.querySelector('.del-month-btn');
if (delMonthBtn) {
    delMonthBtn.addEventListener('click', () => {
        var spm = getSessionsForYear(getEditModalYear());
        let total = parseInt(totalSessionsHiddenInput.value) || spm;
        if (total <= spm) {
            showToast("لا يمكن حذف الشهر الأساسي", "error");
            return;
        }

        if (confirm("هل أنت متأكد من حذف الشهر الأخير؟ سيتم حذف بيانات الحضور لهذا الشهر.")) {
            total -= spm;
            totalSessionsHiddenInput.value = total;

            // Clean up attendance array (remove indices > new total)
            let currentAtt = [];
            try { currentAtt = JSON.parse(attendanceHiddenInput.value || "[]"); } catch (e) { }

            currentAtt = currentAtt.filter(idx => idx <= total);
            attendanceHiddenInput.value = JSON.stringify(currentAtt);

            renderAttendanceDots(currentAtt, total);
            calculateSmartPayment();
            showToast("تم حذف الشهر الأخير بنجاح 🗑️");
        }
    });
}

// Animated number counter for dashboard stats
function animateNumber(el, target, suffix = '', duration = 900) {
    if (!el) return;
    const start = performance.now();
    function step(now) {
        const p = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function updateDashboardStats(data) {
    const activeCount = data.length;
    const statsCount = document.getElementById('stat-total-students');
    if (statsCount) {
        animateNumber(statsCount, activeCount);
        // Click to show all students
        statsCount.closest('.stat-card').style.cursor = 'pointer';
        statsCount.closest('.stat-card').onclick = () => {
            switchView('students-view', 'إدارة الطلاب');
            const searchInput = document.getElementById('search-student');
            if (searchInput) {
                searchInput.value = '';
                searchInput.dispatchEvent(new Event('input'));
            }
        };
    }

    // Calculate Average Attendance
    let totalAttendance = 0;
    data.forEach(s => {
        const a = s.attendance || [];
        totalAttendance += Array.isArray(a) ? a.length : (parseInt(a) || 0);
    });
    const totalPossible = data.reduce(function (sum, s) { return sum + (s.totalSessions || getSessionsForYear(s.academicYear)); }, 0);
    const avgAtt = totalPossible > 0 ? Math.round((totalAttendance / totalPossible) * 100) : 0;
    const avgAttEl = document.getElementById('stat-avg-attendance');
    if (avgAttEl) {
        animateNumber(avgAttEl, avgAtt, '%');
        // Click to show low attendance students (< 50%)
        avgAttEl.closest('.stat-card').style.cursor = 'pointer';
        avgAttEl.closest('.stat-card').onclick = () => {
            switchView('students-view', 'إدارة الطلاب');
            const filtered = studentsData.filter(s => {
                const a = s.attendance || [];
                const count = Array.isArray(a) ? a.length : (parseInt(a) || 0);
                const pct = (count / (s.totalSessions || getSessionsForYear(s.academicYear))) * 100;
                return pct < 50;
            });
            renderStudentsTable(filtered);
            showToast("تم عرض الطلاب بنسبة حضور أقل من 50%");
        };
    }

    // Animate Dashboard Attendance Ring
    const attendanceRing = document.getElementById('dashboard-attendance-ring');
    if (attendanceRing) {
        const circumference = 2 * Math.PI * 40; // cx=50, cy=50, r=40 -> 251.3
        const offset = circumference - (avgAtt / 100) * circumference;
        attendanceRing.style.strokeDasharray = circumference;
        attendanceRing.style.strokeDashoffset = offset;
    }

    // Unpaid Students Stat & Financial Calculations
    let unpaidCount = 0;
    let totalCollected = 0;
    let totalExpected = 0;

    data.forEach(s => {
        const a = s.attendance || [];
        const count = Array.isArray(a) ? a.length : (parseInt(a) || 0);
        var sPrice = getPriceForYear(s.academicYear);
        const debt = (count * sPrice) - (s.paid || 0);
        if (debt > 0) unpaidCount++;

        // Accumulate financial details
        totalCollected += s.paid || 0;
        totalExpected += (count * sPrice) + (s.otherExpenses || 0);
    });

    const unpaidEl = document.getElementById('stats-total-unpaid');
    if (unpaidEl) {
        animateNumber(unpaidEl, unpaidCount);
        unpaidEl.closest('.stat-card').style.cursor = 'pointer';
        unpaidEl.closest('.stat-card').onclick = () => {
            switchView('students-view', 'إدارة الطلاب');
            const filtered = studentsData.filter(s => {
                const a = s.attendance || [];
                const count = Array.isArray(a) ? a.length : (parseInt(a) || 0);
                const debt = (count * getPriceForYear(s.academicYear)) - (s.paid || 0);
                return debt > 0;
            });
            renderStudentsTable(filtered);
            showToast("تم عرض الطلاب الذين لديهم مديونيات 💰");
        };
    }

    // Update unpaid badge status
    const unpaidBadge = document.getElementById('unpaid-badge-alert');
    if (unpaidBadge) {
        if (unpaidCount === 0) {
            unpaidBadge.className = 'trend-badge positive';
            unpaidBadge.innerHTML = `<i class='bx bx-check-circle'></i> خالص تماماً`;
        } else {
            unpaidBadge.className = 'trend-badge negative';
            unpaidBadge.innerHTML = `<i class='bx bx-bell'></i> إشعار بالدفع`;
        }
    }

    // Calculate and update dashboard payment collection progress
    const collectionPct = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 100;
    const colFill = document.getElementById('dashboard-collection-fill');
    const colPctVal = document.getElementById('dashboard-collection-pct');
    if (colFill) colFill.style.width = collectionPct + '%';
    if (colPctVal) animateNumber(colPctVal, collectionPct, '%');

    // Grade Distribution
    const grades = {
        "مرحلة الكي جي والتأسيس": 0,
        "الصف الأول الابتدائي": 0,
        "الصف الثاني الابتدائي": 0,
        "الصف الثالث الابتدائي": 0,
        "الصف الرابع الابتدائي": 0,
        "الصف الخامس الابتدائي": 0,
        "الصف السادس الابتدائي": 0
    };

    data.forEach(s => {
        const safeGrade = getGradeNameSafe(s.grade);
        if (grades.hasOwnProperty(safeGrade)) {
            grades[safeGrade]++;
        }
    });

    const grid = document.getElementById('grade-distribution-grid');
    if (grid) {
        grid.innerHTML = '';
        Object.entries(grades).forEach(([name, count]) => {
            const pct = activeCount > 0 ? Math.round((count / activeCount) * 100) : 0;
            const card = document.createElement('div');
            card.className = 'grade-stat-card doodle-card';
            card.style.cursor = 'pointer';
            card.innerHTML = `
                <div class="grade-card-main">
                    <div class="grade-icon">${name.includes('الكي جي') ? '👶' : '📚'}</div>
                    <div class="grade-info">
                        <h3>${name}</h3>
                        <p><span>${count}</span> طالب</p>
                    </div>
                    <div class="grade-arrow"><i class='bx bx-chevron-left'></i></div>
                </div>
                <div class="grade-progress-wrapper">
                    <div class="grade-progress-track">
                        <div class="grade-progress-bar" style="width: ${pct}%"></div>
                    </div>
                    <span class="grade-progress-pct">${pct}%</span>
                </div>
            `;

            // Click to filter students
            card.addEventListener('click', () => {
                switchView('students-view', 'إدارة الطلاب');

                const searchInput = document.getElementById('search-student');
                if (searchInput) {
                    searchInput.value = name;
                    searchInput.dispatchEvent(new Event('input'));
                }
            });

            grid.appendChild(card);
        });
    }
}

function calculateSmartPayment() {
    let attendanceVal = attendanceHiddenInput.value;
    let attendanceCount = 0;
    try {
        const arr = JSON.parse(attendanceVal);
        attendanceCount = Array.isArray(arr) ? arr.length : (parseInt(arr) || 0);
    } catch (e) {
        attendanceCount = parseInt(attendanceVal) || 0;
    }

    const paid = parseInt(document.getElementById('edit-student-paid').value) || 0;
    const otherExpenses = parseInt(document.getElementById('edit-student-other-expenses')?.value) || 0;
    const bookletName = document.getElementById('edit-student-booklet-name')?.value || "";

    var modalYear = getEditModalYear();
    var yrPrice = getPriceForYear(modalYear);
    const requiredSoFar = (attendanceCount * yrPrice) + otherExpenses;
    const calcInfo = document.getElementById('smart-calc-info');
    const calcAlert = document.getElementById('payment-calc-alert');
    const payDueBtn = document.querySelector('.pay-due-btn');
    const bookletInfoBox = document.getElementById('booklet-info-box');
    const bookletInfoText = document.getElementById('booklet-info-text');

    if (!calcInfo || !calcAlert) return;

    if (otherExpenses > 0) {
        let expenseText = `${otherExpenses} ج (ملزمات)`;
        if (bookletName) expenseText = `${otherExpenses} ج (ملزمة: ${bookletName})`;
        calcInfo.innerHTML = `مستحق: ${(attendanceCount * yrPrice)} ج (حضور) + ${expenseText}`;
        
        // Show Booklet Info Box
        if (bookletInfoBox && bookletInfoText) {
            bookletInfoBox.style.display = 'flex';
            bookletInfoText.textContent = bookletName ? `ملزمة: ${bookletName} — ${otherExpenses} ج.م` : `ملزمة إضافية — ${otherExpenses} ج.م`;
        }
    } else {
        calcInfo.textContent = `مستحق للحضور: ${requiredSoFar} ج`;
        if (bookletInfoBox) bookletInfoBox.style.display = 'none';
    }

    const debt = requiredSoFar - paid;
    
    // Update Pay Due Button Text Dynamically
    if (payDueBtn) {
        if (debt > 0) {
            payDueBtn.textContent = `دفع المستحق (${debt} ج)`;
            payDueBtn.style.display = 'inline-block';
        } else {
            payDueBtn.textContent = `دفع المستحق`;
            // payDueBtn.style.display = 'none'; // Optional: hide if nothing due
        }
    }

    if (debt > 0) {
        calcAlert.style.display = 'block';
        calcAlert.style.background = 'var(--red-dim)';
        calcAlert.style.color = 'var(--red)';
        
        let debtDetail = `متبقي ${debt} ج عن ${attendanceCount} حصص`;
        if (otherExpenses > 0) {
            debtDetail += ` + ملزمة`;
        }
        calcAlert.innerHTML = `<i class='bx bx-error-circle'></i> ${debtDetail}`;
    } else if (paid >= requiredSoFar && attendanceCount > 0) {
        calcAlert.style.display = 'block';
        calcAlert.style.background = 'var(--green-dim)';
        calcAlert.style.color = 'var(--green)';
        calcAlert.innerHTML = `<i class='bx bx-check-circle'></i> مسدد بالكامل عن ${attendanceCount} حصص ✅`;
    } else {
        calcAlert.style.display = 'none';
    }

    // Refresh attendance dots colors
    renderAttendanceDots(JSON.parse(attendanceVal), parseInt(totalSessionsHiddenInput.value) || getSessionsForYear(getEditModalYear()));
}

// Payment Controls Interaction
const paidHiddenInput = document.getElementById('edit-student-paid');
const displayPaidAmount = document.getElementById('display-paid-amount');
const payBtns = document.querySelectorAll('.pay-btn');
const resetPayBtn = document.querySelector('.reset-pay-btn');

payBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const amountToAdd = parseInt(btn.getAttribute('data-amount'));
        let currentPaid = parseInt(paidHiddenInput.value) || 0;

        var modalYear = getEditModalYear();
        var price = getPriceForYear(modalYear);
        var spm = getSessionsForYear(modalYear);
        var monthlyTotal = price * spm;

        if (amountToAdd === monthlyTotal) {
            currentPaid = monthlyTotal;
        } else {
            currentPaid = currentPaid + amountToAdd;
        }

        // Logic for auto-attendance
        const autoAttend = document.getElementById('auto-attendance-check')?.checked;
        if (autoAttend && currentPaid >= monthlyTotal) {
            let currentAtt = [];
            try { currentAtt = JSON.parse(attendanceHiddenInput.value || "[]"); } catch (e) { }
            
            for(let i=1; i<=spm; i++) {
                if(!currentAtt.includes(i)) currentAtt.push(i);
            }
            attendanceHiddenInput.value = JSON.stringify(currentAtt);
        }

        updatePaymentUI(currentPaid);
    });
});

const payDueBtn = document.querySelector('.pay-due-btn');
if (payDueBtn) {
    payDueBtn.addEventListener('click', () => {
        const attendanceVal = attendanceHiddenInput.value;
        let attendanceCount = 0;
        try {
            const arr = JSON.parse(attendanceVal);
            attendanceCount = Array.isArray(arr) ? arr.length : (parseInt(arr) || 0);
        } catch (e) {
            attendanceCount = parseInt(attendanceVal) || 0;
        }
        const otherExpenses = parseInt(document.getElementById('edit-student-other-expenses')?.value) || 0;
        const requiredTotal = (attendanceCount * getPriceForYear(getEditModalYear())) + otherExpenses;
        
        updatePaymentUI(requiredTotal);
    });
}

if (resetPayBtn) {
    resetPayBtn.addEventListener('click', () => {
        updatePaymentUI(0);
    });
}

function updatePaymentButtons(year) {
    var y = year || 'current';
    var price = getPriceForYear(y);
    var sessions = getSessionsForYear(y);
    var monthlyTotal = price * sessions;
    document.querySelectorAll('.pay-btn[data-amount]').forEach(function (btn) {
        var amt = parseInt(btn.getAttribute('data-amount'));
        if (amt === 20 || amt === price) {
            btn.setAttribute('data-amount', price);
            btn.innerHTML = ' الحصه (' + price + ' ج)';
        } else if (amt === 160 || amt === (price * sessions)) {
            btn.setAttribute('data-amount', monthlyTotal);
            btn.innerHTML = ' الشهر (' + monthlyTotal + ' ج)';
        }
    });
}

function updatePaymentUI(amount) {
    if (paidHiddenInput) paidHiddenInput.value = amount;
    if (displayPaidAmount) displayPaidAmount.textContent = amount;
    calculateSmartPayment(); // Recalculate on payment change
}

// Edit Modal Logic
function openEditModal(student) {
    document.getElementById('edit-student-id').value = student.id;
    document.getElementById('edit-student-name').value = student.name;
    document.getElementById('edit-student-phone').value = (student.phone || "").replace(/^0+/, "");

    // Show profile image or initial
    var avatarEl = document.getElementById('edit-student-avatar');
    if (avatarEl) {
        if (student.profileImage) {
            avatarEl.innerHTML = '<img src="' + student.profileImage + '" style="width:100%;height:100%;object-fit:cover;">';
        } else {
            avatarEl.innerHTML = (student.name || '?')[0];
        }
    }

    const attendance = student.attendance || [];
    const totalSessions = student.totalSessions || getSessionsForYear(student.academicYear);
    const paid = student.paid || 0;

    // Handle legacy numeric attendance
    let attendanceData = attendance;
    if (typeof attendance === 'number') {
        attendanceData = [];
        for (let i = 1; i <= attendance; i++) attendanceData.push(i);
    }

    attendanceHiddenInput.value = JSON.stringify(attendanceData);
    totalSessionsHiddenInput.value = totalSessions;
    renderAttendanceDots(attendanceData, totalSessions);

    updatePaymentUI(paid);

    selectBookletPreset(student.otherExpenses || 0);
    if (document.getElementById('edit-student-booklet-name')) {
        document.getElementById('edit-student-booklet-name').value = student.bookletName || "";
    }
    if (document.getElementById('auto-attendance-check')) {
        document.getElementById('auto-attendance-check').checked = student.autoAttendance || false;
    }

    document.getElementById('edit-student-day').value = student.day || "";
    document.getElementById('edit-student-hour').value = student.hour || "";
    const gradeSelect = document.getElementById('edit-student-grade');
    if (gradeSelect) {
        const safeGrade = getGradeNameSafe(student.grade);
        const options = Array.from(gradeSelect.options).map(o => o.value);
        if (options.includes(safeGrade)) {
            gradeSelect.value = safeGrade;
        } else {
            gradeSelect.value = ""; // This will select the disabled placeholder
        }
    }
    document.getElementById('edit-student-level').value = student.level || "جيد";
    document.getElementById('edit-student-report').value = student.report || "";
    document.getElementById('edit-student-notes').value = student.notes || "";

    // Group and year fields
    const groupSelect = document.getElementById('edit-student-group');
    if (groupSelect) {
        // Ensure options are populated
        if (groupSelect.options.length <= 1 && groupsData.length > 0) {
            groupSelect.innerHTML = '<option value="">بدون مجموعة</option>';
            groupsData.forEach(g => {
                groupSelect.innerHTML += `<option value="${g.id}">${g.name}</option>`;
            });
        }
        if (groupsData.length > 0 && student.groupId && groupsData.some(g => g.id === student.groupId)) {
            groupSelect.value = student.groupId;
        } else {
            groupSelect.value = '';
        }
    }
    const yearSelect = document.getElementById('edit-student-year');
    if (yearSelect) {
        yearSelect.value = student.academicYear || 'current';
    }

    // Update payment buttons with student's year pricing
    updatePaymentButtons(student.academicYear);

    // Ensure calculation is fresh
    setTimeout(calculateSmartPayment, 100);

    editModal.classList.remove('hidden');
}

if (closeEditBtn) {
    closeEditBtn.addEventListener('click', () => {
        editModal.classList.add('hidden');
    });
}

// Update groups dropdown when year changes in edit student modal
document.getElementById('edit-student-year')?.addEventListener('change', updateEditStudentGroupDropdown);

if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('edit-student-id').value;
        if (!id) {
            showToast("خطأ: كود الطالب غير موجود", "error");
            return;
        }

        const submitBtn = editForm.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = "جاري التحديث... <i class='bx bx-loader-alt bx-spin'></i>";
        }

        const attendance = attendanceHiddenInput.value || 0;
        const paid = paidHiddenInput.value || 0;
        const level = document.getElementById('edit-student-level').value;
        const report = document.getElementById('edit-student-report').value;
        const notes = document.getElementById('edit-student-notes').value;
        const grade = document.getElementById('edit-student-grade').value;
        const bookletName = document.getElementById('edit-student-booklet-name')?.value || "";
        const autoAttendance = document.getElementById('auto-attendance-check')?.checked || false;

        let attendanceArray = [];
        try {
            attendanceArray = JSON.parse(attendance);
            if (!Array.isArray(attendanceArray)) attendanceArray = [];
        } catch (e) {
            const count = parseInt(attendance) || 0;
            for (let i = 1; i <= count; i++) attendanceArray.push(i);
        }

        let paidVal = parseInt(paid) || 0;
        let otherExpensesVal = parseInt(document.getElementById('edit-student-other-expenses')?.value) || 0;
        
        // IMPORTANT: The user wants to keep the paid amount as is in the DB, 
        // and let the UI calculate the debt. The previous logic of slicing attendance
        // might be confusing. Let's keep the raw paid amount and raw attendance.
        
        try {
            const newName = document.getElementById('edit-student-name').value;
            const newPhone = normalizePhone(document.getElementById('edit-student-phone').value);

            // Check duplicate (phone + name) excluding current student
            const phoneCheck = await getSnapshotByPhone("students", newPhone);
            if (phoneCheck && !phoneCheck.empty) {
                const duplicate = phoneCheck.docs.some(doc => doc.id !== id && doc.data().name === newName);
                if (duplicate) {
                    showToast("هذا الطالب موجود بالفعل!", "error");
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = "تحديث البيانات";
                    }
                    return;
                }
            }

            const groupId = document.getElementById('edit-student-group')?.value || '';
            const academicYear = document.getElementById('edit-student-year')?.value || 'current';

            const result = await SyncService.executeDbOperation("students", "update", id, {
                name: newName,
                phone: newPhone,
                attendance: attendanceArray,
                totalSessions: parseInt(totalSessionsHiddenInput.value) || getSessionsForYear(academicYear),
                paid: paidVal,
                otherExpenses: otherExpensesVal,
                bookletName: bookletName,
                autoAttendance: autoAttendance,
                day: document.getElementById('edit-student-day').value,
                hour: document.getElementById('edit-student-hour').value,
                grade: grade,
                level: level,
                report: report,
                notes: notes,
                groupId: groupId,
                academicYear: academicYear,
                isActivated: true,
                status: '',
                rejectionReason: ''
            });

            editModal.classList.add('hidden');
            if (result && !result.offline) {
                showToast("✅ تم تحديث بيانات الطالب بنجاح");
            }
        } catch (err) {
            console.error("Update Error:", err);
            showToast("حدث خطأ أثناء التحديث", "error");
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = "تحديث البيانات";
            }
        }
    });
}

// Handler for manual student addition
const addStudentForm = document.getElementById('add-student-form');
if (addStudentForm) {
    addStudentForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('student-name').value.trim();
        const rawPhone = document.getElementById('student-phone').value.trim();
        const phone = normalizePhone(rawPhone);
        const code = `ST-${Math.floor(100000 + Math.random() * 900000)}`;
        const grade = document.getElementById('student-grade').value;
        const saveBtn = document.getElementById('save-student-btn');

        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = "جاري الحفظ... <i class='bx bx-loader-alt bx-spin'></i>";
        }

        if (!name || !phone) {
            showToast("يرجى ملء جميع الحقول المطلوبة", "error");
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = "حفظ الطالب";
            }
            return;
        }

        try {
            // Ensure unique code
            let finalCode = code;
            let codeCheck = await window.db.collection("students").where("code", "==", finalCode).get();
            while (!codeCheck.empty) {
                finalCode = `ST-${Math.floor(100000 + Math.random() * 900000)}`;
                codeCheck = await window.db.collection("students").where("code", "==", finalCode).get();
            }

            // Check duplicate (phone + name)
            const phoneCheck = await getSnapshotByPhone("students", phone);
            if (phoneCheck && !phoneCheck.empty) {
                const duplicate = phoneCheck.docs.some(doc => doc.data().name === name);
                if (duplicate) {
                    showToast("هذا الطالب مضاف بالفعل!", "error");
                    if (saveBtn) {
                        saveBtn.disabled = false;
                        saveBtn.innerHTML = "حفظ الطالب";
                    }
                    return;
                }
            }

            const result = await SyncService.executeDbOperation("students", "add", null, {
                name: name,
                phone: phone,
                code: finalCode,
                grade: grade,
                isActivated: true, // Manually added are active by default
                score: 0,
                attendance: [],
                totalSessions: 8,
                paid: 0,
                otherExpenses: 0,
                level: "لم يتم تحديد المستوى بعد",
                notes: "",
                report: "",
                createdAt: 'SERVER_TIMESTAMP'
            });

            if (result && !result.offline) {
                showToast("✅ تم إضافة الطالب بنجاح");
            }
            addStudentForm.reset();
            const addStudentModal = document.getElementById('add-student-modal');
            if (addStudentModal) addStudentModal.classList.add('hidden');

            // Switch to students view
            switchView('students-view', 'إدارة الطلاب');

        } catch (error) {
            console.error("Add Student Error:", error);
            showToast("حدث خطأ أثناء حفظ الطالب", "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = "حفظ الطالب";
        }
    });
}

// Booklet Pricing Preset Selectors Logic
function selectBookletPreset(value) {
    const presets = document.querySelectorAll('.preset-btn');
    const customWrapper = document.getElementById('custom-expense-wrapper');
    const bookletDetailsWrapper = document.getElementById('booklet-details-wrapper');
    const otherExpEl = document.getElementById('edit-student-other-expenses');
    
    if (!otherExpEl) return;
    
    const valNum = parseInt(value) || 0;
    presets.forEach(btn => btn.classList.remove('active'));
    
    let matched = false;
    presets.forEach(btn => {
        const btnVal = btn.getAttribute('data-val');
        if (btnVal !== 'custom' && parseInt(btnVal) === valNum) {
            btn.classList.add('active');
            matched = true;
        }
    });
    
    if (matched) {
        if (customWrapper) customWrapper.style.display = 'none';
        otherExpEl.value = valNum;
    } else {
        const customBtn = document.querySelector('.preset-btn[data-val="custom"]');
        if (customBtn) customBtn.classList.add('active');
        if (customWrapper) customWrapper.style.display = 'block';
        otherExpEl.value = valNum;
    }

    // Toggle booklet details wrapper based on value
    if (bookletDetailsWrapper) {
        bookletDetailsWrapper.style.display = valNum > 0 ? 'block' : 'none';
    }
}

function initBookletPricing() {
    const presets = document.querySelectorAll('.preset-btn');
    const customWrapper = document.getElementById('custom-expense-wrapper');
    const bookletDetailsWrapper = document.getElementById('booklet-details-wrapper');
    const otherExpEl = document.getElementById('edit-student-other-expenses');
    
    if (!otherExpEl) return;

    presets.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            presets.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            
            const val = btn.getAttribute('data-val');
            if (val === 'custom') {
                if (customWrapper) {
                    customWrapper.style.display = 'block';
                }
                if (bookletDetailsWrapper) {
                    bookletDetailsWrapper.style.display = 'block';
                }
                otherExpEl.focus();
            } else {
                if (customWrapper) {
                    customWrapper.style.display = 'none';
                }
                const valNum = parseInt(val) || 0;
                if (bookletDetailsWrapper) {
                    bookletDetailsWrapper.style.display = valNum > 0 ? 'block' : 'none';
                }
                otherExpEl.value = valNum;
                // Dispatch input event to recalculate
                otherExpEl.dispatchEvent(new Event('input'));
            }
        });
    });

    otherExpEl.addEventListener('input', () => {
        calculateSmartPayment();
    });

    // Also add listener for booklet name change
    document.getElementById('edit-student-booklet-name')?.addEventListener('input', () => {
        calculateSmartPayment();
    });
}

// Initialize on DOM ready or immediately
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBookletPricing);
} else {
    initBookletPricing();
}

// ============================================
// CONTENT MANAGEMENT CRUD SYSTEM (PORTFOLIO, NOTES, ARTICLES)
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initContentManagementSystem();
});

function initContentManagementSystem() {
    // Modal cancellation/close listeners
    document.getElementById('close-work-modal')?.addEventListener('click', () => closeContentModal('work-modal'));
    document.getElementById('cancel-work-btn')?.addEventListener('click', () => closeContentModal('work-modal'));
    
    // Form submissions
    document.getElementById('work-form')?.addEventListener('submit', handleWorkFormSubmit);
}

// Modal helpers
function closeContentModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('hidden');
    }
}

// 1. WORKS (PORTFOLIO)
function openWorkModal(work = null) {
    const modal = document.getElementById('work-modal');
    const titleEl = document.getElementById('work-modal-title');
    const idEl = document.getElementById('work-id');
    const form = document.getElementById('work-form');
    
    if (!modal || !form) return;
    
    form.reset();
    
    if (work) {
        titleEl.textContent = '💼 تعديل العمل';
        idEl.value = work.id;
        document.getElementById('work-title').value = work.title || '';
        document.getElementById('work-image-url').value = work.imageUrl || '';
        document.getElementById('work-link-url').value = work.linkUrl || '';
        document.getElementById('work-desc').value = work.description || '';
    } else {
        titleEl.textContent = '💼 إضافة عمل جديد';
        idEl.value = '';
    }
    
    modal.classList.remove('hidden');
}

function handleWorkFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('work-id').value;
    const title = document.getElementById('work-title').value.trim();
    const imageUrl = document.getElementById('work-image-url').value.trim();
    const linkUrl = document.getElementById('work-link-url').value.trim();
    const description = document.getElementById('work-desc').value.trim();
    
    const data = { title, imageUrl, linkUrl, description };
    
    const action = id ? 'update' : 'add';
    const docId = id || null;
    
    if (action === 'add') {
        data.views = 0;
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    
    SyncService.executeDbOperation('portfolio', action, docId, data)
        .then(() => {
            showToast(id ? 'تم تعديل العمل بنجاح' : 'تم إضافة العمل بنجاح', 'success');
            closeContentModal('work-modal');
        })
        .catch(err => {
            console.error("Error saving work: ", err);
            showToast('حدث خطأ أثناء حفظ العمل', 'danger');
        });
}

function subscribeAdminWorks() {
    const tbody = document.getElementById('works-table-body');
    window.db.collection('portfolio').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
        if (!tbody) return;
        tbody.innerHTML = '';
        
        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 20px;">لا توجد أعمال لعرضها حالياً.</td></tr>`;
            return;
        }

        snapshot.forEach(doc => {
            const item = doc.data();
            const id = doc.id;
            const tr = document.createElement('tr');
            
            const imageHtml = item.imageUrl 
                ? `<img src="${item.imageUrl}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; border: 1px solid var(--border);">` 
                : `<div style="width: 50px; height: 50px; border-radius: 8px; background: var(--bg-elevated); display: flex; align-items: center; justify-content: center; color: var(--text-muted);"><i class='bx bx-briefcase' style="font-size: 20px;"></i></div>`;
            
            tr.innerHTML = `
                <td style="display:flex; align-items:center; gap:10px;">
                    ${imageHtml}
                    <strong>${item.title}</strong>
                </td>
                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.description || ''}</td>
                <td><i class='bx bx-show'></i> ${item.views || 0}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon btn-icon-edit" onclick="editAdminWork('${id}')" title="تعديل"><i class='bx bx-edit'></i></button>
                        <button class="btn-icon btn-icon-delete" onclick="deleteAdminWork('${id}')" title="حذف"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    });
}

window.editAdminWork = function(id) {
    window.db.collection('portfolio').doc(id).get().then(doc => {
        if (doc.exists) {
            openWorkModal({ id: doc.id, ...doc.data() });
        }
    });
};

window.deleteAdminWork = function(id) {
    if (confirm("هل أنت متأكد من حذف هذا العمل؟")) {
        SyncService.executeDbOperation('portfolio', 'delete', id, null)
            .then(() => showToast('تم حذف العمل بنجاح', 'success'))
            .catch(err => showToast('فشل حذف العمل', 'danger'));
    }
};





// ============================================
// GROUPS MANAGEMENT
// ============================================
function loadGroupsData() {
    window.db.collection("groups").onSnapshot((snapshot) => {
        console.log('✅ Got groups snapshot, size:', snapshot.size);
        groupsData = [];
        snapshot.forEach((doc) => {
            const group = doc.data();
            group.id = doc.id;
            group.studentCount = studentsData.filter(s => s.groupId === doc.id).length;
            groupsData.push(group);
        });

        var catLabels = { current: 'العام الحالي', previous: 'العام الماضي', foundation: 'التأسيس' };
        var tabToCategory = { current: 'current', previous: 'previous', summer: 'foundation' };

        // Helper: build grouped options HTML filtered by active year tab
        function buildGroupedOptions(includeAll, filterByTab) {
            var html = includeAll ? '<option value="">كل المجموعات</option>' : '<option value="">بدون مجموعة</option>';
            var activeCat = filterByTab ? (tabToCategory[currentYearTab] || currentYearTab) : null;
            ['current', 'previous', 'foundation'].forEach(function(cat) {
                if (activeCat && cat !== activeCat) return;
                var catGroups = groupsData.filter(function(g) { return (g.category || 'current') === cat; });
                if (catGroups.length === 0) return;
                html += '<optgroup label="' + (catLabels[cat] || cat) + '">';
                catGroups.forEach(function(g) {
                    html += '<option value="' + g.id + '" style="border-left:4px solid ' + g.color + ';">' + g.name + '</option>';
                });
                html += '</optgroup>';
            });
            return html;
        }

        // Update group filter dropdown
        const filterSelect = document.getElementById('group-filter');
        if (filterSelect) {
            filterSelect.innerHTML = buildGroupedOptions(true, true);
        }

        // Update attendance group filter dropdown
        populateAttendanceGroupFilter();

        // Update edit modal group dropdown based on selected year
        updateEditStudentGroupDropdown();

        // Re-render students if visible
        if (typeof window.applyStudentFilters === 'function') {
            window.applyStudentFilters();
        }

        // Update group modal if open
        if (!document.getElementById('group-modal')?.classList.contains('hidden')) {
            renderGroupsList();
        }

        // Update groups view
        renderGroupsView();
    }, (error) => {
        console.error('❌ Error loading groups:', error);
    });
}

function updateGroupsDropdown() {
    var catLabels = { current: 'العام الحالي', previous: 'العام الماضي', foundation: 'التأسيس' };
    var tabToCategory = { current: 'current', previous: 'previous', summer: 'foundation' };
    var activeCat = tabToCategory[currentYearTab] || currentYearTab;

    function buildFilteredOptions(includeAll) {
        var html = includeAll ? '<option value="">كل المجموعات</option>' : '<option value="">بدون مجموعة</option>';
        var catGroups = groupsData.filter(function(g) { return (g.category || 'current') === activeCat; });
        if (catGroups.length > 0) {
            html += '<optgroup label="' + (catLabels[activeCat] || activeCat) + '">';
            catGroups.forEach(function(g) {
                html += '<option value="' + g.id + '" style="border-left:4px solid ' + g.color + ';">' + g.name + '</option>';
            });
            html += '</optgroup>';
        }
        return html;
    }

    var filterSelect = document.getElementById('group-filter');
    if (filterSelect) {
        filterSelect.innerHTML = buildFilteredOptions(true);
    }

    // Update edit student group dropdown based on selected year
    updateEditStudentGroupDropdown();
}

function updateEditStudentGroupDropdown() {
    var catLabels = { current: 'العام الحالي', previous: 'العام الماضي', foundation: 'التأسيس' };
    var yearToCategory = { current: 'current', previous: 'previous', summer: 'foundation' };

    var yearSelect = document.getElementById('edit-student-year');
    var editGroupSelect = document.getElementById('edit-student-group');
    if (!yearSelect || !editGroupSelect) return;

    var selectedYear = yearSelect.value || 'current';
    var cat = yearToCategory[selectedYear] || 'current';
    var currentVal = editGroupSelect.value;

    var html = '<option value="">بدون مجموعة</option>';
    var catGroups = groupsData.filter(function(g) { return (g.category || 'current') === cat; });
    if (catGroups.length > 0) {
        html += '<optgroup label="' + (catLabels[cat] || cat) + '">';
        catGroups.forEach(function(g) {
            html += '<option value="' + g.id + '" style="border-left:4px solid ' + g.color + ';">' + g.name + '</option>';
        });
        html += '</optgroup>';
    }

    editGroupSelect.innerHTML = html;
    editGroupSelect.value = currentVal;
}

function openGroupModal() {
    renderGroupsList();
    document.getElementById('group-modal').classList.remove('hidden');
}

function renderGroupsList() {
    const container = document.getElementById('groups-list');
    if (!container) return;
    container.innerHTML = '';

    if (groupsData.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);"><i class="bx bx-layer" style="font-size:40px;display:block;margin-bottom:10px;"></i>لا توجد مجموعات بعد</div>';
        return;
    }

    // Organize by category
    var categories = {
        current: { label: 'العام الحالي', icon: '📚', groups: [] },
        previous: { label: 'العام الماضي', icon: '📖', groups: [] },
        foundation: { label: 'التأسيس', icon: '🌟', groups: [] }
    };

    groupsData.forEach(function(group) {
        var cat = group.category || 'current';
        if (!categories[cat]) cat = 'current';
        categories[cat].groups.push(group);
    });

    Object.keys(categories).forEach(function(catKey) {
        var cat = categories[catKey];
        if (cat.groups.length === 0) return;

        var section = document.createElement('div');
        section.className = 'group-category-section';
        section.style.marginBottom = '20px';
        section.innerHTML = '<div style="font-size:14px;font-weight:800;color:var(--text-secondary);padding:8px 4px;border-bottom:2px solid var(--border);margin-bottom:8px;">' + cat.icon + ' ' + cat.label + ' (' + cat.groups.length + ')</div>';

        cat.groups.forEach(function(group) {
            var count = studentsData.filter(function(s) { return s.groupId === group.id; }).length;
            var card = document.createElement('div');
            card.className = 'group-card-modal';
            card.innerHTML = [
                '<div class="group-card-info">',
                    '<div class="group-color-dot" style="background:' + group.color + '"></div>',
                    '<div>',
                        '<div class="group-card-name">' + group.name + '</div>',
                        '<div class="group-card-details">' + (group.day || '') + ' ' + (group.time || '') + '</div>',
                    '</div>',
                '</div>',
                '<div class="group-card-count">' + count + ' طالب</div>',
                '<div class="group-card-actions">',
                    (group.whatsapp ? '<a href="' + group.whatsapp + '" target="_blank" class="btn-icon whatsapp-group-btn" title="جروب الواتساب" style="color:#25D366;text-decoration:none;"><i class="bx bxl-whatsapp"></i></a>' : ''),
                    '<button class="btn-icon edit-group-btn" data-id="' + group.id + '" title="تعديل"><i class="bx bx-edit"></i></button>',
                    '<button class="btn-icon danger delete-group-btn" data-id="' + group.id + '" title="حذف"><i class="bx bx-trash"></i></button>',
                '</div>'
            ].join('');
            section.appendChild(card);
        });

        container.appendChild(section);
    });

    // Attach group action events
    document.querySelectorAll('.edit-group-btn').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function(g) { return g.id === id; });
            if (group) openGroupFormModal(group);
        });
    });

    document.querySelectorAll('.delete-group-btn').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function(g) { return g.id === id; });
            if (!group) return;
            if (confirm('هل أنت متأكد من حذف المجموعة "' + group.name + '"?\nسيتم إزالة المجموعة من جميع الطلاب المرتبطين بها.')) {
                try {
                    var studentsInGroup = studentsData.filter(function(s) { return s.groupId === id; });
                    for (var _s = 0; _s < studentsInGroup.length; _s++) {
                        await SyncService.executeDbOperation('students', 'update', studentsInGroup[_s].id, { groupId: '' });
                    }
                    await SyncService.executeDbOperation('groups', 'delete', id, null);
                    showToast('✅ تم حذف المجموعة');
                } catch (err) {
                    showToast('حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    });
}

let currentGroupTab = 'current';

function renderGroupsView() {
    const container = document.getElementById('groups-view-list');
    if (!container) return;
    container.innerHTML = '';

    var filtered = groupsData.filter(function(g) {
        return (g.category || 'current') === currentGroupTab;
    });

    var countChip = document.getElementById('groups-count-chip');
    if (countChip) countChip.textContent = filtered.length + ' مجموعة';

    if (filtered.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);"><i class="bx bx-layer" style="font-size:48px;display:block;margin-bottom:12px;opacity:.4;"></i>لا توجد مجموعات في هذا القسم</div>';
        return;
    }

    filtered.forEach(function(group) {
        var groupStudents = studentsData.filter(function(s) { return s.groupId === group.id; });
        var count = groupStudents.length;
        var card = document.createElement('div');
        card.className = 'group-view-card';
        card.style.borderLeftColor = group.color;

        var studentsHtml = '';
        if (groupStudents.length > 0) {
            var rows = groupStudents.map(function(s) {
                var levelClass = s.level === 'متميز' ? 'gold' : (s.level === 'محتاج تحسين' ? 'red' : '');
                return '<div class="group-student-row" onclick="StudentPhotoLightbox.open(\'' + (s.profileImage || '') + '\', \'' + (s.name || 'طالب') + '\')">' +
                    '<div class="group-student-avatar" style="background:' + group.color + '20;color:' + group.color + ';overflow:hidden;display:flex;align-items:center;justify-content:center;">' +
                    (s.profileImage
                        ? '<img src="' + s.profileImage + '" style="width:100%;height:100%;object-fit:cover;">'
                        : (s.name || '?').charAt(0)) +
                    '</div>' +
                    '<span class="group-student-name">' + (s.name || '') + '</span>' +
                    (levelClass ? '<span class="group-student-level ' + levelClass + '">' + s.level + '</span>' : '') +
                '</div>';
            }).join('');
            studentsHtml = '<div class="group-view-students-list">' + rows + '</div>';
        } else {
            studentsHtml = '<div class="group-view-students-empty">لا يوجد طالب في هذه المجموعة</div>';
        }

        card.innerHTML = [
            '<div class="group-view-card-body">',
                '<div class="group-view-card-left">',
                    '<div class="group-view-color-badge" style="background:' + group.color + '20;color:' + group.color + ';">',
                        '<i class="bx bx-layer"></i>',
                    '</div>',
                    '<div class="group-view-info">',
                        '<div class="group-view-name">' + group.name + '</div>',
                        '<div class="group-view-meta">',
                            (group.day ? '<span><i class="bx bx-calendar"></i> ' + group.day + '</span>' : ''),
                            (group.time ? '<span><i class="bx bx-time"></i> ' + group.time + '</span>' : ''),
                        '</div>',
                    '</div>',
                '</div>',
                '<div class="group-view-card-right">',
                    '<div class="group-view-students-badge">',
                        '<i class="bx bx-user"></i> ' + count + ' طالب',
                    '</div>',
                    '<div class="group-view-actions">',
                        '<button class="group-view-btn attendance" data-id="' + group.id + '" title="الحضور"><i class="bx bx-calendar-check"></i></button>',
                        (group.whatsapp ? '<a href="' + group.whatsapp + '" target="_blank" class="group-view-btn whatsapp" title="جروب الواتساب"><i class="bx bxl-whatsapp"></i></a>' : ''),
                        '<button class="group-view-btn wa-send" data-id="' + group.id + '" title="إرسال واتساب للمجموعة"><i class="bx bx-message-detail"></i></button>',
                        '<button class="group-view-btn edit" data-id="' + group.id + '" title="تعديل"><i class="bx bx-edit"></i></button>',
                        '<button class="group-view-btn delete" data-id="' + group.id + '" title="حذف"><i class="bx bx-trash"></i></button>',
                    '</div>',
                '</div>',
            '</div>',
            '<div class="group-view-students-toggle" data-group-id="' + group.id + '">',
                '<i class="bx bx-chevron-down"></i> عرض الطلاب',
            '</div>',
            studentsHtml
        ].join('');
        container.appendChild(card);
    });

    container.querySelectorAll('.group-view-btn.attendance').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function(g) { return g.id === id; });
            if (!group) return;
            setDefaultDate();
            populateAttendanceGroupFilter();
            attendanceGradeFilter.value = 'group:' + id;
            renderAttendanceStudents();
            attendanceModal.classList.remove('hidden');
        });
    });

    container.querySelectorAll('.group-view-btn.edit').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function(g) { return g.id === id; });
            if (group) openGroupFormModal(group);
        });
    });

    container.querySelectorAll('.group-view-btn.delete').forEach(function(btn) {
        btn.addEventListener('click', async function(e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function(g) { return g.id === id; });
            if (!group) return;
            if (confirm('هل أنت متأكد من حذف المجموعة "' + group.name + '"?\nسيتم إزالة المجموعة من جميع الطلاب المرتبطين بها.')) {
                try {
                    var studentsInGroup = studentsData.filter(function(s) { return s.groupId === id; });
                    for (var _s = 0; _s < studentsInGroup.length; _s++) {
                        await SyncService.executeDbOperation('students', 'update', studentsInGroup[_s].id, { groupId: '' });
                    }
                    await SyncService.executeDbOperation('groups', 'delete', id, null);
                    showToast('✅ تم حذف المجموعة');
                } catch (err) {
                    showToast('حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    });

    container.querySelectorAll('.group-view-btn.wa-send').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function(g) { return g.id === id; });
            if (group) openGroupWAModal(group);
        });
    });

    container.querySelectorAll('.group-view-students-toggle').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var card = btn.closest('.group-view-card');
            var list = card.querySelector('.group-view-students-list, .group-view-students-empty');
            if (!list) return;
            var isOpen = list.classList.contains('open');
            list.classList.toggle('open');
            btn.classList.toggle('open');
            btn.innerHTML = isOpen ? '<i class="bx bx-chevron-down"></i> عرض الطلاب' : '<i class="bx bx-chevron-up"></i> إخفاء الطلاب';
        });
    });
}

function openGroupFormModal(group = null) {
    const modal = document.getElementById('group-form-modal');
    const form = document.getElementById('group-form');
    const title = document.getElementById('group-form-title');
    const idField = document.getElementById('group-form-id');
    const nameField = document.getElementById('group-name');
    const colorField = document.getElementById('group-color');
    const dayField = document.getElementById('group-day');
    const timeField = document.getElementById('group-time');
    const reportField = document.getElementById('group-report');
    const categoryField = document.getElementById('group-category');
    const whatsappField = document.getElementById('group-whatsapp');
    const templatesSection = document.getElementById('group-templates-section');

    form.reset();
    document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));

    if (group) {
        title.innerHTML = '<i class="bx bx-edit" style="color:var(--accent);"></i> تعديل المجموعة';
        idField.value = group.id;
        nameField.value = group.name;
        colorField.value = group.color;
        dayField.value = group.day || '';
        timeField.value = group.time || '';
        reportField.value = group.report || '';
        categoryField.value = group.category || 'current';
        whatsappField.value = group.whatsapp || '';
        if (templatesSection) templatesSection.style.display = 'block';
        // Set active color
        document.querySelector(`.color-option[data-color="${group.color}"]`)?.classList.add('active');
    } else {
        title.innerHTML = '<i class="bx bx-plus-circle" style="color:var(--accent);"></i> مجموعة جديدة';
        idField.value = '';
        nameField.value = '';
        colorField.value = '#f97316';
        dayField.value = '';
        timeField.value = '';
        reportField.value = '';
        categoryField.value = 'current';
        whatsappField.value = '';
        if (templatesSection) templatesSection.style.display = 'none';
        document.querySelector('.color-option[data-color="#f97316"]')?.classList.add('active');
    }

    modal.classList.remove('hidden');
}

async function handleGroupFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('group-form-id').value;
    const name = document.getElementById('group-name').value.trim();
    const color = document.getElementById('group-color').value;
    const day = document.getElementById('group-day').value;
    const time = document.getElementById('group-time').value.trim();
    const report = document.getElementById('group-report').value.trim();
    const category = document.getElementById('group-category').value;
    const whatsapp = document.getElementById('group-whatsapp').value.trim();

    if (!name) {
        showToast('يرجى إدخال اسم المجموعة', 'error');
        return;
    }

    const data = { name, color, day, time, report, category, whatsapp };

    try {
        if (id) {
            await SyncService.executeDbOperation('groups', 'update', id, data);
            // Update day/hour/report for all students in this group
            const studentsInGroup = studentsData.filter(s => s.groupId === id);
            if (studentsInGroup.length > 0) {
                for (const student of studentsInGroup) {
                    await SyncService.executeDbOperation('students', 'update', student.id, { day, hour: time, report });
                }
                showToast(`✅ تم تعديل المجموعة وتحديث ${studentsInGroup.length} طالب`);
            } else {
                showToast('✅ تم تعديل المجموعة');
            }
        } else {
            await SyncService.executeDbOperation('groups', 'add', null, { ...data, createdAt: 'SERVER_TIMESTAMP' });
            showToast('✅ تم إنشاء المجموعة');
        }
        document.getElementById('group-form-modal').classList.add('hidden');
    } catch (err) {
        console.error('❌ Group form error:', err);
        showToast('حدث خطأ: ' + (err.message || err.code || 'غير معروف'), 'error');
    }
}

// ============================================
// THEME MANAGER — Admin
// ============================================
(function() {
    var toggle = document.getElementById('themeToggle');
    if (!toggle) return;

    var html = document.documentElement;
    var icons = toggle.querySelectorAll('.theme-toggle-icon');

    function syncUI(theme) {
        if (theme === 'dark') {
            if (icons[0]) icons[0].style.display = 'none';
            if (icons[1]) icons[1].style.display = 'inline';
        } else {
            if (icons[0]) icons[0].style.display = 'inline';
            if (icons[1]) icons[1].style.display = 'none';
        }
    }

    syncUI(html.getAttribute('data-theme') || 'light');

    toggle.addEventListener('click', function() {
        var next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('elmistar-theme', next);
        syncUI(next);
    });
})();

// ============================================
// AUTO-REFRESH: Sync data when tab becomes visible
// ============================================
function refreshAdminData() {
    // Force re-render students table with current filters applied
    applyStudentFilters();
    // Re-apply filters
    applyRequestFilters();
    // Refresh payments display
    renderPaymentsTable();
}

document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        refreshAdminData();
    }
});

window.addEventListener('focus', function () {
    refreshAdminData();
});

// ============================================
// ANNOUNCEMENTS MANAGEMENT
// ============================================
let announcementsData = [];

function loadAnnouncements() {
    if (!window.db) return;
    window.db.collection("announcements").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        announcementsData = [];
        snapshot.forEach((doc) => {
            const ann = doc.data();
            ann.id = doc.id;
            announcementsData.push(ann);
        });
        renderAnnouncementsTable();
        updateAnnouncementsBadge();
    }, (error) => {
        console.error('❌ Error loading announcements:', error);
    });
}

function updateAnnouncementsBadge() {
    const activeCount = announcementsData.filter(a => a.isActive === true).length;
    const settingsBadge = document.getElementById('settings-announcements-badge');
    if (settingsBadge) {
        settingsBadge.textContent = activeCount;
        settingsBadge.style.display = activeCount > 0 ? 'inline-block' : 'none';
    }
}

function getAnnTypeLabel(type) {
    const labels = { announcement: '📢 إعلان', tip: '💡 نصيحة', alert: '⚠️ تنبيه', update: '🆕 تحديث' };
    return labels[type] || '📢 إعلان';
}

function getAnnTypeColor(type) {
    const colors = { announcement: '#3b82f6', tip: '#10b981', alert: '#ef4444', update: '#f59e0b' };
    return colors[type] || '#3b82f6';
}

function renderAnnouncementsTable() {
    const tbody = document.querySelector('#announcements-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (announcementsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state-td"><i class="bx bx-megaphone"></i><p>لا توجد إعلانات بعد</p></td></tr>';
        return;
    }

    announcementsData.forEach(ann => {
        const isActive = ann.isActive === true;
        const statusHtml = isActive
            ? '<span class="badge" style="background:var(--green-dim);color:var(--green);">مفعل</span>'
            : '<span class="badge" style="background:var(--bg-elevated);color:var(--text-muted);">غير مفعل</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${ann.imageUrl ? '<img src="' + ann.imageUrl + '" style="width:60px;height:40px;border-radius:8px;object-fit:cover;">' : '<span style="color:var(--text-muted);font-size:11px;">—</span>'}</td>
            <td><strong>${ann.title || 'بدون عنوان'}</strong></td>
            <td>${statusHtml}</td>
            <td class="action-btns-cell">
                <div class="action-btns-inner">
                    <button class="btn-icon edit-ann-btn" data-id="${ann.id}" title="تعديل"><i class='bx bx-edit'></i></button>
                    <button class="btn-icon danger delete-ann-btn" data-id="${ann.id}" title="حذف"><i class='bx bx-trash'></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach events
    document.querySelectorAll('.edit-ann-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const ann = announcementsData.find(a => a.id === id);
            if (ann) openAnnouncementFormModal(ann);
        });
    });

    document.querySelectorAll('.delete-ann-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const ann = announcementsData.find(a => a.id === id);
            if (!ann) return;
            if (confirm(`هل أنت متأكد من حذف الإعلان "${ann.title}"؟`)) {
                try {
                    await SyncService.executeDbOperation('announcements', 'delete', id, null);
                    showToast('✅ تم حذف الإعلان');
                } catch (err) {
                    showToast('حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    });
}

function openAnnouncementFormModal(announcement) {
    const modal = document.getElementById('announcement-form-modal');
    const form = document.getElementById('announcement-form');
    const title = document.getElementById('ann-form-title');
    const idField = document.getElementById('ann-form-id');
    const titleField = document.getElementById('ann-title');
    const imageUrlField = document.getElementById('ann-image-url');
    const imagePreview = document.getElementById('ann-image-preview');
    const removeBtn = document.getElementById('ann-remove-image');
    const activeCheck = document.getElementById('ann-is-active');
    const uploadZone = document.getElementById('ann-upload-zone');

    form.reset();
    imagePreview.style.display = 'none';
    removeBtn.style.display = 'none';
    if (uploadZone) uploadZone.style.borderColor = '';

    if (announcement) {
        title.innerHTML = '<i class="bx bx-edit" style="color:var(--accent);"></i> تعديل الإعلان';
        idField.value = announcement.id;
        titleField.value = announcement.title || '';
        activeCheck.checked = announcement.isActive === true;
        if (announcement.imageUrl) {
            imageUrlField.value = announcement.imageUrl;
            imagePreview.src = announcement.imageUrl;
            imagePreview.style.display = 'block';
            removeBtn.style.display = 'inline-block';
        }
    } else {
        title.innerHTML = '<i class="bx bx-plus-circle" style="color:var(--accent);"></i> إضافة إعلان جديد';
        idField.value = '';
        titleField.value = '';
        activeCheck.checked = true;
        imageUrlField.value = '';
    }

    modal.classList.remove('hidden');
}

async function handleAnnouncementFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('ann-form-id').value;
    const title = document.getElementById('ann-title').value.trim();
    const imageUrl = document.getElementById('ann-image-url').value;
    const isActive = document.getElementById('ann-is-active').checked;

    if (!title) {
        showToast('يرجى إدخال عنوان الإعلان', 'error');
        return;
    }

    const data = { title, imageUrl, isActive };

    try {
        if (id) {
            await SyncService.executeDbOperation('announcements', 'update', id, data);
            showToast('✅ تم تعديل الإعلان');
        } else {
            await SyncService.executeDbOperation('announcements', 'add', null, { ...data, createdAt: 'SERVER_TIMESTAMP' });
            showToast('✅ تم إنشاء الإعلان');
        }
        document.getElementById('announcement-form-modal').classList.add('hidden');
    } catch (err) {
        console.error('❌ Announcement form error:', err);
        showToast('حدث خطأ: ' + (err.message || err.code || 'غير معروف'), 'error');
    }
}

function setupAnnouncementImageUpload() {
    var fileInput = document.getElementById('ann-image-file');
    var preview = document.getElementById('ann-image-preview');
    var removeBtn = document.getElementById('ann-remove-image');
    var hiddenInput = document.getElementById('ann-image-url');
    var uploadZone = document.getElementById('ann-upload-zone');
    if (!fileInput || !preview || !hiddenInput) return;

    fileInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            if (typeof showToast === 'function') showToast('حجم الصورة يتجاوز 5 ميجا', 'error');
            fileInput.value = '';
            return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
            var img = new Image();
            img.onload = function () {
                var w = img.width, h = img.height;
                var maxWidth = 800;
                if (w > maxWidth) {
                    h = Math.round((h * maxWidth) / w);
                    w = maxWidth;
                }
                var canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);
                var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                hiddenInput.value = dataUrl;
                preview.src = dataUrl;
                preview.style.display = 'block';
                if (removeBtn) removeBtn.style.display = 'inline-block';
                if (uploadZone) uploadZone.style.borderColor = '#6c63ff';
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
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
        uploadZone.addEventListener('dragover', function (e) { e.preventDefault(); uploadZone.style.borderColor = '#6c63ff'; });
        uploadZone.addEventListener('dragleave', function () { uploadZone.style.borderColor = ''; });
        uploadZone.addEventListener('drop', function (e) {
            e.preventDefault();
            var file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }
}

// ============================================
// ENROLLMENT REQUESTS MANAGEMENT
// ============================================
let enrollmentsData = [];

// Enrollment visibility toggle
function loadEnrollmentToggleSetting() {
    var toggle = document.getElementById('enrollment-toggle');
    if (!toggle || !window.db) return;
    window.db.collection("settings").doc("enrollment").get().then(function (doc) {
        if (doc.exists) {
            var enabled = doc.data().enabled;
            if (enabled === false) {
                toggle.checked = false;
            } else {
                toggle.checked = true;
            }
        } else {
            toggle.checked = true;
        }
    }).catch(function (err) {
        console.error('[ENROLLMENT] Error loading toggle setting:', err);
    });
}

function saveEnrollmentToggleSetting(enabled) {
    if (!window.db) return;
    window.db.collection("settings").doc("enrollment").set({ enabled: enabled }, { merge: true }).catch(function (err) {
        console.error('[ENROLLMENT] Error saving toggle setting:', err);
        showToast('خطأ في حفظ الإعداد', 'error');
    });
}

// Registration notes settings
function loadNotesSetting() {
    if (!window.db) return;
    window.db.collection("settings").doc("notes").get().then(function (doc) {
        if (doc.exists) {
            var data = doc.data() || {};
            var titleEl = document.getElementById('settings-notes-title');
            var msgEl = document.getElementById('settings-notes-message');
            if (titleEl) titleEl.value = data.title || '';
            if (msgEl) msgEl.value = data.message || '';
            _updateNotesPreview();
        }
    }).catch(function (err) {
        console.error('[NOTES] Error loading notes setting:', err);
    });
}

function saveNotesSetting() {
    if (!window.db) {
        showToast('قاعدة البيانات غير مرتبطة', 'error');
        return;
    }
    var titleEl = document.getElementById('settings-notes-title');
    var msgEl = document.getElementById('settings-notes-message');
    var title = titleEl ? titleEl.value.trim() : '';
    var message = msgEl ? msgEl.value : '';
    window.db.collection("settings").doc("notes").set(
        { title: title, message: message },
        { merge: true }
    ).then(function () {
        showToast('✅ تم حفظ ملاحظات التسجيل');
    }).catch(function (err) {
        console.error('[NOTES] Error saving notes setting:', err);
        showToast('خطأ في حفظ الملاحظات', 'error');
    });
}

function resetNotesSetting() {
    if (!window.db) {
        showToast('قاعدة البيانات غير مرتبطة', 'error');
        return;
    }
    if (!confirm('سيتم حذف الملاحظات المخصصة والعودة للافتراضية. متابعة؟')) return;
    window.db.collection("settings").doc("notes").delete().then(function () {
        var titleEl = document.getElementById('settings-notes-title');
        var msgEl = document.getElementById('settings-notes-message');
        if (titleEl) titleEl.value = '';
        if (msgEl) msgEl.value = '';
        showToast('✅ تم استعادة الملاحظات الافتراضية');
    }).catch(function (err) {
        console.error('[NOTES] Error resetting notes setting:', err);
        showToast('خطأ في استعادة الملاحظات', 'error');
    });
}

// Congrats visibility toggle
function loadCongratsToggleSetting() {
    var toggle = document.getElementById('congrats-toggle');
    if (!toggle || !window.db) return;
    window.db.collection("settings").doc("congrats").get().then(function (doc) {
        if (doc.exists) {
            toggle.checked = doc.data().enabled !== false;
        } else {
            toggle.checked = true;
        }
    }).catch(function (err) {
        console.error('[CONGRATS] Error loading toggle setting:', err);
    });
}

function saveCongratsToggleSetting(enabled) {
    if (!window.db) return;
    window.db.collection("settings").doc("congrats").set({ enabled: enabled }, { merge: true }).catch(function (err) {
        console.error('[CONGRATS] Error saving toggle setting:', err);
        showToast('خطأ في حفظ الإعداد', 'error');
    });
}

// Registration toggle
function loadRegistrationToggleSetting() {
    var toggle = document.getElementById('registration-toggle');
    var label = document.getElementById('registration-toggle-label');
    if (!toggle || !window.db) return;
    window.db.collection("settings").doc("registration").get().then(function (doc) {
        if (doc.exists) {
            var enabled = doc.data().enabled;
            if (enabled === false) {
                toggle.checked = false;
                if (label) label.textContent = 'التسجيل غير متاح';
            } else {
                toggle.checked = true;
                if (label) label.textContent = 'التسجيل متاح';
            }
            var gradesData = doc.data().grades || null;
            renderPerGradeTable(gradesData);
        } else {
            toggle.checked = true;
            if (label) label.textContent = 'التسجيل متاح';
            renderPerGradeTable(null);
        }
    }).catch(function (err) {
        console.error('[REGISTRATION] Error loading toggle setting:', err);
    });
}

// Curriculum visibility toggle
function loadCurriculumToggleSetting() {
    var toggle = document.getElementById('curriculum-toggle');
    var label = document.getElementById('curriculum-toggle-label');
    if (!toggle || !window.db) return;
    window.db.collection('settings').doc('curriculum').get().then(function (doc) {
        if (doc.exists) {
            var visible = doc.data().visible !== false;
            toggle.checked = visible;
            if (label) label.textContent = visible ? 'مرئي' : 'مخفي';
        } else {
            toggle.checked = true;
            if (label) label.textContent = 'مرئي';
        }
    }).catch(function (err) {
        console.error('[CURRICULUM] Error loading toggle:', err);
    });
}

function saveCurriculumToggleSetting(visible) {
    if (!window.db) return;
    window.db.collection('settings').doc('curriculum').set({ visible: visible }, { merge: true }).then(function () {
        showToast(visible ? '✅ تم إظهار المنهج التعليمي' : '✅ تم إخفاء المنهج التعليمي');
    }).catch(function (err) {
        console.error('[CURRICULUM] Error saving toggle:', err);
        showToast('خطأ في حفظ الإعداد', 'error');
    });
}

function renderPerGradeTable(gradesData) {
    var section = document.getElementById('per-grade-section');
    var container = document.getElementById('per-grade-cards');
    if (!section || !container) return;
    var gradeKeys = ["0","1","2","3","4","5","6"];
    var gradeLabels = ["مرحلة الكي جي والتأسيس","الصف الأول الابتدائي","الصف الثاني الابتدائي","الصف الثالث الابتدائي","الصف الرابع الابتدائي","الصف الخامس الابتدائي","الصف السادس الابتدائي"];
    var gradeIcons = ["bx-child","bx-group","bx-group","bx-group","bx-group","bx-group","bx-group"];
    container.innerHTML = '';
    gradeKeys.forEach(function (key, idx) {
        var gs = (gradesData && gradesData[key]) || {};
        var enabled = gs.enabled !== false;
        var max = (typeof gs.max === 'number') ? gs.max : 0;
        var count = allSignups ? allSignups.filter(function (s) { return getGradeNameSafe(s.grade) === gradeLabels[idx]; }).length : 0;
        if (max > 0 && count >= max && enabled) enabled = false;
        var card = document.createElement('div');
        card.className = 'per-grade-card' + (enabled ? '' : ' disabled');
        card.dataset.grade = key;
        // Header with name and toggle
        var header = document.createElement('div');
        header.className = 'per-grade-card-header';
        var nameSpan = document.createElement('span');
        nameSpan.className = 'per-grade-card-name';
        nameSpan.textContent = gradeLabels[idx];
        header.appendChild(nameSpan);
        // Toggle label
        var tglLabel = document.createElement('label');
        tglLabel.className = 'enroll-toggle-label';
        var tglInput = document.createElement('input');
        tglInput.type = 'checkbox';
        tglInput.className = 'per-grade-toggle';
        tglInput.dataset.grade = key;
        tglInput.checked = enabled;
        var tglSlider = document.createElement('span');
        tglSlider.className = 'enroll-toggle-slider';
        tglLabel.appendChild(tglInput);
        tglLabel.appendChild(tglSlider);
        header.appendChild(tglLabel);
        card.appendChild(header);
        // Capacity input
        var inputGroup = document.createElement('div');
        inputGroup.className = 'per-grade-card-input';
        var inputLabel = document.createElement('label');
        inputLabel.textContent = 'الحد الأقصى للطلاب';
        var maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.className = 'per-grade-max';
        maxInput.dataset.grade = key;
        maxInput.value = max;
        maxInput.min = '0';
        maxInput.placeholder = '0 = غير محدود';
        inputGroup.appendChild(inputLabel);
        inputGroup.appendChild(maxInput);
        card.appendChild(inputGroup);
        // Stats row
        var stats = document.createElement('div');
        stats.className = 'per-grade-card-stats';
        // Count stat
        var countStat = document.createElement('div');
        countStat.className = 'per-grade-stat';
        var countLabel = document.createElement('span');
        countLabel.className = 'per-grade-stat-label';
        countLabel.textContent = 'المسجلون';
        var countValue = document.createElement('span');
        countValue.className = 'per-grade-stat-value per-grade-count';
        countValue.dataset.grade = key;
        countValue.textContent = count;
        countStat.appendChild(countLabel);
        countStat.appendChild(countValue);
        stats.appendChild(countStat);
        // Max stat
        var maxStat = document.createElement('div');
        maxStat.className = 'per-grade-stat';
        var maxLabel = document.createElement('span');
        maxLabel.className = 'per-grade-stat-label';
        maxLabel.textContent = 'المقاعد';
        var maxValue = document.createElement('span');
        maxValue.className = 'per-grade-stat-value limit';
        maxValue.textContent = max > 0 ? max : '∞';
        maxStat.appendChild(maxLabel);
        maxStat.appendChild(maxValue);
        stats.appendChild(maxStat);
        // Status indicator
        if (max > 0 && count >= max) {
            var statusStat = document.createElement('div');
            statusStat.className = 'per-grade-stat';
            var statusLabel = document.createElement('span');
            statusLabel.className = 'per-grade-stat-label';
            statusLabel.textContent = 'الحالة';
            var statusValue = document.createElement('span');
            statusValue.className = 'per-grade-stat-value full';
            statusValue.textContent = 'مكتمل';
            statusStat.appendChild(statusLabel);
            statusStat.appendChild(statusValue);
            stats.appendChild(statusStat);
        }
        card.appendChild(stats);
        container.appendChild(card);
    });
    section.style.display = 'block';
    // Attach events toggles
    container.querySelectorAll('.per-grade-toggle').forEach(function (el) {
        el.removeEventListener('change', _onPerGradeToggleChange);
        el.addEventListener('change', _onPerGradeToggleChange);
    });
    container.querySelectorAll('.per-grade-max').forEach(function (el) {
        el.removeEventListener('change', _onPerGradeMaxChange);
        el.addEventListener('change', _onPerGradeMaxChange);
    });
}

var _pendingGradeChanges = {};

function _onPerGradeToggleChange(e) {
    var grade = e.target.dataset.grade;
    var enabled = e.target.checked;
    var card = e.target.closest('.per-grade-card');
    if (card) {
        if (enabled) {
            card.classList.remove('disabled');
        } else {
            card.classList.add('disabled');
        }
    }
    if (!_pendingGradeChanges[grade]) _pendingGradeChanges[grade] = {};
    _pendingGradeChanges[grade].enabled = enabled;
}

function _onPerGradeMaxChange(e) {
    var grade = e.target.dataset.grade;
    var max = parseInt(e.target.value) || 0;
    if (max < 0) max = 0;
    e.target.value = max;
    if (!_pendingGradeChanges[grade]) _pendingGradeChanges[grade] = {};
    _pendingGradeChanges[grade].max = max;
}

function _savePerGradeSettings() {
    if (!window.db) return;
    var container = document.getElementById('per-grade-cards');
    if (!container) return;
    var gradeKeys = ["0","1","2","3","4","5","6"];
    var updates = {};
    gradeKeys.forEach(function (key) {
        var card = container.querySelector('.per-grade-card[data-grade="' + key + '"]');
        if (!card) return;
        var toggle = card.querySelector('input.per-grade-toggle');
        var maxInput = card.querySelector('input.per-grade-max');
        if (toggle) updates["grades." + key + ".enabled"] = toggle.checked;
        if (maxInput) updates["grades." + key + ".max"] = parseInt(maxInput.value) || 0;
    });
    window.db.collection("settings").doc("registration").set(
        { grades: {} },
        { merge: true }
    ).then(function () {
        return window.db.collection("settings").doc("registration").update(updates);
    }).then(function () {
        _pendingGradeChanges = {};
        showToast('تم حفظ إعدادات الصفوف بنجاح', 'success');
    }).catch(function (err) {
        console.error('[REGISTRATION] Error saving grade settings:', err);
        showToast('خطأ في حفظ الإعداد', 'error');
    });
}

function updatePerGradeCountsDisplay() {
    var container = document.getElementById('per-grade-cards');
    if (!container) return;
    var gradeKeys = ["0","1","2","3","4","5","6"];
    var gradeLabels = ["مرحلة الكي جي والتأسيس","الصف الأول الابتدائي","الصف الثاني الابتدائي","الصف الثالث الابتدائي","الصف الرابع الابتدائي","الصف الخامس الابتدائي","الصف السادس الابتدائي"];
    gradeKeys.forEach(function (key, idx) {
        var count = allSignups ? allSignups.filter(function (s) { return getGradeNameSafe(s.grade) === gradeLabels[idx]; }).length : 0;
        var countEl = container.querySelector('.per-grade-count[data-grade="' + key + '"]');
        if (!countEl) return;
        var card = countEl.closest('.per-grade-card');
        var maxInput = card ? card.querySelector('input.per-grade-max') : null;
        var max = maxInput ? (parseInt(maxInput.value) || 0) : 0;
        countEl.textContent = count;
        // Update max display
        var maxValEl = card ? card.querySelector('.per-grade-stat-value.limit') : null;
        if (maxValEl) maxValEl.textContent = max > 0 ? max : '∞';
        // Update card disabled state
        if (card) {
            if (max > 0 && count >= max) {
                card.classList.add('disabled');
                var toggle = card.querySelector('input.per-grade-toggle');
                if (toggle && toggle.checked) {
                    toggle.checked = false;
                    toggle.dispatchEvent(new Event('change'));
                }
            }
        }
    });
}

function saveRegistrationToggleSetting(enabled) {
    if (!window.db) return;
    window.db.collection("settings").doc("registration").set({ enabled: enabled }, { merge: true }).catch(function (err) {
        console.error('[REGISTRATION] Error saving toggle setting:', err);
        showToast('خطأ في حفظ الإعداد', 'error');
    });
}

// ============================================
// SESSION SETTINGS
// ============================================
function loadSessionSettings() {
    if (!window.db) return;
    window.db.collection("settings").doc("sessionConfig").get().then(function (doc) {
        if (doc.exists) {
            var data = doc.data();
            var cur = data.current || {};
            var prev = data.previous || {};
            var sum = data.summer || {};
            sessionSettings.current = {
                sessionPrice: cur.sessionPrice || 15,
                sessionsPerMonth: cur.sessionsPerMonth || 8,
                discount: cur.discount || 0
            };
            sessionSettings.previous = {
                sessionPrice: prev.sessionPrice || 10,
                sessionsPerMonth: prev.sessionsPerMonth || 4,
                discount: prev.discount || 0
            };
            sessionSettings.summer = {
                sessionPrice: sum.sessionPrice || 20,
                sessionsPerMonth: sum.sessionsPerMonth || 12,
                discount: sum.discount || 0
            };
        }
        settingsLoaded = true;
        // Update settings form fields
        var ids = ['current', 'previous', 'summer'];
        ids.forEach(function (k) {
            var priceInput = document.getElementById('settings-price-' + k);
            var sessionsInput = document.getElementById('settings-sessions-' + k);
            var discountInput = document.getElementById('settings-discount-' + k);
            var totalEl = document.getElementById('settings-monthly-' + k);
            var afterEl = document.getElementById('settings-monthly-after-' + k);
            if (priceInput) priceInput.value = sessionSettings[k].sessionPrice;
            if (sessionsInput) sessionsInput.value = sessionSettings[k].sessionsPerMonth;
            if (discountInput) discountInput.value = sessionSettings[k].discount;
            if (totalEl) totalEl.textContent = sessionSettings[k].sessionPrice * sessionSettings[k].sessionsPerMonth;
            if (afterEl) afterEl.textContent = Math.max(0, (sessionSettings[k].sessionPrice * sessionSettings[k].sessionsPerMonth) - sessionSettings[k].discount);
        });
        // Update payment buttons dynamically
        updatePaymentButtons();
        // Update label in edit modal
        var label = document.getElementById('label-sessions-per-month');
        if (label) label.textContent = sessionSettings.current.sessionsPerMonth;
        console.log('[SETTINGS] Loaded:', sessionSettings);
    }).catch(function (err) {
        console.error('[SETTINGS] Error loading:', err);
        settingsLoaded = true;
    });
}

function saveSessionSettings() {
    if (!window.db) {
        showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }
    var ids = ['current', 'previous', 'summer'];
    var labels = { current: 'العام الحالي', previous: 'العام الماضي', summer: 'الكورس الصيفي' };
    var dataToSave = {};
    for (var i = 0; i < ids.length; i++) {
        var k = ids[i];
        var price = parseInt(document.getElementById('settings-price-' + k).value);
        var sessions = parseInt(document.getElementById('settings-sessions-' + k).value);
        var discountInput = document.getElementById('settings-discount-' + k);
        var discount = discountInput ? (parseInt(discountInput.value) || 0) : 0;
        if (!price || price < 1) { showToast('سعر الحصة لـ ' + labels[k] + ' يجب أن يكون أكبر من 0', 'error'); return; }
        if (!sessions || sessions < 1) { showToast('عدد الحصص لـ ' + labels[k] + ' يجب أن يكون أكبر من 0', 'error'); return; }
        if (discount < 0) { showToast('قيمة الخصم لـ ' + labels[k] + ' يجب أن تكون 0 أو أكبر', 'error'); return; }
        if (discount >= price * sessions) { showToast('قيمة الخصم لـ ' + labels[k] + ' أكبر من الإجمالي الشهري', 'error'); return; }
        sessionSettings[k] = { sessionPrice: price, sessionsPerMonth: sessions, discount: discount };
        dataToSave[k] = { sessionPrice: price, sessionsPerMonth: sessions, discount: discount };
    }
    dataToSave.updatedAt = new Date().toISOString();
    window.db.collection("settings").doc("sessionConfig").set(dataToSave, { merge: true }).then(function () {
        updatePaymentButtons();
        var label = document.getElementById('label-sessions-per-month');
        if (label) label.textContent = sessionSettings.current.sessionsPerMonth;
        showToast('✅ تم حفظ إعدادات الجلسات بنجاح');
    }).catch(function (err) {
        showToast('خطأ في حفظ الإعدادات: ' + err.message, 'error');
    });
}

// ═══════════════════════════════════════════════════
// SOCIAL LINKS SETTINGS (روابط التواصل)
// ═══════════════════════════════════════════════════
function loadSocialLinksSettings() {
    if (!window.db) return;
    window.db.collection('settings').doc('socialLinks').get().then(function (doc) {
        if (!doc.exists) return;
        var s = doc.data();
        var fields = {
            'social-facebook': s.facebook || '',
            'social-youtube': s.youtube || '',
            'social-telegram': s.telegram || '',
            'social-whatsapp': s.whatsapp || '',
            'social-location': s.location || ''
        };
        Object.keys(fields).forEach(function (id) {
            var el = document.getElementById(id);
            if (el) el.value = fields[id];
        });
    }).catch(function (err) {
        console.error('[SOCIAL] load error:', err);
    });
}

function saveSocialLinksSettings() {
    if (!window.db) { showToast('خطأ في الاتصال بقاعدة البيانات', 'error'); return; }
    var data = {
        facebook: (document.getElementById('social-facebook').value || '').trim(),
        youtube: (document.getElementById('social-youtube').value || '').trim(),
        telegram: (document.getElementById('social-telegram').value || '').trim(),
        whatsapp: (document.getElementById('social-whatsapp').value || '').trim(),
        location: (document.getElementById('social-location').value || '').trim(),
        updatedAt: new Date().toISOString()
    };
    window.db.collection('settings').doc('socialLinks').set(data, { merge: true }).then(function () {
        showToast('✅ تم حفظ روابط التواصل بنجاح');
    }).catch(function (err) {
        showToast('خطأ في الحفظ: ' + err.message, 'error');
    });
}

// ═══════════════════════════════════════════════════
// FIREBASE CONFIG SETTINGS (ربط قاعدة البيانات Firestore)
// ═══════════════════════════════════════════════════
function collectFirebaseConfig(prefix) {
    return {
        apiKey: (document.getElementById(prefix + '-apiKey')?.value || '').trim(),
        authDomain: (document.getElementById(prefix + '-authDomain')?.value || '').trim(),
        projectId: (document.getElementById(prefix + '-projectId')?.value || '').trim(),
        storageBucket: (document.getElementById(prefix + '-storageBucket')?.value || '').trim(),
        messagingSenderId: (document.getElementById(prefix + '-messagingSenderId')?.value || '').trim(),
        appId: (document.getElementById(prefix + '-appId')?.value || '').trim()
    };
}

function fillFirebaseConfig(prefix, cfg) {
    if (!cfg) return;
    ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].forEach(function (key) {
        var el = document.getElementById(prefix + '-' + key);
        if (el && cfg[key]) el.value = cfg[key];
    });
}

// حفظ الإعداد في المتصفح + محاولة الحفظ في الخادم (لكي يعمل الموقع لكل الزوار)
function persistFirebaseConfig(cfg) {
    // إرفاق رابط جوجل شيت المحفوظ (إن وُجد) ليبقى مع الإعداد المضمّن في الخادم
    var sheetsLink = (document.getElementById('sheets-link')?.value || '').trim();
    if (sheetsLink) cfg.sheetsLink = sheetsLink;
    else if (cfg && !cfg.sheetsLink && window.ElmistarConfig) {
        var saved = window.ElmistarConfig.get();
        if (saved && saved.sheetsLink) cfg.sheetsLink = saved.sheetsLink;
    }
    var saveToServer = fetch('save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: cfg })
    }).then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
    }).catch(function (err) {
        console.log('[CONFIG] الحفظ في الخادم غير متاح (تشغيل محلي/ثابت) — تم الحفظ في المتصفح فقط:', err && err.message);
    });

    return saveToServer;
}

function saveFirebaseConfig() {
    var data = collectFirebaseConfig('fb');
    if (!data.apiKey || !data.projectId) {
        showToast('يرجى ملء API Key و Project ID على الأقل', 'error');
        return;
    }
    data.updatedAt = new Date().toISOString();
    if (window.ElmistarConfig) window.ElmistarConfig.save(data);

    // مزامنة مع Firestore (للمشروع الحالي) — إن وُجد اتصال
    if (window.db) {
        window.db.collection('settings').doc('firebaseConfig').set(data, { merge: true }).then(function () {
            console.log('[CONFIG] تم حفظ الإعداد في Firestore');
        }).catch(function (err) {
            console.log('[CONFIG] تعذّر الحفظ في Firestore:', err.message);
        });
    }

    persistFirebaseConfig(data).finally(function () {
        showToast('✅ تم حفظ إعدادات قاعدة البيانات. جاري إعادة التحميل...');
        setTimeout(function () { location.reload(); }, 1200);
    });
}

function saveDatabaseSetup() {
    var data = collectFirebaseConfig('setup-fb');
    if (!data.apiKey || !data.projectId) {
        showToast('يرجى ملء API Key و Project ID على الأقل', 'error');
        return;
    }
    data.updatedAt = new Date().toISOString();
    if (window.ElmistarConfig) window.ElmistarConfig.save(data);

    var btn = document.getElementById('setup-fb-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bx bx-loader bx-spin"></i> جاري الربط...'; }

    persistFirebaseConfig(data).finally(function () {
        showToast('✅ تم ربط قاعدة البيانات بنجاح. جاري إعادة التحميل...');
        setTimeout(function () { location.reload(); }, 1200);
    });
}

function testFirebaseConnection(prefix, btn) {
    var data = collectFirebaseConfig(prefix);
    if (!data.apiKey || !data.projectId) {
        showToast('يرجى ملء API Key و Project ID أولاً', 'error');
        return;
    }
    if (!window.firebase) {
        showToast('مكتبة Firebase غير محملة', 'error');
        return;
    }
    if (!window.ElmistarConfig || typeof window.ElmistarConfig.test !== 'function') {
        showToast('أداة اختبار الاتصال غير متاحة', 'error');
        return;
    }
    var oldText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="bx bx-loader bx-spin"></i> جاري الاختبار...';
    window.ElmistarConfig.test(data).then(function () {
        showToast('✅ الاتصال بقاعدة البيانات ناجح');
    }).catch(function (err) {
        showToast('❌ فشل الاتصال: ' + (err && err.message ? err.message : 'خطأ غير معروف'), 'error');
    }).finally(function () {
        btn.disabled = false;
        btn.innerHTML = oldText;
    });
}

function disconnectFirebase() {
    if (!confirm('هل تريد فك ربط قاعدة البيانات وإزالة إعداداتها نهائياً؟')) return;
    if (window.ElmistarConfig) window.ElmistarConfig.clear();
    if (window.db) {
        window.db.collection('settings').doc('firebaseConfig').delete().catch(function () {});
    }
    fetch('save-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: null })
    }).catch(function () {});
    showToast('تم فك ربط قاعدة البيانات. جاري إعادة التحميل...');
    setTimeout(function () { location.reload(); }, 1000);
}

function showDatabaseSetupScreen() {
    var screen = document.getElementById('db-setup-screen');
    if (!screen) return;
    var gate = document.getElementById('password-gate');
    if (gate) gate.style.display = 'none';
    screen.classList.remove('hidden');

    // تعبئة الحقول من الإعداد المحفوظ إن وُجد
    var cfg = window.ElmistarConfig ? window.ElmistarConfig.get() : null;
    if (cfg) fillFirebaseConfig('setup-fb', cfg);

    document.getElementById('setup-fb-save-btn')?.addEventListener('click', saveDatabaseSetup);
    document.getElementById('setup-fb-test-btn')?.addEventListener('click', function () {
        testFirebaseConnection('setup-fb', this);
    });
}

function loadFirebaseConfig() {
    // تعبئة الحقول من الإعداد المحفوظ أولاً
    var cfg = window.ElmistarConfig ? window.ElmistarConfig.get() : null;
    if (cfg) fillFirebaseConfig('fb', cfg);

    if (!window.db) return;
    window.db.collection('settings').doc('firebaseConfig').get().then(function (doc) {
        if (doc.exists) {
            var data = doc.data();
            fillFirebaseConfig('fb', data);
        }
    }).catch(function (err) {
        console.error('[FIREBASE CONFIG] load error:', err);
    });
}

function setupFirebaseConfigEvents() {
    document.getElementById('save-firebase-config-btn')?.addEventListener('click', saveFirebaseConfig);
    document.getElementById('test-firebase-config-btn')?.addEventListener('click', function () {
        testFirebaseConnection('fb', this);
    });
    document.getElementById('disconnect-firebase-btn')?.addEventListener('click', disconnectFirebase);
}

// ═══════════════════════════════════════════════════
// GOOGLE SHEETS SYNC (المزامنة مع جوجل شيت)
// ═══════════════════════════════════════════════════
function loadSheetsSyncSettings() {
    var cfg = window.ElmistarConfig ? window.ElmistarConfig.get() : null;
    var projectId = cfg ? cfg.projectId : '';

    var statusEl = document.getElementById('sheets-sync-status');
    var notLinkedEl = document.getElementById('sheets-sync-notlinked');
    var linkInput = document.getElementById('sheets-link');

    if (!statusEl) return;

    if (!window.db) {
        statusEl.textContent = 'القاعدة غير مربوطة';
        statusEl.className = 'sheets-status-pill off';
        if (notLinkedEl) notLinkedEl.style.display = 'block';
        return;
    }

    statusEl.textContent = 'مرتبطة بـ ' + projectId;
    statusEl.className = 'sheets-status-pill on';

    if (linkInput && cfg && cfg.sheetsLink) linkInput.value = cfg.sheetsLink;

    window.db.collection('settings').doc('firebaseConfig').get().then(function (doc) {
        if (doc.exists) {
            var data = doc.data();
            if (linkInput && data && data.sheetsLink) linkInput.value = data.sheetsLink;
        }
    }).catch(function (err) {
        console.error('[SHEETS] load error:', err);
    });
}

function saveSheetsLink() {
    var link = (document.getElementById('sheets-link')?.value || '').trim();
    if (!link) {
        showToast('أدخل رابط الجدول أولاً', 'error');
        return;
    }
    if (!window.db) {
        showToast('لا يمكن الحفظ قبل ربط قاعدة البيانات', 'error');
        return;
    }
    if (window.ElmistarConfig) {
        var cfg = window.ElmistarConfig.get() || {};
        cfg.sheetsLink = link;
        window.ElmistarConfig.save(cfg);
    }
    window.db.collection('settings').doc('firebaseConfig').set({ sheetsLink: link }, { merge: true }).then(function () {
        showToast('✅ تم حفظ رابط جوجل شيت');
    }).catch(function (err) {
        showToast('خطأ في الحفظ: ' + err.message, 'error');
    });
}

function openGoogleSheets() {
    var link = (document.getElementById('sheets-link')?.value || '').trim();
    if (!link) {
        showToast('لا يوجد رابط جدول محفوظ — الصقه أولاً', 'error');
        return;
    }
    window.open(link, '_blank', 'noopener');
}

function setupSheetsSyncEvents() {
    document.getElementById('save-sheets-link-btn')?.addEventListener('click', saveSheetsLink);
    document.getElementById('open-sheets-btn')?.addEventListener('click', openGoogleSheets);
    loadSheetsSyncSettings();
}

// ═══════════════════════════════════════════════════
// HOME VIEW (الرئيسية)
// ═══════════════════════════════════════════════════
var dayNamesAr = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
var monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function initHomeView() {
    setHomeDate();
    loadHomeStats();
}

function setHomeDate() {
    var now = new Date();
    var dayName = dayNamesAr[now.getDay()];
    var monthName = monthsAr[now.getMonth()];
    var dateStr = 'اليوم: ' + dayName + '، ' + now.getDate() + ' ' + monthName + ' ' + now.getFullYear();
    var el = document.getElementById('home-current-date');
    if (el) el.textContent = dateStr;
    var dayEl = document.getElementById('home-day-name');
    if (dayEl) dayEl.textContent = dayName;
    var labelEl = document.getElementById('home-day-label');
    if (labelEl) labelEl.textContent = dayName;
}

function loadHomeStats() {
    if (!window.db) return;

    var todayDayName = dayNamesAr[new Date().getDay()];

    // Load all groups
    window.db.collection('groups').onSnapshot(function (snap) {
        var allGroups = [];
        var totalGroups = 0;
        var todaySessions = 0;

        snap.forEach(function (doc) {
            var g = doc.data();
            g.id = doc.id;
            if (g.archived) return;
            totalGroups++;

            // Check if this group has a session today
            var groupDay = (g.day || '').trim();
            var groupDays = groupDay.split(/[,،\/]+|\s+و\s+|\s+/).map(function (d) { return d.trim(); }).filter(Boolean);
            var isToday = groupDays.some(function (d) {
                return d === todayDayName || d === todayDayName.replace('ال', '') || todayDayName.indexOf(d) !== -1 || d.indexOf(todayDayName) !== -1;
            });
            if (isToday) todaySessions++;

            allGroups.push({
                id: g.id,
                name: g.name || doc.id,
                day: groupDay,
                time: g.time || '',
                room: g.category || '',
                color: g.color || '',
                whatsapp: g.whatsapp || '',
                isToday: isToday
            });
        });

        animateNumber(document.getElementById('home-stat-groups'), totalGroups);
        animateNumber(document.getElementById('home-stat-today-sessions'), todaySessions);
        renderHomeSessions(allGroups.filter(function (g) { return g.isToday; }));
    }, function (err) {
        console.error('[HOME] groups load error:', err);
    });

    // Load today's attendance count
    var today = new Date().toISOString().slice(0, 10);
    window.db.collection('students')
        .where('academicYear', '==', new Date().getFullYear().toString())
        .onSnapshot(function (snap) {
            var advancedCount = 0;
            snap.forEach(function (doc) {
                var s = doc.data();
                var attendance = s.attendance || [];
                if (Array.isArray(attendance)) {
                    var last = attendance[attendance.length - 1];
                    if (last && last.date === today && last.status === 'present') {
                        advancedCount++;
                    }
                }
            });
            animateNumber(document.getElementById('home-stat-advanced'), advancedCount);
        }, function (err) {
            console.error('[HOME] students load error:', err);
        });
}

function renderHomeSessions(groups) {
    var container = document.getElementById('home-sessions-list');
    var emptyState = document.getElementById('home-empty-sessions');
    var countEl = document.getElementById('home-sessions-count');
    if (!container) return;

    container.querySelectorAll('.group-view-card').forEach(function (c) { c.remove(); });

    if (groups.length === 0) {
        if (emptyState) emptyState.style.display = '';
        if (countEl) countEl.textContent = '0 مجموعات';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    groups.sort(function (a, b) {
        if (a.isToday && !b.isToday) return -1;
        if (!a.isToday && b.isToday) return 1;
        return (a.name || '').localeCompare(b.name || '', 'ar');
    });

    groups.forEach(function (g) {
        var groupStudents = studentsData.filter(function (s) { return s.groupId === g.id; });
        var count = groupStudents.length;
        var card = document.createElement('div');
        card.className = 'group-view-card';
        card.style.borderLeftColor = g.color || '#6366f1';

        var studentsHtml = '';
        if (groupStudents.length > 0) {
            var rows = groupStudents.map(function (s) {
                var levelClass = s.level === 'متميز' ? 'gold' : (s.level === 'محتاج تحسين' ? 'red' : '');
                return '<div class="group-student-row" onclick="StudentPhotoLightbox.open(\'' + (s.profileImage || '') + '\', \'' + (s.name || 'طالب') + '\')">' +
                    '<div class="group-student-avatar" style="background:' + (g.color || '#6366f1') + '20;color:' + (g.color || '#6366f1') + ';overflow:hidden;display:flex;align-items:center;justify-content:center;">' +
                    (s.profileImage
                        ? '<img src="' + s.profileImage + '" style="width:100%;height:100%;object-fit:cover;">'
                        : (s.name || '?').charAt(0)) +
                    '</div>' +
                    '<span class="group-student-name">' + (s.name || '') + '</span>' +
                    (levelClass ? '<span class="group-student-level ' + levelClass + '">' + s.level + '</span>' : '') +
                '</div>';
            }).join('');
            studentsHtml = '<div class="group-view-students-list">' + rows + '</div>';
        } else {
            studentsHtml = '<div class="group-view-students-empty">لا يوجد طالب في هذه المجموعة</div>';
        }

        card.innerHTML = [
            '<div class="group-view-card-body">',
                '<div class="group-view-card-left">',
                    '<div class="group-view-color-badge" style="background:' + (g.color || '#6366f1') + '20;color:' + (g.color || '#6366f1') + ';">',
                        '<i class="bx bx-layer"></i>',
                    '</div>',
                    '<div class="group-view-info">',
                        '<div class="group-view-name">' + (g.name || '') + (g.isToday ? ' <span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:700;">اليوم</span>' : '') + '</div>',
                        '<div class="group-view-meta">',
                            (g.day ? '<span><i class="bx bx-calendar"></i> ' + g.day + '</span>' : ''),
                            (g.time ? '<span><i class="bx bx-time"></i> ' + g.time + '</span>' : ''),
                        '</div>',
                    '</div>',
                '</div>',
                '<div class="group-view-card-right">',
                    '<div class="group-view-students-badge">',
                        '<i class="bx bx-user"></i> ' + count + ' طالب',
                    '</div>',
                    '<div class="group-view-actions">',
                        '<button class="group-view-btn attendance" data-id="' + g.id + '" title="الحضور"><i class="bx bx-calendar-check"></i></button>',
                        (g.whatsapp ? '<a href="' + g.whatsapp + '" target="_blank" class="group-view-btn whatsapp" title="جروب الواتساب"><i class="bx bxl-whatsapp"></i></a>' : ''),
                        '<button class="group-view-btn wa-send" data-id="' + g.id + '" title="إرسال واتساب للمجموعة"><i class="bx bx-message-detail"></i></button>',
                        '<button class="group-view-btn edit" data-id="' + g.id + '" title="تعديل"><i class="bx bx-edit"></i></button>',
                        '<button class="group-view-btn delete" data-id="' + g.id + '" title="حذف"><i class="bx bx-trash"></i></button>',
                    '</div>',
                '</div>',
            '</div>',
            '<div class="group-view-students-toggle" data-group-id="' + g.id + '">',
                '<i class="bx bx-chevron-down"></i> عرض الطلاب',
            '</div>',
            studentsHtml
        ].join('');

        container.appendChild(card);
    });

    if (countEl) countEl.textContent = groups.length + ' مجموعات';

    bindHomeGroupEvents(container, groups);
}

function bindHomeGroupEvents(container, homeGroups) {
    container.querySelectorAll('.group-view-btn.attendance').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = homeGroups.find(function (g) { return g.id === id; });
            if (!group) return;
            setDefaultDate();
            populateAttendanceGroupFilter();
            attendanceGradeFilter.value = 'group:' + id;
            renderAttendanceStudents();
            attendanceModal.classList.remove('hidden');
        });
    });

    container.querySelectorAll('.group-view-btn.edit').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function (g) { return g.id === id; });
            if (group) openGroupFormModal(group);
        });
    });

    container.querySelectorAll('.group-view-btn.delete').forEach(function (btn) {
        btn.addEventListener('click', async function (e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function (g) { return g.id === id; });
            if (!group) return;
            if (confirm('هل أنت متأكد من حذف المجموعة "' + group.name + '"?\nسيتم إزالة المجموعة من جميع الطلاب المرتبطين بها.')) {
                try {
                    var studentsInGroup = studentsData.filter(function (s) { return s.groupId === id; });
                    for (var _s = 0; _s < studentsInGroup.length; _s++) {
                        await SyncService.executeDbOperation('students', 'update', studentsInGroup[_s].id, { groupId: '' });
                    }
                    await SyncService.executeDbOperation('groups', 'delete', id, null);
                    showToast('✅ تم حذف المجموعة');
                } catch (err) {
                    showToast('حدث خطأ أثناء الحذف', 'error');
                }
            }
        });
    });

    container.querySelectorAll('.group-view-btn.wa-send').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
            var id = e.currentTarget.getAttribute('data-id');
            var group = groupsData.find(function (g) { return g.id === id; });
            if (group) openGroupWAModal(group);
        });
    });

    container.querySelectorAll('.group-view-students-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var card = btn.closest('.group-view-card');
            var list = card.querySelector('.group-view-students-list, .group-view-students-empty');
            if (!list) return;
            var isOpen = list.classList.contains('open');
            list.classList.toggle('open');
            btn.classList.toggle('open');
            btn.innerHTML = isOpen ? '<i class="bx bx-chevron-down"></i> عرض الطلاب' : '<i class="bx bx-chevron-up"></i> إخفاء الطلاب';
        });
    });
}

// ═══════════════════════════════════════════════════
// PROFILE SETTINGS (بيانات المعلم الشخصية)
// ═══════════════════════════════════════════════════
function loadProfileSettings() {
    if (!window.db) return;
    window.db.collection('settings').doc('profile').get().then(function (doc) {
        if (!doc.exists) return;
        var p = doc.data();
        var fields = {
            'profile-name-ar': p.teacherNameAr || '',
            'profile-title-ar': p.teacherTitleAr || '',
            'profile-name-en': p.teacherNameEn || '',
            'profile-job-title': p.teacherJobTitle || '',
            'profile-experience': p.teacherExperience || '',
            'profile-specialization': p.teacherSpecialization || '',
            'profile-quote': p.teacherQuote || '',
            'profile-wa-phone': p.teacherWaPhone || '',
            'profile-fb-url': p.teacherFbUrl || '',
            'profile-img-url': p.teacherImage || 'img/logo.png'
        };
        Object.keys(fields).forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            if (id === 'profile-img-url') {
                el.value = fields[id];
                var preview = document.getElementById('profile-img-preview');
                if (preview) preview.src = fields[id];
            } else {
                el.value = fields[id];
            }
        });
    }).catch(function (err) {
        console.error('[PROFILE] load error:', err);
    });
}

function saveProfileSettings() {
    if (!window.db) { showToast('خطأ في الاتصال بقاعدة البيانات', 'error'); return; }
    var data = {
        teacherNameAr: (document.getElementById('profile-name-ar').value || '').trim(),
        teacherTitleAr: (document.getElementById('profile-title-ar').value || '').trim(),
        teacherNameEn: (document.getElementById('profile-name-en').value || '').trim(),
        teacherJobTitle: (document.getElementById('profile-job-title').value || '').trim(),
        teacherExperience: (document.getElementById('profile-experience').value || '').trim(),
        teacherSpecialization: (document.getElementById('profile-specialization').value || '').trim(),
        teacherQuote: (document.getElementById('profile-quote').value || '').trim(),
        teacherWaPhone: (document.getElementById('profile-wa-phone').value || '').trim(),
        teacherFbUrl: (document.getElementById('profile-fb-url').value || '').trim(),
        teacherImage: document.getElementById('profile-img-url').value || 'img/logo.png',
        updatedAt: new Date().toISOString()
    };
    window.db.collection('settings').doc('profile').set(data, { merge: true }).then(function () {
        showToast('✅ تم حفظ بيانات المعلم بنجاح');
    }).catch(function (err) {
        showToast('خطأ في حفظ البيانات: ' + err.message, 'error');
    });
}

function setupProfileImageUpload() {
    var fileInput = document.getElementById('profile-img-file');
    var preview = document.getElementById('profile-img-preview');
    var hiddenInput = document.getElementById('profile-img-url');
    var removeBtn = document.getElementById('profile-img-remove');
    var uploadZone = document.getElementById('profile-img-upload-zone');
    if (!fileInput || !preview || !hiddenInput) return;

    fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('يرجى اختيار صورة فقط', 'error');
            fileInput.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('حجم الصورة يتجاوز 5 ميجا', 'error');
            fileInput.value = '';
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e) {
            var img = new Image();
            img.onload = function () {
                var scale = Math.min(1, 600 / Math.max(img.width, img.height));
                var canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                hiddenInput.value = dataUrl;
                preview.src = dataUrl;
                if (removeBtn) removeBtn.style.display = 'block';
                if (uploadZone) uploadZone.style.borderColor = 'var(--accent)';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });

    if (removeBtn) {
        removeBtn.addEventListener('click', function () {
            hiddenInput.value = 'img/logo.png';
            preview.src = 'img/logo.png';
            removeBtn.style.display = 'none';
            fileInput.value = '';
            if (uploadZone) uploadZone.style.borderColor = '';
        });
    }

    if (uploadZone) {
        uploadZone.addEventListener('dragover', function (e) {
            e.preventDefault();
            uploadZone.style.borderColor = 'var(--accent)';
        });
        uploadZone.addEventListener('dragleave', function () {
            uploadZone.style.borderColor = '';
        });
        uploadZone.addEventListener('drop', function (e) {
            e.preventDefault();
            uploadZone.style.borderColor = '';
            var file = e.dataTransfer.files && e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                fileInput.files = e.dataTransfer.files;
                fileInput.dispatchEvent(new Event('change'));
            }
        });
    }
}

function loadEnrollments() {
    if (!window.db) return;
    window.db.collection("enrollmentRequests").orderBy("createdAt", "desc").onSnapshot((snapshot) => {
        enrollmentsData = [];
        snapshot.forEach((doc) => {
            const req = doc.data();
            req.id = doc.id;
            enrollmentsData.push(req);
        });
        renderEnrollmentsTable();
        updateEnrollmentsBadge();
    }, (error) => {
        console.error('Error loading enrollments:', error);
    });
}

function updateEnrollmentsBadge() {
    const pendingCount = enrollmentsData.filter(r => r.status === 'pending').length;
    const combinedBadge = document.getElementById('combined-enrollments-count');
    if (combinedBadge) {
        combinedBadge.textContent = pendingCount;
    }
}

function getStatusLabel(status) {
    const labels = { pending: 'قيد الانتظار', approved: 'تم القبول', rejected: 'مرفوض', deactivated: 'ملغي' };
    return labels[status] || status;
}

function getStatusColor(status) {
    const colors = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444', deactivated: '#6b7280' };
    return colors[status] || '#6b7280';
}

function renderEnrollmentsTable() {
    const tbody = document.querySelector('#enrollments-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (enrollmentsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state-td"><i class="bx bx-calendar-plus"></i><p>لا توجد طلبات التحاق بعد</p></td></tr>';
        return;
    }

    enrollmentsData.forEach(req => {
        const statusLabel = getStatusLabel(req.status);
        const statusColor = getStatusColor(req.status);
        const dateStr = req.createdAt
            ? (req.createdAt.toDate ? req.createdAt.toDate().toLocaleDateString('ar-EG') : new Date(req.createdAt).toLocaleDateString('ar-EG'))
            : '—';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${req.studentName || 'غير معروف'}</strong>${req.rejectionReason ? '<br><span style="color:var(--red);font-size:11px;display:block;margin-top:4px;">❌ ' + req.rejectionReason + '</span>' : ''}</td>
            <td>${req.studentPhone || '—'}</td>
            <td>${req.studentGrade || '—'}</td>
            <td><span style="background:${statusColor}20;color:${statusColor};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">${statusLabel}</span></td>
            <td style="font-size:13px;color:var(--text-secondary);">${dateStr}</td>
            <td class="action-btns-cell">
                <div class="action-btns-inner">
                    ${req.status === 'pending' ? `
                        <a href="${buildWhatsAppUrl(req.studentPhone, getNewRequestMessage(req))}" target="_blank" class="btn-icon whatsapp-contact-btn" title="تواصل مع ولي الأمر عبر الواتساب" style="color:#25D366;text-decoration:none;"><i class='bx bxl-whatsapp'></i></a>
                        <button class="btn-icon success approve-enroll-btn" data-id="${req.id}" title="قبول الطلب"><i class='bx bx-check'></i></button>
                    ` : ''}
                    ${req.status !== 'rejected' ? `
                        <button class="btn-icon danger reject-enroll-btn" data-id="${req.id}" title="رفض الطلب"><i class='bx bx-x'></i></button>
                    ` : ''}
                    ${req.status === 'approved' ? `
                        <button class="btn-icon secondary deactivate-enroll-btn" data-id="${req.id}" title="إلغاء التفعيل"><i class='bx bx-block'></i></button>
                    ` : ''}
                    <button class="btn-icon danger delete-enroll-btn" data-id="${req.id}" title="حذف الطلب نهائياً"><i class='bx bx-trash'></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach events (delegation on tbody)
    tbody.onclick = function (e) {
        var btn = e.target.closest('.approve-enroll-btn, .reject-enroll-btn, .deactivate-enroll-btn, .delete-enroll-btn');
        if (!btn) return;
        var id = btn.getAttribute('data-id');
        if (btn.classList.contains('approve-enroll-btn')) {
            updateEnrollmentStatus(id, 'approved');
        } else if (btn.classList.contains('reject-enroll-btn')) {
            var req = enrollmentsData.find(function (r) { return r.id === id; });
            openEnrollRejectModal(id, req ? req.studentName : '');
        } else if (btn.classList.contains('deactivate-enroll-btn')) {
            if (confirm('هل أنت متأكد من إلغاء تفعيل هذا الطلب؟')) {
                updateEnrollmentStatus(id, 'deactivated');
            }
        } else if (btn.classList.contains('delete-enroll-btn')) {
            if (confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟ سيتمكن الطالب من تقديم طلب جديد.')) {
                (async function () {
                    try {
                        await SyncService.executeDbOperation('enrollmentRequests', 'delete', id, null);
                        showToast('✅ تم حذف الطلب');
                    } catch (err) {
                        console.error('Enrollment delete error:', err);
                        showToast('حدث خطأ: ' + (err.message || err.code || 'غير معروف'), 'error');
                    }
                })();
            }
        }
    };
}

async function updateEnrollmentStatus(id, status, reason) {
    const data = { status };
    if (reason) data.rejectionReason = reason;
    // Capture studentId before any await to avoid race condition with onSnapshot
    const req = enrollmentsData.find(r => r.id === id);
    const studentId = req ? req.studentId : null;
    const studentGrade = req ? req.studentGrade : null;
    const originalAcademicYear = req ? req.academicYear : null;
    try {
        await SyncService.executeDbOperation('enrollmentRequests', 'update', id, data);
        if (status === 'approved') {
            if (studentId) {
                // Summer students stay in the same grade, only previous year students get promoted
                const isSummerStudent = originalAcademicYear === 'summer';
                const newGrade = isSummerStudent ? studentGrade : getNextGrade(studentGrade);
                await SyncService.executeDbOperation('students', 'update', studentId, { academicYear: 'current', grade: newGrade });
            }
        } else if (status === 'deactivated') {
            if (studentId) {
                await SyncService.executeDbOperation('students', 'update', studentId, { isActivated: false });
            }
        }
        showToast('✅ تم تحديث حالة الطلب');
    } catch (err) {
        console.error('Enrollment update error:', err);
        showToast('حدث خطأ: ' + (err.message || err.code || 'غير معروف'), 'error');
    }
}

function getNextGrade(currentGrade) {
    if (!currentGrade) return 'الصف الأول الابتدائي';
    const g = currentGrade.toString().trim();
    const gradeMap = {
        '0': 'الصف الأول الابتدائي', 'مرحلة الكي جي والتأسيس': 'الصف الأول الابتدائي', 'تأسيس': 'الصف الأول الابتدائي', 'مرحلة التأسيس': 'الصف الأول الابتدائي', 'kg': 'الصف الأول الابتدائي',
        '1': 'الصف الثاني الابتدائي', 'الصف الأول الابتدائي': 'الصف الثاني الابتدائي', 'g1': 'الصف الثاني الابتدائي', 'أول ابتدائي': 'الصف الثاني الابتدائي',
        '2': 'الصف الثالث الابتدائي', 'الصف الثاني الابتدائي': 'الصف الثالث الابتدائي', 'g2': 'الصف الثالث الابتدائي', 'ثاني ابتدائي': 'الصف الثالث الابتدائي',
        '3': 'الصف الرابع الابتدائي', 'الصف الثالث الابتدائي': 'الصف الرابع الابتدائي', 'g3': 'الصف الرابع الابتدائي', 'ثالث ابتدائي': 'الصف الرابع الابتدائي',
        '4': 'الصف الخامس الابتدائي', 'الصف الرابع الابتدائي': 'الصف الخامس الابتدائي', 'g4': 'الصف الخامس الابتدائي', 'رابع ابتدائي': 'الصف الخامس الابتدائي',
        '5': 'الصف السادس الابتدائي', 'الصف الخامس الابتدائي': 'الصف السادس الابتدائي', 'g5': 'الصف السادس الابتدائي', 'خامس ابتدائي': 'الصف السادس الابتدائي',
        '6': 'الصف السادس الابتدائي', 'الصف السادس الابتدائي': 'الصف السادس الابتدائي', 'g6': 'الصف السادس الابتدائي', 'سادس ابتدائي': 'الصف السادس الابتدائي'
    };
    return gradeMap[g] || currentGrade;
}

let pendingRejectEnrollId = null;

function openEnrollRejectModal(id, studentName) {
    pendingRejectEnrollId = id;
    const modal = document.getElementById('enroll-reject-modal');
    const nameEl = document.getElementById('enroll-reject-student-name');
    const reasonEl = document.getElementById('enroll-reject-reason');
    if (nameEl) nameEl.textContent = 'رفض طلب الطالب: ' + (studentName || '');
    if (reasonEl) reasonEl.value = '';
    if (modal) modal.classList.remove('hidden');
}

function initEnrollRejectModal() {
    const modal = document.getElementById('enroll-reject-modal');
    const closeBtn = document.getElementById('close-enroll-reject-modal');
    const cancelBtn = document.getElementById('cancel-enroll-reject-btn');
    const confirmBtn = document.getElementById('confirm-enroll-reject-btn');
    const reasonEl = document.getElementById('enroll-reject-reason');

    if (closeBtn) closeBtn.addEventListener('click', () => modal?.classList.add('hidden'));
    if (cancelBtn) cancelBtn.addEventListener('click', () => modal?.classList.add('hidden'));
    if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const reason = reasonEl?.value?.trim();
            if (!reason) {
                showToast('يرجى إدخال سبب الرفض', 'error');
                return;
            }
            if (pendingRejectEnrollId) {
                await updateEnrollmentStatus(pendingRejectEnrollId, 'rejected', reason);
                pendingRejectEnrollId = null;
                modal?.classList.add('hidden');
            }
        });
    }
}

// ── WhatsApp Message Templates ──
let waTemplates = {
    latePayment: '',
    quick: '',
    reminder: '',
    absence: '',
    newRequest: '',
    registrationAuto: '',
    teacherName: '',
    teacherPhone: ''
};

function loadWhatsAppTemplates() {
    if (!window.db) return;
    window.db.collection('settings').doc('whatsapp_templates').get().then(function(doc) {
        if (doc.exists) {
            const data = doc.data();
            waTemplates.latePayment = data.latePayment || '';
            waTemplates.quick = data.quick || '';
            waTemplates.reminder = data.reminder || '';
            waTemplates.absence = data.absence || '';
            waTemplates.newRequest = data.newRequest || '';
            waTemplates.registrationAuto = data.registrationAuto || '';
            waTemplates.teacherName = data.teacherName || '';
            waTemplates.teacherPhone = data.teacherPhone || '';
        }
        populateTemplateInputs();
    }).catch(function(err) {
        console.error('Error loading WA templates:', err);
    });
}

function populateTemplateInputs() {
    const lateInput = document.getElementById('wa-template-late-payment');
    const quickInput = document.getElementById('wa-template-quick');
    const reminderInput = document.getElementById('wa-template-reminder');
    const absenceInput = document.getElementById('wa-template-absence');
    if (lateInput) lateInput.value = waTemplates.latePayment;
    if (quickInput) quickInput.value = waTemplates.quick;
    if (reminderInput) reminderInput.value = waTemplates.reminder;
    if (absenceInput) absenceInput.value = waTemplates.absence;
    const newRequestInput = document.getElementById('wa-template-new-request');
    if (newRequestInput) newRequestInput.value = waTemplates.newRequest;
    const registrationAutoInput = document.getElementById('wa-template-registration-auto');
    if (registrationAutoInput) registrationAutoInput.value = waTemplates.registrationAuto;
    const teacherNameInput = document.getElementById('wa-template-teacher-name');
    if (teacherNameInput) teacherNameInput.value = waTemplates.teacherName;
    const teacherPhoneInput = document.getElementById('wa-template-teacher-phone');
    if (teacherPhoneInput) teacherPhoneInput.value = waTemplates.teacherPhone;
}

function saveWhatsAppTemplates() {
    const lateInput = document.getElementById('wa-template-late-payment');
    const quickInput = document.getElementById('wa-template-quick');
    const reminderInput = document.getElementById('wa-template-reminder');
    const absenceInput = document.getElementById('wa-template-absence');

    waTemplates.latePayment = lateInput ? lateInput.value.trim() : '';
    waTemplates.quick = quickInput ? quickInput.value.trim() : '';
    waTemplates.reminder = reminderInput ? reminderInput.value.trim() : '';
    waTemplates.absence = absenceInput ? absenceInput.value.trim() : '';
    const newRequestInput = document.getElementById('wa-template-new-request');
    waTemplates.newRequest = newRequestInput ? newRequestInput.value.trim() : '';
    const registrationAutoInput = document.getElementById('wa-template-registration-auto');
    waTemplates.registrationAuto = registrationAutoInput ? registrationAutoInput.value.trim() : '';
    const teacherNameInput = document.getElementById('wa-template-teacher-name');
    waTemplates.teacherName = teacherNameInput ? teacherNameInput.value.trim() : '';
    const teacherPhoneInput = document.getElementById('wa-template-teacher-phone');
    waTemplates.teacherPhone = teacherPhoneInput ? teacherPhoneInput.value.trim() : '';

    if (!window.db) {
        showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }

    window.db.collection('settings').doc('whatsapp_templates').set({
        latePayment: waTemplates.latePayment,
        quick: waTemplates.quick,
        reminder: waTemplates.reminder,
        absence: waTemplates.absence,
        newRequest: waTemplates.newRequest,
        registrationAuto: waTemplates.registrationAuto,
        teacherName: waTemplates.teacherName,
        teacherPhone: waTemplates.teacherPhone,
        updatedAt: new Date().toISOString()
    }, { merge: true }).then(function() {
        showToast('تم حفظ قوالب الرسائل بنجاح', 'success');
    }).catch(function(err) {
        showToast('خطأ في حفظ القوالب: ' + err.message, 'error');
    });
}

function buildWhatsAppUrl(phone, message) {
    let cleanPhone = (phone || '').toString().replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone) return '';
    const encodedMsg = encodeURIComponent(message);
    return `https://wa.me/20${cleanPhone}?text=${encodedMsg}`;
}

function getLatePaymentMessage(student) {
    const attendanceRaw = student.attendance || [];
    const attendanceCount = Array.isArray(attendanceRaw) ? attendanceRaw.length : (parseInt(attendanceRaw) || 0);
    const paid = student.paid || 0;
    var yrPrice = getPriceForYear(student.academicYear);
    const requiredSoFar = (attendanceCount * yrPrice) + (student.otherExpenses || 0);
    const debt = Math.max(0, requiredSoFar - paid);
    const unpaidSessions = Math.ceil(debt / yrPrice);
    const safeGrade = getGradeNameSafe(student.grade);

    if (waTemplates.latePayment) {
        return waTemplates.latePayment
            .replace(/{اسم_الطالب}/g, student.name || '')
            .replace(/{المبلغ_المتبقي}/g, debt + ' ج')
            .replace(/{عدد_الحصص}/g, unpaidSessions)
            .replace(/{الصف}/g, safeGrade);
    }

    return `مرحباً، نود إبلاغكم بأن هناك مبلغ متأخر على الطالب/ة ${student.name || ''} في ${safeGrade}.\nالمبلغ المتبقي: ${debt} ج (${unpaidSessions} حصص).\nيرجى المراجعة والسداد في أقرب وقت.\nشكراً لكم.`;
}

function getQuickMessage(student) {
    const safeGrade = getGradeNameSafe(student.grade);
    if (waTemplates.quick) {
        return waTemplates.quick
            .replace(/{اسم_الطالب}/g, student.name || '')
            .replace(/{الصف}/g, safeGrade)
            .replace(/{رقم_ولي_الأمر}/g, student.phone || '');
    }
    return `مرحباً، هذا رسالة من المعلم بخصوص الطالب/ة ${student.name || ''} في ${safeGrade}.`;
}

function getReminderMessage(student) {
    const safeGrade = getGradeNameSafe(student.grade);
    const day = student.day || '';
    const hour = student.hour || '';
    if (waTemplates.reminder) {
        return waTemplates.reminder
            .replace(/{اسم_الطالب}/g, student.name || '')
            .replace(/{اليوم}/g, day)
            .replace(/{الوقت}/g, hour)
            .replace(/{الصف}/g, safeGrade);
    }
    return `تذكير بالحصة: الطالب/ة ${student.name || ''} في ${safeGrade}\nالموعد: ${day} ${hour}\nنتطلع لحضوركم.`;
}

function getAbsenceMessage(student) {
    const safeGrade = getGradeNameSafe(student.grade);
    const day = student.day || '';
    const hour = student.hour || '';
    const group = student.groupId ? groupsData.find(function(g) { return g.id === student.groupId; }) : null;
    const groupName = group ? group.name : '';
    if (waTemplates.absence) {
        return waTemplates.absence
            .replace(/{اسم_الطالب}/g, student.name || '')
            .replace(/{اليوم}/g, day)
            .replace(/{الوقت}/g, hour)
            .replace(/{الصف}/g, safeGrade)
            .replace(/{المجموعة}/g, groupName);
    }
    return `مرحباً، نود إبلاغكم بأن الطالب/ة ${student.name || ''} لم يحضر اليوم.\nالصف: ${safeGrade}\nالموعد: ${day} ${hour}\nيرجى التواصل معنا لمعرفة السبب.\nشكراً لكم.`;
}

function getNewRequestMessage(req) {
    const safeGrade = getGradeNameSafe(req.studentGrade || req.grade);
    if (waTemplates.newRequest) {
        return waTemplates.newRequest
            .replace(/{اسم_الطالب}/g, req.studentName || req.name || '')
            .replace(/{الصف}/g, safeGrade)
            .replace(/{رقم_الطالب}/g, req.studentPhone || req.phone || '');
    }
    return `مرحباً، تم استلام طلب تسجيل الطالب/ة ${req.studentName || req.name || ''} في ${safeGrade}. يرجى مراجعة الطلب والاتصال بولي الأمر على الرقم: ${req.studentPhone || req.phone || ''}. شكراً لكم.`;
}

// Group-level message templates
function getGroupQuickMessage(group) {
    var count = studentsData.filter(function(s) { return s.groupId === group.id; }).length;
    var day = group.day || '';
    var time = group.time || '';
    return 'مرحباً بكم في مجموعة ' + (group.name || '') + '\nعدد الطلاب: ' + count + '\nالموعد: ' + day + ' ' + time + '\nنتطلع لحضوركم.';
}

function getGroupLatePaymentMessage(group) {
    var studentsInGroup = studentsData.filter(function(s) { return s.groupId === group.id; });
    var count = studentsInGroup.length;
    return 'تذكير بخصوص المدفوعات لمجموعة ' + (group.name || '') + '\nعدد الطلاب: ' + count + '\nيرجى مراجعة المدفوعات والسداد في أقرب وقت.\nشكراً لكم.';
}

function getGroupReminderMessage(group) {
    var day = group.day || '';
    var time = group.time || '';
    return 'تذكير بموعد الحصة\nالمجموعة: ' + (group.name || '') + '\nالموعد: ' + day + ' ' + time + '\nنتطلع لحضوركم.';
}

function getGroupAbsenceMessage(group) {
    var day = group.day || '';
    var time = group.time || '';
    return 'تنبيه: تم تسجيل غياب لأحد الطلاب في مجموعة ' + (group.name || '') + '\nالموعد: ' + day + ' ' + time + '\nيرجى التواصل مع ولي الأمر.';
}

function copyGroupMessage(group, type) {
    var msg = '';
    if (type === 'quick') msg = getGroupQuickMessage(group);
    else if (type === 'late') msg = getGroupLatePaymentMessage(group);
    else if (type === 'reminder') msg = getGroupReminderMessage(group);
    else if (type === 'absence') msg = getGroupAbsenceMessage(group);

    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(function() {
            showToast('تم نسخ الرسالة - الصقها في جروب الواتساب');
        });
    } else {
        var ta = document.createElement('textarea');
        ta.value = msg;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('تم نسخ الرسالة - الصقها في جروب الواتساب');
    }

    if (group.whatsapp) {
        window.open(group.whatsapp, '_blank');
    }
}

let _waSendGroupId = null;
let _waPreparedMessages = [];

function openGroupWAModal(group) {
    _waSendGroupId = group.id;
    _waPreparedMessages = [];
    var modal = document.getElementById('group-wa-modal');
    var nameEl = document.getElementById('group-wa-name');
    var countEl = document.getElementById('group-wa-count');
    var typeSelect = document.getElementById('group-wa-template-type');
    var msgEl = document.getElementById('group-wa-message');
    var progress = document.getElementById('group-wa-progress');
    var compose = document.getElementById('group-wa-compose');
    var list = document.getElementById('group-wa-student-list');

    if (!modal) return;
    var students = studentsData.filter(function(s) { return s.groupId === group.id; });
    if (nameEl) nameEl.textContent = group.name;
    if (countEl) countEl.textContent = students.length + ' طالب';
    if (progress) progress.style.display = 'none';
    if (compose) compose.style.display = 'block';
    if (list) list.style.display = 'none';

    // Set template
    typeSelect.value = 'quick';
    var dummyStudent = { name: '{اسم_الطالب}', grade: '{الصف}', day: group.day || '{اليوم}', hour: group.time || '{الوقت}', phone: '', groupId: group.id, attendance: [], paid: 0, academicYear: 'current', otherExpenses: 0 };
    var msg = getQuickMessage(dummyStudent);
    if (msgEl) msgEl.value = msg;

    modal.classList.remove('hidden');
}

document.getElementById('group-wa-template-type')?.addEventListener('change', function () {
    var group = groupsData.find(function(g) { return g.id === _waSendGroupId; });
    if (!group) return;
    var type = this.value;
    var dummyStudent = { name: '{اسم_الطالب}', grade: '{الصف}', day: group.day || '{اليوم}', hour: group.time || '{الوقت}', phone: '', groupId: group.id, attendance: [], paid: 0, academicYear: 'current', otherExpenses: 0 };
    var msg = '';
    if (type === 'quick') msg = getQuickMessage(dummyStudent);
    else if (type === 'late') msg = getLatePaymentMessage(dummyStudent);
    else if (type === 'reminder') msg = getReminderMessage(dummyStudent);
    else if (type === 'absence') msg = getAbsenceMessage(dummyStudent);
    document.getElementById('group-wa-message').value = msg;
});

document.getElementById('close-group-wa-modal')?.addEventListener('click', function () {
    document.getElementById('group-wa-modal').classList.add('hidden');
});
document.getElementById('cancel-group-wa-btn')?.addEventListener('click', function () {
    document.getElementById('group-wa-modal').classList.add('hidden');
});

document.getElementById('group-wa-generate-btn')?.addEventListener('click', async function () {
    var group = groupsData.find(function(g) { return g.id === _waSendGroupId; });
    if (!group) return;
    var students = studentsData.filter(function(s) { return s.groupId === group.id && s.phone; });
    if (students.length === 0) {
        showToast('لا يوجد طلاب بأرقام هواتف في هذه المجموعة', 'error');
        return;
    }

    var template = document.getElementById('group-wa-message').value;
    if (!template.trim()) {
        showToast('يرجى كتابة نص الرسالة', 'error');
        return;
    }

    var genBtn = document.getElementById('group-wa-generate-btn');
    var progress = document.getElementById('group-wa-progress');
    var progressText = document.getElementById('group-wa-progress-text');
    var progressBar = document.getElementById('group-wa-progress-bar');
    genBtn.disabled = true;
    genBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> جاري التجهيز...';
    progress.style.display = 'block';

    _waPreparedMessages = [];
    var total = students.length;
    for (var i = 0; i < total; i++) {
        var student = students[i];
        var safeGrade = getGradeNameSafe(student.grade);
        var msg = template
            .replace(/{اسم_الطالب}/g, student.name || '')
            .replace(/{الصف}/g, safeGrade)
            .replace(/{اليوم}/g, student.day || group.day || '')
            .replace(/{الوقت}/g, student.hour || group.time || '');
        var url = buildWhatsAppUrl(student.phone, msg);
        if (url) {
            _waPreparedMessages.push({ student: student, message: msg, url: url });
        }
        progressText.textContent = 'جاري التجهيز... (' + (i + 1) + '/' + total + ')';
        progressBar.style.width = ((i + 1) / total * 100) + '%';
        await new Promise(function(r) { setTimeout(r, 50); });
    }

    progressText.textContent = '✅ تم تجهيز ' + _waPreparedMessages.length + ' رسالة';
    progressBar.style.width = '100%';

    // Show student list
    var compose = document.getElementById('group-wa-compose');
    var list = document.getElementById('group-wa-student-list');
    var rows = document.getElementById('group-wa-student-rows');
    if (compose) compose.style.display = 'none';
    if (list) list.style.display = 'block';

    if (rows) {
        rows.innerHTML = '';
        _waPreparedMessages.forEach(function(item, idx) {
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;';
            var avatar = document.createElement('div');
            avatar.style.cssText = 'width:32px;height:32px;border-radius:50%;background:var(--accent-dim);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;';
            avatar.textContent = (item.student.name || '?').charAt(0);
            var info = document.createElement('div');
            info.style.cssText = 'flex:1;min-width:0;';
            var nameSpan = document.createElement('div');
            nameSpan.style.cssText = 'font-weight:700;color:var(--text-primary);font-size:13px;';
            nameSpan.textContent = item.student.name || '';
            var msgPreview = document.createElement('div');
            msgPreview.style.cssText = 'font-size:11px;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            msgPreview.textContent = item.message;
            info.appendChild(nameSpan);
            info.appendChild(msgPreview);
            var sendBtn = document.createElement('a');
            sendBtn.href = item.url;
            sendBtn.target = '_blank';
            sendBtn.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:700;background:#25D366;color:#fff;text-decoration:none;cursor:pointer;flex-shrink:0;transition:opacity .2s;';
            sendBtn.innerHTML = '<i class="bx bxl-whatsapp"></i> إرسال';
            sendBtn.onmouseover = function() { this.style.opacity = '0.85'; };
            sendBtn.onmouseout = function() { this.style.opacity = '1'; };
            row.appendChild(avatar);
            row.appendChild(info);
            row.appendChild(sendBtn);
            rows.appendChild(row);
        });
    }

    genBtn.disabled = false;
    genBtn.innerHTML = '<i class="bx bx-refresh"></i> تجهيز الرسائل';
});

document.getElementById('group-wa-back-btn')?.addEventListener('click', function () {
    var compose = document.getElementById('group-wa-compose');
    var list = document.getElementById('group-wa-student-list');
    var progress = document.getElementById('group-wa-progress');
    if (compose) compose.style.display = 'block';
    if (list) list.style.display = 'none';
    if (progress) progress.style.display = 'none';
});

// Init save button
document.addEventListener('DOMContentLoaded', function() {
    const saveBtn = document.getElementById('save-wa-templates-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveWhatsAppTemplates);
    }

    // Load templates on page load
    loadWhatsAppTemplates();

    // Init collapsible template cards
    document.querySelectorAll('.whatsapp-template-card .template-header').forEach(function(header) {
        header.addEventListener('click', function() {
            var card = header.closest('.whatsapp-template-card');
            if (card) card.classList.toggle('open');
        });
    });

    // Session settings
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSessionSettings);
    }

    // Update monthly total display in settings
    function updateMonthlyTotal() {
        var price = parseInt(document.getElementById('settings-session-price').value) || 15;
        var sessions = parseInt(document.getElementById('settings-sessions-per-month').value) || 8;
        var totalEl = document.getElementById('settings-monthly-total');
        if (totalEl) totalEl.textContent = price * sessions;
    }
    document.getElementById('settings-session-price')?.addEventListener('input', updateMonthlyTotal);
    document.getElementById('settings-sessions-per-month')?.addEventListener('input', updateMonthlyTotal);

    // Live update per-year totals with discount
    ['current', 'previous', 'summer'].forEach(function (k) {
        var priceInput = document.getElementById('settings-price-' + k);
        var sessionsInput = document.getElementById('settings-sessions-' + k);
        var discountInput = document.getElementById('settings-discount-' + k);
        var totalEl = document.getElementById('settings-monthly-' + k);
        var afterEl = document.getElementById('settings-monthly-after-' + k);
        function recalc() {
            var p = parseInt(priceInput.value) || 0;
            var s = parseInt(sessionsInput.value) || 0;
            var d = parseInt(discountInput.value) || 0;
            if (totalEl) totalEl.textContent = p * s;
            if (afterEl) afterEl.textContent = Math.max(0, (p * s) - d);
        }
        if (priceInput) priceInput.addEventListener('input', recalc);
        if (sessionsInput) sessionsInput.addEventListener('input', recalc);
        if (discountInput) discountInput.addEventListener('input', recalc);
    });

    // Profile settings save
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', saveProfileSettings);
    }

    // Social links save
    const saveSocialBtn = document.getElementById('save-social-btn');
    if (saveSocialBtn) {
        saveSocialBtn.addEventListener('click', saveSocialLinksSettings);
    }

    // Export Google Contacts CSV
    const exportBtn = document.getElementById('export-contacts-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportGoogleContactsCSV);
    }
});

const ARABIC_TO_EN = {
    'ا':'a','أ':'a','إ':'e','آ':'a','ب':'b','ت':'t','ث':'th','ج':'g','ح':'h',
    'خ':'kh','د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d',
    'ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m',
    'ن':'n','ه':'h','و':'w','ي':'y','ى':'a','ة':'a','ئ':'a','ء':'a','ؤ':'a',
    'لا':'la',' ': ' '
};

function transliterateArabic(text) {
    if (!text) return '';
    return text.split('').map(ch => ARABIC_TO_EN[ch] || ch).join('').replace(/\s+/g, ' ').trim();
}

function formatPhoneInternational(phone) {
    if (!phone) return '';
    const digits = phone.toString().replace(/\D/g, '');
    if (digits.length === 0) return '';
    const national = digits.startsWith('0') ? digits.slice(1) : digits;
    return national;
}

function capitalizeFirst(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function exportGoogleContactsCSV() {
    if (!studentsData || studentsData.length === 0) {
        showToast('لا يوجد طلاب مدرجين للتصدير', 'error');
        return;
    }

    const activeStudents = studentsData.filter(s => s.phone && s.phone.toString().replace(/\D/g, '').length >= 10);

    if (activeStudents.length === 0) {
        showToast('لا يوجد طلاب بأرقام هواتف صالحة للتصدير', 'error');
        return;
    }

    const BOM = '\uFEFF';
    const rows = [['First Name', 'Mobile Phone']];
    activeStudents.forEach(s => {
        const parts = (s.name || '').split(/\s+/).filter(Boolean);
        const firstTwo = parts.slice(0, 3);
        const enName = transliterateArabic(firstTwo.join(' '));
        const capitalized = enName.split(' ').map(capitalizeFirst).join(' ');
        rows.push([capitalized ? 'St. ' + capitalized : '', formatPhoneInternational(s.phone)]);
    });

    const csv = BOM + rows.map(r => r.join(',')).join('\r\n');
    const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
        window.open(encodedUri, '_blank');
    } else {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'elmistar-contacts.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showToast(`✅ تم تصدير ${activeStudents.length} جهة اتصال بنجاح`);
}

// ============================================
// STUDENT PHOTO LIGHTBOX (عرض وتكبير وحفظ صور الطلاب)
// ============================================
const StudentPhotoLightbox = (function() {
    let currentImgSrc = '';
    let currentStudentName = '';

    function init() {
        const overlay = document.getElementById('student-photo-lightbox');
        const closeBtn = document.getElementById('lightbox-close-btn');
        const closeBtnBottom = document.getElementById('lightbox-close-btn-bottom');
        const downloadBtn = document.getElementById('lightbox-download-btn');
        const lightboxImg = document.getElementById('lightbox-image');

        if (overlay) overlay.style.display = 'none';
        if (closeBtn) closeBtn.addEventListener('click', close);
        if (closeBtnBottom) closeBtnBottom.addEventListener('click', close);
        if (overlay) overlay.addEventListener('click', function(e) {
            if (e.target === overlay) close();
        });
        if (downloadBtn) downloadBtn.addEventListener('click', download);
        if (lightboxImg) {
            lightboxImg.addEventListener('click', function() {
                this.classList.toggle('zoomed');
            });
        }

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && overlay && overlay.style.display !== 'none') {
                close();
            }
        });
    }

    function open(imgSrc, studentName) {
        if (!imgSrc) return;
        currentImgSrc = imgSrc;
        currentStudentName = studentName || 'صورة الطالب';
        const overlay = document.getElementById('student-photo-lightbox');
        const img = document.getElementById('lightbox-image');
        const nameEl = document.getElementById('lightbox-student-name');
        if (img) {
            img.src = imgSrc;
            img.classList.remove('zoomed');
        }
        if (nameEl) nameEl.textContent = currentStudentName;
        if (overlay) {
            overlay.style.display = 'flex';
            requestAnimationFrame(() => overlay.classList.add('show'));
        }
    }

    function close() {
        const overlay = document.getElementById('student-photo-lightbox');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 300);
        }
    }

    function download() {
        if (!currentImgSrc) return;
        const a = document.createElement('a');
        a.href = currentImgSrc;
        a.download = 'student-photo-' + (currentStudentName || 'photo') + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('✅ جاري تحميل الصورة');
    }

    function createAvatarHtml(student, size, extraClass) {
        size = size || 42;
        extraClass = extraClass || '';
        if (student.profileImage) {
            return '<img src="' + student.profileImage + '" ' +
                'class="student-photo-avatar ' + extraClass + '" ' +
                'style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);cursor:pointer;flex-shrink:0;" ' +
                'alt="' + (student.name || 'طالب') + '" ' +
                'data-student-name="' + (student.name || 'طالب') + '" ' +
                'onclick="StudentPhotoLightbox.open(this.src, this.dataset.studentName)">';
        }
        return '<div class="student-avatar-placeholder" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:linear-gradient(135deg,var(--accent,#3b82f6),var(--accent-dark,#1d4ed8));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:' + (size * 0.4) + 'px;flex-shrink:0;">' +
            (student.name || '?')[0] + '</div>';
    }

    return { init, open, close, download, createAvatarHtml };
})();

document.addEventListener('DOMContentLoaded', function() {
    StudentPhotoLightbox.init();
});

