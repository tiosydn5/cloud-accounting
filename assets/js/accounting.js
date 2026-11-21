// ============================================================================
// KRONOS LEDGER — assets/js/accounting.js
// Pure Double-Entry Accounting Calculations, Validation, Formatting & RPC Submit
// ============================================================================

import {
  callRpc,
  isDemoMode,
  createOrganization as createLiveOrganization,
  updateLiveOrganization,
  createLiveAccount,
  fetchLiveAuditLogs,
  fetchOrganizationSnapshot,
  createLiveInvoice,
  markLiveInvoicePaid,
  createLiveProduct,
  updateLiveProductStock
} from './supabase-client.js';
import {
  BUSINESS_PRESETS,
  addDemoTransaction,
  approveDemoTransaction,
  voidDemoTransaction,
  createDemoInvoice,
  markDemoInvoicePaid,
  addDemoProduct,
  adjustDemoProductStock,
  createDemoOrganization,
  updateDemoOrganizationProfile,
  addDemoAccount,
  getDemoAuditLogs
} from './demo-data.js';

export const DEFAULT_USD_IDR_RATE = 15800;

export function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Computes debit/credit sums and balance difference for an array of journal lines.
 */
export function calculateTotals(lines = []) {
  if (!Array.isArray(lines)) {
    return {
      totalDebit: 0,
      totalCredit: 0,
      difference: 0,
      lineCount: 0,
      validLineCount: 0
    };
  }

  let totalDebit = 0;
  let totalCredit = 0;
  let validLineCount = 0;

  for (const line of lines) {
    const debit = roundMoney(line?.debit || 0);
    const credit = roundMoney(line?.credit || 0);
    totalDebit = roundMoney(totalDebit + debit);
    totalCredit = roundMoney(totalCredit + credit);

    const hasAccount = Boolean(line?.account_id);
    const singleSidedPositive =
      (debit > 0 && credit === 0) || (credit > 0 && debit === 0);
    if (hasAccount && singleSidedPositive) {
      validLineCount += 1;
    }
  }

  const difference = roundMoney(Math.abs(totalDebit - totalCredit));
  return {
    totalDebit,
    totalCredit,
    difference,
    lineCount: lines.length,
    validLineCount
  };
}

/**
 * Pure check matching PostgreSQL constraints:
 * - Minimum 2 lines
 * - Every line has account_id and strictly positive single-sided debit OR credit
 * - totalDebit > 0 and totalDebit === totalCredit
 */
export function isBalanced(lines = []) {
  if (!Array.isArray(lines) || lines.length < 2) return false;

  for (const line of lines) {
    if (!line?.account_id) return false;
    const debit = roundMoney(line?.debit || 0);
    const credit = roundMoney(line?.credit || 0);
    if (debit < 0 || credit < 0) return false;
    const isDebitOnly = debit > 0 && credit === 0;
    const isCreditOnly = credit > 0 && debit === 0;
    if (!isDebitOnly && !isCreditOnly) return false;
  }

  const { totalDebit, totalCredit, difference } = calculateTotals(lines);
  return totalDebit > 0 && totalCredit > 0 && difference === 0;
}

export function validateJournalEntry({ description, lines }) {
  const errors = [];
  const trimmedDesc = String(description || '').trim();
  if (!trimmedDesc) {
    errors.push('Deskripsi transaksi wajib diisi.');
  }

  if (!Array.isArray(lines) || lines.length < 2) {
    errors.push('Transaksi double-entry minimal memiliki 2 baris jurnal.');
  } else {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const debit = roundMoney(line?.debit || 0);
      const credit = roundMoney(line?.credit || 0);
      if (!line?.account_id) {
        errors.push(`Baris ${i + 1}: Akun belum dipilih.`);
      }
      if (debit < 0 || credit < 0) {
        errors.push(`Baris ${i + 1}: Nominal tidak boleh negatif.`);
      } else if (debit === 0 && credit === 0) {
        errors.push(`Baris ${i + 1}: Isi nominal Debit atau Kredit lebih dari 0.`);
      } else if (debit > 0 && credit > 0) {
        errors.push(`Baris ${i + 1}: Satu baris hanya boleh Debit ATAU Kredit.`);
      }
    }
  }

  const totals = calculateTotals(lines);
  if (totals.totalDebit <= 0 || totals.difference !== 0) {
    errors.push('Total Debit harus sama persis dengan Total Kredit (Balance).');
  }

  return {
    valid: errors.length === 0 && isBalanced(lines),
    errors,
    ...totals
  };
}

