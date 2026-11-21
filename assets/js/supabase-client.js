// ============================================================================
// KRONOS LEDGER — assets/js/supabase-client.js
// Supabase Client Initialization, Mode Resolver & Safe Database/RPC Helpers
// ============================================================================

const RUNTIME_CONFIG_STORAGE_KEY = 'kronos_supabase_runtime_config';

const SDK_CDNS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm',
  'https://esm.sh/@supabase/supabase-js@2'
];

let cachedClient = null;
let initPromise = null;
let resolvedConfigCache = null;
let sdkStatus = {
  loaded: false,
  ready: false,
  configured: false,
  error: null,
  usedRestFallback: false
};
let activeModeOverride = null;

function isValidConfiguredPair(url, anonKey) {
  const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
  const cleanKey = String(anonKey || '').trim();
  if (!cleanUrl || !cleanKey) return false;
  if (
    cleanUrl.includes('YOUR_PROJECT_REF') ||
    cleanKey.includes('YOUR_SUPABASE_')
  ) {
    return false;
  }
  try {
    const parsed = new URL(cleanUrl);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function readWindowOrStorageConfig() {
  try {
    if (typeof window !== 'undefined' && window.__KRONOS_CONFIG__) {
      const { SUPABASE_URL, SUPABASE_ANON_KEY, url, anonKey } =
        window.__KRONOS_CONFIG__;
      const u = SUPABASE_URL || url;
      const k = SUPABASE_ANON_KEY || anonKey;
      if (isValidConfiguredPair(u, k)) {
        return {
          url: String(u).trim().replace(/\/+$/, ''),
          anonKey: String(k).trim(),
          source: 'window'
        };
      }
    }
  } catch {
    // Ignore global config read errors
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(RUNTIME_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidConfiguredPair(parsed?.url, parsed?.anonKey)) {
          return {
            url: String(parsed.url).trim().replace(/\/+$/, ''),
            anonKey: String(parsed.anonKey).trim(),
            source: 'localStorage'
          };
        }
      }
    }
  } catch {
    // Ignore storage read errors
  }

  return null;
}

export async function loadSupabaseConfig({ forceReload = false } = {}) {
  if (resolvedConfigCache && !forceReload) {
    return resolvedConfigCache;
  }

  const immediate = readWindowOrStorageConfig();
  if (immediate) {
    resolvedConfigCache = {
      ...immediate,
      restUrl: `${immediate.url}/rest/v1/`,
      configured: true
    };
    sdkStatus.configured = true;
    return resolvedConfigCache;
  }

  try {
    const mod = await import('./config.js');
    if (isValidConfiguredPair(mod?.SUPABASE_URL, mod?.SUPABASE_ANON_KEY)) {
      const cleanUrl = String(mod.SUPABASE_URL).trim().replace(/\/+$/, '');
      resolvedConfigCache = {
        url: cleanUrl,
        restUrl: `${cleanUrl}/rest/v1/`,
        anonKey: String(mod.SUPABASE_ANON_KEY).trim(),
        source: 'config.js',
        configured: true
      };
      sdkStatus.configured = true;
      return resolvedConfigCache;
    }
  } catch {
    // Optional local assets/js/config.js may not exist in fresh open-source clones
  }

  resolvedConfigCache = {
    url: '',
    restUrl: '',
    anonKey: '',
    source: 'none',
    configured: false
  };
  sdkStatus.configured = false;
  return resolvedConfigCache;
}

export function getActiveSupabaseConfigSync() {
  if (resolvedConfigCache) return resolvedConfigCache;
  const immediate = readWindowOrStorageConfig();
  if (immediate) {
    return {
      ...immediate,
      restUrl: `${immediate.url}/rest/v1/`,
      configured: true
    };
  }
  return { url: '', restUrl: '', anonKey: '', source: 'none', configured: false };
}

export function saveRuntimeSupabaseConfig(url, anonKey) {
  const cleanUrl = String(url || '').trim().replace(/\/+$/, '');
  const cleanKey = String(anonKey || '').trim();
  if (!isValidConfiguredPair(cleanUrl, cleanKey)) {
    throw new Error(
      'URL Supabase harus diawali https:// dan Publishable/Anon Key tidak boleh kosong.'
    );
  }
  try {
    window.localStorage.setItem(
      RUNTIME_CONFIG_STORAGE_KEY,
      JSON.stringify({ url: cleanUrl, anonKey: cleanKey })
    );
  } catch {
    throw new Error('Tidak dapat menyimpan konfigurasi ke localStorage browser.');
  }
  cachedClient = null;
  initPromise = null;
  resolvedConfigCache = {
    url: cleanUrl,
    restUrl: `${cleanUrl}/rest/v1/`,
    anonKey: cleanKey,
    source: 'localStorage',
    configured: true
  };
  sdkStatus.configured = true;
  sdkStatus.error = null;
  return resolvedConfigCache;
}

