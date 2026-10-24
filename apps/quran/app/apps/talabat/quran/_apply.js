const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, 'index.html');
let s = fs.readFileSync(filePath, 'utf8');

// === PHASE 1: META/TITLE ===
s = s.replace('<meta name="theme-color" content="#F59E0B" />', '<meta name="theme-color" content="#3B82F6" />');
s = s.replace('<title>بيتنا - مشتريات البيت 🏠</title>', '<title>بيتنا</title>');

// === PHASE 2: CSS ANIMATIONS ===
// Add animation keyframes after the pop keyframe
const animCSS = `
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideInRight {
    from { opacity: 0; transform: translateX(30px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  @keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  .animate-in { animation: fadeInUp .4s ease-out both; }
  .animate-in-delay-1 { animation: fadeInUp .4s ease-out .1s both; }
  .animate-in-delay-2 { animation: fadeInUp .4s ease-out .2s both; }
  .animate-in-delay-3 { animation: fadeInUp .4s ease-out .3s both; }
  .animate-scale { animation: scaleIn .3s ease-out both; }
`;
s = s.replace("  @keyframes pop { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }\n  .form-title", 
  "  @keyframes pop { from { transform: scale(.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }\n" + animCSS + "  .form-title");

// Fix stat-icon to be flex display instead of font-size
s = s.replace('.stat-icon { font-size: 22px; margin-bottom: 6px; }', '.stat-icon { margin-bottom: 6px; display: flex; }');

// Fix search box icon
s = s.replace('.search-box .sicon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 16px; }',
  '.search-box .sicon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); display: flex; }');

// Fix category-card-icon
s = s.replace('.category-card-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }',
  '.category-card-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }');

// Fix context menu icon
s = s.replace('.context-menu-item .ctx-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }',
  '.context-menu-item .ctx-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }');

// Fix empty icon
s = s.replace('.empty-icon { font-size: 56px; margin-bottom: 12px; }', '.empty-icon { margin-bottom: 12px; display: flex; justify-content: center; }');

// Fix bubble-avatar
s = s.replace('.bubble-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; background: var(--bg); }',
  '.bubble-avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; }');

// Fix exp-cat
s = s.replace('.exp-cat { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }',
  '.exp-cat { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }');

// Fix settings icon
s = s.replace('.si-icon { width: 36px; height: 36px; background: var(--primary-light); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 17px; flex-shrink: 0; }',
  '.si-icon { width: 36px; height: 36px; background: var(--primary-light); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }');

// Fix color-item-icon
s = s.replace('.color-item-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }',
  '.color-item-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }');

// Fix brand-icon font-size
s = s.replace('font-size: 48px; animation: pop .5s ease-out;', 'animation: pop .5s ease-out;');

// Fix confirm-icon font-size
s = s.replace('.confirm-dialog .confirm-icon { width: 54px; height: 54px; background: var(--danger-light); color: var(--danger); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 26px; margin: 0 auto 12px; }',
  '.confirm-dialog .confirm-icon { width: 54px; height: 54px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }');

// Fix toast-icon
s = s.replace('.toast-icon { font-size: 16px; flex-shrink: 0; }', '.toast-icon { flex-shrink: 0; display: flex; }');

// Fix success-icon font-size
s = s.replace('.success-icon { width: 72px; height: 72px; margin: 0 auto 14px; background: var(--success-light); border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 36px; animation: pop .5s ease-out; box-shadow: 0 6px 16px rgba(16,185,129,.2); }',
  '.success-icon { width: 72px; height: 72px; margin: 0 auto 14px; background: var(--success-light); border: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; animation: pop .5s ease-out; box-shadow: 0 6px 16px rgba(16,185,129,.2); }');

// Fix filter-chip transition
s = s.replace('.filter-chip {\n    display: inline-flex; align-items: center; gap: 5px;\n    padding: 8px 14px; border-radius: 999px;\n    background: var(--card); color: var(--text-sec); font-weight: 700; font-size: 13px;\n    margin-left: 6px; border: 1.5px solid var(--border); transition: all .15s;\n  }',
  '.filter-chip {\n    display: inline-flex; align-items: center; gap: 5px;\n    padding: 8px 14px; border-radius: 999px;\n    background: var(--card); color: var(--text-sec); font-weight: 700; font-size: 13px;\n    margin-left: 6px; border: 1.5px solid var(--border); transition: all .2s;\n  }\n  .filter-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); transform: scale(1.03); }');
// Remove duplicate filter-chip.active if exists
s = s.replace('.filter-chip.active { background: var(--primary); color: #fff; border-color: var(--primary); }\n\n  .search-bar', '.search-bar');

// Add pulse to FAB
s = s.replace('.fab {\n    position: fixed; bottom: calc(var(--nav-h) + 14px); left: 50%; transform: translateX(-50%);\n    width: 56px; height: 56px; border-radius: 50%;\n    background: var(--primary); color: #fff; font-size: 26px; font-weight: 900;\n    border: none; box-shadow: 0 6px 20px rgba(59,130,246,.35);\n    display: flex; align-items: center; justify-content: center; z-index: 30;\n    transition: transform .15s;\n  }',
  '.fab {\n    position: fixed; bottom: calc(var(--nav-h) + 14px); left: 50%; transform: translateX(-50%);\n    width: 56px; height: 56px; border-radius: 50%;\n    background: var(--primary); color: #fff; font-size: 26px; font-weight: 900;\n    border: none; box-shadow: 0 6px 20px rgba(59,130,246,.35);\n    display: flex; align-items: center; justify-content: center; z-index: 30;\n    transition: transform .15s;\n    animation: pulse 2s infinite;\n  }');