export function convertCurrency(
  amount,
  displayCurrency = 'IDR',
  baseCurrency = 'IDR',
  fxRate = DEFAULT_USD_IDR_RATE
) {
  const num = Number(amount || 0);
  if (!Number.isFinite(num)) return 0;
  if (displayCurrency === baseCurrency) return num;
  if (baseCurrency === 'IDR' && displayCurrency === 'USD') {
    return roundMoney(num / fxRate);
  }
  if (baseCurrency === 'USD' && displayCurrency === 'IDR') {
    return roundMoney(num * fxRate);
  }
  return num;
}

export function formatCurrency(amount, currency = 'IDR', options = {}) {
  const { compact = false } = options;
  const num = Number(amount || 0);
  const safeNum = Number.isFinite(num) ? num : 0;

  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: compact ? 0 : 2,
      maximumFractionDigits: compact ? 1 : 2,
      notation: compact ? 'compact' : 'standard'
    }).format(safeNum);
  }

  const hasFraction = Math.abs(safeNum % 1) > 0.001;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: hasFraction && !compact ? 2 : 0,
    maximumFractionDigits: hasFraction && !compact ? 2 : 0,
    notation: compact ? 'compact' : 'standard'
  }).format(safeNum);
}

export function calculatePercentage(part, total) {
  const numPart = Number(part || 0);
  const numTotal = Number(total || 0);
  if (!Number.isFinite(numPart) || !Number.isFinite(numTotal) || numTotal <= 0) {
    return 0;
  }
  return Math.round(((numPart / numTotal) * 100) * 10) / 10;
}

export function calculateMarginPercentage(netProfit, totalRevenue) {
  const numProfit = Number(netProfit || 0);
  const numRev = Number(totalRevenue || 0);
  if (!Number.isFinite(numProfit) || !Number.isFinite(numRev) || numRev <= 0) {
    return 0;
  }
  return Math.round(((numProfit / numRev) * 100) * 10) / 10;
}

/**
 * Computes Bento Dashboard accounting KPIs directly from accounts, transactions & invoices.
 */
export function computeFinancialMetrics({
  organization,
  accounts = [],
  transactions = [],
  invoices = []
}) {
  const liquidAccounts = accounts.filter(
    (a) => a.category === 'ASSET' && String(a.code || '').startsWith('11')
  );
  const totalLiquidity = roundMoney(
    liquidAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  );

  const cashAccount =
    accounts.find((a) => a.code === '1101') || liquidAccounts[0] || null;
  const bankAccount =
    accounts.find((a) => a.code === '1102') || liquidAccounts[1] || null;

  const arAccount = accounts.find((a) => a.code === '1201');
  const apAccount = accounts.find((a) => a.code === '2101');

  const unpaidInvoices = invoices.filter((inv) =>
    ['SENT', 'PARTIAL', 'OVERDUE'].includes(inv.status)
  );
  const unpaidInvoiceTotal = roundMoney(
    unpaidInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
  );
  const overdueCount = invoices.filter((inv) => inv.status === 'OVERDUE').length;
  const sentCount = invoices.filter((inv) => inv.status === 'SENT').length;

  const totalReceivables = arAccount
    ? roundMoney(Number(arAccount.balance || 0))
    : unpaidInvoiceTotal;
  const totalPayables = apAccount ? roundMoney(Number(apAccount.balance || 0)) : 0;

  const revenueAccounts = accounts.filter((a) => a.category === 'REVENUE');
  const cogsAccounts = accounts.filter((a) => a.category === 'COGS');
  const opexAccounts = accounts.filter((a) => a.category === 'EXPENSE');

  const totalRevenue = roundMoney(
    revenueAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  );
  const totalCogs = roundMoney(
    cogsAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  );
  const totalOpEx = roundMoney(
    opexAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)
  );
  const totalExpenses = roundMoney(totalCogs + totalOpEx);
  const netProfit = roundMoney(totalRevenue - totalExpenses);
  const netMarginPct = calculateMarginPercentage(netProfit, totalRevenue);

  const monthlyTarget = Number(organization?.monthly_revenue_target || 130000000);
  const targetProgressPct = Math.min(
    100,
    calculatePercentage(totalRevenue, monthlyTarget)
  );

  // Build expense & COGS breakdown for Donut Chart
  const expensePalette = ['#14281D', '#52B788', '#9FE870', '#D97706', '#6B7280', '#1E3A2F'];
  const expenseBreakdown = [...cogsAccounts, ...opexAccounts]
    .filter((acc) => Number(acc.balance || 0) > 0)
    .sort((a, b) => Number(b.balance) - Number(a.balance))
    .map((acc, index) => ({
      code: acc.code,
      name: acc.name,
      category: acc.category,
      amount: roundMoney(Number(acc.balance || 0)),
      sharePct: calculatePercentage(acc.balance, totalExpenses),
      color: expensePalette[index % expensePalette.length]
    }));

  const revenueBreakdown = revenueAccounts
    .map((acc) => ({
      code: acc.code,
      name: acc.name,
      amount: roundMoney(Number(acc.balance || 0)),
      sharePct: calculatePercentage(acc.balance, totalRevenue)
    }))
    .sort((a, b) => b.amount - a.amount);

  const pendingTxCount = transactions.filter((t) => t.status === 'PENDING').length;

  return {
    totalLiquidity,
    liquidAccounts,
    cashAccount,
    bankAccount,
    totalReceivables,
    totalPayables,
    unpaidInvoicesCount: unpaidInvoices.length,
    overdueCount,
    sentCount,
    totalRevenue,
    totalCogs,
    totalOpEx,
    totalExpenses,
    netProfit,
    netMarginPct,
    monthlyTarget,
    targetProgressPct,
    expenseBreakdown,
    revenueBreakdown,
    pendingTxCount
  };
}

