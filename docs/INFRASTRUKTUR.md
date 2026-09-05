# Infrastruktur

## Bentuknya

```
repo ini                 repo portfolio                     hosting
──────────               ──────────────                     ───────
npm run build            public/perfume-app/**              abbas.co.id/perfume
  → out/          ───▶     (bundle statis)          ───▶      (iframe ke
                          app/perfume/page.tsx                 /perfume-app/index.html)
```

Pola yang sama dipakai `sm-app`, `hr-app`, dan `whitespace-app`. Repo portfolio
yang memiliki rute `/perfume`; repo ini cuma menghasilkan bundle-nya. Itu sebabnya
`basePath` di sini `/perfume-app`, **bukan** `/perfume`.

Backend-nya Supabase, dipanggil **langsung dari browser**. Tidak ada proses server
di mana pun.

## Kenapa export statis

Seluruh perhitungan berjalan di browser. Tidak ada Server Component yang membaca
sesi, tidak ada route handler, tidak ada cookie. Menyalakan proses server berarti
membayar satu mesin untuk menyajikan berkas statis.

`output: "standalone"` sengaja tidak dipakai — ia mematikan `next start`, dan
seluruh probe layar harus menembak server yang disalin manual.

### ⚠️ Konsekuensi yang paling sering terlewat

**`NEXT_PUBLIC_*` dibekukan ke dalam bundle saat `npm run build`.** Mengganti env
di panel hosting tidak melakukan apa pun. Mengganti project Supabase berarti build
ulang dan deploy ulang — bukan restart.

## ⚠️ Tidak ada directory index — berkas hanya hidup di path PERSISNYA

Ini sudah diukur langsung terhadap produksi, bukan diasumsikan:

```
/perfume-app/index.html         → 200
/perfume-app/                   → 404   (X-Powered-By: Next.js)
/sm-app/produksi/index.html     → 200
/sm-app/produksi/               → 404
/perfume/                       → 200   (rute Next milik portfolio)
```

Header `X-Powered-By: Next.js` pada 404-nya yang menjelaskan semuanya:
`abbas.co.id` **bukan** Apache yang menyajikan berkas statis — ia proses Next
milik repo portfolio. Dan **Next menyajikan berkas `public/` hanya pada path
persisnya**: tidak ada `DirectoryIndex`, tidak ada `MultiViews`.

Konsekuensinya, dan ini yang harus dipegang siapa pun yang menyentuh rute:

| | |
| --- | --- |
| Pintu yang dipakai orang | `abbas.co.id/perfume` — rute portfolio yang mem-`iframe` `/perfume-app/index.html` |
| Berpindah tab | **jalan** — navigasi sisi klien, tidak ada permintaan dokumen |
| Tautan langsung ke satu tab | `abbas.co.id/perfume-app/investasi/index.html` — **wajib pakai `/index.html`** |
| `abbas.co.id/perfume-app/investasi/` | **404, selamanya** |

Karena aplikasinya dibungkus `iframe`, address bar pembaca selalu menunjukkan
`abbas.co.id/perfume` apa pun tab yang dibuka — jadi 404 di atas tidak pernah
mengenai jalur yang dipakai sehari-hari. Yang terkena cuma tautan yang diketik
tangan.

> ⚠️ **Jangan coba menambalnya dengan `.htaccess`.** Perilaku ini datang dari
> Next, bukan dari konfigurasi server; `DirectoryIndex` tidak akan dibaca siapa
> pun. Kalau tab benar-benar perlu bisa ditautkan langsung, yang dibutuhkan rute
> sungguhan di repo portfolio — pola yang sudah dipakai `/sm/produksi/` dan
> teman-temannya.

`scripts/serve-build.mjs` berperilaku **persis sama**: hanya path persis, bahkan
akarnya pun tidak dipetakan ke `index.html`. Versi sebelumnya sempat me-resolve
`/foo/` — dan itu membuat seluruh probe layar lulus untuk halaman yang 404 setelah
deploy. **Server uji yang lebih permisif daripada produksi lebih buruk daripada
tidak ada server uji.**

