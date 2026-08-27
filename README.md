# Unit Economics — Societies of Strangers

Builder unit economics parfum untuk **PT Kreasi Tiga Generasi Indonesia**: dari
asumsi dasar dan harga biang, ke perbandingan supplier botol, initial investment,
COGS per botol, dan analisis sensitivitas.

Next.js 16 + React 19 + Tailwind v4 + TypeScript, di-export **statis** dan
disinkronkan lewat **Supabase** supaya satu tim melihat angka yang sama.

Live di **<https://abbas.co.id/perfume>** — bundle-nya tinggal di
`public/perfume-app/` pada repo portfolio. Rinciannya di
[docs/INFRASTRUKTUR.md](docs/INFRASTRUKTUR.md).

## Enam langkah

| # | Rute | Isi |
| --- | --- | --- |
| 1 | `/` | Asumsi dasar, varian fragrance, komposisi campuran, hasil produksi |
| 2 | `/supplier-kecil` | Supplier botol 15 ML — molding, satuan, MOQ, freight |
| 3 | `/supplier-besar` | Supplier botol besar (100 atau 50 ML) |
| 4 | `/investasi` | Initial investment: produk + marketing, pajak, catatan MOQ |
| 5 | `/unit-economics` | COGS per botol, gross margin, skenario perbandingan |
| 6 | `/sensitivitas` | Simulasi "bagaimana jika", dampak per variabel, target omzet |

Tiap langkah punya **rute sendiri**, jadi tombol back browser bekerja dan tiap tab
bisa dibuka langsung. Itu perubahan nyata dari builder HTML sebelumnya, di mana
keenam tab adalah satu halaman dengan `display:none`.

> ⚠️ Di produksi, tautan langsung ke satu tab wajib menyebut `/index.html`
> (`abbas.co.id/perfume-app/investasi/index.html`). Berkas `public/` di sana
> disajikan proses Next hanya pada path persisnya — lihat
> [docs/INFRASTRUKTUR.md](docs/INFRASTRUKTUR.md).

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:4880/perfume-app
```

Jalan **tanpa `.env.local`**. Yang hilang cuma sinkronisasi tim; seluruh
perhitungan berjalan di browser dan dokumennya tetap tersimpan di localStorage.
Itu disengaja — builder ini sering dibuka di ruang rapat dengan wifi yang tidak
bisa diandalkan.

Untuk menyalakan sinkronisasi, salin `.env.example` jadi `.env.local` dan isi
dari Supabase → Project Settings → API.

> ⚠️ Aplikasi ini export statis: `NEXT_PUBLIC_*` **dibekukan ke dalam bundle saat
> build**, bukan dibaca saat halaman dibuka. Mengganti env di panel hosting tidak
> melakukan apa pun — yang dibutuhkan build ulang.

## Membangun & memeriksa

```bash
npm run build          # → out/ (export statis, basePath /perfume-app)
npm run typecheck
npm run lint
npm run probe:daftar   # probe apa saja yang ada — jangan percaya angka di dokumen
npm run probe:data     # seluruh probe tanpa server, hitungan detik
```

Probe layar butuh hasil build yang disajikan lebih dulu:

```bash
npm run build
npm run serve:build &        # http://localhost:4880/perfume-app
npm run tunggu:server        # menunggu siap, lalu MEMBUKTIKAN servernya jujur
npm run probe:layar
```

`tunggu:server` bukan sekadar penunggu: ia menuntut halaman ngawur menjawab 404
dan path tanpa `basePath` menjawab 404. Server yang menjawab 200 untuk apa pun
membuat seluruh probe layar di atasnya tidak bermakna.

## Peta berkas

```
design-system/tokens/theme.css   satu-satunya sumber warna, tipografi, ukuran
docs/                            keputusan, jebakan, deploy, model biaya
referensi/index-lama.html        builder HTML sebelum port — dibekukan, bukan dirawat
scripts/probe-*.{mjs,mts}        probe; penjalannya MENEMUKAN, bukan menghafal
src/bersama/                     fungsi murni lintas server/klien (format, masukan)
src/components/                  komponen & store dokumen
src/contexts/<konteks>/          domain/ · aplikasi/ · infrastruktur/
src/infrastruktur/supabase/      klien & kredensial
supabase/migrations/             skema & RLS
```

Batas antar lapisan **ditegakkan probe**, bukan konvensi — lihat
[docs/ARSITEKTUR-DOMAIN.md](docs/ARSITEKTUR-DOMAIN.md).

## Baca berikutnya

| Kapan | Dokumen |
| --- | --- |
| Sebelum menyentuh rumus biaya apa pun | [docs/MODEL-BIAYA.md](docs/MODEL-BIAYA.md) |
| Sebelum menulis komponen | [design-system/README.md](design-system/README.md) |
| Sebelum menambah impor lintas modul | [docs/ARSITEKTUR-DOMAIN.md](docs/ARSITEKTUR-DOMAIN.md) |
| Selalu, untuk konteks & jebakan | [docs/HANDOVER.md](docs/HANDOVER.md) |
| Sebelum menyentuh apa pun soal deploy | [docs/INFRASTRUKTUR.md](docs/INFRASTRUKTUR.md) · [docs/CI-CD.md](docs/CI-CD.md) |
