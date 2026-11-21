// ============================================================================
// KRONOS LEDGER — assets/js/dashboard.js
// Bento Dashboard Controller, Chart.js Analytics & Double-Entry Modals
// ============================================================================

import {
  resolveConnectionContext,
  loadSupabaseConfig,
  saveRuntimeSupabaseConfig,
  clearRuntimeSupabaseConfig,
  setAppMode,
  signInWithPassword,
  signUp,
  signOut,
  fetchUserOrganizations,
  createOrganization,
  fetchOrganizationSnapshot
} from './supabase-client.js';

import {
  getDemoOrganizations,
  getDemoSnapshot,
  resetDemoState
} from './demo-data.js';

import {
  DEFAULT_USD_IDR_RATE,
  roundMoney,
  calculateTotals,
  validateJournalEntry,
  convertCurrency,
  formatCurrency,
  computeFinancialMetrics,
  submitTransaction,
  approvePendingTransaction
} from './accounting.js';

const appState = {
  mode: 'demo',
  reason: 'explicit-demo',
  notice: null,
  user: null,
  organizations: [],
  activeOrgId: null,
  activeOrg: null,
  accounts: [],
  transactions: [],
  invoices: [],
  displayCurrency: 'IDR',
  ledgerFilter: 'ALL',
  authTab: 'signin',
  journalLines: [],
  expenseChart: null
};

const dom = {};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function todayIso() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateId(isoDate) {
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

function showToast(message, type = 'success') {
  if (!dom.toastContainer) return;
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

  dom.toastContainer.appendChild(el);
  window.setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    window.setTimeout(() => el.remove(), 250);
  }, 3600);
}

function cacheDomElements() {
  const ids = [
    'connection-badge', 'connection-dot', 'connection-label',
    'org-switcher', 'mode-demo-btn', 'mode-live-btn',
    'auth-trigger-btn', 'auth-trigger-btn-mobile', 'btn-reset-demo',
    'active-org-heading', 'active-role-pill',
    'status-banner', 'status-banner-icon', 'status-banner-text',
    'banner-login-btn', 'banner-dismiss-btn',
    'currency-idr-btn', 'currency-usd-btn', 'fx-rate-note',
    'metric-liquidity', 'liquid-accounts-pills',
    'btn-open-journal', 'btn-open-transfer',
    'metric-margin-badge', 'metric-net-profit',
    'metric-revenue-mini', 'metric-expense-mini',
    'metric-receivables', 'receivables-sub', 'metric-payables', 'payables-sub',
    'metric-expenses-total', 'expense-donut-chart', 'expense-chart-center',
    'expense-chart-center-val', 'expense-chart-fallback', 'expense-legend-list',
    'metric-target-pct', 'metric-revenue-gross', 'metric-revenue-target',
    'revenue-progress-bar', 'revenue-sources-list', 'invoice-snapshot-list',
    'pending-count-badge', 'recent-ledger-feed',
    'tx-modal', 'tx-modal-title', 'tx-modal-close', 'tx-modal-error',
    'tab-journal', 'tab-transfer', 'panel-journal', 'panel-transfer',
    'jrn-date', 'jrn-ref', 'jrn-status', 'jrn-desc',
    'jrn-lines-container', 'btn-add-line', 'jrn-total-debit',
    'jrn-total-credit', 'jrn-balance-badge', 'btn-cancel-journal', 'btn-submit-journal',
    'trf-date', 'trf-amount', 'trf-from-account', 'trf-to-account',
    'trf-desc', 'trf-balance-badge', 'trf-preview-lines',
    'btn-cancel-transfer', 'btn-submit-transfer',
    'auth-modal', 'auth-modal-close', 'auth-modal-message',
    'auth-config-status-text', 'auth-toggle-config-btn', 'auth-supabase-config-form',
    'cfg-supabase-url', 'cfg-supabase-key', 'cfg-clear-btn',
    'auth-login-form', 'auth-tab-signin', 'auth-tab-signup',
    'auth-email', 'auth-password', 'auth-use-demo-btn', 'auth-submit-btn',
    'auth-create-org-form', 'new-org-name', 'new-org-currency', 'new-org-tax',
    'auth-signedin-panel', 'auth-user-email', 'auth-show-create-org-btn', 'auth-signout-btn',
    'toast-container'
  ];

  for (const id of ids) {
    dom[id] = document.getElementById(id);
  }
  dom.toastContainer = dom['toast-container'];
}

function updateNavLinksMode() {
  const modeQuery = appState.mode === 'live' ? '?mode=live' : '?mode=demo';
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    const rawHref = link.getAttribute('href') || '';
    const baseHref = rawHref.split('?')[0];
    if (baseHref) {
      link.setAttribute('href', `${baseHref}${modeQuery}`);
    }
  });
}

function formatDisplayMoney(amountInBase, options = {}) {
  const baseCurrency = appState.activeOrg?.currency || 'IDR';
  const converted = convertCurrency(
    amountInBase,
    appState.displayCurrency,
    baseCurrency,
    DEFAULT_USD_IDR_RATE
  );
  return formatCurrency(converted, appState.displayCurrency, options);
}

