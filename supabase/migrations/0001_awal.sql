-- ============================================================================
-- Unit Economics — skema awal
--
-- Tabel `unit_economics` sudah ADA di project Supabase yang dipakai tim, dibuat
-- lewat dashboard saat builder HTML ditulis. Berkas ini menuliskan bentuk yang
-- SEHARUSNYA, dan ditulis supaya **aman dijalankan utuh berkali-kali** terhadap
-- database yang sudah berisi data:
--
--   * `create table if not exists`      — tabel yang ada dilewati
--   * publikasi realtime dibungkus cek  — lihat catatannya di bawah
--   * `drop policy if exists` sebelum tiap `create policy`
--   * `enable row level security` memang idempoten
--
-- ⚠️ **BACA PERINGATAN KEAMANAN di bawah sebelum menjalankan.** Menyalakan RLS
-- tanpa policy membuat dokumen tim tidak bisa dibaca siapa pun, termasuk tim —
-- jadi jangan jalankan setengah berkas ini.
--
-- Query pemeriksa di bagian paling bawah mencetak keadaan akhirnya.
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
-- Tanpa ini, `langgananDokumen()` di infrastruktur/awan.ts terpasang dengan
-- sukses dan TIDAK PERNAH menerima apa pun. Itu bentuk kegagalan yang paling
-- sulit dilihat: tidak ada error, cuma dua orang yang saling menimpa karena
-- tidak tahu yang lain sedang menyunting.
--
-- ⚠️ Dibungkus pemeriksaan karena `alter publication … add table` TIDAK
-- idempoten: pada tabel yang sudah terdaftar ia melempar 42710, dan di SQL
-- Editor Supabase satu statement yang gagal **membatalkan seluruh sisa skrip**.
-- Itu sudah terjadi sekali di project ini — dan akibatnya bukan error yang
-- terlihat, melainkan seluruh blok RLS di bawah yang tidak pernah jalan
-- sementara pesan yang muncul di layar cuma soal publikasi.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'unit_economics'
  ) then
    alter publication supabase_realtime add table public.unit_economics;
    raise notice 'realtime: unit_economics ditambahkan ke supabase_realtime';
  else
    raise notice 'realtime: unit_economics sudah terdaftar — dilewati';
  end if;
end $$;

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

-- ---------------------------------------------------------------------------
-- ⚠️⚠️ Buang kebijakan LAMA dari dashboard — dan ini bukan kerapian.
--
-- Project ini punya tiga kebijakan yang dibuat lewat dashboard saat builder HTML
-- ditulis:
--
--   Allow anon read    SELECT  role {public}  using (true)
--   Allow anon upsert  INSERT  role {public}  with check (true)
--   Allow anon update  UPDATE  role {public}  using (true), with check NULL
--
-- **Kebijakan di Postgres bersifat OR.** Untuk satu perintah, cukup SATU
-- kebijakan yang meloloskan dan aksesnya diberikan. Jadi selama ketiganya masih
-- hidup, penyempitan ke satu baris di bawah TIDAK BERLAKU SAMA SEKALI — yang
-- menang selalu yang paling longgar.
--
-- Menjalankan migrasi lalu melihat "RLS menyala" karena itu menyesatkan: RLS-nya
-- memang menyala, dan tetap meloloskan segalanya. Itu sebabnya pemeriksa di akhir
-- berkas ini tidak menghitung jumlah kebijakan saja, tapi menuntut tidak ada
-- satu pun yang berpredikat `true`.
--
-- `Allow anon update` yang `with_check`-nya NULL adalah yang paling berbahaya:
-- ia mengizinkan `id` baris diubah jadi apa pun, dan begitu itu terjadi dokumen
-- tim keluar dari jangkauan SELURUH kebijakan dan tidak bisa dibaca siapa pun.
-- ---------------------------------------------------------------------------