export function clearRuntimeSupabaseConfig() {
  try {
    window.localStorage?.removeItem(RUNTIME_CONFIG_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors
  }
  cachedClient = null;
  initPromise = null;
  resolvedConfigCache = null;
  sdkStatus.configured = false;
  sdkStatus.ready = false;
}

function getSearchParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

export function isExplicitDemoMode() {
  const modeParam = getSearchParams().get('mode');
  if (activeModeOverride === 'demo') return true;
  if (activeModeOverride === 'live') return false;
  return modeParam === 'demo';
}

export function isExplicitLiveMode() {
  if (activeModeOverride === 'live') return true;
  if (activeModeOverride === 'demo') return false;
  return getSearchParams().get('mode') === 'live';
}

/**
 * Checks whether the app should run in Demo Mode.
 * Returns true if ?mode=demo is active or if no live session has been established.
 */
export function isDemoMode() {
  if (isExplicitDemoMode()) return true;
  if (activeModeOverride === 'live') return false;
  if (!isExplicitLiveMode()) {
    return !hasStoredSupabaseSession();
  }
  return false;
}

function hasStoredSupabaseSession() {
  try {
    const activeCfg = getActiveSupabaseConfigSync();
    let expectedPrefix = null;
    if (activeCfg.configured && activeCfg.url) {
      const host = new URL(activeCfg.url).hostname;
      const ref = host.split('.')[0];
      if (ref) expectedPrefix = `sb-${ref}-auth-token`;
    }

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const matchesKey = expectedPrefix
        ? key.startsWith(expectedPrefix)
        : /^sb-[a-z0-9-]+-auth-token/i.test(key);
      if (matchesKey) {
        const raw = window.localStorage.getItem(key);
        if (raw && raw.includes('access_token')) return true;
      }
    }
  } catch {
    // Ignore storage access restrictions
  }
  return false;
}

export function setAppMode(mode) {
  activeModeOverride = mode === 'live' ? 'live' : 'demo';
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', activeModeOverride);
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Ignore history API issues on file:// URLs
  }
}

export function getSdkStatus() {
  return { ...sdkStatus };
}

async function importSupabaseCreateClient() {
  if (window.supabase && typeof window.supabase.createClient === 'function') {
    return window.supabase.createClient;
  }

  let lastError = null;
  for (const cdnUrl of SDK_CDNS) {
    try {
      const mod = await import(cdnUrl);
      if (mod && typeof mod.createClient === 'function') {
        return mod.createClient;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Gagal memuat @supabase/supabase-js dari CDN.');
}

export async function initSupabase() {
  if (cachedClient) return cachedClient;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const cfg = await loadSupabaseConfig();
      if (!cfg.configured) {
        sdkStatus.loaded = false;
        sdkStatus.ready = false;
        sdkStatus.configured = false;
        sdkStatus.error =
          'Konfigurasi Supabase belum diisi. Salin assets/js/config.example.js ke assets/js/config.js atau atur lewat panel Koneksi Live.';
        return null;
      }

      const createClient = await importSupabaseCreateClient();
      sdkStatus.loaded = true;
      sdkStatus.configured = true;

      const client = createClient(cfg.url, cfg.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        },
        global: {
          headers: {
            apikey: cfg.anonKey
          }
        }
      });

      cachedClient = client;
      sdkStatus.ready = true;
      sdkStatus.error = null;
      return cachedClient;
    } catch (err) {
      sdkStatus.loaded = false;
      sdkStatus.ready = false;
      sdkStatus.error =
        err?.message ||
        'Inisialisasi Supabase SDK gagal (kemungkinan offline atau format publishable key ditolak SDK).';
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

export async function getSupabaseClient() {
  return initSupabase();
}

export async function getSession() {
  const client = await getSupabaseClient();
  if (!client) {
    return { session: null, error: new Error(sdkStatus.error || 'Supabase client tidak tersedia.') };
  }

  try {
    const { data, error } = await client.auth.getSession();
    if (error) return { session: null, error };
    return { session: data?.session || null, error: null };
  } catch (err) {
    return { session: null, error: err };
  }
}

export async function getCurrentUser() {
  const { session, error } = await getSession();
  if (error || !session) return { user: null, error };
  return { user: session.user || null, error: null };
}

export async function signInWithPassword(email, password) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error(
      sdkStatus.error || 'Supabase SDK tidak dapat terhubung saat ini.'
    );
  }
  const { data, error } = await client.auth.signInWithPassword({
    email: String(email || '').trim(),
    password: String(password || '')
  });
  if (error) throw error;
  setAppMode('live');
  return data;
}

