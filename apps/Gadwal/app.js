// ==================== DATABASE (db.js) ====================

const DB_KEYS = {
  KIDS: 'jadwali_kids',
  LESSONS: 'jadwali_lessons',
  TASKS: 'jadwali_tasks',
  SETTINGS: 'jadwali_settings'
};

const MOCK_KIDS = [];

const MOCK_LESSONS = [];

const MOCK_TASKS = [];

const MOCK_SETTINGS = {
  notifications: true,
  twoFactor: false,
  autoLogin: true
};

const SEED_IDS = ['k1', 'k2', 'l1', 'l2', 'l3', 'l4', 'l5', 't1', 't2', 't3', 't4', 't5', 't6'];

const Database = {
  init() {
    if (!localStorage.getItem(DB_KEYS.KIDS)) {
      localStorage.setItem(DB_KEYS.KIDS, JSON.stringify(MOCK_KIDS));
    }
    if (!localStorage.getItem(DB_KEYS.LESSONS)) {
      localStorage.setItem(DB_KEYS.LESSONS, JSON.stringify(MOCK_LESSONS));
    }
    if (!localStorage.getItem(DB_KEYS.TASKS)) {
      localStorage.setItem(DB_KEYS.TASKS, JSON.stringify(MOCK_TASKS));
    }
    if (!localStorage.getItem(DB_KEYS.SETTINGS)) {
      localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(MOCK_SETTINGS));
    }
    this.purgeSeedData();
  },

  purgeSeedData() {
    try {
      let changed = false;
      ['jadwali_kids', 'jadwali_lessons', 'jadwali_tasks'].forEach(key => {
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key)) || []; } catch (e) { items = []; }
        const filtered = items.filter(item => item && SEED_IDS.indexOf(item.id) === -1);
        if (filtered.length !== items.length) {
          localStorage.setItem(key, JSON.stringify(filtered));
          changed = true;
        }
      });
      return changed;
    } catch (e) { return false; }
  },

  getChildren() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.KIDS)) || [];
  },

  addChild(child) {
    const kids = this.getChildren();
    const newChild = { id: 'k_' + Date.now(), ...child };
    kids.push(newChild);
    localStorage.setItem(DB_KEYS.KIDS, JSON.stringify(kids));
    return newChild;
  },

  deleteChild(id) {
    let kids = this.getChildren();
    kids = kids.filter(k => k.id !== id);
    localStorage.setItem(DB_KEYS.KIDS, JSON.stringify(kids));
    let lessons = this.getLessons();
    lessons = lessons.filter(l => l.childId !== id);
    localStorage.setItem(DB_KEYS.LESSONS, JSON.stringify(lessons));
    let tasks = this.getTasks();
    tasks = tasks.filter(t => t.childId !== id);
    localStorage.setItem(DB_KEYS.TASKS, JSON.stringify(tasks));
  },

  getLessons() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.LESSONS)) || [];
  },

  addLesson(lesson) {
    const lessons = this.getLessons();
    const newLesson = { id: 'l_' + Date.now(), ...lesson };
    lessons.push(newLesson);
    localStorage.setItem(DB_KEYS.LESSONS, JSON.stringify(lessons));
    return newLesson;
  },

  deleteLesson(id) {
    let lessons = this.getLessons();
    lessons = lessons.filter(l => l.id !== id);
    localStorage.setItem(DB_KEYS.LESSONS, JSON.stringify(lessons));
  },

  getTasks() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.TASKS)) || [];
  },

  addTask(task) {
    const tasks = this.getTasks();
    const newTask = { id: 't_' + Date.now(), completed: false, ...task };
    tasks.push(newTask);
    localStorage.setItem(DB_KEYS.TASKS, JSON.stringify(tasks));
    return newTask;
  },

  deleteTask(id) {
    let tasks = this.getTasks();
    tasks = tasks.filter(t => t.id !== id);
    localStorage.setItem(DB_KEYS.TASKS, JSON.stringify(tasks));
  },

  toggleTaskCompletion(id) {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index].completed = !tasks[index].completed;
      localStorage.setItem(DB_KEYS.TASKS, JSON.stringify(tasks));
      return tasks[index];
    }
    return null;
  },

  getSettings() {
    this.init();
    return JSON.parse(localStorage.getItem(DB_KEYS.SETTINGS)) || MOCK_SETTINGS;
  },

  saveSettings(settings) {
    localStorage.setItem(DB_KEYS.SETTINGS, JSON.stringify(settings));
  },

  getStats() {
    const kidsCount = this.getChildren().length;
    const lessonsCount = this.getLessons().length;
    const tasksCount = this.getTasks().length;
    let totalLength = 0;
    for (const key in DB_KEYS) {
      const val = localStorage.getItem(DB_KEYS[key]);
      if (val) totalLength += val.length;
    }
    const sizeKB = (totalLength * 2 / 1024).toFixed(2);
    return { kids: kidsCount, lessons: lessonsCount, tasks: tasksCount, size: sizeKB };
  },

  clearAllData() {
    localStorage.removeItem(DB_KEYS.KIDS);
    localStorage.removeItem(DB_KEYS.LESSONS);
    localStorage.removeItem(DB_KEYS.TASKS);
    localStorage.removeItem(DB_KEYS.SETTINGS);
    this.init();
  }
};