/**
 * Submits a validated double-entry transaction either to demo store or Supabase RPC.
 */
export async function submitTransaction(payload, options = {}) {
  const { org_id, tx_date, reference_no, description, lines, status = 'POSTED' } =
    payload;

  const validation = validateJournalEntry({ description, lines });
  if (!validation.valid) {
    throw new Error(validation.errors[0] || 'Jurnal tidak valid atau belum seimbang.');
  }

  const cleanLines = lines.map((line) => ({
    account_id: line.account_id,
    debit: roundMoney(line.debit || 0),
    credit: roundMoney(line.credit || 0)
  }));

  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (useDemo) {
    const id = addDemoTransaction({
      org_id,
      tx_date,
      reference_no,
      description,
      lines: cleanLines,
      status
    });
    return { id, mode: 'demo' };
  }

  const id = await callRpc('post_double_entry_transaction', {
    p_org_id: org_id,
    p_tx_date: tx_date || new Date().toISOString().slice(0, 10),
    p_reference_no: reference_no ? reference_no.trim() : null,
    p_description: description.trim(),
    p_lines: cleanLines,
    p_status: status
  });

  return { id, mode: 'live' };
}

export async function approvePendingTransaction(orgId, transactionId, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());
  if (useDemo) {
    return approveDemoTransaction(orgId, transactionId);
  }
  return callRpc('approve_pending_transaction', { p_transaction_id: transactionId });
}

export async function voidTransaction(orgId, transactionId, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());
  if (useDemo) {
    return voidDemoTransaction(orgId, transactionId);
  }
  return callRpc('void_transaction', { p_transaction_id: transactionId });
}

// ============================================================================
// INVOICE, INVENTORY & FINANCIAL REPORTS HELPERS (FASE 3)
// ============================================================================

export function calculateInvoiceTotals(items = [], discountAmount = 0, taxRate = 0) {
  const subtotal = roundMoney(
    (items || []).reduce(
      (sum, item) => sum + roundMoney(Number(item.qty || 0) * Number(item.unit_price || 0)),
      0
    )
  );
  const discount = Math.min(subtotal, Math.max(0, roundMoney(discountAmount)));
  const taxableBase = Math.max(0, roundMoney(subtotal - discount));
  const rate = Math.max(0, Number(taxRate || 0));
  const taxAmount = roundMoney((taxableBase * rate) / 100);
  const total = roundMoney(taxableBase + taxAmount);

  return { subtotal, discount, taxableBase, taxRate: rate, taxAmount, total };
}

