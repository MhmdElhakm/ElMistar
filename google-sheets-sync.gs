/*********************************************************************
 * ELMISTAR — ربط Firestore بجوجل شيت (مزامنة ثنائية الاتجاه)
 * ---------------------------------------------------------------
 * 1) انسخ هذا الملف بالكامل داخل محرر Apps Script الخاص بجدولك.
 * 2) شغّل من القائمة: 🔥 مزامنة فايرستور ← ربط الإعدادات
 *    (أدخل Project ID والصق محتوى JSON الخاص بحساب الخدمة).
 * 3) شغّل: إنشاء صفحات الشيت ثم سحب البيانات من فايرستور.
 * 4) شغّل: تفعيل التعديل الفوري + سحب تلقائي كل 10 دقائق.
 *
 * ملاحظة أمان: يُحفظ مفتاح حساب الخدمة (مشفّر Base64) في Script
 * Properties فقط، ولا يُدرج في الكود أو الملفات.
 *********************************************************************/

// ─────────────────────────── الإعدادات الثابتة ───────────────────────────
var GRADE_TABS = [
  'الصف الأول الابتدائي',
  'الصف الثاني الابتدائي',
  'الصف الثالث الابتدائي',
  'الصف الرابع الابتدائي',
  'الصف الخامس الابتدائي',
  'الصف السادس الابتدائي'
];
var ENROLL_TAB = 'طلبات الالتحاق';

var STUDENT_HEADERS = [
  'معرف', 'رقم الهاتف', 'الاسم', 'الصف الدراسي', 'اسم المجموعة', 'اليوم', 'الساعة',
  'عدد الحصص المسجلة', 'إجمالي الحصص', 'المدفوع', 'المستحق',
  'مستوى الطلب', 'ملاحظات المعلم', 'السنة الدراسية'
];
var ENROLL_HEADERS = [
  'معرف', 'اسم الطالب', 'رقم الهاتف', 'الصف', 'السنة الدراسية',
  'الحالة', 'سبب الرفض', 'تاريخ الطلب'
];

// أعمدة للقراءة فقط (لا يجوز تعديلها من الشيت)
var STUDENT_READONLY = { 1: true, 11: true };
var ENROLL_READONLY = { 1: true, 8: true };

var STUDENT_STATUS_MAP = {
  'مفعل': { isActivated: true, status: '' },
  'قيد الانتظار': { isActivated: false, status: '' },
  'مرفوض': { isActivated: false, status: 'rejected' }
};

var ENROLL_STATUS_REV = {
  'قيد الانتظار': 'pending',
  'تم القبول': 'approved',
  'مرفوض': 'rejected',
  'ملغي': 'deactivated'
};

var YEAR_MAP = {
  'current': 'العام الحالي',
  'previous': 'العام الماضي',
  'summer': 'الكورس الصيفي'
};

