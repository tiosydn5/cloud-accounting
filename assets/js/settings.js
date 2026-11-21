// ============================================================================
// KRONOS LEDGER — assets/js/settings.js
// Business Setup by Industry Preset, Chart of Accounts CRUD & RBAC Team Panel
// ============================================================================

import {
  createWorkspaceShell,
  escapeHtml,
  formatDateId,
  showToast
} from './ui-shell.js';
import {
  BUSINESS_PRESETS,
  addDemoMember,
  updateDemoMemberRole,
  removeDemoMember
} from './demo-data.js';
import {
  fetchLiveOrgMembers,
  updateLiveMemberRole
} from './supabase-client.js';
import {
  formatCurrency,
  createOrganizationWithPreset,
  updateOrganizationProfile,
  createCoaAccount,
  getNormalBalanceForCategory
} from './accounting.js';

let activeTab = 'PROFILE';
let coaCategoryFilter = 'ALL';
let coaSearchQuery = '';
let liveMembersCache = [];

const CATEGORY_LABELS = {
  ASSET: 'Aset',
  LIABILITY: 'Liabilitas',
  EQUITY: 'Ekuitas',
  REVENUE: 'Pendapatan',
  COGS: 'HPP',
  EXPENSE: 'Beban'
};

const shell = createWorkspaceShell({
  onRender: async (state) => {
    if (state.mode === 'live' && state.activeOrgId) {
      try {
        liveMembersCache = await fetchLiveOrgMembers(state.activeOrgId);
      } catch {
        liveMembersCache = [];
      }
    }
    renderProfile(state);
    renderOrgListCards(state);
    renderCoaTable(state);
    renderTeamTable(state);
    populateCounterAccountDropdown(state);
  }
});

function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.settings-tab-btn').forEach((btn) => {
    const isActive = btn.dataset.settingsTab === tab;
    btn.className = isActive
      ? 'settings-tab-btn rounded-full px-4 py-2 text-xs font-semibold bg-[#14281D] text-[#9FE870] transition'
      : 'settings-tab-btn rounded-full px-4 py-2 text-xs font-semibold bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition';
  });

  document.getElementById('panel-profile')?.classList.toggle('hidden', tab !== 'PROFILE');
  document.getElementById('panel-coa')?.classList.toggle('hidden', tab !== 'COA');
  document.getElementById('panel-team')?.classList.toggle('hidden', tab !== 'TEAM');
}

function renderProfile(state) {
  const org = state.activeOrg;
  if (!org) return;

  const preset = BUSINESS_PRESETS[org.business_type] || BUSINESS_PRESETS.retail;
  const badge = document.getElementById('profile-business-badge');
  if (badge) badge.textContent = org.sector || preset.label;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val ?? '';
  };

  setVal('prof-name', org.name || '');
  setVal('prof-type', org.business_type || 'retail');
  setVal('prof-currency', org.currency || 'IDR');
  setVal('prof-tax', org.tax_rate ?? 0.5);
  setVal('prof-target', org.monthly_revenue_target ?? 100000000);
  setVal('prof-email', org.email || '');
  setVal('prof-phone', org.phone || '');
  setVal('prof-address', org.address || '');
}

function renderOrgListCards(state) {
  const container = document.getElementById('org-list-cards');
  const countEl = document.getElementById('org-count-badge');
  if (!container) return;

  const orgs = state.organizations || [];
  if (countEl) countEl.textContent = `${orgs.length} Bisnis`;

  container.innerHTML = orgs
    .map((org) => {
      const isCurrent = org.id === state.activeOrgId;
      return `
        <div class="rounded-2xl border ${isCurrent ? 'border-[#14281D] bg-[#F3F4F1]/70' : 'border-gray-200 bg-white'} p-3.5 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-xs sm:text-sm font-bold text-[#14281D] truncate">${escapeHtml(org.name)}</p>
              ${isCurrent ? '<span class="status-badge badge-posted">Aktif</span>' : ''}
            </div>
            <p class="text-[11px] text-gray-500 mt-0.5 truncate">
              ${escapeHtml(org.sector || 'UMKM')} · ${escapeHtml(org.currency || 'IDR')} · Pajak ${escapeHtml(org.tax_rate ?? 0)}%
            </p>
          </div>
          ${
            isCurrent
              ? ''
              : `<button type="button" data-switch-org="${escapeHtml(org.id)}" class="shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-[#14281D] hover:bg-gray-50">Aktifkan</button>`
          }
        </div>
      `;
    })
    .join('');
}

