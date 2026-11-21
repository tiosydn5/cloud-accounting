// ============================================================================
// KRONOS LEDGER — assets/js/demo-data.js
// Realistic Multi-Tenant Accounting Demo Store (Double-Entry Consistent)
// ============================================================================

const DEMO_STORAGE_KEY = 'kronos_ledger_demo_state_v3';

export const BUSINESS_PRESETS = {
  service: {
    key: 'service',
    label: 'Jasa & Agensi',
    shortDesc: 'Konsultan, agensi kreatif, software house, dan layanan B2B.',
    defaultTaxRate: 11,
    monthlyTarget: 85000000,
    extraAccounts: [
      { code: '4103', name: 'Pendapatan Retainer Bulanan', category: 'REVENUE', normal_balance: 'CREDIT', is_system: false },
      { code: '6105', name: 'Beban Software & Cloud', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false },
      { code: '6106', name: 'Beban Subkontraktor / Freelance', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false }
    ],
    starterProducts: [
      { sku: 'SVC-AUDIT-01', name: 'Paket Konsultasi & Audit Bulanan', cost_price: 0, sell_price: 7500000, stock_qty: 99, min_stock: 1 },
      { sku: 'SVC-RETAIN-01', name: 'Retainer Desain & Pengembangan Web', cost_price: 0, sell_price: 12000000, stock_qty: 99, min_stock: 1 }
    ]
  },
  retail: {
    key: 'retail',
    label: 'Retail & Dagang',
    shortDesc: 'Toko grosir/eceran, distributor barang, dan e-commerce.',
    defaultTaxRate: 11,
    monthlyTarget: 150000000,
    extraAccounts: [
      { code: '1302', name: 'Perlengkapan Kemasan & Label', category: 'ASSET', normal_balance: 'DEBIT', is_system: false },
      { code: '4103', name: 'Penjualan Marketplace Online', category: 'REVENUE', normal_balance: 'CREDIT', is_system: false },
      { code: '6105', name: 'Biaya Logistik & Pengiriman', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false }
    ],
    starterProducts: [
      { sku: 'RTL-STD-01', name: 'Produk Utama SKU Standar', cost_price: 85000, sell_price: 145000, stock_qty: 40, min_stock: 10 },
      { sku: 'RTL-PREM-02', name: 'Produk Bundling Premium', cost_price: 180000, sell_price: 295000, stock_qty: 15, min_stock: 5 },
      { sku: 'RTL-PACK-03', name: 'Kardus & Segel Pengiriman (Pack)', cost_price: 18000, sell_price: 30000, stock_qty: 8, min_stock: 10 }
    ]
  },
  fnb: {
    key: 'fnb',
    label: 'F&B / Kafe',
    shortDesc: 'Kedai kopi, restoran, katering, dan produksi kuliner.',
    defaultTaxRate: 10,
    monthlyTarget: 95000000,
    extraAccounts: [
      { code: '1302', name: 'Persediaan Bahan Baku & Kemasan', category: 'ASSET', normal_balance: 'DEBIT', is_system: false },
      { code: '4103', name: 'Penjualan Dine-In & Delivery', category: 'REVENUE', normal_balance: 'CREDIT', is_system: false },
      { code: '6105', name: 'Beban Listrik, Air & Gas Dapur', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false }
    ],
    starterProducts: [
      { sku: 'FNB-BEAN-01', name: 'Biji Kopi Arabika House Blend (1 Kg)', cost_price: 165000, sell_price: 260000, stock_qty: 18, min_stock: 6 },
      { sku: 'FNB-MILK-01', name: 'Susu Segar Barista (1 Liter)', cost_price: 21000, sell_price: 35000, stock_qty: 24, min_stock: 10 },
      { sku: 'FNB-CUP-01', name: 'Cup 12oz + Lid Sablon (Slop 50 pcs)', cost_price: 42000, sell_price: 65000, stock_qty: 5, min_stock: 8 }
    ]
  },
  workshop: {
    key: 'workshop',
    label: 'Bengkel & Servis',
    shortDesc: 'Bengkel kendaraan, servis elektronik, dan perbaikan teknis.',
    defaultTaxRate: 11,
    monthlyTarget: 110000000,
    extraAccounts: [
      { code: '1302', name: 'Persediaan Suku Cadang & Oli', category: 'ASSET', normal_balance: 'DEBIT', is_system: false },
      { code: '4103', name: 'Pendapatan Jasa Servis Berkala', category: 'REVENUE', normal_balance: 'CREDIT', is_system: false },
      { code: '6105', name: 'Beban Peralatan & Kalibrasi Bengkel', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false }
    ],
    starterProducts: [
      { sku: 'WKS-OIL-01', name: 'Oli Mesin Full Synthetic 1L', cost_price: 78000, sell_price: 125000, stock_qty: 30, min_stock: 10 },
      { sku: 'WKS-FLT-01', name: 'Filter Oli & Udara OEM', cost_price: 45000, sell_price: 85000, stock_qty: 12, min_stock: 6 },
      { sku: 'WKS-TUNE-01', name: 'Jasa Tune-Up & Diagnostik Standar', cost_price: 0, sell_price: 250000, stock_qty: 99, min_stock: 1 }
    ]
  }
};

/**
 * Helper to build an ISO date string (YYYY-MM-DD) inside the current month
 * so monthly Net Profit & Revenue Target metrics always reflect current month.
 */
function currentMonthDate(dayOffsetFromStart) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const safeDay = Math.min(Math.max(1, dayOffsetFromStart), now.getDate());
  const d = new Date(year, month, safeDay);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildInitialOrganizations() {
  return [
    {
      id: 'demo-org-nusantara',
      name: 'PT Kronos Karya Nusantara',
      sector: 'Retail & Jasa Teknologi UMKM',
      business_type: 'retail',
      currency: 'IDR',
      tax_rate: 0.50,
      role: 'owner',
      monthly_revenue_target: 130000000,
      address: 'Jl. Jenderal Sudirman Kav. 45, Jakarta Selatan 12930',
      phone: '+62 21 5550 8821',
      email: 'finance@kronoskarya.id'
    },
    {
      id: 'demo-org-studio',
      name: 'Kronos Studio Kreatif',
      sector: 'Agensi Desain & Konsultan Digital',
      business_type: 'service',
      currency: 'IDR',
      tax_rate: 0.50,
      role: 'accountant',
      monthly_revenue_target: 75000000,
      address: 'Jl. Dago Pakar Barat No. 18, Bandung 40198',
      phone: '+62 22 4218 9032',
      email: 'hello@kronosstudio.id'
    }
  ];
}

