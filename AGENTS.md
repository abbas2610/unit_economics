<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Yang sudah pernah menggigit di repo ini

Semuanya ditemukan saat port dari `index.html` dibangun — bukan dibaca dari
dokumen.

- **Export statis + Next 16 = prefetch yang selalu 404.** Segment cache meminta
  `__next.<sandi>.<segmen>.__PAGE__.txt` (nama berkas **bertitik**); `next build`
  menuliskannya sebagai **folder bertingkat**. Tidak merusak apa pun — navigasi
  jatuh ke permintaan biasa — tapi mengisi tab Network dengan 404 merah pada
  aplikasi yang sehat. `prefetch={false}` di `app-shell.tsx`.

- **⛔ Perintah diagnosis yang MENULIS tidak pernah menyentuh baris produksi.**
  Sesi ini menjalankan `POST` upsert ke `id = sos-unit-economics` sekadar untuk
  melihat kode statusnya — dan PostgREST memperlakukan upsert sebagai
  `INSERT … ON CONFLICT DO UPDATE`, jadi kolom `payload` yang dikirim MENIMPA
  isi yang ada. Seluruh angka tim hilang dalam satu perintah yang dimaksudkan
  sebagai pembacaan. Kalau perlu menguji tulisan, pakai id buangan — persis yang
  sudah dilakukan `probe:rls` dengan `probe-rls-jangan-dipakai`.

- **Probe layar TIDAK BOLEH bisa menyentuh data produksi.** Bundle yang dibangun
  CI membawa kredensial, jadi tiap ketikan probe tersimpan ke dokumen bersama
  yang sungguhan — merusak angka tim tiap kali CI jalan, dengan log yang hijau.
  `probe-builder.mjs` memutus seluruh permintaan ke `supabase.co` lewat
  `konteks.route()`, dan MEMBUKTIKAN pemutusannya berlaku dengan menuntut status
  di topbar berbunyi "Mode lokal". Sisi awan diuji `probe:rls`, dengan id buangan.

- **GitHub Actions meneruskan variable yang belum diset sebagai STRING KOSONG.**
  `process.env.X ?? "bawaan"` karena itu tidak berlaku — `??` hanya jatuh pada
  `null`/`undefined`. Di `env.ts` itu membuat id dokumen jadi `""`, dan tiap
  penyimpanan ditolak RLS dengan 401 sementara gejalanya di layar cuma
  "Gagal sync". Pakai `||` atau helper yang memangkas dulu.

- **Tidak ada directory index di produksi, dan itu perilaku NEXT.** `abbas.co.id`
  dilayani proses Next milik repo portfolio, yang menyajikan berkas `public/`
  hanya pada path PERSISNYA. Terukur: `/perfume-app/index.html` → 200,
  `/perfume-app/` → 404 dengan header `X-Powered-By: Next.js`. `.htaccess` tidak
  akan menambalnya. Tautan langsung ke satu tab wajib menyebut `/index.html`;
  berpindah tab dari dalam aplikasi tetap mulus karena itu navigasi sisi klien.

- **Server uji WAJIB sama pelitnya dengan produksi.** `serve-build.mjs` sempat
  saya buat me-resolve `/foo/` jadi `/foo/index.html` atas asumsi hosting Apache.
  Asumsinya salah, dan selama itu seluruh probe layar lulus untuk halaman yang
  akan 404 setelah deploy. Sekarang bahkan akarnya tidak dipetakan.

- **`next start` TIDAK menyajikan `output: "export"`.** Probe layar memakai
  `scripts/serve-build.mjs`, bukan `next start`.

- **`setState` di dalam `useEffect` ditolak lint Next 16** (`react-hooks/set-state-in-effect`),
  dan dua kali ia memang menandai bentuk yang salah: menyalin keadaan yang sudah
  ada di tempat lain (DOM, provider) ke state React. Yang benar: baca dari
  sumbernya, atau biarkan CSS memilih — lihat `TombolTema`.

- **`metadata` tidak boleh diekspor dari berkas ber-`"use client"`.** Pola di repo
  ini: `page.tsx` server tipis yang mengekspor `metadata` dan merender
  `*-layar.tsx` klien.

