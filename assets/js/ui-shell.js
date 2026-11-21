// ============================================================================
// KRONOS LEDGER — assets/js/ui-shell.js
// Shared Navigation Shell, Org/Mode Switcher, Safe Fallback & UI Utilities
// ============================================================================

import {
  resolveConnectionContext,
  setAppMode,
  fetchUserOrganizations,
  fetchOrganizationSnapshot
} from './supabase-client.js';

import {
  getDemoOrganizations,
  getDemoSnapshot,
  resetDemoState
} from './demo-data.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + Number(days || 0));
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateId(isoDate) {
  if (!isoDate) return '-';
  const parts = String(isoDate).slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
  ];
  const mIdx = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${months[mIdx] || parts[1]} ${parts[0]}`;
}

export function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const el = document.createElement('div');
  const colors =
    type === 'error'
      ? 'bg-red-600 text-white'
      : type === 'warning'
        ? 'bg-amber-600 text-white'
        : 'bg-[#14281D] text-white border border-[#9FE870]/40';

  el.className = `pointer-events-auto rounded-2xl px-4 py-3 text-xs sm:text-sm font-medium shadow-lg flex items-center gap-2.5 transition-all duration-300 ${colors}`;
  el.innerHTML = `
    <span class="w-2 h-2 rounded-full shrink-0 ${type === 'error' ? 'bg-red-200' : 'bg-[#9FE870]'}"></span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(el);
  window.setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    window.setTimeout(() => el.remove(), 250);
  }, 3600);
}

export function updateNavLinksMode(mode) {
  const modeQuery = mode === 'live' ? '?mode=live' : '?mode=demo';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const rawHref = link.getAttribute('href') || '';
    const [baseHref, existingQuery] = rawHref.split('?');
    if (!baseHref) return;
    if (existingQuery && existingQuery.includes('id=')) {
      const params = new URLSearchParams(existingQuery);
      params.set('mode', mode === 'live' ? 'live' : 'demo');
      link.setAttribute('href', `${baseHref}?${params.toString()}`);
    } else {
      link.setAttribute('href', `${baseHref}${modeQuery}`);
    }
  });
}

const ACTIVE_ORG_STORAGE_KEY = 'kronos_active_org_id';

