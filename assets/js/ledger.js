// ============================================================================
// KRONOS LEDGER — assets/js/ledger.js
// General Ledger Filtering, Expand/Collapse, Approve/Void & Double-Entry Modal
// ============================================================================

import {
  createWorkspaceShell,
  escapeHtml,
  todayIso,
  formatDateId,
  showToast
} from './ui-shell.js';

import {
  calculateTotals,
  validateJournalEntry,
  formatCurrency,
  submitTransaction,
  approvePendingTransaction,
  voidTransaction
} from './accounting.js';

const viewState = {
  search: '',
  accountId: 'ALL',
  status: 'ALL',
  expandedIds: new Set(),
  journalLines: []
};

let shell = null;

function getCurrency() {
  return shell?.state?.activeOrg?.currency || 'IDR';
}

function getFilteredTransactions() {
  const { transactions } = shell.state;
  const q = viewState.search.trim().toLowerCase();

  return transactions.filter((tx) => {
    if (viewState.status !== 'ALL' && tx.status !== viewState.status) {
      return false;
    }

    if (viewState.accountId !== 'ALL') {
      const hasAcc = (tx.journal_lines || []).some(
        (l) => l.account_id === viewState.accountId
      );
      if (!hasAcc) return false;
    }

    if (q) {
      const inDesc = String(tx.description || '').toLowerCase().includes(q);
      const inRef = String(tx.reference_no || '').toLowerCase().includes(q);
      const inLine = (tx.journal_lines || []).some(
        (l) =>
          String(l.account_code || '').toLowerCase().includes(q) ||
          String(l.account_name || '').toLowerCase().includes(q)
      );
      if (!inDesc && !inRef && !inLine) return false;
    }

    return true;
  });
}

