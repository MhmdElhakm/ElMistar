/**
 * ⚡ بيتنا / ناقصنا - Supabase Integration Client
 * Lightweight, robust Supabase integration module for Vanilla JS HTML5 PWA.
 */

window.NaqisnaSupabase = (function () {
  let client = null;
  let activeChannel = null;

  function getStoredConfig() {
    try {
      const url = localStorage.getItem('naqisna_sb_url') || window.SUPABASE_URL || '';
      const key = localStorage.getItem('naqisna_sb_key') || window.SUPABASE_ANON_KEY || '';
      return { url: url.trim(), key: key.trim() };
    } catch {
      return { url: '', key: '' };
    }
  }

  function setConfig(url, key) {
    try {
      if (url) localStorage.setItem('naqisna_sb_url', url.trim());
      else localStorage.removeItem('naqisna_sb_url');

      if (key) localStorage.setItem('naqisna_sb_key', key.trim());
      else localStorage.removeItem('naqisna_sb_key');

      initClient();
    } catch (e) {
      console.error('Failed to save Supabase config:', e);
    }
  }

  function initClient() {
    const { url, key } = getStoredConfig();
    if (url && key && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        client = window.supabase.createClient(url, key, {
          auth: { persistSession: true, autoRefreshToken: true },
          realtime: { params: { eventsPerSecond: 10 } }
        });
        console.log('✅ Supabase Client Initialized Successfully');
        return true;
      } catch (e) {
        console.warn('⚠️ Supabase client creation failed:', e);
        client = null;
        return false;
      }
    }
    client = null;
    return false;
  }

  function isConfigured() {
    if (!client) initClient();
    return !!client;
  }

  function getClient() {
    if (!client) initClient();
    return client;
  }

  // Single shared blob table (code PK, data jsonb). All home state lives
  // inside data so no FK / multi-table schema is required.
  const BLOB_TABLE = 'app_homes';

  function mergeMembers(remoteMembers, localMembers) {
    const map = new Map();
    (remoteMembers || []).forEach(m => { if (m && (m.id || m.whatsapp)) map.set(String(m.id || m.whatsapp), m); });
    (localMembers || []).forEach(m => { if (m && (m.id || m.whatsapp)) map.set(String(m.id || m.whatsapp), { ...(map.get(String(m.id || m.whatsapp)) || {}), ...m }); });
    return [...map.values()].slice(0, 10);
  }
  function blobSnapshot(homeCode, state, extra) {
    let members = Array.isArray(state.members) ? state.members.slice() : [];
    if (state.user && state.user.whatsapp) {
      const rec = { id: state.user.id, name: state.user.name, role: state.user.role, whatsapp: state.user.whatsapp };
      const i = members.findIndex(m => m && String(m.id) === String(rec.id));
      if (i >= 0) members[i] = { ...members[i], ...rec }; else members.push(rec);
    }
    const partner = state.partnerWhatsapp || (state.home && state.home.partnerWhatsapp) || '';
    const partnerName = state.partnerName || (state.home && state.home.partnerName) || '';
    if (partner && !members.some(m => m && m.whatsapp === partner)) {
      members.push({ id: 'partner_' + String(partner).slice(-4), name: partnerName || (state.user?.role === 'wife' ? 'الزوج 👨' : 'الزوجة 👩'), role: state.user?.role === 'wife' ? 'husband' : 'wife', whatsapp: partner });
    } else if (partner && partnerName) {
      const pi = members.findIndex(m => m && m.whatsapp === partner);
      if (pi >= 0 && !members[pi].name) members[pi].name = partnerName;
    }
    return {
      name: (state.home && state.home.name) || 'منزلنا السعيد',
      user: state.user ? { id: state.user.id, name: state.user.name, role: state.user.role, whatsapp: state.user.whatsapp } : null,
      partnerWhatsapp: partner || null,
      partnerName: partnerName || null,
      deliveryWhatsapp: state.deliveryWhatsapp || (state.home && state.home.deliveryWhatsapp) || null,
      deliveryName: state.deliveryName || (state.home && state.home.deliveryName) || null,
      members: members,
      orders: Array.isArray(state.orders) ? state.orders : [],
      expenses: Array.isArray(state.expenses) ? state.expenses : [],
      orderLists: Array.isArray(state.orderLists) ? state.orderLists : [],
      notifications: Array.isArray(state.notifications) ? state.notifications : [],
      updatedAt: new Date().toISOString(),
      updatedAtMs: Date.now(),
      ...(extra || {})
    };
  }

  async function readBlob(homeCode) {
    const sb = getClient();
    if (!sb || !homeCode) return null;
    try {
      const { data, error } = await sb.from(BLOB_TABLE).select('data').eq('code', homeCode).maybeSingle();
      if (error) { console.warn('Supabase blob read warning:', error); return null; }
      return (data && data.data) || null;
    } catch (e) {
      console.error('Supabase blob read failed:', e);
      return null;
    }
  }

  async function writeBlob(homeCode, snapshot) {
    const sb = getClient();
    if (!sb || !homeCode || !snapshot) return false;
    try {
      const { error } = await sb.from(BLOB_TABLE).upsert({
        code: homeCode,
        data: snapshot,
        updated_at: new Date().toISOString()
      }, { onConflict: 'code' });
      if (error) { console.error('Supabase blob write failed:', error); return false; }
      return true;
    } catch (e) {
      console.error('Supabase blob write error:', e);
      return false;
    }
  }

  // --- Home Management ---
  async function joinOrCreateHome(homeCode, homeName, userId, userName, gender) {
    const sb = getClient();
    if (!sb || !homeCode) return null;

    try {
      const existing = await readBlob(homeCode);
      if (!existing) {
        await writeBlob(homeCode, { name: homeName || 'منزلنا السعيد', orders: [], expenses: [], updatedAt: new Date().toISOString() });
        return { code: homeCode, name: homeName || 'منزلنا السعيد' };
      }
      return { code: homeCode, name: existing.name || homeName || 'منزلنا السعيد' };
    } catch (e) {
      console.error('Error in joinOrCreateHome:', e);
      return null;
    }
  }

  // --- Fetch Home Data ---
  async function fetchHomeData(homeCode) {
    const sb = getClient();
    if (!sb || !homeCode) return null;

    try {
      const blob = await readBlob(homeCode);
      if (!blob) return null;
      return {
        name: blob.name || null,
        partnerWhatsapp: blob.partnerWhatsapp || null,
        partnerName: blob.partnerName || null,
        deliveryWhatsapp: blob.deliveryWhatsapp || null,
        deliveryName: blob.deliveryName || null,
        members: Array.isArray(blob.members) ? blob.members : (blob.user ? [blob.user] : []),
        user: blob.user || null,
        orders: Array.isArray(blob.orders) ? blob.orders : [],
        expenses: Array.isArray(blob.expenses) ? blob.expenses : [],
        orderLists: Array.isArray(blob.orderLists) ? blob.orderLists : [],
        notifications: Array.isArray(blob.notifications) ? blob.notifications : [],
        updatedAt: blob.updatedAt || null,
        updatedAtMs: blob.updatedAtMs || 0
      };
    } catch (e) {
      console.error('Failed to fetch home data from Supabase:', e);
      return null;
    }
  }

  // --- Sync Single Items (read-modify-write on the blob) ---
  async function upsertOrder(homeCode, order) {
    if (!homeCode || !order || !order.id) return;
    try {
      const blob = (await readBlob(homeCode)) || { orders: [], expenses: [] };
      const arr = Array.isArray(blob.orders) ? blob.orders : [];
      const i = arr.findIndex(o => o && String(o.id) === String(order.id));
      if (i >= 0) arr[i] = order; else arr.push(order);
      blob.orders = arr;
      await writeBlob(homeCode, blob);
    } catch (e) {
      console.error('Failed to upsert order to Supabase:', e);
    }
  }

  async function deleteOrder(homeCode, orderId) {
    if (!homeCode || orderId === undefined || orderId === null) return;
    try {
      const blob = (await readBlob(homeCode)) || { orders: [], expenses: [] };
      blob.orders = (Array.isArray(blob.orders) ? blob.orders : []).filter(o => o && String(o.id) !== String(orderId));
      await writeBlob(homeCode, blob);
    } catch (e) {
      console.error('Failed to delete order from Supabase:', e);
    }
  }

  async function upsertExpense(homeCode, exp) {
    if (!homeCode || !exp || !exp.id) return;
    try {
      const blob = (await readBlob(homeCode)) || { orders: [], expenses: [] };
      const arr = Array.isArray(blob.expenses) ? blob.expenses : [];
      const i = arr.findIndex(x => x && String(x.id) === String(exp.id));
      if (i >= 0) arr[i] = exp; else arr.push(exp);
      blob.expenses = arr;
      await writeBlob(homeCode, blob);
    } catch (e) {
      console.error('Failed to upsert expense to Supabase:', e);
    }
  }

  async function deleteExpense(homeCode, expId) {
    if (!homeCode || expId === undefined || expId === null) return;
    try {
      const blob = (await readBlob(homeCode)) || { orders: [], expenses: [] };
      blob.expenses = (Array.isArray(blob.expenses) ? blob.expenses : []).filter(x => x && String(x.id) !== String(expId));
      await writeBlob(homeCode, blob);
    } catch (e) {
      console.error('Failed to delete expense from Supabase:', e);
    }
  }

  // --- Full State Sync Push (single blob row) ---
  async function pushFullState(homeCode, state) {
    const sb = getClient();
    if (!sb || !homeCode || !state) return;

    try {
      await writeBlob(homeCode, blobSnapshot(homeCode, state));
    } catch (e) {
      console.error('Push full state error:', e);
    }
  }

  // --- Offline-First expenses: push orders only, keep remote expenses untouched (privacy mode) ---
  async function pushOrdersOnly(homeCode, state) {
    if (!homeCode || !state) return;
    try {
      const remote = (await readBlob(homeCode)) || {};
      const snap = blobSnapshot(homeCode, state);
      snap.expenses = Array.isArray(remote.expenses) ? remote.expenses : [];
      snap.members = mergeMembers(remote.members || (remote.user ? [remote.user] : []), snap.members);
      if (!snap.partnerWhatsapp && remote.partnerWhatsapp) snap.partnerWhatsapp = remote.partnerWhatsapp;
      if (!snap.partnerName && remote.partnerName) snap.partnerName = remote.partnerName;
      if (!snap.deliveryWhatsapp && remote.deliveryWhatsapp) snap.deliveryWhatsapp = remote.deliveryWhatsapp;
      if (!snap.deliveryName && remote.deliveryName) snap.deliveryName = remote.deliveryName;
      await writeBlob(homeCode, snap);
    } catch (e) {
      console.error('Push orders-only error:', e);
    }
  }

  // --- Realtime Subscription ---
  function subscribeToHomeChanges(homeCode, onChangeCallback) {
    const sb = getClient();
    if (!sb || !homeCode) return null;

    if (activeChannel) {
      try { activeChannel.unsubscribe(); } catch {}
    }

    try {
      activeChannel = sb
        .channel(`naqisna-home-${homeCode}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: BLOB_TABLE, filter: `code=eq.${homeCode}` },
          payload => { if (typeof onChangeCallback === 'function') onChangeCallback('home', payload); }
        )
        .subscribe((status) => {
          console.log(`📡 Supabase Realtime channel status for ${homeCode}:`, status);
        });

      return activeChannel;
    } catch (e) {
      console.error('Realtime subscription failed:', e);
      return null;
    }
  }

  // --- Admin Helpers ---
  async function fetchAdminAds() {
    const sb = getClient();
    if (!sb) return null;
    try {
      const { data } = await sb.from('admin_ads').select('*').eq('is_active', true);
      return data;
    } catch { return null; }
  }

  // Auto initialize if config is present
  setTimeout(initClient, 100);

  return {
    getConfig: getStoredConfig,
    setConfig,
    isConfigured,
    getClient,
    joinOrCreateHome,
    fetchHomeData,
    upsertOrder,
    deleteOrder,
    upsertExpense,
    deleteExpense,
    pushFullState,
    pushOrdersOnly,
    subscribeToHomeChanges,
    fetchAdminAds
  };
})();
