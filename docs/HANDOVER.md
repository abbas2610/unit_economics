# Handover

Apa yang ada, apa yang belum, dan apa yang sudah pernah menggigit.

## Dari mana repo ini datang

Sampai port ini, seluruh aplikasi adalah **satu berkas `index.html` 1.990 baris**
— CSS, markup, dan logika biaya dalam satu `<script>`. Berkas itu dibekukan di
[`referensi/index-lama.html`](../referensi/index-lama.html): ia bukan kode yang
dirawat, ia **rujukan angka**. Kalau ada yang bertanya "dulu rumusnya bagaimana",
jawabannya di sana.

Yang dipertahankan: seluruh rumus, seluruh angka default, kunci localStorage
(`sos_ue_v1`), dan bentuk payload Supabase yang sudah dipakai tim. Yang berubah:
strukturnya, dan tampilannya.

**Tidak satu angka pun bergeser.** `probe:hitung` bagian 1 mengunci dua puluh
nilai terhadap builder lama — dan nilai-nilai itu dihitung tangan dari rumus di
berkas HTML, bukan disalin dari keluaran kode baru. Bedanya kunci regresi dan
tautologi: yang kedua lulus apa pun yang dilakukan kodenya.

## Status

| Bagian | Status |
| --- | --- |
| Enam tab, seluruh perhitungan | ✅ jadi, berprobe |
| Migrasi dokumen dari bentuk lama | ✅ jadi, 57 pemeriksaan |
| Design token, tema gelap, palet cetak | ✅ jadi, berprobe |
| Harness probe & CI | ✅ jadi, terbukti jalan lokal |
| Sinkronisasi Supabase | ⚠️ kode jadi. Realtime ✅ menyala. **RLS belum dipastikan** — lihat di bawah |
| Deploy ke abbas.co.id/perfume | ⛔ workflow ditulis, **belum pernah dijalankan** |
| Autentikasi | ⛔ tidak ada, dan itu keputusan — lihat di bawah |

## Yang harus dikerjakan sebelum percaya ini live

Berurutan, dan yang pertama paling penting.

### 1. Pastikan RLS di Supabase

[`supabase/migrations/0001_awal.sql`](../supabase/migrations/0001_awal.sql)
menuliskan bentuk yang **seharusnya**. Tabelnya sudah ada — dibuat lewat
dashboard saat builder HTML ditulis — dan migrasinya ditulis **idempoten**
justru untuk keadaan itu: aman dijalankan utuh berkali-kali.

Periksa keadaan sekarang di SQL Editor:

```sql
select relname, relrowsecurity from pg_class where relname = 'unit_economics';
select policyname, cmd, qual, with_check from pg_policies where tablename = 'unit_economics';
```

Jalankan migrasinya **utuh** — ia idempoten, jadi aman dijalankan berkali-kali
terhadap database yang sudah berisi data. Baca peringatan keamanannya lebih dulu,
dan jangan jalankan setengah berkas.

Migrasi itu diakhiri query pemeriksa. Yang harus terlihat:

| Kolom | Harus | |
| --- | --- | --- |
| `rls_menyala` | `true` | |
| `ada_policy_longgar` | `false` | **paling penting** |
| `ada_policy_public` | `false` | role `{public}` lebih luas dari `{anon,authenticated}` |
| `jumlah_policy` | `3` | |
| `realtime_terdaftar` | `true` | |
| `update_punya_check` | `true` | |

### Dua kali menggigit, dan keduanya diam

**Pertama — satu statement gagal membatalkan sisa skrip.** Versi awal migrasi
berhenti di `ERROR: 42710: relation "unit_economics" is already member of
publication "supabase_realtime"`. Di SQL Editor Supabase, kegagalan itu
membatalkan **seluruh sisa skrip**: blok RLS di bawahnya tidak pernah jalan,
sementara pesan yang muncul di layar cuma soal publikasi. Baris publikasinya
sekarang dibungkus pemeriksaan.

