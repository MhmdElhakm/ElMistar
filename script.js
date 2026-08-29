// ============================================
// SCROLL REVEAL (Intersection Observer)
// ============================================
const revealEls = document.querySelectorAll('.reveal');

if (revealEls.length > 0 && typeof IntersectionObserver !== 'undefined') {
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealEls.forEach(el => {
        if (el) revealObserver.observe(el);
    });
}

// Trigger hero reveal on page ready + load announcement
window.addEventListener('load', () => {
    document.querySelectorAll('.hero-merged .reveal').forEach((el, i) => {
        setTimeout(() => el.classList.add('visible'), i * 150);
    });
    if (typeof loadAndShowAnnouncement === 'function') {
        loadAndShowAnnouncement();
    }
});

// ============================================
// NAVBAR: active link + hamburger
// ============================================
const navbar = document.getElementById('navbar');
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
const navLinkEls = document.querySelectorAll('.nav-link');

if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('open');
        hamburger.classList.toggle('open');
    });
}

// ============================================
// MODAL HISTORY MANAGEMENT (BACK BUTTON TO CLOSE)
// ============================================
const ORIGINAL_PAGE_TITLE = "محمد سعيد الحاكم | ElMistar - كورس التأسيس الشامل للغة الإنجليزية";

let sessionSettings = {
    current: { sessionPrice: 15, sessionsPerMonth: 8, discount: 0 },
    previous: { sessionPrice: 10, sessionsPerMonth: 4, discount: 0 },
    summer: { sessionPrice: 20, sessionsPerMonth: 12, discount: 0 }
};

function getPriceForYear(year) {
    var key = year || 'current';
    return (sessionSettings[key] && sessionSettings[key].sessionPrice) || 15;
}

function getSessionsForYear(year) {
    var key = year || 'current';
    return (sessionSettings[key] && sessionSettings[key].sessionsPerMonth) || 8;
}

function getDiscountForYear(year) {
    var key = year || 'current';
    return (sessionSettings[key] && sessionSettings[key].discount) || 0;
}

function getMonthlyTotalForYear(year) {
    return getPriceForYear(year) * getSessionsForYear(year);
}

function getMonthlyAfterDiscountForYear(year) {
    return Math.max(0, getMonthlyTotalForYear(year) - getDiscountForYear(year));
}

const MODAL_SEO_TITLES = {
    'authOverlay': "بوابة الطلاب والاشتراك | ElMistar",
    'pronouncer-modal': "الناطق الفوري وتقييم النطق بالذكاء الاصطناعي | ElMistar",
    'qr-modal': "قارئ الـ QR كود للمناهج التفاعلية | ElMistar",
    'payment-modal': "نظام الدفع والتحقق الذكي | ElMistar",
    'about-us-modal': "من هو المستر محمد سعيد الحاكم؟ | ElMistar",
    'contact-us-modal': "تواصل مع المستر محمد سعيد الحاكم | ElMistar",
    'privacy-policy-modal': "سياسة الخصوصية وحماية بيانات الطلاب | ElMistar",
    'terms-modal': "الشروط والأحكام والالتزام بالحصص | ElMistar",
    'short-vowels-modal': "كورس دمج الحروف والكلمات Short Vowels | ElMistar",
    'curriculum-modal': "المنهج التعليمي - تأسيس اللغة الإنجليزية | ElMistar"
};

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // Add a state to history
    history.pushState({ modalId: modalId }, '', '#' + modalId);
    
    // Set dynamic page title
    if (MODAL_SEO_TITLES[modalId]) {
        document.title = MODAL_SEO_TITLES[modalId];
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Restore original title
    document.title = ORIGINAL_PAGE_TITLE;
    
    // If we're at the modal's hash, go back
    if (window.location.hash === '#' + modalId) {
        history.back();
    }
}

// Flag to prevent popstate from closing modals during programmatic transitions
window._skipModalPopstate = false;

window.addEventListener('popstate', (e) => {
    if (window._skipModalPopstate) {
        window._skipModalPopstate = false;
        return;
    }
    const activeModals = document.querySelectorAll('.modal-overlay.active, .auth-overlay.active');
    activeModals.forEach(m => {
        m.classList.remove('active');
        document.body.style.overflow = '';
    });
}, { passive: true });

// ============================================
// GLOBAL CLICK SOUND EFFECTS
// ============================================
function _playClickTone() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(700, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(500, ctx.currentTime + 0.06);
        gain.gain.setValueAtTime(0.07, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { }
}

document.addEventListener('click', (e) => {
    const el = e.target.closest('button, .btn, .nav-btn-link, .page-dot, .audio-guide-btn, .play-sound-btn');
    if (el && !el.classList.contains('no-click-sound')) {
        _playClickTone();
    }
}, { passive: true });


navLinkEls.forEach(link => {
    link.addEventListener('click', () => {
        if (navLinks) navLinks.classList.remove('open');
        if (hamburger) hamburger.classList.remove('open');
    });
});

const sections = document.querySelectorAll('section[id]');
// Active link on scroll using IntersectionObserver (more performant than scroll listener)
const navObserverOptions = {
    threshold: 0.6,
    rootMargin: '0px'
};

let currentSectionId = 'home';
if (sections.length > 0 && typeof IntersectionObserver !== 'undefined') {
    const navObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const id = entry.target.getAttribute('id');
                currentSectionId = id;
                // Update main nav links
                navLinkEls.forEach(link => {
                    link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                });
                // Update side dots and page counter
                updateSideNav(id);
            }
        });
    }, navObserverOptions);

    sections.forEach(section => navObserver.observe(section));
}

function updateSideNav(id) {
    const dots = document.querySelectorAll('.page-dot');
    const pageCounter = document.getElementById('currentPageNum');
    const sectionIds = ['home', 'my-portfolio']; // Fixed order for counter

    const index = sectionIds.indexOf(id);
    if (index !== -1) {
        dots.forEach((dot, i) => {
            dot.classList.toggle('active', dot.getAttribute('data-target') === id);
        });
        if (pageCounter) pageCounter.textContent = index + 1;
    }
}





// ============================================
// SMOOTH SCROLL for all anchor links
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') {
            e.preventDefault();
            return;
        }
        try {
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                const offset = 80;
                const top = target.getBoundingClientRect().top + window.scrollY - offset;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        } catch (err) {
            // Ignore invalid selectors
        }
    });
});


// ============================================
// AUTH SYSTEM: LOGIN / SIGNUP WITH SHEETDB
// ============================================
// SheetDB Removed - Migrated to Firebase
// const SHEETDB_REG_URL = "...";
// const SHEETDB_LOGIN_URL = "...";

// Helper to normalize phone (remove leading zero for consistency with sheet data)
function normalizePhone(phone) {
    if (!phone) return "";
    // Remove all non-numeric characters
    let p = phone.toString().replace(/\D/g, '');
    // Ensure it starts with 0 (Egyptian style)
    if (p.length > 0 && !p.startsWith('0')) p = '0' + p;
    return p;
}

// Return phone variants (with/without leading zero) to match both
// stored formats — legacy data was saved without the leading zero.
function getPhoneVariants(phone) {
    const cleaned = (phone || '').toString().replace(/\D/g, '');
    if (!cleaned) return [];
    const noZero = cleaned.replace(/^0+/, '');
    const withZero = '0' + noZero;
    return withZero === noZero ? [withZero] : [withZero, noZero];
}

// Query a collection by a phone field matching either stored format (with/without leading zero)
async function getSnapshotByPhoneField(collectionName, field, phone) {
    const variants = getPhoneVariants(phone);
    if (variants.length === 0) return null;
    if (variants.length === 1) {
        return window.db.collection(collectionName).where(field, '==', variants[0]).get();
    }
    return window.db.collection(collectionName).where(field, 'in', variants).get();
}

// Query a collection by phone matching either stored format (with/without leading zero)
async function getSnapshotByPhone(collectionName, phone) {
    return getSnapshotByPhoneField(collectionName, 'phone', phone);
}


// ============================================
// PROFESSIONAL NOTIFICATION SYSTEM (TOAST)
// ============================================
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = '🔔';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
        <span class="toast-icon">${icon}</span>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('removing');
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 4000);
}

function showConfirm(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-msg');
    const yesBtn = document.getElementById('confirm-yes');
    const noBtn = document.getElementById('confirm-no');

    if (!modal || !msgEl || !yesBtn || !noBtn) return;

    msgEl.innerText = message;
    openModal('confirm-modal');

    // Clear previous listeners by cloning
    const newYes = yesBtn.cloneNode(true);
    const newNo = noBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYes, yesBtn);
    noBtn.parentNode.replaceChild(newNo, noBtn);

    newYes.addEventListener('click', () => {
        // Close confirm modal directly (without history.back triggering popstate)
        modal.classList.remove('active');
        document.body.style.overflow = '';
        document.title = ORIGINAL_PAGE_TITLE;
        if (window.location.hash === '#confirm-modal') {
            window._skipModalPopstate = true;
            history.back();
        }
        // Open next modal after short delay
        setTimeout(() => {
            if (onConfirm) onConfirm();
        }, 100);
    });

    newNo.addEventListener('click', () => {
        closeModal('confirm-modal');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal('confirm-modal');
    });
}

// ============================================
// PROFESSIONAL LOGOUT CONFIRMATION (Blue + Sad Cartoon)
// ============================================
function showLogoutConfirm() {
    const modal = document.getElementById('logout-modal');
    if (!modal) return;
    openModal('logout-modal');
}

(function initLogoutModal() {
    const modal = document.getElementById('logout-modal');
    if (!modal) return;

    const yesBtn = modal.querySelector('#logout-confirm-yes');
    const noBtn = modal.querySelector('#logout-confirm-no');

    if (yesBtn) {
        yesBtn.addEventListener('click', () => {
            closeModal('logout-modal');
            setTimeout(() => {
                localStorage.removeItem('el_mistar_current_user');
                window.location.reload();
            }, 150);
        });
    }
    if (noBtn) {
        noBtn.addEventListener('click', () => {
            closeModal('logout-modal');
        });
    }
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal('logout-modal');
    });
})();

// Auth modal elements — IDs match index.html
const authOverlay = document.getElementById('authOverlay');
const authSection = authOverlay; // alias used by older code paths
const loginBtnNav = document.getElementById('loginBtnNav');
const userProfileNav = document.getElementById('userProfileNav');
const closeAuth = document.getElementById('closeAuth');

// Tab elements
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const loginBlock = document.getElementById('loginBlock');
const signupBlock = document.getElementById('signupBlock');

// Lesson modal elements
const lessonModalTitle = document.getElementById('lesson-modal-title');
const lessonModalStory = document.getElementById('lesson-modal-story');
const lessonModalMovement = document.getElementById('lesson-modal-action') || document.getElementById('lesson-modal-movement');
const lessonModalPlay = document.getElementById('lesson-view-play');

// Tab logic updated for new IDs
const authTabs = document.querySelectorAll('.auth-tab');
const authTabContents = document.querySelectorAll('.auth-tab-content');

// Open/Close Auth Section
const authTriggers = document.querySelectorAll('.auth-trigger');
authTriggers.forEach(btn => {
    btn.addEventListener('click', () => {
        openModal('authOverlay');
    });
});

if (closeAuth) {
    closeAuth.addEventListener('click', () => {
        closeModal('authOverlay');
    });
}

// Close auth overlay when clicking outside modal
if (authOverlay) {
    authOverlay.addEventListener('click', (e) => {
        if (e.target === authOverlay) {
            closeModal('authOverlay');
        }
    });
}

// Tab Switching
if (tabLogin) {
    tabLogin.addEventListener('click', () => {
        tabLogin.classList.add('active');
        if (tabSignup) tabSignup.classList.remove('active');
        if (loginBlock) loginBlock.classList.add('active');
        if (signupBlock) signupBlock.classList.remove('active');
        // Clear any previous errors
        const loginError = document.getElementById('loginError');
        if (loginError) loginError.classList.add('hidden');
    });
}

if (tabSignup) {
    tabSignup.addEventListener('click', () => {
        tabSignup.classList.add('active');
        if (tabLogin) tabLogin.classList.remove('active');
        if (signupBlock) signupBlock.classList.add('active');
        if (loginBlock) loginBlock.classList.remove('active');
    });
}

// AUTH LOGIC (SHEETDB)
const actualSignupForm = document.getElementById('actualSignupForm');
const actualLoginForm = document.getElementById('actualLoginForm');

const loginGradeSelect = document.getElementById('loginGrade');
const loginPhoneInput = document.getElementById('loginPhone');
const loginStudentsContainer = document.getElementById('loginStudentsContainer');
const loginStudentsList = document.getElementById('loginStudentsList');
const loginSelectedBtn = document.getElementById('loginSelectedBtn');

let _loginFetchTimeout = null;
let _loginSelectedDoc = null;
let _loginSelectedData = null;

const _gradeNumberToName = {
    "0": "مرحلة الكي جي والتأسيس",
    "1": "الصف الأول الابتدائي",
    "2": "الصف الثاني الابتدائي",
    "3": "الصف الثالث الابتدائي",
    "4": "الصف الرابع الابتدائي",
    "5": "الصف الخامس الابتدائي",
    "6": "الصف السادس الابتدائي"
};

function _resolveGradeName(grade) {
    if (!grade) return '';
    return _gradeNumberToName[grade.toString().trim()] || grade;
}

function validateLoginPhone(rawPhone) {
    const digits = (rawPhone || '').replace(/\D/g, '');
    if (digits.length === 0) return { valid: false, msg: '' };
    if (!digits.startsWith('0')) return { valid: false, msg: 'يجب أن يبدأ الرقم بالصفر' };
    if (digits.length < 11) return { valid: false, msg: 'الرقم يجب أن يكون 11 رقم (متبقي ' + (11 - digits.length) + ')' };
    if (digits.length > 11) return { valid: false, msg: 'الرقم يجب أن يكون 11 رقم فقط' };
    return { valid: true, phone: digits };
}