function renderConnectionHeader() {
  const isDemo = appState.mode === 'demo';
  const isFallback =
    isDemo &&
    (appState.reason === 'sdk-error-fallback' ||
      appState.reason === 'auth-error-fallback' ||
      appState.reason === 'unauthenticated-live');

  dom['mode-demo-btn'].classList.toggle('is-selected', isDemo);
  dom['mode-live-btn'].classList.toggle('is-selected', !isDemo);
  dom['btn-reset-demo'].classList.toggle('hidden', !isDemo);

  if (!isDemo) {
    dom['connection-dot'].className = 'w-2 h-2 rounded-full bg-emerald-500';
    dom['connection-label'].textContent = 'Live Supabase';
    dom['auth-trigger-btn'].textContent = 'Akun Live';
    dom['auth-trigger-btn-mobile'].textContent = 'Akun Live';
  } else if (isFallback) {
    dom['connection-dot'].className = 'w-2 h-2 rounded-full bg-amber-500';
    dom['connection-label'].textContent = 'Fallback Demo';
    dom['auth-trigger-btn'].textContent = 'Masuk Live';
    dom['auth-trigger-btn-mobile'].textContent = 'Masuk Live';
  } else {
    dom['connection-dot'].className = 'w-2 h-2 rounded-full bg-[#14281D]';
    dom['connection-label'].textContent = 'Demo Preview';
    dom['auth-trigger-btn'].textContent = 'Masuk Live';
    dom['auth-trigger-btn-mobile'].textContent = 'Masuk Live';
  }

  if (appState.notice) {
    dom['status-banner'].className =
      'rounded-2xl border border-amber-200 bg-amber-50/90 text-amber-900 px-4 py-3 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3';
    dom['status-banner-text'].textContent = appState.notice;
    dom['banner-login-btn'].classList.toggle(
      'hidden',
      appState.reason === 'sdk-error-fallback'
    );
  } else {
    dom['status-banner'].classList.add('hidden');
  }

  updateNavLinksMode();
}

function renderOrganizationSelector() {
  const select = dom['org-switcher'];
  select.innerHTML = '';

  if (appState.organizations.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'Belum ada organisasi';
    select.appendChild(opt);
    return;
  }

  for (const org of appState.organizations) {
    const opt = document.createElement('option');
    opt.value = org.id;
    opt.textContent = `${org.name} (${org.role || 'member'})`;
    if (org.id === appState.activeOrgId) opt.selected = true;
    select.appendChild(opt);
  }

  if (appState.activeOrg) {
    dom['active-org-heading'].textContent = appState.activeOrg.name;
    dom['active-role-pill'].innerHTML = `Peran: <strong class="text-[#14281D] capitalize">${escapeHtml(appState.activeOrg.role || 'owner')}</strong>`;
  }
}

function renderBentoDashboard() {
  const metrics = computeFinancialMetrics({
    organization: appState.activeOrg,
    accounts: appState.accounts,
    transactions: appState.transactions,
    invoices: appState.invoices
  });

  // Currency toggle state
  const isUsd = appState.displayCurrency === 'USD';
  dom['currency-idr-btn'].classList.toggle('is-selected', !isUsd);
  dom['currency-usd-btn'].classList.toggle('is-selected', isUsd);
  dom['fx-rate-note'].classList.toggle(
    'hidden',
    !(isUsd && (appState.activeOrg?.currency || 'IDR') === 'IDR')
  );

  // Row 1 Left: Liquidity & Cash/Bank Breakdown
  dom['metric-liquidity'].textContent = formatDisplayMoney(metrics.totalLiquidity);

  const pillsHtml = metrics.liquidAccounts
    .map(
      (acc) => `
      <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F3F4F1] border border-[#E5E7EB] text-xs">
        <span class="font-semibold text-[#14281D]">${escapeHtml(acc.code)}</span>
        <span class="text-[#6B7280]">${escapeHtml(acc.name)}:</span>
        <strong class="text-[#111827] tabular-nums">${escapeHtml(formatDisplayMoney(acc.balance))}</strong>
      </span>
    `
    )
    .join('');

  dom['liquid-accounts-pills'].innerHTML =
    pillsHtml ||
    '<span class="text-xs text-[#6B7280]">Belum ada akun likuiditas (11xx).</span>';

  // Row 1 Right: Net Profit & Unpaid AR vs AP
  dom['metric-net-profit'].textContent = formatDisplayMoney(metrics.netProfit);
  dom['metric-margin-badge'].textContent = `Margin ${metrics.netMarginPct.toFixed(1).replace('.', ',')}%`;
  dom['metric-revenue-mini'].textContent = formatDisplayMoney(metrics.totalRevenue);
  dom['metric-expense-mini'].textContent = formatDisplayMoney(metrics.totalExpenses);

  dom['metric-receivables'].textContent = formatDisplayMoney(metrics.totalReceivables);
  dom['receivables-sub'].textContent =
    metrics.unpaidInvoicesCount > 0
      ? `${metrics.sentCount} Sent · ${metrics.overdueCount} Overdue`
      : 'Semua tagihan lunas';

  dom['metric-payables'].textContent = formatDisplayMoney(metrics.totalPayables);
  dom['payables-sub'].textContent =
    metrics.totalPayables > 0 ? 'Kewajiban supplier (2101)' : 'Tidak ada utang aktif';

  // Row 2 Col 1: Expense Breakdown + Chart.js Donut
  dom['metric-expenses-total'].textContent = formatDisplayMoney(metrics.totalExpenses);
  dom['expense-chart-center-val'].textContent = formatDisplayMoney(metrics.totalExpenses, {
    compact: true
  });
  renderExpenseChart(metrics);

  // Row 2 Col 2: Revenue Target Progress + Invoice Snapshot
  dom['metric-revenue-gross'].textContent = formatDisplayMoney(metrics.totalRevenue);
  dom['metric-revenue-target'].textContent = formatDisplayMoney(metrics.monthlyTarget);
  dom['metric-target-pct'].textContent = `${metrics.targetProgressPct.toFixed(1).replace('.', ',')}% tercapai`;
  dom['revenue-progress-bar'].style.width = `${metrics.targetProgressPct}%`;

  dom['revenue-sources-list'].innerHTML =
    metrics.revenueBreakdown.length > 0
      ? metrics.revenueBreakdown
          .map(
            (rev) => `
          <div class="flex items-center justify-between text-xs bg-[#F9FAFB] border border-[#E5E7EB]/80 rounded-xl px-3 py-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-semibold text-[#14281D]">${escapeHtml(rev.code)}</span>
              <span class="text-[#6B7280] truncate">${escapeHtml(rev.name)}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0 tabular-nums">
              <strong class="text-[#111827]">${escapeHtml(formatDisplayMoney(rev.amount))}</strong>
              <span class="text-[11px] text-[#15803D] font-semibold">${rev.sharePct}%</span>
            </div>
          </div>
        `
          )
          .join('')
      : '<p class="text-xs text-[#6B7280]">Belum ada pendapatan tercatat.</p>';

  renderInvoiceSnapshot();

  // Row 2 Col 3: Live General Ledger
  if (metrics.pendingTxCount > 0) {
    dom['pending-count-badge'].textContent = `${metrics.pendingTxCount} Pending`;
    dom['pending-count-badge'].classList.remove('hidden');
  } else {
    dom['pending-count-badge'].classList.add('hidden');
  }
  renderRecentLedger();
}