function buildSeedTransactionsByOrg() {
  return {
    'demo-org-nusantara': [
      {
        id: 'tx-n-001',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(1),
        reference_no: 'TRX-2026-001',
        description: 'Setoran Modal Awal Pemilik (Kas & Bank BCA)',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-001a', code: '1102', debit: 85000000, credit: 0 },
          { id: 'jl-n-001b', code: '1101', debit: 15000000, credit: 0 },
          { id: 'jl-n-001c', code: '3101', debit: 0, credit: 100000000 }
        ]
      },
      {
        id: 'tx-n-002',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(2),
        reference_no: 'PO-2026-014',
        description: 'Pembelian Stok Persediaan Barang Secara Kredit',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-002a', code: '1301', debit: 32000000, credit: 0 },
          { id: 'jl-n-002b', code: '2101', debit: 0, credit: 32000000 }
        ]
      },
      {
        id: 'tx-n-003',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(4),
        reference_no: 'PAY-SUP-007',
        description: 'Pelunasan Sebagian Utang Usaha ke Supplier Utama',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-003a', code: '2101', debit: 14500000, credit: 0 },
          { id: 'jl-n-003b', code: '1102', debit: 0, credit: 14500000 }
        ]
      },
      {
        id: 'tx-n-004',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(6),
        reference_no: 'INV-001-PAY',
        description: 'Penjualan Paket Hardware Kasir — PT Sinar Abadi (Lunas + HPP)',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-004a', code: '1102', debit: 48000000, credit: 0 },
          { id: 'jl-n-004b', code: '4101', debit: 0, credit: 48000000 },
          { id: 'jl-n-004c', code: '5101', debit: 19200000, credit: 0 },
          { id: 'jl-n-004d', code: '1301', debit: 0, credit: 19200000 }
        ]
      },
      {
        id: 'tx-n-005',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(9),
        reference_no: 'INV-002-AR',
        description: 'Pengakuan Piutang Jasa Implementasi ERP — CV Maju Jaya',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-005a', code: '1201', debit: 28500000, credit: 0 },
          { id: 'jl-n-005b', code: '4102', debit: 0, credit: 28500000 }
        ]
      },
      {
        id: 'tx-n-006',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(11),
        reference_no: 'INV-003-PAY',
        description: 'Penjualan Perangkat POS Tunai — Toko Berkah Jaya (+ HPP)',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-006a', code: '1101', debit: 18500000, credit: 0 },
          { id: 'jl-n-006b', code: '4101', debit: 0, credit: 18500000 },
          { id: 'jl-n-006c', code: '5101', debit: 7400000, credit: 0 },
          { id: 'jl-n-006d', code: '1301', debit: 0, credit: 7400000 }
        ]
      },
      {
        id: 'tx-n-007',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(13),
        reference_no: 'PAYROLL-01',
        description: 'Pembayaran Gaji Tim Operasional & Teknisi Lapangan',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-007a', code: '6102', debit: 16000000, credit: 0 },
          { id: 'jl-n-007b', code: '1102', debit: 0, credit: 16000000 }
        ]
      },
      {
        id: 'tx-n-008',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(15),
        reference_no: 'INV-004-AR',
        description: 'Pengakuan Piutang Jasa Konsultasi — PT Bintang Timur',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-008a', code: '1201', debit: 14000000, credit: 0 },
          { id: 'jl-n-008b', code: '4102', debit: 0, credit: 14000000 }
        ]
      },
      {
        id: 'tx-n-009',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(16),
        reference_no: 'MKT-ADS-04',
        description: 'Kampanye Iklan Digital & Akuisisi Klien B2B',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-009a', code: '6104', debit: 4800000, credit: 0 },
          { id: 'jl-n-009b', code: '1102', debit: 0, credit: 4800000 }
        ]
      },
      {
        id: 'tx-n-010',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(18),
        reference_no: 'OPEX-UTIL-02',
        description: 'Biaya Sewa Kerja, Perlengkapan Kantor, Listrik & Internet',
        status: 'POSTED',
        lines: [
          { id: 'jl-n-010a', code: '6101', debit: 3600000, credit: 0 },
          { id: 'jl-n-010b', code: '6103', debit: 1450000, credit: 0 },
          { id: 'jl-n-010c', code: '1101', debit: 0, credit: 5050000 }
        ]
      },
      {
        id: 'tx-n-011',
        org_id: 'demo-org-nusantara',
        tx_date: currentMonthDate(19),
        reference_no: 'REQ-STAFF-09',
        description: 'Pengajuan Staff: Biaya Kurir & Kemasan Pengiriman Unit',
        status: 'PENDING',
        lines: [
          { id: 'jl-n-011a', code: '6101', debit: 950000, credit: 0 },
          { id: 'jl-n-011b', code: '1101', debit: 0, credit: 950000 }
        ]
      }
    ],
    'demo-org-studio': [
      {
        id: 'tx-s-001',
        org_id: 'demo-org-studio',
        tx_date: currentMonthDate(1),
        reference_no: 'STD-CAP-01',
        description: 'Modal Kerja Awal Agensi Kreatif',
        status: 'POSTED',
        lines: [
          { id: 'jl-s-001a', code: '1102', debit: 45000000, credit: 0 },
          { id: 'jl-s-001b', code: '1101', debit: 6500000, credit: 0 },
          { id: 'jl-s-001c', code: '3101', debit: 0, credit: 51500000 }
        ]
      },
      {
        id: 'tx-s-002',
        org_id: 'demo-org-studio',
        tx_date: currentMonthDate(5),
        reference_no: 'STD-INV-101',
        description: 'Pelunasan Retainer Branding & UI/UX — Kopi Merapi',
        status: 'POSTED',
        lines: [
          { id: 'jl-s-002a', code: '1102', debit: 36000000, credit: 0 },
          { id: 'jl-s-002b', code: '4102', debit: 0, credit: 36000000 }
        ]
      },
      {
        id: 'tx-s-003',
        org_id: 'demo-org-studio',
        tx_date: currentMonthDate(10),
        reference_no: 'STD-INV-102',
        description: 'Piutang Proyek Website E-Commerce — Batik Sekar',
        status: 'POSTED',
        lines: [
          { id: 'jl-s-003a', code: '1201', debit: 22500000, credit: 0 },
          { id: 'jl-s-003b', code: '4102', debit: 0, credit: 22500000 }
        ]
      },
      {
        id: 'tx-s-004',
        org_id: 'demo-org-studio',
        tx_date: currentMonthDate(14),
        reference_no: 'STD-PAY-02',
        description: 'Gaji Desainer & Developer Freelance',
        status: 'POSTED',
        lines: [
          { id: 'jl-s-004a', code: '6102', debit: 14500000, credit: 0 },
          { id: 'jl-s-004b', code: '1102', debit: 0, credit: 14500000 }
        ]
      },
      {
        id: 'tx-s-005',
        org_id: 'demo-org-studio',
        tx_date: currentMonthDate(17),
        reference_no: 'STD-MKT-03',
        description: 'Biaya Software Cloud, Lisensi Font & Ads Portfolio',
        status: 'POSTED',
        lines: [
          { id: 'jl-s-005a', code: '6101', debit: 3200000, credit: 0 },
          { id: 'jl-s-005b', code: '6104', debit: 2500000, credit: 0 },
          { id: 'jl-s-005c', code: '1102', debit: 0, credit: 5700000 }
        ]
      }
    ]
  };
}

function buildAccountCatalogForOrg(orgId) {
  const baseAccounts = [
    { code: '1101', name: 'Kas Tunai', category: 'ASSET', normal_balance: 'DEBIT', is_system: true },
    { code: '1102', name: 'Bank BCA', category: 'ASSET', normal_balance: 'DEBIT', is_system: true },
    { code: '1201', name: 'Piutang Usaha', category: 'ASSET', normal_balance: 'DEBIT', is_system: true },
    { code: '1301', name: 'Persediaan Barang', category: 'ASSET', normal_balance: 'DEBIT', is_system: true },
    { code: '2101', name: 'Utang Usaha', category: 'LIABILITY', normal_balance: 'CREDIT', is_system: true },
    { code: '3101', name: 'Modal Pemilik', category: 'EQUITY', normal_balance: 'CREDIT', is_system: true },
    { code: '4101', name: 'Penjualan Produk', category: 'REVENUE', normal_balance: 'CREDIT', is_system: true },
    { code: '4102', name: 'Pendapatan Jasa', category: 'REVENUE', normal_balance: 'CREDIT', is_system: true },
    { code: '5101', name: 'Harga Pokok Penjualan (HPP)', category: 'COGS', normal_balance: 'DEBIT', is_system: true },
    { code: '6101', name: 'Beban Operasional', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: true },
    { code: '6102', name: 'Beban Gaji', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false },
    { code: '6103', name: 'Beban Listrik & Internet', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false },
    { code: '6104', name: 'Beban Marketing', category: 'EXPENSE', normal_balance: 'DEBIT', is_system: false }
  ];

  return baseAccounts.map((acc) => ({
    id: `${orgId}-acc-${acc.code}`,
    org_id: orgId,
    code: acc.code,
    name: acc.name,
    category: acc.category,
    normal_balance: acc.normal_balance,
    balance: 0,
    is_system: acc.is_system
  }));
}

