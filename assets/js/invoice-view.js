// ============================================================================
// KRONOS LEDGER — assets/js/invoice-view.js
// Printable Public / Demo Invoice Viewer (?id=...&mode=demo|live)
// ============================================================================

import { fetchPublicInvoice } from './supabase-client.js';
import { getDemoInvoiceById } from './demo-data.js';
import { formatCurrency } from './accounting.js';
import { escapeHtml, formatDateId, showToast } from './ui-shell.js';

function getParams() {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

function renderInvoiceDocument(data) {
  const { invoice, organization, items = [] } = data;
  const currency = organization?.currency || 'IDR';

  document.title = `${invoice.invoice_number} — ${organization?.name || 'Kronos Ledger'}`;

  document.getElementById('view-org-name').textContent =
    organization?.name || 'Kronos Ledger';
  document.getElementById('view-org-meta').textContent =
    `Dokumen Tagihan Resmi · Mata Uang ${currency}`;

  document.getElementById('view-inv-number').textContent = invoice.invoice_number;
  const statusEl = document.getElementById('view-inv-status');
  const badgeClass =
    invoice.status === 'PAID'
      ? 'badge-paid'
      : invoice.status === 'OVERDUE'
        ? 'badge-overdue'
        : invoice.status === 'DRAFT'
          ? 'badge-draft'
          : 'badge-sent';
  statusEl.className = `status-badge ${badgeClass}`;
  statusEl.textContent = invoice.status;

  document.getElementById('view-client-name').textContent = invoice.client_name || '-';
  document.getElementById('view-client-contact').textContent =
    invoice.client_contact || 'Kontak klien tidak dicantumkan';

  document.getElementById('view-issue-date').textContent = formatDateId(invoice.issue_date);
  document.getElementById('view-due-date').textContent = formatDateId(invoice.due_date);

  const tbody = document.getElementById('view-items-tbody');
  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="py-4 text-xs text-[#6B7280] text-center">
          Rincian item tidak tersedia — total tagihan tertera di bawah.
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = items
      .map(
        (item) => `
        <tr>
          <td class="py-3.5 pr-3 text-xs sm:text-sm font-medium text-[#111827]">${escapeHtml(item.description)}</td>
          <td class="py-3.5 px-3 text-xs sm:text-sm text-right tabular-nums text-[#6B7280]">${escapeHtml(item.qty)}</td>
          <td class="py-3.5 px-3 text-xs sm:text-sm text-right tabular-nums text-[#6B7280] whitespace-nowrap">${escapeHtml(formatCurrency(item.unit_price, currency))}</td>
          <td class="py-3.5 pl-3 text-xs sm:text-sm text-right tabular-nums font-semibold text-[#111827] whitespace-nowrap">${escapeHtml(formatCurrency(item.subtotal, currency))}</td>
        </tr>
      `
      )
      .join('');
  }

  const computedSubtotal =
    Number(invoice.subtotal || 0) ||
    items.reduce((s, it) => s + Number(it.subtotal || 0), 0) ||
    Number(invoice.total_amount || 0);

  const discount = Number(invoice.discount_amount || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total_amount || computedSubtotal);

  document.getElementById('view-subtotal').textContent = formatCurrency(computedSubtotal, currency);

  if (discount > 0) {
    document.getElementById('view-discount-row').classList.remove('hidden');
    document.getElementById('view-discount').textContent = `- ${formatCurrency(discount, currency)}`;
  }

  if (taxAmount > 0) {
    document.getElementById('view-tax-row').classList.remove('hidden');
    document.getElementById('view-tax-label').textContent =
      `Pajak (${Number(invoice.tax_rate || 0)}%)`;
    document.getElementById('view-tax').textContent = formatCurrency(taxAmount, currency);
  }

  document.getElementById('view-total').textContent = formatCurrency(total, currency);

  if (invoice.notes) {
    document.getElementById('view-inv-notes').textContent = invoice.notes;
  }

  document.getElementById('view-doc-id').textContent = `ID: ${invoice.id}`;
}

function showNotFound(msg) {
  document.getElementById('invoice-sheet').classList.add('hidden');
  document.getElementById('invoice-error-card').classList.remove('hidden');
  document.getElementById('invoice-error-text').textContent = msg;
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = getParams();
  const id = params.get('id') || '';
  const mode = params.get('mode') || (id && !id.startsWith('inv-') ? 'live' : 'demo');

  const backLink = document.getElementById('back-to-invoices');
  backLink.setAttribute('href', `invoices.html?mode=${mode === 'live' ? 'live' : 'demo'}`);

  document.getElementById('btn-print-invoice').addEventListener('click', () => {
    window.print();
  });

  document.getElementById('btn-copy-link').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Tautan invoice disalin ke clipboard.');
    } catch {
      showToast('Salin URL langsung dari address bar browser.', 'warning');
    }
  });

  if (mode === 'live' && id) {
    try {
      const result = await fetchPublicInvoice(id);
      if (result && result.invoice) {
        renderInvoiceDocument(result);
        return;
      }
    } catch {
      // Fall through to demo lookup if live fails during preview
    }
  }

  const demoData = getDemoInvoiceById(id);
  if (demoData) {
    renderInvoiceDocument(demoData);
  } else {
    showNotFound('Data invoice tidak ditemukan pada mode saat ini.');
  }
});