// توحيد أسماء الصفوف (نفس المنطق المستخدم في لوحة التحكم)
var GRADE_MAP = {
  '0': 'مرحلة الكي جي والتأسيس', 'kg': 'مرحلة الكي جي والتأسيس', 'تأسيس': 'مرحلة الكي جي والتأسيس',
  'مرحلة التأسيس': 'مرحلة الكي جي والتأسيس', 'تأسيس / KG': 'مرحلة الكي جي والتأسيس', 'مرحلة الكي جي والتأسيس': 'مرحلة الكي جي والتأسيس',
  '1': 'الصف الأول الابتدائي', 'g1': 'الصف الأول الابتدائي', 'الصف الأول': 'الصف الأول الابتدائي',
  'أول ابتدائي': 'الصف الأول الابتدائي', 'الأول الابتدائي': 'الصف الأول الابتدائي', 'الصف الأول الابتدائي': 'الصف الأول الابتدائي',
  '2': 'الصف الثاني الابتدائي', 'g2': 'الصف الثاني الابتدائي', 'الصف الثاني': 'الصف الثاني الابتدائي',
  'ثاني ابتدائي': 'الصف الثاني الابتدائي', 'الثاني الابتدائي': 'الصف الثاني الابتدائي', 'الصف الثاني الابتدائي': 'الصف الثاني الابتدائي',
  '3': 'الصف الثالث الابتدائي', 'g3': 'الصف الثالث الابتدائي', 'الصف الثالث': 'الصف الثالث الابتدائي',
  'ثالث ابتدائي': 'الصف الثالث الابتدائي', 'الثالث الابتدائي': 'الصف الثالث الابتدائي', 'الصف الثالث الابتدائي': 'الصف الثالث الابتدائي',
  '4': 'الصف الرابع الابتدائي', 'g4': 'الصف الرابع الابتدائي', 'الصف الرابع': 'الصف الرابع الابتدائي',
  'رابع ابتدائي': 'الصف الرابع الابتدائي', 'الرابع الابتدائي': 'الصف الرابع الابتدائي', 'الصف الرابع الابتدائي': 'الصف الرابع الابتدائي',
  '5': 'الصف الخامس الابتدائي', 'g5': 'الصف الخامس الابتدائي', 'الصف الخامس': 'الصف الخامس الابتدائي',
  'خامس ابتدائي': 'الصف الخامس الابتدائي', 'الخامس الابتدائي': 'الصف الخامس الابتدائي', 'الصف الخامس الابتدائي': 'الصف الخامس الابتدائي',
  '6': 'الصف السادس الابتدائي', 'g6': 'الصف السادس الابتدائي', 'الصف السادس': 'الصف السادس الابتدائي',
  'سادس ابتدائي': 'الصف السادس الابتدائي', 'السادس الابتدائي': 'الصف السادس الابتدائي', 'الصف السادس الابتدائي': 'الصف السادس الابتدائي'
};

var TAB_CONFIG = {};
GRADE_TABS.forEach(function (t) {
  TAB_CONFIG[t] = { type: 'student', numCols: STUDENT_HEADERS.length, readonly: STUDENT_READONLY };
});
TAB_CONFIG[ENROLL_TAB] = { type: 'enroll', numCols: ENROLL_HEADERS.length, readonly: ENROLL_READONLY };

var groupsCache = {};

// ─────────────────────────── القائمة في الشيت ───────────────────────────
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🔥 مزامنة فايرستور')
    .addItem('1️⃣ ربط الإعدادات (Project + Service Account)', 'setupSheet')
    .addItem('2️⃣ إنشاء صفحات الشيت', 'createTabs')
    .addItem('3️⃣ سحب البيانات من فايرستور', 'syncFromFirestore')
    .addItem('4️⃣ إرسال كل التعديلات إلى فايرستور', 'pushAllToFirestore')
    .addSeparator()
    .addItem('تفعيل التعديل الفوري + سحب تلقائي كل 10 دقائق', 'installTriggers')
    .addItem('إيقاف المؤقتات', 'uninstallTriggers')
    .addSeparator()
    .addItem('حذف الإعدادات المخزنة', 'clearSettings')
    .addToUi();
}

// ─────────────────────────── الإعداد والتهيئة ───────────────────────────
function setupSheet() {
  var ui = SpreadsheetApp.getUi();
  var props = PropertiesService.getScriptProperties();

  var p = ui.prompt('مشروع Firebase — أدخل Project ID', 'أدخل Project ID الخاص بمشروع Firestore (مثال: my-project-id)', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK) return;
  var projectId = p.getResponseText().trim();
  if (!projectId) return;

  var k = ui.prompt('حساب الخدمة — الصق محتوى JSON', 'الصق محتوى ملف JSON كاملاً الخاص بحساب الخدمة\n(من Firebase Console → Project settings → Service accounts → Generate new private key)', ui.ButtonSet.OK_CANCEL);
  if (k.getSelectedButton() !== ui.Button.OK) return;
  var saJson = k.getResponseText().trim();
  var parsed;
  try { parsed = JSON.parse(saJson); } catch (e) { ui.alert('❌ ملف JSON غير صالح'); return; }
  if (!parsed.client_email || !parsed.private_key) { ui.alert('❌ الملف يجب أن يحتوي client_email و private_key'); return; }

  props.setProperty('FIREBASE_PROJECT_ID', projectId);
  props.setProperty('SERVICE_ACCOUNT_B64', Utilities.base64Encode(Utilities.newBlob(saJson, 'application/json').getBytes()));
  CacheService.getScriptCache().remove('fs_token');

  try {
    getAccessToken();
    ui.alert('✅ تم حفظ الإعدادات والتحقق من الاتصال بمشروع Firestore بنجاح');
    createTabs();
  } catch (err) {
    ui.alert('❌ فشل الاتصال: ' + err.message + '\n\nتأكد من أن حساب الخدمة يملك صلاحية (Cloud Datastore User) على المشروع.');
  }
}

function createTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  GRADE_TABS.forEach(function (name, i) {
    var s = ss.getSheetByName(name);
    if (!s) s = ss.insertSheet(name, i);
    applyHeader(s, STUDENT_HEADERS);
    s.setTabColor('#059669');
  });
  var es = ss.getSheetByName(ENROLL_TAB);
  if (!es) es = ss.insertSheet(ENROLL_TAB, GRADE_TABS.length);
  applyHeader(es, ENROLL_HEADERS);
  es.setTabColor('#f59e0b');
  ensureDropdowns();
  ss.toast('✅ تم إنشاء صفحات الشيت وترويساتها', 'المزامنة', 5);
}

function applyHeader(sheet, headers) {
  var r = sheet.getRange(1, 1, 1, headers.length);
  r.setValues([headers])
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff')
    .setVerticalAlignment('middle');
  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 34);
}

function ensureDropdowns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var last = 2000;
  var gradeList = GRADE_TABS.slice();
  var statusList = ['مفعل', 'قيد الانتظار', 'مرفوض'];
  var yearList = ['العام الحالي', 'العام الماضي', 'الكورس الصيفي'];
  var enrollStatusList = ['قيد الانتظار', 'تم القبول', 'مرفوض', 'ملغي'];

  gradeList.forEach(function (name) {
    var s = ss.getSheetByName(name);
    if (!s) return;
    s.getRange(2, 4, last, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(gradeList, true).build());
    s.getRange(2, 12, last, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(statusList, true).build());
    s.getRange(2, 14, last, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(yearList, true).build());
  });

  var es = ss.getSheetByName(ENROLL_TAB);
  if (es) {
    es.getRange(2, 5, last, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(yearList, true).build());
    es.getRange(2, 6, last, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(enrollStatusList, true).build());
  }
}

function getSheet(name) {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
}

// ─────────────────────────── السحب من فايرستور ───────────────────────────
function syncFromFirestore() {
  if (isSyncInProgress()) { SpreadsheetApp.getActiveSpreadsheet().toast('⏳ هناك مزامنة جارية الآن — حاول بعد قليل', 'المزامنة', 4); return; }
  setSyncInProgress(true);
  try {
    ensureConfigured();
    groupsCache = loadGroups();
    var session = loadSessionConfig();

    var studentDocs = listAllDocuments('students');
    var enrollDocs = listAllDocuments('enrollmentRequests');

    var byGrade = {};
    GRADE_TABS.forEach(function (t) { byGrade[t] = []; });

    studentDocs.forEach(function (doc) {
      var s = docToStudent(doc);
      var g = normalizeGrade(s.grade);
      if (GRADE_TABS.indexOf(g) === -1) return; // استبعاد مرحلة KG وغيرها
      var grp = groupsCache[s.groupId];
      s.debt = computeDebt(s, session);
      byGrade[g].push({
        id: s.id, phone: s.phone, name: s.name, grade: g,
        groupName: grp ? grp.name : '',
        day: grp ? grp.day : s.day,
        time: grp ? grp.time : s.hour,
        attCount: s.attendanceCount, total: s.totalSessions, paid: s.paid, debt: s.debt,
        statusLabel: studentStatusLabel(s), notes: s.notes || '', year: yearLabel(s.academicYear)
      });
    });

    GRADE_TABS.forEach(function (tab) {
      var rows = byGrade[tab]
        .sort(function (a, b) { return a.name.localeCompare(b.name, 'ar'); })
        .map(function (r) {
          return [r.id, r.phone, r.name, r.grade, r.groupName, r.day, r.time,
            r.attCount, r.total, r.paid, r.debt, r.statusLabel, r.notes, r.year];
        });
      writeRows(tab, rows, STUDENT_HEADERS.length);
    });

    var enrollRows = enrollDocs.map(function (doc) {
      var r = docToEnroll(doc);
      return [r.id, r.studentName, r.studentPhone, normalizeGrade(r.studentGrade),
        yearLabel(r.academicYear), enrollStatusLabel(r.status), r.rejectionReason || '', formatDate(r.createdAt)];
    });
    writeRows(ENROLL_TAB, enrollRows, ENROLL_HEADERS.length);

    ensureDropdowns();
    SpreadsheetApp.getActiveSpreadsheet().toast('✅ تم سحب البيانات من فايرستور', 'المزامنة', 5);
  } finally {
    setSyncInProgress(false);
  }
}