function buildSeedProductsByOrg() {
  return {
    'demo-org-nusantara': [
      {
        id: 'prod-n-001',
        org_id: 'demo-org-nusantara',
        sku: 'POS-TERM-01',
        name: 'Terminal Kasir Android Dual Screen',
        cost_price: 1500000,
        sell_price: 2650000,
        stock_qty: 2,
        min_stock: 5
      },
      {
        id: 'prod-n-002',
        org_id: 'demo-org-nusantara',
        sku: 'PRN-THRM-80',
        name: 'Printer Thermal 80mm Auto-Cutter',
        cost_price: 400000,
        sell_price: 750000,
        stock_qty: 4,
        min_stock: 5
      },
      {
        id: 'prod-n-003',
        org_id: 'demo-org-nusantara',
        sku: 'KRT-THRM-80',
        name: 'Kertas Thermal 80x80mm (Pack 10 Roll)',
        cost_price: 20000,
        sell_price: 38000,
        stock_qty: 40,
        min_stock: 10
      }
    ],
    'demo-org-studio': [
      {
        id: 'prod-s-001',
        org_id: 'demo-org-studio',
        sku: 'SVC-BRAND-01',
        name: 'Paket Brand Identity & Guideline',
        cost_price: 0,
        sell_price: 18000000,
        stock_qty: 10,
        min_stock: 2
      },
      {
        id: 'prod-s-002',
        org_id: 'demo-org-studio',
        sku: 'SVC-WEB-01',
        name: 'Pengembangan Website Company Profile',
        cost_price: 0,
        sell_price: 22500000,
        stock_qty: 8,
        min_stock: 2
      }
    ]
  };
}

function buildSeedInvoicesByOrg() {
  const ym = (() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  return {
    'demo-org-nusantara': [
      {
        id: 'inv-n-001',
        org_id: 'demo-org-nusantara',
        invoice_number: `INV/${ym}/001`,
        client_name: 'PT Sinar Abadi',
        client_contact: 'finance@sinarabadi.co.id · 0812-8801-4420',
        issue_date: currentMonthDate(6),
        due_date: currentMonthDate(13),
        subtotal: 48000000,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 48000000,
        status: 'PAID',
        notes: 'Pembayaran diterima via transfer Bank BCA. Garansi perangkat 12 bulan.',
        items: [
          {
            id: 'ii-n-001a',
            product_id: 'prod-n-001',
            description: 'Terminal Kasir Android Dual Screen (Paket Outlet)',
            qty: 15,
            unit_price: 2650000,
            subtotal: 39750000
          },
          {
            id: 'ii-n-001b',
            product_id: 'prod-n-002',
            description: 'Printer Thermal 80mm Auto-Cutter',
            qty: 11,
            unit_price: 750000,
            subtotal: 8250000
          }
        ]
      },
      {
        id: 'inv-n-002',
        org_id: 'demo-org-nusantara',
        invoice_number: `INV/${ym}/002`,
        client_name: 'CV Maju Jaya',
        client_contact: 'accounting@majujaya.id · 0811-2204-919',
        issue_date: currentMonthDate(9),
        due_date: currentMonthDate(25),
        subtotal: 28500000,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 28500000,
        status: 'SENT',
        notes: 'Termin pembayaran 14 hari sejak tanggal terbit. Mohon cantumkan nomor invoice pada berita transfer.',
        items: [
          {
            id: 'ii-n-002a',
            product_id: null,
            description: 'Jasa Implementasi & Migrasi Sistem Akuntansi ERP',
            qty: 1,
            unit_price: 22000000,
            subtotal: 22000000
          },
          {
            id: 'ii-n-002b',
            product_id: null,
            description: 'Pelatihan Tim Finance & Operasional (2 Sesi Onsite)',
            qty: 1,
            unit_price: 6500000,
            subtotal: 6500000
          }
        ]
      },
      {
        id: 'inv-n-003',
        org_id: 'demo-org-nusantara',
        invoice_number: `INV/${ym}/003`,
        client_name: 'Toko Berkah Jaya',
        client_contact: 'owner@berkahjaya.com · 0813-9001-2211',
        issue_date: currentMonthDate(11),
        due_date: currentMonthDate(11),
        subtotal: 18500000,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 18500000,
        status: 'PAID',
        notes: 'Lunas tunai di lokasi saat serah terima perangkat.',
        items: [
          {
            id: 'ii-n-003a',
            product_id: 'prod-n-001',
            description: 'Terminal Kasir Android Dual Screen',
            qty: 6,
            unit_price: 2650000,
            subtotal: 15900000
          },
          {
            id: 'ii-n-003b',
            product_id: 'prod-n-002',
            description: 'Printer Thermal 80mm + Kertas Thermal',
            qty: 1,
            unit_price: 2600000,
            subtotal: 2600000
          }
        ]
      },
      {
        id: 'inv-n-004',
        org_id: 'demo-org-nusantara',
        invoice_number: `INV/${ym}/004`,
        client_name: 'PT Bintang Timur',
        client_contact: 'ap@bintangtimur.co.id · 021-5501-8890',
        issue_date: currentMonthDate(2),
        due_date: currentMonthDate(12),
        subtotal: 14000000,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 14000000,
        status: 'OVERDUE',
        notes: 'Tagihan telah melewati jatuh tempo. Mohon segera lakukan penyelesaian pembayaran.',
        items: [
          {
            id: 'ii-n-004a',
            product_id: null,
            description: 'Audit Infrastruktur Kasir & Konsultasi Integrasi Stok',
            qty: 1,
            unit_price: 14000000,
            subtotal: 14000000
          }
        ]
      }
    ],
    'demo-org-studio': [
      {
        id: 'inv-s-001',
        org_id: 'demo-org-studio',
        invoice_number: `INV/${ym}/101`,
        client_name: 'Kopi Merapi Nusantara',
        client_contact: 'finance@kopimerapi.id · 0812-3310-7788',
        issue_date: currentMonthDate(5),
        due_date: currentMonthDate(12),
        subtotal: 36000000,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 36000000,
        status: 'PAID',
        notes: 'Retainer Q4 Branding & UI/UX Design System telah diterima penuh.',
        items: [
          {
            id: 'ii-s-001a',
            product_id: 'prod-s-001',
            description: 'Paket Brand Identity & Guideline (2 Cabang)',
            qty: 2,
            unit_price: 18000000,
            subtotal: 36000000
          }
        ]
      },
      {
        id: 'inv-s-002',
        org_id: 'demo-org-studio',
        invoice_number: `INV/${ym}/102`,
        client_name: 'Batik Sekar Group',
        client_contact: 'procurement@batiksekar.co.id · 0817-9902-310',
        issue_date: currentMonthDate(10),
        due_date: currentMonthDate(24),
        subtotal: 22500000,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        total_amount: 22500000,
        status: 'SENT',
        notes: 'Pembayaran termin pelunasan proyek website e-commerce.',
        items: [
          {
            id: 'ii-s-002a',
            product_id: 'prod-s-002',
            description: 'Pengembangan Website E-Commerce & Katalog Produk',
            qty: 1,
            unit_price: 22500000,
            subtotal: 22500000
          }
        ]
      }
    ]
  };
}

/**
 * Recompute account balances and hydrate journal line metadata from raw transactions
 * so demo state always obeys the exact PostgreSQL double-entry balance engine.
 */
function hydrateOrgData(orgId, rawAccounts, rawTransactions) {
  const accounts = rawAccounts.map((a) => ({ ...a, balance: 0 }));
  const accountByCode = new Map(accounts.map((a) => [a.code, a]));
  const accountById = new Map(accounts.map((a) => [a.id, a]));

  const transactions = rawTransactions.map((tx) => {
    const hydratedLines = tx.lines.map((line) => {
      const acc = line.account_id
        ? accountById.get(line.account_id)
        : accountByCode.get(line.code);

      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);

      if (acc && tx.status === 'POSTED') {
        const delta =
          acc.normal_balance === 'DEBIT' ? debit - credit : credit - debit;
        acc.balance = Math.round((acc.balance + delta) * 100) / 100;
      }

      return {
        id: line.id,
        transaction_id: tx.id,
        account_id: acc ? acc.id : line.account_id,
        debit,
        credit,
        account_code: acc ? acc.code : line.code,
        account_name: acc ? acc.name : 'Akun Tidak Dikenal',
        account_category: acc ? acc.category : 'EXPENSE'
      };
    });

    return {
      ...tx,
      journal_lines: hydratedLines
    };
  });

  // Sort newest first by date, then newest created_at / insertion sequence
  const txWithOrder = transactions.map((tx, idx) => ({ tx, idx }));
  txWithOrder.sort((a, b) => {
    if (a.tx.tx_date !== b.tx.tx_date) {
      return b.tx.tx_date.localeCompare(a.tx.tx_date);
    }
    const timeA = a.tx.created_at || 0;
    const timeB = b.tx.created_at || 0;
    if (timeA !== timeB) return timeB - timeA;
    return b.idx - a.idx;
  });

  return { accounts, transactions: txWithOrder.map((item) => item.tx) };
}

