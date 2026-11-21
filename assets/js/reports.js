// ============================================================================
// KRONOS LEDGER — assets/js/reports.js
// Financial Statements Controller (Income Statement, Balance Sheet, Trial Balance)
// ============================================================================

import {
  createWorkspaceShell,
  escapeHtml,
  formatDateId,
  todayIso,
  showToast
} from './ui-shell.js';

import {
  formatCurrency,
  computeIncomeStatement,
  computeBalanceSheet,
  computeTrialBalance,
  exportCsv
} from './accounting.js';

const viewState = {
  activeTab: 'ALL',
  lastComputed: null
};

let shell = null;

function getCurrency() {
  return shell?.state?.activeOrg?.currency || 'IDR';
}

function renderAccountRows(accounts, currency) {
  if (!accounts || accounts.length === 0) {
    return '<div class="py-2 text-xs text-[#6B7280]">Tidak ada akun pada kelompok ini.</div>';
  }
  return accounts
    .map(
      (acc) => `
      <div class="flex items-center justify-between gap-3 py-1.5 border-b border-[#E5E7EB]/60 last:border-b-0">
        <span class="text-[#111827] truncate">
          <span class="font-semibold text-[#14281D] mr-1.5">${escapeHtml(acc.code)}</span>
          ${escapeHtml(acc.name)}
        </span>
        <span class="font-medium text-[#111827] tabular-nums shrink-0">${escapeHtml(formatCurrency(acc.balance, currency))}</span>
      </div>
    `
    )
    .join('');
}