// ==================== SERVICE WORKER (sw.js) ====================

const SW_CODE = `
const CACHE_NAME = 'jadwali-cache-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon.png',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
`;


// ==================== APPLICATION LOGIC (app.js) ====================

// Constants & Mappings
const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_EN_MAP = {
  0: 'الأحد',
  1: 'الاثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت'
};

// Global App State
let appState = {
  currentView: 'view-home',
  selectedDay: DAYS_AR[new Date().getDay()],
  selectedChildId: 'all',
  activeItemId: null,
  activeItemType: null
};

// On Page Load
window.addEventListener('DOMContentLoaded', () => {
  Database.init();
  registerServiceWorker();
  setupHeaderDate();
  setupNavigation();
  setupKidFilters();
  setupFormHandlers();
  setupModalControls();
  setupInstallButton();
  renderAll();
});

// PWA Service Worker Registration (file URL required for real installability)
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function () {})
      .catch(function () {});
  }
}

// Display Date in Arabic
function setupHeaderDate() {
  const dateEl = document.getElementById('header-date');
  if (dateEl) {
    const today = new Date();
    dateEl.innerText = today.toLocaleDateString('ar-EG', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });
  }
}

// Navigation and SPA view switching
function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetView = tab.getAttribute('data-target-view');
      switchView(targetView);
    });
  });
}

function switchView(viewId) {
  appState.currentView = viewId;
  document.querySelectorAll('.view-panel').forEach(panel => {
    if (panel.id === viewId) {
      panel.classList.remove('hidden');
    } else {
      panel.classList.add('hidden');
    }
  });
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    if (btn.getAttribute('data-target-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  renderView(viewId);
}

// Kids filters on the header bar
function setupKidFilters() {
  const container = document.getElementById('header-kid-selector-container');
  if (!container) return;
  const kids = Database.getChildren();
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `px-3 py-1 rounded-full text-xs font-bold transition-all border ${appState.selectedChildId === 'all' ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`;
  allBtn.innerText = 'الكل';
  allBtn.addEventListener('click', () => {
    appState.selectedChildId = 'all';
    updateSelectedKidUI();
    renderAll();
  });
  container.appendChild(allBtn);

  kids.forEach(kid => {
    const kidBtn = document.createElement('button');
    kidBtn.className = `px-3 py-1 rounded-full text-xs font-bold transition-all border ${appState.selectedChildId === kid.id ? 'border-emerald-600 text-white shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'}`;
    if (appState.selectedChildId === kid.id) {
      kidBtn.style.backgroundColor = kid.color || '#059669';
      kidBtn.style.borderColor = kid.color || '#059669';
    }
    kidBtn.innerText = kid.name;
    kidBtn.addEventListener('click', () => {
      appState.selectedChildId = kid.id;
      updateSelectedKidUI();
      renderAll();
    });
    container.appendChild(kidBtn);
  });
}

function updateSelectedKidUI() {
  setupKidFilters();
}

// Event Listeners for Modals opening & closing
function setupModalControls() {
  document.getElementById('fab-add').addEventListener('click', () => {
    openAddItemModal();
  });

  document.querySelectorAll('.modal-close-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal-overlay');
      if (modal) closeModal(modal.id);
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });

  const tabLessonBtn = document.getElementById('modal-tab-lesson');
  const tabTaskBtn = document.getElementById('modal-tab-task');
  const formLesson = document.getElementById('form-add-lesson');
  const formTask = document.getElementById('form-add-task');

  tabLessonBtn.addEventListener('click', () => {
    tabLessonBtn.className = "text-base font-bold pb-2 border-b-2 border-emerald-600 text-emerald-600";
    tabTaskBtn.className = "text-base font-bold pb-2 border-b-2 border-transparent text-slate-400";
    formLesson.classList.remove('hidden');
    formTask.classList.add('hidden');
  });

  tabTaskBtn.addEventListener('click', () => {
    tabTaskBtn.className = "text-base font-bold pb-2 border-b-2 border-emerald-600 text-emerald-600";
    tabLessonBtn.className = "text-base font-bold pb-2 border-b-2 border-transparent text-slate-400";
    formTask.classList.remove('hidden');
    formLesson.classList.add('hidden');
  });

  document.getElementById('btn-add-kid').addEventListener('click', () => {
    openModal('modal-add-kid');
  });

  document.querySelectorAll('.action-add-lesson').forEach(btn => {
    btn.addEventListener('click', () => {
      openAddItemModal();
      document.getElementById('modal-tab-lesson').click();
    });
  });
  document.querySelectorAll('.action-add-task').forEach(btn => {
    btn.addEventListener('click', () => {
      openAddItemModal();
      document.getElementById('modal-tab-task').click();
    });
  });

  document.getElementById('btn-add-lesson-weekly').addEventListener('click', () => {
    openAddItemModal();
    document.getElementById('modal-tab-lesson').click();
  });
  document.getElementById('btn-add-task-available').addEventListener('click', () => {
    openAddItemModal();
    document.getElementById('modal-tab-task').click();
    document.getElementById('task-type-select').value = 'available';
    document.getElementById('task-type-select').dispatchEvent(new Event('change'));
  });

  const taskTypeSelect = document.getElementById('task-type-select');
  const taskDayContainer = document.getElementById('task-day-container');
  taskTypeSelect.addEventListener('change', () => {
    if (taskTypeSelect.value === 'available') {
      taskDayContainer.classList.add('hidden');
    } else {
      taskDayContainer.classList.remove('hidden');
    }
  });

  document.getElementById('btn-details-action').addEventListener('click', () => {
    if (appState.activeItemId && appState.activeItemType === 'task') {
      Database.toggleTaskCompletion(appState.activeItemId);
      showToast("تم تحديث حالة المهمة بنجاح");
      closeModal('modal-details');
      renderAll();
    } else if (appState.activeItemId && appState.activeItemType === 'lesson') {
      showToast("الحصة مجدولة بالفعل في الجدول الدراسي");
      closeModal('modal-details');
    }
  });

  document.getElementById('btn-details-delete').addEventListener('click', () => {
    if (appState.activeItemId) {
      if (appState.activeItemType === 'lesson') {
        Database.deleteLesson(appState.activeItemId);
        showToast("تم حذف الحصة الدراسية بنجاح");
      } else {
        Database.deleteTask(appState.activeItemId);
        showToast("تم حذف المهمة بنجاح");
      }
      closeModal('modal-details');
      renderAll();
    }
  });

  document.getElementById('btn-wipe-data').addEventListener('click', () => {
    openModal('modal-confirm-delete');
  });

  document.getElementById('btn-confirm-delete-action').addEventListener('click', () => {
    Database.clearAllData();
    showToast("تم مسح كافة البيانات وإعادة تهيئة التطبيق");
    closeModal('modal-confirm-delete');
    appState.selectedChildId = 'all';
    appState.selectedDay = DAYS_AR[new Date().getDay()];
    setupKidFilters();
    switchView('view-home');
    renderAll();
  });
}