export async function createInvoiceRecord(payload, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  const { subtotal, discount, taxAmount, total } = calculateInvoiceTotals(
    payload.items,
    payload.discount_amount,
    payload.tax_rate
  );

  if (!String(payload.client_name || '').trim()) {
    throw new Error('Nama klien wajib diisi.');
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Invoice minimal memiliki 1 item.');
  }
  if (total <= 0) {
    throw new Error('Total invoice harus lebih dari 0.');
  }

  if (useDemo) {
    return createDemoInvoice({
      ...payload,
      subtotal,
      discount_amount: discount,
      tax_amount: taxAmount,
      total_amount: total
    });
  }

  return createLiveInvoice({
    ...payload,
    total_amount: total
  });
}

export async function markInvoiceAsPaid(orgId, invoiceId, paymentAccountId, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (useDemo) {
    return markDemoInvoicePaid(orgId, invoiceId, paymentAccountId);
  }
  return markLiveInvoicePaid(invoiceId, paymentAccountId);
}

export async function createProductRecord(payload, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (!String(payload.sku || '').trim() || !String(payload.name || '').trim()) {
    throw new Error('SKU dan nama produk wajib diisi.');
  }

  if (useDemo) {
    return addDemoProduct(payload);
  }

  const product = await createLiveProduct(payload);
  const initValue = roundMoney(Number(payload.cost_price || 0) * Number(payload.stock_qty || 0));
  if (initValue > 0 && payload.inventory_account_id && payload.counter_account_id) {
    await submitTransaction(
      {
        org_id: payload.org_id,
        reference_no: `STK-INIT-${String(payload.sku).trim().toUpperCase()}`,
        description: `Stok Awal Produk ${payload.name} (${payload.stock_qty} unit)`,
        status: 'POSTED',
        lines: [
          { account_id: payload.inventory_account_id, debit: initValue, credit: 0 },
          { account_id: payload.counter_account_id, debit: 0, credit: initValue }
        ]
      },
      { mode: 'live' }
    );
  }
  return product;
}

export async function recordStockMovement(payload, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (useDemo) {
    return adjustDemoProductStock(payload);
  }

  const {
    org_id,
    product,
    movement_type,
    qty,
    unit_cost,
    inventory_account_id,
    counter_account_id,
    note = ''
  } = payload;

  const cleanQty = Number(qty || 0);
  if (cleanQty <= 0) throw new Error('Jumlah unit harus lebih dari 0.');
  if (movement_type === 'OUT' && Number(product.stock_qty) < cleanQty) {
    throw new Error(`Stok tidak mencukupi (tersedia ${product.stock_qty} unit).`);
  }

  const cost = Number(unit_cost >= 0 ? unit_cost : product.cost_price);
  const totalValue = roundMoney(cleanQty * cost);
  const isInbound = movement_type === 'PURCHASE' || movement_type === 'IN';

  let newQty = isInbound
    ? Number(product.stock_qty) + cleanQty
    : Number(product.stock_qty) - cleanQty;
  let newCost = Number(product.cost_price);
  if (isInbound && newQty > 0 && cost > 0) {
    newCost = roundMoney((Number(product.stock_qty) * Number(product.cost_price) + totalValue) / newQty);
  }

  if (totalValue > 0 && inventory_account_id && counter_account_id) {
    const lines = isInbound
      ? [
          { account_id: inventory_account_id, debit: totalValue, credit: 0 },
          { account_id: counter_account_id, debit: 0, credit: totalValue }
        ]
      : [
          { account_id: counter_account_id, debit: totalValue, credit: 0 },
          { account_id: inventory_account_id, debit: 0, credit: totalValue }
        ];

    const label =
      movement_type === 'PURCHASE'
        ? 'Pembelian Stok'
        : movement_type === 'IN'
          ? 'Penyesuaian Stok Masuk'
          : 'Penyesuaian / Pemakaian Stok';

    await submitTransaction(
      {
        org_id,
        reference_no: `STK-${product.sku}`,
        description: `${label}: ${product.name} (${cleanQty} unit)${note ? ` — ${note}` : ''}`,
        status: 'POSTED',
        lines
      },
      { mode: 'live' }
    );
  }

  return updateLiveProductStock(product.id, newQty, newCost);
}

/**
 * Pure Income Statement (Laba Rugi) computation.
 */