function renderExpenseChart(metrics) {
  const breakdown = metrics.expenseBreakdown;

  dom['expense-legend-list'].innerHTML =
    breakdown.length > 0
      ? breakdown
          .map(
            (item) => `
          <li class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color:${item.color}"></span>
              <span class="text-[#111827] font-medium truncate">${escapeHtml(item.name)}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0 tabular-nums">
              <span class="text-[#6B7280]">${item.sharePct}%</span>
              <strong class="text-[#111827]">${escapeHtml(formatDisplayMoney(item.amount))}</strong>
            </div>
          </li>
        `
          )
          .join('')
      : '<li class="text-[#6B7280]">Belum ada beban atau HPP tercatat.</li>';

  const canvas = dom['expense-donut-chart'];
  const ChartLib = window.Chart;
  if (!ChartLib || !canvas) {
    canvas?.classList.add('hidden');
    dom['expense-chart-center'].classList.add('hidden');
    dom['expense-chart-fallback'].classList.remove('hidden');
    return;
  }

  canvas.classList.remove('hidden');
  dom['expense-chart-center'].classList.remove('hidden');
  dom['expense-chart-fallback'].classList.add('hidden');

  if (appState.expenseChart) {
    appState.expenseChart.destroy();
    appState.expenseChart = null;
  }

  const labels =
    breakdown.length > 0 ? breakdown.map((b) => b.name) : ['Belum Ada Biaya'];
  const values =
    breakdown.length > 0 ? breakdown.map((b) => b.amount) : [1];
  const colors =
    breakdown.length > 0 ? breakdown.map((b) => b.color) : ['#E5E7EB'];

  appState.expenseChart = new ChartLib(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: breakdown.length > 0,
          backgroundColor: '#14281D',
          titleFont: { family: 'Poppins', size: 11 },
          bodyFont: { family: 'Poppins', size: 12 },
          callbacks: {
            label: (ctx) => ` ${formatDisplayMoney(ctx.raw)}`
          }
        }
      }
    }
  });
}

function renderInvoiceSnapshot() {
  const list = dom['invoice-snapshot-list'];
  const items = (appState.invoices || []).slice(0, 4);

  if (items.length === 0) {
    list.innerHTML =
      '<li class="text-xs text-[#6B7280] py-2">Belum ada invoice tercatat.</li>';
    return;
  }

  list.innerHTML = items
    .map((inv) => {
      const badgeClass =
        inv.status === 'PAID'
          ? 'badge-paid'
          : inv.status === 'OVERDUE'
            ? 'badge-overdue'
            : inv.status === 'DRAFT'
              ? 'badge-draft'
              : 'badge-sent';
      return `
        <li class="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[#E5E7EB]/60 last:border-b-0">
          <div class="min-w-0">
            <p class="font-semibold text-[#111827] truncate">${escapeHtml(inv.client_name)}</p>
            <p class="text-[11px] text-[#6B7280]">${escapeHtml(inv.invoice_number)} &middot; Tempo ${escapeHtml(formatDateId(inv.due_date))}</p>
          </div>
          <div class="flex flex-col items-end gap-1 shrink-0 tabular-nums">
            <strong class="text-[#111827]">${escapeHtml(formatDisplayMoney(inv.total_amount))}</strong>
            <span class="status-badge ${badgeClass}">${escapeHtml(inv.status)}</span>
          </div>
        </li>
      `;
    })
    .join('');
}