function renderReports() {
  const currency = getCurrency();
  const accounts = shell.state.accounts || [];

  const income = computeIncomeStatement(accounts);
  const balance = computeBalanceSheet(accounts, income.netProfit);
  const trial = computeTrialBalance(accounts);
  viewState.lastComputed = { income, balance, trial };

  document.getElementById('report-generated-at').textContent =
    `Posisi buku besar per ${formatDateId(todayIso())} · Mata uang ${currency}`;

  // 1. Income Statement
  document.getElementById('rep-net-margin').textContent =
    `Net Margin ${income.netMarginPct.toFixed(1).replace('.', ',')}%`;

  document.getElementById('income-statement-body').innerHTML = `
    <div class="space-y-1.5">
      <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">
        <span>Pendapatan (4xxx)</span>
        <span>Saldo</span>
      </div>
      ${renderAccountRows(income.revenues, currency)}
      <div class="flex items-center justify-between pt-2 font-bold text-[#111827] tabular-nums">
        <span>Total Pendapatan</span>
        <span class="text-[#15803D]">${escapeHtml(formatCurrency(income.totalRevenue, currency))}</span>
      </div>
    </div>

    <div class="space-y-1.5 pt-2 border-t border-[#E5E7EB]">
      <div class="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Harga Pokok Penjualan / HPP (5xxx)</div>
      ${renderAccountRows(income.cogs, currency)}
      <div class="flex items-center justify-between pt-2 font-semibold text-[#111827] tabular-nums">
        <span>Total HPP</span>
        <span class="text-[#DC2626]">(${escapeHtml(formatCurrency(income.totalCogs, currency))})</span>
      </div>
    </div>

    <div class="rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] px-4 py-3 flex items-center justify-between font-bold text-[#14281D] tabular-nums">
      <span>Laba Kotor (Gross Profit · ${income.grossMarginPct.toFixed(1).replace('.', ',')}% Margin)</span>
      <span>${escapeHtml(formatCurrency(income.grossProfit, currency))}</span>
    </div>

    <div class="space-y-1.5 pt-2 border-t border-[#E5E7EB]">
      <div class="text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Beban Operasional (6xxx)</div>
      ${renderAccountRows(income.expenses, currency)}
      <div class="flex items-center justify-between pt-2 font-semibold text-[#111827] tabular-nums">
        <span>Total Beban Operasional</span>
        <span class="text-[#DC2626]">(${escapeHtml(formatCurrency(income.totalExpenses, currency))})</span>
      </div>
    </div>

    <div class="rounded-2xl bg-[#9FE870] border border-[#14281D]/15 px-4 sm:px-5 py-4 flex items-center justify-between text-[#14281D] font-bold tabular-nums">
      <span class="text-sm sm:text-base">Laba / (Rugi) Bersih Periode Berjalan</span>
      <span class="text-base sm:text-xl">${escapeHtml(formatCurrency(income.netProfit, currency))}</span>
    </div>
  `;

  // 2. Balance Sheet
  const bsBadge = document.getElementById('rep-bs-status');
  if (balance.isBalancedSheet) {
    bsBadge.className = 'status-badge badge-posted self-start sm:self-center';
    bsBadge.textContent = 'Seimbang: Aset = Liabilitas + Ekuitas';
  } else {
    bsBadge.className = 'status-badge badge-overdue self-start sm:self-center';
    bsBadge.textContent = `Selisih Neraca: ${formatCurrency(balance.difference, currency)}`;
  }

  document.getElementById('balance-sheet-body').innerHTML = `
    <div class="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB]/70 p-4 sm:p-5 flex flex-col justify-between gap-4 text-xs sm:text-sm">
      <div class="space-y-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-[#14281D]">Aset (1xxx)</h3>
        ${renderAccountRows(balance.assets, currency)}
      </div>
      <div class="pt-3 border-t-2 border-[#14281D]/20 flex items-center justify-between font-bold text-[#14281D] tabular-nums">
        <span>Total Aset</span>
        <span class="text-base">${escapeHtml(formatCurrency(balance.totalAssets, currency))}</span>
      </div>
    </div>

    <div class="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB]/70 p-4 sm:p-5 flex flex-col justify-between gap-4 text-xs sm:text-sm">
      <div class="space-y-4">
        <div class="space-y-2">
          <h3 class="text-xs font-bold uppercase tracking-wider text-[#14281D]">Liabilitas / Utang (2xxx)</h3>
          ${renderAccountRows(balance.liabilities, currency)}
          <div class="flex items-center justify-between pt-1.5 font-semibold text-[#111827] tabular-nums">
            <span>Total Liabilitas</span>
            <span>${escapeHtml(formatCurrency(balance.totalLiabilities, currency))}</span>
          </div>
        </div>

        <div class="space-y-2 pt-3 border-t border-[#E5E7EB]">
          <h3 class="text-xs font-bold uppercase tracking-wider text-[#14281D]">Ekuitas (3xxx)</h3>
          ${renderAccountRows(balance.equities, currency)}
          <div class="flex items-center justify-between py-1.5 border-t border-[#E5E7EB]/60">
            <span class="text-[#111827] font-medium">Laba / (Rugi) Tahun Berjalan</span>
            <span class="font-semibold text-[#15803D] tabular-nums">${escapeHtml(formatCurrency(balance.currentEarnings, currency))}</span>
          </div>
          <div class="flex items-center justify-between pt-1.5 font-semibold text-[#111827] tabular-nums">
            <span>Total Ekuitas</span>
            <span>${escapeHtml(formatCurrency(balance.totalEquity, currency))}</span>
          </div>
        </div>
      </div>

      <div class="pt-3 border-t-2 border-[#14281D]/20 flex items-center justify-between font-bold text-[#14281D] tabular-nums">
        <span>Total Liabilitas &amp; Ekuitas</span>
        <span class="text-base">${escapeHtml(formatCurrency(balance.totalLiabilitiesAndEquity, currency))}</span>
      </div>
    </div>
  `;

  // 3. Trial Balance
  const tbBadge = document.getElementById('rep-tb-status');
  if (trial.isBalanced) {
    tbBadge.className = 'status-badge badge-posted self-start sm:self-center';
    tbBadge.textContent = 'Seimbang (Debit = Kredit)';
  } else {
    tbBadge.className = 'status-badge badge-overdue self-start sm:self-center';
    tbBadge.textContent = `Selisih ${formatCurrency(trial.difference, currency)}`;
  }

  document.getElementById('trial-balance-tbody').innerHTML = trial.rows
    .map(
      (r) => `
      <tr>
        <td class="py-3 px-4 sm:px-6 text-xs font-bold text-[#14281D] whitespace-nowrap">${escapeHtml(r.code)}</td>
        <td class="py-3 px-4 text-xs sm:text-sm font-medium text-[#111827]">${escapeHtml(r.name)}</td>
        <td class="py-3 px-4 text-[11px] font-medium text-[#6B7280] hidden sm:table-cell">${escapeHtml(r.category)}</td>
        <td class="py-3 px-4 text-xs sm:text-sm text-right tabular-nums ${r.debit > 0 ? 'font-semibold text-[#15803D]' : 'text-[#9CA3AF]'} whitespace-nowrap">
          ${r.debit > 0 ? escapeHtml(formatCurrency(r.debit, currency)) : '—'}
        </td>
        <td class="py-3 px-4 sm:px-6 text-xs sm:text-sm text-right tabular-nums ${r.credit > 0 ? 'font-semibold text-[#DC2626]' : 'text-[#9CA3AF]'} whitespace-nowrap">
          ${r.credit > 0 ? escapeHtml(formatCurrency(r.credit, currency)) : '—'}
        </td>
      </tr>
    `
    )
    .join('');

  document.getElementById('tb-total-debit').textContent = formatCurrency(trial.totalDebit, currency);
  document.getElementById('tb-total-credit').textContent = formatCurrency(trial.totalCredit, currency);

  applyTabVisibility();
}