function renderCoaTable(state) {
  const tbody = document.getElementById('coa-table-body');
  if (!tbody) return;

  const currency = state.activeOrg?.currency || 'IDR';
  const q = coaSearchQuery.trim().toLowerCase();

  const filtered = (state.accounts || []).filter((acc) => {
    if (coaCategoryFilter !== 'ALL' && acc.category !== coaCategoryFilter) return false;
    if (q) {
      const hay = `${acc.code} ${acc.name} ${acc.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-xs text-gray-500">
          Tidak ada akun CoA yang cocok dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((acc) => {
      const catLabel = CATEGORY_LABELS[acc.category] || acc.category;
      const badgeClass =
        acc.category === 'ASSET' || acc.category === 'REVENUE'
          ? 'badge-posted'
          : acc.category === 'LIABILITY' || acc.category === 'EXPENSE' || acc.category === 'COGS'
            ? 'badge-pending'
            : 'badge-draft';

      return `
        <tr>
          <td class="font-mono font-bold text-[#14281D] text-xs">${escapeHtml(acc.code)}</td>
          <td class="font-semibold text-xs sm:text-sm text-[#14281D]">${escapeHtml(acc.name)}</td>
          <td><span class="status-badge ${badgeClass}">${escapeHtml(catLabel)}</span></td>
          <td class="text-xs text-gray-600">${escapeHtml(acc.normal_balance)}</td>
          <td class="text-xs text-gray-500">${acc.is_system ? 'Sistem' : 'Kustom'}</td>
          <td class="text-right font-semibold tabular-nums text-xs sm:text-sm text-[#14281D]">
            ${escapeHtml(formatCurrency(acc.balance, currency))}
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderTeamTable(state) {
  const tbody = document.getElementById('team-table-body');
  const countEl = document.getElementById('member-count-badge');
  if (!tbody) return;

  const members = state.mode === 'live' ? liveMembersCache : state.members || [];
  if (countEl) countEl.textContent = `${members.length} Anggota`;

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-8 text-xs text-gray-500">
          Belum ada data anggota tim untuk organisasi ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members
    .map((m) => {
      return `
        <tr>
          <td>
            <p class="font-semibold text-xs sm:text-sm text-[#14281D]">${escapeHtml(m.name || 'Anggota')}</p>
            <p class="text-[11px] text-gray-500">${escapeHtml(m.email || m.user_id || '-')}</p>
          </td>
          <td>
            <select data-member-role="${escapeHtml(m.id)}" aria-label="Role ${escapeHtml(m.name)}" class="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-[#14281D]">
              <option value="owner" ${m.role === 'owner' ? 'selected' : ''}>Owner</option>
              <option value="accountant" ${m.role === 'accountant' ? 'selected' : ''}>Accountant</option>
              <option value="staff" ${m.role === 'staff' ? 'selected' : ''}>Staff</option>
            </select>
          </td>
          <td class="text-xs text-gray-500 tabular-nums">${escapeHtml(formatDateId(m.created_at))}</td>
          <td class="text-right">
            ${
              state.mode === 'demo'
                ? `<button type="button" data-remove-member="${escapeHtml(m.id)}" class="text-xs font-semibold text-red-600 hover:underline">Hapus</button>`
                : '<span class="text-[11px] text-gray-400">Live RLS</span>'
            }
          </td>
        </tr>
      `;
    })
    .join('');
}

function populateCounterAccountDropdown(state) {
  const sel = document.getElementById('coa-counter');
  if (!sel) return;
  const accounts = state.accounts || [];
  sel.innerHTML = accounts
    .map((a) => {
      const selected = a.code === '3101' ? 'selected' : '';
      return `<option value="${escapeHtml(a.id)}" ${selected}>${escapeHtml(a.code)} — ${escapeHtml(a.name)}</option>`;
    })
    .join('');
}

function renderPresetSelector(selectedKey = 'retail') {
  const grid = document.getElementById('preset-selector-grid');
  const hiddenInput = document.getElementById('new-org-type');
  const taxInput = document.getElementById('new-org-tax');
  const previewBox = document.getElementById('preset-preview-box');
  if (!grid || !hiddenInput) return;

  hiddenInput.value = selectedKey;
  const activePreset = BUSINESS_PRESETS[selectedKey] || BUSINESS_PRESETS.retail;
  if (taxInput) taxInput.value = activePreset.defaultTaxRate;

  grid.innerHTML = Object.values(BUSINESS_PRESETS)
    .map((p) => {
      const isSelected = p.key === selectedKey;
      return `
        <button type="button" data-select-preset="${escapeHtml(p.key)}" class="text-left rounded-2xl border p-3 transition ${
          isSelected
            ? 'border-[#14281D] bg-[#14281D] text-white'
            : 'border-gray-200 bg-white text-[#14281D] hover:border-gray-300'
        }">
          <p class="text-xs font-bold ${isSelected ? 'text-[#9FE870]' : 'text-[#14281D]'}">${escapeHtml(p.label)}</p>
          <p class="text-[11px] mt-0.5 ${isSelected ? 'text-gray-200' : 'text-gray-500'}">${escapeHtml(p.shortDesc)}</p>
        </button>
      `;
    })
    .join('');

  if (previewBox) {
    const coaNames = activePreset.extraAccounts.map((a) => `${a.code} ${a.name}`).join(', ');
    const prodNames = activePreset.starterProducts.map((p) => p.name).join(', ');
    previewBox.innerHTML = `
      <p class="font-bold text-[#14281D]">Preset Otomatis: ${escapeHtml(activePreset.label)}</p>
      <p class="text-gray-600"><strong class="text-[#14281D]">12 CoA Inti + Khusus:</strong> ${escapeHtml(coaNames)}</p>
      <p class="text-gray-600"><strong class="text-[#14281D]">Produk/Layanan Awal:</strong> ${escapeHtml(prodNames)}</p>
    `;
  }
}

function openNewOrgModal(presetKey = 'retail') {
  document.getElementById('new-org-error')?.classList.add('hidden');
  document.getElementById('new-org-form')?.reset();
  renderPresetSelector(presetKey);
  document.getElementById('new-org-modal')?.classList.remove('hidden');
}

function closeNewOrgModal() {
  document.getElementById('new-org-modal')?.classList.add('hidden');
}

function openCoaModal() {
  document.getElementById('coa-error')?.classList.add('hidden');
  document.getElementById('coa-form')?.reset();
  populateCounterAccountDropdown(shell.state);
  document.getElementById('coa-modal')?.classList.remove('hidden');
}

function closeCoaModal() {
  document.getElementById('coa-modal')?.classList.add('hidden');
}

function bindEvents() {
  // Section tabs
  document.querySelectorAll('.settings-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => setTab(btn.dataset.settingsTab));
  });

  // Quick preset buttons in dark card
  document.querySelectorAll('[data-quick-preset]').forEach((btn) => {
    btn.addEventListener('click', () => openNewOrgModal(btn.dataset.quickPreset));
  });

  // Switch org from card list
  document.getElementById('org-list-cards')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-switch-org]');
    if (!btn) return;
    await shell.reloadOrganizations(btn.dataset.switchOrg);
    showToast(`Beralih ke ${shell.state.activeOrg?.name || 'organisasi'}.`);
  });

  // Save profile form
  document.getElementById('org-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await updateOrganizationProfile(
        shell.state.activeOrgId,
        {
          name: document.getElementById('prof-name').value,
          business_type: document.getElementById('prof-type').value,
          currency: document.getElementById('prof-currency').value,
          tax_rate: document.getElementById('prof-tax').value,
          monthly_revenue_target: document.getElementById('prof-target').value,
          email: document.getElementById('prof-email').value,
          phone: document.getElementById('prof-phone').value,
          address: document.getElementById('prof-address').value
        },
        { mode: shell.state.mode }
      );
      await shell.reloadOrganizations(shell.state.activeOrgId);
      showToast('Profil organisasi berhasil disimpan.');
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan profil.', 'error');
    }
  });

  // New Org Modal triggers
  document.getElementById('btn-open-new-org-modal')?.addEventListener('click', () => openNewOrgModal('retail'));
  document.getElementById('close-new-org-modal')?.addEventListener('click', closeNewOrgModal);
  document.getElementById('cancel-new-org-modal')?.addEventListener('click', closeNewOrgModal);

  document.getElementById('preset-selector-grid')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-select-preset]');
    if (!btn) return;
    renderPresetSelector(btn.dataset.selectPreset);
  });

  document.getElementById('new-org-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('new-org-error');
    errEl?.classList.add('hidden');

    try {
      const created = await createOrganizationWithPreset(
        {
          name: document.getElementById('new-org-name').value,
          business_type: document.getElementById('new-org-type').value,
          currency: document.getElementById('new-org-currency').value,
          tax_rate: document.getElementById('new-org-tax').value,
          opening_capital: Number(document.getElementById('new-org-capital').value || 0),
          email: document.getElementById('new-org-email').value,
          phone: document.getElementById('new-org-phone').value,
          address: document.getElementById('new-org-address').value
        },
        { mode: shell.state.mode }
      );
      closeNewOrgModal();
      await shell.reloadOrganizations(created.id);
      showToast(`Bisnis "${created.name}" berhasil dibuat & diaktifkan.`);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Gagal membuat bisnis baru.';
        errEl.classList.remove('hidden');
      }
    }
  });

  // CoA Filters
  document.querySelectorAll('.coa-cat-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      coaCategoryFilter = btn.dataset.coaCat;
      document.querySelectorAll('.coa-cat-btn').forEach((b) => {
        const active = b.dataset.coaCat === coaCategoryFilter;
        b.className = active
          ? 'coa-cat-btn rounded-full px-3 py-1.5 text-xs font-semibold bg-[#14281D] text-[#9FE870]'
          : 'coa-cat-btn rounded-full px-3 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200';
      });
      renderCoaTable(shell.state);
    });
  });

  document.getElementById('coa-search')?.addEventListener('input', (e) => {
    coaSearchQuery = e.target.value || '';
    renderCoaTable(shell.state);
  });

  // CoA Modal triggers
  document.getElementById('btn-open-coa-modal')?.addEventListener('click', openCoaModal);
  document.getElementById('btn-open-coa-modal-2')?.addEventListener('click', openCoaModal);
  document.getElementById('close-coa-modal')?.addEventListener('click', closeCoaModal);
  document.getElementById('cancel-coa-modal')?.addEventListener('click', closeCoaModal);

  document.getElementById('coa-category')?.addEventListener('change', (e) => {
    const nb = getNormalBalanceForCategory(e.target.value);
    const hint = document.getElementById('coa-journal-hint');
    if (hint) {
      hint.textContent = `Saldo normal ${nb}. Jika saldo awal > 0, akun baru akan di-${nb} dan akun lawan di-${nb === 'DEBIT' ? 'CREDIT' : 'DEBIT'}.`;
    }
  });

  document.getElementById('coa-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('coa-error');
    errEl?.classList.add('hidden');

    try {
      const created = await createCoaAccount(
        {
          org_id: shell.state.activeOrgId,
          code: document.getElementById('coa-code').value,
          name: document.getElementById('coa-name').value,
          category: document.getElementById('coa-category').value,
          opening_balance: Number(document.getElementById('coa-opening').value || 0),
          counter_account_id: document.getElementById('coa-counter').value
        },
        { mode: shell.state.mode }
      );
      closeCoaModal();
      await shell.refresh();
      showToast(`Akun CoA ${created.code} — ${created.name} berhasil ditambahkan.`);
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Gagal menambah akun CoA.';
        errEl.classList.remove('hidden');
      }
    }
  });

  // Team RBAC Events
  document.getElementById('add-member-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (shell.state.mode === 'live') {
      showToast('Penambahan anggota di Mode Live memerlukan user_id terdaftar melalui Supabase Auth.', 'warning');
      return;
    }
    try {
      const mem = addDemoMember(shell.state.activeOrgId, {
        name: document.getElementById('mem-name').value,
        email: document.getElementById('mem-email').value,
        role: document.getElementById('mem-role').value
      });
      e.target.reset();
      await shell.refresh();
      showToast(`${mem.name} ditambahkan sebagai ${mem.role.toUpperCase()}.`);
    } catch (err) {
      showToast(err.message || 'Gagal menambah anggota.', 'error');
    }
  });

  document.getElementById('team-table-body')?.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-member-role]');
    if (!sel) return;
    try {
      if (shell.state.mode === 'live') {
        await updateLiveMemberRole(sel.dataset.memberRole, sel.value);
      } else {
        updateDemoMemberRole(shell.state.activeOrgId, sel.dataset.memberRole, sel.value);
      }
      await shell.refresh();
      showToast('Role anggota berhasil diperbarui.');
    } catch (err) {
      showToast(err.message || 'Gagal mengubah role anggota.', 'error');
      await shell.refresh();
    }
  });

  document.getElementById('team-table-body')?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-remove-member]');
    if (!btn) return;
    try {
      removeDemoMember(shell.state.activeOrgId, btn.dataset.removeMember);
      await shell.refresh();
      showToast('Anggota tim dihapus.');
    } catch (err) {
      showToast(err.message || 'Gagal menghapus anggota.', 'error');
    }
  });
}

bindEvents();
shell.bootstrap();