function renderAccountFilterOptions() {
  const select = document.getElementById('filter-account');
  if (!select) return;
  const current = viewState.accountId;

  select.innerHTML = '<option value="ALL">Semua Akun CoA</option>';
  for (const acc of shell.state.accounts) {
    const opt = document.createElement('option');
    opt.value = acc.id;
    opt.textContent = `${acc.code} — ${acc.name} (${acc.category})`;
    if (acc.id === current) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderKpis(filtered) {
  const currency = getCurrency();
  const { transactions, accounts } = shell.state;

  const postedInFilter = filtered.filter((t) => t.status === 'POSTED');
  let debitSum = 0;
  let creditSum = 0;

  for (const tx of postedInFilter) {
    for (const l of tx.journal_lines || []) {
      if (viewState.accountId === 'ALL' || l.account_id === viewState.accountId) {
        debitSum += Number(l.debit || 0);
        creditSum += Number(l.credit || 0);
      }
    }
  }

  document.getElementById('stat-tx-count').textContent = String(filtered.length);
  document.getElementById('stat-tx-sub').textContent = `Dari ${transactions.length} total entri`;
  document.getElementById('stat-total-debit').textContent = formatCurrency(debitSum, currency);
  document.getElementById('stat-total-credit').textContent = formatCurrency(creditSum, currency);

  const selectedAcc =
    viewState.accountId !== 'ALL'
      ? accounts.find((a) => a.id === viewState.accountId)
      : null;

  if (selectedAcc) {
    document.getElementById('stat-context-label').textContent = `Saldo ${selectedAcc.code}`;
    document.getElementById('stat-context-value').textContent = formatCurrency(
      selectedAcc.balance,
      currency
    );
    document.getElementById('stat-context-sub').textContent = selectedAcc.name;
  } else {
    const pendingCount = transactions.filter((t) => t.status === 'PENDING').length;
    document.getElementById('stat-context-label').textContent = 'Menunggu Approval';
    document.getElementById('stat-context-value').textContent = String(pendingCount);
    document.getElementById('stat-context-sub').textContent = 'Entri berstatus PENDING';
  }
}

function renderLedgerList() {
  const container = document.getElementById('ledger-list');
  const filtered = getFilteredTransactions();
  const currency = getCurrency();
  const canManage =
    shell.state.mode === 'demo' ||
    ['owner', 'accountant'].includes(shell.state.activeOrg?.role);

  renderKpis(filtered);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bento-card p-8 text-center space-y-2">
        <p class="text-sm font-semibold text-[#111827]">Tidak ada transaksi yang cocok</p>
        <p class="text-xs text-[#6B7280]">Ubah filter akun/status atau catat jurnal baru.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map((tx) => {
      const isExpanded = viewState.expandedIds.has(tx.id);
      const totals = calculateTotals(tx.journal_lines);
      const statusClass =
        tx.status === 'POSTED'
          ? 'badge-posted'
          : tx.status === 'PENDING'
            ? 'badge-pending'
            : 'badge-void';

      const rowsHtml = (tx.journal_lines || [])
        .map((line) => {
          const isHighlighted =
            viewState.accountId !== 'ALL' && line.account_id === viewState.accountId;
          return `
            <tr class="border-t border-[#E5E7EB]/70 ${isHighlighted ? 'bg-[#E9FAD9]/45' : ''}">
              <td class="py-2.5 px-3 text-xs font-semibold text-[#14281D] whitespace-nowrap">${escapeHtml(line.account_code)}</td>
              <td class="py-2.5 px-3 text-xs text-[#111827]">${escapeHtml(line.account_name)}</td>
              <td class="py-2.5 px-3 text-xs text-right tabular-nums font-medium ${line.debit > 0 ? 'text-[#15803D]' : 'text-[#9CA3AF]'}">
                ${line.debit > 0 ? escapeHtml(formatCurrency(line.debit, currency)) : '—'}
              </td>
              <td class="py-2.5 px-3 text-xs text-right tabular-nums font-medium ${line.credit > 0 ? 'text-[#DC2626]' : 'text-[#9CA3AF]'}">
                ${line.credit > 0 ? escapeHtml(formatCurrency(line.credit, currency)) : '—'}
              </td>
            </tr>
          `;
        })
        .join('');

      const actionsHtml = canManage
        ? `
          <div class="flex items-center gap-2 flex-wrap">
            ${
              tx.status === 'PENDING'
                ? `<button type="button" data-action="approve" data-tx-id="${escapeHtml(tx.id)}" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#14281D] text-[#9FE870] hover:bg-[#1D3A2A] transition">Approve &amp; Post</button>`
                : ''
            }
            ${
              tx.status !== 'VOID'
                ? `<button type="button" data-action="void" data-tx-id="${escapeHtml(tx.id)}" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition">Void Transaksi</button>`
                : '<span class="text-[11px] text-[#6B7280] italic">Dibatalkan (saldo telah dibalik)</span>'
            }
          </div>
        `
        : '';

      return `
        <article class="bento-card overflow-hidden">
          <button
            type="button"
            data-toggle-tx="${escapeHtml(tx.id)}"
            aria-expanded="${isExpanded ? 'true' : 'false'}"
            class="w-full text-left px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB]/80 transition"
          >
            <div class="flex items-start gap-3 min-w-0">
              <span class="mt-1 w-6 h-6 rounded-full bg-[#F3F4F1] flex items-center justify-center shrink-0 text-[#14281D] transition-transform ${isExpanded ? 'rotate-180' : ''}">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xs font-bold text-[#14281D]">${escapeHtml(tx.reference_no || 'JRN')}</span>
                  <span class="text-xs text-[#6B7280]">${escapeHtml(formatDateId(tx.tx_date))}</span>
                  <span class="status-badge ${statusClass}">${escapeHtml(tx.status)}</span>
                </div>
                <p class="text-sm font-semibold text-[#111827] mt-1 leading-snug">${escapeHtml(tx.description)}</p>
              </div>
            </div>

            <div class="flex items-center justify-between sm:justify-end gap-4 pl-9 sm:pl-0 shrink-0 tabular-nums">
              <div class="text-left sm:text-right">
                <span class="block text-[11px] text-[#6B7280]">${(tx.journal_lines || []).length} baris jurnal</span>
                <strong class="text-sm sm:text-base font-bold text-[#111827]">${escapeHtml(formatCurrency(totals.totalDebit, currency))}</strong>
              </div>
            </div>
          </button>

          <div class="${isExpanded ? '' : 'hidden'} border-t border-[#E5E7EB] bg-[#F9FAFB]/60 px-4 sm:px-5 py-4 space-y-3">
            <div class="overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white">
              <table class="kronos-table w-full text-left border-collapse">
                <thead class="bg-[#F9FAFB]">
                  <tr>
                    <th class="py-2.5 px-3">Kode</th>
                    <th class="py-2.5 px-3">Nama Akun</th>
                    <th class="py-2.5 px-3 text-right">Debit</th>
                    <th class="py-2.5 px-3 text-right">Kredit</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
                <tfoot class="border-t border-[#E5E7EB] bg-[#F9FAFB]/80">
                  <tr>
                    <td colspan="2" class="py-2.5 px-3 text-xs font-bold text-[#111827]">Total Berimbang</td>
                    <td class="py-2.5 px-3 text-xs font-bold text-right text-[#15803D] tabular-nums">${escapeHtml(formatCurrency(totals.totalDebit, currency))}</td>
                    <td class="py-2.5 px-3 text-xs font-bold text-right text-[#DC2626] tabular-nums">${escapeHtml(formatCurrency(totals.totalCredit, currency))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div class="flex items-center justify-between flex-wrap gap-2">
              <span class="text-[11px] text-[#6B7280] tabular-nums">ID: ${escapeHtml(tx.id)}</span>
              ${actionsHtml}
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  container.querySelectorAll('[data-toggle-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-tx');
      if (viewState.expandedIds.has(id)) viewState.expandedIds.delete(id);
      else viewState.expandedIds.add(id);
      renderLedgerList();
    });
  });

  container.querySelectorAll('[data-action="approve"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const txId = btn.getAttribute('data-tx-id');
      btn.disabled = true;
      try {
        await approvePendingTransaction(shell.state.activeOrgId, txId, {
          mode: shell.state.mode
        });
        showToast('Jurnal PENDING disetujui & saldo akun diperbarui.');
        await shell.refresh();
      } catch (err) {
        showToast(err.message || 'Gagal menyetujui transaksi.', 'error');
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-action="void"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const txId = btn.getAttribute('data-tx-id');
      if (!window.confirm('Yakin ingin membatalkan (VOID) transaksi ini? Saldo akun terkait akan otomatis dibalik.')) {
        return;
      }
      btn.disabled = true;
      try {
        await voidTransaction(shell.state.activeOrgId, txId, {
          mode: shell.state.mode
        });
        showToast('Transaksi berhasil di-VOID dan saldo dikoreksi.');
        await shell.refresh();
      } catch (err) {
        showToast(err.message || 'Gagal membatalkan transaksi.', 'error');
        btn.disabled = false;
      }
    });
  });
}