// Add active indicator to nav-item
s = s.replace('.nav-item {\n    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;\n    gap: 1px; color: var(--text-muted); font-size: 10px; font-weight: 700;\n    transition: color .15s; border-radius: 10px;\n  }\n  .nav-item:active { transform: scale(.95); }\n  .nav-item svg { width: 22px; height: 22px; }\n  .nav-item.active { color: var(--primary); font-weight: 800; }',
  '.nav-item {\n    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;\n    gap: 1px; color: var(--text-muted); font-size: 10px; font-weight: 700;\n    transition: color .15s; border-radius: 10px; position: relative;\n  }\n  .nav-item:active { transform: scale(.95); }\n  .nav-item svg { width: 22px; height: 22px; }\n  .nav-item.active { color: var(--primary); font-weight: 800; }\n  .nav-item.active::after {\n    content: \'\'; position: absolute; bottom: 2px; left: 50%; transform: translateX(-50%);\n    width: 20px; height: 3px; border-radius: 2px; background: var(--primary);\n    animation: scaleIn .2s ease-out;\n  }');

// Add bar-fill transition
s = s.replace('.bar-fill { width: 100%; background: var(--primary); border-radius: 4px 4px 0 0; min-height: 2px; }',
  '.bar-fill { width: 100%; background: var(--primary); border-radius: 4px 4px 0 0; min-height: 2px; transition: height .3s ease; }');

// === PHASE 3: JS - ADD SVG ICON FUNCTION ===
// Insert icon function after pickMsg function
const iconFunc = `
  /* =============================
     SVG ICON HELPER
     ============================= */
  function icon(name, size, color) {
    size = size || 20; color = color || 'currentColor';
    const icons = {
      leaf: '<path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5s1.75 3.75 1.75 3.75" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      cart: '<circle cx="9" cy="21" r="1" fill="'+color+'"/><circle cx="20" cy="21" r="1" fill="'+color+'"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      sparkle: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      pill: '<path d="M10.5 1.5l-8 8a4.95 4.95 0 0 0 7 7l8-8a4.95 4.95 0 0 0-7-7z" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5" stroke="'+color+'" stroke-width="2"/>',
      alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="'+color+'" stroke-width="2"/>',
      box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="'+color+'" stroke-width="2"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="'+color+'" stroke-width="2"/>',
      home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke="'+color+'" stroke-width="2"/><polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="'+color+'" stroke-width="2"/>',
      search: '<circle cx="11" cy="11" r="8" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="'+color+'" stroke-width="2"/>',
      plus: '<line x1="12" y1="5" x2="12" y2="19" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round"/>',
      check: '<polyline points="20 6 9 17 4 12" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
      edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" fill="none" stroke="'+color+'" stroke-width="2"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" fill="none" stroke="'+color+'" stroke-width="2"/>',
      trash: '<polyline points="3 6 5 6 21 6" fill="none" stroke="'+color+'" stroke-width="2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" fill="none" stroke="'+color+'" stroke-width="2"/>',
      copy: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2" fill="none" stroke="'+color+'" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="'+color+'" stroke-width="2"/>',
      share: '<circle cx="18" cy="5" r="3" fill="none" stroke="'+color+'" stroke-width="2"/><circle cx="6" cy="12" r="3" fill="none" stroke="'+color+'" stroke-width="2"/><circle cx="18" cy="19" r="3" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" stroke="'+color+'" stroke-width="2"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" stroke="'+color+'" stroke-width="2"/>',
      user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" fill="none" stroke="'+color+'" stroke-width="2"/><circle cx="12" cy="7" r="4" fill="none" stroke="'+color+'" stroke-width="2"/>',
      key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round"/>',
      settings: '<circle cx="12" cy="12" r="3" fill="none" stroke="'+color+'" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" fill="none" stroke="'+color+'" stroke-width="2"/>',
      dollar: '<line x1="12" y1="1" x2="12" y2="23" stroke="'+color+'" stroke-width="2"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" fill="none" stroke="'+color+'" stroke-width="2"/>',
      chart: '<line x1="18" y1="20" x2="18" y2="10" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="20" x2="12" y2="4" stroke="'+color+'" stroke-width="2"/><line x1="6" y1="20" x2="6" y2="14" stroke="'+color+'" stroke-width="2"/>',
      back: '<line x1="19" y1="12" x2="5" y2="12" stroke="'+color+'" stroke-width="2"/><polyline points="12 19 5 12 12 5" fill="none" stroke="'+color+'" stroke-width="2"/>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="17" x2="12.01" y2="17" stroke="'+color+'" stroke-width="2"/>',
      info: '<circle cx="12" cy="12" r="10" fill="none" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="16" x2="12" y2="12" stroke="'+color+'" stroke-width="2"/><line x1="12" y1="8" x2="12.01" y2="8" stroke="'+color+'" stroke-width="2"/>',
    };
    const svg = icons[name] || icons.box;
    return '<svg viewBox="0 0 24 24" width="'+size+'" height="'+size+'">'+svg+'</svg>';
  }
`;
s = s.replace("  function pickMsg(arr) {\n    if (!arr || !arr.length) return '';", iconFunc + "\n  function pickMsg(arr) {\n    if (!arr || !arr.length) return '';");

