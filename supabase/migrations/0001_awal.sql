-- ============================================================================
-- Unit Economics — skema awal
--
-- ⚠️ BELUM PERNAH DIJALANKAN TERHADAP DATABASE SUNGGUHAN.
--
-- Tabel `unit_economics` sudah ADA di project Supabase yang dipakai tim, dibuat
-- lewat dashboard saat builder HTML ditulis. Berkas ini menuliskan bentuk yang
-- SEHARUSNYA — termasuk RLS yang kemungkinan besar belum menyala di sana.
-- Menjalankannya apa adanya di database yang sudah berisi data akan gagal pada
-- `create table`; jalankan bagian per bagian, dan baca peringatan keamanan di
-- bawah lebih dulu.
--
-- Cara memastikan keadaan sekarang ada di docs/INFRASTRUKTUR.md.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Dokumen bersama. Satu tim, satu baris.
--
-- `payload` sengaja `jsonb` dan bukan tiga puluh kolom, dan itu keputusan yang
-- sadar: bentuk dokumen ini masih berubah tiap kali tim menambah asumsi baru,
-- dan tiap perubahan itu akan jadi migrasi tersendiri plus satu jendela waktu
-- di mana bundle statis yang sudah ter-deploy menulis kolom yang belum ada.
-- Aplikasi statis tidak bisa di-deploy serentak dengan migrasinya.
--
-- Yang dibayar untuk itu: database tidak bisa memvalidasi isinya. Karena itu
-- SELURUH pembacaan lewat `bacaDokumen()` di src/contexts/dokumen/domain/migrasi.ts,
-- yang memeriksa tiap field dan tidak pernah melempar.
-- ---------------------------------------------------------------------------
create table if not exists public.unit_economics (
  id          text primary key,
  payload     jsonb       not null,
  updated_at  timestamptz not null default now()
);

comment on table public.unit_economics is
  'Dokumen unit economics bersama. Satu baris per ruang kerja; id default "sos-unit-economics".';
comment on column public.unit_economics.payload is
  'Dokumen utuh (lihat src/contexts/dokumen/domain/dokumen.ts). Dibaca lewat bacaDokumen(), yang menerima bentuk lama maupun baru.';

-- ---------------------------------------------------------------------------
-- Realtime — supaya perubahan anggota tim lain muncul di layar yang lain.
--
-- Tanpa baris ini, `langgananDokumen()` di infrastruktur/awan.ts terpasang
-- dengan sukses dan TIDAK PERNAH menerima apa pun. Itu bentuk kegagalan yang
-- paling sulit dilihat: tidak ada error, cuma dua orang yang saling menimpa
-- karena tidak tahu yang lain sedang menyunting.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.unit_economics;

-- ---------------------------------------------------------------------------
-- ⚠️⚠️ KEAMANAN — BACA SEBELUM MENJALANKAN
--
-- Aplikasi ini TIDAK PUNYA AUTENTIKASI. Anon key ikut dibekukan ke dalam bundle
-- statis, jadi siapa pun yang bisa membuka https://abbas.co.id/perfume bisa
-- membaca — dan MENIMPA — dokumen tim.
--
-- Itu sudah benar sejak builder HTML pertama; port ini tidak memperbaikinya dan
-- tidak memperburuknya. Kebijakan di bawah menyempitkannya sejauh yang bisa
-- dilakukan TANPA login:
--
--   * hanya baris ber-id `sos-unit-economics` yang bisa disentuh, jadi tabel ini
--     tidak bisa dipakai orang lain sebagai penyimpanan gratis;
--   * `delete` tidak diberikan sama sekali — dokumen tidak bisa dihapus, hanya
--     ditimpa, dan menimpa masih meninggalkan `updated_at` yang bergerak.
--
-- Yang TIDAK dilakukannya: menghentikan siapa pun yang tahu URL-nya untuk
-- membaca seluruh struktur biaya, harga jual, dan penawaran supplier. Kalau itu
-- yang perlu dijaga, yang dibutuhkan Supabase Auth — bukan kebijakan yang lebih
-- pintar. Rencananya di docs/HANDOVER.md → "Yang sengaja belum dikerjakan".
-- ---------------------------------------------------------------------------
alter table public.unit_economics enable row level security;

-- Dibungkus `(select …)` supaya Postgres mengevaluasinya sekali per query, bukan
-- sekali per baris. Pada tabel satu baris bedanya nol; ditulis begini karena
-- kebiasaannya yang menular, bukan angkanya.
drop policy if exists "anon boleh membaca dokumen bersama" on public.unit_economics;
create policy "anon boleh membaca dokumen bersama"
  on public.unit_economics for select
  to anon, authenticated
  using (id = 'sos-unit-economics');

drop policy if exists "anon boleh membuat dokumen bersama" on public.unit_economics;
create policy "anon boleh membuat dokumen bersama"
  on public.unit_economics for insert
  to anon, authenticated
  with check (id = 'sos-unit-economics');

-- ⚠️ `update` WAJIB punya `with check`, bukan cuma `using`. Tanpa `with check`,
-- baris yang lolos `using` boleh diubah menjadi APA PUN — termasuk mengganti
-- `id`-nya, yang memindahkan baris keluar dari jangkauan kebijakan ini dan
-- membuatnya tidak bisa dibaca siapa pun lagi.
drop policy if exists "anon boleh memperbarui dokumen bersama" on public.unit_economics;
create policy "anon boleh memperbarui dokumen bersama"
  on public.unit_economics for update
  to anon, authenticated
  using (id = 'sos-unit-economics')
  with check (id = 'sos-unit-economics');

-- Sengaja TIDAK ada kebijakan `delete`.