export function computeIncomeStatement(accounts = []) {
  const revenues = accounts
    .filter((a) => a.category === 'REVENUE')
    .sort((a, b) => a.code.localeCompare(b.code));
  const cogs = accounts
    .filter((a) => a.category === 'COGS')
    .sort((a, b) => a.code.localeCompare(b.code));
  const expenses = accounts
    .filter((a) => a.category === 'EXPENSE')
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalRevenue = roundMoney(revenues.reduce((s, a) => s + Number(a.balance || 0), 0));
  const totalCogs = roundMoney(cogs.reduce((s, a) => s + Number(a.balance || 0), 0));
  const grossProfit = roundMoney(totalRevenue - totalCogs);
  const totalExpenses = roundMoney(expenses.reduce((s, a) => s + Number(a.balance || 0), 0));
  const netProfit = roundMoney(grossProfit - totalExpenses);

  return {
    revenues,
    cogs,
    expenses,
    totalRevenue,
    totalCogs,
    grossProfit,
    totalExpenses,
    netProfit,
    grossMarginPct: calculateMarginPercentage(grossProfit, totalRevenue),
    netMarginPct: calculateMarginPercentage(netProfit, totalRevenue)
  };
}

/**
 * Pure Balance Sheet (Neraca) computation:
 * Assets === Liabilities + Equity + Current Period Net Profit
 */
export function computeBalanceSheet(accounts = [], currentNetProfit = null) {
  const incomeStmt =
    currentNetProfit === null ? computeIncomeStatement(accounts) : null;
  const netProfit =
    currentNetProfit !== null ? roundMoney(currentNetProfit) : incomeStmt.netProfit;

  const assets = accounts
    .filter((a) => a.category === 'ASSET')
    .sort((a, b) => a.code.localeCompare(b.code));
  const liabilities = accounts
    .filter((a) => a.category === 'LIABILITY')
    .sort((a, b) => a.code.localeCompare(b.code));
  const equities = accounts
    .filter((a) => a.category === 'EQUITY')
    .sort((a, b) => a.code.localeCompare(b.code));

  const totalAssets = roundMoney(assets.reduce((s, a) => s + Number(a.balance || 0), 0));
  const totalLiabilities = roundMoney(
    liabilities.reduce((s, a) => s + Number(a.balance || 0), 0)
  );
  const totalEquityBase = roundMoney(
    equities.reduce((s, a) => s + Number(a.balance || 0), 0)
  );
  const totalEquity = roundMoney(totalEquityBase + netProfit);
  const totalLiabilitiesAndEquity = roundMoney(totalLiabilities + totalEquity);
  const difference = roundMoney(Math.abs(totalAssets - totalLiabilitiesAndEquity));

  return {
    assets,
    liabilities,
    equities,
    currentEarnings: netProfit,
    totalAssets,
    totalLiabilities,
    totalEquityBase,
    totalEquity,
    totalLiabilitiesAndEquity,
    difference,
    isBalancedSheet: difference === 0
  };
}

/**
 * Pure Trial Balance (Neraca Saldo) computation from active CoA balances.
 */
export function computeTrialBalance(accounts = []) {
  const rows = [...accounts]
    .sort((a, b) => String(a.code).localeCompare(String(b.code)))
    .map((acc) => {
      const bal = roundMoney(Number(acc.balance || 0));
      let debit = 0;
      let credit = 0;

      if (acc.normal_balance === 'DEBIT') {
        if (bal >= 0) debit = bal;
        else credit = Math.abs(bal);
      } else {
        if (bal >= 0) credit = bal;
        else debit = Math.abs(bal);
      }

      return {
        id: acc.id,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normal_balance: acc.normal_balance,
        balance: bal,
        debit,
        credit
      };
    });

  const totalDebit = roundMoney(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = roundMoney(rows.reduce((s, r) => s + r.credit, 0));
  const difference = roundMoney(Math.abs(totalDebit - totalCredit));

  return {
    rows,
    totalDebit,
    totalCredit,
    difference,
    isBalanced: difference === 0
  };
}

export function exportCsv(filename, headers, rows) {
  const escapeCell = (val) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(','))
  ];

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function getNormalBalanceForCategory(category) {
  return ['ASSET', 'COGS', 'EXPENSE'].includes(String(category || '').toUpperCase())
    ? 'DEBIT'
    : 'CREDIT';
}