function renderRecentLedger() {
  const feed = dom['recent-ledger-feed'];
  const filtered = appState.transactions.filter((tx) => {
    if (appState.ledgerFilter === 'ALL') return true;
    return tx.status === appState.ledgerFilter;
  });

  const canApprove =
    appState.mode === 'demo' ||
    ['owner', 'accountant'].includes(appState.activeOrg?.role);

  if (filtered.length === 0) {
    feed.innerHTML =
      '<div class="rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] p-4 text-center text-xs text-[#6B7280]">Belum ada transaksi pada filter ini.</div>';
    return;
  }

  feed.innerHTML = filtered
    .slice(0, 10)
    .map((tx) => {
      const statusBadge =
        tx.status === 'POSTED'
          ? 'badge-posted'
          : tx.status === 'PENDING'
            ? 'badge-pending'
            : 'badge-void';

      const linesHtml = (tx.journal_lines || [])
        .map((line) => {
          const isDebit = Number(line.debit || 0) > 0;
          const amount = isDebit ? line.debit : line.credit;
          return `
            <div class="flex items-center justify-between gap-2 text-[11px]">
              <span class="text-[#6B7280] truncate">
                <strong class="text-[#111827]">${escapeHtml(line.account_code)}</strong>
                ${escapeHtml(line.account_name)}
              </span>
              <span class="font-semibold tabular-nums shrink-0 ${isDebit ? 'text-[#15803D]' : 'text-[#DC2626]'}">
                ${isDebit ? 'Dr' : 'Cr'} ${escapeHtml(formatDisplayMoney(amount))}
              </span>
            </div>
          `;
        })
        .join('');

      const approveBtn =
        tx.status === 'PENDING' && canApprove
          ? `<button type="button" data-approve-tx="${escapeHtml(tx.id)}" class="mt-2 w-full py-1.5 rounded-xl text-[11px] font-semibold bg-[#14281D] text-[#9FE870] hover:bg-[#1D3A2A] transition">Setujui &amp; Posting Jurnal</button>`
          : '';

      return `
        <div class="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB]/70 p-3 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-[11px] font-semibold text-[#14281D]">${escapeHtml(tx.reference_no || 'JRN')}</span>
                <span class="text-[11px] text-[#6B7280]">&middot; ${escapeHtml(formatDateId(tx.tx_date))}</span>
              </div>
              <p class="text-xs font-semibold text-[#111827] mt-0.5 leading-snug">${escapeHtml(tx.description)}</p>
            </div>
            <span class="status-badge ${statusBadge} shrink-0">${escapeHtml(tx.status)}</span>
          </div>
          <div class="space-y-1 border-t border-[#E5E7EB]/80 pt-2">
            ${linesHtml}
          </div>
          ${approveBtn}
        </div>
      `;
    })
    .join('');

  feed.querySelectorAll('[data-approve-tx]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const txId = btn.getAttribute('data-approve-tx');
      btn.disabled = true;
      btn.textContent = 'Memposting...';
      try {
        await approvePendingTransaction(appState.activeOrgId, txId, {
          mode: appState.mode
        });
        showToast('Transaksi PENDING disetujui & saldo diperbarui.');
        await loadActiveOrganizationData();
      } catch (err) {
        showToast(err.message || 'Gagal menyetujui transaksi.', 'error');
        btn.disabled = false;
        btn.textContent = 'Setujui & Posting Jurnal';
      }
    });
  });
}

// ============================================================================
// TRANSACTION & TRANSFER MODAL LOGIC
// ============================================================================

function buildAccountOptionsHtml(selectedId = '') {
  const placeholder = '<option value="">Pilih akun...</option>';
  const options = appState.accounts
    .map((acc) => {
      const selected = acc.id === selectedId ? 'selected' : '';
      return `<option value="${escapeHtml(acc.id)}" ${selected}>${escapeHtml(acc.code)} — ${escapeHtml(acc.name)} (${escapeHtml(acc.category)})</option>`;
    })
    .join('');
  return placeholder + options;
}

function openTransactionModal(initialTab = 'journal') {
  dom['tx-modal-error'].classList.add('hidden');
  dom['tx-modal-error'].textContent = '';

  const today = todayIso();
  dom['jrn-date'].value = today;
  dom['jrn-ref'].value = `JRN-${String(appState.transactions.length + 1).padStart(3, '0')}`;
  dom['jrn-desc'].value = '';

  // Restrict status dropdown based on RBAC
  const isStaff = appState.activeOrg?.role === 'staff';
  dom['jrn-status'].value = isStaff ? 'PENDING' : 'POSTED';
  dom['jrn-status'].querySelector('option[value="POSTED"]').disabled = isStaff;

  const cashAcc = appState.accounts.find((a) => a.code === '1101') || appState.accounts[0];
  const expAcc = appState.accounts.find((a) => a.code === '6101') || appState.accounts[1];

  appState.journalLines = [
    { account_id: expAcc?.id || '', debit: '', credit: '' },
    { account_id: cashAcc?.id || '', debit: '', credit: '' }
  ];
  renderJournalLines();
  updateJournalBalanceIndicator();

  // Populate Transfer form
  dom['trf-date'].value = today;
  dom['trf-amount'].value = '';
  dom['trf-desc'].value = '';
  dom['trf-from-account'].innerHTML = buildAccountOptionsHtml(
    appState.accounts.find((a) => a.code === '1101')?.id || ''
  );
  dom['trf-to-account'].innerHTML = buildAccountOptionsHtml(
    appState.accounts.find((a) => a.code === '1102')?.id || ''
  );
  updateTransferPreview();

  switchTransactionModalTab(initialTab);
  dom['tx-modal'].classList.remove('hidden');
}

function closeTransactionModal() {
  dom['tx-modal'].classList.add('hidden');
}