-- Pengaman: kalau ada baris ber-id lain, menyempitkan kebijakan akan
-- MENYEMBUNYIKANNYA. Lebih baik migrasi ini berhenti di sini daripada membuat
-- data yang ada jadi tidak terjangkau tanpa satu pun tanda.
do $$
declare
  n_lain int;
  daftar text;
begin
  select count(*), string_agg(quote_literal(id), ', ')
    into n_lain, daftar
    from public.unit_economics
   where id <> 'sos-unit-economics';

  if n_lain > 0 then
    raise exception
      'Ada % baris dengan id selain sos-unit-economics (%). Menyempitkan kebijakan akan membuatnya tidak terjangkau. Putuskan dulu: hapus barisnya, atau longgarkan predikat kebijakan di berkas ini supaya mencakup id tersebut.',
      n_lain, daftar;
  end if;
end $$;

drop policy if exists "Allow anon read"   on public.unit_economics;
drop policy if exists "Allow anon upsert" on public.unit_economics;
drop policy if exists "Allow anon update" on public.unit_economics;

-- Ketiga kebijakan memakai perbandingan literal `id = 'sos-unit-economics'`,
-- bukan pemanggilan fungsi seperti `auth.uid()`. Jadi tidak ada yang perlu
-- dibungkus `(select …)`: yang dibungkus adalah pemanggilan fungsi, supaya
-- Postgres mengevaluasinya sekali per query alih-alih sekali per baris.
-- Disebut di sini karena pola itu wajib begitu ada login — lihat docs/HANDOVER.md.
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

-- ---------------------------------------------------------------------------
-- Pemeriksa — dijalankan terakhir supaya keadaan akhirnya terbaca di layar.
--
-- Ada karena "skripnya jalan tanpa error" bukan hal yang sama dengan "RLS
-- menyala": satu statement yang gagal di tengah membatalkan sisanya, dan pesan
-- yang muncul di layar cuma soal statement itu. Yang dipercaya baris di bawah.
--
-- ⚠️ `jumlah_policy` SENGAJA bukan pemeriksaan utama, dan itu pelajaran yang
-- didapat dengan cara mahal di project ini: jalan pertama menghasilkan
-- `rls_menyala = true` dengan enam kebijakan, tiga di antaranya berpredikat
-- `true` dari dashboard. RLS menyala, dan meloloskan segalanya. Angka enam saja
-- tidak memberi tahu itu.
--
-- Yang benar-benar dijaga `ada_policy_longgar`: kebijakan bersifat OR, jadi satu
-- saja yang berpredikat `true` membatalkan seluruh penyempitan yang lain.
--
-- Yang HARUS terlihat:
--   rls_menyala          = true
--   ada_policy_longgar   = false  ← paling penting
--   ada_policy_public    = false  ← role {public} lebih luas dari {anon,authenticated}
--   jumlah_policy        = 3
--   realtime_terdaftar   = true
--   update_punya_check   = true   ← tanpa ini, id barisnya bisa diubah jadi
--                                   apa pun dan dokumen hilang dari jangkauan
-- ---------------------------------------------------------------------------
select
  (select relrowsecurity
     from pg_class
    where oid = 'public.unit_economics'::regclass)                    as rls_menyala,

  (select coalesce(bool_or(qual = 'true' or with_check = 'true'), false)
     from pg_policies
    where schemaname = 'public' and tablename = 'unit_economics')     as ada_policy_longgar,

  (select coalesce(bool_or(roles::text like '%public%'), false)
     from pg_policies
    where schemaname = 'public' and tablename = 'unit_economics')     as ada_policy_public,

  (select count(*)
     from pg_policies
    where schemaname = 'public' and tablename = 'unit_economics')     as jumlah_policy,

  (select exists (select 1
       from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'unit_economics'))                            as realtime_terdaftar,

  (select coalesce(bool_and(with_check is not null), false)
     from pg_policies
    where schemaname = 'public'
      and tablename = 'unit_economics'
      and cmd = 'UPDATE')                                             as update_punya_check;