**Kedua — kebijakan bersifat OR, dan pemeriksa yang menghitung tidak
menangkapnya.** Jalan berikutnya menghasilkan `rls_menyala = true` dengan
**enam** kebijakan: tiga milik migrasi ini, tiga peninggalan dashboard yang
berpredikat `true` untuk role `{public}` (`Allow anon read` / `upsert` /
`update`). Cukup satu kebijakan yang meloloskan untuk memberi akses, jadi
penyempitan ke satu baris **tidak berlaku sama sekali** — RLS menyala, dan
meloloskan segalanya.

`Allow anon update` yang paling berbahaya: `with_check`-nya NULL, jadi `id` baris
boleh diubah jadi apa pun — dan begitu itu terjadi dokumen tim keluar dari
jangkauan seluruh kebijakan dan tidak bisa dibaca siapa pun lagi.

Migrasi sekarang menghapus ketiganya by name, dan pemeriksanya menuntut
`ada_policy_longgar = false` alih-alih sekadar menghitung sampai tiga.

### Realtime: sudah menyala ✅

Error 42710 di atas sekaligus membuktikannya — `unit_economics` sudah anggota
publikasi `supabase_realtime`. Tidak ada yang perlu dikerjakan.

> Kalau suatu saat ia dilepas, `langgananDokumen()` akan **terpasang dengan
> sukses dan tidak pernah menerima apa pun.** Tidak ada error; cuma dua orang
> yang saling menimpa karena tidak tahu yang lain sedang menyunting.

### 2. Setel repository variables & secret

Tanpa `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`, job
`bundel` gagal dengan sengaja — bundle tanpa kredensial berjalan mode lokal, dan
itu kegagalan yang tidak terlihat. Caranya di [CI-CD.md](CI-CD.md).

### 3. Buka satu tab dalam langsung di produksi

`https://abbas.co.id/perfume-app/investasi/`. Kalau 404, hosting tidak menyajikan
`index.html` untuk permintaan direktori, dan tab-tab aplikasi tidak bisa
ditautkan maupun dimuat ulang. Gejalanya menipu — navigasi dari dalam aplikasi
tetap mulus. Perbaikannya di [INFRASTRUKTUR.md](INFRASTRUKTUR.md).

CI sudah memeriksa baris itu; ini untuk deploy pertama yang manual.

### 4. Putar anon key Supabase

Yang lama terbaca di riwayat git repo ini dan di `referensi/index-lama.html`. Ia
tidak menutup lubang mana pun (lihat di bawah), tapi ia menutup akses dari salinan
HTML lama yang mungkin masih tersimpan di laptop orang. Setelah diputar,
perbarui repository variable dan build ulang.

## Yang sengaja belum dikerjakan

### Autentikasi

Aplikasi ini tidak punya login. Anon key ada di dalam bundle publik, jadi siapa
pun yang bisa membuka `abbas.co.id/perfume` bisa **membaca dan menimpa** dokumen
tim — termasuk seluruh struktur biaya, harga jual, dan penawaran supplier.

Ini sudah benar sejak builder HTML pertama; port ini tidak memperbaikinya.
Kebijakan RLS menyempitkannya sejauh yang bisa tanpa login (satu baris saja, tanpa
`delete`), tapi itu bukan keamanan — itu kebersihan.

Kalau data ini perlu dijaga, yang dibutuhkan **Supabase Auth**, dan itu pekerjaan
tersendiri: ia menambah layar login, dan export statis tidak punya server untuk
menyegarkan sesi — jadi ia juga memaksa keputusan ulang soal `output: "export"`.
Jangan dikerjakan setengah.

### Riwayat versi dokumen

Tidak ada. Yang terakhir menulis menang, dan yang tertimpa tidak bisa
dikembalikan. Tombol **Export data** adalah satu-satunya cadangan, dan ia manual.

Kalau ini jadi masalah, yang paling murah: kolom `riwayat jsonb[]` yang menyimpan
sepuluh versi terakhir beserta `updated_at`-nya. Bukan `git`-like, cukup "kembali
ke kemarin sore".

### Penggabungan konflik