function writeRows(tab, rows, numCols) {
  var sheet = getSheet(tab);
  if (!sheet) return;
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
  if (!rows.length) return;
  sheet.getRange(2, 1, rows.length, numCols).setValues(rows);
}

// ─────────────────────── إرسال كل التعديلات (أداة) ───────────────────────
function pushAllToFirestore() {
  if (isSyncInProgress()) { SpreadsheetApp.getActiveSpreadsheet().toast('⏳ هناك مزامنة جارية الآن — حاول بعد قليل', 'المزامنة', 4); return; }
  setSyncInProgress(true);
  var count = 0;
  try {
    ensureConfigured();
    groupsCache = loadGroups();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var updatedGroups = {};

    GRADE_TABS.forEach(function (tab) {
      var sheet = ss.getSheetByName(tab);
      if (!sheet) return;
      var last = sheet.getLastRow();
      for (var r = 2; r <= last; r++) {
        var id = sheet.getRange(r, 1).getValue();
        if (!id) continue;
        pushStudentRow(tab, sheet, r, id, updatedGroups);
        count++;
      }
    });

    Object.keys(updatedGroups).forEach(function (gid) {
      var g = updatedGroups[gid];
      patchFields('groups/' + gid, { day: { stringValue: g.day }, time: { stringValue: g.time } });
    });

    var es = ss.getSheetByName(ENROLL_TAB);
    if (es) {
      var last2 = es.getLastRow();
      for (var r2 = 2; r2 <= last2; r2++) {
        var id2 = es.getRange(r2, 1).getValue();
        if (!id2) continue;
        pushEnrollRow(es, r2, id2);
        count++;
      }
    }
    ss.toast('✅ تم إرسال ' + count + ' سجل إلى فايرستور', 'المزامنة', 6);
  } finally {
    setSyncInProgress(false);
  }
}

function pushStudentRow(tab, sheet, r, id, updatedGroups) {
  var vals = sheet.getRange(r, 1, 1, STUDENT_HEADERS.length).getValues()[0];
  var fields = {};
  var mask = [];
  function add(field, fvalue) { fields[field] = fvalue; mask.push(field); }

  var phone = normalizePhone(vals[1]);
  if (phone) add('phone', { stringValue: phone });
  var name = String(vals[2] || '').trim();
  if (name) add('name', { stringValue: name });
  var grade = normalizeGrade(vals[3]);
  if (grade) add('grade', { stringValue: grade });

  var groupName = String(vals[4] || '').trim();
  var gid = groupName ? resolveGroupId(groupName) : '';
  add('groupId', { stringValue: gid });

  var day = String(vals[5] || '').trim();
  var time = String(vals[6] || '').trim();
  if (gid) {
    if (!updatedGroups[gid]) updatedGroups[gid] = { day: '', time: '' };
    updatedGroups[gid].day = day;
    updatedGroups[gid].time = time;
  } else {
    if (day) add('day', { stringValue: day });
    add('hour', { stringValue: time });
  }

  var att = parseInt(vals[7]);
  if (!isNaN(att) && att >= 0) {
    var av = [];
    for (var i = 1; i <= att; i++) av.push({ integerValue: String(i) });
    add('attendance', { arrayValue: { values: av } });
  }
  var total = parseInt(vals[8]);
  if (!isNaN(total) && total > 0) add('totalSessions', { integerValue: String(total) });
  var paid = parseInt(vals[9]);
  if (!isNaN(paid) && paid >= 0) add('paid', { integerValue: String(paid) });

  var st = STUDENT_STATUS_MAP[String(vals[11] || '').trim()];
  if (st) { add('isActivated', { booleanValue: st.isActivated }); add('status', { stringValue: st.status }); }

  add('notes', { stringValue: String(vals[12] || '').trim() });
  var yk = yearKeyFromLabel(String(vals[13] || '').trim());
  if (yk) add('academicYear', { stringValue: yk });

  if (mask.length) patchFields('students/' + id, fields);
}

