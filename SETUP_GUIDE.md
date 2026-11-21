# Panduan Instalasi & Setup — Kronos Ledger

Panduan lengkap ini ditujukan bagi pembeli *template*, pengembang, maupun pemilik bisnis yang ingin menjalankan **Kronos Ledger** secara **Mode Demo** maupun terhubung penuh ke database **Supabase (Mode Live)**.

> **Ringkasan Penting:** Anda **tidak perlu menulis kode SQL atau sistem login dari nol**. Seluruh skema database, validasi *double-entry*, Row Level Security (RLS), fungsi RPC akuntansi, dan autentikasi user sudah siap pakai — Anda cukup menjalankan 15 file SQL yang tersedia di `supabase/migrations/` ke project Supabase Anda.

---

## Opsi 1 — Menjalankan Langsung Tanpa Database (Mode Demo)

Jika ingin meninjau seluruh fitur (Dashboard, Buku Besar, Invoice, Inventori, Laporan, Pengaturan CoA, dan Audit Log) tanpa menyiapkan Supabase:

1. Jalankan static HTTP server di folder root proyek (jangan membuka file `.html` langsung via `file://` karena browser memblokir modul ES6):
   ```bash
   # Pilih salah satu:
   python3 -m http.server 8080
   # atau dengan Node.js:
   npx serve . -l 8080
   ```
2. Buka browser dan kunjungi:
   `http://localhost:8080/index.html?mode=demo`
3. Data simulasi akan langsung termuat di `sessionStorage` browser. Gunakan tombol **Reset Demo** di header kanan atas kapan saja untuk mengembalikan data awal.

---

## Opsi 2 — Menghubungkan ke Database Supabase Anda (Mode Live)

