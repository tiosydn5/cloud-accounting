// ============================================================================
// KRONOS LEDGER — assets/js/invoices.js
// Invoices Management, New Invoice Builder & Double-Entry Settlement Workflow
// ============================================================================

import {
  createWorkspaceShell,
  escapeHtml,
  todayIso,
  addDaysIso,
  formatDateId,
  showToast
} from './ui-shell.js';

import {
  calculateInvoiceTotals,
  formatCurrency,
  createInvoiceRecord,
  markInvoiceAsPaid
} from './accounting.js';

const viewState = {
  statusFilter: 'ALL',
  search: '',
  draftItems: [],
  payingInvoice: null
};

let shell = null;

function getCurrency() {
  return shell?.state?.activeOrg?.currency || 'IDR';
}

function renderSummary() {
  const invoices = shell.state.invoices || [];
  const currency = getCurrency();

  const unpaid = invoices.filter((i) => ['SENT', 'OVERDUE', 'PARTIAL'].includes(i.status));
  const overdue = invoices.filter((i) => i.status === 'OVERDUE');
  const paid = invoices.filter((i) => i.status === 'PAID');

  const sum = (list) => list.reduce((s, i) => s + Number(i.total_amount || 0), 0);

  document.getElementById('inv-stat-unpaid').textContent = formatCurrency(sum(unpaid), currency);
  document.getElementById('inv-stat-unpaid-sub').textContent = `${unpaid.length} tagihan belum lunas`;

  document.getElementById('inv-stat-overdue').textContent = formatCurrency(sum(overdue), currency);
  document.getElementById('inv-stat-overdue-sub').textContent = `${overdue.length} invoice terlambat`;

  document.getElementById('inv-stat-paid').textContent = formatCurrency(sum(paid), currency);
  document.getElementById('inv-stat-paid-sub').textContent = `${paid.length} invoice lunas`;

  document.getElementById('inv-stat-all').textContent = formatCurrency(sum(invoices), currency);
  document.getElementById('inv-stat-all-sub').textContent = `${invoices.length} total dokumen`;
}