function buildSeedMembersByOrg() {
  return {
    'demo-org-nusantara': [
      {
        id: 'mem-n-1',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-owner',
        name: 'Dimas Pratama',
        email: 'dimas@kronoskarya.id',
        role: 'owner',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString()
      },
      {
        id: 'mem-n-2',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-acc',
        name: 'Rina Kusuma',
        email: 'rina.acc@kronoskarya.id',
        role: 'accountant',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 42).toISOString()
      },
      {
        id: 'mem-n-3',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-staff',
        name: 'Fajar Hidayat',
        email: 'fajar.ops@kronoskarya.id',
        role: 'staff',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString()
      }
    ],
    'demo-org-studio': [
      {
        id: 'mem-s-1',
        org_id: 'demo-org-studio',
        user_id: 'demo-user-owner-2',
        name: 'Nadia Larasati',
        email: 'nadia@kronosstudio.id',
        role: 'owner',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 50).toISOString()
      },
      {
        id: 'mem-s-2',
        org_id: 'demo-org-studio',
        user_id: 'demo-user-acc-2',
        name: 'Dimas Pratama',
        email: 'dimas@kronoskarya.id',
        role: 'accountant',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString()
      }
    ]
  };
}

function buildSeedAuditLogsByOrg() {
  const now = Date.now();
  const h = 1000 * 60 * 60;
  return {
    'demo-org-nusantara': [
      {
        id: 'aud-n-001',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-staff',
        actor_name: 'Fajar Hidayat (Staff)',
        table_name: 'transactions',
        record_id: 'tx-n-011',
        action: 'INSERT',
        summary: 'Pengajuan jurnal PENDING REQ-STAFF-09 — Biaya Kurir & Kemasan (Rp 950.000)',
        old_data: null,
        new_data: { reference_no: 'REQ-STAFF-09', status: 'PENDING', total: 950000 },
        created_at: new Date(now - 3 * h).toISOString()
      },
      {
        id: 'aud-n-002',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-acc',
        actor_name: 'Rina Kusuma (Accountant)',
        table_name: 'invoices',
        record_id: 'inv-n-001',
        action: 'UPDATE',
        summary: 'Pelunasan invoice INV/001 — PT Sinar Abadi (SENT → PAID)',
        old_data: { status: 'SENT', total_amount: 48000000 },
        new_data: { status: 'PAID', total_amount: 48000000 },
        created_at: new Date(now - 14 * h).toISOString()
      },
      {
        id: 'aud-n-003',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-owner',
        actor_name: 'Dimas Pratama (Owner)',
        table_name: 'products',
        record_id: 'prod-n-001',
        action: 'INSERT',
        summary: 'Pendaftaran stok awal POS-TERM-01 — Paket Terminal Kasir Android',
        old_data: null,
        new_data: { sku: 'POS-TERM-01', stock_qty: 2, cost_price: 1500000 },
        created_at: new Date(now - 36 * h).toISOString()
      },
      {
        id: 'aud-n-004',
        org_id: 'demo-org-nusantara',
        user_id: 'demo-user-owner',
        actor_name: 'Dimas Pratama (Owner)',
        table_name: 'organizations',
        record_id: 'demo-org-nusantara',
        action: 'INSERT',
        summary: 'Inisialisasi organisasi PT Kronos Karya Nusantara & 12 akun CoA standar',
        old_data: null,
        new_data: { name: 'PT Kronos Karya Nusantara', currency: 'IDR', tax_rate: 0.5 },
        created_at: new Date(now - 72 * h).toISOString()
      }
    ],
    'demo-org-studio': [
      {
        id: 'aud-s-001',
        org_id: 'demo-org-studio',
        user_id: 'demo-user-acc-2',
        actor_name: 'Dimas Pratama (Accountant)',
        table_name: 'transactions',
        record_id: 'tx-s-005',
        action: 'INSERT',
        summary: 'Posting jurnal STD-MKT-03 — Biaya Software Cloud & Ads (Rp 5.700.000)',
        old_data: null,
        new_data: { reference_no: 'STD-MKT-03', status: 'POSTED', total: 5700000 },
        created_at: new Date(now - 9 * h).toISOString()
      },
      {
        id: 'aud-s-002',
        org_id: 'demo-org-studio',
        user_id: 'demo-user-owner-2',
        actor_name: 'Nadia Larasati (Owner)',
        table_name: 'organizations',
        record_id: 'demo-org-studio',
        action: 'INSERT',
        summary: 'Inisialisasi organisasi Kronos Studio Kreatif & 12 akun CoA standar',
        old_data: null,
        new_data: { name: 'Kronos Studio Kreatif', currency: 'IDR', tax_rate: 0.5 },
        created_at: new Date(now - 48 * h).toISOString()
      }
    ]
  };
}

