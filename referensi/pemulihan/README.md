# Cadangan dokumen tim

Berkas di folder ini adalah **satu-satunya salinan angka tim yang berhasil
ditemukan** setelah payload baris `sos-unit-economics` di Supabase tertimpa
`{"uji": true}` pada 27 Agustus 2026. Riwayat insidennya di
[../../docs/SESI-2026-08-27.md](../../docs/SESI-2026-08-27.md).

Ketiganya hasil tombol **"Export data"** di builder HTML lama, ditemukan di
folder Downloads mesin kerja. Disalin ke sini apa adanya — byte per byte, tanpa
diformat ulang — supaya asalnya bisa diperiksa, bukan dipercaya.

| Berkas | Diambil | sha256 (12 pertama) | Status |
| --- | --- | --- | --- |
| `2026-07-27-sos-unit-economics.json` | 27 Jul 2026 13:05 | `756f6cc2ef6f` | **calon pemulihan** |
| `2026-07-22-1803-sos-unit-economics.json` | 22 Jul 2026 18:03 | `9489594fd022` | riwayat |
| `2026-07-22-1453-sos-unit-economics.json` | 22 Jul 2026 14:53 | `43af6a629ffc` | riwayat, **jangan dipulihkan** |

Berkas `sebelum-pulih-*.json` yang mungkin muncul di sini bukan kurasi: ia
dibuat otomatis oleh alat pemulihan, berisi isi baris yang ditimpanya.

## Yang dipulihkan, dan yang tidak

Baris yang hilang terakhir disunting **11 Agustus 2026**. Cadangan terbaik di
sini berasal dari **27 Juli 2026**. Jarak dua minggu itu tidak bisa ditutup, dan
menyembunyikannya jauh lebih berbahaya daripada menyebutkannya.

Yang **kembali**: seluruh daftar supplier (2 kecil, 3 besar) beserta harga
molding, harga satuan, MOQ, dan freight per CBM-nya; tiga varian fragrance;
dimensi botol; harga jual; anggaran marketing. Itu bagian yang dikumpulkan
tangan dari penawaran vendor — bagian yang mahal.

Yang **tidak kembali**: tiga angka yang diketahui berbeda pada baris yang
hilang, dari catatan sebelum insiden.

| Field | Cadangan 27 Juli | Baris yang hilang | |
| --- | --- | --- | --- |
| `base.kurs` | 18.000 | **20.000** | wajib diketik ulang |
| `base.oemCost` | 10.000 | **5.000** | wajib diketik ulang |
| `sim.wastePct` | 30 | **17** | wajib diketik ulang |

Ketiganya **sengaja tidak ditambal ke dalam berkas cadangan.** Menambalnya
menghasilkan dokumen yang bukan keadaan 27 Juli dan bukan keadaan 11 Agustus —
tidak ada satu pun momen yang isinya pernah benar, dan tidak ada cara
membedakannya di layar. Yang dipulihkan adalah keadaan yang **pernah utuh**;
selisihnya diketik ulang oleh orang yang tahu angkanya, lalu terlihat di
`updated_at`.

Selain ketiganya, sunting lain antara 27 Juli dan 11 Agustus tidak terdokumentasi
dan karena itu tidak diketahui. Anggap seluruh dokumen perlu dibaca ulang sekali
oleh tim setelah pemulihan.

## Kenapa export 22 Juli tidak boleh dipulihkan

Ia dibuat sebelum model biayanya berubah bentuk: `usdPerLiter` masih 2,4 (bukan
60), `largeSizeML` masih 100, dan `base.mix` belum ada sama sekali. Migrasi
membacanya tanpa mengeluh — dan hasilnya **margin −3431% pada botol kecil dan
−1919% pada botol besar**.

Itu bentuk kegagalan yang paling sulit dilihat di repo ini: tidak ada error,
dokumennya sah, angkanya cuma salah. `probe:pemulihan` karena itu menuntut calon
pemulihan menghasilkan margin antara 0% dan 100% **pada kedua ukuran**, dan
memakai export 22 Juli sebagai kontrol negatif untuk batas itu — batas yang tidak
dilewati satu data pun adalah batas yang tidak memisahkan apa pun.

Kedua ukuran diperiksa karena botol kecil dan besar memakai supplier, harga jual,
dan biaya OEM yang berbeda: satu cadangan bisa masuk akal pada yang satu dan
omong kosong pada yang lain.

## Cara memulihkan

Butuh `.env.local` berisi kredensial Supabase (`.env.example` → salin, isi dari
Project Settings → API).

```bash
# 1. Kering — membaca, membandingkan, tidak mengirim apa pun.
npm run pulih:dokumen -- referensi/pemulihan/2026-07-27-sos-unit-economics.json

# 2. Kalau keluarannya masuk akal, baru menulis.
npm run pulih:dokumen -- referensi/pemulihan/2026-07-27-sos-unit-economics.json --tulis
```

Alatnya [`scripts/pulihkan-dokumen.mjs`](../../scripts/pulihkan-dokumen.mjs).
Ia memakai `PATCH`, tidak pernah `POST` — perbedaan itu yang menyebabkan
insidennya, karena `POST` ke PostgREST adalah `INSERT … ON CONFLICT DO UPDATE`
dan menimpa payload yang ada. Ia juga mencadangkan isi lama sebelum menulis, dan
**menolak menimpa baris yang isinya tampak utuh** kecuali dipaksa.

Setelah pulih: ketik ulang tiga angka di tabel atas, lalu minta satu orang tim
membaca seluruh dokumen sekali.

⚠️ Selama baris Supabase masih rusak, **minta tim tidak membuka
`abbas.co.id/perfume`.** Builder memuat dari cloud lebih dulu; begitu ada yang
mengetik satu angka, salinan `localStorage` di browsernya ikut tertimpa — dan
salinan itu satu-satunya cadangan yang mungkin lebih baru daripada folder ini.
