// ============================================================================
// KRONOS LEDGER — assets/js/audit-logs.js
// Chronological Audit Trail Viewer (Demo & Live Supabase audit_logs)
// ============================================================================

import {
  createWorkspaceShell,
  escapeHtml,
  showToast
} from './ui-shell.js';
import {
  fetchAuditLogs,
  exportCsv
} from './accounting.js';

let allLogs = [];
let actionFilter = 'ALL';
let tableFilter = 'ALL';
let searchQuery = '';
const expandedIds = new Set();

const TABLE_LABELS = {
  transactions: 'Jurnal Umum',
  invoices: 'Invoice',
  products: 'Inventori',
  accounts: 'Akun CoA',
  organizations: 'Organisasi',
  organization_members: 'Tim RBAC'
};

function formatDateTimeId(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return String(isoString);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d);
}

function buildAutoSummary(log) {
  if (log.summary) return log.summary;
  const tbl = TABLE_LABELS[log.table_name] || log.table_name;
  const ref =
    log.new_data?.reference_no ||
    log.new_data?.invoice_number ||
    log.new_data?.sku ||
    log.new_data?.code ||
    log.new_data?.name ||
    String(log.record_id || '').slice(0, 8);
  return `${log.action} pada ${tbl} (${ref})`;
}

function getFilteredLogs() {
  const q = searchQuery.trim().toLowerCase();
  return allLogs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (tableFilter !== 'ALL' && log.table_name !== tableFilter) return false;
    if (q) {
      const hay = [
        log.action,
        log.table_name,
        log.record_id,
        log.actor_name,
        log.user_id,
        buildAutoSummary(log),
        JSON.stringify(log.new_data || {}),
        JSON.stringify(log.old_data || {})
      ]
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderKpis() {
  const total = allLogs.length;
  const inserts = allLogs.filter((l) => l.action === 'INSERT').length;
  const updates = allLogs.filter((l) => l.action === 'UPDATE').length;
  const deletes = allLogs.filter((l) => l.action === 'DELETE').length;

  const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };
  setText('kpi-audit-total', total);
  setText('kpi-audit-insert', inserts);
  setText('kpi-audit-update', updates);
  setText('kpi-audit-delete', deletes);
}

function renderLogs() {
  const listEl = document.getElementById('audit-log-list');
  const countEl = document.getElementById('audit-filtered-count');
  if (!listEl) return;

  const filtered = getFilteredLogs();
  if (countEl) countEl.textContent = `${filtered.length} entri`;

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="p-8 text-center text-xs sm:text-sm text-gray-500">
        Belum ada catatan audit yang cocok dengan filter saat ini.
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered
    .map((log) => {
      const isExpanded = expandedIds.has(log.id);
      const badgeClass =
        log.action === 'INSERT'
          ? 'badge-posted'
          : log.action === 'UPDATE'
            ? 'badge-pending'
            : 'badge-void';
      const tableLabel = TABLE_LABELS[log.table_name] || log.table_name;
      const summary = buildAutoSummary(log);
      const actor = log.actor_name || (log.user_id ? `User ${String(log.user_id).slice(0, 8)}` : 'Sistem');

      return `
        <article class="p-4 sm:px-5 hover:bg-gray-50/70 transition">
          <button type="button" data-toggle-audit="${escapeHtml(log.id)}" class="w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="min-w-0 space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="status-badge ${badgeClass}">${escapeHtml(log.action)}</span>
                <span class="text-[11px] font-semibold uppercase tracking-wide text-gray-500 bg-gray-100 rounded-full px-2.5 py-0.5">${escapeHtml(tableLabel)}</span>
                <span class="text-[11px] font-mono text-gray-400">#${escapeHtml(String(log.record_id || '').slice(0, 12))}</span>
              </div>
              <p class="text-xs sm:text-sm font-semibold text-[#14281D] leading-snug">${escapeHtml(summary)}</p>
              <p class="text-[11px] text-gray-500">Oleh: <strong class="text-gray-700">${escapeHtml(actor)}</strong></p>
            </div>
            <div class="flex items-center gap-3 shrink-0 self-start sm:self-center">
              <span class="text-xs text-gray-500 tabular-nums">${escapeHtml(formatDateTimeId(log.created_at))}</span>
              <span class="text-xs font-semibold text-[#14281D]">${isExpanded ? 'Tutup ▲' : 'Detail ▼'}</span>
            </div>
          </button>

          ${
            isExpanded
              ? `
                <div class="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div class="rounded-2xl bg-gray-50 border border-gray-200 p-3">
                    <p class="font-bold text-gray-600 mb-1.5">Data Sebelumnya (old_data)</p>
                    <pre class="text-[11px] font-mono text-gray-700 whitespace-pre-wrap break-all overflow-x-auto">${escapeHtml(
                      log.old_data ? JSON.stringify(log.old_data, null, 2) : '— (Tidak ada / Entri baru)'
                    )}</pre>
                  </div>
                  <div class="rounded-2xl bg-[#F3F4F1] border border-gray-200 p-3">
                    <p class="font-bold text-[#14281D] mb-1.5">Data Terbaru (new_data)</p>
                    <pre class="text-[11px] font-mono text-[#14281D] whitespace-pre-wrap break-all overflow-x-auto">${escapeHtml(
                      log.new_data ? JSON.stringify(log.new_data, null, 2) : '— (Data dihapus)'
                    )}</pre>
                  </div>
                </div>
              `
              : ''
          }
        </article>
      `;
    })
    .join('');
}

const shell = createWorkspaceShell({
  onRender: async (state) => {
    try {
      allLogs = await fetchAuditLogs(state.activeOrgId, { mode: state.mode, limit: 150 });
    } catch (err) {
      allLogs = [];
      showToast(err.message || 'Gagal memuat audit log.', 'error');
    }
    renderKpis();
    renderLogs();
  }
});

function bindEvents() {
  document.querySelectorAll('.audit-action-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      actionFilter = btn.dataset.auditAction;
      document.querySelectorAll('.audit-action-btn').forEach((b) => {
        const active = b.dataset.auditAction === actionFilter;
        b.className = active
          ? 'audit-action-btn rounded-full px-3.5 py-1.5 text-xs font-semibold bg-[#14281D] text-[#9FE870]'
          : 'audit-action-btn rounded-full px-3.5 py-1.5 text-xs font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200';
      });
      renderLogs();
    });
  });

  document.getElementById('audit-table-filter')?.addEventListener('change', (e) => {
    tableFilter = e.target.value || 'ALL';
    renderLogs();
  });

  document.getElementById('audit-search')?.addEventListener('input', (e) => {
    searchQuery = e.target.value || '';
    renderLogs();
  });

  document.getElementById('audit-log-list')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle-audit]');
    if (!btn) return;
    const id = btn.dataset.toggleAudit;
    if (expandedIds.has(id)) expandedIds.delete(id);
    else expandedIds.add(id);
    renderLogs();
  });

  document.getElementById('btn-export-audit')?.addEventListener('click', () => {
    const rows = getFilteredLogs().map((log) => [
      log.created_at,
      log.action,
      log.table_name,
      log.record_id,
      log.actor_name || log.user_id || 'Sistem',
      buildAutoSummary(log)
    ]);
    exportCsv(
      `kronos-audit-logs-${shell.state.activeOrg?.name || 'org'}.csv`,
      ['Waktu', 'Aksi', 'Tabel', 'Record ID', 'Aktor', 'Ringkasan'],
      rows
    );
    showToast('Audit log berhasil diekspor ke CSV.');
  });
}

bindEvents();
shell.bootstrap();
