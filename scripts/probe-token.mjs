/**
 * probe-token.mjs — `npm run probe:token`
 *
 * Design system hanya jadi sumber kebenaran kalau tidak ada jalan memutarinya.
 * Satu `#3D5AF1` yang diketik langsung di komponen tidak menghasilkan error, tidak
 * merusak build, dan terlihat persis benar — sampai seseorang menyalakan tema
 * gelap dan menemukan satu kotak yang tidak ikut berubah.
 *
 * Lima aturan, masing-masing dengan kontrol negatif.
 *
 *   1. Tidak ada warna literal di `src/`
 *   2. Tidak ada nilai Tailwind arbitrer untuk warna (`bg-[#...]`)
 *   3. Nol drop shadow — kecuali lewat token `--shadow-overlay`
 *   4. Ukuran font dari skala token saja; TIDAK ADA 16px
 *   5. Tiap token warna terang punya pasangan gelapnya
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

let lulus = 0;
let gagal = 0;

const cek = (nama, kondisi, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const kontrol = (nama, kondisiSalah, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

/**
 * Seluruh berkas src/, disisir dari FOLDER — bukan dari `git ls-files`.
 *
 * ⚠️ Bedanya bukan gaya. `git ls-files` cuma menyebut berkas yang sudah
 * ter-index, jadi komponen BARU yang belum di-`git add` **dilewati diam-diam**:
 * probe hijau, aturan tidak diperiksa, dan tidak ada satu pun tanda di layar.
 * Justru berkas yang baru ditulis itulah yang paling mungkin membawa hex.
 */
function sisir(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) sisir(f, out);
    else if (/\.(ts|tsx|css)$/.test(e.name)) out.push(f);
  }
  return out;
}
const berkasSrc = sisir("src");

/** Buang komentar — berkas ini MENJELASKAN aturannya dan menyebut hex di prosa. */
const kodeSaja = (isi) =>
  isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* ═══════════════════════════════════════════ 1. tidak ada warna literal ══ */
console.log("\n=== 1. Tidak ada warna literal di src/ ===");