function applyTabVisibility() {
  const tab = viewState.activeTab;
  document.getElementById('section-income').classList.toggle('hidden', tab !== 'ALL' && tab !== 'INCOME');
  document.getElementById('section-balance').classList.toggle('hidden', tab !== 'ALL' && tab !== 'BALANCE');
  document.getElementById('section-trial').classList.toggle('hidden', tab !== 'ALL' && tab !== 'TRIAL');
}

function handleExportCsv() {
  if (!viewState.lastComputed) return;
  const { income, balance, trial } = viewState.lastComputed;
  const orgName = shell.state.activeOrg?.name || 'kronos-ledger';
  const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const rows = [
    ['LABA RUGI', '', 'Total Pendapatan', income.totalRevenue, 0],
    ['LABA RUGI', '', 'Total HPP', income.totalCogs, 0],
    ['LABA RUGI', '', 'Laba Kotor', income.grossProfit, 0],
    ['LABA RUGI', '', 'Total Beban Operasional', income.totalExpenses, 0],
    ['LABA RUGI', '', 'Laba Bersih', income.netProfit, 0],
    ['NERACA', '', 'Total Aset', balance.totalAssets, 0],
    ['NERACA', '', 'Total Liabilitas', 0, balance.totalLiabilities],
    ['NERACA', '', 'Total Ekuitas (+ Laba Berjalan)', 0, balance.totalEquity],
    ...trial.rows.map((r) => ['NERACA SALDO', r.code, r.name, r.debit, r.credit]),
    ['NERACA SALDO', 'TOTAL', 'Total Neraca Saldo', trial.totalDebit, trial.totalCredit]
  ];

  exportCsv(
    `laporan-keuangan-${slug}-${todayIso()}.csv`,
    ['Bagian', 'Kode Akun', 'Nama Akun / Pos', 'Debit / Nilai', 'Kredit'],
    rows
  );
  showToast('Laporan keuangan berhasil diunduh dalam format CSV.');
}

async function handleCopySummary() {
  if (!viewState.lastComputed) return;
  const { income, balance } = viewState.lastComputed;
  const currency = getCurrency();
  const orgName = shell.state.activeOrg?.name || 'Kronos Ledger';

  const summary = [
    `RINGKASAN LAPORAN KEUANGAN — ${orgName}`,
    `Tanggal: ${formatDateId(todayIso())}`,
    `----------------------------------------`,
    `Total Pendapatan : ${formatCurrency(income.totalRevenue, currency)}`,
    `Total HPP        : ${formatCurrency(income.totalCogs, currency)}`,
    `Beban Operasional: ${formatCurrency(income.totalExpenses, currency)}`,
    `Laba Bersih      : ${formatCurrency(income.netProfit, currency)} (Margin ${income.netMarginPct.toFixed(1)}%)`,
    `----------------------------------------`,
    `Total Aset       : ${formatCurrency(balance.totalAssets, currency)}`,
    `Total Liabilitas : ${formatCurrency(balance.totalLiabilities, currency)}`,
    `Total Ekuitas    : ${formatCurrency(balance.totalEquity, currency)}`,
    `Status Neraca    : ${balance.isBalancedSheet ? 'SEIMBANG' : 'TIDAK SEIMBANG'}`
  ].join('\n');

  try {
    await navigator.clipboard.writeText(summary);
    showToast('Ringkasan laporan keuangan disalin ke clipboard.');
  } catch {
    showToast('Gagal menyalin otomatis. Gunakan Export CSV atau Cetak PDF.', 'warning');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  shell = createWorkspaceShell({
    onRender: renderReports
  });

  document.querySelectorAll('.report-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.activeTab = btn.getAttribute('data-report-tab') || 'ALL';
      document.querySelectorAll('.report-tab-btn').forEach((b) => {
        const active = b === btn;
        b.className = active
          ? 'report-tab-btn px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#14281D] text-white transition'
          : 'report-tab-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-white border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] transition';
      });
      applyTabVisibility();
    });
  });

  document.getElementById('btn-print-reports').addEventListener('click', () => {
    const prevTab = viewState.activeTab;
    viewState.activeTab = 'ALL';
    applyTabVisibility();
    window.print();
    viewState.activeTab = prevTab;
    applyTabVisibility();
  });

  document.getElementById('btn-export-csv').addEventListener('click', handleExportCsv);
  document.getElementById('btn-copy-summary').addEventListener('click', handleCopySummary);

  await shell.bootstrap();
});
