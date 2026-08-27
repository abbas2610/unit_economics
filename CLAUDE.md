@AGENTS.md

# Unit Economics — Societies of Strangers

Builder unit economics parfum untuk **PT Kreasi Tiga Generasi Indonesia**: asumsi
dasar → supplier botol → initial investment → COGS per botol → sensitivitas.

Next.js 16 + Tailwind v4 + TypeScript, **export statis**, disinkronkan lewat
Supabase. Live di **<https://abbas.co.id/perfume>**.

Praktik kerja di repo ini **diangkat dari SM Platform dan PortoKu**, yang sudah
membuktikannya di lapangan. Yang disalin bukan kodenya — melainkan cara kerjanya:
probe yang menemukan dirinya sendiri, kontrol negatif di setiap aturan, token
desain sebagai satu-satunya sumber warna, dan alasan yang ditulis di sebelah
keputusannya.

## Tiga hal pertama, sebelum menjawab apa pun

1. **`git status --short`.** Kalau tidak bersih, sebut apa yang belum selesai dan
   **jangan sentuh berkas itu tanpa bertanya** — berkasnya mungkin sedang ditulis
   sesi lain. Probe yang jalan di atas berkas setengah jadi akan melaporkan
   kegagalan palsu.
2. **Jangan percaya angka apa pun di dokumen — bangkitkan.** Jumlah probe:
   `npm run probe:daftar`. Jumlah assertion: jalankan probenya, ia mencetak
   totalnya di baris terakhir. Angka yang ditulis tangan di dokumen sudah pernah
   basi tanpa ada yang sadar di repo sebelah.
3. **"Sudah jadi" bukan status, itu klaim.** Kalau tidak ada probe yang
   menjaganya, katakan begitu. Tombol tanpa handler terlihat persis seperti
   tombol yang jadi, dan angka yang salah terlihat persis seperti angka yang
   benar.

## Baca ini sebelum mulai

| Kapan | Dokumen |
| --- | --- |
| **Sebelum menyentuh rumus biaya apa pun** | [docs/MODEL-BIAYA.md](docs/MODEL-BIAYA.md) |
| **Selalu, sebelum menulis komponen** | [design-system/README.md](design-system/README.md) |
| **Sebelum menambah impor lintas modul** | [docs/ARSITEKTUR-DOMAIN.md](docs/ARSITEKTUR-DOMAIN.md) — batasnya ditegakkan probe, bukan konvensi |
| **Selalu, untuk konteks & jebakan** | [docs/HANDOVER.md](docs/HANDOVER.md) |
| **Sebelum menyentuh apa pun soal deploy** | [docs/INFRASTRUKTUR.md](docs/INFRASTRUKTUR.md) · [docs/CI-CD.md](docs/CI-CD.md) |
| Cara menjalankan & membangun | [README.md](README.md) |
| Skema database & RLS | [supabase/migrations/0001_awal.sql](supabase/migrations/0001_awal.sql) |
| Rumus versi lama, sebelum port | [referensi/index-lama.html](referensi/index-lama.html) — dibekukan, jangan disunting |

## Aturan yang tidak boleh dilanggar

**Design system adalah sumber kebenaran warna.** Pakai token dari
[`design-system/tokens/theme.css`](design-system/tokens/theme.css) lewat utility
Tailwind (`bg-surface`, `text-fg-muted`, `text-naik`, `h-control`,
`text-page-title`). **Jangan pernah hardcode hex di komponen.** Kalau warna yang
dibutuhkan belum ada tokennya, **tokennya yang ditambah**. Dijaga
`npm run probe:token`, yang juga menolak `bg-[#...]` dan `rgb()` literal.

**Jangan pakai `Intl`** untuk format angka. Halaman dirender sekali di Node saat
`next build` lalu di-hydrate browser; data ICU kedua runtime bisa berbeda dan
hasilnya hydration mismatch. Pakai [`src/bersama/format.ts`](src/bersama/format.ts).
Dijaga `npm run probe:format`, yang menyisir SELURUH `src/` — bukan cuma
`format.ts`.

**Setiap angka yang punya ARAH keluar sudah bertanda.** Gross profit, margin,
selisih, dampak — semuanya lewat `delta()` / `persenDelta()` / `poinDelta()` /
`pcsDelta()` dan komponen `<Nilai>`. Warna hijau/merah adalah **lapisan kedua**,
bukan pertama: sekitar 8% laki-laki tidak bisa memisahkan keduanya, dan margin
negatif yang ditandai hanya dengan warna **hilang** dari mereka. Dijaga
`probe:format` + `probe:builder`, keduanya dengan kontrol negatif.

**Satuan ikut dalam angkanya.** Break-even dihitung dalam pcs; memakai `delta()`
di sana menulis `+Rp1.234` untuk selisih seribu dua ratus botol — angka benar,
satuan berbohong, dan satuan yang berbohong tidak menghasilkan satu pun error.