function pushEnrollRow(sheet, r, id) {
  var vals = sheet.getRange(r, 1, 1, ENROLL_HEADERS.length).getValues()[0];
  var fields = {};
  var mask = [];
  function add(field, fvalue) { fields[field] = fvalue; mask.push(field); }

  var name = String(vals[1] || '').trim();
  if (name) add('studentName', { stringValue: name });
  var phone = normalizePhone(vals[2]);
  if (phone) add('studentPhone', { stringValue: phone });
  var grade = normalizeGrade(vals[3]);
  if (grade) add('studentGrade', { stringValue: grade });
  var yk = yearKeyFromLabel(String(vals[4] || '').trim());
  if (yk) add('academicYear', { stringValue: yk });
  var st = ENROLL_STATUS_REV[String(vals[5] || '').trim()];
  if (st) add('status', { stringValue: st });
  add('rejectionReason', { stringValue: String(vals[6] || '').trim() });

  if (mask.length) patchFields('enrollmentRequests/' + id, fields);
}

// ─────────────────────────── التعديل الفوري (onEdit) ───────────────────────────
function handleSheetEdit(e) {
  if (isSyncInProgress()) return;
  var ss = e.source;
  var sheet = e.range.getSheet();
  var tab = sheet.getName();
  var row = e.range.getRow();
  var col = e.range.getColumn();
  if (row < 2) return;
  var cfg = TAB_CONFIG[tab];
  if (!cfg) return;

  if (cfg.readonly[col]) {
    if (e.oldValue !== undefined) e.range.setValue(e.oldValue); else e.range.clearContent();
    return;
  }
  var id = sheet.getRange(row, 1).getValue();
  if (!id) return;
  var value = (e.value !== undefined ? e.value : '').toString();

  setSyncInProgress(true);
  try {
    if (cfg.type === 'student') {
      applyStudentCell(id, col, value);
      refreshDebtCell(sheet, row, id);
    } else {
      applyEnrollCell(id, col, value);
    }
    ss.toast('✅ تم حفظ التعديل في فايرستور', 'المزامنة', 3);
  } catch (err) {
    ss.toast('❌ لم يُحفظ التعديل: ' + err.message, 'المزامنة', 8);
    var bg = e.range.getBackground();
    e.range.setBackground('#fecaca');
    if (e.oldValue !== undefined) e.range.setValue(e.oldValue); else e.range.clearContent();
    e.range.setBackground(bg);
  } finally {
    setSyncInProgress(false);
  }
}

function applyStudentCell(id, col, value) {
  switch (col) {
    case 2: patchFields('students/' + id, { phone: { stringValue: normalizePhone(value) } }); break;
    case 3: patchFields('students/' + id, { name: { stringValue: String(value).trim() } }); break;
    case 4: patchFields('students/' + id, { grade: { stringValue: normalizeGrade(value) } }); break;
    case 5:
      var gn = String(value).trim();
      patchFields('students/' + id, { groupId: { stringValue: gn ? resolveGroupId(gn) : '' } });
      break;
    case 6:
    case 7:
      applyDayTime(id, col, String(value).trim());
      break;
    case 8:
      var n = parseInt(value);
      if (isNaN(n) || n < 0) throw new Error('عدد الحصص يجب أن يكون رقماً صحيحاً');
      var arr = [];
      for (var i = 1; i <= n; i++) arr.push({ integerValue: String(i) });
      patchFields('students/' + id, { attendance: { arrayValue: { values: arr } } });
      break;
    case 9:
      var t = parseInt(value);
      if (isNaN(t) || t < 1) throw new Error('إجمالي الحصص يجب أن يكون أكبر من صفر');
      patchFields('students/' + id, { totalSessions: { integerValue: String(t) } });
      break;
    case 10:
      var p = parseInt(value);
      if (isNaN(p) || p < 0) throw new Error('المبلغ يجب أن يكون رقماً موجباً');
      patchFields('students/' + id, { paid: { integerValue: String(p) } });
      break;
    case 12:
      var s = STUDENT_STATUS_MAP[String(value).trim()];
      if (!s) throw new Error('قيمة مستوى الطلب غير صالحة');
      patchFields('students/' + id, {
        isActivated: { booleanValue: s.isActivated },
        status: { stringValue: s.status }
      });
      break;
    case 13: patchFields('students/' + id, { notes: { stringValue: String(value) } }); break;
    case 14:
      var yk = yearKeyFromLabel(String(value).trim());
      if (!yk) throw new Error('قيمة السنة الدراسية غير صالحة');
      patchFields('students/' + id, { academicYear: { stringValue: yk } });
      break;
    default: throw new Error('عمود غير قابل للتعديل');
  }
}