function openAddItemModal() {
  populateKidDropdowns();
  openModal('modal-add-item');
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.classList.remove('hidden');
  setTimeout(() => {
    const container = modal.querySelector('.modal-container');
    if (container) {
      if (modalId === 'modal-confirm-delete') {
        container.classList.remove('scale-90', 'opacity-0');
        container.classList.add('scale-100', 'opacity-100');
      } else {
        container.classList.remove('translate-y-full');
        container.classList.add('translate-y-0');
      }
    }
  }, 10);
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const container = modal.querySelector('.modal-container');
  if (container) {
    if (modalId === 'modal-confirm-delete') {
      container.classList.add('scale-90', 'opacity-0');
      container.classList.remove('scale-100', 'opacity-100');
    } else {
      container.classList.add('translate-y-full');
      container.classList.remove('translate-y-0');
    }
  }
  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

function populateKidDropdowns() {
  const kids = Database.getChildren();
  const lessonSelect = document.querySelector('select[name="lessonChildId"]');
  const taskSelect = document.querySelector('select[name="taskChildId"]');
  const populate = (selectElement) => {
    selectElement.innerHTML = '';
    if (kids.length === 0) {
      selectElement.innerHTML = '<option value="">لا يوجد أطفال، يرجى إضافة طفل أولاً</option>';
      return;
    }
    kids.forEach(kid => {
      const option = document.createElement('option');
      option.value = kid.id;
      option.innerText = kid.name;
      selectElement.appendChild(option);
    });
  };
  if (lessonSelect) populate(lessonSelect);
  if (taskSelect) populate(taskSelect);
}

// Form Handlers
function setupFormHandlers() {
  const formLesson = document.getElementById('form-add-lesson');
  formLesson.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(formLesson);
    const childId = formData.get('lessonChildId');
    if (!childId) {
      showToast("يرجى إضافة طفل أولاً من تبويب أولادي");
      return;
    }
    const newLesson = {
      childId: childId,
      name: formData.get('lessonName'),
      day: formData.get('lessonDay'),
      time: formData.get('lessonTime'),
      duration: parseInt(formData.get('lessonDuration'))
    };
    Database.addLesson(newLesson);
    showToast("تم حفظ الحصة الدراسية بنجاح");
    formLesson.reset();
    closeModal('modal-add-item');
    renderAll();
  });

  const formTask = document.getElementById('form-add-task');
  formTask.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(formTask);
    const childId = formData.get('taskChildId');
    if (!childId) {
      showToast("يرجى إضافة طفل أولاً من تبويب أولادي");
      return;
    }
    const type = formData.get('taskType');
    const day = type === 'available' ? '' : formData.get('taskDay');
    const newTask = {
      childId: childId,
      name: formData.get('taskName'),
      day: day,
      type: type,
      notes: formData.get('taskNotes')
    };
    Database.addTask(newTask);
    showToast("تم حفظ المهمة بنجاح");
    formTask.reset();
    closeModal('modal-add-item');
    renderAll();
  });

  const formKid = document.getElementById('form-add-kid');
  formKid.addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(formKid);
    const newKid = {
      name: formData.get('kidName'),
      age: parseInt(formData.get('kidAge')),
      grade: formData.get('kidGrade'),
      color: formData.get('kidColor')
    };
    Database.addChild(newKid);
    showToast("تم تسجيل الطفل بنجاح");
    formKid.reset();
    closeModal('modal-add-kid');
    setupKidFilters();
    renderAll();
  });

  const notifToggle = document.getElementById('settings-notifications');
  const faToggle = document.getElementById('settings-2fa');
  const autologinToggle = document.getElementById('settings-auto-login');
  const saveSettings = () => {
    const settings = {
      notifications: notifToggle.checked,
      twoFactor: faToggle.checked,
      autoLogin: autologinToggle.checked
    };
    Database.saveSettings(settings);
  };
  notifToggle.addEventListener('change', saveSettings);
  faToggle.addEventListener('change', saveSettings);
  autologinToggle.addEventListener('change', saveSettings);
}

