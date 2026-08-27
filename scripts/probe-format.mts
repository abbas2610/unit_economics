/**
 * probe-format.mts — `npm run probe:format`
 *
 * Menjaga tiga hal yang kalau rusak tidak menghasilkan satu pun error:
 *
 *   1. **Tidak ada `Intl` di jalur format.** Halaman ini dirender sekali di Node
 *      saat `next build` lalu di-hydrate browser; data ICU kedua runtime bisa
 *      berbeda, dan hasilnya hydration mismatch — bukan angka yang salah,
 *      melainkan seluruh pohon React yang dibuang dan dirender ulang.
 *   2. **Setiap angka berarah bertanda.** Warna lapisan kedua; yang buta warna
 *      merah-hijau membaca tandanya. Formatter yang lupa tandanya terlihat
 *      baik-baik saja di screenshot.
 *   3. **Pemisah ribuan & desimal Indonesia.** `Rp1,250` dan `Rp1.250` berbeda
 *        seribu kali lipat, dan keduanya terlihat seperti angka yang wajar.
 *
 * Tiap kelompok punya KONTROL NEGATIF: implementasi yang salah dijalankan lewat
 * pemeriksa yang sama, dan ia HARUS ditolak. Kontrol yang ikut lolos berarti
 * ujinya tidak menguji apa pun — dan itu tidak terlihat dari baris hijaunya.
 */
import { readFileSync } from "node:fs";
import {
  angka,
  arah,
  arahBiaya,
  delta,
  desimal,
  liter,
  pcs,
  persen,
  pcsDelta,
  persenDelta,
  poinDelta,
  rupiah,
  rupiahRingkas,
  usd,
} from "@/bersama/format";
import { bacaAngka, jepit, tulisAngka } from "@/bersama/masukan";

let lulus = 0;
let gagal = 0;

