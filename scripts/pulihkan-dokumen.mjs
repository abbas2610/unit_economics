/**
 * pulihkan-dokumen.mjs — mengembalikan payload dokumen tim ke baris Supabase.
 *
 * ```bash
 * npm run pulih:dokumen -- referensi/pemulihan/2026-07-27-sos-unit-economics.json
 * npm run pulih:dokumen -- <berkas> --tulis
 * ```
 *
 * ## Kenapa ini ada, dan kenapa bentuknya seperti ini
 *
 * Karena insiden yang membuatnya dibutuhkan adalah **satu perintah `curl` yang
 * dimaksudkan sebagai pembacaan**. `POST` ke PostgREST adalah
 * `INSERT … ON CONFLICT DO UPDATE`, jadi kolom `payload` yang ikut terkirim
 * menimpa isi yang ada — dan seluruh angka tim hilang tanpa satu pun error.
 * Riwayat lengkapnya di docs/SESI-2026-08-27.md.
 *
 * Berkas ini adalah jawaban atas insiden itu: satu-satunya jalan menulis ke
 * baris produksi yang **tidak bisa** mengulanginya, karena setiap sifat yang
 * membuat insiden itu mungkin sudah ditutup di sini.
 *
 *   - **`PATCH`, tidak pernah `POST`.** `PATCH` hanya menyentuh kolom yang
 *     disebut, dan hanya baris yang cocok filternya. Ia tidak bisa membuat baris
 *     baru, jadi salah ketik pada id menghasilkan "0 baris tersentuh" — bukan
 *     baris kedua yang diam-diam jadi sampah.
 *   - **Kering secara bawaan.** Tanpa `--tulis` ia membaca, membandingkan, dan
 *     mencetak — tidak mengirim apa pun. Perintah diagnosis yang menulis adalah
 *     penyebab insidennya; di sini diagnosis dan penulisan adalah dua perintah
 *     berbeda, dan yang berbahaya butuh diketik dengan sengaja.
 *   - **Cadangkan dulu, baru tulis.** Isi baris yang ada disimpan ke berkas
 *     sebelum satu byte pun dikirim. Kalau pemulihan ini sendiri ternyata salah,
 *     yang ditimpanya masih ada.
 *   - **Menolak menimpa data yang hidup.** Kalau baris tujuan berisi dokumen
 *     yang masuk akal — bukan `{"uji": true}` dan bukan kosong — ia berhenti dan
 *     menuntut `--paksa`. Alat pemulihan yang bisa merusak data adalah alat yang
 *     akan merusak data.
 *   - **Divalidasi sebelum dikirim.** Muatannya dijalankan lewat `bacaDokumen()`
 *     yang sama dengan yang dipakai aplikasi. Payload yang tidak terbaca akan
 *     jatuh ke angka contoh di layar TANPA error — jadi yang tidak lolos di sini
 *     tidak pernah berangkat.
 *
 * ⚠️ Ini bukan probe. Namanya sengaja tidak berawalan `probe-`, supaya
 * `jalankan-probe.mjs` tidak menemukannya dan menjalankannya di CI. Yang menjaga
 * sifat-sifat di atas `scripts/probe-pemulihan.mts`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

/* ── argumen ──────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const bendera = new Set(argv.filter((a) => a.startsWith("--")));
const berkas = argv.find((a) => !a.startsWith("--"));

const TULIS = bendera.has("--tulis");
const PAKSA = bendera.has("--paksa");

if (!berkas) {
  console.error(
    "Pemakaian: npm run pulih:dokumen -- <berkas.json> [--tulis] [--paksa]\n" +
      "\n" +
      "  <berkas.json>  muatan yang dipulihkan; lihat referensi/pemulihan/\n" +
      "  --tulis        benar-benar kirim PATCH. Tanpa ini: kering, tidak mengirim apa pun.\n" +
      "  --paksa        izinkan menimpa baris yang isinya TIDAK rusak. Jarang benar.\n",
  );
  process.exit(2);
}

if (!existsSync(berkas)) {
  console.error(`GAGAL  berkas tidak ada: ${berkas}`);
  process.exit(1);
}

/* ── kredensial ───────────────────────────────────────────────────────────── */