// Render Engine dispatcher
function renderAll() {
  renderView(appState.currentView);
}

function renderView(viewId) {
  setTimeout(() => lucide.createIcons(), 20);
  switch (viewId) {
    case 'view-home':
      renderHomeView();
      break;
    case 'view-weekly':
      renderWeeklyView();
      break;
    case 'view-available':
      renderAvailableView();
      break;
    case 'view-kids':
      renderKidsView();
      break;
    case 'view-settings':
      renderSettingsView();
      break;
  }
}

// Render 1. Home View
function renderHomeView() {
  const lessonsList = document.getElementById('home-lessons-list');
  const tasksList = document.getElementById('home-tasks-list');
  if (!lessonsList || !tasksList) return;

  const kids = Database.getChildren();
  const lessons = Database.getLessons();
  const tasks = Database.getTasks();

  const filteredLessons = lessons.filter(l => {
    const dayMatch = l.day === appState.selectedDay;
    const kidMatch = appState.selectedChildId === 'all' || l.childId === appState.selectedChildId;
    return dayMatch && kidMatch;
  });

  const filteredTasks = tasks.filter(t => {
    const typeMatch = t.type !== 'available';
    const dayMatch = t.day === appState.selectedDay;
    const kidMatch = appState.selectedChildId === 'all' || t.childId === appState.selectedChildId;
    return typeMatch && dayMatch && kidMatch;
  });

  document.getElementById('lessons-count-badge').innerText = filteredLessons.length;
  document.getElementById('tasks-count-badge').innerText = filteredTasks.length;

  lessonsList.innerHTML = '';
  if (filteredLessons.length === 0) {
    lessonsList.innerHTML = `
      <div class="bg-white border border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-sm">
        <i data-lucide="calendar-off" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
        لا توجد حصص مجدولة لهذا اليوم.
      </div>
    `;
  } else {
    filteredLessons.sort((a, b) => a.time.localeCompare(b.time));
    filteredLessons.forEach(lesson => {
      const kid = kids.find(k => k.id === lesson.childId) || { name: 'غير معروف', color: '#64748b' };
      const itemCard = document.createElement('div');
      itemCard.className = "bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-premium hover:border-emerald-100 transition active-press cursor-pointer";
      itemCard.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center text-white" style="background-color: ${kid.color}">
            <i data-lucide="book-open" class="w-5 h-5"></i>
          </div>
          <div>
            <h4 class="font-bold text-slate-800 text-sm">${lesson.name}</h4>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-700 bg-slate-100">${kid.name}</span>
              <span class="text-[10px] text-slate-400 flex items-center gap-0.5">
                <i data-lucide="clock" class="w-3 h-3"></i>
                ${lesson.time} (${lesson.duration} د)
              </span>
            </div>
          </div>
        </div>
        <i data-lucide="chevron-left" class="w-4 h-4 text-slate-300"></i>
      `;
      itemCard.addEventListener('click', () => {
        showDetailsModal(lesson, 'lesson', kid);
      });
      lessonsList.appendChild(itemCard);
    });
  }

  tasksList.innerHTML = '';
  if (filteredTasks.length === 0) {
    tasksList.innerHTML = `
      <div class="bg-white border border-slate-100 rounded-2xl p-6 text-center text-slate-400 text-sm">
        <i data-lucide="check-circle" class="w-8 h-8 text-slate-300 mx-auto mb-2"></i>
        لا توجد مهام مجدولة اليوم.
      </div>
    `;
  } else {
    filteredTasks.forEach(task => {
      const kid = kids.find(k => k.id === task.childId) || { name: 'غير معروف', color: '#64748b' };
      const itemCard = document.createElement('div');
      itemCard.className = `bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-premium transition ${task.completed ? 'opacity-70' : ''}`;
      itemCard.innerHTML = `
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <label class="relative flex items-center cursor-pointer">
            <input type="checkbox" ${task.completed ? 'checked' : ''} class="checkbox-animate sr-only">
            <div class="w-5.5 h-5.5 border-2 border-slate-300 rounded-md flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-transparent'}">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>
            </div>
          </label>
          <div class="min-w-0 flex-1 cursor-pointer pr-1" id="task-content-${task.id}">
            <h4 class="font-bold text-slate-800 text-sm truncate ${task.completed ? 'line-through text-slate-400' : ''}">${task.name}</h4>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-700 bg-slate-100">${kid.name}</span>
              <span class="text-[10px] text-slate-400">${task.type === 'daily' ? 'مهمة يومية' : 'مهمة أسبوعية'}</span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <button class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors" id="btn-view-task-${task.id}">
            <i data-lucide="info" class="w-4.5 h-4.5"></i>
          </button>
        </div>
      `;

      const checkbox = itemCard.querySelector('input[type="checkbox"]');
      checkbox.addEventListener('change', () => {
        Database.toggleTaskCompletion(task.id);
        if (checkbox.checked) {
          showToast(`تم إنجاز المهمة: ${task.name}`);
        }
        renderHomeView();
      });

      itemCard.querySelector(`#task-content-${task.id}`).addEventListener('click', () => {
        showDetailsModal(task, 'task', kid);
      });
      itemCard.querySelector(`#btn-view-task-${task.id}`).addEventListener('click', () => {
        showDetailsModal(task, 'task', kid);
      });

      tasksList.appendChild(itemCard);
    });
  }

  updateHomeProgressCard(filteredLessons, filteredTasks);
}

