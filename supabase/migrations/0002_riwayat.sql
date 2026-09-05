-- ============================================================================
-- Unit Economics — riwayat versi
--
-- Ditambah setelah baris `unit_economics` kehilangan data supplier tanpa jejak:
-- baris itu cuma SATU, ditimpa PENUH tiap simpan, dan sekali tertimpa versi
-- lama tidak bisa ditarik dari mana pun selain localStorage browser orang yang
-- kebetulan belum menimpa miliknya sendiri. Migrasi ini menutup celah itu di
-- level database, bukan mengandalkan disiplin orang yang menyimpan.
--
-- Aman dijalankan berkali-kali, mengikuti konvensi 0001_awal.sql:
--   * `create table if not exists`   — tabel yang ada dilewati
--   * `create or replace function`   — fungsi trigger boleh ditulis ulang
--   * `drop trigger if exists` sebelum `create trigger`
--   * `drop policy if exists` sebelum tiap `create policy`
--
-- Query pemeriksa di bagian paling bawah mencetak keadaan akhirnya.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Snapshot versi SEBELUM tiap UPDATE ke unit_economics.
--
-- `updated_at` di sini adalah stempel baris LAMA (kapan versi itu sendiri
-- ditulis), bukan kapan snapshot ini dibuat — itu `disalin_pada`. Bedanya
-- penting untuk membaca "kapan angka ini sungguh berubah", bukan "kapan saya
-- kebetulan menariknya".
-- ---------------------------------------------------------------------------
create table if not exists public.unit_economics_riwayat (
  id           bigint generated always as identity primary key,
  dokumen_id   text        not null,
  payload      jsonb       not null,
  updated_at   timestamptz not null,
  disalin_pada timestamptz not null default now()
);

comment on table public.unit_economics_riwayat is
  'Snapshot versi SEBELUM tiap UPDATE ke unit_economics, ditulis trigger simpan_riwayat_unit_economics() - bukan kode aplikasi, supaya tidak bisa dilewati bug ataupun sesi klien yang terputus di tengah simpan.';

create index if not exists unit_economics_riwayat_dokumen_id_idx
  on public.unit_economics_riwayat (dokumen_id, disalin_pada desc);

-- ---------------------------------------------------------------------------
-- Trigger function.
--
-- `security definer` supaya INSERT ke tabel riwayat berjalan dengan hak
-- pemilik fungsi (bukan hak anon yang menjalankan UPDATE) — anon karena itu
-- TIDAK butuh kebijakan INSERT tersendiri, dan jalur satu-satunya masuk ke
-- tabel riwayat memang cuma lewat sini, bukan lewat REST.
-- ---------------------------------------------------------------------------
create or replace function public.simpan_riwayat_unit_economics()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.unit_economics_riwayat (dokumen_id, payload, updated_at)
  values (old.id, old.payload, old.updated_at);
  return new;
end;
$$;

comment on function public.simpan_riwayat_unit_economics() is
  'Menyalin baris LAMA unit_economics ke unit_economics_riwayat sebelum UPDATE menimpanya. security definer supaya anon tidak butuh hak INSERT ke tabel riwayat.';

drop trigger if exists riwayat_sebelum_update on public.unit_economics;
create trigger riwayat_sebelum_update
  before update on public.unit_economics
  for each row
  execute function public.simpan_riwayat_unit_economics();

-- ---------------------------------------------------------------------------
-- RLS — baca boleh (dibatasi ke dokumen_id yang sama seperti baris utama),
-- tulis TIDAK diberikan sama sekali ke anon. Satu-satunya penulisnya trigger
-- di atas, yang berjalan sebagai definer dan karena itu tidak tunduk RLS ini.
-- ---------------------------------------------------------------------------
alter table public.unit_economics_riwayat enable row level security;

drop policy if exists "anon boleh membaca riwayat" on public.unit_economics_riwayat;
create policy "anon boleh membaca riwayat"
  on public.unit_economics_riwayat for select
  to anon, authenticated
  using (dokumen_id = 'sos-unit-economics');

-- Sengaja TIDAK ADA kebijakan insert/update/delete untuk anon/authenticated -
-- baris riwayat hanya bisa masuk lewat trigger (security definer), tidak
-- lewat REST siapa pun.

-- ---------------------------------------------------------------------------
-- Pemeriksa
-- ---------------------------------------------------------------------------
select
  (select relrowsecurity
     from pg_class
    where oid = 'public.unit_economics_riwayat'::regclass)                as rls_menyala,

  (select count(*) > 0
     from pg_trigger
    where tgrelid = 'public.unit_economics'::regclass
      and tgname = 'riwayat_sebelum_update')                              as trigger_terpasang,

  (select count(*)
     from pg_policies
    where schemaname = 'public'
      and tablename = 'unit_economics_riwayat'
      and cmd in ('INSERT', 'UPDATE', 'DELETE'))                          as jumlah_policy_tulis_anon, -- harus 0

  (select count(*)
     from pg_policies
    where schemaname = 'public'
      and tablename = 'unit_economics_riwayat'
      and cmd = 'SELECT')                                                 as jumlah_policy_baca; -- harus 1