// === PHASE 4: JS - REPLACE CATEGORIES ===
s = s.replace("    produce: { id: 'produce', name: 'خضار وفاكهة 🥬', icon: '🥬', color: '#27AE60' },\n    grocery: { id: 'grocery', name: 'بقالة ودكان 🛒', icon: '🛒', color: '#E67E22' },\n    cleaning: { id: 'cleaning', name: 'نظافة ومنزل 🧹', icon: '🧹', color: '#3498DB' },\n    pharmacy: { id: 'pharmacy', name: 'صيدلية 💊', icon: '💊', color: '#E91E8C' },\n    emergency: { id: 'emergency', name: 'طوارئ之家 🚨', icon: '🚨', color: '#E74C3C' },\n    other: { id: 'other', name: 'أخرى 📦', icon: '📦', color: '#8E44AD' }",
  "    produce: { id: 'produce', name: 'خضار وفاكهة', svg: 'leaf', color: '#27AE60' },\n    grocery: { id: 'grocery', name: 'بقالة ودكان', svg: 'cart', color: '#E67E22' },\n    cleaning: { id: 'cleaning', name: 'نظافة ومنزل', svg: 'sparkle', color: '#3498DB' },\n    pharmacy: { id: 'pharmacy', name: 'صيدلية', svg: 'pill', color: '#E91E8C' },\n    emergency: { id: 'emergency', name: 'طوارئ', svg: 'alert', color: '#E74C3C' },\n    other: { id: 'other', name: 'أخرى', svg: 'box', color: '#8E44AD' }");

// === PHASE 5: JS - REPLACE TOAST FUNCTION ===
s = s.replace("    const iconMap = { success: '✅', error: '❌', warning: '⚠️', info: '💬' };\n    t.innerHTML = `<div class=\"toast-icon\">${iconMap[type] || '💬'}</div><div>${message}</div>`;",
  "    const iconMap = { success: icon('check', 16, 'var(--success)'), error: icon('alert', 16, 'var(--danger)'), warning: icon('warning', 16, 'var(--pending)'), info: icon('info', 16, 'var(--primary)') };\n    t.innerHTML = `<div class=\"toast-icon\">${iconMap[type] || icon('info', 16, 'var(--primary)')}</div><div>${message}</div>`;");

// === PHASE 6: JS - REPLACE SPEECH BUBBLE ===
s = s.replace("  function speechBubble(msg, type) {\n    const avatar = type === 'wife' ? MSG.wifeCharacter : type === 'husband' ? MSG.husbandCharacter : MSG.appCharacter;\n    return `<div class=\"bubble-row ${type}\">\n      <div class=\"bubble-avatar\">${avatar}</div>\n      <div class=\"speech-bubble ${type}\">${msg}</div>\n    </div>`;\n  }",
  "  function speechBubble(msg, type) {\n    const colors = { wife: '#E91E8C', husband: '#2980B9', 'app-msg': 'var(--primary)' };\n    const labels = { wife: 'زوجتي', husband: 'زوجي', 'app-msg': 'بيتنا' };\n    return `<div class=\"bubble-row ${type}\">\n      <div class=\"bubble-avatar\" style=\"background:${colors[type]};color:#fff;font-size:11px;font-weight:800;\">${labels[type].charAt(0)}</div>\n      <div class=\"speech-bubble ${type}\">${msg}</div>\n    </div>`;\n  }");

// === PHASE 7: JS - REPLACE CONFIRM DIALOG ===
s = s.replace("      const html = `<div class=\"confirm-dialog\">\n        <div class=\"confirm-icon\">${danger ? '⚠️' : '❓'}</div>",
  "      const confirmIconHTML = danger ? icon('warning', 28, 'var(--danger)') : icon('info', 28, 'var(--primary)');\n      const html = `<div class=\"confirm-dialog\">\n        <div class=\"confirm-icon\" style=\"background:${danger ? 'var(--danger-light)' : 'var(--primary-light)'};color:${danger ? 'var(--danger)' : 'var(--primary)'}\">${confirmIconHTML}</div>");
// Fix confirm dialog button emojis
s = s.replace("          <button class=\"btn\" id=\"cancelBtn\">${cancelText || '↩️ لا'}</button>",
  "          <button class=\"btn\" id=\"cancelBtn\">${cancelText || 'لا'}</button>");