- **Regex nama token ikut menangkap sub-propertinya.** `--text-label--line-height`
  cocok dengan pola `--text-([a-z-]+):\s*(\d+)px`, jadi `probe:token` sempat
  melaporkan "ada token 16px" untuk line-height 16px yang tidak melanggar apa pun.
  Probe yang merah pada perilaku yang benar akan dimatikan orang, bukan
  diperbaiki.

- **Playwright melaporkan prefetch yang dibatalkan sebagai `requestfailed`.**
  `net::ERR_ABORTED` harus dikecualikan, atau probe layar merah pada perilaku yang
  benar.

- **Kebijakan RLS bersifat OR, dan `drop policy if exists` hanya kena nama yang
  sama.** Migrasi ini sempat menambah tiga kebijakan sempit ke tabel yang sudah
  punya tiga kebijakan dashboard berpredikat `true` untuk role `{public}`.
  Hasilnya enam kebijakan, RLS menyala, dan akses tetap terbuka sepenuhnya —
  karena cukup satu kebijakan yang meloloskan. Menghitung jumlah kebijakan tidak
  menangkap ini; yang menangkap `bool_or(qual = true or with_check = true)`.

- **Di SQL Editor Supabase, satu statement yang gagal membatalkan SISA skripnya.**
  Migrasi pertama repo ini berhenti di `42710 … already member of publication
  "supabase_realtime"`, dan blok RLS di bawahnya tidak pernah jalan — sementara
  pesan di layar cuma soal publikasi. "Sudah saya jalankan" karena itu bukan hal
  yang sama dengan "RLS menyala". Migrasi ditulis idempoten dan diakhiri query
  pemeriksa; percayai pemeriksanya, bukan tidak-adanya error.

- **`alter publication … add table` TIDAK idempoten.** Bungkus dengan cek
  `pg_publication_tables`. `create table if not exists`, `enable row level
  security`, dan `drop policy if exists` + `create policy` sudah aman.

- **`grep` untuk membuktikan kredensial ter-bundle harus mencari NILAINYA.**
  Pemeriksa CI yang mencari kata `supabase.co` lolos pada bundle yang tidak punya
  kredensial sama sekali — pustaka `@supabase/supabase-js` memuat string itu di
  dalam kodenya sendiri. Cari nilai variabelnya, dan tolak lebih dulu kalau
  variabelnya kosong.

- **`pkill` tidak menghentikan proses Node di Git Bash / Windows.** Server uji yang
  lama tetap memegang port, yang baru mati diam-diam dengan `EADDRINUSE` di
  `server.log`, dan probe berikutnya menguji **kode yang lama**. Hentikan lewat
  PowerShell — dan **pipa langsung ke `Stop-Process` tidak bekerja**, karena ia
  mengikat `Name` dari objek CIM lalu mencari proses bernama `node.exe` sebagai
  nama harfiah dan gagal. Id-nya harus disebut:
  `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like
  '*serve-build*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }`.

- **Heredoc bash yang panjang tidak stabil di shell ini.** Berkas besar ditulis
  lewat tool tulis-berkas, bukan `cat > … <<'EOF'`.

- **Cadangan JSON yang tidak lagi terbaca migrasi TIDAK menghasilkan error.**
  `bacaDokumen()` sengaja tidak pernah melempar — payload yang tidak dikenali
  jadi dokumen awal. Jadi cadangan yang basi terlihat persis seperti cadangan
  yang baik sampai hari ia dipakai, dan hari itu yang ditulis ke baris tim
  adalah angka contoh. Yang diperiksa `probe:pemulihan` karena itu bukan
  "apakah ia parse" melainkan **apakah hasilnya masih berbeda dari
  `dokumenAwal()`**.

- **Dokumen yang sah belum tentu dokumen yang benar.** Export 22 Juli 2026
  terbaca utuh oleh migrasi hari ini dan menghasilkan **margin −3431% (kecil)
  dan −1919% (besar)** — karena ia dibuat sebelum model biayanya berubah bentuk
  (`usdPerLiter` 2,4 bukan 60, `largeSizeML` 100, `base.mix` belum ada). Tidak
  ada error di mana pun; angkanya cuma salah. Calon pemulihan karena itu disebut
  namanya di `probe-pemulihan.mts` dan dituntut bermargin 0–100%, dengan export
  22 Juli sebagai kontrol negatif untuk batas itu.