const cek = (nama: string, kondisi: boolean, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const sama = (nama: string, dapat: unknown, harus: unknown) =>
  cek(nama, Object.is(dapat, harus), `dapat ${JSON.stringify(dapat)}, harus ${JSON.stringify(harus)}`);

/** `kondisiSalah` HARUS false. Kalau true, ujinya tidak bermakna. */
const kontrol = (nama: string, kondisiSalah: boolean, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

/* ═══════════════════════════════════════ 1. tidak ada Intl di jalur format ══ */
console.log("\n=== 1. Tanpa Intl ===");

for (const berkas of ["src/bersama/format.ts", "src/bersama/masukan.ts"]) {
  const isi = readFileSync(berkas, "utf8");
  /* Komentar dibuang dulu: kedua berkas MENJELASKAN kenapa Intl tidak dipakai,
     dan probe yang jatuh karena dokumentasi keputusannya sendiri akan dimatikan
     orang — bukan diperbaiki. Yang dicari KODE. */
  const kode = isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  cek(`${berkas} tidak menyentuh Intl`, !/\bIntl\b/.test(kode));
  cek(`${berkas} tidak memakai toLocaleString`, !/toLocale(String|DateString|TimeString)/.test(kode));
}

kontrol(
  "[kontrol negatif] pembuangan komentar tidak ikut membutakan kode",
  !/\bIntl\b/.test(
    "/* jangan pakai Intl */\nconst x = new Intl.NumberFormat();".replace(/\/\*[\s\S]*?\*\//g, ""),
  ),
);

/* Seluruh lapisan tampilan ikut diperiksa: satu `toLocaleString` di komponen
   melahirkan hydration mismatch yang persis sama, dan tidak ada yang membaca
   `format.ts` saat menulis tabel baru. */
console.log("\n=== 1b. Tanpa Intl di seluruh src/ ===");
{
  /* Disisir dari FOLDER, bukan `git ls-files`: yang kedua cuma menyebut berkas
     yang sudah ter-index, jadi komponen baru yang belum di-`git add` dilewati
     diam-diam — dan berkas yang baru ditulis itulah yang paling mungkin membawa
     `toLocaleString`. */
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const sisir = (dir: string, out: string[] = []): string[] => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name).replace(/\\/g, "/");
      if (e.isDirectory()) sisir(f, out);
      else if (/\.tsx?$/.test(e.name)) out.push(f);
    }
    return out;
  };
  const daftar = sisir("src");
  const pelanggar: string[] = [];
  for (const f of daftar) {
    const kode = readFileSync(f, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    if (/toLocale(String|DateString|TimeString)|\bnew Intl\./.test(kode)) pelanggar.push(f);
  }
  cek(
    `${daftar.length} berkas src/ bebas Intl & toLocaleString`,
    pelanggar.length === 0,
    pelanggar.join(", "),
  );
  kontrol(
    "[kontrol negatif] pemeriksanya menangkap toLocaleString kalau ada",
    !/toLocale(String|DateString|TimeString)/.test("const x = n.toLocaleString('id-ID');"),
  );
}

/* ═════════════════════════════════════════════════════════ 2. angka dasar ══ */
console.log("\n=== 2. Rupiah & angka ===");

sama("rupiah bulat", rupiah(10_000_000), "Rp10.000.000");
sama("rupiah negatif", rupiah(-2_500), "-Rp2.500");
sama("rupiah nol", rupiah(0), "Rp0");
sama("rupiah membulatkan, bukan memotong", rupiah(1_234.6), "Rp1.235");
sama("angka tanpa prefiks", angka(4_574_150), "4.574.150");
sama("desimal 2 digit", desimal(1234.5, 2), "1.234,50");
sama("desimal membulatkan ke atas", desimal(0.005, 2), "0,01");
sama("usd selalu 2 desimal", usd(2.4), "$2,40");
sama("usd nilai bulat tetap 2 desimal", usd(3), "$3,00");
sama("pcs", pcs(2125), "2.125 pcs");
sama("liter membuang nol di belakang", liter(75), "75 L");
sama("liter menyimpan desimal yang berarti", liter(75.4), "75,4 L");
sama("persen tanpa tanda", persen(30), "30%");
sama("rupiah ringkas miliar", rupiahRingkas(2_600_000_000), "Rp2,60 M");
sama("rupiah ringkas juta", rupiahRingkas(50_000_000), "Rp50 jt");

cek(
  "pemisah ribuan tepat di kelipatan tiga",
  angka(1_000) === "1.000" && angka(100_000) === "100.000" && angka(999) === "999",
);
kontrol("[kontrol negatif] pemeriksa menolak pemisah salah tempat", "1.00.0" === "1.000");

/* ══════════════════════════════════════════════ 3. angka BERARAH bertanda ══ */
console.log("\n=== 3. Angka berarah wajib bertanda ===");

sama("delta positif", delta(1_250_000), "+Rp1.250.000");
sama("delta negatif memakai MINUS SIGN", delta(-340_000), "−Rp340.000");
sama("delta nol tidak diberi tanda", delta(0), "Rp0");
sama("persenDelta positif", persenDelta(12.4), "+12,4%");
sama("persenDelta negatif", persenDelta(-3.1), "−3,1%");
sama("persenDelta nol", persenDelta(0), "0%");
sama("poinDelta menyebut satuannya", poinDelta(4), "+4 poin");
sama("pcsDelta menyebut satuannya", pcsDelta(1234), "+1.234 pcs");
sama("pcsDelta negatif", pcsDelta(-450), "−450 pcs");
sama("pcsDelta nol", pcsDelta(0), "0 pcs");
/* ⚠️ Break-even dihitung dalam PCS. Memakai delta() di sana menulis "+Rp1.234"
   untuk selisih seribu dua ratus botol — angka benar, satuan berbohong, dan
   satuan yang berbohong tidak menghasilkan satu pun error. */
cek("pcsDelta tidak memakai prefiks Rp", !pcsDelta(1234).includes("Rp"), pcsDelta(1234));
sama("poinDelta negatif", poinDelta(-2.5), "−2,5 poin");

cek(
  "minus memakai U+2212, bukan hyphen",
  delta(-1).includes("−") && !delta(-1).includes("-"),
  JSON.stringify(delta(-1)),
);
kontrol(
  "[kontrol negatif] pemeriksa menolak hyphen sebagai minus",
  "-Rp1".includes("−"),
);

cek("arah naik/turun/datar", arah(5) === "naik" && arah(-5) === "turun" && arah(0) === "datar");
cek(
  "arahBiaya TERBALIK — biaya naik itu kabar buruk",
  arahBiaya(5) === "turun" && arahBiaya(-5) === "naik" && arahBiaya(0) === "datar",
);
kontrol(
  "[kontrol negatif] arahBiaya benar-benar berbeda dari arah",
  arahBiaya(5) === arah(5),
);

/* ═══════════════════════════════════════════════════════ 4. baca masukan ══ */
console.log("\n=== 4. Baca & tulis kotak isian ===");

sama("baca titik ribuan", bacaAngka("7.000.000"), 7_000_000);
sama("baca koma desimal", bacaAngka("2,45"), 2.45);
sama("baca campuran titik & koma", bacaAngka("1.234,5"), 1234.5);
sama("baca kosong jadi nol", bacaAngka(""), 0);
sama("baca sampah jadi nol", bacaAngka("abc"), 0);
sama("tulis ribuan", tulisAngka(7_000_000), "7.000.000");
sama("tulis desimal membuang nol", tulisAngka(2.4, 2), "2,4");
sama("tulis nol desimal", tulisAngka(10, 2), "10");
sama("jepit batas bawah", jepit(-5, 0, 100), 0);
sama("jepit batas atas", jepit(150, 0, 100), 100);

cek(
  "bolak-balik baca→tulis mempertahankan nilai",
  bacaAngka(tulisAngka(1_234_567)) === 1_234_567,
);

/* ⚠️ Urutan pemrosesan di `bacaAngka` pernah jadi bug yang mahal di kelasnya:
   kalau koma ditukar SEBELUM titik dibuang, "1.234,5" jadi "1.234.5" yang
   dibaca `parseFloat` sebagai 1,234 — salah seribu kali lipat, dan salahnya
   berupa angka yang masih masuk akal di layar. */
sama("urutan titik-lalu-koma benar", bacaAngka("1.234,5"), 1234.5);
kontrol(
  "[kontrol negatif] urutan terbalik memang menghasilkan angka yang salah",
  parseFloat("1.234,5".replace(",", ".").replace(/\./g, "")) === 1234.5,
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