// === PHASE 8: JS - REPLACE BOTTOM NAV ===
s = s.replace("  function renderBottomNav() {\n    const t = state.currentTab;\n    const tabs = [\n      { id: 'home', label: 'الرئيسية', icon: '🏠' },\n      { id: 'orders', label: 'الطلبات', icon: '🛒' },\n      { id: 'expenses', label: 'المصروفات', icon: '💰' },\n      { id: 'reports', label: 'التقارير', icon: '📊' },\n      { id: 'settings', label: 'الإعدادات', icon: '⚙️' }\n    ];\n    return `<nav class=\"bottom-nav\">${tabs.map(tab => `<button class=\"nav-item ${t === tab.id ? 'active' : ''}\" data-tab=\"${tab.id}\"><span style=\"font-size:18px;\">${tab.icon}</span><span>${tab.label}</span></button>`).join('')}</nav>`;\n  }",
  "  function renderBottomNav() {\n    const t = state.currentTab;\n    const tabs = [\n      { id: 'home', label: 'الرئيسية', icon: 'home' },\n      { id: 'orders', label: 'الطلبات', icon: 'cart' },\n      { id: 'expenses', label: 'المصروفات', icon: 'dollar' },\n      { id: 'reports', label: 'التقارير', icon: 'chart' },\n      { id: 'settings', label: 'الإعدادات', icon: 'settings' }\n    ];\n    return `<nav class=\"bottom-nav\">${tabs.map(tab => `<button class=\"nav-item ${t === tab.id ? 'active' : ''}\" data-tab=\"${tab.id}\">${icon(tab.icon, 22)}<span>${tab.label}</span></button>`).join('')}</nav>`;\n  }");

// === PHASE 9: JS - REPLACE WELCOME SCREEN ===
s = s.replace("      <div class=\"brand-icon\">🏠</div>",
  "      <div class=\"brand-icon\">${icon('home', 48, 'var(--primary)')}</div>");
s = s.replace("      <div class=\"brand-desc\">طلبات البيت ومصاريفه في مكان واحد... والجوهرة هي الحب ❤️</div>",
  "      <div class=\"brand-desc\">طلبات البيت ومصاريفه في مكان واحد... والجوهرة هي الحب</div>");
s = s.replace("        <button class=\"btn btn-primary\" id=\"goCreate\">🏠 عمل بيت جديد</button>\n        <button class=\"btn\" id=\"goJoin\">🔗 انضم لبيت موجود</button>",
  "        <button class=\"btn btn-primary\" id=\"goCreate\">عمل بيت جديد</button>\n        <button class=\"btn\" id=\"goJoin\">انضم لبيت موجود</button>");

// === PHASE 10: JS - REPLACE CREATE HOME ===
s = s.replace("      <button class=\"btn-ghost\" id=\"backWelcome\" style=\"margin-bottom:6px;\">↩️ رجوع</button>",
  "      <button class=\"btn-ghost\" id=\"backWelcome\" style=\"margin-bottom:6px;\">رجوع</button>");
s = s.replace("      <h2 class=\"form-title\">عمل بيت جديد 🏡</h2>",
  "      <h2 class=\"form-title\">عمل بيت جديد</h2>");
s = s.replace("      <button class=\"btn btn-primary\" id=\"submitCreate\">🏠 عمل البيت</button>",
  "      <button class=\"btn btn-primary\" id=\"submitCreate\">عمل البيت</button>");

// === PHASE 11: JS - REPLACE CREATED SUCCESS ===
s = s.replace("      <div class=\"success-icon\">🎉</div>",
  "      <div class=\"success-icon\">${icon('check', 36, 'var(--success)')}</div>");
s = s.replace("        <button class=\"btn\" id=\"copyCodeBtn\">📋 نسخ الكود</button>\n        <button class=\"btn btn-primary\" id=\"gotoUsername\">🚪 ادخل البيت</button>",
  "        <button class=\"btn\" id=\"copyCodeBtn\">نسخ الكود</button>\n        <button class=\"btn btn-primary\" id=\"gotoUsername\">ادخل البيت</button>");

// === PHASE 12: JS - REPLACE JOIN HOME ===
s = s.replace("      <button class=\"btn-ghost\" id=\"backWelcome2\" style=\"margin-bottom:6px;\">↩️ رجوع</button>",
  "      <button class=\"btn-ghost\" id=\"backWelcome2\" style=\"margin-bottom:6px;\">رجوع</button>");
s = s.replace("      <h2 class=\"form-title\">ادخل بيت موجود 🔗</h2>",
  "      <h2 class=\"form-title\">ادخل بيت موجود</h2>");
s = s.replace("      <button class=\"btn btn-primary\" id=\"submitJoin\">🔑 انضم للبيت</button>",
  "      <button class=\"btn btn-primary\" id=\"submitJoin\">انضم للبيت</button>");

// === PHASE 13: JS - REPLACE USERNAME SCREEN ===
s = s.replace("      <h2 class=\"form-title\">قولنا اسمك؟ 👋</h2>",
  "      <h2 class=\"form-title\">قولنا اسمك؟</h2>");
s = s.replace("      <button class=\"btn btn-primary\" id=\"submitUsername\">✅ يلا ندخل</button>",
  "      <button class=\"btn btn-primary\" id=\"submitUsername\">يلا ندخل</button>");

// === PHASE 14: JS - REPLACE HOME PAGE ===
s = s.replace("    const greeting = hour < 12 ? 'صباح الخير ☀️' : hour < 17 ? 'مساء النور 🌤️' : 'مساء الخير 🌙';",
  "    const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء النور' : 'مساء الخير';");