function appendDemoAuditLog(orgId, {
  table_name,
  record_id,
  action = 'INSERT',
  summary = '',
  old_data = null,
  new_data = null,
  actor_name = 'Pengguna Demo (Owner)'
}) {
  const store = demoState?.orgData?.[orgId];
  if (!store) return;
  if (!Array.isArray(store.auditLogs)) store.auditLogs = [];
  store.auditLogs.unshift({
    id: `aud-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    org_id: orgId,
    user_id: 'demo-user-active',
    actor_name,
    table_name,
    record_id: String(record_id || '-'),
    action,
    summary,
    old_data,
    new_data,
    created_at: new Date().toISOString()
  });
}

function createFreshDemoState() {
  const organizations = buildInitialOrganizations();
  const txByOrg = buildSeedTransactionsByOrg();
  const invoicesByOrg = buildSeedInvoicesByOrg();
  const productsByOrg = buildSeedProductsByOrg();
  const membersByOrg = buildSeedMembersByOrg();
  const auditLogsByOrg = buildSeedAuditLogsByOrg();
  const orgData = {};

  for (const org of organizations) {
    const baseAccounts = buildAccountCatalogForOrg(org.id);
    const { accounts, transactions } = hydrateOrgData(
      org.id,
      baseAccounts,
      txByOrg[org.id] || []
    );
    orgData[org.id] = {
      accounts,
      transactions,
      invoices: invoicesByOrg[org.id] || [],
      products: productsByOrg[org.id] || [],
      members: membersByOrg[org.id] || [],
      auditLogs: auditLogsByOrg[org.id] || []
    };
  }

  return {
    activeOrgId: organizations[0].id,
    organizations,
    orgData
  };
}

function loadDemoState() {
  try {
    const raw = window.sessionStorage?.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.organizations) && parsed.orgData) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage access errors in restricted frames
  }
  const fresh = createFreshDemoState();
  saveDemoState(fresh);
  return fresh;
}

function saveDemoState(state) {
  try {
    window.sessionStorage?.setItem(DEMO_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

let demoState = loadDemoState();

export function getDemoOrganizations() {
  return demoState.organizations.map((org) => ({ ...org }));
}

export function getDemoSnapshot(orgId) {
  const targetOrg =
    demoState.organizations.find((o) => o.id === orgId) ||
    demoState.organizations[0];

  const store = demoState.orgData[targetOrg.id];
  const catalog =
    Array.isArray(store.accounts) && store.accounts.length > 0
      ? store.accounts
      : buildAccountCatalogForOrg(targetOrg.id);

  const { accounts, transactions } = hydrateOrgData(
    targetOrg.id,
    catalog,
    store.transactions
  );

  store.accounts = accounts;
  return {
    organization: { ...targetOrg },
    accounts: accounts.map((a) => ({ ...a })),
    transactions: transactions.map((t) => ({
      ...t,
      journal_lines: t.journal_lines.map((l) => ({ ...l }))
    })),
    invoices: (store.invoices || []).map((inv) => ({
      ...inv,
      items: (inv.items || []).map((it) => ({ ...it }))
    })),
    products: (store.products || []).map((p) => ({ ...p })),
    members: (store.members || []).map((m) => ({ ...m })),
    auditLogs: (store.auditLogs || []).map((log) => ({ ...log }))
  };
}

export function getDemoInvoiceById(invoiceId) {
  for (const org of demoState.organizations) {
    const store = demoState.orgData[org.id];
    const inv = (store?.invoices || []).find((item) => item.id === invoiceId);
    if (inv) {
      return {
        invoice: { ...inv },
        organization: { ...org },
        items: (inv.items || []).map((it) => ({ ...it }))
      };
    }
  }
  // Fallback to first invoice if id not specified
  const firstOrg = demoState.organizations[0];
  const firstInv = demoState.orgData[firstOrg.id]?.invoices?.[0];
  if (!invoiceId && firstInv) {
    return {
      invoice: { ...firstInv },
      organization: { ...firstOrg },
      items: (firstInv.items || []).map((it) => ({ ...it }))
    };
  }
  return null;
}

export function addDemoTransaction({
  org_id,
  tx_date,
  reference_no,
  description,
  lines,
  status = 'POSTED'
}) {
  const targetOrgId = org_id || demoState.organizations[0].id;
  const store = demoState.orgData[targetOrgId];
  if (!store) {
    throw new Error('Organisasi demo tidak ditemukan.');
  }

  const newTxId = `tx-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const cleanRef =
    reference_no && reference_no.trim()
      ? reference_no.trim()
      : `JRN-${String(store.transactions.length + 1).padStart(3, '0')}`;

  const newTx = {
    id: newTxId,
    org_id: targetOrgId,
    tx_date: tx_date || currentMonthDate(new Date().getDate()),
    reference_no: cleanRef,
    description: description.trim(),
    status,
    created_at: Date.now(),
    lines: lines.map((line, index) => ({
      id: `${newTxId}-l${index + 1}`,
      account_id: line.account_id,
      debit: Number(line.debit || 0),
      credit: Number(line.credit || 0)
    }))
  };

  store.transactions.push(newTx);
  const totalDebit = newTx.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  appendDemoAuditLog(targetOrgId, {
    table_name: 'transactions',
    record_id: newTxId,
    action: 'INSERT',
    summary: `Catat jurnal ${cleanRef} (${status}) — ${newTx.description}`,
    old_data: null,
    new_data: { reference_no: cleanRef, status, total_debit: totalDebit, line_count: newTx.lines.length }
  });
  saveDemoState(demoState);
  return newTxId;
}

export function approveDemoTransaction(orgId, transactionId) {
  const store = demoState.orgData[orgId];
  if (!store) return null;
  const tx = store.transactions.find((t) => t.id === transactionId);
  if (!tx) throw new Error('Transaksi tidak ditemukan.');
  if (tx.status !== 'PENDING') {
    throw new Error('Hanya transaksi berstatus PENDING yang dapat disetujui.');
  }
  const prevStatus = tx.status;
  tx.status = 'POSTED';
  appendDemoAuditLog(orgId, {
    table_name: 'transactions',
    record_id: tx.id,
    action: 'UPDATE',
    summary: `Approve jurnal ${tx.reference_no || tx.id} (${prevStatus} → POSTED)`,
    old_data: { status: prevStatus },
    new_data: { status: 'POSTED' }
  });
  saveDemoState(demoState);
  return tx.id;
}

export function voidDemoTransaction(orgId, transactionId) {
  const store = demoState.orgData[orgId];
  if (!store) return null;
  const tx = store.transactions.find((t) => t.id === transactionId);
  if (!tx) throw new Error('Transaksi tidak ditemukan.');
  if (tx.status === 'VOID') {
    throw new Error('Transaksi sudah berstatus VOID.');
  }
  const prevStatus = tx.status;
  tx.status = 'VOID';
  appendDemoAuditLog(orgId, {
    table_name: 'transactions',
    record_id: tx.id,
    action: 'UPDATE',
    summary: `Void jurnal ${tx.reference_no || tx.id} (${prevStatus} → VOID)`,
    old_data: { status: prevStatus },
    new_data: { status: 'VOID' }
  });
  saveDemoState(demoState);
  return tx.id;
}

function generateDemoInvoiceNumber(store) {
  const now = new Date();
  const prefix = `INV/${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}/`;
  let maxSeq = 0;
  for (const inv of store.invoices || []) {
    if (String(inv.invoice_number || '').startsWith(prefix)) {
      const seq = parseInt(inv.invoice_number.slice(prefix.length), 10);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

function deductDemoStockAndBuildCogs(store, orgId, items) {
  let totalCogs = 0;
  for (const item of items || []) {
    if (!item.product_id) continue;
    const prod = (store.products || []).find((p) => p.id === item.product_id);
    if (!prod) continue;
    const qty = Number(item.qty || 0);
    prod.stock_qty = Number(prod.stock_qty || 0) - qty;
    totalCogs += Math.round(Number(prod.cost_price || 0) * qty * 100) / 100;
  }
  if (totalCogs <= 0) return [];
  return [
    { account_id: `${orgId}-acc-5101`, debit: totalCogs, credit: 0 },
    { account_id: `${orgId}-acc-1301`, debit: 0, credit: totalCogs }
  ];
}

export function createDemoInvoice({
  org_id,
  client_name,
  client_contact = '',
  issue_date,
  due_date,
  items = [],
  discount_amount = 0,
  tax_rate = 0,
  status = 'SENT',
  notes = ''
}) {
  const targetOrgId = org_id || demoState.organizations[0].id;
  const store = demoState.orgData[targetOrgId];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');

  const invoiceNumber = generateDemoInvoiceNumber(store);
  const invId = `inv-demo-${Date.now()}`;
  const cleanItems = items.map((it, idx) => {
    const qty = Number(it.qty || 1);
    const unitPrice = Number(it.unit_price || 0);
    return {
      id: `${invId}-i${idx + 1}`,
      product_id: it.product_id || null,
      description: String(it.description || '').trim(),
      qty,
      unit_price: unitPrice,
      subtotal: Math.round(qty * unitPrice * 100) / 100
    };
  });

  const subtotal = cleanItems.reduce((sum, it) => sum + it.subtotal, 0);
  const discount = Math.min(subtotal, Math.max(0, Number(discount_amount || 0)));
  const taxable = Math.max(0, subtotal - discount);
  const taxAmount = Math.round((taxable * Number(tax_rate || 0)) / 100 * 100) / 100;
  const totalAmount = Math.round((taxable + taxAmount) * 100) / 100;

  const newInv = {
    id: invId,
    org_id: targetOrgId,
    invoice_number: invoiceNumber,
    client_name: String(client_name || '').trim(),
    client_contact: String(client_contact || '').trim(),
    issue_date: issue_date || currentMonthDate(new Date().getDate()),
    due_date: due_date || currentMonthDate(new Date().getDate()),
    subtotal,
    discount_amount: discount,
    tax_rate: Number(tax_rate || 0),
    tax_amount: taxAmount,
    total_amount: totalAmount,
    status,
    notes: String(notes || '').trim(),
    items: cleanItems
  };

  store.invoices.unshift(newInv);

  // Mirror PostgreSQL trigger trg_invoices_accounting
  if (status === 'SENT' || status === 'OVERDUE') {
    const lines = [
      { account_id: `${targetOrgId}-acc-1201`, debit: totalAmount, credit: 0 },
      { account_id: `${targetOrgId}-acc-4101`, debit: 0, credit: totalAmount },
      ...deductDemoStockAndBuildCogs(store, targetOrgId, cleanItems)
    ];
    addDemoTransaction({
      org_id: targetOrgId,
      tx_date: newInv.issue_date,
      reference_no: `${invoiceNumber}-AR`,
      description: `Pengakuan Piutang Invoice ${invoiceNumber} (${newInv.client_name})`,
      lines,
      status: 'POSTED'
    });
  } else if (status === 'PAID') {
    const lines = [
      { account_id: `${targetOrgId}-acc-1102`, debit: totalAmount, credit: 0 },
      { account_id: `${targetOrgId}-acc-4101`, debit: 0, credit: totalAmount },
      ...deductDemoStockAndBuildCogs(store, targetOrgId, cleanItems)
    ];
    addDemoTransaction({
      org_id: targetOrgId,
      tx_date: newInv.issue_date,
      reference_no: `${invoiceNumber}-PAY`,
      description: `Pelunasan Invoice ${invoiceNumber} (${newInv.client_name})`,
      lines,
      status: 'POSTED'
    });
  }

  saveDemoState(demoState);
  return newInv;
}

export function markDemoInvoicePaid(orgId, invoiceId, paymentAccountId) {
  const store = demoState.orgData[orgId];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');
  const inv = (store.invoices || []).find((i) => i.id === invoiceId);
  if (!inv) throw new Error('Invoice tidak ditemukan.');
  if (inv.status === 'PAID') throw new Error('Invoice sudah berstatus PAID.');

  const prevStatus = inv.status;
  inv.status = 'PAID';

  const payAccId = paymentAccountId || `${orgId}-acc-1102`;
  const hasArPosted =
    prevStatus === 'SENT' ||
    prevStatus === 'OVERDUE' ||
    prevStatus === 'PARTIAL' ||
    store.transactions.some(
      (t) => t.reference_no === `${inv.invoice_number}-AR` && t.status === 'POSTED'
    );

  let lines;
  if (hasArPosted) {
    lines = [
      { account_id: payAccId, debit: inv.total_amount, credit: 0 },
      { account_id: `${orgId}-acc-1201`, debit: 0, credit: inv.total_amount }
    ];
  } else {
    lines = [
      { account_id: payAccId, debit: inv.total_amount, credit: 0 },
      { account_id: `${orgId}-acc-4101`, debit: 0, credit: inv.total_amount },
      ...deductDemoStockAndBuildCogs(store, orgId, inv.items)
    ];
  }

  addDemoTransaction({
    org_id: orgId,
    tx_date: currentMonthDate(new Date().getDate()),
    reference_no: `${inv.invoice_number}-PAY`,
    description: `Pelunasan Invoice ${inv.invoice_number} (${inv.client_name})`,
    lines,
    status: 'POSTED'
  });

  saveDemoState(demoState);
  return inv;
}

export function addDemoProduct({
  org_id,
  sku,
  name,
  cost_price,
  sell_price,
  stock_qty = 0,
  min_stock = 5,
  counter_account_id = null
}) {
  const targetOrgId = org_id || demoState.organizations[0].id;
  const store = demoState.orgData[targetOrgId];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');

  const cleanSku = String(sku || '').trim().toUpperCase();
  if (store.products.some((p) => p.sku.toUpperCase() === cleanSku)) {
    throw new Error(`SKU "${cleanSku}" sudah terdaftar.`);
  }

  const product = {
    id: `prod-demo-${Date.now()}`,
    org_id: targetOrgId,
    sku: cleanSku,
    name: String(name || '').trim(),
    cost_price: Number(cost_price || 0),
    sell_price: Number(sell_price || 0),
    stock_qty: Number(stock_qty || 0),
    min_stock: Number(min_stock || 5)
  };

  store.products.unshift(product);

  const initValue = Math.round(product.cost_price * product.stock_qty * 100) / 100;
  if (initValue > 0) {
    const creditAcc = counter_account_id || `${targetOrgId}-acc-3101`;
    addDemoTransaction({
      org_id: targetOrgId,
      tx_date: currentMonthDate(new Date().getDate()),
      reference_no: `STK-INIT-${cleanSku}`,
      description: `Stok Awal Produk ${product.name} (${product.stock_qty} unit)`,
      lines: [
        { account_id: `${targetOrgId}-acc-1301`, debit: initValue, credit: 0 },
        { account_id: creditAcc, debit: 0, credit: initValue }
      ],
      status: 'POSTED'
    });
  }

  saveDemoState(demoState);
  return product;
}

export function adjustDemoProductStock({
  org_id,
  product_id,
  movement_type,
  qty,
  unit_cost,
  counter_account_id,
  note = ''
}) {
  const store = demoState.orgData[org_id];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');
  const prod = (store.products || []).find((p) => p.id === product_id);
  if (!prod) throw new Error('Produk tidak ditemukan.');

  const cleanQty = Number(qty || 0);
  if (cleanQty <= 0) throw new Error('Jumlah unit harus lebih dari 0.');

  const cost = Number(unit_cost >= 0 ? unit_cost : prod.cost_price);
  const totalValue = Math.round(cleanQty * cost * 100) / 100;

  if (movement_type === 'OUT' && prod.stock_qty < cleanQty) {
    throw new Error(`Stok tidak mencukupi (tersedia ${prod.stock_qty} unit).`);
  }

  if (movement_type === 'PURCHASE' || movement_type === 'IN') {
    const prevVal = prod.stock_qty * prod.cost_price;
    const newQty = prod.stock_qty + cleanQty;
    if (newQty > 0 && cost > 0) {
      prod.cost_price = Math.round(((prevVal + totalValue) / newQty) * 100) / 100;
    }
    prod.stock_qty = newQty;
  } else {
    prod.stock_qty = prod.stock_qty - cleanQty;
  }

  if (totalValue > 0) {
    const invAcc = `${org_id}-acc-1301`;
    const isInbound = movement_type === 'PURCHASE' || movement_type === 'IN';
    const counterAcc =
      counter_account_id ||
      (isInbound ? `${org_id}-acc-1102` : `${org_id}-acc-5101`);

    const lines = isInbound
      ? [
          { account_id: invAcc, debit: totalValue, credit: 0 },
          { account_id: counterAcc, debit: 0, credit: totalValue }
        ]
      : [
          { account_id: counterAcc, debit: totalValue, credit: 0 },
          { account_id: invAcc, debit: 0, credit: totalValue }
        ];

    const label =
      movement_type === 'PURCHASE'
        ? 'Pembelian Stok'
        : movement_type === 'IN'
          ? 'Penyesuaian Stok Masuk'
          : 'Penyesuaian / Pemakaian Stok';

    addDemoTransaction({
      org_id,
      tx_date: currentMonthDate(new Date().getDate()),
      reference_no: `STK-${prod.sku}-${String(store.transactions.length + 1).padStart(2, '0')}`,
      description: `${label}: ${prod.name} (${cleanQty} unit)${note ? ` — ${note}` : ''}`,
      lines,
      status: 'POSTED'
    });
  }

  appendDemoAuditLog(org_id, {
    table_name: 'products',
    record_id: prod.id,
    action: 'UPDATE',
    summary: `Mutasi stok ${movement_type} ${prod.sku} (${cleanQty} unit) → stok kini ${prod.stock_qty}`,
    old_data: { sku: prod.sku },
    new_data: { sku: prod.sku, stock_qty: prod.stock_qty, cost_price: prod.cost_price }
  });

  saveDemoState(demoState);
  return prod;
}

export function createDemoOrganization({
  name,
  business_type = 'retail',
  currency = 'IDR',
  tax_rate,
  address = '',
  phone = '',
  email = '',
  monthly_revenue_target,
  opening_capital = 0
}) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new Error('Nama bisnis / organisasi wajib diisi.');

  const preset = BUSINESS_PRESETS[business_type] || BUSINESS_PRESETS.retail;
  const orgId = `demo-org-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const resolvedTax =
    tax_rate !== undefined && tax_rate !== null && tax_rate !== ''
      ? Number(tax_rate)
      : preset.defaultTaxRate;

  const org = {
    id: orgId,
    name: cleanName,
    sector: preset.label,
    business_type: preset.key,
    currency: currency || 'IDR',
    tax_rate: resolvedTax,
    role: 'owner',
    monthly_revenue_target: Number(monthly_revenue_target || preset.monthlyTarget),
    address: String(address || '').trim(),
    phone: String(phone || '').trim(),
    email: String(email || '').trim()
  };

  // Build base CoA + business-type preset extra CoA
  const baseCatalog = buildAccountCatalogForOrg(orgId);
  const existingCodes = new Set(baseCatalog.map((a) => a.code));
  const extraCatalog = (preset.extraAccounts || [])
    .filter((a) => !existingCodes.has(a.code))
    .map((a) => ({
      id: `${orgId}-acc-${a.code}`,
      org_id: orgId,
      code: a.code,
      name: a.name,
      category: a.category,
      normal_balance: a.normal_balance,
      balance: 0,
      is_system: false
    }));

  const fullCatalog = [...baseCatalog, ...extraCatalog].sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  // Starter products
  const products = (preset.starterProducts || []).map((p, idx) => ({
    id: `${orgId}-prod-${idx + 1}`,
    org_id: orgId,
    sku: p.sku,
    name: p.name,
    cost_price: Number(p.cost_price || 0),
    sell_price: Number(p.sell_price || 0),
    stock_qty: Number(p.stock_qty || 0),
    min_stock: Number(p.min_stock || 5)
  }));

  const transactions = [];
  const initCapital = Math.round(Number(opening_capital || 0) * 100) / 100;
  const initStockValue = products.reduce(
    (sum, p) => sum + Number(p.cost_price || 0) * Number(p.stock_qty || 0),
    0
  );

  if (initCapital > 0 || initStockValue > 0) {
    const lines = [];
    if (initCapital > 0) {
      lines.push({
        id: `${orgId}-init-l1`,
        account_id: `${orgId}-acc-1102`,
        debit: initCapital,
        credit: 0
      });
    }
    if (initStockValue > 0) {
      lines.push({
        id: `${orgId}-init-l2`,
        account_id: `${orgId}-acc-1301`,
        debit: initStockValue,
        credit: 0
      });
    }
    const totalEquity = Math.round((initCapital + initStockValue) * 100) / 100;
    lines.push({
      id: `${orgId}-init-l3`,
      account_id: `${orgId}-acc-3101`,
      debit: 0,
      credit: totalEquity
    });

    transactions.push({
      id: `${orgId}-tx-init`,
      org_id: orgId,
      tx_date: currentMonthDate(new Date().getDate()),
      reference_no: 'OPEN-CAP-01',
      description: `Modal Awal & Persediaan Pembuka — ${cleanName}`,
      status: 'POSTED',
      created_at: Date.now(),
      lines
    });
  }

  demoState.organizations.push(org);
  demoState.orgData[orgId] = {
    accounts: fullCatalog,
    transactions,
    invoices: [],
    products,
    members: [
      {
        id: `${orgId}-mem-1`,
        org_id: orgId,
        user_id: 'demo-user-active',
        name: 'Pemilik Bisnis (Anda)',
        email: org.email || 'owner@bisnis.id',
        role: 'owner',
        created_at: new Date().toISOString()
      }
    ],
    auditLogs: []
  };

  appendDemoAuditLog(orgId, {
    table_name: 'organizations',
    record_id: orgId,
    action: 'INSERT',
    summary: `Setup bisnis baru "${cleanName}" (Tipe: ${preset.label}, ${fullCatalog.length} akun CoA, ${products.length} produk awal)`,
    old_data: null,
    new_data: {
      name: cleanName,
      business_type: preset.key,
      currency: org.currency,
      tax_rate: org.tax_rate,
      coa_count: fullCatalog.length,
      product_count: products.length
    }
  });

  saveDemoState(demoState);
  return { ...org };
}

export function updateDemoOrganizationProfile(orgId, updates = {}) {
  const org = demoState.organizations.find((o) => o.id === orgId);
  if (!org) throw new Error('Organisasi demo tidak ditemukan.');

  const oldSnap = {
    name: org.name,
    currency: org.currency,
    tax_rate: org.tax_rate,
    address: org.address,
    phone: org.phone,
    email: org.email
  };

  if (updates.name !== undefined && String(updates.name).trim()) {
    org.name = String(updates.name).trim();
  }
  if (updates.business_type && BUSINESS_PRESETS[updates.business_type]) {
    org.business_type = updates.business_type;
    org.sector = BUSINESS_PRESETS[updates.business_type].label;
  }
  if (updates.currency) org.currency = updates.currency;
  if (updates.tax_rate !== undefined && updates.tax_rate !== '') {
    org.tax_rate = Number(updates.tax_rate);
  }
  if (updates.monthly_revenue_target !== undefined && updates.monthly_revenue_target !== '') {
    org.monthly_revenue_target = Number(updates.monthly_revenue_target);
  }
  if (updates.address !== undefined) org.address = String(updates.address).trim();
  if (updates.phone !== undefined) org.phone = String(updates.phone).trim();
  if (updates.email !== undefined) org.email = String(updates.email).trim();

  appendDemoAuditLog(orgId, {
    table_name: 'organizations',
    record_id: orgId,
    action: 'UPDATE',
    summary: `Pembaruan profil organisasi "${org.name}"`,
    old_data: oldSnap,
    new_data: {
      name: org.name,
      currency: org.currency,
      tax_rate: org.tax_rate,
      address: org.address,
      phone: org.phone,
      email: org.email
    }
  });

  saveDemoState(demoState);
  return { ...org };
}

export function addDemoAccount({
  org_id,
  code,
  name,
  category,
  normal_balance,
  opening_balance = 0,
  counter_account_id = null
}) {
  const store = demoState.orgData[org_id];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');

  const cleanCode = String(code || '').trim().toUpperCase();
  const cleanName = String(name || '').trim();
  if (!cleanCode || !cleanName) throw new Error('Kode dan nama akun wajib diisi.');

  const exists = (store.accounts || []).some(
    (a) => a.code.toUpperCase() === cleanCode
  );
  if (exists) throw new Error(`Kode akun ${cleanCode} sudah terdaftar di organisasi ini.`);

  const resolvedNormal =
    normal_balance ||
    (['ASSET', 'COGS', 'EXPENSE'].includes(category) ? 'DEBIT' : 'CREDIT');

  const account = {
    id: `${org_id}-acc-${cleanCode}`,
    org_id,
    code: cleanCode,
    name: cleanName,
    category,
    normal_balance: resolvedNormal,
    balance: 0,
    is_system: false
  };

  store.accounts.push(account);
  store.accounts.sort((a, b) => a.code.localeCompare(b.code));

  appendDemoAuditLog(org_id, {
    table_name: 'accounts',
    record_id: account.id,
    action: 'INSERT',
    summary: `Tambah akun CoA ${cleanCode} — ${cleanName} (${category})`,
    old_data: null,
    new_data: { code: cleanCode, name: cleanName, category, normal_balance: resolvedNormal }
  });

  const openBal = Math.round(Number(opening_balance || 0) * 100) / 100;
  if (openBal > 0) {
    const counterId = counter_account_id || `${org_id}-acc-3101`;
    if (counterId === account.id) {
      throw new Error('Akun lawan saldo awal tidak boleh sama dengan akun baru.');
    }
    const lines =
      resolvedNormal === 'DEBIT'
        ? [
            { account_id: account.id, debit: openBal, credit: 0 },
            { account_id: counterId, debit: 0, credit: openBal }
          ]
        : [
            { account_id: counterId, debit: openBal, credit: 0 },
            { account_id: account.id, debit: 0, credit: openBal }
          ];

    addDemoTransaction({
      org_id,
      tx_date: currentMonthDate(new Date().getDate()),
      reference_no: `COA-OPEN-${cleanCode}`,
      description: `Saldo Awal Akun ${cleanCode} ${cleanName}`,
      lines,
      status: 'POSTED'
    });
  }

  saveDemoState(demoState);
  return { ...account };
}

export function addDemoMember(orgId, { name, email, role = 'staff' }) {
  const store = demoState.orgData[orgId];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');
  const cleanName = String(name || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanName || !cleanEmail) throw new Error('Nama dan email anggota wajib diisi.');
  if (!['owner', 'accountant', 'staff'].includes(role)) {
    throw new Error('Role harus owner, accountant, atau staff.');
  }

  if (!Array.isArray(store.members)) store.members = [];
  if (store.members.some((m) => m.email.toLowerCase() === cleanEmail)) {
    throw new Error('Email anggota sudah terdaftar di organisasi ini.');
  }

  const member = {
    id: `mem-demo-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    org_id: orgId,
    user_id: `demo-user-${Date.now()}`,
    name: cleanName,
    email: cleanEmail,
    role,
    created_at: new Date().toISOString()
  };

  store.members.push(member);
  appendDemoAuditLog(orgId, {
    table_name: 'organization_members',
    record_id: member.id,
    action: 'INSERT',
    summary: `Tambah anggota tim ${cleanName} (${cleanEmail}) sebagai ${role.toUpperCase()}`,
    old_data: null,
    new_data: { name: cleanName, email: cleanEmail, role }
  });
  saveDemoState(demoState);
  return { ...member };
}

export function updateDemoMemberRole(orgId, memberId, newRole) {
  const store = demoState.orgData[orgId];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');
  if (!['owner', 'accountant', 'staff'].includes(newRole)) {
    throw new Error('Role tidak valid.');
  }
  const member = (store.members || []).find((m) => m.id === memberId);
  if (!member) throw new Error('Anggota tidak ditemukan.');

  const prevRole = member.role;
  if (prevRole === newRole) return { ...member };
  member.role = newRole;

  appendDemoAuditLog(orgId, {
    table_name: 'organization_members',
    record_id: member.id,
    action: 'UPDATE',
    summary: `Ubah role ${member.name}: ${prevRole.toUpperCase()} → ${newRole.toUpperCase()}`,
    old_data: { role: prevRole },
    new_data: { role: newRole }
  });
  saveDemoState(demoState);
  return { ...member };
}

export function removeDemoMember(orgId, memberId) {
  const store = demoState.orgData[orgId];
  if (!store) throw new Error('Organisasi demo tidak ditemukan.');
  const idx = (store.members || []).findIndex((m) => m.id === memberId);
  if (idx === -1) throw new Error('Anggota tidak ditemukan.');
  const target = store.members[idx];
  const ownerCount = store.members.filter((m) => m.role === 'owner').length;
  if (target.role === 'owner' && ownerCount <= 1) {
    throw new Error('Organisasi harus memiliki minimal 1 Owner.');
  }
  store.members.splice(idx, 1);

  appendDemoAuditLog(orgId, {
    table_name: 'organization_members',
    record_id: target.id,
    action: 'DELETE',
    summary: `Hapus anggota tim ${target.name} (${target.email})`,
    old_data: { name: target.name, email: target.email, role: target.role },
    new_data: null
  });
  saveDemoState(demoState);
  return true;
}

export function getDemoAuditLogs(orgId) {
  const store = demoState.orgData[orgId];
  return (store?.auditLogs || []).map((log) => ({ ...log }));
}

export function resetDemoState() {
  demoState = createFreshDemoState();
  saveDemoState(demoState);
  return getDemoSnapshot(demoState.organizations[0].id);
}