async function fetchAndShowLoginStudents(phone) {
    if (!window.db || !loginStudentsList || !loginStudentsContainer) return;

    loginStudentsList.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-muted);"><i class="bx bx-loader-alt bx-spin" style="font-size:1.4rem;"></i><br>جاري البحث...</div>';
    loginStudentsContainer.style.display = 'block';

    const loginError = document.getElementById('loginError');
    if (loginError) { loginError.classList.add('hidden'); loginError.innerHTML = ''; }

    try {
        const snapshot = await getSnapshotByPhone("students", phone);
        if (!snapshot || snapshot.empty) {
            loginStudentsList.innerHTML = '';
            loginStudentsContainer.style.display = 'none';
            if (loginError) {
                loginError.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;width:100%;">
                        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#FEE2E2,#FECACA);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(239,68,68,.2);">
                            <i class='bx bx-user-x' style='font-size:1.6rem;color:#DC2626;'></i>
                        </div>
                        <div>
                            <p style="margin:0 0 4px;font-size:1rem;font-weight:800;color:#991B1B;">لا توجد بيانات مسجلة</p>
                            <p style="margin:0;font-size:0.82rem;color:#B91C1C;font-weight:600;">لا نجد حساباً مرتبطاً بهذا الرقم</p>
                        </div>
                    </div>
                `;
                loginError.classList.remove('hidden');
            }
            return;
        }

        loginStudentsList.innerHTML = '';
        _loginSelectedDoc = null;
        _loginSelectedData = null;
        snapshot.docs.forEach(doc => {
            const data = doc.data();
            const card = document.createElement('div');
            card.className = 'login-student-card';
            card.dataset.docId = doc.id;
            card.style.cssText = 'display:flex;align-items:center;gap:12px;padding:12px 16px;border:2px solid var(--border,#e2e8f0);border-radius:12px;cursor:pointer;transition:all 0.2s;background:var(--card-bg,#fff);';
            card.innerHTML = `
                <div style="width:42px;height:42px;border-radius:50%;flex-shrink:0;overflow:hidden;border:2px solid var(--accent,#3b82f6);">
                    ${data.profileImage
                        ? '<img src="' + data.profileImage + '" style="width:100%;height:100%;object-fit:cover;">'
                        : '<div style="width:100%;height:100%;background:linear-gradient(135deg,var(--accent,#3b82f6),var(--accent-dark,#1d4ed8));display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;">' + (data.name || '?')[0] + '</div>'
                    }
                </div>
                <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:0.95rem;color:var(--text,#1e293b);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${data.name}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted,#64748b);margin-top:2px;">${_resolveGradeName(data.grade)}</div>
                </div>
                <i class='bx bx-check-circle' style="font-size:1.2rem;color:var(--text-muted,#94a3b8);flex-shrink:0;"></i>
            `;
            card.addEventListener('mouseenter', () => { card.style.borderColor = 'var(--accent,#3b82f6)'; card.style.transform = 'translateX(-4px)'; });
            card.addEventListener('mouseleave', () => { if (card.dataset.selected !== 'true') { card.style.borderColor = 'var(--border,#e2e8f0)'; card.style.transform = 'none'; } });
            card.addEventListener('click', () => selectLoginStudent(card, doc, data));
            loginStudentsList.appendChild(card);
        });
    } catch (err) {
        console.error("Error loading students:", err);
        loginStudentsList.innerHTML = '<div style="text-align:center;padding:12px;color:#ef4444;">حدث خطأ أثناء البحث. حاول مرة أخرى.</div>';
    }
}

async function loginAsStudent() {
    if (!_loginSelectedDoc || !_loginSelectedData) {
        showToast('يرجى اختيار اسم الطالب أولاً', 'info');
        return;
    }

    const loginError = document.getElementById('loginError');
    if (loginError) { loginError.classList.add('hidden'); loginError.innerHTML = ''; }

    const userData = _loginSelectedData;
    userData.id = _loginSelectedDoc.id;

    playDashSound('login');
    setLoggedIn(userData);
    authOverlay.classList.remove('active');
    if (actualLoginForm) actualLoginForm.reset();
    loginStudentsContainer.style.display = 'none';
    showToast(`مرحباً بك ${userData.name.split(' ')[0]}! 🎉`, 'success');
    triggerCelebration();
    setTimeout(function () { location.reload(); }, 800);
}

function selectLoginStudent(card, doc, data) {
    // Deselect all cards
    loginStudentsList.querySelectorAll('.login-student-card').forEach(c => {
        c.dataset.selected = 'false';
        c.style.borderColor = 'var(--border,#e2e8f0)';
        c.style.background = 'var(--card-bg,#fff)';
        var icon = c.querySelector('i.bx-check-circle');
        if (icon) { icon.style.color = 'var(--text-muted,#94a3b8)'; }
    });

    // Select this card
    card.dataset.selected = 'true';
    card.style.borderColor = 'var(--accent,#3b82f6)';
    card.style.background = 'var(--accent-dim,rgba(59,130,246,0.05))';
    var icon = card.querySelector('i.bx-check-circle');
    if (icon) { icon.style.color = 'var(--accent,#3b82f6)'; }

    // Store selection
    _loginSelectedDoc = doc;
    _loginSelectedData = data;
}

if (loginPhoneInput) {
    loginPhoneInput.addEventListener('input', function () {
        clearTimeout(_loginFetchTimeout);
        const rawPhone = this.value.trim();
        const validation = validateLoginPhone(rawPhone);

        const loginError = document.getElementById('loginError');
        if (loginError) { loginError.classList.add('hidden'); loginError.innerHTML = ''; }

        if (!rawPhone) {
            _loginSelectedDoc = null;
            _loginSelectedData = null;
            if (loginStudentsContainer) loginStudentsContainer.style.display = 'none';
            return;
        }

        if (!validation.valid && rawPhone.length >= 2) {
            if (loginError) {
                loginError.innerHTML = `<i class='bx bx-error-circle' style='font-size:1.3rem;'></i><span>${validation.msg}</span>`;
                loginError.classList.remove('hidden');
            }
            if (loginStudentsContainer) loginStudentsContainer.style.display = 'none';
            return;
        }

        if (validation.valid) {
            _loginFetchTimeout = setTimeout(() => fetchAndShowLoginStudents(validation.phone), 300);
        }
    });
}

if (loginSelectedBtn) {
    loginSelectedBtn.addEventListener('click', loginAsStudent);
}

const signupGradeSelect = document.getElementById('signupGrade');
if (signupGradeSelect) {
    signupGradeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        const nameLabel = document.getElementById('signupNameLabel');
        const notesBox = document.getElementById('studentNotesBox');
        const termsGroup = document.getElementById('studentTermsGroup');
        const agreeTerms = document.getElementById('agreeTerms');
        const profileUpload = document.querySelector('.form-group:has(#signupProfileImage)');
        
        if (val === 'teacher') {
            if (nameLabel) nameLabel.innerHTML = 'الاسم الكامل للمعلم <span class="required">*</span>';
            if (notesBox) notesBox.style.display = 'none';
            if (termsGroup) termsGroup.style.display = 'none';
            if (agreeTerms) agreeTerms.required = false;
            if (profileUpload) profileUpload.style.display = 'none';
        } else {
            if (nameLabel) nameLabel.innerHTML = 'الاسم الكامل للطالب <span class="required">*</span>';
            if (notesBox) notesBox.style.display = 'block';
            if (termsGroup) termsGroup.style.display = 'flex';
            if (agreeTerms) agreeTerms.required = true;
            if (profileUpload) profileUpload.style.display = '';
        }
    });
}

const signupPhoneInput = document.getElementById('signupPhone');
const existingStudentsBox = document.getElementById('existingStudentsBox');
const existingStudentsList = document.getElementById('existingStudentsList');

if (signupPhoneInput) {
    let checkTimeout;
    signupPhoneInput.addEventListener('input', function () {
        clearTimeout(checkTimeout);
        checkTimeout = setTimeout(async () => {
            const rawPhone = this.value.trim();
            const phone = normalizePhone(rawPhone);
            if (!phone || phone.length < 10) {
                if (existingStudentsBox) existingStudentsBox.style.display = 'none';
                return;
            }
            try {
                if (!window.db) return;
                const snapshot = await getSnapshotByPhone("students", phone);
                if (!snapshot) return;

                if (!snapshot.empty && existingStudentsBox && existingStudentsList) {
                    existingStudentsList.innerHTML = '';
                    snapshot.docs.forEach(doc => {
                        const data = doc.data();
                        const li = document.createElement('li');
                        const gradeName = _resolveGradeName(data.grade) || 'غير محدد';
                        li.innerHTML = `<span>${data.name}</span><span class="student-grade-tag">${gradeName}</span>`;
                        existingStudentsList.appendChild(li);
                    });
                    existingStudentsBox.style.display = 'block';
                } else {
                    if (existingStudentsBox) existingStudentsBox.style.display = 'none';
                }
            } catch (err) {
                console.error("Error checking existing students:", err);
            }
        }, 400);
    });
}

var _registrationUnsub = null;
var _registrationGrades = null;
var _registrationEnabled = true;
var _registrationEnrollOpen = true;

var _gradeValueTextMap = {
    "0": "مرحلة الكي جي والتأسيس",
    "1": "الصف الأول الابتدائي",
    "2": "الصف الثاني الابتدائي",
    "3": "الصف الثالث الابتدائي",
    "4": "الصف الرابع الابتدائي",
    "5": "الصف الخامس الابتدائي",
    "6": "الصف السادس الابتدائي"
};

function _applyGradeFilter(grades) {
    var sel = document.getElementById('signupGrade');
    if (!sel) return;
    for (var i = 0; i < sel.options.length; i++) {
        var opt = sel.options[i];
        if (!opt.value) continue;
        if (opt.value === 'teacher') continue;
        var gs = (grades && grades[opt.value]) || {};
        var enabled = gs.enabled !== false;
        opt.disabled = !enabled;
        if (!enabled) opt.style.display = 'none';
        else opt.style.display = '';
    }
    if (sel.selectedIndex > 0 && sel.options[sel.selectedIndex].disabled) {
        sel.value = '';
    }
}

function _applyRegistrationState(enabled, grades) {
    _registrationEnabled = enabled !== false;
    var btn = document.getElementById('signup-submit-btn');
    var heroBtn = document.getElementById('signupBtnHero');
    var inquiryHeroBtn = document.getElementById('inquiryBtnHero');
    var inputs = actualSignupForm ? actualSignupForm.querySelectorAll('input, select, button') : [];
    var newYear = _registrationEnrollOpen;
    if (enabled) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = newYear ? 'سجّل الآن للعام الدراسي الجديد 🎓' : 'سجّل الآن 🚀';
            btn.classList.toggle('btn-signup-newyear', newYear);
            btn.classList.remove('btn-signup-closed');
        }
        if (heroBtn) {
            heroBtn.disabled = false;
            heroBtn.textContent = newYear ? 'سجّل الآن للعام الدراسي الجديد' : 'سجّل الآن';
            heroBtn.classList.toggle('btn-signup-newyear', newYear);
            heroBtn.classList.remove('btn-signup-closed');
        }
        if (inquiryHeroBtn) inquiryHeroBtn.style.display = 'none';
        inputs.forEach(function (el) { if (el !== btn) el.disabled = false; });
        _applyGradeFilter(grades);
    } else {
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'التسجيل للعام الجديد مغلق';
            btn.classList.remove('btn-signup-newyear');
            btn.classList.add('btn-signup-closed');
        }
        if (heroBtn) {
            heroBtn.disabled = true;
            heroBtn.textContent = 'التسجيل للعام الجديد مغلق';
            heroBtn.classList.remove('btn-signup-newyear');
            heroBtn.classList.add('btn-signup-closed');
        }
        if (inquiryHeroBtn) {
            inquiryHeroBtn.style.display = '';
            inquiryHeroBtn.onclick = function () { openModal('authOverlay'); };
        }
        inputs.forEach(function (el) { if (el !== btn) el.disabled = true; });
    }
}

function _setupRegistrationListener() {
    if (!window.db || _registrationUnsub) return;
    function applyRegistration(doc) {
        var enabled = !(doc.exists && doc.data().enabled === false);
        var grades = doc.exists ? (doc.data().grades || null) : null;
        _registrationGrades = grades;
        _applyRegistrationState(enabled, grades);
    }
    function applyEnrollment(doc) {
        _registrationEnrollOpen = !(doc.exists && doc.data().enabled === false);
        _applyRegistrationState(_registrationEnabled, _registrationGrades);
    }
    // Initial fetch + real-time listener for registration
    window.db.collection("settings").doc("registration").get().then(applyRegistration).catch(function () {});
    _registrationUnsub = window.db.collection("settings").doc("registration").onSnapshot(applyRegistration, function () {});
    // Initial fetch + real-time listener for new academic year enrollment
    window.db.collection("settings").doc("enrollment").get().then(applyEnrollment).catch(function () {});
    window.db.collection("settings").doc("enrollment").onSnapshot(applyEnrollment, function () {});
}

function closeAuthModalWithAnimation() {
    if (!authOverlay || !authOverlay.classList.contains('active')) return;
    const modal = authOverlay.querySelector('.auth-modal');
    if (modal) modal.classList.add('auth-modal-closing');
    authOverlay.classList.add('auth-modal-closing-backdrop');
    setMascotExpression('wave', 'مع السلامة! 👋');
    setTimeout(function () {
        closeModal('authOverlay');
        if (modal) modal.classList.remove('auth-modal-closing');
        authOverlay.classList.remove('auth-modal-closing-backdrop');
        resetMascot();
        var celebration = document.getElementById('registration-success-overlay');
        if (celebration && celebration.classList.contains('active')) {
            document.body.style.overflow = 'hidden';
        }
    }, 500);
}

// ═══════════════════════════════════════════════
// DOODLE MASCOT INTERACTIONS
// ═══════════════════════════════════════════════
var mascotEl = null;
var mascotSpeechEl = null;
var mascotResetTimer = null;

function initMascot() {
    mascotEl = document.getElementById('doodleMascot');
    mascotSpeechEl = document.getElementById('mascotSpeech');
    if (!mascotEl) return;
    var svg = mascotEl.querySelector('.mascot-svg');
    if (!svg) return;

    // Eyes follow mouse
    document.addEventListener('mousemove', function(e) {
        var eyeL = svg.querySelector('.mascot-eye-left');
        var eyeR = svg.querySelector('.mascot-eye-right');
        if (!eyeL || !eyeR) return;
        var rect = svg.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height * 0.52;
        var dx = (e.clientX - cx) / window.innerWidth * 2.5;
        var dy = (e.clientY - cy) / window.innerHeight * 2;
        dx = Math.max(-1.5, Math.min(1.5, dx));
        dy = Math.max(-1, Math.min(1, dy));
        eyeL.setAttribute('cx', 45 + dx);
        eyeL.setAttribute('cy', 73 + dy);
        eyeR.setAttribute('cx', 75 + dx);
        eyeR.setAttribute('cy', 73 + dy);
    });

    // Greet on open
    if (authOverlay) {
        var obs = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.attributeName === 'class' && authOverlay.classList.contains('active')) {
                    setMascotExpression('happy', 'مرحباً! 👋');
                }
            });
        });
        obs.observe(authOverlay, { attributes: true });
    }
}

function setMascotExpression(cls, speech) {
    if (!mascotEl) return;
    var svg = mascotEl.querySelector('.mascot-svg');
    if (!svg) return;
    svg.classList.remove('happy', 'excited', 'worried', 'focused', 'wave');
    if (cls) svg.classList.add(cls);
    if (mascotSpeechEl && speech) mascotSpeechEl.textContent = speech;
    clearTimeout(mascotResetTimer);
    mascotResetTimer = setTimeout(resetMascot, 3000);
}

function resetMascot() {
    if (!mascotEl) return;
    var svg = mascotEl.querySelector('.mascot-svg');
    if (!svg) return;
    svg.classList.remove('happy', 'excited', 'worried', 'focused', 'wave');
    if (mascotSpeechEl) mascotSpeechEl.textContent = 'مرحباً! 👋';
}

// Attach mascot events to auth form fields
function setupMascotEvents() {
    // Login phone focus
    var loginPhone = document.getElementById('loginPhone');
    if (loginPhone) {
        loginPhone.addEventListener('focus', function() {
            setMascotExpression('focused', 'أكتب رقمك... 📱');
        });
        loginPhone.addEventListener('input', function() {
            if (this.value.length === 11) {
                setMascotExpression('happy', 'ممتاز! ✓');
            } else if (this.value.length > 0) {
                setMascotExpression('focused', '...كم باقي');
            }
        });
    }

    // Signup name focus
    var signupName = document.getElementById('signupName');
    if (signupName) {
        signupName.addEventListener('focus', function() {
            setMascotExpression('happy', 'ما اسمك؟ ✏️');
        });
        signupName.addEventListener('input', function() {
            if (this.value.length > 3) {
                setMascotExpression('excited', 'اسم جميل! 🌟');
            }
        });
    }

    // Signup phone focus
    var signupPhone = document.getElementById('signupPhone');
    if (signupPhone) {
        signupPhone.addEventListener('focus', function() {
            setMascotExpression('focused', 'رقم الواتساب 📱');
        });
        signupPhone.addEventListener('input', function() {
            if (this.value.length === 11) {
                setMascotExpression('happy', 'تم! ✓');
            }
        });
    }

    // Grade select
    var signupGrade = document.getElementById('signupGrade');
    if (signupGrade) {
        signupGrade.addEventListener('change', function() {
            if (this.value) {
                setMascotExpression('excited', 'يا حظك! 🎉');
            }
        });
    }
    var loginGrade = document.getElementById('loginGrade');
    if (loginGrade) {
        loginGrade.addEventListener('change', function() {
            if (this.value) {
                setMascotExpression('happy', 'تم اختيار الصف ✓');
            }
        });
    }

    // Login button
    var loginBtn = document.getElementById('loginSelectedBtn');
    if (loginBtn) {
        loginBtn.addEventListener('click', function() {
            setMascotExpression('focused', '...جاري الدخول');
        });
    }

    // Signup button
    var signupBtn = document.getElementById('signup-submit-btn');
    if (signupBtn) {
        signupBtn.addEventListener('click', function() {
            setMascotExpression('excited', 'يلا نبدأ! 🚀');
        });
    }

    // Tab switching
    var tabLogin = document.getElementById('tabLogin');
    var tabSignup = document.getElementById('tabSignup');
    if (tabLogin) {
        tabLogin.addEventListener('click', function() {
            setMascotExpression('happy', 'أهلاً بعودتك! 👋');
        });
    }
    if (tabSignup) {
        tabSignup.addEventListener('click', function() {
            setMascotExpression('excited', 'سجّل الآن! ✨');
        });
    }

    // Close button
    var closeBtn = document.getElementById('closeAuth');
    if (closeBtn) {
        closeBtn.addEventListener('click', function() {
            setMascotExpression('wave', 'مع السلامة! 👋');
        });
    }

    // Error handling - watch loginError and signup errors
    var loginError = document.getElementById('loginError');
    if (loginError) {
        var errObs = new MutationObserver(function(mutations) {
            mutations.forEach(function(m) {
                if (m.attributeName === 'class') {
                    if (!loginError.classList.contains('hidden') && loginError.textContent.trim()) {
                        setMascotExpression('worried', 'في مشكلة 😟');
                    }
                }
            });
        });
        errObs.observe(loginError, { attributes: true, childList: true, characterData: true });
    }
}

// Initialize mascot when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { initMascot(); setupMascotEvents(); });
} else {
    initMascot();
    setupMascotEvents();
}

var _selectedProfileFile = null;

function _initProfileUpload() {
    var zone = document.getElementById('profileUploadZone');
    var fileInput = document.getElementById('signupProfileImage');
    var placeholder = document.getElementById('uploadPlaceholder');
    var preview = document.getElementById('uploadPreview');
    var previewImg = document.getElementById('previewImg');
    var removeBtn = document.getElementById('removeImageBtn');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', function () {
        if (!_selectedProfileFile) fileInput.click();
    });

    zone.addEventListener('dragover', function (e) {
        e.preventDefault();
        zone.classList.add('dragover');
    });
    zone.addEventListener('dragleave', function () {
        zone.classList.remove('dragover');
    });
    zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.classList.remove('dragover');
        var files = e.dataTransfer.files;
        if (files.length > 0) _handleProfileFile(files[0]);
    });

    fileInput.addEventListener('change', function () {
        if (this.files && this.files[0]) _handleProfileFile(this.files[0]);
    });

    if (removeBtn) {
        removeBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            _selectedProfileFile = null;
            fileInput.value = '';
            if (placeholder) placeholder.style.display = '';
            if (preview) preview.style.display = 'none';
            zone.classList.remove('uploaded');
        });
    }

    function _handleProfileFile(file) {
        if (!file.type.startsWith('image/')) {
            showToast('يرجى اختيار صورة فقط', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('حجم الصورة يجب ألا يتجاوز 2MB', 'error');
            return;
        }
        _selectedProfileFile = file;
        var reader = new FileReader();
        reader.onload = function (ev) {
            if (previewImg) previewImg.src = ev.target.result;
            if (placeholder) placeholder.style.display = 'none';
            if (preview) preview.style.display = '';
            zone.classList.add('uploaded');
        };
        reader.readAsDataURL(file);
    }
}

async function _processProfileImage(file) {
    if (!file) return null;
    return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function (ev) {
            var img = new Image();
            img.onload = function () {
                var MAX = 300;
                var w = img.width;
                var h = img.height;
                var ratio = Math.min(MAX / w, MAX / h, 1);
                var tw = Math.round(w * ratio);
                var th = Math.round(h * ratio);
                var canvas = document.createElement('canvas');
                canvas.width = tw;
                canvas.height = th;
                var ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, tw, th);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = function () {
                resolve(ev.target.result);
            };
            img.src = ev.target.result;
        };
        reader.onerror = function () { resolve(null); };
        reader.readAsDataURL(file);
    });
}

_initProfileUpload();

if (actualSignupForm) {
    // Set up registration listener (initial fetch + real-time)
    if (window.db) _setupRegistrationListener();

    actualSignupForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Close the auth popup immediately with a professional success animation
        closeAuthModalWithAnimation();

        // Check registration enabled
        var regDoc = await window.db.collection("settings").doc("registration").get();
        var regEnabled = !(regDoc.exists && regDoc.data().enabled === false);
        if (!regEnabled) {
            showToast('التسجيل مغلق حاليًا', 'error');
            return;
        }

        const name = document.getElementById('signupName').value.trim();
        const rawPhone = document.getElementById('signupPhone').value.trim();
        const phone = normalizePhone(rawPhone);
        const gradeSelect = document.getElementById('signupGrade');
        const gradeVal = gradeSelect.value;
        const gradeText = gradeSelect.options[gradeSelect.selectedIndex].text;
        const signupBtn = actualSignupForm.querySelector('button[type="submit"]');

        signupBtn.disabled = true;
        signupBtn.innerText = "جاري إنشاء الحساب... ⏳";

        try {
            if (!window.db) throw new Error("قاعدة البيانات غير متصلة.");

            // Validate profile image is selected
            if (!_selectedProfileFile) {
                showToast('يرجى اختيار صورة شخصية', 'error');
                signupBtn.disabled = false;
                signupBtn.innerText = "سجّل الآن 🚀";
                return;
            }

            // Check per-grade availability (capacity)
            var regData = regDoc.data() || {};
            var gradesSettings = regData.grades || {};
            var gradeSetting = gradesSettings[gradeVal] || {};
            if (gradeSetting.enabled === false) {
                showToast('هذا الصف غير متاح للتسجيل حاليًا', 'error');
                return;
            }
            if (gradeSetting.max > 0) {
                var countSnap = await window.db.collection("students").where("grade", "==", gradeText).get();
                if (countSnap.size >= gradeSetting.max) {
                    showToast('المقاعد متكاملة لهذا الصف', 'error');
                    // Auto-disable grade if full
                    await window.db.collection("settings").doc("registration").update({
                        ["grades." + gradeVal + ".enabled"]: false
                    }).catch(function () {});
                    return;
                }
            }

            const collectionName = gradeText === "معلم لغة انجليزية" ? "teachers" : "students";

            // Check if already exists (phone + name)
            const check = await getSnapshotByPhone(collectionName, phone);
            if (check && !check.empty) {
                const duplicate = check.docs.some(doc => doc.data().name === name);
                if (duplicate) {
                    showToast('هذا الحساب مسجل بالفعل!', 'error');
                    return;
                }
            }

            const userData = {
                name: name,
                phone: phone,
                grade: gradeText,
                isActivated: collectionName === "teachers" ? true : false,
                role: collectionName === "teachers" ? "teacher" : "student",
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Process profile image (compress + base64 for Firestore)
            if (_selectedProfileFile) {
                var imgData = await _processProfileImage(_selectedProfileFile);
                if (imgData) userData.profileImage = imgData;
            }

            if (collectionName === "students") {
                Object.assign(userData, {
                    score: 0,
                    attendance: [],
                    totalSessions: 8,
                    paid: 0,
                    level: "لم يتم تحديد المستوى بعد",
                    notes: "",
                    report: "",
                    code: "لم يحدد بعد",
                    academicYear: "current"
                });
            }

            await window.db.collection(collectionName).add(userData);

            // Auto-disable grade if at capacity
            if (gradeSetting.max > 0 && gradeVal !== 'teacher') {
                var postCountSnap = await window.db.collection("students").where("grade", "==", gradeText).get();
                if (postCountSnap.size >= gradeSetting.max) {
                    await window.db.collection("settings").doc("registration").update({
                        ["grades." + gradeVal + ".enabled"]: false
                    }).catch(function () {});
                }
            }

            if (typeof playDashSound === 'function') playDashSound('login');
            actualSignupForm.reset();
            _selectedProfileFile = null;
            var placeholder = document.getElementById('uploadPlaceholder');
            var preview = document.getElementById('uploadPreview');
            var zone = document.getElementById('profileUploadZone');
            if (placeholder) placeholder.style.display = '';
            if (preview) preview.style.display = 'none';
            if (zone) zone.classList.remove('uploaded');

            // Fetch admin WhatsApp settings (teacher name/phone + default message)
            let waData = {};
            try {
                const waSettings = await window.db.collection("settings").doc("whatsapp_templates").get();
                waData = waSettings.exists ? waSettings.data() : {};
            } catch (waErr) {
                console.error('Error loading WA settings:', waErr);
            }

            // Show celebration with success text; WhatsApp opens only when the user clicks the button in the popup
            showRegistrationCelebration({ name: name, phone: phone, grade: gradeText }, waData, function (url) {
                window.open(url, '_blank');
            });

            setTimeout(() => { if (tabLogin) tabLogin.click(); }, 1500);

        } catch (error) {
            console.error("Signup Error:", error);
            showToast('حدث خطأ أثناء التسجيل: ' + (error.message || 'خطأ في الاتصال'), 'error');
        } finally {
            _applyRegistrationState(_registrationEnabled, _registrationGrades);
        }
    });
}

function setLoggedIn(user) {
    localStorage.setItem('el_mistar_current_user', JSON.stringify(user));

    // UI Adjustments
    if (loginBtnNav) loginBtnNav.style.display = 'none';
    if (userProfileNav) userProfileNav.classList.add('active');

    const displayEl = document.getElementById('userDisplay');
    if (displayEl) displayEl.innerText = 'تسجيل الخروج';

    // Show/Hide Auth Buttons
    document.querySelectorAll('.logged-in-only').forEach(el => {
        el.style.display = 'inline-flex';
    });
    document.querySelectorAll('.logout-only').forEach(el => {
        el.style.display = 'none';
    });

    // Hide Auth Modals
    if (authOverlay) authOverlay.classList.remove('active');
    document.body.style.overflow = '';

    // Prepare dashboard data (fill fields) but don't show the section yet
    populateDashboard(user);

    // Handle pending summer course subscription
    var pendingCourseId = localStorage.getItem('pendingSummerCourseId');
    if (pendingCourseId && typeof SummerCourses !== 'undefined') {
      localStorage.removeItem('pendingSummerCourseId');
      window.db.collection('summerCourses').doc(pendingCourseId).get().then(function (doc) {
        if (doc.exists) {
          var course = doc.data();
          course.id = doc.id;
          SummerCourses.directSubscribe(course, user);
        }
      }).catch(function (err) {
        console.error('[SC] Pending subscribe error:', err);
      });
    }

    // Start monitoring account for teacher changes
    monitorStudentAccount(user);

    // Force students who registered before the photo requirement to upload a profile photo
    maybeForceProfilePhoto(user);
}

function monitorStudentAccount(user) {
    if (!window.db || !user || !user.id) return;
    var collectionName = user.role === 'teacher' ? 'teachers' : 'students';
    var lastData = null;
    var isFirstSnapshot = true;

    window.db.collection(collectionName).doc(user.id).onSnapshot(function (snapshot) {
        if (isFirstSnapshot) {
            if (snapshot.exists) {
                lastData = JSON.stringify(snapshot.data());
            }
            isFirstSnapshot = false;
            return;
        }

        if (!snapshot.exists) {
            showForceLogoutModal('⚠️ تم حذف حسابك من قبل المعلم.', 'تم حذف حسابك');
            return;
        }

        var newData = snapshot.data();
        var currentDataStr = JSON.stringify(newData);
        if (currentDataStr !== lastData) {
            lastData = currentDataStr;
            // Update local user data and refresh UI instead of force logout
            var updatedUser = JSON.parse(localStorage.getItem('el_mistar_current_user') || '{}');
            // Merge new data from Firestore into local user
            if (newData.name) updatedUser.name = newData.name;
            if (newData.phone) updatedUser.phone = newData.phone;
            if (newData.grade) updatedUser.grade = newData.grade;
            if (newData.isActivated !== undefined) updatedUser.isActivated = newData.isActivated;
            if (newData.status !== undefined) updatedUser.status = newData.status;
            localStorage.setItem('el_mistar_current_user', JSON.stringify(updatedUser));
            // Refresh UI
            populateDashboard(updatedUser);
            if (typeof showToast === 'function') {
                showToast('🔄 تم تحديث بياناتك بنجاح!', 'success');
            }
        }
    }, function (err) {
        console.error('[Account Monitor] Error:', err);
    });
}

function showForceLogoutModal(message, title) {
    var existing = document.getElementById('force-logout-modal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'force-logout-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(6px);animation:fadeIn 0.3s ease;';

    var box = document.createElement('div');
    box.style.cssText = 'background:#1c2230;border:1px solid rgba(255,255,255,0.08);border-radius:24px;padding:40px 36px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.6);animation:modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1);';

    box.innerHTML =
        '<div style="font-size:56px;margin-bottom:12px;">🔒</div>' +
        '<h2 style="font-size:22px;font-weight:900;color:#e2e8f0;margin-bottom:8px;">' + (title || 'تنبيه') + '</h2>' +
        '<p style="font-size:15px;color:#94a3b8;margin-bottom:28px;line-height:1.7;">' + message + '</p>' +
        '<button id="force-logout-btn" style="width:100%;padding:14px;border:none;border-radius:12px;background:#ef4444;color:white;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;transition:all 0.2s;">تسجيل الخروج</button>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    document.getElementById('force-logout-btn').addEventListener('click', function () {
        localStorage.removeItem('el_mistar_current_user');
        localStorage.removeItem('pendingSummerCourseId');
        window.location.reload();
    });
}

async function logoutAndRefresh(deleteStudentId) {
    if (deleteStudentId && window.db) {
        try {
            await window.db.collection("students").doc(deleteStudentId).delete();
        } catch (err) {
            console.error("Error deleting rejected account:", err);
        }
    }
    localStorage.removeItem('el_mistar_current_user');
    localStorage.removeItem('pendingSummerCourseId');
    window.location.reload();
}

// Function to explicitly toggle the dashboard
function toggleStudentDashboard() {
    let user = null;
    try {
        const stored = localStorage.getItem('el_mistar_current_user');
        if (stored && stored !== "undefined") user = JSON.parse(stored);
    } catch (e) { }
    if (!user) {
        openModal('authOverlay');
        showToast('يرجى تسجيل الدخول أولاً لعرض بياناتك.', 'info');
        return;
    }

    const dashboardSection = document.getElementById('student-dashboard');
    const showBtns = [
        document.getElementById('openLookupModalNav'),
        document.getElementById('openLookupModalHero')
    ];

    if (dashboardSection) {
        const isHidden = dashboardSection.classList.contains('hidden') || dashboardSection.style.display === 'none';

        if (isHidden) {
            // Show it
            dashboardSection.style.display = 'block';
            dashboardSection.classList.remove('hidden');
            setTimeout(() => {
                dashboardSection.classList.add('visible');
                dashboardSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
            populateDashboard(user);

            showBtns.forEach(btn => {
                if (btn) btn.innerHTML = 'إخفاء لوحة بياناتي 📊';
            });
        } else {
            // Hide it
            dashboardSection.classList.remove('visible');
            setTimeout(() => {
                dashboardSection.style.display = 'none';
                dashboardSection.classList.add('hidden');
            }, 300);

            showBtns.forEach(btn => {
                if (btn) {
                    btn.innerHTML = btn.id === 'openLookupModalHero' ? 'عرض لوحة بياناتي 📊' : 'لوحة البيانات';
                }
            });
        }
    }
}

// Add listeners to "Show My Data" buttons
(function initDashboardToggles() {
    const showBtns = [
        document.getElementById('openLookupModalNav'),
        document.getElementById('openLookupModalHero')
    ];
    showBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation(); // Prevent bubbling
                toggleStudentDashboard();
            });
        }
    });
})();

function triggerCelebration() {
    const colors = ['#2563eb', '#f97316', '#fbbf24', '#10b981', '#f43f5e', '#8b5cf6', '#06b6d4'];
    const particleCount = 150;

    function createFirework(originX) {
        for (let i = 0; i < particleCount / 2; i++) {
            const particle = document.createElement('div');
            particle.className = 'confetti-particle';

            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = Math.random() * 8 + 6 + 'px';
            const isCircle = Math.random() > 0.5;

            // Random destination
            const tx = (Math.random() - 0.5) * 800 + (originX > 50 ? -200 : 200) + 'px';
            const ty = - (Math.random() * 600 + 300) + 'px';
            const tr = Math.random() * 1080 + 'deg';
            const duration = Math.random() * 1.5 + 1.5 + 's';

            particle.style.backgroundColor = color;
            particle.style.left = originX + 'vw';
            particle.style.width = size;
            particle.style.height = isCircle ? size : (Math.random() * 15 + 5 + 'px');
            particle.style.borderRadius = isCircle ? '50%' : '2px';

            particle.style.setProperty('--tx', tx);
            particle.style.setProperty('--ty', ty);
            particle.style.setProperty('--tr', tr);

            particle.style.animation = `confetti-burst ${duration} cubic-bezier(0.1, 0.8, 0.3, 1) forwards`;

            document.body.appendChild(particle);
            setTimeout(() => particle.remove(), parseFloat(duration) * 1000);
        }
    }

    // Fire from left and right corners
    createFirework(10);
    createFirework(90);
}

function buildWhatsAppUrl(phone, message) {
    let cleanPhone = (phone || '').toString().replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) cleanPhone = cleanPhone.substring(1);
    if (!cleanPhone) return '';
    const encodedMsg = encodeURIComponent(message || '');
    return `https://wa.me/20${cleanPhone}?text=${encodedMsg}`;
}

function getRegistrationAutoMessage(data, settings) {
    const teacherName = (settings && settings.teacherName) || '';
    const teacherPhone = (settings && settings.teacherPhone) || '';
    const template = (settings && settings.registrationAuto) || '';
    if (template) {
        return template
            .replace(/{اسم_الطالب}/g, data.name || '')
            .replace(/{رقم_الطالب}/g, data.phone || '')
            .replace(/{الصف}/g, data.grade || '')
            .replace(/{اسم_المعلم}/g, teacherName)
            .replace(/{رقم_المعلم}/g, teacherPhone);
    }
    return 'مرحباً ' + teacherName + '، تم تسجيل الطالب/ة ' + (data.name || '') +
        ' في ' + (data.grade || '') + '.\nرقم الهاتف: ' + (data.phone || '') +
        '.\nيرجى تأكيد البيانات. شكراً لكم.';
}

function showRegistrationCelebration(details, waData, onOpenWhatsApp) {
    // Build the target WhatsApp chat (if the teacher phone is configured)
    const teacherPhone = ((waData && waData.teacherPhone) || '').toString().replace(/\D/g, '');
    const url = teacherPhone ? buildWhatsAppUrl(teacherPhone, getRegistrationAutoMessage(details, waData)) : '';
    const hasChat = !!url;

    // Create (or reuse) the celebration overlay
    let overlay = document.getElementById('registration-success-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'registration-success-overlay';
        overlay.className = 'registration-celebration-overlay';
        document.body.appendChild(overlay);
    }

    overlay.innerHTML =
        '<div class="registration-celebration-card">' +
            '<span class="registration-celebration-emoji">🎉</span>' +
            '<h2>تم التسجيل بنجاح!</h2>' +
            '<p>' + (hasChat
                ? 'جاري تجهيز رسالة للمعلم لمراجعة طلب التسجيل...<br>اضغط على الزر أدناه لفتح محادثة واتساب المعلم.'
                : 'تم حفظ بياناتك، سيتواصل معك المعلم لتأكيد طلب التسجيل.') + '</p>' +
            (hasChat
                ? '<button type="button" class="registration-wa-btn" id="registration-wa-btn">📱 فتح محادثة واتساب مع المعلم</button>'
                : '') +
        '</div>';

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Confetti celebration over the modal
    if (typeof triggerCelebration === 'function') triggerCelebration();

    if (url) {
        const btn = overlay.querySelector('#registration-wa-btn');
        if (btn) {
            btn.addEventListener('click', function (ev) {
                ev.preventDefault();
                if (typeof onOpenWhatsApp === 'function') onOpenWhatsApp(url);
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            });
        }
    }

    return overlay;
}

// Check logged in on load
window.addEventListener('DOMContentLoaded', () => {
    loadSessionSettingsFromFirestore();
    loadSignupNotesFromFirestore();
    let user = null;
    try {
        const stored = localStorage.getItem('el_mistar_current_user');
        if (stored && stored !== "undefined") user = JSON.parse(stored);
    } catch (e) { }
    if (user) {
        setLoggedIn(user);
    }
});

// Logout (Click avatar to show professional logout confirmation)
const userAvatar = document.getElementById('userAvatar');
if (userAvatar) {
    userAvatar.addEventListener('click', () => {
        showLogoutConfirm();
    });
}




// ============================================
// STUDENT DASHBOARD & LOOKUP LOGIC
// ============================================

// Sound Effect Utility (Web Audio API - no external files needed)
function playDashSound(type) {
    return; // Sounds disabled
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'success') {
            osc.frequency.setValueAtTime(523, ctx.currentTime);
            osc.frequency.setValueAtTime(659, ctx.currentTime + 0.12);
            osc.frequency.setValueAtTime(784, ctx.currentTime + 0.24);
            gain.gain.setValueAtTime(0.18, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } else if (type === 'login') {
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.setValueAtTime(550, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } else if (type === 'error') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(220, ctx.currentTime);
            osc.frequency.setValueAtTime(180, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.12, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } else if (type === 'click') {
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            gain.gain.setValueAtTime(0.08, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.08);
        }
    } catch (e) { /* silence if AudioContext blocked */ }
}

// Animate number from 0 to target
function animateCount(el, target, duration = 900, suffix = '') {
    if (!el) return;
    const start = performance.now();
    function step(now) {
        const progress = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(ease * target) + suffix;
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

// Update Attendance Dots for Student View (Redesigned Dots)
function updateAttendanceDotsDisplay(attendance, total = 8, paid = 0, otherExpenses = 0, academicYear) {
    const dotsContainer = document.getElementById('dash-attendance-container');
    if (!dotsContainer) return;

    dotsContainer.innerHTML = '';
    var yrPrice = getPriceForYear(academicYear);
    var spm = getSessionsForYear(academicYear);
    const paidPool = Math.max(0, paid - otherExpenses);
    const totalPaidSessions = Math.floor(paidPool / yrPrice);
    const rows = Math.ceil(total / spm);
    for (let r = 0; r < rows; r++) {
        const monthWrapper = document.createElement('div');
        monthWrapper.className = 'sd-month-box';
        monthWrapper.style.background = '#f8fafc';
        monthWrapper.style.padding = '20px';
        monthWrapper.style.borderRadius = '20px';
        monthWrapper.style.marginBottom = '15px';
        monthWrapper.style.border = '1px solid #e2e8f0';
        monthWrapper.style.width = '100%';

        const monthLabel = document.createElement('div');
        monthLabel.className = 'sd-month-title';
        monthLabel.style.fontSize = '14px';
        monthLabel.style.fontWeight = '800';
        monthLabel.style.color = '#1e3a8a';
        monthLabel.style.marginBottom = '15px';
        monthLabel.style.textAlign = 'left';
        
        const arabicOrdinals = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر"];
        const monthName = arabicOrdinals[r] || `رقم ${r + 1}`;
        monthLabel.textContent = `الشهر ${monthName}`;
        
        monthWrapper.appendChild(monthLabel);

        const rowDiv = document.createElement('div');
        rowDiv.className = 'sd-month-row';
        rowDiv.style.display = 'flex';
        rowDiv.style.gap = '8px';
        rowDiv.style.flexWrap = 'nowrap';
        rowDiv.style.justifyContent = 'space-between';
        rowDiv.style.flexDirection = 'row-reverse';

        for (let i = 1; i <= spm; i++) {
            const index = (r * spm) + i;
            if (index > total) break;

            const isAttended = Array.isArray(attendance) ? attendance.includes(index) : index <= attendance;
            const isPaid = index <= totalPaidSessions;

            const dot = document.createElement('div');
            dot.className = 'a-dot';
            dot.textContent = i;
            
            // Base styles for dots (overriding a-dot to match image)
            dot.style.width = '38px';
            dot.style.height = '38px';
            dot.style.borderRadius = '50%';
            dot.style.display = 'flex';
            dot.style.alignItems = 'center';
            dot.style.justifyContent = 'center';
            dot.style.fontSize = '14px';
            dot.style.fontWeight = '800';
            dot.style.transition = 'all 0.3s';
            dot.style.boxShadow = '0 3px 6px rgba(0,0,0,0.08)';
            dot.style.margin = '0'; // reset default margin if any

            setTimeout(() => {
                if (isAttended && isPaid) {
                    dot.style.background = '#10b981';
                    dot.style.color = 'white';
                    dot.style.border = 'none';
                } else if (isAttended && !isPaid) {
                    dot.style.background = '#ef4444';
                    dot.style.color = 'white';
                    dot.style.border = 'none';
                    dot.style.boxShadow = '0 4px 10px rgba(239, 68, 68, 0.3)';
                } else if (!isAttended && isPaid) {
                    dot.style.background = '#3b82f6';
                    dot.style.color = 'white';
                    dot.style.border = 'none';
                } else {
                    dot.style.background = '#f1f5f9';
                    dot.style.color = '#94a3b8';
                    dot.style.border = '1px solid #e2e8f0';
                }
            }, i * 60);

            rowDiv.appendChild(dot);
        }
        monthWrapper.appendChild(rowDiv);
        dotsContainer.appendChild(monthWrapper);
    }
}

// Update payment progress for Student View
function updatePaymentProgressDisplay(paid, required = 160, otherExpenses = 0, attendanceCount = 0, hasPending = false, bookletName = "") {
    const fill = document.getElementById('nd-payment-fill');
    const pill = document.getElementById('nd-payment-pill');
    const debtEl = document.getElementById('dash-debt');
    const pctEl = document.getElementById('payment-pct');
    const otherEl = document.getElementById('dash-other-expenses');
    const calcInfoEl = document.getElementById('dash-smart-calc-info');
    const calcAlertEl = document.getElementById('dash-payment-calc-alert');
    const bookletBoxEl = document.getElementById('dash-booklet-info-box');
    const bookletTextEl = document.getElementById('dash-booklet-info-text');

    const totalRequired = required + otherExpenses;
    const pct = totalRequired > 0 ? Math.min((paid / totalRequired) * 100, 100) : (paid > 0 ? 100 : 0);

    if (fill) setTimeout(() => {
        const arcLen = 251;
        fill.style.strokeDashoffset = arcLen - (pct / 100) * arcLen;
    }, 200);

    if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;

    const sessionsDuesEl = document.getElementById('dash-sessions-dues');
    if (sessionsDuesEl) sessionsDuesEl.textContent = `${required} ج.م`;

    const otherRowEl = document.getElementById('dash-other-expenses-row');
    if (otherRowEl) {
        if (otherExpenses > 0) {
            otherRowEl.style.display = 'flex';
            if (otherEl) otherEl.textContent = `${otherExpenses} ج.م`;
            
            // Show Booklet Box
            if (bookletBoxEl && bookletTextEl) {
                bookletBoxEl.style.display = 'flex';
                bookletTextEl.textContent = bookletName ? `ملزمة: ${bookletName} — ${otherExpenses} ج.م` : `ملزمة إضافية — ${otherExpenses} ج.م`;
            }
        } else {
            otherRowEl.style.display = 'none';
            if (bookletBoxEl) bookletBoxEl.style.display = 'none';
        }
    }

    const remaining = Math.max(0, totalRequired - paid);
    if (debtEl) {
        animateCount(debtEl, remaining, 900, ' ج.م');
    }

    // Smart Calculation Info & Alert (Matching Admin)
    if (calcInfoEl) {
        if (otherExpenses > 0) {
            let expenseText = `${otherExpenses} ج (ملزمات)`;
            if (bookletName) expenseText = `${otherExpenses} ج (ملزمة: ${bookletName})`;
            calcInfoEl.innerHTML = `مستحق: ${required} ج (حضور) + ${expenseText}`;
        } else {
            calcInfoEl.textContent = `مستحق للحضور: ${totalRequired} ج`;
        }
    }

    if (calcAlertEl) {
        if (remaining > 0) {
            calcAlertEl.style.display = 'block';
            calcAlertEl.style.background = '#fee2e2';
            calcAlertEl.style.color = '#ef4444';
            let debtDetail = `متبقي ${remaining} ج عن ${attendanceCount} حصص`;
            if (otherExpenses > 0) debtDetail += ` + ملزمة`;
            calcAlertEl.innerHTML = `<i class='bx bx-error-circle'></i> ${debtDetail}`;
        } else if (paid >= totalRequired && attendanceCount > 0) {
            calcAlertEl.style.display = 'block';
            calcAlertEl.style.background = '#dcfce7';
            calcAlertEl.style.color = '#16a34a';
            calcAlertEl.innerHTML = `<i class='bx bx-check-circle'></i> مسدد بالكامل عن ${attendanceCount} حصص ✅`;
        } else {
            calcAlertEl.style.display = 'none';
        }
    }

    const payNowBtn = document.getElementById('pay-now-btn');
    if (payNowBtn) {
        if (hasPending) {
            payNowBtn.disabled = true;
            payNowBtn.style.opacity = '0.5';
            payNowBtn.style.cursor = 'not-allowed';
            payNowBtn.innerHTML = `<i class='bx bx-time-five'></i> قيد المراجعة ⏳`;
        } else if (remaining === 0 && totalRequired === 0) {
            payNowBtn.disabled = true;
            payNowBtn.style.opacity = '0.5';
            payNowBtn.style.cursor = 'not-allowed';
            payNowBtn.innerHTML = `<i class='bx bx-check'></i> لا توجد مستحقات`;
        } else if (remaining === 0) {
            payNowBtn.disabled = true;
            payNowBtn.style.opacity = '0.5';
            payNowBtn.style.cursor = 'not-allowed';
            payNowBtn.innerHTML = `<i class='bx bxs-check-circle'></i> تم السداد`;
        } else {
            payNowBtn.disabled = false;
            payNowBtn.style.opacity = '1';
            payNowBtn.style.cursor = 'pointer';
            payNowBtn.innerHTML = `<i class='bx bxs-credit-card'></i> سداد الآن (${remaining} ج.م)`;
        }
    }
}

async function populateDashboard(user) {
    if (!user || !user.phone) return;

    await loadSessionSettingsFromFirestore();
    updateStaticPriceDisplay();

    // UI Elements
    const dName = document.getElementById('dash-name');
    const dPhone = document.getElementById('dash-phone');
    const dGradeText = document.getElementById('dash-grade-text');
    const dTime = document.getElementById('dash-time');
    const dPhoto = document.getElementById('dashboard-photo');

    // Static Data
    if (dName) dName.textContent = user.name || 'طالب متميز';
    const dNameTop = document.getElementById('dash-name-top');
    if (dNameTop) dNameTop.textContent = user.name || 'طالب متميز';

    // Dynamic Greeting
    const dGreeting = document.getElementById('dash-greeting');
    if (dGreeting) {
        const hour = new Date().getHours();
        if (hour < 12) dGreeting.textContent = "صباح التميز! ✨";
        else if (hour < 18) dGreeting.textContent = "طاب يومك! 🌞";
        else dGreeting.textContent = "مساء التألق! 🌙";
    }

    if (dPhone) dPhone.textContent = user.phone;

    // Load Photo
    const savedPhoto = localStorage.getItem(`student_photo_${user.phone}`);
    if (savedPhoto && dPhoto) dPhoto.src = savedPhoto;
    if (user.profileImage && dPhoto) dPhoto.src = user.profileImage;

    // Fetch from Firestore
    try {
        if (!window.db) return;

        const collectionName = user.role === "teacher" || user.grade === "معلم لغة انجليزية" ? "teachers" : "students";
        const snap = await getSnapshotByPhone(collectionName, user.phone);
        if (!snap) return;

        if (snap.empty) {
            // Student not found in Firestore - account was deleted
            document.querySelectorAll('.dash-section, .dash-grid').forEach(el => el.style.display = 'none');
            const dTopCardsEl = document.getElementById('dash-top-cards');
            if (dTopCardsEl) dTopCardsEl.style.display = 'none';
            document.getElementById('enrollment-section')?.style.setProperty('display', 'none');
            document.getElementById('summer-enrollment-section')?.style.setProperty('display', 'none');
            document.getElementById('dash-wa-group-section')?.style.setProperty('display', 'none');
            const dTeacherNotes = document.getElementById('dash-teacher-notes');
            if (dTeacherNotes) {
                dTeacherNotes.innerHTML = `
                    <div style="background:#fef3c7;border:2px solid #f59e0b;border-radius:16px;padding:20px;text-align:center;">
                        <div style="font-size:3rem;margin-bottom:10px;">⚠️</div>
                        <h3 style="color:#d97706;margin-bottom:8px;">لم يتم العثور على الحساب</h3>
                        <p style="color:#92400e;font-size:0.95rem;margin-bottom:4px;">تم حذف بياناتك من المنصة</p>
                        <p style="color:#6b7280;font-size:0.85rem;margin-top:12px;">يرجى التواصل مع المعلم لإنشاء حساب جديد</p>
                        <button onclick="logoutAndRefresh()" style="margin-top:16px;padding:10px 24px;background:#d97706;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;">تسجيل الخروج</button>
                    </div>
                `;
            }
            playDashSound('error');
            return;
        }

        // Find the correct student document by matching name
        const studentDoc = snap.docs.find(doc => doc.data().name === user.name) || snap.docs[0];
        const student = studentDoc.data();
        const studentId = studentDoc.id;
        window.__elmistarCurrentStudentId = studentId;
        const dTopCards = document.getElementById('dash-top-cards');

        // Load profile image from Firestore (into dashboard photo only; navbar stays logout icon)
        if (student.profileImage && dPhoto) {
            dPhoto.src = student.profileImage;
        }

        // Check if account is rejected
        if (student.status === 'rejected') {
            const reason = student.rejectionReason || 'غير محدد';
            document.querySelectorAll('.dash-section, .dash-grid').forEach(el => el.style.display = 'none');
            if (dTopCards) dTopCards.style.display = 'none';
            document.getElementById('enrollment-section')?.style.setProperty('display', 'none');
            document.getElementById('summer-enrollment-section')?.style.setProperty('display', 'none');
            document.getElementById('dash-wa-group-section')?.style.setProperty('display', 'none');
            const dTeacherNotes = document.getElementById('dash-teacher-notes');
            if (dTeacherNotes) {
                dTeacherNotes.innerHTML = `
                    <div style="background:#fee2e2;border:2px solid #ef4444;border-radius:16px;padding:20px;text-align:center;">
                        <div style="font-size:3rem;margin-bottom:10px;">❌</div>
                        <h3 style="color:#dc2626;margin-bottom:8px;">تم رفض طلب التسجيل</h3>
                        <p style="color:#991b1b;font-size:1rem;margin-bottom:4px;">السبب: ${reason}</p>
                        <p style="color:#6b7280;font-size:0.85rem;margin-top:12px;">يرجى التواصل مع المعلم للمزيد من المعلومات</p>
                        <button onclick="logoutAndRefresh('${studentId}')" style="margin-top:16px;padding:10px 24px;background:#dc2626;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:700;">تسجيل الخروج وحذف الحساب</button>
                    </div>
                `;
            }
            playDashSound('error');
            return;
        }

        // Helper to get full grade name if it's numeric
        const getGradeName = (g) => {
            const names = {
                "teacher": "معلم لغة انجليزية",
                "0": "مرحلة الكي جي والتأسيس",
                "1": "الصف الأول الابتدائي",
                "2": "الصف الثاني الابتدائي",
                "3": "الصف الثالث الابتدائي",
                "4": "الصف الرابع الابتدائي",
                "5": "الصف الخامس الابتدائي",
                "6": "الصف السادس الابتدائي"
            };
            return names[g] || g || "غير محدد";
        };

        // Set grade
        const gradeTextValue = getGradeName(student.grade) || getGradeName(user.grade) || "—";
        if (dGradeText) dGradeText.textContent = gradeTextValue;

        // Handle Inactive Accounts (Pending Approval)
        if (!student.isActivated) {
            // Hide all dashboard sections
            document.querySelectorAll('.dash-section, .dash-grid').forEach(function(el) { el.style.display = 'none'; });
            if (dTopCards) dTopCards.style.display = 'none';
            document.getElementById('enrollment-section')?.style.setProperty('display', 'none');
            document.getElementById('summer-enrollment-section')?.style.setProperty('display', 'none');
            document.getElementById('dash-wa-group-section')?.style.setProperty('display', 'none');
            updatePaymentProgressDisplay(0, 0, 0, 0, false, "");

            // Show registration success / pending approval message
            var pendingNotes = document.getElementById('dash-teacher-notes');
            if (pendingNotes) {
                pendingNotes.innerHTML =
                    '<div style="background:linear-gradient(135deg,#ECFDF5,#D1FAE5);border:2px solid #22C55E;border-radius:20px;padding:30px 24px;text-align:center;box-shadow:0 6px 20px rgba(34,197,94,0.15);">' +
                        '<div style="font-size:3rem;margin-bottom:12px;">🎉</div>' +
                        '<h3 style="color:#065F46;margin:0 0 8px;font-size:1.2rem;font-weight:800;">تم استلام طلب تسجيل الطالب بنجاح</h3>' +
                        '<div style="background:rgba(255,255,255,0.7);border-radius:14px;padding:16px 20px;margin:14px 0;border:1.5px dashed #6EE7B7;">' +
                            '<p style="margin:0 0 6px;font-size:1rem;color:#065F46;font-weight:700;">' +
                                'تم تسجيل الطالب <strong style="color:#047857;">' + (student.name || '—') + '</strong>' +
                            '</p>' +
                            '<p style="margin:0 0 6px;font-size:1rem;color:#065F46;font-weight:700;">' +
                                'في <strong style="color:#047857;">' + (gradeTextValue || '—') + '</strong> بنجاح :)' +
                            '</p>' +
                            '<p style="margin:8px 0 0;font-size:0.9rem;color:#6B7280;line-height:1.7;">' +
                                'وسيتم مراجعة البيانات والتواصل معكم<br>في أقرب وقت لتأكيد الحجز .' +
                            '</p>' +
                        '</div>' +
                        '<p style="margin:0;font-size:0.95rem;color:#065F46;font-weight:700;">' +
                            'نتمنى لابنكم / ابنتكم عاماً دراسياً موفقاً 🌹' +
                        '</p>' +
                    '</div>';
                pendingNotes.style.display = 'block';
            }
            return;
        } else {
            if (dTopCards) dTopCards.style.display = 'flex';
            // Show acceptance notification once
            const notifiedKey = `accepted_notified_${studentId}`;
            if (!localStorage.getItem(notifiedKey)) {
                setTimeout(() => {
                    showToast('✅ تم قبول طلب التسجيل بنجاح! 🎉', 'success');
                }, 500);
                localStorage.setItem(notifiedKey, 'true');
            }
        }

        // Success: Play welcome sound
        playDashSound('success');

            const attendance = student.attendance || [];
            const attendanceCount = Array.isArray(attendance) ? attendance.length : (parseInt(attendance) || 0);
            var yrPrice = getPriceForYear(student.academicYear);
            var yrSessions = getSessionsForYear(student.academicYear);
            const totalSessions = student.totalSessions || yrSessions;
            const paid = student.paid || 0;
            const day = student.day || "لم يحدد";
            const hour = student.hour || "—";
            const otherExpenses = student.otherExpenses || 0;
            const bookletName = student.bookletName || "";
            const report = student.report || student.notes || "لا توجد ملاحظات إضافية حالياً.";

            const requiredSoFar = attendanceCount * yrPrice;

            // Update Schedule
            const dClassDay = document.getElementById('dash-class-day');
            const dClassTime = document.getElementById('dash-class-time');
            if (dClassDay) dClassDay.textContent = day;
            if (dClassTime) dClassTime.textContent = hour;

            const dTeacherNotes = document.getElementById('dash-teacher-notes');
            if (dTeacherNotes) dTeacherNotes.textContent = report;

            const dPaidBig = document.getElementById('dash-paid-big');
            if (dPaidBig) animateCount(dPaidBig, paid, 900, ' ج.م');

            // Student Level Badge
            const dLevelBadge = document.getElementById('dash-level-badge');
            const level = student.level || "ممتاز";
            if (dLevelBadge) dLevelBadge.textContent = `المستوى: ${level}`;

            // Hide appointment and level for previous year students
            const isPreviousYear = student.academicYear === 'previous';
            if (isPreviousYear) {
                const scheduleCard = document.querySelector('.sd-card-schedule-new');
                if (scheduleCard) scheduleCard.style.display = 'none';
                if (dLevelBadge) dLevelBadge.style.display = 'none';
            }

            // WhatsApp Group Button
            const waGroupSection = document.getElementById('dash-wa-group-section');
            const waGroupBtn = document.getElementById('dash-wa-group-btn');
            if (student.groupId && window.db) {
                try {
                    const groupDoc = await window.db.collection("groups").doc(student.groupId).get();
                    if (groupDoc.exists) {
                        const groupData = groupDoc.data();
                        if (groupData.whatsapp) {
                            waGroupBtn.href = groupData.whatsapp;
                            if (waGroupSection) waGroupSection.style.display = 'block';
                        }
                    }
                } catch (e) {
                    console.log('WhatsApp group load error:', e);
                }
            }

            // Check for pending payment requests
            try {
                const paySnap = await getSnapshotByPhoneField("payment_requests", "studentPhone", user.phone);
                if (!paySnap) throw new Error("قاعدة البيانات غير متصلة.");

                const hasPending = !paySnap.empty && paySnap.docs.some(doc => doc.data().status === 'pending');

                updateAttendanceDotsDisplay(attendance, totalSessions, paid, otherExpenses, student.academicYear);
                updatePaymentProgressDisplay(paid, requiredSoFar, otherExpenses, attendanceCount, hasPending, bookletName);
            } catch (e) {
                updateAttendanceDotsDisplay(attendance, totalSessions, paid, otherExpenses, student.academicYear);
                updatePaymentProgressDisplay(paid, requiredSoFar, otherExpenses, attendanceCount, false, bookletName);
            }

            // Smart Finance Logic for Parent
            const fAlert = document.getElementById('dash-finance-alert');
            const fText = document.getElementById('f-alert-text');
            const fSubtext = document.getElementById('f-alert-subtext');

            if (fAlert && fText && fSubtext) {
                fAlert.style.display = 'flex';
                fAlert.className = 'finance-smart-alert'; // reset classes

                if (paid < requiredSoFar) {
                    const debt = requiredSoFar - paid;
                    const paidSessionsCount = Math.floor(paid / yrPrice);
                    const unpaidSessionsCount = attendanceCount - paidSessionsCount;
                    fAlert.classList.add('warning');
                    fText.textContent = `متبقي مديونية: ${debt} ج.م`;
                    fSubtext.textContent = `مطلوب سداد ${Math.max(0, unpaidSessionsCount)} حصص (قيمة الحصة ${yrPrice} ج)`;
                } else if (paid >= totalSessions * yrPrice) {
                    fAlert.classList.add('success');
                    fText.textContent = `خالص للشهر بالكامل ✅`;
                    fSubtext.textContent = `شكراً لالتزامكم بالسداد`;
                } else {
                    fAlert.classList.add('success');
                    fText.textContent = `المدفوع يغطي الحضور الحالي ✅`;
                    fSubtext.textContent = `تم سداد تكلفة جميع الحصص السابقة`;
                }
            }

            // Re-initialize payment listeners (safely handled inside the function)
            initPaymentSystem();

            // Enrollment logic - for previous year and summer students
            if (student.academicYear === 'previous' || student.academicYear === 'summer') {
                initEnrollmentSection(student, studentId);
            } else {
                const enrollSection = document.getElementById('enrollment-section');
                if (enrollSection) enrollSection.style.display = 'none';

                // Show permanent congrats banner for current year students if setting enabled
                if (window.db) {
                    window.db.collection("settings").doc("congrats").get().then(function (doc) {
                        var enabled = !doc.exists || doc.data().enabled !== false;
                        if (enabled) {
                            var congratsDiv = document.getElementById('congrats-banner');
                            if (!congratsDiv) {
                                congratsDiv = document.createElement('div');
                                congratsDiv.id = 'congrats-banner';
                                var enrollSection = document.getElementById('enrollment-section');
                                if (enrollSection && enrollSection.parentNode) {
                                    enrollSection.parentNode.insertBefore(congratsDiv, enrollSection);
                                } else {
                                    var dashContent = document.querySelector('.dash-content') || document.querySelector('.dashboard-container') || document.querySelector('.nd-dashboard');
                                    if (dashContent) dashContent.insertBefore(congratsDiv, dashContent.firstChild);
                                }
                            }
                            var cPrice = getPriceForYear(student.academicYear);
                            var cSessions = getSessionsForYear(student.academicYear);
                            var cMonthly = getMonthlyTotalForYear(student.academicYear);
                            var cDiscount = getDiscountForYear(student.academicYear);
                            var cAfter = getMonthlyAfterDiscountForYear(student.academicYear);
                            var discountItem = '';
                            var gridClass = 'congrats-price-grid';
                            if (cDiscount > 0) {
                                gridClass += ' has-discount';
                                discountItem = '<div class="congrats-price-item">' +
                                    '<span class="congrats-price-icon">🎁</span>' +
                                    '<span class="congrats-price-label">الخصم</span>' +
                                    '<span class="congrats-price-value discount-value">-' + cDiscount + ' ج</span>' +
                                    '</div>';
                            }
                            congratsDiv.className = 'congrats-banner';
                            var totalBoxText = cDiscount > 0 ? ('الإجمالي بعد الخصم: <strong>' + cAfter + ' ج فقط</strong>') : ('الإجمالي الشهري: <strong>' + cAfter + ' ج فقط</strong>');
                            congratsDiv.innerHTML = '<span class="congrats-emoji">🎉🎊</span>' +
                                '<h3>تهانينا! تم الاشتراك والانضمام للعام الدراسي الجديد 🎓</h3>' +
                                '<p class="congrats-subtitle">تفاصيل الاشتراك الشهري</p>' +
                                '<div class="' + gridClass + '">' +
                                '<div class="congrats-price-item">' +
                                '<span class="congrats-price-icon">💵</span>' +
                                '<span class="congrats-price-label">سعر الحصة</span>' +
                                '<span class="congrats-price-value">' + cPrice + ' ج</span>' +
                                '</div>' +
                                '<div class="congrats-price-item">' +
                                '<span class="congrats-price-icon">📅</span>' +
                                '<span class="congrats-price-label">الحصص شهرياً</span>' +
                                '<span class="congrats-price-value">' + cSessions + ' حصة</span>' +
                                '</div>' +
                                '<div class="congrats-price-item">' +
                                '<span class="congrats-price-icon">💰</span>' +
                                '<span class="congrats-price-label">الإجمالي الشهري</span>' +
                                '<span class="congrats-price-value">' + cMonthly + ' ج</span>' +
                                '</div>' +
                                discountItem +
                                '</div>' +
                                '<div class="congrats-total-box">' + totalBoxText + '</div>' +
                                '<p class="congrats-note">نتمنى لك دوام التفوق والنجاح ✨</p>';
                        }
                    }).catch(function () {});
                }
            }
    } catch (err) {
        console.error('Dashboard Fetch Error:', err);
        if (dTime) dTime.innerHTML = `
            <div class="nd-dynamic-card" style="text-align:center;background:#fff1f2;border:1.5px solid #fecdd3;">
                <p style="color:#be123c;font-weight:700;">⚠️ خطأ في الاتصال بقاعدة البيانات. يرجى المحاولة لاحقاً.</p>
            </div>`;
        // Ensure pay button is disabled when there's an error
        updatePaymentProgressDisplay(0, 0, 0, 0, false, "");
    }
}




// Photo Upload Logic (يُحفظ في Firestore ليظهر للطالب وللأدمن على كل الأجهزة)
const photoUploadInput = document.getElementById('photo-upload');

if (photoUploadInput) {
    photoUploadInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!/^image\//.test(file.type)) {
            showToast('يرجى اختيار ملف صورة صالح.', 'error');
            return;
        }
        if (file.size > 2 * 1024 * 1024) { // 2MB Limit
            showToast("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 2 ميجابايت.", "error");
            return;
        }

        try {
            // ضغط الصورة لتجنب تجاوز حد المستند في Firestore
            const imgData = await _processProfileImage(file);
            if (!imgData) throw new Error('تعذر معالجة الصورة');

            let user = null;
            try {
                const stored = localStorage.getItem('el_mistar_current_user');
                if (stored && stored !== "undefined") user = JSON.parse(stored);
            } catch (e) { }

            // تحديث Firestore (المستند الأصلي للطالب/المعلم)
            const docId = window.__elmistarCurrentStudentId || null;
            if (window.db && docId) {
                const collectionName = (user && (user.role === 'teacher' || user.grade === 'معلم لغة انجليزية')) ? 'teachers' : 'students';
                await window.db.collection(collectionName).doc(docId).update({ profileImage: imgData });
            }

            // تحديث الجلسة المحلية
            if (user) {
                user.profileImage = imgData;
                localStorage.setItem('el_mistar_current_user', JSON.stringify(user));
                localStorage.setItem(`student_photo_${user.phone}`, imgData);
            }

            // تحديث الواجهة فوراً
            const dPhoto = document.getElementById('dashboard-photo');
            if (dPhoto) dPhoto.src = imgData;
            showToast("تم تحديث الصورة الشخصية بنجاح! ✨", "success");
        } catch (err) {
            console.error('[PHOTO]', err);
            showToast('تعذّر تحديث الصورة: ' + (err && err.message ? err.message : 'خطأ غير معروف'), 'error');
        } finally {
            e.target.value = '';
        }
    });
}

// ============================================
// FORCED PROFILE PHOTO UPLOAD
// (students who registered before the photo requirement)
// ============================================
var _forcePhotoOverlay = null;
var _forcePhotoFile = null;

// Check whether a logged-in student is missing a profile photo and force upload if so
function maybeForceProfilePhoto(user) {
    if (!user || !window.db) return;
    if (user.role === 'teacher' || user.grade === 'معلم لغة انجليزية') return;
    if (user.profileImage) return;

    // Old sessions may have stale localStorage — confirm against Firestore first
    var docRefPromise = user.id
        ? Promise.resolve(window.db.collection('students').doc(user.id).get())
        : getSnapshotByPhone('students', user.phone).then(function (snap) {
            return (snap && !snap.empty) ? snap.docs[0].ref.get() : null;
        });

    docRefPromise.then(function (doc) {
        if (!doc || !doc.exists) return; // account missing — dashboard handles that case
        if (doc.data().profileImage) {
            // Photo already exists in Firestore — just sync the local session
            syncProfilePhotoToSession(user, doc.data().profileImage);
            return;
        }
        showForceProfilePhotoModal(user);
    }).catch(function (err) {
        console.error('[ForcePhoto] check failed:', err);
    });
}

function syncProfilePhotoToSession(user, imgData) {
    user.profileImage = imgData;
    localStorage.setItem('el_mistar_current_user', JSON.stringify(user));
    if (user.phone) localStorage.setItem('student_photo_' + user.phone, imgData);
    var dPhoto = document.getElementById('dashboard-photo');
    if (dPhoto) dPhoto.src = imgData;
}

function showForceProfilePhotoModal(user) {
    if (_forcePhotoOverlay || !document.body) return;
    _forcePhotoFile = null;

    var overlay = document.createElement('div');
    overlay.id = 'force-photo-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(2,6,23,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);animation:fadeIn 0.3s ease;';

    overlay.innerHTML =
        '<div style="background:#0f172a;border:2px solid rgba(251,191,36,0.25);border-radius:24px;padding:36px 32px;max-width:440px;width:92%;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,0.6);animation:modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1);max-height:92vh;overflow-y:auto;">' +
            '<div style="font-size:52px;margin-bottom:10px;">📸</div>' +
            '<h2 style="font-size:22px;font-weight:900;color:#f8fafc;margin:0 0 10px;">أضف صورتك الشخصية</h2>' +
            '<p style="font-size:14.5px;color:#94a3b8;margin:0 0 20px;line-height:1.8;">عزيزي الطالب، من تحديث المنصة الجديد يجب إضافة صورة شخصية لحسابك قبل استكمال الاستخدام. اختر صورة واضحة لوجهك.</p>' +
            '<div id="forcePhotoZone" style="border:2px dashed rgba(148,163,184,0.5);border-radius:16px;padding:28px 20px;cursor:pointer;background:rgba(148,163,184,0.08);transition:all .2s;">' +
                '<input type="file" id="forcePhotoInput" accept="image/*" style="display:none;">' +
                '<div id="forcePhotoPlaceholder">' +
                    '<div style="font-size:38px;margin-bottom:8px;">👤</div>' +
                    '<div style="font-size:15px;font-weight:700;color:#e2e8f0;">اضغط لاختيار صورتك الشخصية</div>' +
                    '<div style="font-size:12.5px;color:#64748b;margin-top:6px;">JPG, PNG — بحد أقصى 2MB</div>' +
                '</div>' +
                '<div id="forcePhotoPreview" style="display:none;">' +
                    '<img id="forcePhotoPreviewImg" src="" alt="معاينة" style="width:120px;height:120px;border-radius:50%;object-fit:cover;border:3px solid #fbbf24;">' +
                '</div>' +
            '</div>' +
            '<div id="forcePhotoError" style="display:none;color:#f87171;font-size:13px;font-weight:700;margin-top:10px;"></div>' +
            '<button id="forcePhotoSubmitBtn" disabled style="width:100%;margin-top:22px;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e1b16;font-size:16px;font-weight:800;cursor:pointer;font-family:inherit;opacity:.55;transition:all .2s;box-shadow:0 4px 0 #b45309;">حفظ الصورة</button>' +
            '<button id="forcePhotoLogoutBtn" style="width:100%;margin-top:10px;padding:12px;border:2px solid rgba(239,68,68,0.4);border-radius:12px;background:transparent;color:#f87171;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;">تسجيل الخروج</button>' +
        '</div>';

    document.body.appendChild(overlay);
    _forcePhotoOverlay = overlay;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', forcePhotoKeyBlock, true);

    var zone = overlay.querySelector('#forcePhotoZone');
    var input = overlay.querySelector('#forcePhotoInput');
    var placeholder = overlay.querySelector('#forcePhotoPlaceholder');
    var preview = overlay.querySelector('#forcePhotoPreview');
    var previewImg = overlay.querySelector('#forcePhotoPreviewImg');
    var errEl = overlay.querySelector('#forcePhotoError');
    var submitBtn = overlay.querySelector('#forcePhotoSubmitBtn');

    zone.addEventListener('click', function () { input.click(); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.style.borderColor = '#fbbf24'; });
    zone.addEventListener('dragleave', function () { zone.style.borderColor = 'rgba(148,163,184,0.5)'; });
    zone.addEventListener('drop', function (e) {
        e.preventDefault();
        zone.style.borderColor = 'rgba(148,163,184,0.5)';
        if (e.dataTransfer.files && e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });
    input.addEventListener('change', function () {
        if (this.files && this.files[0]) handleFile(this.files[0]);
    });

    function handleFile(file) {
        errEl.style.display = 'none';
        if (!file.type.startsWith('image/')) { showError('يرجى اختيار صورة فقط'); return; }
        if (file.size > 2 * 1024 * 1024) { showError('حجم الصورة يجب ألا يتجاوز 2MB'); return; }
        _forcePhotoFile = file;
        var reader = new FileReader();
        reader.onload = function (ev) {
            previewImg.src = ev.target.result;
            placeholder.style.display = 'none';
            preview.style.display = '';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        };
        reader.readAsDataURL(file);
    }

    function showError(msg) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
    }

    submitBtn.addEventListener('click', function () {
        if (!_forcePhotoFile) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'جاري الحفظ... ⏳';
        _processProfileImage(_forcePhotoFile).then(function (imgData) {
            if (!imgData) throw new Error('تعذر معالجة الصورة');
            return _saveProfileImage(user, imgData);
        }).then(function () {
            submitBtn.textContent = 'تم الحفظ ✓';
            showToast('تم حفظ صورتك الشخصية بنجاح! ✨', 'success');
            setTimeout(forcePhotoClose, 600);
        }).catch(function (err) {
            console.error('[ForcePhoto] save error:', err);
            submitBtn.disabled = false;
            submitBtn.textContent = 'حفظ الصورة';
            showError('حدث خطأ أثناء الحفظ، حاول مرة أخرى');
        });
    });

    var logoutBtn = overlay.querySelector('#forcePhotoLogoutBtn');
    logoutBtn.addEventListener('click', function () {
        logoutAndRefresh();
    });
}

// Save a processed profile image to Firestore + local session
async function _saveProfileImage(user, imgData) {
    var docId = window.__elmistarCurrentStudentId || null;

    if (window.db && user.phone) {
        if (!docId) {
            var snap = await getSnapshotByPhone('students', user.phone);
            if (snap && !snap.empty) {
                var matched = snap.docs.find(function (d) { return d.data().name === user.name; }) || snap.docs[0];
                docId = matched.id;
            }
        }
        if (docId) {
            await window.db.collection('students').doc(docId).update({ profileImage: imgData });
        }
    }

    syncProfilePhotoToSession(user, imgData);
    var dPhoto = document.getElementById('dashboard-photo');
    if (dPhoto) dPhoto.src = imgData;
    return imgData;
}

// Block Escape / Backspace / F5 while the forced modal is open so it can't be dismissed
function forcePhotoKeyBlock(e) {
    if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'F5') {
        e.preventDefault();
        e.stopPropagation();
    }
}

function forcePhotoClose() {
    if (!_forcePhotoOverlay) return;
    document.removeEventListener('keydown', forcePhotoKeyBlock, true);
    _forcePhotoOverlay.remove();
    _forcePhotoOverlay = null;
    _forcePhotoFile = null;
    document.body.style.overflow = '';
}

// Dashboard Logout
const dashLogoutBtn = document.getElementById('dash-logout');
if (dashLogoutBtn) {
    dashLogoutBtn.addEventListener('click', () => {
        showLogoutConfirm();
    });
}

// ============================================
// ============================================
// PAYMENT MODAL & RECEIPT UPLOAD SYSTEM
// ============================================
function initPaymentSystem() {
    const paymentModal = document.getElementById('payment-modal');
    const payNowBtn = document.getElementById('pay-now-btn');
    const closeBtn = document.getElementById('close-payment-modal');
    const receiptInput = document.getElementById('receipt-file');
    const receiptPreview = document.getElementById('receipt-preview');
    const previewImg = document.getElementById('preview-img');
    const removeReceiptBtn = document.getElementById('remove-receipt');
    const submitPaymentBtn = document.getElementById('submit-payment-btn');
    const amountInput = document.getElementById('payment-amount');
    const pmOptions = document.querySelectorAll('.pm-option');
    let selectedMethod = "";

    if (payNowBtn && paymentModal) {
        payNowBtn.addEventListener('click', () => {
            openModal('payment-modal');
        });
    }

    if (closeBtn && paymentModal) {
        closeBtn.addEventListener('click', () => {
            closeModal('payment-modal');
        });
    }

    if (paymentModal) {
        paymentModal.addEventListener('click', (e) => {
            if (e.target === paymentModal) {
                closeModal('payment-modal');
            }
        });
    }

    // Clear workbook purchase marker when modal is closed without submitting
    var origCloseModal = window.closeModal;
    if (origCloseModal) {
        window.closeModal = function (modalId) {
            if (modalId === 'payment-modal' || !modalId) {
                var pm = document.getElementById('payment-modal');
                if (pm) {
                    pm.removeAttribute('data-workbook-purchase-id');
                    pm.removeAttribute('data-workbook-title');
                    pm.removeAttribute('data-workbook-pending-work-id');
                    pm.removeAttribute('data-workbook-pending-title');
                    pm.removeAttribute('data-workbook-pending-price');
                    pm.removeAttribute('data-summer-pending-course-id');
                    pm.removeAttribute('data-summer-pending-title');
                    pm.removeAttribute('data-summer-pending-phone');
                    pm.removeAttribute('data-summer-pending-name');
                    pm.removeAttribute('data-summer-pending-grade');
                }
            }
            origCloseModal(modalId);
        };
    }

    function validatePaymentForm() {
        const hasFile = receiptInput.files.length > 0;
        const hasAmount = amountInput.value.trim() !== "";
        const hasMethod = selectedMethod !== "";
        submitPaymentBtn.disabled = !(hasFile && hasAmount && hasMethod);
    }

    // Method Selection
    pmOptions.forEach(opt => {
        opt.onclick = () => {
            pmOptions.forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            selectedMethod = opt.getAttribute('data-method');
            validatePaymentForm();
        };
    });

    // Amount Input Listener
    if (amountInput) {
        amountInput.oninput = validatePaymentForm;
    }

    // Receipt Preview Logic
    if (receiptInput) {
        receiptInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                // Check file size (max 5MB raw before compression)
                if (file.size > 5 * 1024 * 1024) {
                    showToast("حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 5 ميجابايت.", "error");
                    receiptInput.value = "";
                    return;
                }

                const reader = new FileReader();
                reader.onload = (event) => {
                    // Compress image to fit within Firestore 1MB doc limit
                    const img = new Image();
                    img.onload = () => {
                        const MAX_DIM = 1200;
                        const QUALITY = 0.7;
                        let w = img.width, h = img.height;
                        if (w > MAX_DIM || h > MAX_DIM) {
                            const ratio = Math.min(MAX_DIM / w, MAX_DIM / h);
                            w *= ratio; h *= ratio;
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = w; canvas.height = h;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, w, h);
                        previewImg.src = canvas.toDataURL('image/jpeg', QUALITY);
                        receiptPreview.classList.remove('hidden');
                        validatePaymentForm();
                        const uploadBox = document.querySelector('.pay-upload-dashed');
                        if (uploadBox) uploadBox.style.display = 'none';
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            }
        };
    }

    if (removeReceiptBtn) {
        removeReceiptBtn.onclick = () => {
            receiptInput.value = '';
            receiptPreview.classList.add('hidden');
            const uploadBox = document.querySelector('.pay-upload-dashed');
            if (uploadBox) uploadBox.style.display = 'block';
            validatePaymentForm();
        };
    }

    // Submit Payment Request
    if (submitPaymentBtn) {
        submitPaymentBtn.onclick = async () => {
            let currentUser = null;
            try {
                const stored = localStorage.getItem('el_mistar_current_user');
                if (stored && stored !== "undefined") currentUser = JSON.parse(stored);
            } catch (e) { }
            if (!currentUser) {
                showToast("يرجى تسجيل الدخول أولاً", "error");
                return;
            }

            if (!previewImg.src || previewImg.src.includes('window.location')) {
                showToast("يرجى إرفاق صورة الإيصال أولاً", "error");
                return;
            }

            submitPaymentBtn.disabled = true;
            submitPaymentBtn.innerHTML = "<i class='bx bx-loader-alt bx-spin'></i> جاري الإرسال...";

            try {
                const db = window.db || firebase.firestore();
                const payModal = document.getElementById('payment-modal');
                var workbookPurchaseId = payModal ? payModal.getAttribute('data-workbook-purchase-id') : null;
                var pendingWorkId = payModal ? payModal.getAttribute('data-workbook-pending-work-id') : null;

                if (pendingWorkId) {
                    // Create workbook purchase with receipt image included
                    var workTitle = payModal.getAttribute('data-workbook-pending-title') || '';
                    var workPrice = parseFloat(payModal.getAttribute('data-workbook-pending-price')) || 0;
                    await db.collection('workbookPurchases').add({
                        workId: pendingWorkId,
                        workTitle: workTitle,
                        studentPhone: currentUser.phone,
                        studentName: currentUser.name || '',
                        price: workPrice,
                        status: 'pending',
                        paymentMethod: selectedMethod,
                        receiptImage: previewImg.src,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    payModal.removeAttribute('data-workbook-pending-work-id');
                    payModal.removeAttribute('data-workbook-pending-title');
                    payModal.removeAttribute('data-workbook-pending-price');
                    showToast("✅ تم تقديم طلب الشراء مع إيصال الدفع! سيتم تأكيده بعد المراجعة.", "success");
                } else if (payModal && payModal.getAttribute('data-summer-pending-course-id')) {
                    // Create summer course subscription with receipt
                    var courseId = payModal.getAttribute('data-summer-pending-course-id');
                    var courseTitle = payModal.getAttribute('data-summer-pending-title') || '';
                    var subPhone = payModal.getAttribute('data-summer-pending-phone') || '';
                    var subName = payModal.getAttribute('data-summer-pending-name') || '';
                    var subGrade = payModal.getAttribute('data-summer-pending-grade') || '';
                    var method = selectedMethod || 'cash';
                    await db.collection('courseSubscriptions').add({
                        courseId: courseId,
                        courseTitle: courseTitle,
                        name: subName,
                        phone: subPhone,
                        grade: subGrade,
                        email: currentUser.email || '',
                        paymentMethod: method,
                        receiptImage: previewImg.src,
                        status: 'pending',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    payModal.removeAttribute('data-summer-pending-course-id');
                    payModal.removeAttribute('data-summer-pending-title');
                    payModal.removeAttribute('data-summer-pending-phone');
                    payModal.removeAttribute('data-summer-pending-name');
                    payModal.removeAttribute('data-summer-pending-grade');
                    if (typeof SummerCourses !== 'undefined' && typeof SummerCourses.setUserSubscribed === 'function') {
                        SummerCourses.setUserSubscribed(courseId);
                    }
                    showToast("✅ تم تقديم طلب الاشتراك مع إيصال الدفع! سيتم تأكيده بعد المراجعة.", "success");
                } else if (workbookPurchaseId) {
                    // This is a workbook purchase receipt - update the workbookPurchases record
                    var workTitle = payModal.getAttribute('data-workbook-title') || '';
                    await db.collection('workbookPurchases').doc(workbookPurchaseId).update({
                        receiptImage: previewImg.src,
                        paymentMethod: selectedMethod,
                        status: 'pending'
                    });
                    // Clear the workbook purchase marker
                    payModal.removeAttribute('data-workbook-purchase-id');
                    payModal.removeAttribute('data-workbook-title');

                    showToast("✅ تم إرفاق الإيصال! سيتم تأكيد شراء \"" + workTitle + "\" بعد المراجعة.", "success");
                } else {
                    // Regular attendance payment
                    const paymentData = {
                        studentId: currentUser.id || currentUser.phone,
                        studentName: currentUser.name,
                        studentPhone: currentUser.phone,
                        studentGrade: currentUser.grade || "غير محدد",
                        receiptImage: previewImg.src,
                        amountPaid: parseFloat(amountInput.value),
                        paymentMethod: selectedMethod,
                        status: 'pending',
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    };

                    await db.collection("payment_requests").add(paymentData);

                    // Update UI immediately
                    const payNowBtn = document.getElementById('pay-now-btn');
                    if (payNowBtn) {
                        payNowBtn.disabled = true;
                        payNowBtn.style.opacity = '0.5';
                        payNowBtn.style.cursor = 'not-allowed';
                        payNowBtn.innerHTML = `<i class='bx bx-time-five'></i> قيد المراجعة ⏳`;
                    }
                    const pill = document.getElementById('nd-payment-pill');
                    if (pill) {
                        pill.innerHTML = `<span class="sd-badge badge-pending" style="background:#FEF3C7; color:#92400E; border:none;">⏳ قيد المراجعة</span>`;
                    }

                    showToast("✅ تم إرسال طلب الدفع بنجاح! سيتم مراجعته وتفعيل حسابك قريباً.", "success");
                }
                closeModal('payment-modal');

                // Reset form
                receiptInput.value = '';
                amountInput.value = '';
                pmOptions.forEach(o => o.classList.remove('selected'));
                selectedMethod = "";
                receiptPreview.classList.add('hidden');
                submitPaymentBtn.disabled = true;
                const uploadBox = document.querySelector('.pay-upload-dashed');
                if (uploadBox) uploadBox.style.display = 'block';
                const uploadBtn = document.querySelector('.upload-receipt-btn');
                if (uploadBtn) uploadBtn.style.display = 'flex';

                submitPaymentBtn.textContent = "إرسال طلب التحقق";
            } catch (err) {
                console.error('Payment Submission Error:', err);
                showToast("❌ حدث خطأ أثناء إرسال الطلب. يرجى المحاولة مرة أخرى.", "error");
                submitPaymentBtn.disabled = false;
                submitPaymentBtn.textContent = "إرسال طلب التحقق";
            }
        };
    }
}

// Call initialization
document.addEventListener('DOMContentLoaded', initPaymentSystem);
// Also call after dashboard population just in case
setTimeout(initPaymentSystem, 1000);


// ============================================
// CURRICULUM NAVIGATION (OPEN MODAL)
// ============================================
const sparkCurriculumSection = document.getElementById('my-portfolio');
const openCurriculumButtons = [
    document.getElementById('openCurriculumNav'),
    document.getElementById('openCurriculumModal')
];

openCurriculumButtons.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal('curriculum-modal');

            // Close mobile menu if open
            if (window.innerWidth <= 992) {
                if (typeof navLinks !== 'undefined' && navLinks.classList.contains('open')) {
                    navLinks.classList.remove('open');
                    hamburger.classList.remove('open');
                }
            }
        });
    }
});