function switchTransactionModalTab(tab) {
  const isJournal = tab === 'journal';
  dom['tab-journal'].classList.toggle('is-selected', isJournal);
  dom['tab-transfer'].classList.toggle('is-selected', !isJournal);
  dom['panel-journal'].classList.toggle('hidden', !isJournal);
  dom['panel-transfer'].classList.toggle('hidden', isJournal);
  dom['tx-modal-error'].classList.add('hidden');
}

function renderJournalLines() {
  const container = dom['jrn-lines-container'];
  container.innerHTML = '';

  appState.journalLines.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className =
      'journal-line-grid grid sm:grid-cols-12 gap-2 items-center bg-[#F9FAFB] sm:bg-transparent p-2.5 sm:p-0 rounded-2xl border sm:border-0 border-[#E5E7EB]';

    row.innerHTML = `
      <div class="journal-line-account sm:col-span-6">
        <select data-line-field="account_id" data-line-index="${idx}" class="kronos-input text-xs py-2">
          ${buildAccountOptionsHtml(line.account_id)}
        </select>
      </div>
      <div class="sm:col-span-2">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Debit"
          value="${escapeHtml(line.debit)}"
          data-line-field="debit"
          data-line-index="${idx}"
          class="kronos-input text-xs py-2 text-right tabular-nums"
        />
      </div>
      <div class="sm:col-span-3">
        <input
          type="number"
          min="0"
          step="any"
          placeholder="Kredit"
          value="${escapeHtml(line.credit)}"
          data-line-field="credit"
          data-line-index="${idx}"
          class="kronos-input text-xs py-2 text-right tabular-nums"
        />
      </div>
      <div class="col-span-2 sm:col-span-1 flex justify-end">
        <button
          type="button"
          data-remove-line="${idx}"
          ${appState.journalLines.length <= 2 ? 'disabled' : ''}
          aria-label="Hapus baris ${idx + 1}"
          class="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none transition"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
          </svg>
        </button>
      </div>
    `;

    container.appendChild(row);
  });

  // Bind live input handlers without destroying DOM focus
  container.querySelectorAll('[data-line-field]').forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, (e) => {
      const idx = Number(e.target.getAttribute('data-line-index'));
      const field = e.target.getAttribute('data-line-field');
      const val = e.target.value;

      appState.journalLines[idx][field] = val;

      // Enforce single-sided line UX: typing Debit clears Credit on same row & vice versa
      if (field === 'debit' && Number(val) > 0) {
        appState.journalLines[idx].credit = '';
        const peer = container.querySelector(
          `[data-line-field="credit"][data-line-index="${idx}"]`
        );
        if (peer) peer.value = '';
      } else if (field === 'credit' && Number(val) > 0) {
        appState.journalLines[idx].debit = '';
        const peer = container.querySelector(
          `[data-line-field="debit"][data-line-index="${idx}"]`
        );
        if (peer) peer.value = '';
      }

      updateJournalBalanceIndicator();
    });
  });

  container.querySelectorAll('[data-remove-line]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remove-line'));
      if (appState.journalLines.length > 2) {
        appState.journalLines.splice(idx, 1);
        renderJournalLines();
        updateJournalBalanceIndicator();
      }
    });
  });
}

function updateJournalBalanceIndicator() {
  const description = dom['jrn-desc'].value;
  const totals = calculateTotals(appState.journalLines);
  const validation = validateJournalEntry({
    description,
    lines: appState.journalLines
  });

  const baseCurr = appState.activeOrg?.currency || 'IDR';
  dom['jrn-total-debit'].textContent = formatCurrency(totals.totalDebit, baseCurr);
  dom['jrn-total-credit'].textContent = formatCurrency(totals.totalCredit, baseCurr);

  const badge = dom['jrn-balance-badge'];
  if (totals.totalDebit > 0 && totals.difference === 0 && totals.validLineCount >= 2) {
    badge.className = 'status-badge badge-posted tabular-nums self-start sm:self-center';
    badge.textContent = `Selisih: ${formatCurrency(0, baseCurr)} — Balance`;
  } else if (totals.totalDebit === 0 && totals.totalCredit === 0) {
    badge.className = 'status-badge badge-pending tabular-nums self-start sm:self-center';
    badge.textContent = 'Isi nominal Debit & Kredit';
  } else if (totals.difference === 0) {
    badge.className = 'status-badge badge-overdue tabular-nums self-start sm:self-center';
    badge.textContent = 'Lengkapi minimal 2 baris & akun';
  } else {
    badge.className = 'status-badge badge-overdue tabular-nums self-start sm:self-center';
    badge.textContent = `Selisih: ${formatCurrency(totals.difference, baseCurr)} — Belum Balance`;
  }

  dom['btn-submit-journal'].disabled = !validation.valid;
}