function updateHomeProgressCard(lessons, tasks) {
  const childNameEl = document.getElementById('home-stats-child-name');
  const titleEl = document.getElementById('home-stats-progress-title');
  const subtitleEl = document.getElementById('home-stats-subtitle');
  const percentageEl = document.getElementById('home-progress-percentage');
  const barEl = document.getElementById('home-progress-bar');

  if (appState.selectedChildId === 'all') {
    childNameEl.innerText = 'جميع الأطفال';
  } else {
    const kids = Database.getChildren();
    const kid = kids.find(k => k.id === appState.selectedChildId);
    childNameEl.innerText = kid ? kid.name : 'جميع الأطفال';
  }

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const remainingTasks = totalTasks - completedTasks;
  const remainingLessons = lessons.length;

  titleEl.innerText = `جدول يوم ${appState.selectedDay}`;
  subtitleEl.innerText = `متبقي ${remainingLessons} دروس و ${remainingTasks} مهام غير منجزة`;

  let pct = 0;
  if (totalTasks > 0) {
    pct = Math.round((completedTasks / totalTasks) * 100);
  } else if (lessons.length > 0) {
    pct = 100;
  }

  percentageEl.innerText = `${pct}%`;
  barEl.style.width = `${pct}%`;
}

// Render 2. Weekly Schedule View
function renderWeeklyView() {
  const gridState = document.getElementById('weekly-grid-state');
  const emptyState = document.getElementById('weekly-empty-state');
  if (!gridState || !emptyState) return;

  const kids = Database.getChildren();
  const lessons = Database.getLessons();
  const tasks = Database.getTasks();

  const childLessons = lessons.filter(l => appState.selectedChildId === 'all' || l.childId === appState.selectedChildId);
  const childTasks = tasks.filter(t => t.type !== 'available' && (appState.selectedChildId === 'all' || t.childId === appState.selectedChildId));

  const totalItems = childLessons.length + childTasks.length;

  if (totalItems === 0) {
    gridState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  gridState.classList.remove('hidden');
  gridState.innerHTML = '';

  DAYS_AR.forEach(day => {
    const dayLessons = childLessons.filter(l => l.day === day);
    const dayTasks = childTasks.filter(t => t.day === day);

    if (dayLessons.length === 0 && dayTasks.length === 0) return;

    const daySection = document.createElement('div');
    daySection.className = "bg-white border border-slate-100 rounded-2xl p-4 space-y-3 shadow-premium";
    let isToday = day === DAYS_AR[new Date().getDay()];
    daySection.innerHTML = `
      <div class="flex justify-between items-center border-b border-slate-50 pb-2">
        <h4 class="font-extrabold text-slate-800 text-sm flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          يوم ${day}
          ${isToday ? '<span class="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">اليوم</span>' : ''}
        </h4>
        <span class="text-[10px] text-slate-400 font-bold">${dayLessons.length} دروس | ${dayTasks.length} مهام</span>
      </div>
      <div class="space-y-2" id="weekly-day-items-${day}"></div>
    `;

    gridState.appendChild(daySection);
    const itemsContainer = document.getElementById(`weekly-day-items-${day}`);

    dayLessons.sort((a, b) => a.time.localeCompare(b.time));
    dayLessons.forEach(lesson => {
      const kid = kids.find(k => k.id === lesson.childId) || { name: 'غير معروف', color: '#64748b' };
      const itemRow = document.createElement('div');
      itemRow.className = "flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition cursor-pointer";
      itemRow.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background-color: ${kid.color}"></span>
          <span class="text-xs font-bold text-slate-700">${lesson.name}</span>
          <span class="text-[10px] text-slate-400">(${lesson.time})</span>
        </div>
        <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md text-emerald-700 bg-emerald-50">حصة</span>
      `;
      itemRow.addEventListener('click', () => {
        showDetailsModal(lesson, 'lesson', kid);
      });
      itemsContainer.appendChild(itemRow);
    });

    dayTasks.forEach(task => {
      const kid = kids.find(k => k.id === task.childId) || { name: 'غير معروف', color: '#64748b' };
      const itemRow = document.createElement('div');
      itemRow.className = `flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition cursor-pointer ${task.completed ? 'opacity-60' : ''}`;
      itemRow.innerHTML = `
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="w-2 h-2 rounded-full" style="background-color: ${kid.color}"></span>
          <span class="text-xs font-semibold text-slate-600 truncate ${task.completed ? 'line-through text-slate-400' : ''}">${task.name}</span>
        </div>
        <span class="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md ${task.completed ? 'text-slate-500 bg-slate-100' : 'text-amber-700 bg-amber-50'}">
          ${task.completed ? 'مكتملة' : 'مهمة'}
        </span>
      `;
      itemRow.addEventListener('click', () => {
        showDetailsModal(task, 'task', kid);
      });
      itemsContainer.appendChild(itemRow);
    });
  });
}

// Render 3. Available Tasks View
function renderAvailableView() {
  const listState = document.getElementById('available-list-state');
  const emptyState = document.getElementById('available-empty-state');
  if (!listState || !emptyState) return;

  const kids = Database.getChildren();
  const tasks = Database.getTasks();

  const filteredTasks = tasks.filter(t => {
    const isAvail = t.type === 'available';
    const kidMatch = appState.selectedChildId === 'all' || t.childId === appState.selectedChildId;
    return isAvail && kidMatch;
  });

  if (filteredTasks.length === 0) {
    listState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  listState.classList.remove('hidden');
  listState.innerHTML = '';

  filteredTasks.forEach(task => {
    const kid = kids.find(k => k.id === task.childId) || { name: 'غير معروف', color: '#64748b' };
    const card = document.createElement('div');
    card.className = `bg-white border border-slate-100 rounded-2xl p-4 flex justify-between items-center shadow-premium transition ${task.completed ? 'opacity-70' : ''}`;
    card.innerHTML = `
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <label class="relative flex items-center cursor-pointer">
          <input type="checkbox" ${task.completed ? 'checked' : ''} class="checkbox-animate sr-only">
          <div class="w-5.5 h-5.5 border-2 border-slate-300 rounded-md flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white text-transparent'}">
            <i data-lucide="check" class="w-3.5 h-3.5"></i>
          </div>
        </label>
        <div class="min-w-0 flex-1 cursor-pointer pr-1" id="avail-task-content-${task.id}">
          <h4 class="font-bold text-slate-800 text-sm truncate ${task.completed ? 'line-through text-slate-400' : ''}">${task.name}</h4>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-slate-700 bg-slate-100">${kid.name}</span>
            <span class="text-[10px] text-slate-400">مهمة حرة (متاحة في أي وقت)</span>
          </div>
        </div>
      </div>
      <button class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-300 hover:text-slate-500 transition-colors" id="btn-view-avail-${task.id}">
        <i data-lucide="info" class="w-4.5 h-4.5"></i>
      </button>
    `;

    const checkbox = card.querySelector('input[type="checkbox"]');
    checkbox.addEventListener('change', () => {
      Database.toggleTaskCompletion(task.id);
      if (checkbox.checked) {
        showToast(`تم إنجاز المهمة المتاحة: ${task.name}`);
      }
      renderAvailableView();
    });

    card.querySelector(`#avail-task-content-${task.id}`).addEventListener('click', () => {
      showDetailsModal(task, 'task', kid);
    });
    card.querySelector(`#btn-view-avail-${task.id}`).addEventListener('click', () => {
      showDetailsModal(task, 'task', kid);
    });

    listState.appendChild(card);
  });
}

// Render 4. Kids View
function renderKidsView() {
  const container = document.getElementById('kids-list');
  if (!container) return;

  const kids = Database.getChildren();
  const lessons = Database.getLessons();
  const tasks = Database.getTasks();

  container.innerHTML = '';

  if (kids.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white border border-slate-100 rounded-2xl p-10 text-center text-slate-400">
        <i data-lucide="users" class="w-12 h-12 text-slate-300 mx-auto mb-2"></i>
        <h4 class="font-bold text-slate-800 mb-1">لم تقم بإضافة أي طفل بعد</h4>
        <p class="text-xs text-slate-400 max-w-xs mx-auto mb-4">اضغط على زر الإضافة لتتمكن من جدولة الدروس والمهام لكل طفل.</p>
        <button id="btn-add-kid-empty" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-4 rounded-xl transition">
          + إضافة طفل جديد
        </button>
      </div>
    `;
    document.getElementById('btn-add-kid-empty').addEventListener('click', () => {
      openModal('modal-add-kid');
    });
    return;
  }

  kids.forEach(kid => {
    const kidLessons = lessons.filter(l => l.childId === kid.id);
    const kidTasks = tasks.filter(t => t.childId === kid.id);
    const totalTasks = kidTasks.length;
    const completedTasks = kidTasks.filter(t => t.completed).length;
    const percentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const kidCard = document.createElement('div');
    kidCard.className = "bg-white border border-slate-100 rounded-2xl p-4 shadow-premium space-y-4 hover:border-emerald-100 transition relative";

    kidCard.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black text-white" style="background-color: ${kid.color}">
            ${kid.name.substring(0, 1)}
          </div>
          <div>
            <h3 class="font-bold text-slate-800 text-base">${kid.name}</h3>
            <p class="text-xs text-slate-400 mt-0.5">${kid.grade} • ${kid.age} سنوات</p>
          </div>
        </div>
        <button class="w-8 h-8 rounded-full hover:bg-red-50 text-slate-300 hover:text-red-500 flex items-center justify-center transition-colors absolute left-3 top-3" id="btn-delete-kid-${kid.id}">
          <i data-lucide="user-x" class="w-4 h-4"></i>
        </button>
      </div>
      <div class="bg-slate-50 rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div class="border-l border-slate-200/60">
          <p class="text-[10px] text-slate-400 font-bold mb-0.5">الحصص</p>
          <p class="font-bold text-slate-700">${kidLessons.length}</p>
        </div>
        <div class="border-l border-slate-200/60">
          <p class="text-[10px] text-slate-400 font-bold mb-0.5">المهام</p>
          <p class="font-bold text-slate-700">${completedTasks}/${totalTasks}</p>
        </div>
        <div>
          <p class="text-[10px] text-slate-400 font-bold mb-0.5">الإنجاز</p>
          <p class="font-black text-emerald-600">${percentage}%</p>
        </div>
      </div>
    `;

    kidCard.querySelector(`#btn-delete-kid-${kid.id}`).addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`هل أنت متأكد من حذف حساب الطفل "${kid.name}"؟ سيتم حذف جميع دروسه ومهامه بشكل نهائي!`)) {
        Database.deleteChild(kid.id);
        showToast(`تم حذف الطفل "${kid.name}" بنجاح`);
        setupKidFilters();
        if (appState.selectedChildId === kid.id) {
          appState.selectedChildId = 'all';
          updateSelectedKidUI();
        }
        renderKidsView();
      }
    });

    container.appendChild(kidCard);
  });
}