// ============================================
// LETTERS MODAL MANAGEMENT
// ============================================
const lettersModal = document.getElementById('letters-modal');
const openLettersBtns = [
    document.getElementById('openLettersLevelCard'),
    document.getElementById('openLettersLevelCardModal')
];
const closeLettersBtn = document.querySelector('[data-close="letters-modal"]');

openLettersBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            openModal('letters-modal');
        });
    }
});

if (closeLettersBtn) {
    closeLettersBtn.addEventListener('click', () => {
        closeModal('letters-modal');
    });
}

if (lettersModal) {
    lettersModal.addEventListener('click', (e) => {
        if (e.target === lettersModal) {
            closeModal('letters-modal');
        }
    });
}

// ============================================
// SHORT VOWELS MODAL MANAGEMENT
// ============================================
const shortVowelsModal = document.getElementById('short-vowels-modal');
const openShortVowelsBtns = [
    document.getElementById('openShortVowelsLevelCard'),
    document.getElementById('openShortVowelsLevelCardModal')
];
const closeShortVowelsBtn = document.querySelector('[data-close="short-vowels-modal"]');

openShortVowelsBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            openModal('short-vowels-modal');
        });
    }
});

if (closeShortVowelsBtn) {
    closeShortVowelsBtn.addEventListener('click', () => {
        closeModal('short-vowels-modal');
    });
}