### Langkah 1: Buat Project Baru di Supabase
1. Masuk atau daftar akun gratis di [supabase.com](https://supabase.com).
2. Klik **New Project**, tentukan nama project dan region terdekat (misalnya `Singapore`), lalu simpan database password Anda dengan aman.
3. Tunggu hingga status project menjadi **Active**.

### Langkah 2: Jalankan 15 File Migrasi SQL (Wajib Berurutan)
Aplikasi ini **tidak membutuhkan** Anda menulis skema tabel secara manual. Cukup buka menu **SQL Editor → New Query** di Dashboard Supabase Anda, lalu jalankan isi file di folder `supabase/migrations/` satu per satu **dari nomor `01` hingga `15` secara berurutan**:

1. `supabase/migrations/01_tables.sql` — Membuat 9 tabel inti (`organizations`, `organization_members`, `accounts`, `transactions`, `journal_lines`, `products`, `invoices`, `invoice_items`, `audit_logs`)
2. `supabase/migrations/02_indexes_and_rls_helpers.sql` — Index performa, helper RBAC (`is_org_member`, `has_org_role`), & aktivasi RLS
3. `supabase/migrations/03_rls_policies_core.sql` — Kebijakan RLS untuk `organizations`, `organization_members`, `accounts`, `transactions`
4. `supabase/migrations/04_rls_policies_ledger_sales.sql` — Kebijakan RLS untuk `journal_lines`, `products`, `invoices`
5. `supabase/migrations/05_rls_policies_items_audit.sql` — Kebijakan RLS untuk `invoice_items` & `audit_logs`
6. `supabase/migrations/06_org_onboarding_and_coa_seeder.sql` — Auto-assign `owner` & auto-seed 15 akun CoA standar saat organisasi dibuat
7. `supabase/migrations/07_account_integrity_and_guards.sql` — Proteksi akun sistem & konsistensi transaksi
8. `supabase/migrations/08_balance_sync_triggers.sql` — Trigger sinkronisasi saldo akun otomatis
9. `supabase/migrations/09_double_entry_constraints.sql` — Validasi ketat `Total Debit === Total Kredit` di level database
10. `supabase/migrations/10_rpc_post_journal_entry.sql` — RPC `post_double_entry_transaction` & `create_journal_entry`
11. `supabase/migrations/11_rpc_tx_status_workflows.sql` — RPC `approve_pending_transaction` & `void_transaction`
12. `supabase/migrations/12_audit_trail.sql` — Trigger pencatatan otomatis ke `audit_logs`
13. `supabase/migrations/13_invoice_helpers_and_cogs.sql` — Penomoran invoice otomatis & kalkulasi HPP/stok
14. `supabase/migrations/14_invoice_accounting_trigger.sql` — Trigger jurnal otomatis saat status invoice berubah
15. `supabase/migrations/15_invoice_rpcs_and_permissions.sql` — RPC `mark_invoice_paid`, `get_public_invoice`, & izin eksekusi role

> **Tips:** Jika ingin menggunakan Supabase CLI di terminal (opsional), Anda bisa menjalankan `supabase link` lalu `supabase db push` agar seluruh file `01`–`15` otomatis tereksekusi berurutan.

### Langkah 3: Aktifkan Sistem Login (Supabase Auth)
Anda **tidak perlu membuat tabel user/login sendiri**, karena fitur *Daftar Akun* dan *Masuk* memakai **Supabase Auth (`auth.users`)** bawaan:
1. Di Dashboard Supabase, buka menu **Authentication → Providers**.
2. Pastikan provider **Email** dalam status **Enabled**.
3. **Untuk pengujian cepat / kemudahan user baru:**
   - Anda bisa **mematikan** opsi **Confirm email** di bawah pengaturan **Email** jika ingin user baru yang mendaftar langsung bisa login tanpa menunggu email verifikasi.
   - Untuk environment produksi publik, disarankan tetap mengaktifkan **Confirm email** dan menyiapkan **Custom SMTP** agar verifikasi email berjalan lancar.
4. Di menu **Authentication → URL Configuration**, masukkan URL domain hosting Anda ke kolom **Site URL** (misal `http://localhost:8080` untuk lokal, atau `https://domain-anda.com` saat sudah live).

### Langkah 4: Ambil Project URL & Publishable/Anon Key
1. Di Dashboard Supabase, buka **Project Settings → API** (atau **Connect / API Keys**).
2. Salin 2 nilai berikut:
   - **Project URL** (format: `https://xxxxxxxxxxxx.supabase.co`)
   - **Publishable key** (`sb_publishable_...`) atau **anon public key** (`eyJ...`)
   > ⚠️ **PENTING:** **JANGAN PERNAH** memasukkan `service_role` / `secret` key ke file frontend (`config.js` atau browser). Frontend hanya boleh memakai **Publishable / Anon Key**.

### Langkah 5: Hubungkan Frontend ke Supabase (Pilih Cara A atau Cara B)

#### Cara A — File `assets/js/config.js` (Direkomendasikan untuk Hosting/Produksi)
1. Salin file template `assets/js/config.example.js` menjadi `assets/js/config.js`:
   ```bash
   cp assets/js/config.example.js assets/js/config.js
   ```
2. Buka `assets/js/config.js` dan isi kredensial Anda:
   ```js
   export const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
   export const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY';
   ```
3. File `assets/js/config.js` otomatis diabaikan oleh `.gitignore` agar kredensial project Anda tidak ikut ter-push saat commit ke repository publik.

#### Cara B — Langsung via UI Browser (Cocok untuk Testing Cepat)
1. Jalankan aplikasi di browser dan buka `index.html`.
2. Klik tombol **Masuk** di pojok kanan atas (atau tab **Live**).
3. Pada bagian **Koneksi Project Supabase**, klik **Atur Koneksi** (otomatis terbuka jika `config.js` belum diatur).
4. Tempel **Supabase Project URL** dan **Publishable / Anon Key** Anda, lalu klik **Simpan Koneksi** *(tersimpan aman hanya di `localStorage` browser Anda sendiri)*.

### Langkah 6: Buat Akun Admin Pertama & Organisasi Bisnis
1. Di modal **Koneksi Live Supabase** pada `index.html`, pilih tab **Daftar Akun**.
2. Masukkan email dan password (minimal 6 karakter), lalu klik **Daftar Akun Baru**.
3. Setelah masuk (**Masuk ke Live**), form **Buat Organisasi** akan muncul otomatis jika akun Anda belum memiliki bisnis — atau buka halaman `settings.html` lalu klik **+ Setup Bisnis Baru**.
4. Pilih jenis usaha (*Jasa & Agensi*, *Retail & Dagang*, *F&B / Kafe*, atau *Bengkel & Servis*) untuk mengaktifkan 15 akun CoA standar + akun & produk awal sesuai tipe bisnis, dan akun Anda otomatis tercatat sebagai **Owner** di `organization_members`.

---

## Opsi Deploy / Hosting Frontend

Karena aplikasi ini menggunakan **Zero-Build Vanilla Stack** (tanpa Node build step / bundler), Anda bisa men-deploy seluruh folder proyek secara langsung ke hosting statis mana pun:

- **Vercel / Netlify / Cloudflare Pages:** Hubungkan repository atau drag-and-drop folder proyek (Build Command: kosongkan, Output Directory: `.`). Jika menggunakan GitHub publik, pastikan `assets/js/config.js` dibuat di proses deploy atau gunakan UI **Atur Koneksi**.
- **Nginx / Apache / cPanel:** Upload seluruh file (`*.html`, `assets/`, dan tidak perlu upload folder `supabase/` ke public web root jika ingin lebih rapi), pastikan `assets/js/config.js` terisi URL & Anon Key Anda.

---

## Catatan Penggunaan sebagai Template vs SaaS

- **Jika Dijual / Dibagikan sebagai Source Code (Self-Hosted):**
  - Jangan sertakan `assets/js/config.js` pribadi Anda atau folder `.git/`. Gunakan `git archive --format=zip --output=kronos-ledger.zip HEAD` untuk membuat paket ZIP yang bersih.
  - Sertakan panduan `SETUP_GUIDE.md` ini agar pembeli tinggal menjalankan `01`–`15` di akun Supabase mereka sendiri.
- **Jika Dijual sebagai Layanan SaaS (1 Website untuk Banyak Pelanggan):**
  - Anda cukup menjalankan SQL `01`–`15` **satu kali** di project Supabase milik Anda, lalu isi `assets/js/config.js` di hosting Anda (jangan bagikan source code beserta `config.js`).
  - Pelanggan cukup mendaftar lewat halaman web; PostgreSQL **Row Level Security (RLS)** akan mengisolasi data setiap bisnis/organisasi secara otomatis.

---

## Troubleshooting Umum

| Masalah | Penyebab Umum | Solusi |
| :--- | :--- | :--- |
| Halaman blank / error CORS saat dibuka langsung | Membuka file via `file:///.../index.html` | Jalankan lewat web server (`python3 -m http.server 8080` atau Live Server VS Code). |
| Mode selalu kembali ke Demo saat klik Live | `config.js` belum dibuat atau belum login | Isi `assets/js/config.js` (atau isi via **Masuk → Atur Koneksi**) lalu login dengan akun yang terdaftar. |
| Gagal login setelah **Daftar Akun** (*Email not confirmed*) | Opsi *Confirm email* di Supabase Auth masih aktif | Cek kotak masuk/spam untuk klik link verifikasi, atau matikan *Confirm email* di **Authentication → Providers → Email**. |
| Error `function ... does not exist` atau `permission denied` | File migrasi SQL belum lengkap atau urutannya terlewat | Pastikan ke-15 file di `supabase/migrations/` dijalankan berurutan dari `01` hingga `15` tanpa ada yang terlewat. |
| Link `invoice-view.html?id=...` gagal di Mode Live | `id` invoice tidak ada atau bukan UUID valid | Pastikan parameter `?id=<UUID-invoice>` valid; fungsi RPC `get_public_invoice` aman diakses publik hanya dengan UUID yang tepat. |