export async function createOrganizationWithPreset(payload, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (!String(payload?.name || '').trim()) {
    throw new Error('Nama bisnis / organisasi wajib diisi.');
  }

  if (useDemo) {
    return createDemoOrganization(payload);
  }

  const preset = BUSINESS_PRESETS[payload.business_type] || BUSINESS_PRESETS.retail;
  const org = await createLiveOrganization({
    name: payload.name,
    currency: payload.currency || 'IDR',
    tax_rate:
      payload.tax_rate !== undefined && payload.tax_rate !== ''
        ? Number(payload.tax_rate)
        : preset.defaultTaxRate
  });

  // Seed extra CoA accounts & starter products best-effort on live Supabase
  const snap = await fetchOrganizationSnapshot(org.id);
  const existingCodes = new Set((snap.accounts || []).map((a) => a.code));

  for (const acc of preset.extraAccounts || []) {
    if (existingCodes.has(acc.code)) continue;
    try {
      await createLiveAccount({
        org_id: org.id,
        code: acc.code,
        name: acc.name,
        category: acc.category,
        normal_balance: acc.normal_balance
      });
    } catch {
      // Ignore duplicate or permission race on optional preset accounts
    }
  }

  for (const prod of preset.starterProducts || []) {
    try {
      await createLiveProduct({
        org_id: org.id,
        sku: prod.sku,
        name: prod.name,
        cost_price: prod.cost_price,
        sell_price: prod.sell_price,
        stock_qty: prod.stock_qty
      });
    } catch {
      // Ignore duplicate SKU if already created
    }
  }

  const initCapital = roundMoney(payload.opening_capital || 0);
  if (initCapital > 0) {
    const bankAcc = (snap.accounts || []).find((a) => a.code === '1102');
    const equityAcc = (snap.accounts || []).find((a) => a.code === '3101');
    if (bankAcc && equityAcc) {
      await submitTransaction(
        {
          org_id: org.id,
          reference_no: 'OPEN-CAP-01',
          description: `Setoran Modal Awal — ${org.name}`,
          status: 'POSTED',
          lines: [
            { account_id: bankAcc.id, debit: initCapital, credit: 0 },
            { account_id: equityAcc.id, debit: 0, credit: initCapital }
          ]
        },
        { mode: 'live' }
      );
    }
  }

  return org;
}

export async function updateOrganizationProfile(orgId, updates, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (useDemo) {
    return updateDemoOrganizationProfile(orgId, updates);
  }
  return updateLiveOrganization(orgId, updates);
}

export async function createCoaAccount(payload, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  const cleanCode = String(payload.code || '').trim().toUpperCase();
  const cleanName = String(payload.name || '').trim();
  const category = String(payload.category || '').toUpperCase();
  if (!cleanCode || !cleanName) {
    throw new Error('Kode dan nama akun CoA wajib diisi.');
  }
  if (!['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'EXPENSE'].includes(category)) {
    throw new Error('Kategori akun tidak valid.');
  }

  const normal_balance = payload.normal_balance || getNormalBalanceForCategory(category);

  if (useDemo) {
    return addDemoAccount({
      ...payload,
      code: cleanCode,
      name: cleanName,
      category,
      normal_balance
    });
  }

  const created = await createLiveAccount({
    org_id: payload.org_id,
    code: cleanCode,
    name: cleanName,
    category,
    normal_balance
  });

  const openBal = roundMoney(payload.opening_balance || 0);
  if (openBal > 0 && payload.counter_account_id) {
    const lines =
      normal_balance === 'DEBIT'
        ? [
            { account_id: created.id, debit: openBal, credit: 0 },
            { account_id: payload.counter_account_id, debit: 0, credit: openBal }
          ]
        : [
            { account_id: payload.counter_account_id, debit: openBal, credit: 0 },
            { account_id: created.id, debit: 0, credit: openBal }
          ];

    await submitTransaction(
      {
        org_id: payload.org_id,
        reference_no: `COA-OPEN-${cleanCode}`,
        description: `Saldo Awal Akun ${cleanCode} ${cleanName}`,
        status: 'POSTED',
        lines
      },
      { mode: 'live' }
    );
  }

  return created;
}

export async function fetchAuditLogs(orgId, options = {}) {
  const useDemo =
    options.mode === 'demo' || (options.mode !== 'live' && isDemoMode());

  if (useDemo) {
    return getDemoAuditLogs(orgId);
  }
  return fetchLiveAuditLogs(orgId, options.limit || 100);
}


