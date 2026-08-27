/**
 * tunggu-server.mjs — tunggu server uji siap, LALU buktikan ia jujur.
 *
 * Dua hal, dan yang kedua yang penting.
 *
 * ## 1. Menunggu dengan polling, bukan `sleep`
 *
 * `sleep 15` di CI punya dua sisi buruk sekaligus: kalau servernya siap dalam 3
 * detik, dua belas detik terbuang di tiap jalan; kalau runner-nya lambat dan
 * butuh 20 detik, probe pertama menembak server yang belum ada dan gagalnya
 * terbaca seperti UI rusak. Polling menghilangkan dua-duanya.
 *
 * ## 2. Server yang menjawab 200 untuk apa pun membuat SELURUH probe tak bermakna
 *
 * Ini kontrol negatif untuk seluruh lapisan probe layar di atasnya. Sebelum satu
 * pun probe layar dipercaya, tiga hal dibuktikan:
 *
 *   a. `<base>/unit-economics/index.html` → 200  (server benar-benar menyajikan halaman)
 *   b. `<base>/ngawur-xyz/index.html`     → 404  (tidak menjawab 200 untuk apa pun)
 *   c. path yang sama tanpa prefiks `/perfume-app` → 404 (basePath benar-benar aktif)
 *
 * (b) dan (c) adalah kontrol negatifnya. Tanpa keduanya (a) tidak membuktikan
 * apa pun: server yang mengembalikan 200 untuk segala hal juga lulus (a) — dan
 * itu persis yang terjadi kalau `basePath` diam-diam hilang dari next.config.ts,
 * yang gagalnya baru terlihat setelah bundle mendarat di repo portfolio.
 *
 * ```bash
 * node scripts/tunggu-server.mjs [http://localhost:4880/perfume-app] [detikTimeout]
 * ```
 */
const BASE = (process.argv[2] ?? "http://localhost:4880/perfume-app").replace(/\/+$/, "");
const BATAS_DETIK = Number(process.argv[3] ?? 60);

/**
 * Halaman kanari — dan `index.html`-nya ditulis eksplisit dengan sengaja.
 *
 * `serve-build.mjs` tidak me-resolve trailing slash, persis seperti hosting
 * statis. Meminta `/unit-economics/` akan 404 di lokal DAN di produksi;
 * menambal servernya supaya menerimanya akan membuat seluruh probe layar
 * menguji server yang lebih pemaaf daripada yang sungguhan.
 */
const KANARI = "/unit-economics/index.html";

async function status(url) {
  try {
    const r = await fetch(url, { redirect: "manual" });
    return r.status;
  } catch {
    return 0; // server belum mengangkat socket
  }
}

/* ── 1. tunggu siap ───────────────────────────────────────────────────────── */
const tenggat = Date.now() + BATAS_DETIK * 1000;
let kode = 0;
let percobaan = 0;
while (Date.now() < tenggat) {
  percobaan++;
  kode = await status(BASE + KANARI);
  if (kode === 200) break;
  await new Promise((r) => setTimeout(r, 250));
}

if (kode !== 200) {
  console.error(
    `GAGAL  server tidak siap dalam ${BATAS_DETIK}s — ${BASE}${KANARI} menjawab ` +
      `${kode || "tidak ada koneksi"}.\n` +
      `       Kalau ini di CI: pastikan \`npm run build\` sudah jalan dan out/ terbawa.`,
  );
  process.exit(1);
}
console.log(`  ok  server siap setelah ${percobaan} polling — ${BASE}${KANARI} → 200`);

/* ── 2. kejujuran server ──────────────────────────────────────────────────── */
const akar = new URL(BASE).origin;
let gagal = 0;

for (const [url, harus, kenapa] of [
  [`${BASE}/ngawur-xyz-tidak-ada/index.html`, 404, "halaman ngawur HARUS 404"],
  [`${akar}${KANARI}`, 404, "tanpa prefiks /perfume-app HARUS 404 — basePath aktif"],
]) {
  const k = await status(url);
  const lolos = k === harus;
  if (!lolos) gagal++;
  console.log(
    `${lolos ? "  ok  " : "GAGAL "} [kontrol negatif] ${url} → ${k} (harus ${harus}) — ${kenapa}`,
  );
}

if (gagal > 0) {
  console.error(
    "\nServer uji tidak berperilaku seperti produksi. Probe layar apa pun di " +
      "atasnya TIDAK bermakna: ia bisa lulus untuk halaman yang mati setelah deploy.",
  );
  process.exit(1);
}
console.log("Server siap dan jujur.");