function renderInvoicesTable() {
  const tbody = document.getElementById('invoices-tbody');
  const currency = getCurrency();
  const q = viewState.search.trim().toLowerCase();
  const modeParam = shell.state.mode === 'live' ? 'live' : 'demo';

  const canPay =
    shell.state.mode === 'demo' ||
    ['owner', 'accountant'].includes(shell.state.activeOrg?.role);

  const filtered = (shell.state.invoices || []).filter((inv) => {
    if (viewState.statusFilter !== 'ALL' && inv.status !== viewState.statusFilter) {
      return false;
    }
    if (q) {
      const hay = `${inv.invoice_number} ${inv.client_name} ${inv.client_contact || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 px-4 text-center text-xs text-[#6B7280]">
          Belum ada invoice yang sesuai dengan filter.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((inv) => {
      const badgeClass =
        inv.status === 'PAID'
          ? 'badge-paid'
          : inv.status === 'OVERDUE'
            ? 'badge-overdue'
            : inv.status === 'DRAFT'
              ? 'badge-draft'
              : 'badge-sent';

      const detailHref = `invoice-view.html?id=${encodeURIComponent(inv.id)}&mode=${modeParam}`;
      const payButton =
        inv.status !== 'PAID' && canPay
          ? `<button type="button" data-open-pay="${escapeHtml(inv.id)}" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#14281D] text-[#9FE870] hover:bg-[#1D3A2A] transition whitespace-nowrap">Catat Lunas</button>`
          : '';

      return `
        <tr>
          <td class="py-3.5 px-4 sm:px-5 align-middle">
            <a href="${detailHref}" class="text-xs sm:text-sm font-bold text-[#14281D] hover:underline whitespace-nowrap">${escapeHtml(inv.invoice_number)}</a>
            <div class="text-[11px] text-[#6B7280] md:hidden mt-0.5">Tempo ${escapeHtml(formatDateId(inv.due_date))}</div>
          </td>
          <td class="py-3.5 px-4 align-middle">
            <div class="text-xs sm:text-sm font-semibold text-[#111827]">${escapeHtml(inv.client_name)}</div>
            <div class="text-[11px] text-[#6B7280] truncate max-w-[200px]">${escapeHtml(inv.client_contact || '—')}</div>
          </td>
          <td class="py-3.5 px-4 align-middle hidden md:table-cell text-xs text-[#6B7280] whitespace-nowrap">
            <div>Terbit: ${escapeHtml(formatDateId(inv.issue_date))}</div>
            <div>Tempo: <strong class="text-[#111827]">${escapeHtml(formatDateId(inv.due_date))}</strong></div>
          </td>
          <td class="py-3.5 px-4 align-middle text-right text-xs sm:text-sm font-bold text-[#111827] tabular-nums whitespace-nowrap">
            ${escapeHtml(formatCurrency(inv.total_amount, currency))}
          </td>
          <td class="py-3.5 px-4 align-middle">
            <span class="status-badge ${badgeClass}">${escapeHtml(inv.status)}</span>
          </td>
          <td class="py-3.5 px-4 sm:px-5 align-middle text-right">
            <div class="inline-flex items-center justify-end gap-1.5 flex-wrap">
              <a href="${detailHref}" class="px-3 py-1.5 rounded-full text-xs font-medium bg-[#F3F4F1] text-[#111827] hover:bg-gray-200 transition whitespace-nowrap">Detail / Cetak</a>
              ${payButton}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-open-pay]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const invId = btn.getAttribute('data-open-pay');
      const inv = shell.state.invoices.find((i) => i.id === invId);
      if (inv) openPayModal(inv);
    });
  });
}

// ============================================================================
// CREATE INVOICE MODAL
// ============================================================================

function buildProductOptions(selectedId = '') {
  const base = '<option value="">Jasa / Item Bebas</option>';
  const opts = (shell.state.products || [])
    .map(
      (p) =>
        `<option value="${escapeHtml(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.sku)} — ${escapeHtml(p.name)} (Stok: ${p.stock_qty})</option>`
    )
    .join('');
  return base + opts;
}

function openNewInvoiceModal() {
  const errBox = document.getElementById('invoice-modal-error');
  errBox.classList.add('hidden');
  errBox.textContent = '';

  document.getElementById('inv-client-name').value = '';
  document.getElementById('inv-client-contact').value = '';
  document.getElementById('inv-issue-date').value = todayIso();
  document.getElementById('inv-due-date').value = addDaysIso(14);
  document.getElementById('inv-discount').value = '0';
  document.getElementById('inv-tax-rate').value = String(shell.state.activeOrg?.tax_rate ?? 0);
  document.getElementById('inv-notes').value = '';

  const isStaff = shell.state.activeOrg?.role === 'staff';
  const statusEl = document.getElementById('inv-initial-status');
  statusEl.value = isStaff ? 'DRAFT' : 'SENT';

  viewState.draftItems = [{ product_id: '', description: '', qty: 1, unit_price: '' }];
  renderDraftItems();
  updateInvoiceTotalsDisplay();

  document.getElementById('invoice-modal').classList.remove('hidden');
}

function closeNewInvoiceModal() {
  document.getElementById('invoice-modal').classList.add('hidden');
}

function renderDraftItems() {
  const container = document.getElementById('inv-items-container');
  container.innerHTML = '';

  viewState.draftItems.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 space-y-2';
    row.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <div class="sm:col-span-5">
          <select data-item-field="product_id" data-item-idx="${idx}" class="kronos-input text-xs py-2">
            ${buildProductOptions(item.product_id)}
          </select>
        </div>
        <div class="sm:col-span-7">
          <input type="text" placeholder="Deskripsi barang atau jasa *" value="${escapeHtml(item.description)}" data-item-field="description" data-item-idx="${idx}" class="kronos-input text-xs py-2" />
        </div>
      </div>
      <div class="grid grid-cols-12 gap-2 items-center">
        <div class="col-span-3 sm:col-span-2">
          <input type="number" min="1" step="1" placeholder="Qty" value="${escapeHtml(item.qty)}" data-item-field="qty" data-item-idx="${idx}" class="kronos-input text-xs py-2 text-right tabular-nums" />
        </div>
        <div class="col-span-6 sm:col-span-5">
          <input type="number" min="0" step="any" placeholder="Harga Satuan (Rp)" value="${escapeHtml(item.unit_price)}" data-item-field="unit_price" data-item-idx="${idx}" class="kronos-input text-xs py-2 text-right tabular-nums" />
        </div>
        <div class="col-span-3 sm:col-span-4 text-right text-xs font-bold text-[#111827] tabular-nums" data-item-subtotal="${idx}">
          ${escapeHtml(formatCurrency(Number(item.qty || 0) * Number(item.unit_price || 0), getCurrency()))}
        </div>
        <div class="col-span-12 sm:col-span-1 flex justify-end">
          <button type="button" data-remove-item="${idx}" ${viewState.draftItems.length <= 1 ? 'disabled' : ''} aria-label="Hapus item" class="w-7 h-7 rounded-full flex items-center justify-center text-[#6B7280] hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:pointer-events-none">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
          </button>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('[data-item-field]').forEach((input) => {
    const evt = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(evt, (e) => {
      const idx = Number(e.target.getAttribute('data-item-idx'));
      const field = e.target.getAttribute('data-item-field');
      const val = e.target.value;

      viewState.draftItems[idx][field] = val;

      if (field === 'product_id' && val) {
        const prod = shell.state.products.find((p) => p.id === val);
        if (prod) {
          viewState.draftItems[idx].description = prod.name;
          viewState.draftItems[idx].unit_price = prod.sell_price;
          renderDraftItems();
        }
      } else {
        const subEl = container.querySelector(`[data-item-subtotal="${idx}"]`);
        if (subEl) {
          const item = viewState.draftItems[idx];
          subEl.textContent = formatCurrency(
            Number(item.qty || 0) * Number(item.unit_price || 0),
            getCurrency()
          );
        }
      }

      updateInvoiceTotalsDisplay();
    });
  });

  container.querySelectorAll('[data-remove-item]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-remove-item'));
      if (viewState.draftItems.length > 1) {
        viewState.draftItems.splice(idx, 1);
        renderDraftItems();
        updateInvoiceTotalsDisplay();
      }
    });
  });
}

