// ============================================================================
// KRONOS LEDGER — assets/js/inventory.js
// Inventory Catalog, Low-Stock Alerts & Double-Entry Stock Movement Controller
// ============================================================================

import {
  createWorkspaceShell,
  escapeHtml,
  showToast
} from './ui-shell.js';

import {
  roundMoney,
  formatCurrency,
  createProductRecord,
  recordStockMovement
} from './accounting.js';

const viewState = {
  filter: 'ALL',
  search: ''
};

let shell = null;

function getCurrency() {
  return shell?.state?.activeOrg?.currency || 'IDR';
}

function isLowStock(prod) {
  const threshold = Number(prod.min_stock ?? 5);
  return Number(prod.stock_qty || 0) <= threshold;
}

function renderSummary() {
  const products = shell.state.products || [];
  const accounts = shell.state.accounts || [];
  const currency = getCurrency();

  const totalInventoryVal = roundMoney(
    products.reduce((s, p) => s + Number(p.stock_qty || 0) * Number(p.cost_price || 0), 0)
  );
  const totalRetailVal = roundMoney(
    products.reduce((s, p) => s + Number(p.stock_qty || 0) * Number(p.sell_price || 0), 0)
  );
  const totalUnits = products.reduce((s, p) => s + Number(p.stock_qty || 0), 0);
  const lowCount = products.filter(isLowStock).length;

  const invAccount = accounts.find((a) => a.code === '1301');

  document.getElementById('inv-val-total').textContent = formatCurrency(totalInventoryVal, currency);
  document.getElementById('inv-val-coa-note').textContent = `Saldo Akun 1301: ${formatCurrency(invAccount?.balance || 0, currency)}`;
  document.getElementById('inv-sku-count').textContent = String(products.length);
  document.getElementById('inv-units-total').textContent = `${totalUnits} unit tersedia`;
  document.getElementById('inv-low-count').textContent = String(lowCount);
  document.getElementById('inv-retail-total').textContent = formatCurrency(totalRetailVal, currency);
}