export async function signUp(email, password) {
  const client = await getSupabaseClient();
  if (!client) {
    throw new Error(
      sdkStatus.error || 'Supabase SDK tidak dapat terhubung saat ini.'
    );
  }
  const { data, error } = await client.auth.signUp({
    email: String(email || '').trim(),
    password: String(password || '')
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = await getSupabaseClient();
  if (client) {
    try {
      await client.auth.signOut();
    } catch {
      // Ignore network error during sign out
    }
  }
  setAppMode('demo');
}

/**
 * Resolves the safe operational mode for the dashboard without ever blocking render.
 */
export async function resolveConnectionContext() {
  const hasAuthHash =
    typeof window !== 'undefined' &&
    String(window.location?.hash || '').includes('access_token');

  if (
    isExplicitDemoMode() ||
    (!isExplicitLiveMode() && !hasStoredSupabaseSession() && !hasAuthHash)
  ) {
    return {
      mode: 'demo',
      reason: isExplicitDemoMode() ? 'explicit-demo' : 'preview-no-session',
      notice: null,
      session: null,
      user: null,
      sdkReady: true
    };
  }

  const client = await getSupabaseClient();
  if (!client) {
    return {
      mode: 'demo',
      reason: 'sdk-error-fallback',
      notice:
        sdkStatus.error ||
        'Koneksi Supabase belum dikonfigurasi; menampilkan Mode Demo.',
      session: null,
      user: null,
      sdkReady: false
    };
  }

  const { session, error } = await getSession();
  if (error) {
    return {
      mode: 'demo',
      reason: 'auth-error-fallback',
      notice: `Sesi Supabase tidak dapat dimuat (${error.message}). Menampilkan data Demo.`,
      session: null,
      user: null,
      sdkReady: sdkStatus.ready
    };
  }

  if (!session || !session.user) {
    return {
      mode: 'demo',
      reason: isExplicitLiveMode() ? 'unauthenticated-live' : 'preview-no-session',
      notice: isExplicitLiveMode()
        ? 'Belum ada sesi login aktif di Supabase. Menampilkan Mode Demo agar dashboard tetap dapat ditinjau.'
        : null,
      session: null,
      user: null,
      sdkReady: sdkStatus.ready
    };
  }

  activeModeOverride = 'live';
  return {
    mode: 'live',
    reason: 'authenticated-live',
    notice: null,
    session,
    user: session.user,
    sdkReady: sdkStatus.ready
  };
}

/**
 * Direct REST v1 fallback helper using configured REST URL and apikey header
 * in case an older SDK rejects the sb_publishable_* key format.
 */
export async function restRequest(path, options = {}) {
  const cfg = await loadSupabaseConfig();
  if (!cfg.configured) {
    throw new Error('Konfigurasi Supabase belum diisi.');
  }

  const { method = 'GET', body = null, headers = {}, accessToken = null } = options;
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const url = `${cfg.restUrl}${cleanPath}`;

  const reqHeaders = {
    apikey: cfg.anonKey,
    'Content-Type': 'application/json',
    ...headers
  };

  if (accessToken) {
    reqHeaders.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, {
    method,
    headers: reqHeaders,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (!response.ok) {
    const errMsg =
      json?.message || json?.error_description || json?.hint || `HTTP ${response.status}`;
    throw new Error(errMsg);
  }

  return json;
}

export async function fetchUserOrganizations() {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('organization_members')
    .select(
      'role, organization:organizations(id, name, currency, tax_rate, created_at)'
    )
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || [])
    .filter((row) => row.organization)
    .map((row) => ({
      ...row.organization,
      role: row.role,
      monthly_revenue_target: 130000000
    }));
}

export async function createOrganization({ name, currency = 'IDR', tax_rate = 0.5 }) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('organizations')
    .insert({
      name: String(name || '').trim(),
      currency,
      tax_rate: Number(tax_rate)
    })
    .select('id, name, currency, tax_rate, created_at')
    .single();

  if (error) throw error;
  return { ...data, role: 'owner', monthly_revenue_target: 130000000 };
}

export async function fetchOrganizationSnapshot(orgId) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const [accRes, txRes, invRes, prodRes] = await Promise.all([
    client
      .from('accounts')
      .select('id, org_id, code, name, category, normal_balance, balance, is_system')
      .eq('org_id', orgId)
      .order('code', { ascending: true }),
    client
      .from('transactions')
      .select(
        `
        id, org_id, tx_date, reference_no, description, status, created_at,
        journal_lines (
          id, transaction_id, account_id, debit, credit,
          account:accounts ( id, code, name, category )
        )
      `
      )
      .eq('org_id', orgId)
      .order('tx_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('invoices')
      .select(
        `
        id, org_id, invoice_number, client_name, client_contact, issue_date, due_date, total_amount, status, created_at,
        invoice_items ( id, invoice_id, product_id, description, qty, unit_price, subtotal )
      `
      )
      .eq('org_id', orgId)
      .order('issue_date', { ascending: false })
      .limit(50),
    client
      .from('products')
      .select('id, org_id, sku, name, cost_price, sell_price, stock_qty, created_at')
      .eq('org_id', orgId)
      .order('sku', { ascending: true })
  ]);

  if (accRes.error) throw accRes.error;
  if (txRes.error) throw txRes.error;
  if (invRes.error) throw invRes.error;
  if (prodRes.error) throw prodRes.error;

  const accounts = (accRes.data || []).map((a) => ({
    ...a,
    balance: Number(a.balance || 0)
  }));

  const transactions = (txRes.data || []).map((tx) => ({
    ...tx,
    journal_lines: (tx.journal_lines || []).map((line) => ({
      id: line.id,
      transaction_id: line.transaction_id,
      account_id: line.account_id,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0),
      account_code: line.account?.code || '',
      account_name: line.account?.name || 'Akun',
      account_category: line.account?.category || 'EXPENSE'
    }))
  }));

  const invoices = (invRes.data || []).map((inv) => {
    const items = (inv.invoice_items || []).map((it) => ({
      ...it,
      qty: Number(it.qty || 1),
      unit_price: Number(it.unit_price || 0),
      subtotal: Number(it.subtotal || 0)
    }));
    const subtotal = items.reduce((s, it) => s + it.subtotal, 0) || Number(inv.total_amount || 0);
    return {
      ...inv,
      subtotal,
      total_amount: Number(inv.total_amount || 0),
      items
    };
  });

  const products = (prodRes.data || []).map((p) => ({
    ...p,
    cost_price: Number(p.cost_price || 0),
    sell_price: Number(p.sell_price || 0),
    stock_qty: Number(p.stock_qty || 0),
    min_stock: 5
  }));

  return { accounts, transactions, invoices, products };
}

export async function callRpc(fnName, params = {}) {
  const client = await getSupabaseClient();
  const { session } = await getSession();

  if (client) {
    try {
      const { data, error } = await client.rpc(fnName, params);
      if (!error) return data;

      // Retry via direct REST API only if the error looks like a key/client transport issue
      const msg = String(error.message || '').toLowerCase();
      if (!msg.includes('invalid api key') && !msg.includes('jwt')) {
        throw error;
      }
    } catch (sdkErr) {
      const msg = String(sdkErr?.message || '').toLowerCase();
      if (!msg.includes('invalid api key') && !msg.includes('jwt')) {
        throw sdkErr;
      }
      sdkStatus.usedRestFallback = true;
      return restRequest(`rpc/${fnName}`, {
        method: 'POST',
        body: params,
        accessToken: session?.access_token || null
      });
    }
  }

  sdkStatus.usedRestFallback = true;
  return restRequest(`rpc/${fnName}`, {
    method: 'POST',
    body: params,
    accessToken: session?.access_token || null
  });
}

export async function fetchPublicInvoice(invoiceId) {
  return callRpc('get_public_invoice', { p_invoice_id: invoiceId });
}

export async function createLiveInvoice({
  org_id,
  client_name,
  client_contact = '',
  issue_date,
  due_date,
  items = [],
  total_amount = 0,
  status = 'SENT'
}) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const invoiceNumber = await callRpc('generate_invoice_number', { p_org_id: org_id });

  // Insert as DRAFT first so invoice_items exist before trg_invoices_accounting fires
  const { data: inv, error: invErr } = await client
    .from('invoices')
    .insert({
      org_id,
      invoice_number: invoiceNumber,
      client_name: String(client_name || '').trim(),
      client_contact: String(client_contact || '').trim() || null,
      issue_date,
      due_date,
      total_amount: Number(total_amount || 0),
      status: 'DRAFT'
    })
    .select('id, invoice_number')
    .single();

  if (invErr) throw invErr;

  if (items.length > 0) {
    const rows = items.map((it) => ({
      invoice_id: inv.id,
      product_id: it.product_id || null,
      description: String(it.description || '').trim(),
      qty: Number(it.qty || 1),
      unit_price: Number(it.unit_price || 0),
      subtotal: Math.round(Number(it.qty || 1) * Number(it.unit_price || 0) * 100) / 100
    }));
    const { error: itemErr } = await client.from('invoice_items').insert(rows);
    if (itemErr) throw itemErr;
  }

  if (status === 'PAID') {
    await callRpc('mark_invoice_paid', { p_invoice_id: inv.id, p_payment_account_id: null });
  } else if (status !== 'DRAFT') {
    const { error: updErr } = await client
      .from('invoices')
      .update({ status })
      .eq('id', inv.id);
    if (updErr) throw updErr;
  }

  return inv;
}