## Prefetch dimatikan, dan itu disengaja

Next 16 memuat-di-muka lewat segment cache: ia meminta
`__next.<sandi>.<segmen>.__PAGE__.txt` — nama berkas **bertitik**. `next build`
menuliskannya sebagai **folder bertingkat** (`__next.<sandi>/<segmen>/__PAGE__.txt`).
Server aplikasi memetakan keduanya; hosting statis tidak bisa, jadi tiap prefetch
mendarat di 404.

Tidak ada yang rusak karenanya — navigasi jatuh ke permintaan biasa — tapi ia
mengisi tab Network dengan 404 merah pada aplikasi yang sehat. Enam halaman ini
kecil dan sudah statis; yang dibeli prefetch di sini nyaris nol. Jadi
`prefetch={false}` di `app-shell.tsx`.

## Supabase

Satu tabel, satu baris:

```sql
unit_economics(id text primary key, payload jsonb, updated_at timestamptz)
```

Skema & kebijakannya di [`supabase/migrations/0001_awal.sql`](../supabase/migrations/0001_awal.sql).

Tabelnya sudah ada — dibuat lewat dashboard saat builder HTML ditulis — dan
berkas SQL itu menuliskan bentuk yang *seharusnya*. Ia **idempoten**: aman
dijalankan utuh berkali-kali terhadap database yang sudah berisi data, dan
diakhiri query pemeriksa yang mencetak keadaan akhirnya.

**Realtime sudah menyala.** Dibuktikan saat migrasi pertama dijalankan: ia
berhenti di `ERROR: 42710 … already member of publication "supabase_realtime"`.
Yang belum dipastikan **RLS**.

> ⚠️ Error itu juga pelajaran yang mahal: di SQL Editor Supabase, satu statement
> yang gagal **membatalkan seluruh sisa skrip**. Blok RLS di bawahnya tidak
> pernah jalan, sementara pesan yang muncul di layar cuma soal publikasi — jadi
> "sudah saya jalankan" dan "RLS menyala" bukan hal yang sama. Percayai query
> pemeriksa di akhir migrasi, bukan tidak-adanya error.

Cara memastikan keadaan sekarang, di SQL Editor Supabase:

```sql
select relname, relrowsecurity from pg_class where relname = 'unit_economics';
select policyname, cmd, qual, with_check from pg_policies where tablename = 'unit_economics';
```

### Yang menjaga dokumen ini, dan yang tidak

Aplikasi ini **tidak punya autentikasi**. Anon key ikut dibekukan ke dalam bundle
statis, jadi siapa pun yang bisa membuka `abbas.co.id/perfume` bisa membaca — dan
menimpa — dokumen tim.

Ini sudah benar sejak builder HTML pertama; port ini tidak memperbaikinya dan
tidak memperburuknya. Yang berubah cuma tempat kuncinya: dulu dua `const` di
tengah `<script>` yang dikomit ke repo publik, sekarang variabel env. Anon key
memang dirancang sampai ke browser dan bukan rahasia — yang menjaga datanya RLS.
Tapi menaruhnya di kode berarti **memutar kunci = menyunting kode**, dan memakai
project uji coba = mengubah berkas yang sedang dipakai tim.

Kebijakan RLS di migrasi menyempitkannya sejauh yang bisa **tanpa login**:

- hanya baris ber-id `sos-unit-economics` yang bisa disentuh, jadi tabel ini tidak
  bisa dipakai orang lain sebagai penyimpanan gratis;
- tidak ada kebijakan `delete` sama sekali — dokumen tidak bisa dihapus, hanya
  ditimpa;
- `update` memakai `with check`, bukan cuma `using`. Tanpa itu, baris yang lolos
  boleh diubah jadi apa pun termasuk `id`-nya — yang memindahkannya keluar dari
  jangkauan kebijakan dan membuatnya tidak bisa dibaca siapa pun lagi.