function renderProductsTable() {
  const tbody = document.getElementById('products-tbody');
  const currency = getCurrency();
  const q = viewState.search.trim().toLowerCase();

  const filtered = (shell.state.products || []).filter((p) => {
    if (viewState.filter === 'LOW' && !isLowStock(p)) return false;
    if (q) {
      const hay = `${p.sku} ${p.name}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="py-10 px-4 text-center text-xs text-[#6B7280]">
          Belum ada produk pada filter ini.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered
    .map((p) => {
      const qty = Number(p.stock_qty || 0);
      const val = roundMoney(qty * Number(p.cost_price || 0));
      const low = isLowStock(p);
      const stockBadge =
        qty <= 0
          ? '<span class="status-badge badge-out-stock">Habis</span>'
          : low
            ? '<span class="status-badge badge-low-stock">Menipis</span>'
            : '<span class="status-badge badge-posted">Aman</span>';

      return `
        <tr>
          <td class="py-3.5 px-4 sm:px-5 align-middle">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-[#F3F4F1] text-[#14281D]">${escapeHtml(p.sku)}</span>
              ${stockBadge}
            </div>
            <p class="text-xs sm:text-sm font-semibold text-[#111827] mt-1">${escapeHtml(p.name)}</p>
          </td>
          <td class="py-3.5 px-4 align-middle text-right tabular-nums">
            <strong class="text-sm font-bold ${qty <= 0 ? 'text-[#DC2626]' : low ? 'text-[#B45309]' : 'text-[#111827]'}">${qty}</strong>
            <span class="text-[11px] text-[#6B7280] block">unit</span>
          </td>
          <td class="py-3.5 px-4 align-middle text-right text-xs sm:text-sm tabular-nums text-[#6B7280] whitespace-nowrap">
            ${escapeHtml(formatCurrency(p.cost_price, currency))}
          </td>
          <td class="py-3.5 px-4 align-middle text-right text-xs sm:text-sm tabular-nums text-[#111827] hidden sm:table-cell whitespace-nowrap">
            ${escapeHtml(formatCurrency(p.sell_price, currency))}
          </td>
          <td class="py-3.5 px-4 align-middle text-right text-xs sm:text-sm font-bold text-[#14281D] tabular-nums whitespace-nowrap">
            ${escapeHtml(formatCurrency(val, currency))}
          </td>
          <td class="py-3.5 px-4 sm:px-5 align-middle text-right">
            <button type="button" data-adjust-prod="${escapeHtml(p.id)}" class="px-3 py-1.5 rounded-full text-xs font-semibold bg-[#F3F4F1] text-[#14281D] hover:bg-[#E9FAD9] transition whitespace-nowrap">
              Mutasi Stok
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  tbody.querySelectorAll('[data-adjust-prod]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openStockModal(btn.getAttribute('data-adjust-prod'));
    });
  });
}

// ============================================================================
// NEW PRODUCT MODAL
// ============================================================================

function openProductModal() {
  const errBox = document.getElementById('product-modal-error');
  errBox.classList.add('hidden');
  document.getElementById('prod-sku').value = '';
  document.getElementById('prod-name').value = '';
  document.getElementById('prod-cost').value = '0';
  document.getElementById('prod-sell').value = '0';
  document.getElementById('prod-qty').value = '0';

  const counterAccounts = shell.state.accounts.filter((a) =>
    ['3101', '1102', '1101', '2101'].includes(a.code)
  );
  const select = document.getElementById('prod-init-counter');
  select.innerHTML = counterAccounts
    .map(
      (a) =>
        `<option value="${escapeHtml(a.id)}" ${a.code === '3101' ? 'selected' : ''}>${escapeHtml(a.code)} — ${escapeHtml(a.name)}</option>`
    )
    .join('');

  document.getElementById('product-modal').classList.remove('hidden');
}

function closeProductModal() {
  document.getElementById('product-modal').classList.add('hidden');
}

// ============================================================================
// STOCK MOVEMENT MODAL (PURCHASE / IN / OUT)
// ============================================================================

function populateStockCounterAccounts() {
  const type = document.getElementById('stk-type').value;
  const select = document.getElementById('stk-counter');
  const preferredCodes =
    type === 'OUT'
      ? ['5101', '6101']
      : type === 'PURCHASE'
        ? ['1102', '1101', '2101']
        : ['3101', '6101', '1102'];

  const accounts = shell.state.accounts.filter((a) => a.code !== '1301');
  accounts.sort((a, b) => {
    const idxA = preferredCodes.indexOf(a.code);
    const idxB = preferredCodes.indexOf(b.code);
    const scoreA = idxA === -1 ? 99 : idxA;
    const scoreB = idxB === -1 ? 99 : idxB;
    return scoreA - scoreB || a.code.localeCompare(b.code);
  });

  select.innerHTML = accounts
    .map(
      (a, idx) =>
        `<option value="${escapeHtml(a.id)}" ${idx === 0 ? 'selected' : ''}>${escapeHtml(a.code)} — ${escapeHtml(a.name)} (${escapeHtml(a.category)})</option>`
    )
    .join('');
}

function updateStockJournalPreview() {
  const currency = getCurrency();
  const type = document.getElementById('stk-type').value;
  const qty = Number(document.getElementById('stk-qty').value || 0);
  const unitCost = Number(document.getElementById('stk-cost').value || 0);
  const totalVal = roundMoney(qty * unitCost);

  const counterId = document.getElementById('stk-counter').value;
  const counterAcc = shell.state.accounts.find((a) => a.id === counterId);
  const invAcc = shell.state.accounts.find((a) => a.code === '1301');

  const isInbound = type === 'PURCHASE' || type === 'IN';
  const debitLabel = isInbound
    ? `${invAcc?.code || '1301'} ${invAcc?.name || 'Persediaan Barang'}`
    : `${counterAcc?.code || ''} ${counterAcc?.name || 'Akun Lawan'}`;
  const creditLabel = isInbound
    ? `${counterAcc?.code || ''} ${counterAcc?.name || 'Akun Lawan'}`
    : `${invAcc?.code || '1301'} ${invAcc?.name || 'Persediaan Barang'}`;

  const previewEl = document.getElementById('stk-journal-preview');
  const badge = document.getElementById('stk-balance-badge');
  const submitBtn = document.getElementById('btn-submit-stock');

  if (qty <= 0) {
    badge.className = 'status-badge badge-overdue';
    badge.textContent = 'Qty harus > 0';
    submitBtn.disabled = true;
  } else {
    badge.className = 'status-badge badge-posted';
    badge.textContent = totalVal > 0 ? 'Balance (Debit = Kredit)' : 'Update Kuantitas Saja';
    submitBtn.disabled = false;
  }

  previewEl.innerHTML = `
    <div class="flex justify-between">
      <span>Debit: <strong class="text-[#111827]">${escapeHtml(debitLabel)}</strong></span>
      <span class="font-semibold text-[#15803D]">${escapeHtml(formatCurrency(totalVal, currency))}</span>
    </div>
    <div class="flex justify-between">
      <span>Kredit: <strong class="text-[#111827]">${escapeHtml(creditLabel)}</strong></span>
      <span class="font-semibold text-[#DC2626]">${escapeHtml(formatCurrency(totalVal, currency))}</span>
    </div>
  `;
}

function openStockModal(preselectProductId = '') {
  const errBox = document.getElementById('stock-modal-error');
  errBox.classList.add('hidden');

  const products = shell.state.products || [];
  if (products.length === 0) {
    showToast('Tambahkan produk terlebih dahulu sebelum mencatat mutasi stok.', 'warning');
    openProductModal();
    return;
  }

  const prodSelect = document.getElementById('stk-product');
  prodSelect.innerHTML = products
    .map(
      (p) =>
        `<option value="${escapeHtml(p.id)}" ${p.id === preselectProductId ? 'selected' : ''}>${escapeHtml(p.sku)} — ${escapeHtml(p.name)} (Stok: ${p.stock_qty})</option>`
    )
    .join('');

  const selected = products.find((p) => p.id === prodSelect.value) || products[0];
  document.getElementById('stk-type').value = 'PURCHASE';
  document.getElementById('stk-qty').value = '5';
  document.getElementById('stk-cost').value = String(selected?.cost_price || 0);
  document.getElementById('stk-note').value = '';

  populateStockCounterAccounts();
  updateStockJournalPreview();
  document.getElementById('stock-modal').classList.remove('hidden');
}

function closeStockModal() {
  document.getElementById('stock-modal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', async () => {
  shell = createWorkspaceShell({
    onRender: () => {
      renderSummary();
      renderProductsTable();
    }
  });

  document.querySelectorAll('.prod-filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewState.filter = btn.getAttribute('data-prod-filter') || 'ALL';
      document.querySelectorAll('.prod-filter-btn').forEach((b) => {
        const active = b === btn;
        b.className = active
          ? 'prod-filter-btn px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#14281D] text-white transition'
          : 'prod-filter-btn px-3.5 py-1.5 rounded-full text-xs font-medium bg-[#F3F4F1] text-[#6B7280] hover:text-[#111827] transition';
      });
      renderProductsTable();
    });
  });

  document.getElementById('prod-search').addEventListener('input', (e) => {
    viewState.search = e.target.value;
    renderProductsTable();
  });

  document.getElementById('btn-open-new-product').addEventListener('click', openProductModal);
  document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
  document.getElementById('btn-cancel-product').addEventListener('click', closeProductModal);
  document.getElementById('product-modal').addEventListener('click', (e) => {
    if (e.target.id === 'product-modal') closeProductModal();
  });

  document.getElementById('new-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('product-modal-error');
    const btn = document.getElementById('btn-submit-product');
    errBox.classList.add('hidden');
    btn.disabled = true;

    try {
      const invAcc = shell.state.accounts.find((a) => a.code === '1301');
      await createProductRecord(
        {
          org_id: shell.state.activeOrgId,
          sku: document.getElementById('prod-sku').value,
          name: document.getElementById('prod-name').value,
          cost_price: Number(document.getElementById('prod-cost').value || 0),
          sell_price: Number(document.getElementById('prod-sell').value || 0),
          stock_qty: Number(document.getElementById('prod-qty').value || 0),
          inventory_account_id: invAcc?.id || null,
          counter_account_id: document.getElementById('prod-init-counter').value || null
        },
        { mode: shell.state.mode }
      );
      closeProductModal();
      showToast('Produk baru berhasil ditambahkan ke katalog inventori.');
      await shell.refresh();
    } catch (err) {
      errBox.textContent = err?.message || 'Gagal menambah produk.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('btn-open-stock-move').addEventListener('click', () => openStockModal());
  document.getElementById('stock-modal-close').addEventListener('click', closeStockModal);
  document.getElementById('btn-cancel-stock').addEventListener('click', closeStockModal);
  document.getElementById('stock-modal').addEventListener('click', (e) => {
    if (e.target.id === 'stock-modal') closeStockModal();
  });

  document.getElementById('stk-product').addEventListener('change', (e) => {
    const prod = shell.state.products.find((p) => p.id === e.target.value);
    if (prod) {
      document.getElementById('stk-cost').value = String(prod.cost_price || 0);
      updateStockJournalPreview();
    }
  });

  document.getElementById('stk-type').addEventListener('change', () => {
    populateStockCounterAccounts();
    updateStockJournalPreview();
  });

  document.getElementById('stk-qty').addEventListener('input', updateStockJournalPreview);
  document.getElementById('stk-cost').addEventListener('input', updateStockJournalPreview);
  document.getElementById('stk-counter').addEventListener('change', updateStockJournalPreview);

  document.getElementById('stock-move-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errBox = document.getElementById('stock-modal-error');
    const btn = document.getElementById('btn-submit-stock');
    errBox.classList.add('hidden');
    btn.disabled = true;

    try {
      const prodId = document.getElementById('stk-product').value;
      const product = shell.state.products.find((p) => p.id === prodId);
      const invAcc = shell.state.accounts.find((a) => a.code === '1301');

      await recordStockMovement(
        {
          org_id: shell.state.activeOrgId,
          product_id: prodId,
          product,
          movement_type: document.getElementById('stk-type').value,
          qty: Number(document.getElementById('stk-qty').value || 0),
          unit_cost: Number(document.getElementById('stk-cost').value || 0),
          inventory_account_id: invAcc?.id || null,
          counter_account_id: document.getElementById('stk-counter').value || null,
          note: document.getElementById('stk-note').value
        },
        { mode: shell.state.mode }
      );

      closeStockModal();
      showToast('Mutasi stok & jurnal persediaan berhasil dicatat.');
      await shell.refresh();
    } catch (err) {
      errBox.textContent = err?.message || 'Gagal mencatat mutasi stok.';
      errBox.classList.remove('hidden');
    } finally {
      btn.disabled = false;
    }
  });

  await shell.bootstrap();
});