export async function markLiveInvoicePaid(invoiceId, paymentAccountId = null) {
  return callRpc('mark_invoice_paid', {
    p_invoice_id: invoiceId,
    p_payment_account_id: paymentAccountId || null
  });
}

export async function createLiveProduct({
  org_id,
  sku,
  name,
  cost_price,
  sell_price,
  stock_qty = 0
}) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('products')
    .insert({
      org_id,
      sku: String(sku || '').trim().toUpperCase(),
      name: String(name || '').trim(),
      cost_price: Number(cost_price || 0),
      sell_price: Number(sell_price || 0),
      stock_qty: Number(stock_qty || 0)
    })
    .select('id, org_id, sku, name, cost_price, sell_price, stock_qty')
    .single();

  if (error) throw error;
  return data;
}

export async function updateLiveProductStock(productId, stockQty, costPrice) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const payload = { stock_qty: Number(stockQty) };
  if (costPrice !== undefined && costPrice !== null) {
    payload.cost_price = Number(costPrice);
  }

  const { data, error } = await client
    .from('products')
    .update(payload)
    .eq('id', productId)
    .select('id, stock_qty, cost_price')
    .single();

  if (error) throw error;
  return data;
}

export async function updateLiveOrganization(orgId, { name, currency, tax_rate }) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const payload = {};
  if (name !== undefined && String(name).trim()) payload.name = String(name).trim();
  if (currency) payload.currency = currency;
  if (tax_rate !== undefined && tax_rate !== '') payload.tax_rate = Number(tax_rate);

  const { data, error } = await client
    .from('organizations')
    .update(payload)
    .eq('id', orgId)
    .select('id, name, currency, tax_rate, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function createLiveAccount({
  org_id,
  code,
  name,
  category,
  normal_balance
}) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('accounts')
    .insert({
      org_id,
      code: String(code || '').trim().toUpperCase(),
      name: String(name || '').trim(),
      category,
      normal_balance
    })
    .select('id, org_id, code, name, category, normal_balance, balance, is_system')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchLiveOrgMembers(orgId) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('organization_members')
    .select('id, org_id, user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    name: `User ${String(row.user_id || '').slice(0, 8)}`,
    email: row.user_id
  }));
}

export async function updateLiveMemberRole(memberId, role) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('organization_members')
    .update({ role })
    .eq('id', memberId)
    .select('id, org_id, user_id, role, created_at')
    .single();

  if (error) throw error;
  return data;
}

export async function fetchLiveAuditLogs(orgId, limit = 100) {
  const client = await getSupabaseClient();
  if (!client) throw new Error('Supabase client belum siap.');

  const { data, error } = await client
    .from('audit_logs')
    .select('id, org_id, user_id, table_name, record_id, action, old_data, new_data, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}