// ============================================================================
// NEW JOURNAL MODAL
// ============================================================================

function buildAccountOptions(selectedId = '') {
  return (
    '<option value="">Pilih akun...</option>' +
    shell.state.accounts
      .map(
        (acc) =>
          `<option value="${escapeHtml(acc.id)}" ${acc.id === selectedId ? 'selected' : ''}>${escapeHtml(acc.code)} — ${escapeHtml(acc.name)} (${escapeHtml(acc.category)})</option>`
      )
      .join('')
  );
}

function openJournalModal() {
  const errBox = document.getElementById('ledger-modal-error');
  errBox.classList.add('hidden');
  errBox.textContent = '';

  document.getElementById('jrn-date').value = todayIso();
  document.getElementById('jrn-ref').value = `JRN-${String(shell.state.transactions.length + 1).padStart(3, '0')}`;
  document.getElementById('jrn-desc').value = '';

  const isStaff = shell.state.activeOrg?.role === 'staff';
  const statusSelect = document.getElementById('jrn-status');
  statusSelect.value = isStaff ? 'PENDING' : 'POSTED';
  statusSelect.querySelector('option[value="POSTED"]').disabled = isStaff;

  const expAcc = shell.state.accounts.find((a) => a.code === '6101') || shell.state.accounts[0];
  const cashAcc = shell.state.accounts.find((a) => a.code === '1101') || shell.state.accounts[1];

  viewState.journalLines = [
    { account_id: expAcc?.id || '', debit: '', credit: '' },
    { account_id: cashAcc?.id || '', debit: '', credit: '' }
  ];

  renderModalLines();
  updateModalBalance();
  document.getElementById('ledger-modal').classList.remove('hidden');
}

