# Kronos Ledger — Multi-Tenant Cloud Accounting & Mini-ERP

Aplikasi akuntansi *double-entry* berbasis web yang dibangun dengan arsitektur **Zero-Build Vanilla Stack** (HTML5, Tailwind CSS CDN, ES6+ JavaScript modular) dan backend **Supabase PostgreSQL** (Row Level Security, Database Triggers, & Accounting RPC).

## Fitur Utama

- **Bento Dashboard (`index.html`):** Likuiditas kas & bank, konversi tampilan `IDR`/`USD`, laba bersih, rincian beban operasional, target omzet bulanan, serta pengajuan & approval jurnal.
- **Buku Besar & Jurnal Umum (`ledger.html`):** Filter akun CoA & status (`POSTED`, `PENDING`, `VOID`), pencarian, *expand/collapse* rincian Debit/Kredit, aksi *Approve* / *Void*, dan validasi ketat `Total Debit === Total Kredit`.
- **Invoice & Piutang (`invoices.html` & `invoice-view.html`):** Pembuatan invoice dengan kalkulasi diskon/pajak otomatis, pencatatan pelunasan *double-entry*, dan tampilan cetak PDF bersih.
- **Inventori & HPP (`inventory.html`):** Manajemen SKU, stok minimum, valuasi persediaan, serta pencatatan pembelian & penyesuaian stok yang langsung membentuk jurnal berimbang.
- **Laporan Keuangan (`reports.html`):** Laba Rugi (*Income Statement*), Neraca Ringkas (*Balance Sheet* dengan validasi keseimbangan), Trial Balance (*Neraca Saldo*), Export CSV, dan Cetak.
- **Setup Bisnis, CoA & RBAC (`settings.html`):** Onboarding unit bisnis baru sesuai preset industri (*Jasa & Agensi*, *Retail & Dagang*, *F&B / Kafe*, *Bengkel & Servis*), tambah akun CoA, dan panel tim RBAC (`owner`, `accountant`, `staff`).
- **Audit Log (`audit-logs.html`):** Jejak perubahan kronologis seluruh transaksi dan konfigurasi lengkap dengan detail JSON diff dan ekspor CSV.

## Cara Menjalankan (Mode Demo)

Aplikasi ini dapat langsung dijalankan tanpa konfigurasi database menggunakan **Mode Demo**:

```bash
python3 -m http.server 8080
```

Lalu buka di browser: `http://localhost:8080/index.html?mode=demo`

## Cara Menghubungkan ke Supabase (Mode Live)

Panduan lengkap langkah demi langkah (dari membuat project Supabase, menjalankan 15 file SQL `01`–`15`, mengaktifkan Login/Auth, konfigurasi frontend, hingga deploy) tersedia di **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**.

Ringkasan cepat:
1. **Siapkan Database Supabase:**
   Jalankan seluruh 15 file SQL di folder `supabase/migrations/` secara berurutan (`01_tables.sql` hingga `15_invoice_rpcs_and_permissions.sql`) pada **SQL Editor** project Supabase Anda.
2. **Aktifkan Email Auth:**
   Pastikan provider **Email** aktif di **Authentication → Providers** pada Dashboard Supabase Anda.
3. **Atur Kredensial Frontend (Pilih salah satu):**
   - **Cara A (File Lokal):** Salin `assets/js/config.example.js` menjadi `assets/js/config.js`, lalu isi `SUPABASE_URL` dan `SUPABASE_ANON_KEY` milik Anda (file `config.js` sudah diabaikan oleh `.gitignore`).
   - **Cara B (Langsung di UI):** Klik tombol **Masuk** pada header `index.html`, buka panel **Atur Koneksi**, lalu simpan URL dan Publishable/Anon Key Anda di browser.

## Keamanan

- Tidak ada *service role key*, kredensial pribadi, atau rahasia server di dalam kode frontend.
- Seluruh akses data multi-tenant pada Mode Live dijaga di level database menggunakan PostgreSQL **Row Level Security (RLS)** dan fungsi `SECURITY DEFINER` dengan `SET search_path = public, pg_temp`.