/** `.env.local` dibaca manual — skrip ini tidak lewat bundler Next. */
function dariEnvLocal(kunci) {
  if (!existsSync(".env.local")) return undefined;
  for (const baris of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(baris);
    if (m && m[1] === kunci) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}

/** `||`, bukan `??` — variable CI yang belum diset datang sebagai string kosong. */
const env = (k) => process.env[k] || dariEnvLocal(k);

const URL_SUPABASE = env("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const ID_DOKUMEN = env("NEXT_PUBLIC_DOKUMEN_ID") || "sos-unit-economics";

if (!URL_SUPABASE || !ANON) {
  console.error(
    "GAGAL  NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY tidak ada.\n" +
      "       Salin .env.example jadi .env.local lalu isi dari Supabase → Project Settings → API.",
  );
  process.exit(1);
}

const kepala = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const rest = (jalur, opsi = {}) =>
  fetch(`${URL_SUPABASE}/rest/v1/${jalur}`, { ...opsi, headers: { ...kepala, ...opsi.headers } });

/* ── muatan yang mau dipulihkan ───────────────────────────────────────────── */

let muatan;
try {
  muatan = JSON.parse(readFileSync(berkas, "utf8"));
} catch (e) {
  console.error(`GAGAL  ${berkas} bukan JSON yang sah — ${e.message}`);
  process.exit(1);
}

/**
 * Validasi lewat jalur yang SAMA dengan aplikasi.
 *
 * `bacaDokumen()` sengaja tidak pernah melempar: payload yang tidak dikenali
 * menghasilkan dokumen awal, bukan stack trace. Sifat itu benar untuk aplikasi
 * dan berbahaya di sini — memulihkan payload yang tidak terbaca akan tampak
 * berhasil, lalu tim membuka halaman berisi angka contoh. Jadi yang diperiksa
 * bukan "apakah ia melempar", melainkan **apakah hasilnya masih dokumen awal**.
 */
async function periksaTerbaca(mentah) {
  const { bacaDokumen } = await import("../src/contexts/dokumen/domain/migrasi.ts");
  const { dokumenAwal } = await import("../src/contexts/dokumen/domain/dokumen.ts");
  const dok = bacaDokumen(mentah);
  const identikDenganAwal = JSON.stringify(dok) === JSON.stringify(dokumenAwal());
  return { dok, identikDenganAwal };
}

const { dok, identikDenganAwal } = await periksaTerbaca(muatan);

console.log(`\nProject : ${URL_SUPABASE}`);
console.log(`Dokumen : ${ID_DOKUMEN}`);
console.log(`Sumber  : ${berkas}\n`);

if (identikDenganAwal) {
  console.error(
    "GAGAL  Muatan ini terbaca sebagai DOKUMEN AWAL — artinya tidak satu pun\n" +
      "       angkanya dikenali migrasi. Memulihkannya sama dengan menulis angka\n" +
      "       contoh ke baris tim, yang persis kerusakan yang sedang diperbaiki.",
  );
  process.exit(1);
}

console.log("Muatan terbaca:");
console.log(`  kurs                ${dok.asumsi.kurs}`);
console.log(`  OEM kecil / besar   ${dok.asumsi.oemKecil} / ${dok.asumsi.oemBesar}`);
console.log(`  waste / susut       ${dok.asumsi.wastePct}% / ${dok.campuran.susutPct}%`);
console.log(`  varian              ${dok.varian.length}`);
console.log(`  supplier kecil      ${dok.supplierKecil.length}`);
console.log(`  supplier besar      ${dok.supplierBesar.length}`);
console.log(`  harga kecil / besar ${dok.harga.kecil} / ${dok.harga.besar}`);

/* ── keadaan baris sekarang ───────────────────────────────────────────────── */

const r = await rest(`unit_economics?id=eq.${ID_DOKUMEN}&select=payload,updated_at`);
if (!r.ok) {
  console.error(`\nGAGAL  membaca baris tujuan — HTTP ${r.status} ${await r.text()}`);
  process.exit(1);
}
const baris = await r.json();

if (baris.length === 0) {
  console.error(
    `\nGAGAL  baris \`${ID_DOKUMEN}\` tidak terlihat.\n` +
      "       Bisa berarti barisnya memang belum ada, atau kebijakan RLS menyembunyikannya.\n" +
      "       Skrip ini sengaja TIDAK bisa membuat baris baru — pakai migrasi untuk itu.",
  );
  process.exit(1);
}

const sekarang = baris[0].payload;
console.log(`\nBaris sekarang (updated_at ${baris[0].updated_at}):`);
console.log(`  ${JSON.stringify(sekarang).slice(0, 200)}`);

/**
 * Apakah baris tujuan berisi sesuatu yang layak dijaga.
 *
 * Ukurannya bukan "apakah ada isinya" melainkan apakah isinya punya bentuk
 * dokumen sama sekali. `{"uji": true}` — kerusakan dari insiden — tidak punya.
 */
const punyaBentukDokumen = (p) =>
  !!p &&
  typeof p === "object" &&
  ["base", "asumsi", "smallSuppliers", "supplierKecil", "versi"].some((k) => k in p);

const barisHidup = punyaBentukDokumen(sekarang);

if (barisHidup && !PAKSA) {
  console.error(
    "\nBERHENTI  Baris tujuan berisi dokumen yang tampak utuh, bukan kerusakan.\n" +
      "          Memulihkan di atasnya akan MENGHAPUS apa pun yang ada di sana —\n" +
      "          termasuk sunting yang dibuat tim setelah cadangan ini diambil.\n" +
      "\n" +
      "          Kalau memang itu yang diinginkan, ulangi dengan --paksa.",
  );
  process.exit(1);
}

/* ── kering ───────────────────────────────────────────────────────────────── */

if (!TULIS) {
  console.log(
    "\nKERING  Tidak ada yang dikirim.\n" +
      `        Untuk benar-benar memulihkan:  npm run pulih:dokumen -- ${berkas} --tulis${PAKSA ? " --paksa" : ""}`,
  );
  process.exit(0);
}

/* ── cadangkan, lalu PATCH ────────────────────────────────────────────────── */

/* Stempel waktu diambil sekali, dipakai untuk nama berkas DAN untuk updated_at,
   supaya cadangan dan baris hasilnya bisa dipasangkan nanti. */
const stempel = new Date().toISOString();
const namaCadangan = `referensi/pemulihan/sebelum-pulih-${stempel.replace(/[:.]/g, "-")}.json`;
writeFileSync(namaCadangan, JSON.stringify({ id: ID_DOKUMEN, updated_at: baris[0].updated_at, payload: sekarang }, null, 2));
console.log(`\nCadangan isi lama → ${namaCadangan}`);

/* ⚠️ PATCH. Bukan POST, bukan upsert. Lihat komentar kepala berkas. */
const tulis = await rest(`unit_economics?id=eq.${ID_DOKUMEN}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json", Prefer: "return=representation" },
  body: JSON.stringify({ payload: muatan, updated_at: stempel }),
});

if (!tulis.ok) {
  console.error(`\nGAGAL  PATCH ditolak — HTTP ${tulis.status} ${await tulis.text()}`);
  console.error("       Isi lama TIDAK tersentuh; cadangannya tetap ada di atas.");
  process.exit(1);
}

const hasil = await tulis.json();

/* HTTP 200 tidak membuktikan barisnya berubah: PATCH yang tidak cocok dengan
   satu baris pun tetap menjawab 200 dengan larik kosong. Yang membuktikan
   isinya, dibaca ulang. */
if (!Array.isArray(hasil) || hasil.length !== 1) {
  console.error(
    `\nGAGAL  PATCH menjawab ${tulis.status} tapi menyentuh ${Array.isArray(hasil) ? hasil.length : "?"} baris, bukan 1.\n` +
      "       Biasanya berarti kebijakan RLS menyembunyikan barisnya dari update.",
  );
  process.exit(1);
}

const ulang = await rest(`unit_economics?id=eq.${ID_DOKUMEN}&select=payload,updated_at`);
const sesudah = (await ulang.json())[0];
const cocok = JSON.stringify(sesudah?.payload) === JSON.stringify(muatan);

console.log(`\n${cocok ? "PULIH" : "GAGAL"}  baris \`${ID_DOKUMEN}\` sekarang updated_at ${sesudah?.updated_at}`);
if (!cocok) {
  console.error("       Isi yang terbaca kembali TIDAK sama dengan yang dikirim.");
  process.exit(1);
}

console.log(
  "\nLangkah berikutnya — angka yang cadangan ini TIDAK punya harus diketik ulang.\n" +
    "Daftarnya di referensi/pemulihan/README.md.",
);