Dua orang yang menyunting kolom berbeda pada saat yang sama saling menimpa
**seluruh dokumen**. Yang menahan kerusakannya cuma ukuran tim (satu digit) dan
langganan realtime yang memperpendek jendela waktunya.

### `typedRoutes`

Belum dinyalakan. Ia menangkap tautan mati saat compile — persis jenis penjagaan
yang dipakai repo ini — tapi menyalakannya adalah pekerjaan tersendiri. Sementara
itu, `probe:arsitektur` bagian 7 memeriksa tiap tab di nav punya `page.tsx` yang
benar-benar ada.

## Yang sudah pernah menggigit

Sebagian ditemukan saat port ini dibangun, bukan dibaca dari dokumen.

### `Object.assign` itu dangkal

Builder lama memuat dokumen dengan `Object.assign(defaultState(), payload)`.
Objek bersarang diganti **utuh**, bukan digabung — payload lama tanpa `base.mix`
membuat seluruh `mix` hilang, bukan terisi default. Itu sebabnya di sana ada
`normalizeBase()` sepanjang dua puluh baris `if (… === undefined)` yang harus
ditambah tiap ada field baru, dan yang lupa ditambah tidak menghasilkan error apa
pun — cuma `NaN` di satu kolom.

Sekarang: `bacaDokumen()`, yang membaca tiap field satu per satu dengan default,
dan tidak pernah melempar.

### Id yang bentrok merusak data lintas kolom

Supplier dan skenario mendapat id dari pencacah yang mulai dari 100 **setiap kali
halaman dimuat**, sementara id yang tersimpan bisa sudah melewati 100. Dua entitas
ber-id sama berarti menyunting yang satu menulis ke yang lain.

Sekarang: `idBerikutnya()` mulai dari id tertinggi yang ADA, dan
`perbaikiIdGanda()` menambal payload yang terlanjur rusak — sekaligus memindahkan
`pilihan` kalau supplier terpilih yang kena.

### Slider freight yang tidak menggerakkan apa pun

Tiap supplier menyimpan `ratePerCBM`-nya sendiri, terlepas dari asumsi dasar.
Slider yang cuma mengganti `asumsi.freightPerCBM` karena itu tidak menggeser satu
angka pun — dan terbaca sebagai "freight tidak berpengaruh". Sekarang ia
**menskala** tarif tiap supplier, dan `probe:hitung` bagian 9 menuntut COGS
benar-benar bergerak.

### Angka berarah yang kehilangan tandanya

Ditemukan `probe:builder` saat repo ini dibangun: KPI "Proyeksi Gross Profit
Batch" diwarnai hijau/merah tapi ditulis tanpa tanda. Bagi yang buta warna
merah-hijau, angka itu **hilang** — bukan "kurang jelas".

### Satuan yang berbohong

Kolom selisih break-even memakai `delta()`, yang menulis `+Rp1.234` untuk selisih
seribu dua ratus **botol**. Angkanya benar, satuannya berbohong, dan satuan yang
berbohong tidak menghasilkan satu pun error. Sekarang ada `pcsDelta()`.

### Prefetch Next 16 tidak bisa dilayani hosting statis

Next meminta `__next.<sandi>.<segmen>.__PAGE__.txt` — nama berkas **bertitik**;
`next build` menuliskannya sebagai **folder bertingkat**. Tiap prefetch mendarat
di 404. Tidak merusak apa pun, tapi mengisi tab Network dengan merah pada aplikasi
yang sehat. `prefetch={false}` di `app-shell.tsx`.

### `setState` di dalam `useEffect`

Dua kali ditolak lint saat port ini dibangun, dan dua-duanya memang salah bentuk:
menyalin keadaan yang sudah ada di tempat lain (DOM, provider) ke state React.
Yang benar: baca dari sumbernya, atau biarkan CSS memilih. Lihat `TombolTema`.

## Konvensi commit

Ada di skill `house-commits`. Ringkasnya: **tanpa trailer AI apa pun** — tidak ada
`Co-Authored-By`, tidak ada "Generated with", tidak ada emoji robot.