function updateTransferPreview() {
  const amount = roundMoney(dom['trf-amount'].value);
  const fromId = dom['trf-from-account'].value;
  const toId = dom['trf-to-account'].value;
  const fromAcc = appState.accounts.find((a) => a.id === fromId);
  const toAcc = appState.accounts.find((a) => a.id === toId);
  const baseCurr = appState.activeOrg?.currency || 'IDR';

  const sameAccount = Boolean(fromId && toId && fromId === toId);
  const valid = amount > 0 && Boolean(fromAcc && toAcc) && !sameAccount;

  if (sameAccount) {
    dom['trf-balance-badge'].className = 'status-badge badge-overdue';
    dom['trf-balance-badge'].textContent = 'Akun asal & tujuan tidak boleh sama';
  } else if (valid) {
    dom['trf-balance-badge'].className = 'status-badge badge-posted tabular-nums';
    dom['trf-balance-badge'].textContent = `Selisih: ${formatCurrency(0, baseCurr)} — Balance`;
  } else {
    dom['trf-balance-badge'].className = 'status-badge badge-overdue';
    dom['trf-balance-badge'].textContent = 'Isi nominal > 0';
  }

  const fmtAmt = formatCurrency(amount, baseCurr);
  dom['trf-preview-lines'].innerHTML = `
    <div class="flex justify-between">
      <span>Debit: <strong>${escapeHtml(toAcc ? `${toAcc.code} ${toAcc.name}` : '-')}</strong></span>
      <span class="font-semibold text-[#15803D]">${escapeHtml(fmtAmt)}</span>
    </div>
    <div class="flex justify-between">
      <span>Kredit: <strong>${escapeHtml(fromAcc ? `${fromAcc.code} ${fromAcc.name}` : '-')}</strong></span>
      <span class="font-semibold text-[#DC2626]">${escapeHtml(fmtAmt)}</span>
    </div>
  `;

  dom['btn-submit-transfer'].disabled = !valid;
}

async function handleJournalSubmit(e) {
  e.preventDefault();
  dom['tx-modal-error'].classList.add('hidden');

  const btn = dom['btn-submit-journal'];
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    await submitTransaction(
      {
        org_id: appState.activeOrgId,
        tx_date: dom['jrn-date'].value || todayIso(),
        reference_no: dom['jrn-ref'].value,
        description: dom['jrn-desc'].value,
        status: dom['jrn-status'].value,
        lines: appState.journalLines
      },
      { mode: appState.mode }
    );

    closeTransactionModal();
    showToast('Jurnal double-entry berhasil dicatat.');
    await loadActiveOrganizationData();
  } catch (err) {
    dom['tx-modal-error'].textContent =
      err?.message || 'Gagal menyimpan transaksi.';
    dom['tx-modal-error'].classList.remove('hidden');
  } finally {
    btn.textContent = 'Simpan Jurnal';
    updateJournalBalanceIndicator();
  }
}

async function handleTransferSubmit(e) {
  e.preventDefault();
  dom['tx-modal-error'].classList.add('hidden');

  const amount = roundMoney(dom['trf-amount'].value);
  const fromId = dom['trf-from-account'].value;
  const toId = dom['trf-to-account'].value;
  const fromAcc = appState.accounts.find((a) => a.id === fromId);
  const toAcc = appState.accounts.find((a) => a.id === toId);
  const customDesc = dom['trf-desc'].value.trim();

  const description =
    customDesc ||
    `Transfer Antar Akun (${fromAcc?.name || 'Sumber'} -> ${toAcc?.name || 'Tujuan'})`;

  const btn = dom['btn-submit-transfer'];
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    await submitTransaction(
      {
        org_id: appState.activeOrgId,
        tx_date: dom['trf-date'].value || todayIso(),
        reference_no: `TRF-${String(appState.transactions.length + 1).padStart(3, '0')}`,
        description,
        status: appState.activeOrg?.role === 'staff' ? 'PENDING' : 'POSTED',
        lines: [
          { account_id: toId, debit: amount, credit: 0 },
          { account_id: fromId, debit: 0, credit: amount }
        ]
      },
      { mode: appState.mode }
    );

    closeTransactionModal();
    showToast('Transfer antar akun berhasil dibukukan.');
    await loadActiveOrganizationData();
  } catch (err) {
    dom['tx-modal-error'].textContent =
      err?.message || 'Gagal mengeksekusi transfer.';
    dom['tx-modal-error'].classList.remove('hidden');
  } finally {
    btn.textContent = 'Eksekusi Transfer';
    updateTransferPreview();
  }
}

// ============================================================================
// AUTH MODAL & LIVE MODE SWITCHING
// ============================================================================

async function refreshAuthConfigStatus() {
  const cfg = await loadSupabaseConfig();
  if (dom['auth-config-status-text']) {
    dom['auth-config-status-text'].textContent = cfg.configured
      ? `Terhubung ke ${cfg.url} (sumber: ${cfg.source})`
      : 'Belum dikonfigurasi — isi URL & Key untuk Mode Live';
  }
  if (dom['cfg-supabase-url'] && cfg.url) {
    dom['cfg-supabase-url'].value = cfg.url;
  }
  if (dom['cfg-supabase-key'] && cfg.anonKey) {
    dom['cfg-supabase-key'].value = cfg.anonKey;
  }
  if (dom['auth-supabase-config-form']) {
    dom['auth-supabase-config-form'].classList.toggle('hidden', cfg.configured);
  }
  return cfg;
}

async function openAuthModal() {
  dom['auth-modal-message'].classList.add('hidden');
  const isSignedIn = Boolean(appState.user);

  dom['auth-login-form'].classList.toggle('hidden', isSignedIn);
  dom['auth-signedin-panel'].classList.toggle('hidden', !isSignedIn);
  dom['auth-create-org-form'].classList.toggle(
    'hidden',
    !(isSignedIn && appState.organizations.length === 0)
  );

  if (isSignedIn) {
    dom['auth-user-email'].textContent = appState.user.email || appState.user.id;
  }

  dom['auth-modal'].classList.remove('hidden');
  await refreshAuthConfigStatus();
}

function closeAuthModal() {
  dom['auth-modal'].classList.add('hidden');
}