function closeJournalModal() {
  document.getElementById('ledger-modal').classList.add('hidden');
}

function renderModalLines() {
  const container = document.getElementById('jrn-lines-container');
  container.innerHTML = '';

  viewState.journalLines.forEach((line, idx) => {
    const row = document.createElement('div');
    row.className =
      'journal-line-grid grid sm:grid-cols-12 gap-2 items-center bg-[#F9FAFB] sm:bg-transparent p-2.5 sm:p-0 rounded-2xl border sm:border-0 border-[#E5E7EB]';
    row.innerHTML = `
      <div class="journal-line-account sm:col-span-6">
        <select data-line-field="account_id" data-line-index="${idx}" class="kronos-input text-xs py-2">
          ${buildAccountOptions(line.account_id)}
        </select>
      </div>
      <div class="sm:col-span-2">
        <input type="number" min="0" step="any" placeholder="Debit" value="${escapeHtml(line.debit)}" data-line-field="debit" data-line-index="${idx}" class="kronos-input text-xs py-2 text-right tabular-nums" />
      </div>
      <div class="sm:col-span-3">
        <input type="number" min="0" step="any" placeholder="Kredit" value="${escapeHtml(line.credit)}" data-line-field="credit" data-line-index="${idx}" class="kronos-input text-xs py-2 text-right tabular-nums" />
      </div>
      <div class="col-span-2 sm:col-span-1 flex justify-end">
        <button type="button" data-remove-line="${idx}" ${viewState.journalLines.length <= 2 ? 'disabled' : ''} aria-label="Hapus baris" class="w-8 h-8 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none transition">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
        </button>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('[data-line-field]').forEach((input) => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, (e) => {
      const idx = Number(e.target.getAttribute('data-line-index'));
      const field = e.target.getAttribute('data-line-field');
      const val = e.target.value;
      viewState.journalLines[idx][field] = val;

      if (field === 'debit' && Number(val) > 0) {
        viewState.journalLines[idx].credit = '';
        const peer = container.querySelector(`[data-line-field="credit"][data-line-index="${idx}"]`);
        if (peer) peer.value = '';
      } else if (field === 'credit' && Number(val) > 0) {
        viewState.journalLines[idx].debit = '';
        const peer = container.querySelector(`[data-line-field="debit"][data-line-index="${idx}"]`);
        if (peer) peer.value = '';
      }
      updateModalBalance();
    });
  });

  container.querySelectorAll('[data-remove-line]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remove-line'));
      if (viewState.journalLines.length > 2) {
        viewState.journalLines.splice(idx, 1);
        renderModalLines();
        updateModalBalance();
      }
    });
  });
}

function updateModalBalance() {
  const currency = getCurrency();
  const desc = document.getElementById('jrn-desc').value;
  const totals = calculateTotals(viewState.journalLines);
  const validation = validateJournalEntry({
    description: desc,
    lines: viewState.journalLines
  });

  document.getElementById('jrn-total-debit').textContent = formatCurrency(totals.totalDebit, currency);
  document.getElementById('jrn-total-credit').textContent = formatCurrency(totals.totalCredit, currency);

  const badge = document.getElementById('jrn-balance-badge');
  if (totals.totalDebit > 0 && totals.difference === 0 && totals.validLineCount >= 2) {
    badge.className = 'status-badge badge-posted tabular-nums self-start sm:self-center';
    badge.textContent = `Selisih: ${formatCurrency(0, currency)} — Balance`;
  } else if (totals.totalDebit === 0 && totals.totalCredit === 0) {
    badge.className = 'status-badge badge-pending tabular-nums self-start sm:self-center';
    badge.textContent = 'Isi nominal Debit & Kredit';
  } else {
    badge.className = 'status-badge badge-overdue tabular-nums self-start sm:self-center';
    badge.textContent = `Selisih: ${formatCurrency(totals.difference, currency)} — Belum Balance`;
  }

  document.getElementById('btn-submit-journal').disabled = !validation.valid;
}

document.addEventListener('DOMContentLoaded', async () => {
  shell = createWorkspaceShell({
    onRender: () => {
      renderAccountFilterOptions();
      // Auto-expand the newest entry on first load for immediate clarity
      if (viewState.expandedIds.size === 0 && shell.state.transactions[0]) {
        viewState.expandedIds.add(shell.state.transactions[0].id);
      }
      renderLedgerList();
    }
  });

  document.getElementById('filter-search').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderLedgerList();
  });

  document.getElementById('filter-account').addEventListener('change', (e) => {
    viewState.accountId = e.target.value;
    renderLedgerList();
  });

  document.querySelectorAll('.status-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.status = btn.getAttribute('data-status-filter') || 'ALL';
      document.querySelectorAll('.status-filter-btn').forEach((b) => {
        const active = b === btn;
        b.className = active
          ? 'status-filter-btn px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#14281D] text-white transition'
          : 'status-filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#F3F4F1] text-[#6B7280] hover:text-[#111827] transition';
      });
      renderLedgerList();
    });
  });

  document.getElementById('btn-expand-all').addEventListener('click', () => {
    for (const tx of getFilteredTransactions()) viewState.expandedIds.add(tx.id);
    renderLedgerList();
  });

  document.getElementById('btn-collapse-all').addEventListener('click', () => {
    viewState.expandedIds.clear();
    renderLedgerList();
  });

  document.getElementById('btn-open-new-journal').addEventListener('click', openJournalModal);
  document.getElementById('ledger-modal-close').addEventListener('click', closeJournalModal);
  document.getElementById('btn-cancel-journal').addEventListener('click', closeJournalModal);
  document.getElementById('ledger-modal').addEventListener('click', (e) => {
    if (e.target.id === 'ledger-modal') closeJournalModal();
  });

  document.getElementById('jrn-desc').addEventListener('input', updateModalBalance);
  document.getElementById('btn-add-line').addEventListener('click', () => {
    viewState.journalLines.push({ account_id: '', debit: '', credit: '' });
    renderModalLines();
    updateModalBalance();
  });

  document.getElementById('ledger-journal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('ledger-modal-error');
    const submitBtn = document.getElementById('btn-submit-journal');
    errBox.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Menyimpan...';

    try {
      const res = await submitTransaction(
        {
          org_id: shell.state.activeOrgId,
          tx_date: document.getElementById('jrn-date').value || todayIso(),
          reference_no: document.getElementById('jrn-ref').value,
          description: document.getElementById('jrn-desc').value,
          status: document.getElementById('jrn-status').value,
          lines: viewState.journalLines
        },
        { mode: shell.state.mode }
      );
      if (res?.id) viewState.expandedIds.add(res.id);
      closeJournalModal();
      showToast('Jurnal double-entry berhasil dicatat.');
      await shell.refresh();
    } catch (err) {
      errBox.textContent = err?.message || 'Gagal menyimpan jurnal.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.textContent = 'Simpan Jurnal';
      updateModalBalance();
    }
  });

  await shell.bootstrap();
});