function updateInvoiceTotalsDisplay() {
  const currency = getCurrency();
  const discount = Number(document.getElementById('inv-discount').value || 0);
  const taxRate = Number(document.getElementById('inv-tax-rate').value || 0);
  const totals = calculateInvoiceTotals(viewState.draftItems, discount, taxRate);

  document.getElementById('inv-calc-subtotal').textContent = formatCurrency(totals.subtotal, currency);
  document.getElementById('inv-calc-discount').textContent = `- ${formatCurrency(totals.discount, currency)}`;
  document.getElementById('inv-calc-tax').textContent = formatCurrency(totals.taxAmount, currency);
  document.getElementById('inv-calc-total').textContent = formatCurrency(totals.total, currency);
}

// ============================================================================
// SETTLEMENT / PAY MODAL
// ============================================================================

function openPayModal(invoice) {
  viewState.payingInvoice = invoice;
  const currency = getCurrency();
  document.getElementById('pay-modal-subtitle').textContent =
    `${invoice.invoice_number} — ${invoice.client_name}`;

  const cashBankAccounts = shell.state.accounts.filter(
    (a) => a.category === 'ASSET' && String(a.code || '').startsWith('11')
  );
  const select = document.getElementById('pay-account-select');
  select.innerHTML = cashBankAccounts
    .map(
      (a) =>
        `<option value="${escapeHtml(a.id)}" ${a.code === '1102' ? 'selected' : ''}>${escapeHtml(a.code)} — ${escapeHtml(a.name)}</option>`
    )
    .join('');

  const updatePreview = () => {
    const selected = cashBankAccounts.find((a) => a.id === select.value) || cashBankAccounts[0];
    document.getElementById('pay-preview-debit-acc').textContent = selected
      ? `Debit ${selected.code} ${selected.name}`
      : 'Debit Kas/Bank';
    document.getElementById('pay-preview-debit-val').textContent = formatCurrency(
      invoice.total_amount,
      currency
    );
    document.getElementById('pay-preview-credit-acc').textContent =
      invoice.status === 'DRAFT'
        ? 'Kredit 4101 Penjualan Produk'
        : 'Kredit 1201 Piutang Usaha';
    document.getElementById('pay-preview-credit-val').textContent = formatCurrency(
      invoice.total_amount,
      currency
    );
  };

  select.onchange = updatePreview;
  updatePreview();
  document.getElementById('pay-modal').classList.remove('hidden');
}