function setAuthModalMessage(text, isError = false) {
  const el = dom['auth-modal-message'];
  el.className = isError
    ? 'rounded-2xl bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 text-xs font-medium'
    : 'rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 px-3.5 py-2.5 text-xs font-medium';
  el.textContent = text;
}

// ============================================================================
// DATA LOADING PIPELINE
// ============================================================================

async function loadActiveOrganizationData() {
  if (appState.mode === 'demo') {
    const snap = getDemoSnapshot(appState.activeOrgId);
    appState.activeOrg = snap.organization;
    appState.activeOrgId = snap.organization.id;
    appState.accounts = snap.accounts;
    appState.transactions = snap.transactions;
    appState.invoices = snap.invoices;
  } else {
    const activeOrg =
      appState.organizations.find((o) => o.id === appState.activeOrgId) ||
      appState.organizations[0];
    if (!activeOrg) return;

    appState.activeOrg = activeOrg;
    appState.activeOrgId = activeOrg.id;
    const snap = await fetchOrganizationSnapshot(activeOrg.id);
    appState.accounts = snap.accounts;
    appState.transactions = snap.transactions;
    appState.invoices = snap.invoices;
  }

  renderOrganizationSelector();
  renderBentoDashboard();
}

async function bootstrapDashboard() {
  const ctx = await resolveConnectionContext();
  appState.mode = ctx.mode;
  appState.reason = ctx.reason;
  appState.notice = ctx.notice;
  appState.user = ctx.user;

  if (appState.mode === 'live') {
    try {
      const orgs = await fetchUserOrganizations();
      if (orgs.length === 0) {
        appState.organizations = [];
        appState.mode = 'demo';
        appState.reason = 'unauthenticated-live';
        appState.notice =
          'Anda berhasil login, namun belum memiliki organisasi di Supabase. Buat organisasi baru atau tinjau Mode Demo.';
      } else {
        appState.organizations = orgs;
        const stored = window.sessionStorage?.getItem('kronos_active_org_id');
        appState.activeOrgId = orgs.some((o) => o.id === stored) ? stored : orgs[0].id;
      }
    } catch (err) {
      appState.mode = 'demo';
      appState.reason = 'sdk-error-fallback';
      appState.notice = `Gagal memuat data Live Supabase (${err?.message || 'Error jaringan'}). Beralih otomatis ke Mode Demo.`;
    }
  }

  if (appState.mode === 'demo') {
    appState.organizations = getDemoOrganizations();
    const stored = window.sessionStorage?.getItem('kronos_active_org_id');
    appState.activeOrgId =
      stored && appState.organizations.some((o) => o.id === stored)
        ? stored
        : appState.organizations[0]?.id || null;
  }

  renderConnectionHeader();
  await loadActiveOrganizationData();
}