// Render 5. Settings View
function renderSettingsView() {
  const stats = Database.getStats();
  const settings = Database.getSettings();
  document.getElementById('settings-notifications').checked = settings.notifications;
  document.getElementById('settings-2fa').checked = settings.twoFactor;
  document.getElementById('settings-auto-login').checked = settings.autoLogin;
  document.getElementById('tech-db-size').innerText = `${stats.size} KB`;
  document.getElementById('tech-kids-count').innerText = stats.kids;
  document.getElementById('tech-total-items').innerText = `${stats.lessons} دروس • ${stats.tasks} مهام`;
}

// Show Detail Modal
function showDetailsModal(item, type, kid) {
  appState.activeItemId = item.id;
  appState.activeItemType = type;

  const titleEl = document.getElementById('details-modal-title');
  const bodyEl = document.getElementById('details-modal-body');
  const actionBtn = document.getElementById('btn-details-action');
  const actionText = document.getElementById('btn-details-action-text');

  bodyEl.innerHTML = '';

  if (type === 'lesson') {
    titleEl.innerHTML = `<i data-lucide="book-open" class="w-5 h-5 text-emerald-600"></i> تفاصيل الحصة الدراسية`;
    bodyEl.innerHTML = `
      <div class="bg-slate-50 rounded-2xl p-4 space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-slate-400 font-bold">اسم الحصة الدراسي</span>
          <span class="text-sm font-bold text-slate-800">${item.name}</span>
        </div>
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">الطفل</span>
          <span class="text-xs font-extrabold px-2 py-0.5 rounded-full text-white" style="background-color: ${kid.color}">${kid.name}</span>
        </div>
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">يوم الدراسة</span>
          <span class="text-sm font-bold text-slate-700">${item.day}</span>
        </div>
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">وقت البداية والمدة</span>
          <span class="text-sm font-bold text-slate-700">${item.time} (${item.duration} دقيقة)</span>
        </div>
      </div>
    `;
    actionBtn.classList.add('hidden');
  } else {
    titleEl.innerHTML = `<i data-lucide="check-square" class="w-5 h-5 text-emerald-600"></i> تفاصيل المهمة`;
    let typeText = 'مهمة يومية محددة';
    if (item.type === 'weekly') typeText = 'مهمة أسبوعية';
    if (item.type === 'available') typeText = 'مهمة حرة عامة';

    bodyEl.innerHTML = `
      <div class="bg-slate-50 rounded-2xl p-4 space-y-3">
        <div class="flex justify-between items-center">
          <span class="text-xs text-slate-400 font-bold">اسم المهمة</span>
          <span class="text-sm font-bold text-slate-800">${item.name}</span>
        </div>
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">الطفل</span>
          <span class="text-xs font-extrabold px-2 py-0.5 rounded-full text-white" style="background-color: ${kid.color}">${kid.name}</span>
        </div>
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">نوع المهمة</span>
          <span class="text-sm font-semibold text-slate-700">${typeText}</span>
        </div>
        ${item.day ? `
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">اليوم المجدول</span>
          <span class="text-sm font-semibold text-slate-700">${item.day}</span>
        </div>` : ''}
        <div class="flex justify-between items-center border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold">حالة الإنجاز</span>
          <span class="text-xs font-bold px-2 py-0.5 rounded-md ${item.completed ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}">
            ${item.completed ? 'مكتملة ومُنجزة' : 'بانتظار الإنجاز'}
          </span>
        </div>
        ${item.notes ? `
        <div class="border-t border-slate-100 pt-2">
          <span class="text-xs text-slate-400 font-bold block mb-1">ملاحظات:</span>
          <p class="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">${item.notes}</p>
        </div>` : ''}
      </div>
    `;

    actionBtn.classList.remove('hidden');
    if (item.completed) {
      actionText.innerText = "إلغاء الإنجاز";
      actionBtn.className = "bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2";
      actionBtn.querySelector('i').setAttribute('data-lucide', 'x');
    } else {
      actionText.innerText = "تعليم كمكتملة";
      actionBtn.className = "bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-2.5 px-4 rounded-xl text-sm transition flex items-center justify-center gap-2";
      actionBtn.querySelector('i').setAttribute('data-lucide', 'check');
    }
  }

  lucide.createIcons();
  openModal('modal-details');
}