function closePayModal() {
  viewState.payingInvoice = null;
  document.getElementById('pay-modal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  shell = createWorkspaceShell({
    onRender: () => {
      renderSummary();
      renderInvoicesTable();
    }
  });

  document.querySelectorAll('.inv-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.statusFilter = btn.getAttribute('data-inv-filter') || 'ALL';
      document.querySelectorAll('.inv-filter-btn').forEach((b) => {
        const active = b === btn;
        b.className = active
          ? 'inv-filter-btn px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#14281D] text-white transition'
          : 'inv-filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#F3F4F1] text-[#6B7280] hover:text-[#111827] transition';
      });
      renderInvoicesTable();
    });
  });

  document.getElementById('inv-search').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderInvoicesTable();
  });

  document.getElementById('btn-open-new-invoice').addEventListener('click', openNewInvoiceModal);
  document.getElementById('invoice-modal-close').addEventListener('click', closeNewInvoiceModal);
  document.getElementById('btn-cancel-invoice').addEventListener('click', closeNewInvoiceModal);
  document.getElementById('invoice-modal').addEventListener('click', (e) => {
    if (e.target.id === 'invoice-modal') closeNewInvoiceModal();
  });

  document.getElementById('btn-add-inv-item').addEventListener('click', () => {
    viewState.draftItems.push({ product_id: '', description: '', qty: 1, unit_price: '' });
    renderDraftItems();
    updateInvoiceTotalsDisplay();
  });

  document.getElementById('inv-discount').addEventListener('input', updateInvoiceTotalsDisplay);
  document.getElementById('inv-tax-rate').addEventListener('input', updateInvoiceTotalsDisplay);

  document.getElementById('new-invoice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('invoice-modal-error');
    const submitBtn = document.getElementById('btn-submit-invoice');
    errBox.classList.add('hidden');

    const validItems = viewState.draftItems.filter(
      (it) => String(it.description || '').trim() && Number(it.qty) > 0 && Number(it.unit_price) > 0
    );

    if (validItems.length === 0) {
      errBox.textContent = 'Minimal 1 item wajib diisi deskripsi, qty > 0, dan harga > 0.';
      errBox.classList.remove('hidden');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Menerbitkan...';

    try {
      await createInvoiceRecord(
        {
          org_id: shell.state.activeOrgId,
          client_name: document.getElementById('inv-client-name').value,
          client_contact: document.getElementById('inv-client-contact').value,
          issue_date: document.getElementById('inv-issue-date').value || todayIso(),
          due_date: document.getElementById('inv-due-date').value || addDaysIso(14),
          items: validItems,
          discount_amount: Number(document.getElementById('inv-discount').value || 0),
          tax_rate: Number(document.getElementById('inv-tax-rate').value || 0),
          status: document.getElementById('inv-initial-status').value,
          notes: document.getElementById('inv-notes').value
        },
        { mode: shell.state.mode }
      );

      closeNewInvoiceModal();
      showToast('Invoice berhasil diterbitkan dan disinkronkan ke jurnal.');
      await shell.refresh();
    } catch (err) {
      errBox.textContent = err?.message || 'Gagal menerbitkan invoice.';
      errBox.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Terbitkan Invoice';
    }
  });

  document.getElementById('pay-modal-close').addEventListener('click', closePayModal);
  document.getElementById('btn-cancel-pay').addEventListener('click', closePayModal);
  document.getElementById('pay-modal').addEventListener('click', (e) => {
    if (e.target.id === 'pay-modal') closePayModal();
  });

  document.getElementById('pay-invoice-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!viewState.payingInvoice) return;

    const btn = document.getElementById('btn-confirm-pay');
    btn.disabled = true;
    btn.textContent = 'Memproses...';

    try {
      const paymentAccountId = document.getElementById('pay-account-select').value || null;
      await markInvoiceAsPaid(
        shell.state.activeOrgId,
        viewState.payingInvoice.id,
        paymentAccountId,
        { mode: shell.state.mode }
      );
      closePayModal();
      showToast('Pelunasan invoice dicatat & jurnal pembayaran terbentuk.');
      await shell.refresh();
    } catch (err) {
      showToast(err?.message || 'Gagal mencatat pelunasan.', 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Konfirmasi Lunas';
    }
  });

  await shell.bootstrap();
});