function bindEvents() {
  // Org Switcher
  dom['org-switcher'].addEventListener('change', async (e) => {
    appState.activeOrgId = e.target.value;
    try {
      window.sessionStorage?.setItem('kronos_active_org_id', appState.activeOrgId);
    } catch {
      // Ignore storage errors
    }
    try {
      await loadActiveOrganizationData();
    } catch (err) {
      showToast(err.message || 'Gagal mengganti organisasi.', 'error');
    }
  });

  // Mode Switcher
  dom['mode-demo-btn'].addEventListener('click', async () => {
    setAppMode('demo');
    await bootstrapDashboard();
    showToast('Beralih ke Mode Demo.');
  });

  dom['mode-live-btn'].addEventListener('click', async () => {
    setAppMode('live');
    await bootstrapDashboard();
    if (appState.mode === 'demo') {
      openAuthModal();
    } else {
      showToast('Terhubung ke Live Supabase.');
    }
  });

  // Reset Demo
  dom['btn-reset-demo'].addEventListener('click', async () => {
    resetDemoState();
    await loadActiveOrganizationData();
    showToast('Data simulasi demo berhasil di-reset.');
  });

  // Banner Actions
  dom['banner-dismiss-btn'].addEventListener('click', () => {
    appState.notice = null;
    dom['status-banner'].classList.add('hidden');
  });
  dom['banner-login-btn'].addEventListener('click', openAuthModal);

  // Auth Triggers
  dom['auth-trigger-btn'].addEventListener('click', openAuthModal);
  dom['auth-trigger-btn-mobile'].addEventListener('click', openAuthModal);
  dom['auth-modal-close'].addEventListener('click', closeAuthModal);
  dom['auth-use-demo-btn'].addEventListener('click', () => {
    setAppMode('demo');
    closeAuthModal();
    bootstrapDashboard();
  });

  dom['auth-toggle-config-btn']?.addEventListener('click', () => {
    dom['auth-supabase-config-form']?.classList.toggle('hidden');
  });

  dom['auth-supabase-config-form']?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const url = dom['cfg-supabase-url']?.value || '';
      const key = dom['cfg-supabase-key']?.value || '';
      saveRuntimeSupabaseConfig(url, key);
      await refreshAuthConfigStatus();
      setAuthModalMessage(
        'Konfigurasi Supabase disimpan di browser. Silakan Masuk atau Daftar Akun.',
        false
      );
      showToast('Koneksi Supabase berhasil dikonfigurasi.');
    } catch (err) {
      setAuthModalMessage(err?.message || 'Konfigurasi tidak valid.', true);
    }
  });

  dom['cfg-clear-btn']?.addEventListener('click', async () => {
    clearRuntimeSupabaseConfig();
    if (dom['cfg-supabase-url']) dom['cfg-supabase-url'].value = '';
    if (dom['cfg-supabase-key']) dom['cfg-supabase-key'].value = '';
    await refreshAuthConfigStatus();
    setAuthModalMessage('Konfigurasi Supabase di browser telah dihapus.', false);
  });

  // Auth Tabs
  dom['auth-tab-signin'].addEventListener('click', () => {
    appState.authTab = 'signin';
    dom['auth-tab-signin'].classList.add('is-selected');
    dom['auth-tab-signup'].classList.remove('is-selected');
    dom['auth-submit-btn'].textContent = 'Masuk ke Live';
  });
  dom['auth-tab-signup'].addEventListener('click', () => {
    appState.authTab = 'signup';
    dom['auth-tab-signup'].classList.add('is-selected');
    dom['auth-tab-signin'].classList.remove('is-selected');
    dom['auth-submit-btn'].textContent = 'Daftar Akun Baru';
  });

  dom['auth-login-form'].addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = dom['auth-email'].value;
    const password = dom['auth-password'].value;
    dom['auth-submit-btn'].disabled = true;

    try {
      if (appState.authTab === 'signin') {
        await signInWithPassword(email, password);
        closeAuthModal();
        await bootstrapDashboard();
        showToast('Login Supabase berhasil.');
      } else {
        await signUp(email, password);
        setAuthModalMessage(
          'Pendaftaran berhasil. Silakan cek email verifikasi atau langsung login.',
          false
        );
      }
    } catch (err) {
      setAuthModalMessage(err?.message || 'Autentikasi gagal.', true);
    } finally {
      dom['auth-submit-btn'].disabled = false;
    }
  });

  dom['auth-show-create-org-btn'].addEventListener('click', () => {
    dom['auth-create-org-form'].classList.toggle('hidden');
  });

  dom['auth-create-org-form'].addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const org = await createOrganization({
        name: dom['new-org-name'].value,
        currency: dom['new-org-currency'].value,
        tax_rate: dom['new-org-tax'].value
      });
      setAppMode('live');
      closeAuthModal();
      await bootstrapDashboard();
      appState.activeOrgId = org.id;
      showToast(`Organisasi "${org.name}" dibuat beserta 15 akun CoA.`);
    } catch (err) {
      setAuthModalMessage(err?.message || 'Gagal membuat organisasi.', true);
    }
  });

  dom['auth-signout-btn'].addEventListener('click', async () => {
    await signOut();
    closeAuthModal();
    await bootstrapDashboard();
    showToast('Berhasil keluar. Kembali ke Mode Demo.');
  });

  // Currency Toggle (IDR / USD)
  dom['currency-idr-btn'].addEventListener('click', () => {
    appState.displayCurrency = 'IDR';
    renderBentoDashboard();
  });
  dom['currency-usd-btn'].addEventListener('click', () => {
    appState.displayCurrency = 'USD';
    renderBentoDashboard();
  });

  // Ledger Filters
  document.querySelectorAll('.ledger-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      appState.ledgerFilter = btn.getAttribute('data-ledger-filter') || 'ALL';
      document.querySelectorAll('.ledger-filter-btn').forEach((b) => {
        const active = b === btn;
        b.className = active
          ? 'ledger-filter-btn px-3 py-1 rounded-full text-xs font-semibold bg-[#14281D] text-white transition'
          : 'ledger-filter-btn px-3 py-1 rounded-full text-xs font-medium bg-[#F3F4F1] text-[#6B7280] hover:text-[#111827] transition';
      });
      renderRecentLedger();
    });
  });

  // Modal Triggers & Controls
  dom['btn-open-journal'].addEventListener('click', () => openTransactionModal('journal'));
  dom['btn-open-transfer'].addEventListener('click', () => openTransactionModal('transfer'));
  dom['tx-modal-close'].addEventListener('click', closeTransactionModal);
  dom['btn-cancel-journal'].addEventListener('click', closeTransactionModal);
  dom['btn-cancel-transfer'].addEventListener('click', closeTransactionModal);
  dom['tab-journal'].addEventListener('click', () => switchTransactionModalTab('journal'));
  dom['tab-transfer'].addEventListener('click', () => switchTransactionModalTab('transfer'));

  dom['tx-modal'].addEventListener('click', (e) => {
    if (e.target === dom['tx-modal']) closeTransactionModal();
  });
  dom['auth-modal'].addEventListener('click', (e) => {
    if (e.target === dom['auth-modal']) closeAuthModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTransactionModal();
      closeAuthModal();
    }
  });

  // Journal Form Listeners
  dom['jrn-desc'].addEventListener('input', updateJournalBalanceIndicator);
  dom['btn-add-line'].addEventListener('click', () => {
    appState.journalLines.push({ account_id: '', debit: '', credit: '' });
    renderJournalLines();
    updateJournalBalanceIndicator();
  });
  dom['panel-journal'].addEventListener('submit', handleJournalSubmit);

  // Transfer Form Listeners
  dom['trf-amount'].addEventListener('input', updateTransferPreview);
  dom['trf-from-account'].addEventListener('change', updateTransferPreview);
  dom['trf-to-account'].addEventListener('change', updateTransferPreview);
  dom['panel-transfer'].addEventListener('submit', handleTransferSubmit);
}

document.addEventListener('DOMContentLoaded', async () => {
  cacheDomElements();
  bindEvents();
  await bootstrapDashboard();
});
