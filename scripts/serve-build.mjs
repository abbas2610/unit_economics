/**
 * Server statis untuk hasil `next build` (output: export), meniru produksi
 * sedekat mungkin: di-mount di /perfume-app persis seperti `basePath` aplikasi,
 * yang di produksi adalah folder `public/perfume-app/` di repo portfolio.
 *
 * ## ⚠️ Sengaja TIDAK me-resolve trailing slash — dan ini SUDAH DIUKUR
 *
 * Di produksi, bundle ini tinggal di `public/perfume-app/` pada aplikasi Next
 * milik repo portfolio, dan **Next menyajikan berkas `public/` hanya pada path
 * PERSISNYA.** Tidak ada directory index, dan itu perilaku Next — bukan setelan
 * hosting yang bisa ditambal `.htaccess`.
 *
 * Diukur langsung terhadap produksi:
 *
 *     /perfume-app/index.html            → 200
 *     /perfume-app/                      → 404   (X-Powered-By: Next.js)
 *     /sm-app/produksi/index.html        → 200
 *     /sm-app/produksi/                  → 404
 *
 * Server uji ini karena itu berperilaku sama: hanya path persis. Versi sebelumnya
 * sempat me-resolve `/foo/` jadi `/foo/index.html` — dan itu membuat seluruh probe
 * layar lulus untuk halaman yang 404 setelah deploy. **Server uji yang lebih
 * permisif daripada produksi lebih buruk daripada tidak ada server uji.**
 *
 * Konsekuensinya: probe layar menyebut `index.html` sendiri, mis.
 * `/perfume-app/unit-economics/index.html`. Itu memang yang disajikan produksi.
 *
 * ```bash
 * node scripts/serve-build.mjs ./out 4880
 * ```
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";

const ROOT = process.argv[2] ?? "./out";
const PORT = Number(process.argv[3] || 4880);
const PREFIX = "/perfume-app";

const TIPE = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith(PREFIX)) {
    /* Kontrol negatif tunggu-server.mjs bergantung pada 404 di sini: kalau
       server ini menjawab tanpa prefiks, hilangnya `basePath` dari
       next.config.ts tidak akan tertangkap siapa pun sampai setelah deploy. */
    res.writeHead(404).end("bukan " + PREFIX);
    return;
  }
  /* Tidak ada pemetaan apa pun — path persis, titik. Bahkan akar tidak dipetakan
     ke index.html, karena di produksi `/perfume-app/` juga 404. Satu kemudahan
     kecil di sini akan jadi satu kelas kegagalan yang tidak tertangkap di sana. */
  p = p.slice(PREFIX.length);

  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TIPE[extname(p)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("404");
  }
}).listen(PORT, () => console.log(`SIAP http://localhost:${PORT}${PREFIX}/index.html`));