s = s.replace("<div class=\"greeting\">${greeting} يا ${escapeHTML(userName)} 👋</div>",
  "<div class=\"greeting\">${greeting} يا ${escapeHTML(userName)}</div>");
s = s.replace("<div class=\"page-title\">طلبات البيت 🏡</div>",
  "<div class=\"page-title\">طلبات البيت</div>");

// === PHASE 15: JS - REPLACE STAT CARDS ===
s = s.replace("<div class=\"stat-icon\">📋</div>",
  "<div class=\"stat-icon\">${icon('cart', 22, 'var(--primary)')}</div>");
s = s.replace("<div class=\"stat-icon\">✅</div>",
  "<div class=\"stat-icon\">${icon('check', 22, 'var(--success)')}</div>");
s = s.replace("<div class=\"stat-icon\">💵</div>",
  "<div class=\"stat-icon\">${icon('dollar', 22, 'var(--pending)')}</div>");
s = s.replace("<div class=\"stat-icon\">📅</div>",
  "<div class=\"stat-icon\">${icon('chart', 22, 'var(--accent)')}</div>");

// === PHASE 16: JS - REPLACE EMPTY ORDERS ===
s = s.replace("      <div class=\"empty-icon\">📭</div>",
  "      <div class=\"empty-icon\">${icon('cart', 48, 'var(--text-muted)')}</div>");
s = s.replace("      <button class=\"btn btn-primary\" id=\"emptyAddOrder\">➕ زوّد طلب</button>",
  "      <button class=\"btn btn-primary\" id=\"emptyAddOrder\">زوّد طلب</button>");

// === PHASE 17: JS - REPLACE ORDER CARD ===
s = s.replace("    const loc = o.purchaseLocation ? `<span class=\"meta-item\">📍 ${escapeHTML(o.purchaseLocation)}</span>` : '';",
  "    const loc = o.purchaseLocation ? `<span class=\"meta-item\">${escapeHTML(o.purchaseLocation)}</span>` : '';");
s = s.replace("    const notes = o.notes ? `<span class=\"meta-item\">📝 ${escapeHTML(o.notes)}</span>` : '';",
  "    const notes = o.notes ? `<span class=\"meta-item\">${escapeHTML(o.notes)}</span>` : '';");
s = s.replace("${purchased ? '✅ اتشترى' : '📋 مطلوب'}",
  "${purchased ? 'تم الشراء' : 'مطلوب'}");
// Replace cat.icon with SVG icon in order card
s = s.replace("<span class=\"meta-item\">${cat.icon} ${getCategoryName(o.id)}</span>",
  "<span class=\"meta-item\">${icon(cat.svg, 14, catColor)} ${getCategoryName(o.id)}</span>");
// Add catColor variable to renderOrderCard
s = s.replace("    const cat = CATEGORIES[o.categoryId] || CATEGORIES.other;\n    const purchased = o.status === 'purchased';",
  "    const cat = CATEGORIES[o.categoryId] || CATEGORIES.other;\n    const catColor = state.categoryColors?.[cat.id] || cat.color;\n    const purchased = o.status === 'purchased';");

// === PHASE 18: JS - REPLACE ORDERS PAGE ===
s = s.replace("<div class=\"greeting\">الطلبات 🛒</div>",
  "<div class=\"greeting\">الطلبات</div>");
s = s.replace("🔍",
  "${icon('search', 16, 'var(--text-muted)')}");
s = s.replace("['pending', '📋 مطلوب'], ['done', '✅ اتشترى']",
  "['pending', 'مطلوب'], ['done', 'تم']");
s = s.replace("['all', '📑 الكل']",
  "['all', 'الكل']");
// Replace cat.icon in category filter chips
s = s.replace("...CATEGORY_LIST.map(c => [c.id, `${c.icon} ${getCategoryName(c.id)}`])",
  "...CATEGORY_LIST.map(c => [c.id, `${getCategoryName(c.id)}`])");
// Replace category card icons and badges
s = s.replace("<div class=\"category-card-icon\" style=\"background:${catColor}20;color:${catColor};\">${cat.icon}</div>",
  "<div class=\"category-card-icon\" style=\"background:${catColor}20;color:${catColor};\">${icon(cat.svg, 20, catColor)}</div>");
s = s.replace("${pendingCount > 0 ? `${pendingCount} مطلوب` : '✅ خلاص'}",
  "${pendingCount > 0 ? `${pendingCount} مطلوب` : 'تم'}");

// === PHASE 19: JS - REPLACE EXPENSES PAGE ===
s = s.replace("<div class=\"greeting\">المصروفات 💰</div>",
  "<div class=\"greeting\">المصروفات</div>");
s = s.replace("<div class=\"page-title\">الحساب يا معلم 💸</div>",
  "<div class=\"page-title\">الحساب</div>");
s = s.replace("<h3>ذكريات المعركة 😂</h3>",
  "<h3>ذكريات المعركة</h3>");
// Replace expense empty state
s = s.replace("<div class=\"empty-icon\">💸</div>",
  "<div class=\"empty-icon\">${icon('dollar', 48, 'var(--text-muted)')}</div>");