- **`unitEconomics(dok, ukuran)` butuh DUA argumen, dan yang kurang tetap
  menghasilkan angka.** Memanggilnya dengan satu argumen di probe menghasilkan
  COGS dan margin yang terlihat wajar — bukan `NaN`, bukan lemparan — padahal
  `ukuran` `undefined`. `scripts/` **dikecualikan dari `tsconfig.json`**, jadi
  `npm run typecheck` hijau tanpa pernah melihat berkas probe. Probe yang
  menghitung ukuran mana pun sekarang menyebut keduanya secara harfiah.

- **Satu angka yang menjawab empat pertanyaan akan salah pada tiga di antaranya.**
  `qtyBatch` dulu merangkap kapasitas cairan, jumlah yang dipesan, jumlah yang
  dibayar, dan jumlah yang jadi. Selama MOQ tidak mengikat dan tidak ada
  pembelian sampel, keempatnya kebetulan sama — jadi tidak ada yang salah selama
  berbulan-bulan. Begitu salah satu syarat itu lepas, keempat jawabannya bergeser
  sekaligus dan semuanya tetap berupa rupiah yang wajar. Sekarang ada
  `kapasitasCairan`, `qtyDiminta`, `qtyBeli`, `qtyProduksi`, dan yang memilih
  salah satu harus menyebut alasannya.

- **MOQ adalah LANTAI, dan menampilkannya seperti pesanan membuat orang salah
  hitung di kepalanya.** Tabel perbandingan sempat memberi MOQ satu baris penuh
  dengan angka besar, sementara qty yang benar-benar mengalikan harga cuma muncul
  sebagai teks kecil di dalam sel. Yang membaca "MOQ 100 pcs" lalu melihat
  Rp84 juta menyimpulkan aplikasinya rusak — padahal yang dikalikan 8.500 dan
  angka 100 tidak mengikat apa pun. Angka yang MENENTUKAN harus lebih menonjol
  daripada angka yang cuma membatasi.

- **Biaya yang dipakai memilih vendor harus sama dengan biaya yang dipakai
  COGS.** Baris "Biaya botol / unit" memakai `biayaSatuan().total` yang tidak
  memuat freight, sementara `unitEconomics()` memasukkannya. Botol yang lebih
  murah tapi lebih gemuk membayar jauh lebih banyak per CBM, jadi tabelnya bisa
  menobatkan vendor yang COGS-nya JUSTRU lebih mahal — terukur Rp77.013 vs
  Rp62.363. Sekarang ada `satuan.totalLengkap`, dan `total` diberi peringatan di
  tempatnya.

- **"Termurah" di atas dua qty yang berbeda selalu salah.** Total investasi dua
  supplier ber-MOQ berbeda bukan barang yang sama, dan badge itu membuat supplier
  yang seluruh harganya masih **Rp0** selalu menang — yang persis terjadi pada
  supplier yang baru ditambah. Badge sekarang cuma menempel di "biaya per botol
  terpakai", satu-satunya angka yang setara antar kolom.

- **Menambah entitas tanpa cara memilihnya = fitur yang tidak pernah berjalan.**
  `tambah()` menambahkan supplier ke daftar tapi tidak menyentuh `pilihan`,
  sementara satu-satunya pemilih ada di tab 4. Menambah supplier di tab 3 karena
  itu tidak mengubah satu angka pun di seluruh aplikasi — tanpa error, tanpa
  tanda, dan `hapus()` tepat di bawahnya justru repot-repot memindahkan pilihan.
  Terukur: total investasi sebelum dan sesudah menambah supplier, selisih Rp0.

- **Sifat perilaku dibuktikan dengan MENJALANKAN, bukan mem-`grep` kode.**
  "Alat pemulihan tidak pernah `POST`" diuji dengan menyalakan PostgREST palsu,
  menjalankan alatnya sungguhan, dan memeriksa metode yang benar-benar sampai —
  plus kontrol negatif yang membuktikan pencatat permintaannya menyala. Membaca
  kode sumber berarti mempercayai bahwa jalur yang dibaca sama dengan jalur yang
  jalan, dan itu asumsi yang sudah pernah salah di sini (pemeriksa CI yang
  mencari kata `supabase.co`).