function readStoredOrgId() {
  try {
    return window.sessionStorage?.getItem(ACTIVE_ORG_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function saveStoredOrgId(orgId) {
  try {
    if (orgId) window.sessionStorage?.setItem(ACTIVE_ORG_STORAGE_KEY, orgId);
    else window.sessionStorage?.removeItem(ACTIVE_ORG_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Shared workspace controller for subpages (ledger, invoices, inventory, reports, settings, audit-logs).
 */
export function createWorkspaceShell({ onRender }) {
  const state = {
    mode: 'demo',
    reason: 'explicit-demo',
    notice: null,
    user: null,
    organizations: [],
    activeOrgId: readStoredOrgId(),
    activeOrg: null,
    accounts: [],
    transactions: [],
    invoices: [],
    products: [],
    members: [],
    auditLogs: []
  };

  const els = {
    connDot: document.getElementById('connection-dot'),
    connLabel: document.getElementById('connection-label'),
    orgSwitcher: document.getElementById('org-switcher'),
    modeDemoBtn: document.getElementById('mode-demo-btn'),
    modeLiveBtn: document.getElementById('mode-live-btn'),
    resetDemoBtn: document.getElementById('btn-reset-demo'),
    rolePill: document.getElementById('active-role-pill'),
    orgHeading: document.getElementById('active-org-heading'),
    banner: document.getElementById('status-banner'),
    bannerText: document.getElementById('status-banner-text'),
    bannerDismiss: document.getElementById('banner-dismiss-btn')
  };

  function renderHeader() {
    const isDemo = state.mode === 'demo';
    const isFallback =
      isDemo &&
      ['sdk-error-fallback', 'auth-error-fallback', 'unauthenticated-live'].includes(
        state.reason
      );

    els.modeDemoBtn?.classList.toggle('is-selected', isDemo);
    els.modeLiveBtn?.classList.toggle('is-selected', !isDemo);
    els.resetDemoBtn?.classList.toggle('hidden', !isDemo);

    if (els.connDot && els.connLabel) {
      if (!isDemo) {
        els.connDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
        els.connLabel.textContent = 'Live Supabase';
      } else if (isFallback) {
        els.connDot.className = 'w-2 h-2 rounded-full bg-amber-500';
        els.connLabel.textContent = 'Fallback Demo';
      } else {
        els.connDot.className = 'w-2 h-2 rounded-full bg-[#14281D]';
        els.connLabel.textContent = 'Demo Preview';
      }
    }

    if (els.banner && els.bannerText) {
      if (state.notice) {
        els.banner.className =
          'rounded-2xl border border-amber-200 bg-amber-50/90 text-amber-900 px-4 py-3 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3';
        els.bannerText.textContent = state.notice;
      } else {
        els.banner.classList.add('hidden');
      }
    }

    updateNavLinksMode(state.mode);
  }

  function renderOrgSelector() {
    if (!els.orgSwitcher) return;
    els.orgSwitcher.innerHTML = '';

    if (state.organizations.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Belum ada organisasi';
      els.orgSwitcher.appendChild(opt);
      return;
    }

    for (const org of state.organizations) {
      const opt = document.createElement('option');
      opt.value = org.id;
      opt.textContent = `${org.name} (${org.role || 'member'})`;
      if (org.id === state.activeOrgId) opt.selected = true;
      els.orgSwitcher.appendChild(opt);
    }

    if (state.activeOrg) {
      if (els.orgHeading) els.orgHeading.textContent = state.activeOrg.name;
      if (els.rolePill) {
        els.rolePill.innerHTML = `Peran: <strong class="text-[#14281D] capitalize">${escapeHtml(state.activeOrg.role || 'owner')}</strong>`;
      }
    }
  }

  async function refresh() {
    if (state.mode === 'demo') {
      state.organizations = getDemoOrganizations();
      if (
        !state.activeOrgId ||
        !state.organizations.some((o) => o.id === state.activeOrgId)
      ) {
        state.activeOrgId = state.organizations[0]?.id || null;
      }
      const snap = getDemoSnapshot(state.activeOrgId);
      state.activeOrg = snap.organization;
      state.activeOrgId = snap.organization.id;
      saveStoredOrgId(state.activeOrgId);
      state.accounts = snap.accounts;
      state.transactions = snap.transactions;
      state.invoices = snap.invoices;
      state.products = snap.products || [];
      state.members = snap.members || [];
      state.auditLogs = snap.auditLogs || [];
    } else {
      const activeOrg =
        state.organizations.find((o) => o.id === state.activeOrgId) ||
        state.organizations[0];
      if (!activeOrg) return;

      state.activeOrg = activeOrg;
      state.activeOrgId = activeOrg.id;
      saveStoredOrgId(state.activeOrgId);
      const snap = await fetchOrganizationSnapshot(activeOrg.id);
      state.accounts = snap.accounts;
      state.transactions = snap.transactions;
      state.invoices = snap.invoices;
      state.products = snap.products || [];
      state.members = [];
      state.auditLogs = [];
    }

    renderOrgSelector();
    onRender(state);
  }

  async function reloadOrganizations(selectOrgId = null) {
    if (state.mode === 'live') {
      state.organizations = await fetchUserOrganizations();
    } else {
      state.organizations = getDemoOrganizations();
    }
    if (selectOrgId && state.organizations.some((o) => o.id === selectOrgId)) {
      state.activeOrgId = selectOrgId;
      saveStoredOrgId(selectOrgId);
    }
    await refresh();
  }

  async function bootstrap() {
    const ctx = await resolveConnectionContext();
    state.mode = ctx.mode;
    state.reason = ctx.reason;
    state.notice = ctx.notice;
    state.user = ctx.user;

    if (state.mode === 'live') {
      try {
        const orgs = await fetchUserOrganizations();
        if (orgs.length === 0) {
          state.mode = 'demo';
          state.reason = 'unauthenticated-live';
          state.notice =
            'Belum ada organisasi di akun Supabase Anda. Menampilkan Mode Demo agar halaman tetap dapat digunakan.';
        } else {
          state.organizations = orgs;
          const stored = readStoredOrgId();
          state.activeOrgId = orgs.some((o) => o.id === stored) ? stored : orgs[0].id;
        }
      } catch (err) {
        state.mode = 'demo';
        state.reason = 'sdk-error-fallback';
        state.notice = `Gagal memuat data Live Supabase (${err?.message || 'Error jaringan'}). Beralih otomatis ke Mode Demo.`;
      }
    }

    if (state.mode === 'demo') {
      state.organizations = getDemoOrganizations();
      const stored = readStoredOrgId();
      if (stored && state.organizations.some((o) => o.id === stored)) {
        state.activeOrgId = stored;
      } else if (
        !state.activeOrgId ||
        !state.organizations.some((o) => o.id === state.activeOrgId)
      ) {
        state.activeOrgId = state.organizations[0]?.id || null;
      }
    }

    renderHeader();
    await refresh();
  }

  function bindShellEvents() {
    els.orgSwitcher?.addEventListener('change', async (e) => {
      state.activeOrgId = e.target.value;
      saveStoredOrgId(state.activeOrgId);
      try {
        await refresh();
      } catch (err) {
        showToast(err.message || 'Gagal mengganti organisasi.', 'error');
      }
    });

    els.modeDemoBtn?.addEventListener('click', async () => {
      setAppMode('demo');
      await bootstrap();
      showToast('Beralih ke Mode Demo.');
    });

    els.modeLiveBtn?.addEventListener('click', async () => {
      setAppMode('live');
      await bootstrap();
      if (state.mode === 'live') {
        showToast('Terhubung ke Live Supabase.');
      } else {
        showToast('Belum ada sesi Live. Masuk via Overview untuk mode Live.', 'warning');
      }
    });

    els.resetDemoBtn?.addEventListener('click', async () => {
      resetDemoState();
      saveStoredOrgId(null);
      state.activeOrgId = null;
      await refresh();
      showToast('Data simulasi demo berhasil di-reset.');
    });

    els.bannerDismiss?.addEventListener('click', () => {
      state.notice = null;
      els.banner?.classList.add('hidden');
    });
  }

  bindShellEvents();

  return {
    state,
    bootstrap,
    refresh,
    reloadOrganizations
  };
}