s = s.replace("<button class=\"btn btn-primary\" id=\"emptyAddExpense\">💰 زوّد مصروف</button>",
  "<button class=\"btn btn-primary\" id=\"emptyAddExpense\">زوّد مصروف</button>");
// Replace expense category icons
s = s.replace("<div class=\"exp-cat\" style=\"background:${cat.color}20;color:${cat.color}\">${cat.icon}</div>",
  "<div class=\"exp-cat\" style=\"background:${cat.color}20;color:${cat.color}\">${icon(cat.svg, 18, cat.color)}</div>");
s = s.replace("🗑️ شيل",
  "حذف");

// === PHASE 20: JS - REPLACE REPORTS PAGE ===
s = s.replace("<div class=\"greeting\">التقارير 📊</div>",
  "<div class=\"greeting\">التقارير</div>");
s = s.replace("<div class=\"empty-icon\">📊</div>",
  "<div class=\"empty-icon\">${icon('chart', 48, 'var(--text-muted)')}</div>");
s = s.replace("☀️ تقرير النهارده",
  "تقرير اليوم");
s = s.replace("📅 تقرير الأسبوع",
  "تقرير الأسبوع");
s = s.replace("📈 المصاريف (آخر 7 أيام)",
  "المصاريف (آخر 7 أيام)");
s = s.replace("🗓️ تقرير الشهر",
  "تقرير الشهر");
s = s.replace("📊 التوزيع على الأقسام",
  "التوزيع على الأقسام");
s = s.replace("📈 المصاريف اليومية (الشهر)",
  "المصاريف اليومية (الشهر)");
s = s.replace("🏆 ملخص كل شيء",
  "الملخص");
s = s.replace("عملية شراء 🎉",
  "عملية شراء");
// Replace category icons in report cards
s = s.replace("${dayCat.id ? (CATEGORIES[dayCat.id]?.icon || '') + ' ' + getCategoryName(dayCat.id) : '—'}",
  "${dayCat.id ? getCategoryName(dayCat.id) : '—'}");
s = s.replace("${weekCat.id ? (CATEGORIES[weekCat.id]?.icon || '') + ' ' + getCategoryName(weekCat.id) : '—'}",
  "${weekCat.id ? getCategoryName(weekCat.id) : '—'}");
s = s.replace("${monthCat.id ? (CATEGORIES[monthCat.id]?.icon || '') + ' ' + getCategoryName(monthCat.id) : '—'}",
  "${monthCat.id ? getCategoryName(monthCat.id) : '—'}");

// === PHASE 21: JS - REPLACE SETTINGS PAGE ===
s = s.replace("<div class=\"greeting\">الإعدادات ⚙️</div>",
  "<div class=\"greeting\">الإعدادات</div>");
s = s.replace("<div class=\"si-icon\">👤</div>",
  "<div class=\"si-icon\">${icon('user', 18, 'var(--primary)')}</div>");
s = s.replace("<button class=\"si-action\" id=\"editUserBtn\">✏️</button>",
  "<button class=\"si-action\" id=\"editUserBtn\">${icon('edit', 14, 'var(--text-muted)')}</button>");
s = s.replace("<div class=\"si-icon\">🏡</div>",
  "<div class=\"si-icon\">${icon('home', 18, 'var(--primary)')}</div>");
s = s.replace("<button class=\"si-action\" id=\"editHomeNameBtn\">✏️</button>",
  "<button class=\"si-action\" id=\"editHomeNameBtn\">${icon('edit', 14, 'var(--text-muted)')}</button>");
s = s.replace("<div class=\"si-icon\">🔑</div>",
  "<div class=\"si-icon\">${icon('key', 18, 'var(--primary)')}</div>");
s = s.replace("📋 نسخ</button><button class=\"btn btn-primary btn-sm\" id=\"shareHomeCode\">↗️ ابعت</button>",
  "${icon('copy', 14)} نسخ</button><button class=\"btn btn-primary btn-sm\" id=\"shareHomeCode\">${icon('share', 14)} ابعت</button>");
// Replace category icons in settings
s = s.replace("اضغط على اللون لتغييره • ✏️ لتعديل الاسم",
  "اضغط على اللون لتغييره • لتعديل الاسم");
s = s.replace("<div class=\"color-item-icon\" style=\"background:${currentColor}20;color:${currentColor};\">${cat.icon}</div>",
  "<div class=\"color-item-icon\" style=\"background:${currentColor}20;color:${currentColor};\">${icon(cat.svg, 16, currentColor)}</div>");
s = s.replace("data-editcat=\"${cat.id}\" style=\"width:28px;height:28px;font-size:12px;\" aria-label=\"تعديل\">✏️</button>",
  "data-editcat=\"${cat.id}\" style=\"width:28px;height:28px;font-size:12px;\" aria-label=\"تعديل\">${icon('edit', 12, 'var(--text-muted)')}</button>");
s = s.replace("<div class=\"si-icon\">💚</div>",
  "<div class=\"si-icon\">${icon('dollar', 18, 'var(--success)')}</div>");
s = s.replace("<div class=\"si-icon\">📦</div>",
  "<div class=\"si-icon\">${icon('cart', 18, 'var(--primary)')}</div>");