if (shortVowelsModal) {
    shortVowelsModal.addEventListener('click', (e) => {
        if (e.target === shortVowelsModal) {
            closeModal('short-vowels-modal');
        }
    });
}

// ============================================
// LONG VOWELS MODAL MANAGEMENT
// ============================================
const longVowelsModal = document.getElementById('long-vowels-modal');
const openLongVowelsBtns = [
    document.getElementById('openLongVowelsLevelCard'),
    document.getElementById('openLongVowelsLevelCardModal')
];
const closeLongVowelsBtn = document.querySelector('[data-close="long-vowels-modal"]');

openLongVowelsBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            openModal('long-vowels-modal');
        });
    }
});

if (closeLongVowelsBtn) {
    closeLongVowelsBtn.addEventListener('click', () => {
        closeModal('long-vowels-modal');
    });
}

if (longVowelsModal) {
    longVowelsModal.addEventListener('click', (e) => {
        if (e.target === longVowelsModal) {
            closeModal('long-vowels-modal');
        }
    });
}

// ============================================
// PRONOUNCER MODAL MANAGEMENT
// ============================================
const pronouncerModal = document.getElementById('pronouncer-modal');
const openPronouncerBtns = [
    document.getElementById('openPronouncerModal'),
    document.getElementById('openPronouncerMiniCard')
];
const closePronouncerBtn = document.querySelector('[data-close="pronouncer-modal"]');

openPronouncerBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', () => {
            openModal('pronouncer-modal');
        });
    }
});

if (closePronouncerBtn) {
    closePronouncerBtn.addEventListener('click', () => {
        closeModal('pronouncer-modal');
    });
}

if (pronouncerModal) {
    pronouncerModal.addEventListener('click', (e) => {
        if (e.target === pronouncerModal) {
            closeModal('pronouncer-modal');
        }
    });
}




// ============================================
// QR SCANNER MODAL MANAGEMENT (Lazy-loaded library)
// ============================================
const qrModal = document.getElementById('qr-modal');
const openQRBtns = [
    document.getElementById('openQRModal'),
    document.getElementById('openQRMiniCard')
];
const closeQRBtn = document.querySelector('[data-close="qr-modal"]');
const startQRBtn = document.getElementById('start-qr-btn');
const stopQRBtn = document.getElementById('stop-qr-btn');
const qrMsg = document.getElementById('qr-msg');

let html5QrCode = null;
let qrLibLoaded = false;

// Dynamically load the QR library only when the modal first opens (~200KB saved on initial load)
function loadQrLibrary() {
    return new Promise((resolve, reject) => {
        if (qrLibLoaded) { resolve(); return; }
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode';
        script.onload = () => { qrLibLoaded = true; resolve(); };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

openQRBtns.forEach(btn => {
    if (btn) {
        btn.addEventListener('click', async () => {
            openModal('qr-modal');
            // Pre-load library in background while modal animation plays
            loadQrLibrary().catch(err => console.warn('QR library load failed', err));
        });
    }
});

function stopScanner() {
    if (html5QrCode && html5QrCode.isScanning) {
        html5QrCode.stop().then(() => {
            startQRBtn.style.display = 'block';
            stopQRBtn.style.display = 'none';
            qrMsg.innerText = "بانتظار قراءة الكود... 🔍";
        }).catch(err => console.error("Failed to stop scanner", err));
    }
}

if (closeQRBtn) {
    closeQRBtn.addEventListener('click', () => {
        closeModal('qr-modal');
        stopScanner();
    });
}

if (qrModal) {
    qrModal.addEventListener('click', (e) => {
        if (e.target === qrModal) closeModal('qr-modal');
    });
}

if (startQRBtn) {
    startQRBtn.addEventListener('click', async () => {
        if (!qrLibLoaded) {
            qrMsg.innerText = "جاري تحميل المكتبة... ⏳";
            startQRBtn.disabled = true;
            try {
                await loadQrLibrary();
            } catch (e) {
                qrMsg.innerText = "فشل تحميل مكتبة QR. تحقق من الاتصال.";
                startQRBtn.disabled = false;
                return;
            }
        }

        if (!html5QrCode) {
            html5QrCode = new Html5Qrcode("reader");
        }

        qrMsg.innerText = "جاري تشغيل الكاميرا... ⏳";
        startQRBtn.disabled = true;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                qrMsg.innerHTML = `<strong>تم القراءة!</strong><br><a href="${decodedText}" target="_blank" style="color:var(--accent); text-decoration:underline;">${decodedText}</a>`;
                if (navigator.vibrate) navigator.vibrate(100);
                stopScanner();
            },
            () => { }
        ).then(() => {
            startQRBtn.style.display = 'none';
            startQRBtn.disabled = false;
            stopQRBtn.style.display = 'block';
            qrMsg.innerText = "قم بتوجيه الكاميرا نحو الكود 🔍";
        }).catch(err => {
            console.error("Camera start failed", err);
            qrMsg.innerText = "فشل تشغيل الكاميرا. يرجى التأكد من إعطاء صلاحية الوصول.";
            startQRBtn.disabled = false;
        });
    });
}

if (stopQRBtn) {
    stopQRBtn.addEventListener('click', stopScanner);
}



// Play Sound Logic — Event delegation (1 listener instead of 26)
let currentAudio = null;
let currentPlayingBtn = null;

function stopCurrentSound() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (currentPlayingBtn) {
        currentPlayingBtn.innerText = "استمع 🔊";
        currentPlayingBtn.classList.remove('playing');
        currentPlayingBtn = null;
    }
    window.speechSynthesis.cancel();
}

