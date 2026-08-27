# Unit Economics — Design System

Token warna, tipografi, dan ukuran. **Satu berkas**:
[`tokens/theme.css`](tokens/theme.css) — drop-in Tailwind v4 `@theme`, dan itu
yang dipakai kode.

## Sumbernya dua, dan urutannya penting

Warnanya diangkat dari builder HTML yang dipakai tim sejak awal (biru `#3D5AF1`,
netral dingin), lalu **setiap pasangan dihitung ulang terhadap WCAG AA**. Kalau
keduanya berbeda, kontras yang menang — dan penyimpangannya ditulis eksplisit di
token, bukan diam-diam.

## Cara pakai

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "../../design-system/tokens/theme.css";
```

| Kategori | Utility |
| --- | --- |
| Warna | `bg-canvas` `bg-surface` `bg-surface-muted` `border-border` `text-fg` `text-fg-muted` `text-fg-subtle` `bg-primary` `text-primary-hover` `bg-primary-subtle` |
| **Arah nilai** | `text-naik` `bg-naik-bg` `text-turun` `bg-turun-bg` `text-datar` |
| Status | `bg-success-bg` `text-success-fg` `bg-warning-bg` `text-warning-fg` `bg-danger-bg` `text-danger-fg` |
| Tipografi | `text-label` `text-badge` `text-meta` `text-body` `text-card-title` `text-page-title` `text-kpi` — masing-masing sudah membawa line-height, weight, dan tracking-nya |
| Radius | `rounded-sm` (6px) `rounded-md` (8px) `rounded-lg` (10px) |
| Ukuran | `h-topbar` `max-w-container` `h-row` `h-control` `h-control-sm` `h-badge` |
| Kelas siap pakai | `.page-title` `.page-subtitle` `.card` `.th` `.td` `.badge` `.tabular` |

**Jangan hardcode hex di komponen.** Kalau warna yang dibutuhkan belum ada
tokennya, **tokennya yang ditambah** — itu yang membuat tema gelap ikut benar
tanpa menyentuh satu komponen pun. Dijaga `npm run probe:token`, yang juga
menolak `bg-[#...]` dan `rgb()` literal.

## Tiga penyimpangan dari builder lama, dan alasannya

Ketiganya soal kontras, dan ketiganya dihitung — bukan ditaksir.

### 1. Aksen biru `#5B7FFF` tidak boleh mengalasi teks putih

Teks putih di atasnya hanya **3,5:1** — gagal AA (butuh 4,5:1), dan gagalnya
tidak terlihat di layar penulisnya. Jadi:

- `--color-brand: #5b7fff` — tetap warna **ilustrasi dan aksen**
- `--color-primary: #3d5af1` — fill tombol, tab aktif. **5,3:1** vs putih

> ⚠️ `--color-primary` sengaja **bernilai sama di terang dan gelap.** Itu
> satu-satunya cara satu pasangan lolos kontras di kedua tema tanpa dua definisi
> yang harus dijaga sinkron selamanya. Diperiksa `probe:token`, supaya
> keputusannya tidak hilang saat seseorang "merapikan".

### 2. Hijau `#188A5C` terlalu terang untuk teks

**4,35:1** — gagal. Token memakai `#0F7A4F` (5,4:1).

### 3. Merah `#D0433A` lolos di atas putih, jatuh di atas `surface-muted`

4,6:1 vs putih tapi turun di bawah 4,5:1 begitu alasnya abu muda. Token memakai
`#B3261E` (6,5:1), yang lolos di kedua alas.

## Aturan yang tidak boleh dilanggar

### Warna tidak pernah jadi satu-satunya penanda untung/rugi

Sekitar **8% laki-laki** tidak bisa memisahkan merah dari hijau. Margin negatif
yang ditandai hanya dengan warna tidak jadi "kurang jelas" bagi mereka — ia
**hilang**: angka merah dan angka hijau terlihat identik.

Jadi setiap angka berarah keluar dari [`format.ts`](../src/bersama/format.ts)
sudah membawa tandanya (`+` / `−`), dan komponen `<Nilai>` di
[`ui.tsx`](../src/components/ui.tsx) adalah satu-satunya cara menampilkannya.
Warna adalah **lapisan kedua** yang mempercepat pembacaan bagi yang bisa
melihatnya.

Minusnya memakai **MINUS SIGN `−` (U+2212)**, bukan hyphen: di font tabular
hyphen setinggi setengah digit dan mudah terbaca sebagai coretan.

Dijaga `probe:format` **dan** `probe:builder` — yang kedua membaca warna terhitung
di browser sungguhan dan menolak setiap angka berwarna arah yang tidak bertanda.
Aturan ini sudah menangkap satu pelanggaran nyata saat repo ini dibangun: KPI
"Proyeksi Gross Profit Batch" diwarnai hijau tanpa tanda.

Ada juga `arahBiaya()`, yang **membalik** pemilihan warnanya: total investasi yang
naik bukan kabar baik, dan mewarnainya hijau karena angkanya positif adalah cara
tercepat membuat orang salah baca tabel sensitivitas.

### Satuan ikut dalam angkanya

`delta()` untuk rupiah, `poinDelta()` untuk poin persentase, `pcsDelta()` untuk
jumlah botol. Break-even dihitung dalam **pcs**; memakai `delta()` di sana menulis
`+Rp1.234` untuk selisih seribu dua ratus botol — angka benar, satuan berbohong,
dan satuan yang berbohong tidak menghasilkan satu pun error.

### Nol drop shadow

Semua pemisahan visual pakai garis 1px `border-border`. Satu-satunya pengecualian
`--shadow-overlay`, untuk elemen yang memang harus terbaca melayang.
`probe:builder` mengukur `box-shadow` terhitung di dalam `<main>`, dengan kontrol
negatif yang menyuntikkan satu bayangan sungguhan lalu menuntut pendeteksinya
menyala.

Builder lama memakai glassmorphism: `backdrop-filter: blur(30px)` pada delapan
panel sekaligus, gradien empat henti, dan lima blob blur sebagai latar. Itu
dibuang bukan karena selera — bidang berwarna yang bergerak di belakang tabel
angka membuat pembacaan kolom melelahkan, dan blur sebanyak itu adalah alasan
halaman tersendat di laptop yang dipakai rapat.

### Skala font padat: 11 / 12 / 13 / 14 / 18

**Tidak ada 16px**, dan itu disengaja. Halaman ini menampilkan tabel perbandingan
supplier dan skenario berpuluh baris; 16px memaksa scroll sebelum satu tabel pun
muat di layar.

Satu pengecualian: `--text-kpi` 22px. Ia bukan teks — ia satu nilai yang harus
terbaca dari seberang meja saat rapat.

### Angka memakai font mono

Rupiah di kolom yang lebarnya berubah-ubah tidak bisa dibandingkan sekilas, dan
seluruh guna tabel perbandingan supplier adalah membandingkan sekilas. Kelas
`.tabular` membawa font mono sekaligus `font-variant-numeric: tabular-nums`.

## Tema gelap

Berbasis **class** (`.dark` di `<html>`), bukan `prefers-color-scheme`, supaya
tombol di topbar yang mengendalikannya. Class-nya dipasang script **sebelum
paint** di [`layout.tsx`](../src/app/layout.tsx) — mencerminkannya ke `useState`
melahirkan hydration mismatch.

Tombolnya sendiri **tidak punya state React**: ia merender kedua label dan
membiarkan varian `dark:` memilih. HTML hasil build tidak tahu tema pembacanya,
jadi label yang disimpan di state akan selalu ditulis salah dulu lalu diperbaiki
setelah hydrate.

Defaultnya **terang**, bukan gelap: halaman ini sering diproyeksikan ke layar
rapat dan dicetak, dan dua-duanya berangkat dari kertas putih.

## Palet cetak

Tombol "Print / PDF" adalah cara angka ini sampai ke rapat. Tema apa pun yang
aktif di layar, di atas kertas paletnya kembali ke kertas putih — tim yang memakai
tema gelap mencetak halaman hitam pekat, boros tinta dan tidak terbaca.

Sedikit lebih gelap daripada palet layar (`fg-muted` `#4a4f60` vs `#5b6072`):
kontras di kertas lebih rendah daripada di layar bercahaya, dan keterangan yang
pas dibaca di monitor jadi samar setelah dicetak.

Palet itu tinggal di `theme.css`, bukan di `globals.css`, karena warna cuma punya
satu sumber kebenaran di repo ini dan "warna khusus cetak" bukan pengecualian yang
layak dibuat.
