/**
 * Server statis untuk hasil `next build` (output: export), meniru produksi
 * sedekat mungkin: di-mount di /perfume-app persis seperti `basePath` aplikasi,
 * yang di produksi adalah folder `public/perfume-app/` di repo portfolio.
 *
 * ## ⚠️ Soal trailing slash — baca sebelum menyentuh berkas ini
 *
 * `trailingSlash: true` membuat tiap tautan tab berbentuk `/perfume-app/investasi/`.
 * Apakah itu hidup di produksi bergantung pada satu hal yang **belum pernah
 * dibuktikan di hosting sungguhan**: apakah server menyajikan `index.html` untuk
 * permintaan direktori (DirectoryIndex). Apache dan LiteSpeed melakukannya secara
 * bawaan, dan Hostinger memakai keduanya — jadi server uji ini melakukannya juga.
 *
 * Kalau ternyata TIDAK, gejalanya sangat spesifik dan mudah salah didiagnosis:
 * berpindah tab dari dalam aplikasi tetap mulus (Next menavigasi di sisi klien),
 * tapi **memuat ulang halaman atau membuka tautan tab yang dikirim lewat chat
 * menghasilkan 404.** Cara memastikannya ada di docs/INFRASTRUKTUR.md →
 * "Yang harus diperiksa pada deploy pertama".
 *
 * Yang TIDAK dilakukan server ini: menyajikan `index.html` untuk path yang tidak
 * ada. Itu yang membuat kontrol negatif `tunggu-server.mjs` bermakna — server
 * yang menjawab 200 untuk apa pun membuat seluruh probe layar tak berarti.
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
  p = p.slice(PREFIX.length) || "/";
  /* Permintaan direktori → index.html di dalamnya, meniru DirectoryIndex.
     Hanya untuk path yang BERAKHIR garis miring; `/investasi` tanpa garis miring
     tetap 404, persis seperti hosting statis tanpa aturan rewrite. */
  if (p.endsWith("/")) p += "index.html";

  try {
    const buf = await readFile(join(ROOT, p));
    res.writeHead(200, { "content-type": TIPE[extname(p)] ?? "application/octet-stream" });
    res.end(buf);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("404");
  }
}).listen(PORT, () => console.log(`SIAP http://localhost:${PORT}${PREFIX}/`));
