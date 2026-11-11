/* NaqisnaSupabase — عميل المزامنة (جدول app_homes: code + data JSONB) */
(function () {
  var W = window, T = 'app_homes', sb = null;
  try {
    if (W.supabase && W.SUPABASE_URL && W.SUPABASE_ANON_KEY) {
      sb = W.supabase.createClient(W.SUPABASE_URL, W.SUPABASE_ANON_KEY, { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 5 } } });
    }
  } catch (e) { console.warn('supabase init failed', e); }

  var PASS = ['learnedMap', 'usageFreq', 'categoryColors', 'categoryNames', 'categoryIcons', 'productIcons', 'customCats', 'hiddenCats', 'catalogCustom'];

  function isConfigured() { return !!sb; }
  async function getRow(code) {
    var r = await sb.from(T).select('data,updated_at').eq('code', code).maybeSingle();
    if (r.error) throw r.error;
    return r.data || null;
  }
  async function writeRow(code, data) {
    var r = await sb.from(T).upsert({ code: code, data: data, updated_at: new Date().toISOString() }, { onConflict: 'code' });
    if (r.error) throw r.error;
    return true;
  }
  function baseData(st, ex) {
    st = st || {}; ex = ex || {};
    var d = Object.assign({}, ex);
    d.name = (st.home && st.home.name) || ex.name || 'بيتنا';
    d.orders = Array.isArray(st.orders) ? st.orders : (ex.orders || []);
    d.orderLists = Array.isArray(st.orderLists) ? st.orderLists : (ex.orderLists || []);
    if (st.user) d.user = { id: st.user.id, name: st.user.name, whatsapp: st.user.whatsapp };
    var dw = st.deliveryWhatsapp || (st.home && st.home.deliveryWhatsapp), dn = st.deliveryName || (st.home && st.home.deliveryName), pw = st.partnerWhatsapp || (st.home && st.home.partnerWhatsapp);
    if (dw) d.deliveryWhatsapp = dw; if (dn) d.deliveryName = dn; if (pw) d.partnerWhatsapp = pw;
    PASS.forEach(function (k) { if (st[k] !== undefined && st[k] !== null) d[k] = st[k]; });
    d.updatedAtMs = Number(st.updatedAt) || Date.now();
    return d;
  }
  function kindOf(e) { return (e && e.kind) || 'expense'; }

  async function fetchHomeData(code) {
    if (!sb) return null;
    var row = await getRow(code);
    if (!row) return null;
    var d = row.data || {};
    if (!d.updatedAtMs) d.updatedAtMs = Date.parse(row.updated_at) || 0;
    return d;
  }
  async function joinOrCreateHome(code, name) {
    if (!sb) return false;
    var row = await getRow(code);
    if (!row) { await writeRow(code, { name: name || 'بيتنا', orders: [], expenses: [], updatedAtMs: Date.now() }); return true; }
    var d = row.data || {};
    var empty = !(d.orders && d.orders.length) && !(d.expenses && d.expenses.length);
    if (empty && String(name || '').indexOf('LINK->') === 0 && d.name !== name) { d.name = name; await writeRow(code, d); }
    return true;
  }
  async function pushFullState(code, st) {
    if (!sb) return false;
    var ex = ((await getRow(code)) || {}).data || {};
    var d = baseData(st, ex);
    d.expenses = Array.isArray(st.expenses) ? st.expenses : (ex.expenses || []);
    return writeRow(code, d);
  }
  async function pushOrdersOnly(code, st) {
    if (!sb) return false;
    var ex = ((await getRow(code)) || {}).data || {};
    var d = baseData(st, ex);
    d.expenses = ex.expenses || [];
    return writeRow(code, d);
  }
  async function pushFinPartial(code, st, m) {
    if (!sb) return false;
    m = m || {};
    var ex = ((await getRow(code)) || {}).data || {};
    var d = baseData(st, ex);
    var keep = (ex.expenses || []).filter(function (e) { return !m[kindOf(e)]; });
    var mine = (st.expenses || []).filter(function (e) { return e && m[kindOf(e)]; });
    d.expenses = keep.concat(mine);
    return writeRow(code, d);
  }
  async function upsertExpense(code, e) {
    if (!sb || !e) return false;
    var ex = ((await getRow(code)) || {}).data || {};
    var list = (ex.expenses || []).slice();
    var i = list.findIndex(function (x) { return x && x.id === e.id; });
    if (i >= 0) list[i] = e; else list.push(e);
    ex.expenses = list; ex.updatedAtMs = Date.now();
    return writeRow(code, ex);
  }
  async function deleteHome(code) {
    if (!sb) return false;
    var r = await sb.from(T).delete().eq('code', code);
    return !r.error;
  }
  function subscribeToHomeChanges(code, cb) {
    if (!sb) return null;
    try {
      return sb.channel('home-' + code).on('postgres_changes', { event: '*', schema: 'public', table: T, filter: 'code=eq.' + code }, function () { try { cb(); } catch (e) {} }).subscribe();
    } catch (e) { return null; }
  }
  function joinPresence(user, cb) {
    if (!sb) return null;
    try {
      var key = String((user && (user.id || user.whatsapp)) || Math.random());
      var ch = sb.channel('naqisna-online', { config: { presence: { key: key } } });
      ch.on('presence', { event: 'sync' }, function () { try { cb(Object.keys(ch.presenceState()).length || 1); } catch (e) {} });
      ch.subscribe(function (s) { if (s === 'SUBSCRIBED') ch.track({ t: Date.now() }); });
      return ch;
    } catch (e) { return null; }
  }

  W.NaqisnaSupabase = { isConfigured: isConfigured, fetchHomeData: fetchHomeData, joinOrCreateHome: joinOrCreateHome, pushFullState: pushFullState, pushOrdersOnly: pushOrdersOnly, pushFinPartial: pushFinPartial, upsertExpense: upsertExpense, deleteHome: deleteHome, subscribeToHomeChanges: subscribeToHomeChanges, joinPresence: joinPresence };
})();