function applyEnrollCell(id, col, value) {
  switch (col) {
    case 2: patchFields('enrollmentRequests/' + id, { studentName: { stringValue: String(value).trim() } }); break;
    case 3: patchFields('enrollmentRequests/' + id, { studentPhone: { stringValue: normalizePhone(value) } }); break;
    case 4: patchFields('enrollmentRequests/' + id, { studentGrade: { stringValue: normalizeGrade(value) } }); break;
    case 5:
      var yk = yearKeyFromLabel(String(value).trim());
      if (!yk) throw new Error('قيمة السنة الدراسية غير صالحة');
      patchFields('enrollmentRequests/' + id, { academicYear: { stringValue: yk } });
      break;
    case 6:
      var st = ENROLL_STATUS_REV[String(value).trim()];
      if (!st) throw new Error('قيمة الحالة غير صالحة');
      patchFields('enrollmentRequests/' + id, { status: { stringValue: st } });
      break;
    case 7: patchFields('enrollmentRequests/' + id, { rejectionReason: { stringValue: String(value) } }); break;
    default: throw new Error('عمود غير قابل للتعديل');
  }
}

// تعديل اليوم/الساعة: إذا كان الطالب في مجموعة يُعدَّل موعد المجموعة نفسها، وإلا يُعدَّل حقل الطالب
function applyDayTime(id, col, value) {
  var doc = firestoreFetch('GET', 'students/' + id);
  var f = doc && doc.fields ? doc.fields : {};
  var gid = f.groupId ? f.groupId.stringValue : '';
  if (gid) {
    var field = (col === 6) ? 'day' : 'time';
    var body = {};
    body[field] = { stringValue: value };
    patchFields('groups/' + gid, body);
  } else {
    var field2 = (col === 6) ? 'day' : 'hour';
    var body2 = {};
    body2[field2] = { stringValue: value };
    patchFields('students/' + id, body2);
  }
}

// إعادة احتساب عمود «المستحق» بعد التعديل المالي
function refreshDebtCell(sheet, row, id) {
  var doc = firestoreFetch('GET', 'students/' + id);
  if (!doc || !doc.fields) return;
  var s = docToStudent(doc);
  var session = loadSessionConfig();
  sheet.getRange(row, 11).setValue(computeDebt(s, session));
}

// ─────────────────────────── المؤقتات ───────────────────────────
function installTriggers() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.newTrigger('handleSheetEdit').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('syncFromFirestore').timeBased().everyMinutes(10).create();
  SpreadsheetApp.getActiveSpreadsheet().toast('✅ تم تفعيل التعديل الفوري والسحب التلقائي (كل 10 دقائق)', 'المزامنة', 5);
}

function uninstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  SpreadsheetApp.getActiveSpreadsheet().toast('تم إيقاف جميع المؤقتات', 'المزامنة', 5);
}

function clearSettings() {
  var p = PropertiesService.getScriptProperties();
  p.deleteProperty('FIREBASE_PROJECT_ID');
  p.deleteProperty('SERVICE_ACCOUNT_B64');
  CacheService.getScriptCache().remove('fs_token');
  SpreadsheetApp.getActiveSpreadsheet().toast('تم حذف الإعدادات المخزنة', 'المزامنة', 5);
}

// ─────────────────────────── الوصول إلى Firestore REST ───────────────────────────
function ensureConfigured() {
  if (!getProjectId()) throw new Error('لم يتم ضبط Project ID — شغّل "ربط الإعدادات" من القائمة');
  getSaConfig();
}

function getProjectId() {
  return PropertiesService.getScriptProperties().getProperty('FIREBASE_PROJECT_ID');
}

function getSaConfig() {
  var b64 = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_B64');
  if (!b64) throw new Error('لم يتم حفظ حساب الخدمة بعد');
  return JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64)).getDataAsString('UTF-8'));
}