Yang **tidak** dilakukannya: menghentikan siapa pun yang tahu URL-nya membaca
seluruh struktur biaya, harga jual, dan penawaran supplier. Kalau itu perlu
dijaga, yang dibutuhkan Supabase Auth — bukan kebijakan yang lebih pintar.

> Anon key yang lama masih terbaca di riwayat git repo ini (`referensi/index-lama.html`
> dan commit-commit sebelumnya). Memutarnya di dashboard Supabase adalah kebersihan
> yang murah; ia tidak menutup lubang di atas, tapi ia menutup akses dari salinan
> HTML lama yang mungkin masih tersimpan di laptop orang.

### Riwayat versi — `unit_economics_riwayat`

Karena "yang terakhir menulis menang" (lihat di bawah) berarti satu simpanan
yang salah menimpa PENUH tanpa jejak, migrasi
[`0002_riwayat.sql`](../supabase/migrations/0002_riwayat.sql) menambah tabel
kedua yang menyimpan snapshot versi LAMA sebelum tiap `UPDATE` ke
`unit_economics` — ditulis trigger Postgres (`security definer`), bukan kode
aplikasi, supaya tidak bisa dilewati bug maupun sesi klien yang terputus di
tengah simpan.

Anon/authenticated cuma dapat kebijakan `SELECT` (dibatasi ke `dokumen_id`
yang sama seperti baris utama) — tidak ada `INSERT`/`UPDATE`/`DELETE` untuk
siapa pun; jalur satu-satunya masuk ke tabel ini memang lewat trigger.
Dibaca dari halaman **Riwayat** di aplikasi (tab "Riwayat" di topbar), yang
membandingkan tiap versi dengan `diffDokumen()` (`src/bersama/diff.ts`) dan
menampilkan APA yang berubah, bukan cuma KAPAN.

Migrasi ini **belum otomatis dijalankan** — seperti 0001, ditempel manual ke
SQL Editor Supabase. Sampai dijalankan, tabelnya belum ada dan halaman Riwayat
akan menampilkan daftar kosong (bukan error — `muatRiwayat()` mengembalikan
larik kosong kalau query gagal).

### Konflik: yang terakhir menulis menang

Tidak ada penggabungan. Dua orang yang menyunting kolom berbeda pada saat yang
sama akan saling menimpa seluruh dokumen.

Yang menahan kerusakannya cuma ukuran tim (satu digit) dan langganan realtime,
yang mendorong perubahan orang lain ke layar dalam hitungan detik — sehingga
jendela waktu dua orang memegang versi berbeda tetap pendek.

Realtime butuh tabelnya terdaftar di publikasi `supabase_realtime`, dan di project
ini **sudah** (lihat di atas). Memeriksanya:

```sql
select * from pg_publication_tables
 where pubname = 'supabase_realtime' and tablename = 'unit_economics';
```

> ⚠️ Kalau suatu saat ia dilepas, `langgananDokumen()` **terpasang dengan sukses
> dan tidak pernah menerima apa pun.** Tidak ada error; cuma dua orang yang saling
> menimpa karena tidak tahu yang lain sedang menyunting.
>
> Menambahkannya kembali: jalankan ulang migrasinya. Jangan pakai
> `alter publication … add table` telanjang — ia melempar 42710 pada tabel yang
> sudah terdaftar, dan di SQL Editor kegagalan itu membatalkan sisa skripnya.

### Tanpa Supabase, aplikasi tetap jalan

`npm run dev` dan bundle produksi sama-sama jalan tanpa kredensial. Yang hilang
cuma sinkronisasi tim; dokumennya tetap tersimpan di localStorage dengan kunci
`sos_ue_v1` — **kunci yang sama seperti builder HTML**, supaya orang yang sudah
punya angka di browsernya tidak membuka halaman baru dan mengira datanya hilang.

Statusnya selalu tertulis di topbar: *Tersinkron ke tim*, *Mode lokal*, atau
*Gagal sync — tersimpan lokal*. Status yang bohong lebih buruk daripada tidak ada
status.
