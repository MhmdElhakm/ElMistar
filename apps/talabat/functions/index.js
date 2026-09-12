/*
 * Naqisna Push backend — FCM channel (Firebase Cloud Functions, Node 20).
 * Chain: Firestore -> here -> FCM -> browser -> Service Worker -> Notification.
 * Works even when the app page is fully closed (OS/browser permitting).
 * Token source of truth: homes/{homeId}/pushSubs (docs carrying a string `token`).
 * Legacy `fcmTokens` docs are still honored during transition (deduped by token).
 * No secrets in frontend; Admin SDK credentials come from the Functions runtime.
 * The public Web-Push certificate key lives client-side (Firebase Console copy).
 * Deploy: firebase deploy --only functions
 */
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

const TABS = ['home', 'orders', 'enc', 'notifs', 'expenses', 'reports', 'settings'];
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument'
]);

function tabFromUrl(url) {
  const m = String(url || '').match(/#(home|orders|enc|notifs|expenses|reports|settings)\b/);
  if (m) return m[1];
  const s = String(url || '');
  for (const t of TABS) { if (s.includes(t)) return t; }
  return 'notifs';
}

function cleanPayload(q) {
  const tab = TABS.includes(q && q.tab) ? q.tab : tabFromUrl(q && q.url);
  return {
    title: String((q && q.title) || 'ناقصنا إيه').slice(0, 120),
    body: String((q && q.body) || 'عندك تحديث جديد').slice(0, 300),
    tag: String((q && (q.nid || q.id)) || 'naqisna'),
    tab,
    nid: String((q && q.nid) || ''),
    type: String((q && q.type) || '').slice(0, 32),
    urgent: (q && q.urgent) === true
  };
}

function fcmData(p) {
  return {
    title: p.title,
    body: p.body,
    tag: p.tag,
    tab: p.tab,
    nid: p.nid,
    type: p.type || '',
    urgent: p.urgent ? 'true' : 'false'
  };
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function readTokenDocs(homeRef) {
  const out = [];
  for (const sub of ['pushSubs', 'fcmTokens']) {
    try {
      const snap = await homeRef.collection(sub).get();
      out.push(...(snap.docs || []));
    } catch (e) {
      logger.warn('token read failed', { sub, msg: (e && e.message) || 'unknown' });
    }
  }
  return out;
}

async function sendToTokens(tokenDocs, payload, logTag) {
  const byToken = new Map();
  for (const doc of tokenDocs || []) {
    const s = (doc && doc.data) ? doc.data() : {};
    const t = s.token;
    if (!t || typeof t !== 'string') continue;
    if (!byToken.has(t)) byToken.set(t, doc);
  }
  let sent = 0, failed = 0, cleaned = 0;
  for (const batch of chunk([...byToken.keys()], 500)) {
    let resp = null;
    try {
      resp = await messaging.sendEachForMulticast({
        tokens: batch,
        data: fcmData(payload),
        android: { priority: payload.urgent ? 'high' : 'normal', ttl: 86400 * 1000 },
        apns: { headers: { 'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400) } }
      });
    } catch (e) {
      logger.error('fcm batch error', { tag: logTag, msg: (e && e.message) || 'unknown' });
      failed += batch.length;
      continue;
    }
    sent += (resp && resp.successCount) || 0;
    failed += (resp && resp.failureCount) || 0;
    await Promise.all(((resp && resp.responses) || []).map(async (r, i) => {
      if (r && r.success) return;
      const code = r && r.error && r.error.code;
      if (DEAD_TOKEN.has(code)) {
        try { await byToken.get(batch[i]).ref.delete(); cleaned++; } catch {}
      } else {
        logger.warn('fcm send failed', { tag: logTag, code: code || 'unknown' });
      }
    }));
  }
  return { sent, failed, cleaned, devices: byToken.size };
}

/* Queue send: client writes homes/{homeCode}/pushQueue/{qid}
 * {to:'all'|<userId>, [userId alias], title, body, [tab|url], [type], [nid], [urgent],
 *  status:'pending'} — claimed pending->processing->sent|failed|error (idempotent). */
exports.pushQueueSend = onDocumentCreated('homes/{homeCode}/pushQueue/{qid}', async (event) => {
  const homeRef = db.collection('homes').doc(event.params.homeCode);
  const ref = homeRef.collection('pushQueue').doc(event.params.qid);
  let q = null;
  try {
    q = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? snap.data() : null;
      if (!cur || (cur.status && cur.status !== 'pending')) return null;
      tx.set(ref, { status: 'processing', processingAt: Date.now() }, { merge: true });
      return cur;
    });
  } catch (e) {
    logger.error('queue claim error', { msg: (e && e.message) || 'unknown' });
    return;
  }
  if (!q) return;
  if (q.to == null && q.userId != null) q.to = q.userId;
  try {
    const payload = cleanPayload(q);
    const docs = await readTokenDocs(homeRef);
    const all = (!q.to || q.to === 'all')
      ? docs
      : docs.filter((d) => String(((d.data && d.data()) || {}).userId || '') === String(q.to));
    const r = await sendToTokens(all, payload, 'queue');
    await ref.set({ status: r.failed > 0 && r.sent === 0 ? 'failed' : 'sent', ...r, processedAt: Date.now() }, { merge: true });
    logger.info('queue sent', { qid: event.params.qid, ...r });
  } catch (e) {
    logger.error('queue send error', { msg: (e && e.message) || 'unknown' });
    try { await ref.set({ status: 'error', processedAt: Date.now() }, { merge: true }); } catch {}
  }
});

/* Auto fan-out: new items in homes/{code}.notifs -> FCM to other members' devices.
 * Idempotent via pushSent id list on the home doc (survives retries). */
exports.homeNotifsFanout = onDocumentWritten('homes/{homeCode}', async (event) => {
  if (!event.data || !event.data.after || !event.data.after.exists) return;
  const homeRef = db.collection('homes').doc(event.params.homeCode);
  const before = (event.data.before.data() || {}).notifs || [];
  const afterData = event.data.after.data() || {};
  const after = afterData.notifs || [];
  const already = new Set(Array.isArray(afterData.pushSent) ? afterData.pushSent : []);
  const known = new Set(before.map((n) => n && n.id).filter(Boolean));
  const fresh = after.filter((n) => n && n.id && !known.has(n.id) && !already.has(n.id)).slice(-5);
  if (!fresh.length) return;
  const docs = await readTokenDocs(homeRef);
  const done = [];
  for (const n of fresh) {
    const payload = cleanPayload({ title: n.title, body: n.body, tab: n.actionTab, nid: n.id, type: n.type, urgent: n.type === 'urgent' });
    const targets = docs.filter((d) => (d.data() || {}).userId !== n.senderId);
    const r = await sendToTokens(targets, payload, 'fanout');
    logger.info('fanout', { nid: n.id, ...r });
    done.push(n.id);
  }
  try {
    const merged = [...already, ...done].slice(-200);
    await homeRef.set({ pushSent: merged }, { merge: true });
  } catch (e) {
    logger.warn('pushSent update failed', { msg: (e && e.message) || 'unknown' });
  }
});