// Single delegated listener on the letters modal body
const lettersModalBody = document.querySelector('#letters-modal .modal-body');
if (lettersModalBody) {
    lettersModalBody.addEventListener('click', (e) => {
        const btn = e.target.closest('.play-sound-btn');
        if (!btn) return;
        e.stopPropagation();

        // Toggle off if same button
        if (currentPlayingBtn === btn) {
            stopCurrentSound();
            return;
        }

        stopCurrentSound();

        const card = btn.closest('.letter-card-item');
        if (!card) return;
        const img = card.querySelector('.letter-card-img');
        const nameEl = card.querySelector('.letter-name');
        const name = nameEl ? nameEl.innerText : '';

        let letter = '';
        if (img && img.getAttribute('src')) {
            letter = img.getAttribute('src').split('/').pop().split('.')[0].toLowerCase();
        }

        const audioFileName = (letter === 'a') ? 'A' : letter;
        const audioPath = `audio/Jolly/${audioFileName}.mp3`;

        btn.innerText = "جاري التشغيل...";
        btn.classList.add('playing');
        currentPlayingBtn = btn;

        const audio = new Audio(audioPath);
        currentAudio = audio;

        audio.onended = () => {
            if (currentPlayingBtn === btn) {
                btn.innerText = "استمع 🔊";
                btn.classList.remove('playing');
                currentAudio = null;
                currentPlayingBtn = null;
            }
        };

        audio.onerror = () => {
            // Fallback to TTS
            const utterance = new SpeechSynthesisUtterance(name.split(' — ')[0]);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            utterance.onend = () => {
                btn.innerText = "استمع 🔊";
                btn.classList.remove('playing');
                currentPlayingBtn = null;
            };
            window.speechSynthesis.speak(utterance);
        };

        audio.play().catch(() => audio.onerror());
    });
}