function setupInstallButton() {
  const btn = document.getElementById('btn-install-app');
  if (!btn) return;
  const refresh = () => {
    try {
      if (window.ElMistarPWA && window.ElMistarPWA.isAppInstalled && window.ElMistarPWA.isAppInstalled()) {
        btn.innerText = 'مثبت ✓';
        btn.setAttribute('disabled', 'disabled');
        btn.classList.add('opacity-70');
      }
    } catch (e) {}
  };
  btn.addEventListener('click', () => {
    try {
      if (window.ElMistarPWA && window.ElMistarPWA.showInstall) window.ElMistarPWA.showInstall();
      else if (window.__elmistarDeferredPrompt) window.__elmistarDeferredPrompt.prompt();
      else showToast('من قائمة المتصفح ⋮ اختر تثبيت التطبيق');
    } catch (e) { showToast('من قائمة المتصفح ⋮ اختر تثبيت التطبيق'); }
  });
  setTimeout(refresh, 2000);
  window.addEventListener('appinstalled', refresh);
}

// Toast System
let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('app-toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;
  toastMsg.innerText = message;
  clearTimeout(toastTimeout);
  toast.classList.remove('opacity-0', 'pointer-events-none', 'scale-90', 'translate-y-[-20px]');
  toast.classList.add('opacity-100', 'scale-100', 'translate-y-0');
  toastTimeout = setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none', 'scale-90', 'translate-y-[-20px]');
    toast.classList.remove('opacity-100', 'scale-100', 'translate-y-0');
  }, 3000);
}
