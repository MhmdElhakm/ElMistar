/*
 * Naqisna Push backend — FCM channel (Firebase Cloud Functions, Node 20).
 * Chain: Firestore -> here -> FCM -> browser -> Service Worker -> Notification.
 * Works even when the app page is fully closed (OS/browser permitting).
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

function cleanPayload(q) {
  return {
    title: String((q && q.title) || 'ناقصنا إيه').slice(0, 120),
    body: String((q && q.body) || 'عندك تحديث جديد').slice(0, 300),
    tag: String((q && (q.nid || q.id)) || 'naqisna'),
    tab: TABS.includes(q && q.tab) ? q.tab : 'notifs',
    nid: String((q && q.nid) || ''),
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
    urgent: p.urgent ? 'true' : 'false'
  };
}

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
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

/* Admin/queue send: client writes homes/{code}/pushQueue/{id}
 * {to:'all'|<userId>, title, body, tab, nid, urgent?, status:'pending'} */
exports.pushQueueSend = onDocumentCreated('homes/{homeCode}/pushQueue/{qid}', async (event) => {
  const q = (event.data && event.data.data()) || {};
  if (q.status && q.status !== 'pending') return;
  const ref = event.data.ref;
  try {
    const payload = cleanPayload(q);
    const col = db.collection('homes').doc(event.params.homeCode).collection('fcmTokens');
    const snap = (!q.to || q.to === 'all')
      ? await col.get()
      : await col.where('userId', '==', String(q.to)).get();
    const r = await sendToTokens(snap.docs, payload, 'queue');
    await ref.set({ status: 'sent', ...r, processedAt: Date.now() }, { merge: true });
    logger.info('queue sent', { qid: event.params.qid, ...r });
  } catch (e) {
    logger.error('queue send error', { msg: (e && e.message) || 'unknown' });
    try { await ref.set({ status: 'error', processedAt: Date.now() }, { merge: true }); } catch {}
  }
});

/* Auto fan-out: new items in homes/{code}.notifs -> FCM to other members' devices. */
exports.homeNotifsFanout = onDocumentWritten('homes/{homeCode}', async (event) => {
  if (!event.data || !event.data.after || !event.data.after.exists) return;
  const before = (event.data.before.data() || {}).notifs || [];
  const after = (event.data.after.data() || {}).notifs || [];
  const known = new Set(before.map((n) => n && n.id).filter(Boolean));
  const fresh = after.filter((n) => n && n.id && !known.has(n.id)).slice(-5);
  if (!fresh.length) return;
  const subs = await db.collection('homes').doc(event.params.homeCode).collection('fcmTokens').get();
  for (const n of fresh) {
    const payload = cleanPayload({ title: n.title, body: n.body, tab: n.actionTab, nid: n.id, urgent: n.type === 'urgent' });
    const targets = subs.docs.filter((d) => (d.data() || {}).userId !== n.senderId);
    const r = await sendToTokens(targets, payload, 'fanout');
    logger.info('fanout', { nid: n.id, ...r });
  }
});