**Nilai turunan TIDAK PERNAH disimpan di dokumen.** Qty batch, rata-rata harga
fragrance, COGS — semuanya fungsi dari dokumen. Builder lama menyimpan
`projection.batchSmall` DAN menghitungnya ulang tiap render; dua sumber untuk satu
angka selalu berbeda pada akhirnya, dan yang tersimpan menang di jalur kode yang
lupa menghitung ulang — lalu dipakai membagi amortisasi molding.

**Seluruh fungsi hitung menerima `Dokumen` sebagai argumen.** Tidak ada state
global yang ditukar sementara. Builder lama menukar variabel `S` ke kloning lalu
memulihkannya di `finally`; itu berarti tiap fungsi hitung punya satu argumen
tersembunyi yang tidak muncul di tanda tangannya, dan satu `await` yang terselip
membuat angka simulasi tersimpan sebagai angka rencana.

**`null` bukan `0`.** Break-even yang tidak akan pernah tercapai adalah `null`,
ditulis `—` di layar. `0` adalah pernyataan ("tidak perlu menjual apa pun");
meleburnya menampilkan kabar terburuk di halaman sebagai kabar terbaik.

**`domain/` dan `aplikasi/` TIDAK BOLEH menyentuh `infrastruktur/`.** Sekali satu
fungsi domain memanggil Supabase, seluruh aritmetika di belakangnya berhenti bisa
diuji tanpa jaringan — dan `probe:hitung`, satu-satunya yang menjaga angka yang
dibawa ke rapat, berubah jadi probe yang butuh kredensial. Ditegakkan
`npm run probe:arsitektur`.

**`src/bersama` bebas framework.** Tanpa `react`, tanpa `next`, tanpa
`"use client"`. Probe mengimpornya langsung di Node polos, dan itu yang membuatnya
selesai dalam 0,3 detik. Aturan turunannya: fungsi murni yang dipakai lintas
server/klien tinggal di sana, tidak pernah di berkas ber-`"use client"` — lihat
catatan panjang di [`src/bersama/cx.ts`](src/bersama/cx.ts).

**Nol drop shadow.** Semua pemisahan visual pakai garis 1px `border-border`.
`--shadow-overlay` satu-satunya pengecualian.

**Skala font padat: 11/12/13/14/18. Tidak ada 16px** — itu disengaja. Satu
pengecualian: `text-kpi` 22px, yang bukan teks melainkan satu nilai yang harus
terbaca dari seberang meja.

**Tiap batas, kuota, atau cabang butuh satu baris data yang MELEWATINYA.**
`probe:hitung` bagian 12 menjaga asumsi "rata-rata harga fragrance cukup" dengan
menolak sebaran lebih dari 2× — batas yang tidak diuji adalah batas yang akan
dilewati diam-diam.

## Probe

Penjalannya **menemukan** probenya dari isi `scripts/`, bukan menghafal daftar —
jadi menambah berkas `probe-*.mjs` otomatis menambahkannya ke CI.

```bash
npm run probe:daftar   # apa saja yang ada — jangan percaya angka di dokumen ini
npm run probe:data     # tanpa server, hitungan detik
npm run probe:layar    # butuh `npm run serve:build` lebih dulu
npm run probe:rls      # menembak Supabase sungguhan; butuh .env.local
```

⚠️ Helper yang dipakai bersama probe **harus berawalan `lib-`**. Berkas bernama
`probe-navigasi.mjs` akan ikut dijalankan sebagai probe dan **lolos**, karena ia
cuma mengekspor fungsi lalu keluar dengan kode 0.

⚠️ **Setiap aturan butuh kontrol negatif.** Pelanggarannya disuntikkan, lalu
detektornya harus menyala. Kontrol yang ikut lolos berarti ujinya tidak menguji
apa pun — dan itu tidak terlihat dari baris hijaunya. Satu baris seperti itu
sempat lolos ke `probe-arsitektur` saat repo ini dibangun (`adaSiklusTipe || true`);
ia hijau dan tidak menguji apa pun.

## Menjalankan tanpa Supabase

`npm run dev` jalan tanpa `.env.local` dan memakai localStorage. Yang hilang cuma
sinkronisasi tim; seluruh perhitungan berjalan di browser. Itu disengaja — builder
ini sering dibuka di ruang rapat dengan wifi yang tidak bisa diandalkan.

**Build CI justru menolak jalan tanpa kredensial**, dan itu juga disengaja: bundle
tanpa kredensial berjalan mode lokal tanpa satu pun tanda, dan perubahan satu
orang tidak pernah sampai ke yang lain.

## Commit

Konvensi ada di skill `house-commits`. Ringkasnya: **tanpa trailer AI apa pun** —
tidak ada `Co-Authored-By`, tidak ada "Generated with", tidak ada emoji robot.