{
  const HEX = /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;
  const FUNGSI_WARNA = /\b(?:rgba?|hsla?|oklch)\s*\(/;
  const pelanggarHex = [];
  const pelanggarFungsi = [];

  for (const f of berkasSrc) {
    const kode = kodeSaja(readFileSync(f, "utf8"));
    if (HEX.test(kode)) pelanggarHex.push(f);
    if (FUNGSI_WARNA.test(kode)) pelanggarFungsi.push(f);
  }

  cek(`${berkasSrc.length} berkas src/ tanpa hex literal`, pelanggarHex.length === 0, pelanggarHex.join(", "));
  cek("tanpa rgb()/hsl()/oklch() literal", pelanggarFungsi.length === 0, pelanggarFungsi.join(", "));
}

kontrol(
  "[kontrol negatif] pendeteksi hex menyala untuk warna sungguhan",
  !/#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/.test('const c = "#3D5AF1";'),
);
kontrol(
  "[kontrol negatif] pembuangan komentar tidak ikut membutakan kode",
  !/#(?:[0-9a-fA-F]{6})\b/.test(kodeSaja('/* jangan pakai #3D5AF1 */\nconst c = "#3D5AF1";')),
);

/* ══════════════════════════════════ 2. tanpa nilai Tailwind arbitrer ══ */
console.log("\n=== 2. Tanpa nilai arbitrer untuk warna ===");

{
  /* `w-[150px]` dan `max-w-[68ch]` boleh — itu ukuran satu kali yang tidak layak
     jadi token. Yang dilarang WARNA arbitrer, karena warna punya pasangan gelap
     yang harus ikut berubah, dan nilai arbitrer tidak punya. */
  const ARBITRER_WARNA = /\b(?:bg|text|border|fill|stroke|ring|from|to|via)-\[(?:#|rgb|hsl|oklch)/;
  const pelanggar = berkasSrc.filter((f) => ARBITRER_WARNA.test(kodeSaja(readFileSync(f, "utf8"))));
  cek("tanpa bg-[#...] / text-[rgb(...)]", pelanggar.length === 0, pelanggar.join(", "));
}

kontrol(
  "[kontrol negatif] pendeteksi menyala untuk bg-[#fff]",
  !/\b(?:bg|text|border)-\[(?:#|rgb|hsl|oklch)/.test('className="bg-[#ffffff]"'),
);

/* ══════════════════════════════════════════════ 3. nol drop shadow ══ */
console.log("\n=== 3. Nol drop shadow ===");

{
  /* Satu-satunya bayangan yang boleh: `var(--shadow-overlay)`, untuk elemen yang
     memang harus terbaca melayang di atas isi halaman. Selebihnya, pemisahan
     visual memakai garis 1px. */
  const pelanggar = [];
  for (const f of berkasSrc) {
    const kode = kodeSaja(readFileSync(f, "utf8"));
    /* Utility shadow Tailwind (shadow-md, shadow-lg, drop-shadow-*) */
    if (/\b(?:drop-)?shadow-(?:sm|md|lg|xl|2xl)\b/.test(kode)) pelanggar.push(`${f} (utility)`);
    /* box-shadow tertulis, kecuali yang memakai tokennya */
    for (const m of kode.matchAll(/box-?[Ss]hadow\s*[:=]\s*("[^"]*"|'[^']*'|[^;,}\n]+)/g)) {
      if (!m[1].includes("--shadow-overlay")) pelanggar.push(`${f} (${m[1].trim()})`);
    }
  }
  cek("tidak ada shadow selain var(--shadow-overlay)", pelanggar.length === 0, pelanggar.join(", "));
}

kontrol(
  "[kontrol negatif] pendeteksi menyala untuk shadow-lg",
  !/\b(?:drop-)?shadow-(?:sm|md|lg|xl|2xl)\b/.test('className="card shadow-lg"'),
);
kontrol(
  "[kontrol negatif] pendeteksi menyala untuk box-shadow tertulis",
  !/box-?[Ss]hadow\s*[:=]/.test('style={{ boxShadow: "0 2px 4px #000" }}'),
);

/* ═══════════════════════════════════════════ 4. skala font, tanpa 16px ══ */
console.log("\n=== 4. Skala font padat — tidak ada 16px ===");

{
  const tema = readFileSync("design-system/tokens/theme.css", "utf8");
  /* Hanya token ukuran DASAR. `--text-label--line-height` juga cocok dengan pola
     namanya, dan line-height 16px bukan ukuran font 16px — memasukkannya membuat
     probe ini gagal atas aturan yang tidak dilanggar siapa pun. */
  const ukuran = [...tema.matchAll(/--text-([a-z-]+):\s*(\d+)px/g)]
    .map((m) => ({ nama: m[1], px: Number(m[2]) }))
    .filter((u) => !u.nama.includes("--"));
  cek("token ukuran font terbaca dari theme.css", ukuran.length >= 5, `${ukuran.length} token`);
  cek(
    "tidak ada token 16px",
    ukuran.every((u) => u.px !== 16),
    ukuran.map((u) => `${u.nama}:${u.px}`).join(" "),
  );

  const skala = [...new Set(ukuran.map((u) => u.px))].sort((a, b) => a - b);
  cek(
    "skalanya 11/12/13/14/18 (+ 22 khusus KPI)",
    JSON.stringify(skala) === JSON.stringify([11, 12, 13, 14, 18, 22]),
    skala.join("/"),
  );

  /* Ukuran font arbitrer di komponen memutari skala ini sepenuhnya. */
  const pelanggar = berkasSrc.filter((f) => /\btext-\[\d+px\]/.test(kodeSaja(readFileSync(f, "utf8"))));
  cek("tanpa text-[NNpx] di komponen", pelanggar.length === 0, pelanggar.join(", "));
}

kontrol("[kontrol negatif] pendeteksi menyala untuk text-[16px]", !/\btext-\[\d+px\]/.test('className="text-[16px]"'));

/* ═════════════════════════════════ 5. tiap token terang punya pasangan gelap ══ */
console.log("\n=== 5. Pasangan tema gelap lengkap ===");

{
  const tema = readFileSync("design-system/tokens/theme.css", "utf8");
  const blokTerang = tema.slice(tema.indexOf("@theme {"), tema.indexOf(":root:where(.dark)"));
  /* Dipotong tepat sebelum blok cetak. Kalau blok cetak ikut terbaca sebagai
     "tema gelap", token yang DIHAPUS dari tema gelap tapi kebetulan ada di palet
     cetak akan lolos — dan yang rusak cuma terlihat oleh yang memakai tema
     gelap, bukan oleh yang menjalankan probe. */
  const awalGelap = tema.indexOf(":root:where(.dark)");
  const akhirGelap = tema.indexOf("@media print", awalGelap);
  const blokGelap = tema.slice(awalGelap, akhirGelap > 0 ? akhirGelap : undefined);

  const warnaTerang = [...blokTerang.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]);
  const warnaGelap = new Set([...blokGelap.matchAll(/--color-([a-z-]+):/g)].map((m) => m[1]));

  cek("token warna terbaca", warnaTerang.length > 20, `${warnaTerang.length} token terang`);

  const hilang = warnaTerang.filter((n) => !warnaGelap.has(n));
  cek(
    "setiap token warna didefinisikan ulang di tema gelap",
    hilang.length === 0,
    hilang.length ? `belum ada pasangan gelap: ${hilang.join(", ")}` : "",
  );

  /* `--color-primary` SENGAJA bernilai sama di kedua tema — itu satu-satunya
     cara satu pasangan lolos kontras di terang dan gelap tanpa dua definisi.
     Diperiksa supaya keputusannya tidak hilang saat seseorang "merapikan". */
  const primerTerang = /--color-primary:\s*(#[0-9a-f]{6})/.exec(blokTerang)?.[1];
  const primerGelap = /--color-primary:\s*(#[0-9a-f]{6})/.exec(blokGelap)?.[1];
  cek(
    "--color-primary sengaja identik di terang & gelap",
    Boolean(primerTerang) && primerTerang === primerGelap,
    `${primerTerang} vs ${primerGelap}`,
  );

  cek(
    "globals.css mengimpor token, bukan mendefinisikan warnanya sendiri",
    readFileSync("src/app/globals.css", "utf8").includes("design-system/tokens/theme.css"),
  );
}

kontrol(
  "[kontrol negatif] pemeriksa pasangan gelap menyala kalau ada yang hilang",
  ["a", "b"].filter((n) => !new Set(["a"]).has(n)).length === 0,
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
