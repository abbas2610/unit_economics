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

- **`trailingSlash: true` bergantung pada DirectoryIndex hosting.** Tiap tautan
  tab jadi `/perfume-app/investasi/`. Kalau host tidak menyajikan `index.html`
  untuk permintaan direktori, **gejalanya menipu**: pindah tab dari dalam
  aplikasi tetap mulus (navigasi klien), yang gagal cuma reload dan tautan yang
  dikirim lewat chat. Laporannya akan berbunyi "kadang 404".

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
  PowerShell: `Get-CimInstance Win32_Process | Where-Object CommandLine -like
  '*serve-build*' | Stop-Process -Force`.

- **Heredoc bash yang panjang tidak stabil di shell ini.** Berkas besar ditulis
  lewat tool tulis-berkas, bukan `cat > … <<'EOF'`.