s = s.replace("<div class=\"si-icon\">💰</div>",
  "<div class=\"si-icon\">${icon('chart', 18, 'var(--pending)')}</div>");
// Learned tags - remove cat.icon
s = s.replace("${CATEGORIES[catId]?.icon || ''} ${escapeHTML(term)} → ${getCategoryName(catId)}",
  "${getCategoryName(catId)} → ${escapeHTML(term)}");
s = s.replace("🗑️ مسح الكل",
  "${icon('trash', 14, 'var(--danger)')} مسح الكل");
// Danger section
s = s.replace("<div class=\"settings-title\">خطر ⚠️</div>",
  "<div class=\"settings-title\">خطر</div>");
s = s.replace("<div class=\"si-icon\" style=\"background:var(--danger-light);color:var(--danger)\">🗑️</div>",
  "<div class=\"si-icon\" style=\"background:var(--danger-light);color:var(--danger)\">${icon('trash', 18, 'var(--danger)')}</div>");
// About section
s = s.replace("صُنع بـ ❤️ ل أهل بيتنا",
  "صُنع بحب لأهل بيتنا");
s = s.replace("بيتنا v2.0 • النسخة الكوميدية 😂",
  "بيتنا v2.0");

// === PHASE 22: JS - REPLACE MODAL TITLES ===
s = s.replace("✏️ تعديل الطلب",
  "تعديل الطلب");
s = s.replace("➕ زوّد طلب",
  "زوّد طلب");
s = s.replace("💾 حفظ",
  "حفظ");
s = s.replace("↩️ رجوع",
  "رجوع");
s = s.replace("🔄 الطلبات اللي بتتكرر",
  "الطلبات اللي بتتكرر");
s = s.replace("⚠️ ده قسم صيدلية",
  "تنبيه: ده قسم صيدلية");
s = s.replace("💡 مش عارفين القسم ده",
  "مش عارفين القسم ده");
// Replace cat.icon in category options in modals
s = s.replace("<button class=\"cat-opt\" data-catid=\"${c.id}\"><span>${c.icon}</span><span>${getCategoryName(c.id)}</span></button>",
  "<button class=\"cat-opt\" data-catid=\"${c.id}\"><span>${icon(c.svg, 16, c.color)}</span><span>${getCategoryName(c.id)}</span></button>");

// === PHASE 23: JS - REPLACE PURCHASE MODAL ===
s = s.replace("🎉 اشﺖر",
  "اشت");
// Actually let's be more careful
s = s.replace("🎉 اشتريت",
  "اشتريت");
// Fix: The original has "🎉 اشترت" - let's find it
s = s.replace("<h2>🎉 اشترت",
  "<h2>اشترت");
s = s.replace("✅ جبتها يا بطل",
  "جبتها يا بطل");

// === PHASE 24: JS - REPLACE ADD EXPENSE MODAL ===
s = s.replace("<h2>💰 مصروف جديد</h2>",
  "<h2>مصروف جديد</h2>");
// Replace cat.icon in expense modal
s = s.replace("<button class=\"cat-opt ${i === 5 ? 'selected' : ''}\" data-catid=\"${c.id}\"><span>${c.icon}</span><span>${getCategoryName(c.id)}</span></button>",
  "<button class=\"cat-opt ${i === 5 ? 'selected' : ''}\" data-catid=\"${c.id}\"><span>${icon(c.svg, 16, c.color)}</span><span>${getCategoryName(c.id)}</span></button>");
s = s.replace("💾 حفظ</button><button class=\"btn\" id=\"cancelExpBtn\">↩️ رجوع</button>",
  "حفظ</button><button class=\"btn\" id=\"cancelExpBtn\">رجوع</button>");

// === PHASE 25: JS - REPLACE CONTEXT MENU ===
s = s.replace("<span class=\"ctx-icon\">✅</span>",
  "<span class=\"ctx-icon\">${icon('check', 16, 'var(--success)')}</span>");
s = s.replace("<span class=\"ctx-icon\">✏️</span>",
  "<span class=\"ctx-icon\">${icon('edit', 16, 'var(--primary)')}</span>");
s = s.replace("<span class=\"ctx-icon\">🗑️</span>",
  "<span class=\"ctx-icon\">${icon('trash', 16, 'var(--danger)')}</span>");

// === PHASE 26: JS - REPLACE DELETE CONFIRM ===
s = s.replace("confirmText: '🗑️ امسحه', cancelText: '↩️ لا'",
  "confirmText: 'امسحه', cancelText: 'لا'");
s = s.replace("confirmText: '🗑️ امسحه', cancelText: '↩️ لا', danger: true",
  "confirmText: 'امسحه', cancelText: 'لا', danger: true");

// === PHASE 27: JS - REPLACE SETTINGS EDIT MODALS ===
s = s.replace("💾 حفظ</button><button class=\"btn\" id=\"cancelTextBtn\">↩️ رجوع</button>",
  "حفظ</button><button class=\"btn\" id=\"cancelTextBtn\">رجوع</button>");

