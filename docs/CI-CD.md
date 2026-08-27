# CI / CD

Berkasnya: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

```
cepat   lint · typecheck · probe node          gagal paling awal
bundel  next build → out/ jadi artifact
layar   serve:build + tunggu:server + probe browser
kirim   out/ → repo portfolio → abbas.co.id/perfume   (HANYA push ke main)
```

`layar` memakai artifact dari `bundel`, **bukan** membangun ulang — membangun dua
kali membuka celah dua job menguji bundle yang berbeda.

## ⚠️ `kirim` mengubah situs produksi

Ia mendorong commit ke `abbas2610/personal-project-portofolio`, dan push itu
memicu webhook Hostinger. **abbas.co.id/perfume langsung berubah.**

Syaratnya: push ke `main`, ketiga job di atasnya hijau, dan secret
`PORTFOLIO_PUSH_TOKEN` ada. Tanpa secret itu job berhenti di langkah pertama
dengan pesan yang menyebut dokumen ini — bukan gagal di tengah dengan error git
yang membingungkan.

**Mematikannya:** hapus `environment: produksi`-nya lalu ubah `if:` jadi
`if: false`, atau hapus seluruh job `kirim`. Tiga job lainnya tetap berguna
sendiri.

## Yang harus disetel sekali

### 1. Repository variables — kredensial Supabase

Settings → Secrets and variables → Actions → **Variables** (bukan Secrets):

| Nama | Isi |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key dari halaman yang sama |
| `NEXT_PUBLIC_DOKUMEN_ID` | opsional; default `sos-unit-economics` |

**Kenapa variables, bukan secrets.** Anon key memang dirancang sampai ke browser —
ia ada di dalam bundle publik apa pun caranya dimasukkan. Menyimpannya sebagai
secret cuma menyembunyikannya dari orang yang membaca log CI, bukan dari orang
yang membuka halamannya, dan kerahasiaan yang bohong lebih buruk daripada tidak
ada. Yang menjaga datanya RLS — lihat [INFRASTRUKTUR.md](INFRASTRUKTUR.md).

> ⛔ `SUPABASE_SERVICE_ROLE_KEY` **tidak boleh** masuk ke workflow ini dalam
> bentuk apa pun. Ia melewati seluruh RLS, dan job `bundel` menuliskan
> lingkungannya ke dalam berkas yang dipublikasikan.

Kalau variables ini kosong, `bundel` **gagal dengan sengaja** — dan yang diperiksa
adalah **nilai variabelnya benar-benar ada di dalam bundle**, bukan sekadar kata
`supabase.co`. Versi pertama pemeriksa itu mencari kata tersebut dan lolos pada
jalan CI pertama, padahal variables-nya belum diset: pustaka
`@supabase/supabase-js` memuat string itu di dalam kodenya sendiri. Bundle tanpa
kredensial tetap jalan — dalam mode lokal, tanpa sinkronisasi tim — dan itu
kegagalan paling sulit dilihat yang bisa dihasilkan pipeline ini: tidak ada error,
halamannya normal, dan angka yang diketik satu orang tidak pernah sampai ke yang
lain. Lebih baik CI merah hari ini daripada rapat yang salah minggu depan.

### 2. `PORTFOLIO_PUSH_TOKEN` — Secret (kali ini betul-betul rahasia)

Fine-grained personal access token yang boleh menulis ke repo portfolio:

1. GitHub → Settings → Developer settings → Personal access tokens →
   **Fine-grained tokens** → Generate new token
2. Repository access → **Only select repositories** →
   `abbas2610/personal-project-portofolio`
3. Repository permissions → **Contents: Read and write**. Tidak ada yang lain.
4. Salin, lalu simpan di repo ini: Settings → Secrets and variables → Actions →
   **Secrets** → `PORTFOLIO_PUSH_TOKEN`

Token kedaluwarsa tanpa pemberitahuan. Gejalanya: `kirim` gagal di langkah
checkout dengan 404 — bukan 401 — karena GitHub menyembunyikan keberadaan repo
dari token yang tidak berhak.

## Bukti setelah deploy

`kirim` tidak percaya "push berhasil". Ia menunggu **penanda versi** di
`/perfume-app/versi-ci.txt` cocok dengan SHA commit ini, dengan polling — bukan
`sleep`. Sekadar memeriksa halamannya 200 tidak membuktikan apa pun: halamannya
sudah 200 sebelum deploy juga.

Lalu tiga lapis pemeriksaan:

| Yang diperiksa | Kenapa |
| --- | --- |
| `/perfume/`, `/perfume-app/index.html`, `/perfume-app/unit-economics/index.html` | pintu yang dipakai orang, dan **satu tab dalam** |
| `/`, `/sm/`, `/whitespace/` | deploy portfolio menimpa `public/` — tetangga wajib ikut diperiksa |
| `/perfume-app/ngawur-xyz/index.html` harus 404 | kontrol negatif; server yang menjawab 200 untuk apa pun juga lulus semua baris di atas |

> ⚠️ Ketiganya menyebut `index.html`, dan itu bukan kelalaian: `abbas.co.id`
> dilayani proses Next yang menyajikan berkas `public/` hanya pada path persisnya.
> `/perfume-app/` → 404, `/perfume-app/index.html` → 200. Sudah diukur; lihat
> [INFRASTRUKTUR.md](INFRASTRUKTUR.md).

## Daftar probe tidak ditulis di sini

Dan itu disengaja. Daftar nama yang ditulis tangan akan jadi basi tanpa ada yang
sadar — di repo tetangga, satu berkas probe hidup berbulan-bulan tanpa pernah
terdaftar: tiga belas klaim yang tidak pernah dijalankan siapa pun, sementara CI
tetap hijau.

`scripts/jalankan-probe.mjs` **menemukan** probenya dari isi `scripts/`, dan
menggolongkannya dari isinya (yang mengimpor `playwright` = butuh layar).
Menambah berkas `probe-*.mjs` otomatis menambahkannya ke CI.

> ⚠️ Helper yang dipakai bersama probe **harus berawalan `lib-`**. Berkas bernama
> `probe-sesuatu.mjs` akan ikut dijalankan sebagai probe dan **lolos**, karena ia
> cuma mengekspor fungsi lalu keluar dengan kode 0. Satu baris hijau yang tidak
> menguji apa pun adalah bentuk kegagalan yang paling sulit dilihat.

## Menjalankan ulang seluruh rantai secara lokal

```bash
npm run lint && npm run typecheck && npm run probe:data
npm run build
npm run serve:build &
npm run tunggu:server
npm run probe:layar
```

Sama persis dengan yang dijalankan CI, kecuali job `kirim`.