// ============================================
// INSTANT PRONOUNCER: LOGIC
// ============================================
const ttsInput = document.getElementById('tts-input');
const listenBtn = document.getElementById('listen-btn');
const recordBtn = document.getElementById('record-btn');
const recognitionDisplay = document.getElementById('recognition-display');
const recordingStatus = document.getElementById('recording-status');

const phoneticDisplay = document.getElementById('phonetic-display');

async function fetchPhonetic(word) {
    if (!word || word.includes(' ')) return '';
    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
        const data = await response.json();
        if (data && data[0] && data[0].phonetic) {
            return data[0].phonetic;
        } else if (data && data[0] && data[0].phonetics) {
            const p = data[0].phonetics.find(ph => ph.text);
            return p ? p.text : '';
        }
        return '';
    } catch (e) {
        return '';
    }
}

if (listenBtn) {
    listenBtn.addEventListener('click', async () => {
        const text = ttsInput.value.trim();
        if (!text) {
            showToast("يرجى كتابة كلمة أو جملة للاستماع إليها", "info");
            return;
        }

        // Show phonetic if it's a single word
        const phonetic = await fetchPhonetic(text);
        if (phonetic) {
            phoneticDisplay.innerText = phonetic;
            phoneticDisplay.classList.add('active');
        } else {
            phoneticDisplay.classList.remove('active');
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';

        // Use a natural default speed
        utterance.rate = 0.9;

        // Try to find a premium English voice
        const voices = window.speechSynthesis.getVoices();
        const premiumVoice = voices.find(v => (v.name.includes('Google') || v.name.includes('Premium')) && v.lang.startsWith('en'));
        if (premiumVoice) utterance.voice = premiumVoice;

        listenBtn.disabled = true;
        listenBtn.innerText = "جاري النطق... 🔊";

        utterance.onend = () => {
            listenBtn.disabled = false;
            listenBtn.innerText = "استمع | LISTEN 🔊";
        };

        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
    });
}

if (recordBtn) {
    let recognition;
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.onstart = () => {
            recordBtn.innerText = "جاري التسجيل... 🔴";
            recordBtn.classList.add('btn-danger');
            recordingStatus.innerHTML = '<span class="st-recording">يتم الاستماع الآن...</span>';
            recognitionDisplay.classList.add('active');
            recognitionDisplay.innerText = "تحدث الآن...";
        };
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            recognitionDisplay.innerText = `لقد قلت: "${transcript}"`;
            recognitionDisplay.classList.remove('active');
        };
        recognition.onerror = (event) => {
            recognitionDisplay.innerText = "حدث خطأ أثناء التسجيل. حاول مرة أخرى.";
            recognitionDisplay.classList.remove('active');
        };
        recognition.onend = () => {
            recordBtn.innerText = "سجل صوتك | RECORD 🎙️";
            recordBtn.classList.remove('btn-danger');
            recordingStatus.innerHTML = '';
        };
        recordBtn.addEventListener('click', () => {
            try { recognition.start(); } catch (e) { recognition.stop(); }
        });
    } else {
        recordBtn.disabled = true;
        recordBtn.innerText = "خاصية التسجيل غير مدعومة";
    }
}

// ============================================
// LIGHTBOX: View image in full size
// ============================================
const lightboxOverlay = document.getElementById('lightbox-overlay');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const imagePopupsEnabled = true;

if (!imagePopupsEnabled) {
    lightboxOverlay?.classList.remove('active', 'lesson-mode');
    document.getElementById('global-lightbox')?.classList.remove('active');
    document.body.style.overflow = '';
}

function openImageLightbox(img) {
    const globalLightbox = document.getElementById('global-lightbox');
    const fullImg = document.getElementById('lightbox-img-full');
    if (!globalLightbox || !fullImg || !img) return false;

    fullImg.src = img.currentSrc || img.src;
    fullImg.alt = img.alt || 'Full image view';
    globalLightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    return true;
}

// Modal content elements
const lessonView = document.getElementById('lesson-view');
const lessonClose = document.getElementById('lesson-view-close');

function showLesson(lessonId) {
    const lesson = lessonsData.find(l => l.id === lessonId);
    if (!lesson) return;

    // Fill content
    document.getElementById('lesson-view-img').src = lesson.image;
    document.getElementById('lesson-modal-title').textContent = lesson.title;
    document.getElementById('lesson-modal-story').textContent = lesson.story;
    document.getElementById('lesson-modal-action').textContent = lesson.action;

    // Show inline view
    lessonView.classList.add('active');
    lessonView.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Stop sounds
    stopCurrentSound();
}

if (lessonClose) {
    lessonClose.addEventListener('click', () => {
        lessonView.classList.remove('active');
        stopCurrentSound();
    });
}

const clickableImages = document.querySelectorAll('.letter-card-img-wrap img, .hero-img, .student-img-container img, .gallery-item img');

clickableImages.forEach(img => {
    if (imagePopupsEnabled) img.style.cursor = 'zoom-in';
    img.addEventListener('click', (e) => {
        if (!imagePopupsEnabled) return;
        e.preventDefault();
        e.stopPropagation();
        if (openImageLightbox(img)) return;

        const card = img.closest('.letter-card-item');

        if (card) {
            // It's a lesson card - populate full infographic
            const name = card.querySelector('.letter-name').innerText;
            const story = card.querySelector('.detail-item:nth-child(1)').innerText.replace('القصة:', '').trim();
            const movement = card.querySelector('.detail-item:nth-child(2)').innerText.replace('الحركة:', '').trim();
            const playBtn = card.querySelector('.play-sound-btn');

            if (lessonModalTitle) lessonModalTitle.innerText = name;
            if (lessonModalStory) lessonModalStory.innerText = story;
            if (lessonModalMovement) lessonModalMovement.innerText = movement;
            // Also update lightbox modal duplicate elements if they exist
            const lbMovement = document.getElementById('lb-modal-movement');
            const lbTitle = document.getElementById('lb-modal-title');
            const lbStory = document.getElementById('lb-modal-story');
            if (lbMovement) lbMovement.innerText = movement;
            if (lbTitle) lbTitle.innerText = name;
            if (lbStory) lbStory.innerText = story;

            // Sync play button
            const lbPlayBtn = document.getElementById('lb-modal-play');
            if (lbPlayBtn && playBtn) {
                lbPlayBtn.onclick = () => playBtn.click();
            }

            lightboxOverlay.classList.add('lesson-mode');
        } else {
            lightboxOverlay.classList.remove('lesson-mode');
        }

        lightboxImg.src = img.src;
        lightboxImg.alt = img.alt || 'Extended view';
        lightboxOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    });
});

if (lightboxClose) {
    lightboxClose.addEventListener('click', () => {
        lightboxOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });
}

if (lightboxOverlay) {
    lightboxOverlay.addEventListener('click', (e) => {
        if (e.target === lightboxOverlay) {
            lightboxOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

// ============================================
// CURRICULUM PODCAST AUDIO (ELMISTAR)
// ============================================
const elmistarAudioTriggers = document.querySelectorAll('.Elmistar-audio-trigger');
const elmistarAudioEl = document.querySelector('.Elmistar-audio-el');

elmistarAudioTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
        if (!elmistarAudioEl) return;

        if (elmistarAudioEl.paused) {
            elmistarAudioEl.play();
            trigger.classList.add('playing');
        } else {
            elmistarAudioEl.pause();
            trigger.classList.remove('playing');
        }
    });
});

if (elmistarAudioEl) {
    elmistarAudioEl.addEventListener('ended', () => {
        elmistarAudioTriggers.forEach(t => t.classList.remove('playing'));
    });
}

// Keep the old spark audio triggers if they still exist elsewhere
const audioTriggers = document.querySelectorAll('.spark-audio-trigger');
const sparkAudio = document.querySelector('.spark-audio-el');

audioTriggers.forEach(trigger => {
    trigger.addEventListener('click', () => {
        if (!sparkAudio) return;

        if (sparkAudio.paused) {
            sparkAudio.play();
            trigger.classList.add('playing');
        } else {
            sparkAudio.pause();
            trigger.classList.remove('playing');
        }
    });
});

if (sparkAudio) {
    sparkAudio.addEventListener('ended', () => {
        audioTriggers.forEach(t => t.classList.remove('playing'));
    });
}

// ============================================
// CURRICULUM LEVELS TABS LOGIC
// ============================================
const selectorBtns = document.querySelectorAll('.selector-btn');
const levelsGrid = document.getElementById('curriculum-levels-grid');
const levelCards = levelsGrid ? levelsGrid.querySelectorAll('.level-card') : [];

selectorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const levelNum = btn.getAttribute('data-level');

        // Update buttons active state
        selectorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update cards visibility
        levelCards.forEach(card => card.classList.remove('active-card'));
        const targetCard = levelCards[levelNum - 1];
        if (targetCard) {
            targetCard.classList.add('active-card');
        }
    });
});


// ============================================
// FULL-PAGE NAVIGATION SYSTEM
// ============================================
(function () {
        const pageSections = ['home', 'my-portfolio', 'contact'];
    const dots = document.querySelectorAll('.page-dot');
    const progressBar = document.getElementById('scrollProgressBar');
    const currentPageNum = document.getElementById('currentPageNum');

    // Scroll progress bar
    function updateScrollProgress() {
        if (!progressBar) return;
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const progress = docHeight > 0 ? scrollTop / docHeight : 0;
        progressBar.style.transform = `scaleX(${progress})`;
        progressBar.style.transformOrigin = 'left';
    }



    // Scroll to section smoothly
    function scrollToSection(id) {
        const target = document.getElementById(id);
        if (!target) return;

        // With snap scrolling, just scroll to the element
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Dot click handlers
    dots.forEach(dot => {
        dot.addEventListener('click', () => {
            const targetId = dot.getAttribute('data-target');
            scrollToSection(targetId);
        });
    });

    // Scroll event listener (Optimized)
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                updateScrollProgress();
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });

    // Keyboard navigation (Arrow Up/Down between sections)
    window.addEventListener('keydown', (e) => {
        // Don't intercept if inside an input/textarea/modal
        const tag = document.activeElement.tagName.toLowerCase();
        if (['input', 'textarea', 'select'].includes(tag)) return;
        const activeModal = document.querySelector('.modal-overlay.active, .auth-overlay.active');
        if (activeModal) return;

    const pageSections = ['home', 'my-portfolio', 'contact'];
        const idx = pageSections.indexOf(currentSectionId);

        if (e.key === 'ArrowDown' || e.key === 'PageDown') {
            const nextIdx = Math.min(idx + 1, pageSections.length - 1);
            if (nextIdx !== idx) {
                e.preventDefault();
                scrollToSection(pageSections[nextIdx]);
            }
        } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            const prevIdx = Math.max(idx - 1, 0);
            if (prevIdx !== idx) {
                e.preventDefault();
                scrollToSection(pageSections[prevIdx]);
            }
        }
    });

    // Initial state
    updateScrollProgress();
})();

// ============================================
// GLOBAL IMAGE LIGHTBOX LOGIC
// ============================================
(function initGlobalLightbox() {
    if (!imagePopupsEnabled) return;

    const globalLightbox = document.getElementById('global-lightbox');
    const fullImg = document.getElementById('lightbox-img-full');
    const lightboxCloseBtn = document.querySelector('.lightbox-close');

    if (globalLightbox && fullImg) {
        // Attach click listener to all images on the page
        document.addEventListener('click', (e) => {
            const clickedImg = e.target.closest('img');

            // Exceptions: Don't lightbox small icons or specific excluded images
            if (clickedImg &&
                !clickedImg.closest('.logo-img') &&
                !clickedImg.closest('.p-avatar-wrap') &&
                !clickedImg.classList.contains('no-lightbox')) {

                fullImg.src = clickedImg.src;
                globalLightbox.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });

        // Close lightbox
        const closeLBox = () => {
            globalLightbox.classList.remove('active');
            document.body.style.overflow = '';
            setTimeout(() => { fullImg.src = ''; }, 300);
        };

        if (lightboxCloseBtn) {
            lightboxCloseBtn.addEventListener('click', closeLBox);
        }

        globalLightbox.addEventListener('click', (e) => {
            if (e.target === globalLightbox || e.target === fullImg) {
                closeLBox();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && globalLightbox.classList.contains('active')) {
                closeLBox();
            }
        });
    }
})();

// ============================================
// FINANCE SECTION TOGGLE
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const showFinanceBtn = document.getElementById('show-finance-btn');
    const financeCard = document.getElementById('finance-card');

    if (showFinanceBtn && financeCard) {
        showFinanceBtn.addEventListener('click', () => {
            const isHidden = financeCard.classList.contains('hidden');
            if (isHidden) {
                financeCard.classList.remove('hidden');
                financeCard.classList.add('visible');
                showFinanceBtn.innerHTML = `
                    <span class="sd-info-icon"><i class='bx bxs-hide'></i></span>
                    <span class="sd-info-text">إخفاء الحساب المالي</span>
                `;
                // Optional: Scroll to it
                financeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                financeCard.classList.add('hidden');
                financeCard.classList.remove('visible');
                showFinanceBtn.innerHTML = `
                    <span class="sd-info-icon"><i class='bx bxs-wallet'></i></span>
                    <span class="sd-info-text">عرض المبالغ المستحقة</span>
                `;
            }
        });
    }
});

// ============================================
// SEO MODALS HANDLER
// ============================================
function openSeoModal(modalId) {
    openModal(modalId);
}

function closeSeoModal(modalId) {
    closeModal(modalId);
}

function closeAllSeoModals() {
    document.querySelectorAll('.seo-modal.active').forEach(m => {
        m.classList.remove('active');
    });
    document.body.style.overflow = '';
}

// Add generic listener for data-close on SEO Modals
document.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-close]');
    if (closeBtn) {
        const modalId = closeBtn.getAttribute('data-close');
        const modalEl = document.getElementById(modalId);
        if (modalId && modalEl && modalEl.classList.contains('seo-modal')) {
            closeSeoModal(modalId);
        }
    }
    
    const seoModal = e.target.closest('.seo-modal');
    if (seoModal && e.target === seoModal) {
        closeSeoModal(seoModal.id);
    }
});

// ============================================
// CURRICULUM MODAL MANAGEMENT
// ============================================
const curriculumModal = document.getElementById('curriculum-modal');
const closeCurriculumBtn = document.querySelector('[data-close="curriculum-modal"]');

if (closeCurriculumBtn) {
    closeCurriculumBtn.addEventListener('click', () => {
        closeModal('curriculum-modal');
    });
}

if (curriculumModal) {
    curriculumModal.addEventListener('click', (e) => {
        if (e.target === curriculumModal) {
            closeModal('curriculum-modal');
        }
    });
}

// ============================================
// AUTO-REFRESH: Sync data when tab becomes visible
// ============================================
function refreshAllData() {
    // Refresh user subscriptions for summer courses (re-fetches courseSubscriptions from Firestore)
    if (typeof SummerCourses !== 'undefined' && typeof SummerCourses.refreshUserSubscriptions === 'function') {
        SummerCourses.refreshUserSubscriptions();
    }
    // Refresh user dashboard data (re-fetches from Firestore query)
    try {
        var stored = localStorage.getItem('el_mistar_current_user');
        if (stored && stored !== 'undefined') {
            var user = JSON.parse(stored);
            if (user && user.phone) {
                populateDashboard(user);
            }
        }
    } catch (e) {}
}

document.addEventListener('visibilitychange', function () {
    if (!document.hidden) {
        refreshAllData();
    }
});

window.addEventListener('focus', function () {
    refreshAllData();
});

// ============================================
// ANNOUNCEMENT DISPLAY
// ============================================
var _announcementTracked = false;
function loadAndShowAnnouncement() {
    if (!window.db) {
        setTimeout(loadAndShowAnnouncement, 500);
        return;
    }
    // Get latest announcement (avoid composite index by not using where+orderBy together)
    window.db.collection("announcements")
        .orderBy("createdAt", "desc")
        .limit(1)
        .get()
        .then(function (snapshot) {
            if (snapshot.empty) {
                console.log('[ANNOUNCEMENT] No announcements found');
                return;
            }
            var doc = snapshot.docs[0];
            var ann = doc.data();
            ann.id = doc.id;

            // Only show if active
            if (ann.isActive !== true) {
                console.log('[ANNOUNCEMENT] Latest announcement is not active');
                return;
            }

            showAnnouncementModal(ann);
        })
        .catch(function (err) {
            console.error('[ANNOUNCEMENT] Load error:', err);
        });
}