// إنشاء JWT والتوقيع يدوياً (بدون مكتبات خارجية) للحصول على رمز وصول
function getAccessToken() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get('fs_token');
  if (cached) return cached;

  var sa = getSaConfig();
  var header = { alg: 'RS256', typ: 'JWT' };
  var now = Math.floor(Date.now() / 1000);
  var claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };
  var signingInput = base64url(JSON.stringify(header)) + '.' + base64url(JSON.stringify(claim));
  var signature = Utilities.computeRsaSha256Signature(signingInput, sa.private_key);
  var jwt = signingInput + '.' + base64url(signature);

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + encodeURIComponent(jwt),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('فشل الحصول على رمز الوصول: ' + res.getContentText());
  }
  var token = JSON.parse(res.getContentText()).access_token;
  cache.put('fs_token', token, 3000); // 50 دقيقة
  return token;
}

function base64url(input) {
  return Utilities.base64EncodeWebSafe(input).replace(/=+$/, '');
}

function firestoreFetch(method, path, body) {
  var base = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(getProjectId()) + '/databases/(default)/documents';
  var options = {
    method: method,
    headers: { Authorization: 'Bearer ' + getAccessToken(), 'Content-Type': 'application/json' },
    muteHttpExceptions: true
  };
  if (body) options.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(base + '/' + path, options);
  var code = res.getResponseCode();
  if (code === 401) {
    CacheService.getScriptCache().remove('fs_token');
    options.headers.Authorization = 'Bearer ' + getAccessToken();
    res = UrlFetchApp.fetch(base + '/' + path, options);
    code = res.getResponseCode();
  }
  var text = res.getContentText();
  if (code >= 400) throw new Error('Firestore ' + code + ': ' + text);
  return text ? JSON.parse(text) : null;
}

function listAllDocuments(collection) {
  var out = [];
  var token = '';
  do {
    var q = collection + '?pageSize=300' + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    var data = firestoreFetch('GET', q);
    if (data.documents) out = out.concat(data.documents);
    token = data.nextPageToken || '';
  } while (token);
  return out;
}

function patchFields(docPath, fields) {
  var mask = Object.keys(fields).map(function (f) { return 'updateMask.fieldPaths=' + encodeURIComponent(f); }).join('&');
  return firestoreFetch('PATCH', docPath + '?' + mask, { fields: fields });
}

function docIdFromName(name) {
  var parts = name.split('/');
  return parts[parts.length - 1];
}

// ─────────────────────────── تحويلات البيانات ───────────────────────────
function getInt(f) {
  if (!f) return 0;
  if (f.integerValue !== undefined) return parseInt(f.integerValue);
  if (f.doubleValue !== undefined) return Math.round(Number(f.doubleValue));
  return 0;
}

function docToStudent(doc) {
  var f = doc.fields || {};
  var arr = (f.attendance && f.attendance.arrayValue) ? f.attendance.arrayValue.values : null;
  var count = arr ? arr.length : getInt(f.attendance);
  return {
    id: docIdFromName(doc.name),
    name: f.name ? f.name.stringValue : '',
    phone: f.phone ? f.phone.stringValue : '',
    grade: f.grade ? f.grade.stringValue : '',
    groupId: f.groupId ? f.groupId.stringValue : '',
    day: f.day ? f.day.stringValue : '',
    hour: f.hour ? f.hour.stringValue : '',
    attendanceCount: count,
    totalSessions: getInt(f.totalSessions),
    paid: getInt(f.paid),
    otherExpenses: getInt(f.otherExpenses),
    notes: f.notes ? f.notes.stringValue : '',
    academicYear: f.academicYear ? f.academicYear.stringValue : 'current',
    isActivated: f.isActivated ? f.isActivated.booleanValue : false,
    status: f.status ? f.status.stringValue : ''
  };
}

function docToGroup(doc) {
  var f = doc.fields || {};
  return {
    id: docIdFromName(doc.name),
    name: f.name ? f.name.stringValue : '',
    day: f.day ? f.day.stringValue : '',
    time: f.time ? f.time.stringValue : '',
    category: f.category ? f.category.stringValue : ''
  };
}

