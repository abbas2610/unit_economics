# Arsitektur Domain

Batas-batas di bawah **ditegakkan `npm run probe:arsitektur`**, bukan konvensi.
Folder yang rapi tidak menegakkan apa pun: satu `import` baru bisa menembus batas
mana pun besok pagi, dan pohon berkasnya akan tetap terlihat rapi.

## Lapisan

```
src/bersama/           kernel — fungsi murni, tanpa React, tanpa jaringan
src/infrastruktur/     kernel — klien Supabase & kredensial
src/contexts/<x>/
    domain/            aturan biaya. Tidak tahu konteks lain kecuali lewat PINTU
    aplikasi/          merangkai lintas konteks jadi satu jawaban
    infrastruktur/     penyimpanan
src/components/        komponen & store dokumen
src/app/               rute
```

### Enam konteks

| Konteks | Menjawab |
| --- | --- |
| `asumsi` | angka yang diisi sekali dan diikuti semua halaman; dimensi & freight dasar |
| `fragrance` | harga biang, biaya per botol, campuran, hasil produksi |
| `supplier` | molding, biaya satuan, MOQ, freight per supplier, total per batch |
| `unit-economics` | COGS, gross profit, margin, break-even, skenario perbandingan |
| `investasi` | initial investment: produk + marketing, pajak, kelebihan stok |
| `sensitivitas` | skenario "bagaimana jika", tornado, target omzet |
| `dokumen` | bentuk dokumen, migrasi, penyimpanan lokal & awan |

## Aturan, dan apa yang rusak kalau dilanggar

### 1. Kernel itu kernel

`src/bersama/**` dan `src/infrastruktur/**` tidak boleh mengimpor konteks mana
pun. Keduanya dipakai semua orang; begitu salah satunya balik memanggil satu
konteks, lapisannya terbalik dan tidak ada lagi dasar yang bisa dipijak.

### 2. `src/bersama` bebas framework

Tidak boleh menyentuh `react` maupun `next`, dan tidak boleh ber-`"use client"`.

Bukan soal kemurnian: `probe:format` dan `probe:hitung` **mengimpor berkasnya
langsung di Node polos**, dan itu yang membuat keduanya selesai dalam 0,3 detik.
Satu impor React di sana membuat probe tercepat di repo ini butuh bundler untuk
jalan — dan probe yang butuh bundler akan dimatikan orang pertama kali ia merah
karena alasan yang tidak ada hubungannya dengan kodenya.

Aturan turunannya, dan ia sudah menyebabkan kegagalan runtime di repo tetangga:
**fungsi murni yang dipakai lintas server/klien tinggal di `src/bersama/`, tidak
pernah di berkas ber-`"use client"`.** Komponen server yang memanggil fungsi dari
berkas klien melempar *"Attempted to call cx() from the server"* — setelah build
dan typecheck sama-sama sukses. Lihat catatan di [`src/bersama/cx.ts`](../src/bersama/cx.ts).

### 3. `domain/` tidak mengimpor `aplikasi/`

Domain adalah aturan biayanya; aplikasi yang merangkai lintas konteks. Arah
baliknya membuat "apa itu biaya botol" bergantung pada "bagaimana initial
investment dijumlahkan".

### 4. ⭐ `domain/` dan `aplikasi/` tidak menyentuh `infrastruktur/`

Aturan paling berharga di repo ini. Sekali satu fungsi domain memanggil Supabase,
seluruh aritmetika di belakangnya berhenti bisa diuji tanpa jaringan — dan
`probe:hitung`, satu-satunya yang menjaga angka yang dibawa ke rapat, berubah jadi
probe yang butuh kredensial. Probe yang butuh kredensial akan merah karena alasan
yang tidak ada hubungannya dengan kodenya, lalu dimatikan, lalu tidak pernah
dinyalakan lagi.

Yang boleh mengimpor `infrastruktur/`: `src/app/**` dan `src/components/**`.

Probe memeriksanya dua cara — lewat graf impor internal, DAN lewat nama paket
(`@supabase/*`), karena impor langsung dari nama paket akan lolos pemeriksaan
graf.

### 5. Tidak ada siklus NILAI

Siklus **tipe** boleh: tipe hilang saat compile, jadi graf modul yang benar-benar
dieksekusi tetap berbentuk pohon.

Dan siklus tipe memang ada di sini, disengaja: `dokumen/domain` menyusun daftar
`Skenario` dari `unit-economics/domain`, sementara `unit-economics/aplikasi`
menerima `Dokumen` sebagai argumen. Keduanya `import type`.

Probe memeriksa **dua arah**: bahwa siklus tipe itu ada, dan bahwa ia HILANG
kalau hanya impor nilai yang dihitung. Kalau salah satu arah suatu saat berubah
jadi impor nilai, hilangnya izin itu ketahuan di sana — bukan sebagai `undefined`
di tengah perhitungan COGS.

### 6. Tiap kopling lintas konteks terdaftar di `PINTU`

Daftarnya ada di [`scripts/probe-arsitektur.mjs`](../scripts/probe-arsitektur.mjs),
lengkap dengan alasan tiap barisnya. Kopling baru jadi suntingan sadar, bukan efek
samping satu auto-import editor.

Pintu yang terdaftar tapi **tidak lagi dipakai juga gagal**: daftar izin yang
tidak pernah menyusut akan berhenti berarti.

> Kalau alasan satu barisnya sulit ditulis, itu jawabannya: kopling itu mungkin
> tidak seharusnya ada, dan yang dibutuhkan modul `aplikasi/` yang merangkai
> keduanya dari atas.

### 7. Akar `src/app` cuma layout

Hanya `layout.tsx` dan `globals.css`. Seluruh halaman tinggal di route group
`(builder)` — tanda kurungnya membuat nama folder tidak muncul di URL, sehingga
`page.tsx` di dalamnya tetap melayani `/`.

Yang didapat dari mengelompokkannya: **satu `<DokumenProvider>` di atas keenam
tab**, sehingga berpindah tab tidak memuat ulang dokumen dan tidak menghapus
perubahan yang belum sempat tersimpan.

Probe juga memeriksa tiap tab di nav punya `page.tsx` yang benar-benar ada. Item
nav yang menunjuk rute mati terlihat persis seperti item nav yang jadi.

## Prinsip yang mengikat semuanya

**Tidak ada nilai turunan di dalam dokumen.** Qty batch, rata-rata harga
fragrance, COGS — semuanya fungsi dari dokumen, bukan field di dalamnya. Dua
sumber untuk satu angka selalu berbeda pada akhirnya, dan yang tersimpan menang
di jalur kode yang lupa menghitung ulang.

**Seluruh fungsi hitung menerima `Dokumen` sebagai argumen.** Tidak ada state
global yang ditukar sementara. Itu yang membuat analisis sensitivitas cuma
"dokumen lain", dan yang membuat `probe:hitung` bisa menjalankan sepuluh skenario
berdampingan tanpa satu pun saling mencemari.