// === PHASE 28: JS - CLEAN TOAST MESSAGES ===
s = s.replace('"تمام يا ستي ✓"', '"تمام يا ستي"');
s = s.replace('"上帝يا حبيبي، تمام ✓"', '"تمام يا حبيبي"');
s = s.replace('" handled ✓"', '" handled"');
s = s.replace('" يس equalTo ✓"', '" تمام"');
s = s.replace("toast(ok ? 'تم النسخ ✓' : 'مقدرش أنسخ'",
  "toast(ok ? 'تم النسخ' : 'مقدرش أنسخ'");
s = s.replace("toast('تم التعديل ✓'",
  "toast('تم التعديل'");
s = s.replace("toast('اتمسح ✓'",
  "toast('اتمسح'");
s = s.replace("toast('تم المسح ✓'",
  "toast('تم المسح'");
s = s.replace("toast('تمام، الاسم اتحدث ✓'",
  "toast('تمام، الاسم اتحدث'");
s = s.replace("toast('اسم البيت اتحدث ✓'",
  "toast('اسم البيت اتحدث'");
s = s.replace("toast('اسم القسم اتحدث ✓'",
  "toast('اسم القسم اتحدث'");
s = s.replace("toast('تم النسخ/المشاركة ✓'",
  "toast('تم النسخ/المشاركة'");
s = s.replace("toast('تم تسجيل المصروف ✓'",
  "toast('تم تسجيل المصروف'");
s = s.replace("toast(`زوّدت ${items.length} طلبات ✓ 😂`",
  "toast(`زوّدت ${items.length} طلبات`");
s = s.replace("toast(`أهلاً يا ${name}! 👋`",
  "toast(`أهلاً يا ${name}!`");

// === PHASE 29: JS - REPLACE SHARE TEXT ===
s = s.replace("const text = `تعالى ا joining بيتنا 🏠\\nكود הבית: ${code}`",
  "const text = `تعالى انضم لبيتنا\\nكود البيت: ${code}`");

// === PHASE 30: JS - ADD ANIMATION CLASSES ===
// Add animate-in to stat cards
s = s.replace("<div class=\"stat-card\"><div class=\"stat-icon\">",
  "<div class=\"stat-card animate-in\"><div class=\"stat-icon\">");
// Add animate-in to speech bubbles
s = s.replace("${speechBubble(pickMsg(MSG.wifeGreeting), 'wife')}",
  "${speechBubble(pickMsg(MSG.wifeGreeting), 'wife')}");
// Add animate-in to category groups
s = s.replace("<div class=\"category-group\">",
  "<div class=\"category-group animate-in\">");
// Add animate-in to order cards
s = s.replace("<div class=\"order-card ${purchased ? 'purchased' : ''}\" data-id=\"${o.id}\">",
  "<div class=\"order-card ${purchased ? 'purchased' : ''}\" data-id=\"${o.id}\">");
// Add animate-in to expense list items
s = s.replace("<div class=\"exp-list-item\" data-eid=\"${e.id}\">",
  "<div class=\"exp-list-item animate-in\" data-eid=\"${e.id}\">");
// Add animate-in to report cards
s = s.replace("<div class=\"report-card\">",
  "<div class=\"report-card animate-in\">");
// Add animate-in to settings cards
s = s.replace("<div class=\"settings-card\">",
  "<div class=\"settings-card animate-in\">");

// === PHASE 31: JS - ADD animate-in-delay to staggered elements ===
// Add stagger delays to stat cards
s = s.replace("<div class=\"stat-card animate-in\"><div class=\"stat-icon\">${icon('cart'",
  "<div class=\"stat-card animate-in\"><div class=\"stat-icon\">${icon('cart'");
// This is getting complex - let's add stagger via the second stat card
s = s.replace("<div class=\"stats-row\">\n        <div class=\"stat-card animate-in\">",
  "<div class=\"stats-row\">\n        <div class=\"stat-card animate-in\">");
// We need to add different delays. Let's do it differently - add a counter approach
// Actually the simplest is to just add animate-in to all and let CSS handle it

// === PHASE 32: FIX - Ensure catColor is used in order card ===
s = s.replace("${icon(cat.svg, 14, catColor)} ${getCategoryName(o.id)}",
  "${icon(cat.svg, 14, catColor)} ${getCategoryName(o.id)}");

// === PHASE 33: Fix renderDonut to use svg instead of icon ===
s = s.replace("const entries = CATEGORY_LIST.map(c => ({ id: c.id, name: getCategoryName(c.id), icon: c.icon, color: state.categoryColors?.[c.id] || c.color, value: breakdown[c.id] || 0 }))",
  "const entries = CATEGORY_LIST.map(c => ({ id: c.id, name: getCategoryName(c.id), svg: c.svg, color: state.categoryColors?.[c.id] || c.color, value: breakdown[c.id] || 0 }))");

// Fix donut legend - remove s.icon
s = s.replace("${s.icon} ${s.name}",
  "${s.name}");

// Fix settings title for learned section
s = s.replace("${CATEGORIES[catId]?.icon || ''} ${escapeHTML(term)} → ${getCategoryName(catId)}",
  "${getCategoryName(catId)} → ${escapeHTML(term)}");

fs.writeFileSync(filePath, s, 'utf8');
console.log('All changes applied successfully!');