function docToEnroll(doc) {
  var f = doc.fields || {};
  return {
    id: docIdFromName(doc.name),
    studentName: f.studentName ? f.studentName.stringValue : '',
    studentPhone: f.studentPhone ? f.studentPhone.stringValue : '',
    studentGrade: f.studentGrade ? f.studentGrade.stringValue : '',
    academicYear: f.academicYear ? f.academicYear.stringValue : 'current',
    status: f.status ? f.status.stringValue : 'pending',
    rejectionReason: f.rejectionReason ? f.rejectionReason.stringValue : '',
    createdAt: f.createdAt ? f.createdAt.timestampValue : ''
  };
}

function loadGroups() {
  var map = {};
  listAllDocuments('groups').forEach(function (doc) {
    var g = docToGroup(doc);
    map[g.id] = g;
    map[g.name] = g;
  });
  return map;
}

function loadSessionConfig() {
  var defaults = {
    current: { sessionPrice: 15, sessionsPerMonth: 8, discount: 0 },
    previous: { sessionPrice: 10, sessionsPerMonth: 4, discount: 0 },
    summer: { sessionPrice: 20, sessionsPerMonth: 12, discount: 0 }
  };
  try {
    var doc = firestoreFetch('GET', 'settings/sessionConfig');
    if (doc && doc.fields) {
      ['current', 'previous', 'summer'].forEach(function (k) {
        var mv = doc.fields[k];
        if (mv && mv.mapValue && mv.mapValue.fields) {
          var f = mv.mapValue.fields;
          defaults[k].sessionPrice = getInt(f.sessionPrice) || defaults[k].sessionPrice;
          defaults[k].sessionsPerMonth = getInt(f.sessionsPerMonth) || defaults[k].sessionsPerMonth;
          defaults[k].discount = getInt(f.discount) || 0;
        }
      });
    }
  } catch (e) {}
  return defaults;
}

function computeDebt(s, session) {
  var price = session[s.academicYear] ? session[s.academicYear].sessionPrice : 15;
  var required = s.attendanceCount * price + s.otherExpenses;
  return Math.max(0, required - s.paid);
}

// حل اسم المجموعة إلى معرفها، وإنشاؤها تلقائياً إن لم تكن موجودة
function resolveGroupId(name) {
  name = String(name || '').trim();
  if (!name) return '';
  if (groupsCache[name] && groupsCache[name].id) return groupsCache[name].id;
  groupsCache = loadGroups();
  if (groupsCache[name] && groupsCache[name].id) return groupsCache[name].id;
  var created = firestoreFetch('POST', 'groups', {
    fields: {
      name: { stringValue: name },
      color: { stringValue: '#f97316' },
      day: { stringValue: '' },
      time: { stringValue: '' },
      category: { stringValue: 'current' },
      report: { stringValue: '' },
      whatsapp: { stringValue: '' }
    }
  });
  var id = docIdFromName(created.name);
  groupsCache[name] = { id: id };
  return id;
}

function normalizeGrade(g) {
  if (!g) return '';
  var s = g.toString().trim();
  return GRADE_MAP[s] || s;
}

function normalizePhone(p) {
  if (p === undefined || p === null) return '';
  var s = String(p).replace(/\D/g, '');
  if (s.length > 0 && s.charAt(0) !== '0') s = '0' + s;
  return s;
}

function studentStatusLabel(s) {
  if (s.isActivated) return 'مفعل';
  if (s.status === 'rejected') return 'مرفوض';
  return 'قيد الانتظار';
}

function enrollStatusLabel(s) {
  var labels = { pending: 'قيد الانتظار', approved: 'تم القبول', rejected: 'مرفوض', deactivated: 'ملغي' };
  return labels[s] || s;
}

function yearLabel(y) { return YEAR_MAP[y] || y || ''; }

function yearKeyFromLabel(label) {
  for (var k in YEAR_MAP) if (YEAR_MAP[k] === label) return k;
  return '';
}

function formatDate(ts) {
  if (!ts) return '';
  var d = new Date(ts);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}

// ─────────────────────────── منع الحلقات أثناء المزامنة ───────────────────────────
function setSyncInProgress(v) {
  var cache = CacheService.getScriptCache();
  if (v) cache.put('syncInProgress', '1', 300);
  else cache.remove('syncInProgress');
}

function isSyncInProgress() {
  return CacheService.getScriptCache().get('syncInProgress') === '1';
}