function showAnnouncementModal(ann) {
    var modal = document.getElementById('announcement-modal');
    if (!modal) return;

    var imageWrap = document.getElementById('announcement-image-wrap');
    var imageEl = document.getElementById('announcement-image');

    if (ann.imageUrl && imageWrap && imageEl) {
        imageEl.src = ann.imageUrl;
        imageWrap.style.display = 'flex';
    } else {
        return; // no image to show
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    var closeBtn = document.getElementById('announcement-close-btn');
    if (closeBtn) {
        closeBtn.onclick = function () {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        };
    }
    modal.onclick = function (e) {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };
}

// ============================================
// SESSION SETTINGS LOADER (real-time)
// ============================================
var _sessionSettingsUnsub = null;
var _sessionSettingsListenerSetup = false;
function loadSessionSettingsFromFirestore() {
    window.__fbTracker && window.__fbTracker.add();
    if (!window.db) { window.__fbTracker && window.__fbTracker.done(); return Promise.resolve(); }
    return new Promise(function (resolve) {
        window.db.collection("settings").doc("sessionConfig")
            .get()
            .then(function (doc) {
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
                updateStaticPriceDisplay();
                window.__fbTracker && window.__fbTracker.done();
                resolve();
                // Set up real-time listener for subsequent updates
                _setupSessionSettingsListener();
            })
            .catch(function () {
                window.__fbTracker && window.__fbTracker.done();
                resolve();
            });
    });
}

function _setupSessionSettingsListener() {
    if (_sessionSettingsListenerSetup) return;
    _sessionSettingsListenerSetup = true;
    _sessionSettingsUnsub = window.db.collection("settings").doc("sessionConfig")
        .onSnapshot(function (doc) {
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
            updateStaticPriceDisplay();
        }, function () {});
}

function updateStaticPriceDisplay() {
    var sessionPrice = getPriceForYear('current');
    var monthlyTotal = sessionPrice * getSessionsForYear('current');
    var priceEl = document.getElementById('price-per-session-text');
    var monthlyEl = document.getElementById('monthly-total-text');
    if (priceEl) priceEl.textContent = sessionPrice;
    if (monthlyEl) monthlyEl.textContent = monthlyTotal;
    var badge = document.getElementById('dash-attendance-badge');
    if (badge) badge.textContent = 'سعر الحصة ' + sessionPrice + ' ج';
    var termsPrice = document.querySelector('.terms-price-value');
    if (termsPrice) termsPrice.textContent = sessionPrice;
    var termsMonthly = document.getElementById('terms-monthly-total');
    if (termsMonthly) termsMonthly.textContent = monthlyTotal;
    if (_activeNotesData) renderSignupNotes(_activeNotesData);
}

// ============================================
// SIGNUP NOTES (settings/notes)
// ============================================
var _signupNotesUnsub = null;
var _signupNotesListenerSetup = false;
var _defaultNotesHTML = null;
var _activeNotesData = null;

function loadSignupNotesFromFirestore() {
    var contentEl = document.getElementById('auth-notes-content');
    if (contentEl && _defaultNotesHTML === null) {
        _defaultNotesHTML = contentEl.innerHTML;
    }
    if (!window.db) return Promise.resolve();
    return new Promise(function (resolve) {
        window.db.collection("settings").doc("notes")
            .get()
            .then(function (doc) {
                if (doc.exists && doc.data() && doc.data().message) {
                    renderSignupNotes(doc.data());
                }
                _setupSignupNotesListener();
                resolve();
            })
            .catch(function () {
                resolve();
            });
    });
}

function _setupSignupNotesListener() {
    if (_signupNotesListenerSetup) return;
    _signupNotesListenerSetup = true;
    _signupNotesUnsub = window.db.collection("settings").doc("notes")
        .onSnapshot(function (doc) {
            if (doc.exists && doc.data() && doc.data().message) {
                renderSignupNotes(doc.data());
            } else {
                _activeNotesData = null;
                if (_defaultNotesHTML !== null) {
                    var contentEl = document.getElementById('auth-notes-content');
                    var summaryEl = document.getElementById('auth-notes-summary');
                    if (contentEl) contentEl.innerHTML = _defaultNotesHTML;
                    if (summaryEl) summaryEl.textContent = 'إضغط هنا لقراءة ملاحظات هامة جداً ⚠️';
                }
            }
        }, function () {});
}

function renderSignupNotes(data) {
    _activeNotesData = data;
    var contentEl = document.getElementById('auth-notes-content');
    var summaryEl = document.getElementById('auth-notes-summary');
    if (!contentEl) return;
    var title = (data && data.title && data.title.trim()) ? data.title.trim() : 'إضغط هنا لقراءة ملاحظات هامة جداً ⚠️';
    var lines = String(data.message || '')
        .split('\n')
        .map(function (l) { return l.trim(); })
        .filter(function (l) { return l.length > 0; });
    var sessionPrice = getPriceForYear('current');
    var monthlyTotal = sessionPrice * getSessionsForYear('current');
    var html = '<ul>';
    lines.forEach(function (line) {
        var safe = line
            .replace(/\{price\}/g, sessionPrice)
            .replace(/\{monthly\}/g, monthlyTotal);
        var escaped = escapeHtml(safe);
        var liClass = '';
        if (/\!|مهم|⚠|استبعاد|danger|حرام/.test(safe)) {
            liClass = ' style="border-color:#EF4444;background:rgba(254,226,226,0.5);"';
        }
        html += '<li' + liClass + '>' + escaped + '</li>';
    });
    html += '</ul>';
    contentEl.innerHTML = html;
    if (summaryEl) summaryEl.textContent = title;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ============================================
// ENROLLMENT NEW YEAR
// ============================================
function initEnrollmentSection(student, studentId) {
    var section = document.getElementById('enrollment-section');
    var content = document.getElementById('enrollment-content');
    if (!section || !content) return;

    // Check if enrollment is enabled from admin settings
    if (window.db) {
        window.db.collection("settings").doc("enrollment").get().then(function (doc) {
            if (doc.exists && doc.data().enabled === false) {
                section.style.display = 'none';
                return;
            }
            showEnrollmentContent(section, content, student, studentId);
        }).catch(function () {
            // If error reading setting, show content anyway
            showEnrollmentContent(section, content, student, studentId);
        });
    } else {
        showEnrollmentContent(section, content, student, studentId);
    }
}

function showEnrollmentContent(section, content, student, studentId) {
    // Show section immediately
    section.style.display = 'block';

    var isSummer = student.academicYear === 'summer';

    var attendance = student.attendance || [];
    var attendanceCount = Array.isArray(attendance) ? attendance.length : (parseInt(attendance) || 0);
    var paid = student.paid || 0;
    var otherExpenses = student.otherExpenses || 0;
    var yrPrice = getPriceForYear(student.academicYear);
    var yrSessions = getSessionsForYear(student.academicYear);
    var totalSessions = student.totalSessions || yrSessions;
    var requiredSoFar = (attendanceCount * yrPrice) + otherExpenses;
    var remaining = Math.max(0, requiredSoFar - paid);
    var hasAllPaid = remaining === 0;

    function showPendingStatus() {
        content.innerHTML = '<div style="text-align:center;">' +
            '<div style="font-size:3rem;margin-bottom:10px;">📋</div>' +
            '<h3 style="color:#1e293b;margin-bottom:8px;">طلب الالتحاق بالعام الجديد</h3>' +
            '<p style="color:#64748b;">حالة طلبك: <span style="background:#d9770620;color:#d97706;padding:4px 14px;border-radius:20px;font-weight:800;">قيد الانتظار ⏳</span></p>' +
            '<p style="color:#94a3b8;font-size:0.85rem;">سيتم مراجعة طلبك من قبل المعلم قريباً</p>' +
            '</div>';
    }

    function showApplyButton() {
        content.innerHTML = '<div style="text-align:center;">' +
            '<div style="font-size:3rem;margin-bottom:10px;">🎓</div>' +
            '<h3 style="color:#1e293b;margin-bottom:8px;">الالتحاق بالعام الدراسي الجديد</h3>' +
            (isSummer ? '<p style="color:#d97706;font-weight:700;margin-bottom:8px;">☀️ سيتم تعليق الطلب إلى حين الانتهاء من الكورس الصيفي</p>' : '') +
            '<p style="color:#64748b;margin-bottom:16px;">' +
            (hasAllPaid ? 'جميع المستحقات المالية مسددة ✅' : 'يجب دفع جميع المستحقات المالية أولاً') +
            '</p>' +
            (hasAllPaid ? '<button id="apply-enroll-btn" class="sd-pay-btn-new" style="font-size:1.1rem;padding:14px 32px;background:linear-gradient(135deg,#d97706,#f59e0b);display:inline-flex;width:auto;">' +
            '<i class="bx bxs-calendar-plus"></i> تقديم طلب الالتحاق</button>' : '<p style="color:#ef4444;font-weight:700;font-size:1.1rem;">المتبقي: ' + remaining + ' ج.م</p><p style="color:#94a3b8;font-size:0.85rem;">قم بسداد المبلغ المتبقي عبر زر الدفع أعلاه</p>') +
            '</div>';
        var btn = document.getElementById('apply-enroll-btn');
        if (btn) {
            btn.onclick = function () {
                submitEnrollmentRequest(student, studentId);
            };
        }
    }

    function showStatusInfo(status, reason) {
        var statusLabels = { pending: 'قيد الانتظار ⏳', approved: 'تم القبول ✅', rejected: 'تم الرفض ❌', deactivated: 'ملغي 🔴' };
        var statusColors = { pending: '#d97706', approved: '#10b981', rejected: '#ef4444', deactivated: '#6b7280' };
        var status = status || 'pending';
        content.innerHTML = '<div style="text-align:center;">' +
            '<div style="font-size:3rem;margin-bottom:10px;">📋</div>' +
            '<h3 style="color:#1e293b;margin-bottom:8px;">طلب الالتحاق بالعام الجديد</h3>' +
            '<p style="color:#64748b;margin-bottom:12px;">' +
            'حالة طلبك: <span style="background:' + (statusColors[status] || '#6b7280') + '20;color:' + (statusColors[status] || '#6b7280') + ';padding:4px 14px;border-radius:20px;font-weight:800;">' + (statusLabels[status] || status) + '</span>' +
            '</p>' +
            (status === 'approved' ? '<p style="color:#10b981;font-weight:700;">🎉 تهانينا! تم قبول طلب الالتحاق</p><button onclick="location.reload();" style="margin-top:14px;padding:12px 28px;background:#10b981;color:#fff;border:none;border-radius:10px;font-size:1rem;font-weight:700;cursor:pointer;">متابعة</button>' : '') +
            (status === 'rejected' ? '<p style="color:#ef4444;font-weight:700;">عذراً، تم رفض طلب الالتحاق</p>' + (reason ? '<p style="color:#991b1b;font-size:0.95rem;margin-top:8px;">سبب الرفض: ' + reason + '</p>' : '') : '') +
            (status === 'deactivated' ? '<p style="color:#6b7280;font-weight:700;">تم إلغاء طلب الالتحاق</p>' : '') +
            '</div>';
    }

    // Show button/dues first
    showApplyButton();

    // Then check for existing request in background (simple query, no index needed)
    if (window.db && student.phone) {
        window.db.collection("enrollmentRequests")
            .where("studentPhone", "==", student.phone)
            .get()
            .then(function (snap) {
                if (!snap.empty) {
                    var req = snap.docs[0].data();
                    showStatusInfo(req.status, req.rejectionReason);
                }
            })
            .catch(function (err) {
                console.error('[ENROLLMENT] Load error:', err);
            });
    }
}

function getNextGrade(currentGrade) {
    if (!currentGrade) return 'الصف الأول الابتدائي';
    var g = currentGrade.toString().trim();
    var gradeMap = {
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

function showIncompleteRegistrationModal(student, missingItems) {
    if (document.getElementById('incomplete-reg-modal')) return;

    var itemsHtml = missingItems.map(function (item) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(239,68,68,0.08);border-radius:10px;margin-bottom:8px;border:1px solid rgba(239,68,68,0.15);">' +
            '<span style="font-size:20px;">' + item.icon + '</span>' +
            '<div style="flex:1;text-align:right;">' +
                '<div style="font-weight:700;color:#f1f5f9;font-size:14px;">' + item.label + '</div>' +
                '<div style="font-size:12.5px;color:#94a3b8;margin-top:2px;">' + item.desc + '</div>' +
            '</div>' +
            '<span style="color:#ef4444;font-size:18px;">❌</span>' +
        '</div>';
    }).join('');

    var overlay = document.createElement('div');
    overlay.id = 'incomplete-reg-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;background:rgba(2,6,23,0.88);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(8px);animation:fadeIn 0.3s ease;';

    overlay.innerHTML =
        '<div style="background:#0f172a;border:2px solid rgba(239,68,68,0.3);border-radius:24px;padding:36px 28px;max-width:440px;width:92%;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,0.6);animation:modalPop 0.3s cubic-bezier(0.34,1.56,0.64,1);max-height:90vh;overflow-y:auto;">' +
            '<div style="font-size:52px;margin-bottom:10px;">⚠️</div>' +
            '<h2 style="font-size:20px;font-weight:900;color:#f8fafc;margin:0 0 8px;">بيانات التسجيل غير مكتملة</h2>' +
            '<p style="font-size:14px;color:#94a3b8;margin:0 0 18px;line-height:1.7;">لا يمكن إتمام طلب الالتحاق بالعام الدراسي الجديد لعدم توافر بعض البيانات المطلوبة</p>' +
            '<div style="text-align:right;margin-bottom:20px;">' + itemsHtml + '</div>' +
            '<button id="incompleteRegFixBtn" style="width:100%;margin-top:6px;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#fbbf24,#f59e0b);color:#1e1b16;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s;box-shadow:0 4px 0 #b45309;">' +
                '📝 إكمال البيانات المطلوبة' +
            '</button>' +
            '<button id="incompleteRegLogoutBtn" style="width:100%;margin-top:10px;padding:12px;border:2px solid rgba(239,68,68,0.4);border-radius:12px;background:transparent;color:#f87171;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;">تسجيل الخروج</button>' +
        '</div>';

    document.body.appendChild(overlay);

    var fixBtn = overlay.querySelector('#incompleteRegFixBtn');
    var logoutBtn = overlay.querySelector('#incompleteRegLogoutBtn');

    fixBtn.addEventListener('click', function () {
        overlay.remove();
        if (missingItems.some(function (i) { return i.key === 'profileImage'; })) {
            showForceProfilePhotoModal(student);
        }
    });

    logoutBtn.addEventListener('click', function () {
        logoutAndRefresh();
    });

    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
    });
}

function submitEnrollmentRequest(student, studentId) {
    if (!window.db) {
        showToast('خطأ في الاتصال بقاعدة البيانات', 'error');
        return;
    }

    var missingItems = [];

    if (!student.name || !student.name.trim()) {
        missingItems.push({ key: 'name', icon: '👤', label: 'اسم الطالب', desc: 'لم يتم تسجيل اسم الطالب في الحساب' });
    }

    if (!student.phone || !student.phone.trim()) {
        missingItems.push({ key: 'phone', icon: '📱', label: 'رقم التليفون', desc: 'لم يتم إدخال رقم التليفون الخاص بالطالب' });
    }

    if (!student.grade || !student.grade.trim()) {
        missingItems.push({ key: 'grade', icon: '📚', label: 'المجموعة الدراسية', desc: 'لم يتم تحديد الصف الدراسي للطالب' });
    }

    if (!student.profileImage) {
        missingItems.push({ key: 'profileImage', icon: '🖼️', label: 'الصورة الشخصية', desc: 'يجب إضافة صورة شخصية واضحة توضح ملامح الطالب' });
    }

    if (missingItems.length > 0) {
        showIncompleteRegistrationModal(student, missingItems);
        return;
    }

    var data = {
        studentId: studentId,
        studentName: student.name || 'غير معروف',
        studentPhone: student.phone || '',
        studentGrade: student.grade || '',
        academicYear: student.academicYear || 'current',
        status: 'pending',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    window.db.collection("enrollmentRequests").add(data)
        .then(function (docRef) {
            // Auto-approve for previous year students
            if (student.academicYear === 'previous') {
                var newGrade = getNextGrade(student.grade);
                return docRef.update({ status: 'approved' }).then(function () {
                    return window.db.collection("students").doc(studentId).update({
                        academicYear: 'current',
                        grade: newGrade
                    });
                }).then(function () {
                    showToast('✅ تم تأكيد الالتحاق بالعام الدراسي الجديد!', 'success');
                    setTimeout(function () { location.reload(); }, 1000);
                    var section = document.getElementById('enrollment-section');
                    var content = document.getElementById('enrollment-content');
                    if (section && content) {
                        content.innerHTML = '<div style="text-align:center;">' +
                            '<div style="font-size:3rem;margin-bottom:10px;">🎉</div>' +
                            '<h3 style="color:#1e293b;margin-bottom:8px;">تم الالتحاق بالعام الدراسي الجديد</h3>' +
                            '<p style="color:#10b981;font-weight:700;">تم ترقيتك إلى ' + newGrade + '</p>' +
                            '</div>';
                    }
                });
            } else {
                showToast('✅ تم تقديم طلب الالتحاق بنجاح!', 'success');
                var section = document.getElementById('enrollment-section');
                var content = document.getElementById('enrollment-content');
                if (section && content) {
                    var isSummer = student.academicYear === 'summer';
                    content.innerHTML = '<div style="text-align:center;">' +
                        '<div style="font-size:3rem;margin-bottom:10px;">📋</div>' +
                        '<h3 style="color:#1e293b;margin-bottom:8px;">طلب الالتحاق بالعام الجديد</h3>' +
                        '<p style="color:#64748b;">حالة طلبك: <span style="background:#d9770620;color:#d97706;padding:4px 14px;border-radius:20px;font-weight:800;">قيد الانتظار ⏳</span></p>' +
                        (isSummer ? '<p style="color:#d97706;font-weight:700;margin-top:10px;">☀️ الطلب معلق إلى حين الانتهاء من الكورس الصيفي</p>' : '<p style="color:#94a3b8;font-size:0.85rem;">سيتم مراجعة طلبك من قبل المعلم قريباً</p>') +
                        '</div>';
                }
            }
        })
        .catch(function (err) {
            console.error('[ENROLLMENT] Submit error:', err.code, err.message, err);
            showToast('خطأ: ' + (err.message || err.code || 'غير معروف'), 'error');
        });
}


