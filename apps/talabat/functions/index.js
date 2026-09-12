/*
 * Naqisna Web Push backend (Firebase Cloud Functions, Node 20).
 * Chain: Firestore event -> here -> Web Push -> browser -> Service Worker -> Notification.
 * Works even when the app page is fully closed (OS/browser permitting).
 *
 * Required env (never in frontend):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:)
 * Deploy: firebase deploy --only functions
 */
const { onDocumentCreated, onDocumentWritten } = require('firebase-functions/v2/firestore');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const webpush = require('web-push');

admin.initializeApp();
const db = admin.firestore();

const TABS = ['home', 'orders', 'enc', 'notifs', 'expenses', 'reports', 'settings'];

function vapid() {
  const pub = process.env.VAPID_PUBLIC_KEY || '';
  const priv = process.env.VAPID_PRIVATE_KEY || '';
  const sub = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!pub || !priv) throw new Error('VAPID keys missing');
  return { pub, priv, sub };
}

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

function subKeys(s) {
  if (s.keys && s.keys.p256dh && s.keys.auth) return s.keys;
  if (s.p256dh && s.auth) return { p256dh: s.p256dh, auth: s.auth };
  return null;
}

async function sendToSubs(subDocs, payload, logTag) {
  const { pub, priv, sub } = vapid();
  let sent = 0, failed = 0, cleaned = 0;
  await Promise.all(subDocs.map(async (doc) => {
    const s = doc.data() || {};
    if (s.push === false) return;
    const keys = subKeys(s);
    if (!s.endpoint || !keys) return;
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys },
        JSON.stringify(payload),
        {
          vapidDetails: { subject: sub, publicKey: pub, privateKey: priv },
          TTL: 86400,
          urgency: payload.urgent ? 'high' : 'normal'
        }
      );
      sent++;
    } catch (e) {
      failed++;
      const code = e && e.statusCode;
      if (code === 404 || code === 410) {
        try { await doc.ref.delete(); cleaned++; } catch {}
      } else {
        logger.warn('push failed', { tag: logTag, status: code || 'network' });
      }
    }
  }));
  return { sent, failed, cleaned };
}

/* Admin/queue send: client writes homes/{code}/pushQueue/{id}
 * {to:'all'|<userId>, title, body, tab, nid, urgent?, status:'pending'} */
exports.pushQueueSend = onDocumentCreated('homes/{homeCode}/pushQueue/{qid}', async (event) => {
  const q = (event.data && event.data.data()) || {};
  if (q.status && q.status !== 'pending') return;
  const ref = event.data.ref;
  try {
    const payload = cleanPayload(q);
    const col = db.collection('homes').doc(event.params.homeCode).collection('pushSubs');
    const snap = (!q.to || q.to === 'all')
      ? await col.get()
      : await col.where('userId', '==', String(q.to)).get();
    const r = await sendToSubs(snap.docs, payload, 'queue');
    await ref.set({ status: 'sent', ...r, processedAt: Date.now() }, { merge: true });
    logger.info('queue sent', { qid: event.params.qid, ...r });
  } catch (e) {
    logger.error('queue send error', { msg: (e && e.message) || 'unknown' });
    try { await ref.set({ status: 'error', processedAt: Date.now() }, { merge: true }); } catch {}
  }
});

/* Auto fan-out: new items in homes/{code}.notifs -> push to other members' devices. */
exports.homeNotifsFanout = onDocumentWritten('homes/{homeCode}', async (event) => {
  if (!event.data || !event.data.after || !event.data.after.exists) return;
  const before = (event.data.before.data() || {}).notifs || [];
  const after = (event.data.after.data() || {}).notifs || [];
  const known = new Set(before.map((n) => n && n.id).filter(Boolean));
  const fresh = after.filter((n) => n && n.id && !known.has(n.id)).slice(-5);
  if (!fresh.length) return;
  const subs = await db.collection('homes').doc(event.params.homeCode).collection('pushSubs').get();
  for (const n of fresh) {
    const payload = cleanPayload({ title: n.title, body: n.body, tab: n.actionTab, nid: n.id, urgent: n.type === 'urgent' });
    const targets = subs.docs.filter((d) => (d.data() || {}).userId !== n.senderId);
    const r = await sendToSubs(targets, payload, 'fanout');
    logger.info('fanout', { nid: n.id, ...r });
  }
});
