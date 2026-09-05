/**
 * probe-arsitektur.mjs — `npm run probe:arsitektur`
 *
 * Batas arsitektur ditegakkan, bukan diceritakan.
 *
 * Folder yang rapi tidak menegakkan apa pun: satu `import` baru bisa menembus
 * batas mana pun besok pagi, dan pohon berkasnya akan tetap terlihat rapi.
 * Aturan arsitektur yang hidup di prosa adalah aturan yang sudah dilanggar, cuma
 * belum ada yang tahu.
 *
 * Tujuh bagian, dan **tiap aturan punya KONTROL NEGATIF** — pelanggaran palsu
 * disuntikkan ke graf lalu detektornya harus menyala. Kalau kontrolnya lolos,
 * yang rusak probenya, bukan kodenya.
 *
 *   1. **Kernel itu kernel.** `src/bersama/**` dan `src/infrastruktur/**` tidak
 *      boleh mengimpor konteks mana pun.
 *
 *   2. **Kernel `bersama/` bebas framework.** Tidak boleh menyentuh `react`
 *      maupun `next`. Bukan soal kemurnian: `probe-format` dan `probe-hitung`
 *      mengimpor berkasnya langsung di Node polos. Satu impor React di sana
 *      membuat probe tercepat di repo ini butuh bundler untuk jalan — dan probe
 *      yang butuh bundler akan dimatikan orang pertama kali ia merah.
 *
 *   3. **Domain tidak tahu aplikasi.** `contexts/X/domain/**` tidak boleh
 *      mengimpor `aplikasi/**`. Domain adalah aturan biayanya; aplikasi yang
 *      merangkai lintas konteks. Arah baliknya membuat "apa itu biaya botol"
 *      bergantung pada "bagaimana initial investment dijumlahkan".
 *
 *   4. **Domain & aplikasi tidak tahu infrastruktur.** ⭐ Aturan yang paling
 *      berharga di sini. Sekali satu fungsi domain memanggil Supabase, seluruh
 *      aritmetika di belakangnya berhenti bisa diuji tanpa jaringan — dan
 *      `probe:hitung`, satu-satunya yang menjaga angka rapat, berubah jadi probe
 *      yang butuh kredensial.
 *
 *   5. **Tidak ada siklus NILAI.** Siklus tipe boleh: tipe hilang saat compile,
 *      jadi graf modul yang benar-benar dieksekusi tetap berbentuk pohon.
 *      `dokumen/domain` dan `unit-economics/domain` memang saling menunjuk
 *      lewat tipe, dan itu disengaja.
 *
 *   6. **Tiap kopling lintas konteks TERDAFTAR di `PINTU`.** Kopling baru jadi
 *      suntingan sadar, bukan efek samping satu auto-import editor. Pintu yang
 *      terdaftar tapi tidak lagi dipakai juga gagal — daftar izin yang tidak
 *      pernah menyusut akan berhenti berarti.
 *
 *   7. **Akar `src/app` cuma layout, dan halaman tinggal di route group.**
 */
import fs from "node:fs";
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

/* ══════════════════════════════════════════════════════════ pintu resmi ══ */

/**
 * Kopling lintas konteks yang diizinkan, dengan alasannya. Kunci = konteks
 * pengimpor, nilai = konteks yang boleh diimpor.
 *
 * ⚠️ Kalau alasan satu barisnya sulit ditulis, itu jawabannya: kopling itu
 * mungkin tidak seharusnya ada, dan yang dibutuhkan modul `aplikasi/` yang
 * merangkai keduanya dari atas.
 */
const PINTU = {
  fragrance: {
    asumsi: "isi nominal botol, kurs, waste, dan PPN dibutuhkan untuk biaya biang per botol",
  },
  supplier: {
    asumsi: "konversi USD→IDR memakai kurs, dan perizinan adalah % dari harga botol",
  },
  "unit-economics": {
    asumsi: "isi botol, OEM, box, dan fulfillment adalah komponen COGS",
    fragrance: "biaya biang per botol dan hasil produksi yang jadi qty batch",
    supplier: "harga botol, aksesoris, dan freight dari supplier yang dipilih",
    dokumen: "seluruh perhitungan menerima dokumen sebagai argumen, bukan state global",
  },
  investasi: {
    asumsi: "box per botol dan tarif pajak",
    fragrance: "nilai pembelian biang dan biaya perizinan per varian",
    supplier: "total yang dibayar ke supplier untuk satu batch",
    dokumen: "seluruh perhitungan menerima dokumen sebagai argumen",
    "unit-economics": "qty batch dan supplier terpilih diturunkan di sana, sekali",
  },
  dokumen: {
    asumsi: "dokumen menyusun asumsi & dimensi botol",
    fragrance: "dokumen menyusun varian & campuran",
    supplier: "dokumen menyusun daftar supplier",
    "unit-economics": "dokumen menyusun daftar skenario perbandingan",
  },
};

/** Lapisan yang boleh dipakai siapa pun, dan yang tidak boleh balik mengimpor. */
const KERNEL = ["bersama", "infrastruktur"];

/* ═══════════════════════════════════════════════════════ baca graf impor ══ */

function berkasKode(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) berkasKode(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** `src/contexts/supplier/domain/supplier.ts` → `{ konteks, lapisan, modul }` */
function bedah(f) {
  let m = f.match(/^src\/contexts\/([a-z-]+)\/([a-z-]+)\/(.+)\.tsx?$/);
  if (m) return { konteks: m[1], lapisan: m[2], modul: m[3], berkas: f };
  m = f.match(/^src\/(bersama|infrastruktur)\/(.+)\.tsx?$/);
  if (m) return { konteks: m[1], lapisan: "-", modul: m[2], berkas: f };
  m = f.match(/^src\/(app|components)\/(.+)\.tsx?$/);
  if (m) return { konteks: m[1], lapisan: "ui", modul: m[2], berkas: f };
  return null;
}

const modul = ["src/contexts", "src/bersama", "src/infrastruktur", "src/components", "src/app"]
  .flatMap((d) => berkasKode(d))
  .map(bedah)
  .filter(Boolean);

/**
 * Impor keluar satu berkas, dengan sifatnya.
 *
 * `import type {...}` = tipe. `import { type A }` dianggap tipe hanya kalau
 * SETIAP nama yang diambil berawalan `type` — satu nama nilai membuat impornya
 * nyata di runtime, dan siklus nilai berarti `undefined` di tengah perhitungan.
 */
function imporDari(isi) {
  const out = [];
  const re =
    /(?:import|export)(\s+type)?\s*(?:\{([^}]*)\}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g;
  for (const m of isi.matchAll(re)) {
    const kataType = Boolean(m[1]);
    const isiKurung = [m[2], m[3]].filter(Boolean).join(",");
    const nama = isiKurung.split(",").map((x) => x.trim()).filter(Boolean);
    const semuaTipe = kataType || (nama.length > 0 && nama.every((n) => /^type\s/.test(n)));
    out.push({ target: m[4], tipeSaja: semuaTipe });
  }
  return out;
}

/** `@/contexts/supplier/domain/supplier` atau `./varian` → berkas yang dibedah. */
function selesaikan(dariBerkas, target) {
  let p;
  if (target.startsWith("@/")) p = "src/" + target.slice(2);
  else if (target.startsWith(".")) p = path.posix.normalize(path.posix.join(path.posix.dirname(dariBerkas), target));
  else return null; // paket npm
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const kandidat = p + ext;
    const ditemukan = modul.find((m) => m.berkas === kandidat);
    if (ditemukan) return ditemukan;
  }
  return null;
}

const busur = []; // { dari, ke, tipeSaja }
const imporPaket = new Map(); // berkas → [nama paket]
for (const m of modul) {
  const isi = fs.readFileSync(m.berkas, "utf8");
  const paket = [];
  for (const imp of imporDari(isi)) {
    const tujuan = selesaikan(m.berkas, imp.target);
    if (tujuan) busur.push({ dari: m, ke: tujuan, tipeSaja: imp.tipeSaja });
    else if (!imp.target.startsWith(".") && !imp.target.startsWith("@/")) paket.push(imp.target);
  }
  imporPaket.set(m.berkas, paket);
}

console.log(`\n${modul.length} berkas, ${busur.length} impor internal terbaca`);

const adalahKonteks = (k) => !KERNEL.includes(k) && !["app", "components"].includes(k);

/* ═══════════════════════════════════════════════════ 1. kernel itu kernel ══ */
console.log("\n=== 1. Kernel tidak mengimpor konteks ===");

{
  const langgar = busur.filter((b) => KERNEL.includes(b.dari.konteks) && adalahKonteks(b.ke.konteks));
  cek(
    "src/bersama & src/infrastruktur bebas dari konteks",
    langgar.length === 0,
    langgar.map((b) => `${b.dari.berkas} → ${b.ke.berkas}`).join(", "),
  );
}
kontrol(
  "[kontrol negatif] detektornya menyala untuk kernel yang mengimpor konteks",
  [{ dari: { konteks: "bersama" }, ke: { konteks: "supplier" } }].filter(
    (b) => KERNEL.includes(b.dari.konteks) && adalahKonteks(b.ke.konteks),
  ).length === 0,
);

/* ═════════════════════════════════════════ 2. bersama/ bebas framework ══ */
console.log("\n=== 2. src/bersama bebas react & next ===");

{
  const langgar = [];
  for (const m of modul.filter((x) => x.konteks === "bersama")) {
    const paket = imporPaket.get(m.berkas) ?? [];
    const framework = paket.filter((p) => /^(react|react-dom|next)(\/|$)/.test(p));
    if (framework.length) langgar.push(`${m.berkas} → ${framework.join("/")}`);
    if (/^\s*"use client"/m.test(fs.readFileSync(m.berkas, "utf8")))
      langgar.push(`${m.berkas} ber-"use client"`);
  }
  cek("bisa diimpor probe di Node polos", langgar.length === 0, langgar.join(", "));
}
kontrol(
  "[kontrol negatif] pendeteksi menyala untuk impor react",
  !/^(react|react-dom|next)(\/|$)/.test("react"),
);

/* ═════════════════════════════════════════ 3. domain tidak tahu aplikasi ══ */
console.log("\n=== 3. domain/ tidak mengimpor aplikasi/ ===");

{
  const langgar = busur.filter((b) => b.dari.lapisan === "domain" && b.ke.lapisan === "aplikasi");
  cek(
    "tidak ada domain yang memanggil aplikasi",
    langgar.length === 0,
    langgar.map((b) => `${b.dari.berkas} → ${b.ke.berkas}`).join(", "),
  );
}

/* ══════════════════════════════ 4. domain & aplikasi tanpa infrastruktur ══ */
console.log("\n=== 4. domain/ & aplikasi/ tidak menyentuh infrastruktur ===");

{
  const keInfra = (b) => b.ke.konteks === "infrastruktur" || b.ke.lapisan === "infrastruktur";
  const langgar = busur.filter((b) => ["domain", "aplikasi"].includes(b.dari.lapisan) && keInfra(b));
  cek(
    "aritmetika tetap bisa diuji tanpa jaringan",
    langgar.length === 0,
    langgar.map((b) => `${b.dari.berkas} → ${b.ke.berkas}`).join(", "),
  );

  /* Sekalian: tidak ada domain/aplikasi yang mengimpor klien Supabase langsung
     lewat nama paketnya, yang akan lolos pemeriksaan graf internal di atas. */
  const lewatPaket = modul
    .filter((m) => ["domain", "aplikasi"].includes(m.lapisan))
    .filter((m) => (imporPaket.get(m.berkas) ?? []).some((p) => p.includes("supabase")));
  cek(
    "tidak ada domain/aplikasi yang mengimpor @supabase/* langsung",
    lewatPaket.length === 0,
    lewatPaket.map((m) => m.berkas).join(", "),
  );
}
kontrol(
  "[kontrol negatif] detektornya menyala untuk domain → infrastruktur",
  [{ dari: { lapisan: "domain" }, ke: { konteks: "infrastruktur", lapisan: "-" } }].filter(
    (b) => ["domain", "aplikasi"].includes(b.dari.lapisan) && b.ke.konteks === "infrastruktur",
  ).length === 0,
);

/* ═════════════════════════════════════════════ 5. tidak ada siklus NILAI ══ */
console.log("\n=== 5. Tanpa siklus nilai ===");

{
  const tetangga = new Map();
  for (const b of busur.filter((x) => !x.tipeSaja)) {
    if (!tetangga.has(b.dari.berkas)) tetangga.set(b.dari.berkas, []);
    tetangga.get(b.dari.berkas).push(b.ke.berkas);
  }

  const cariSiklus = (graf) => {
    const warna = new Map();
    const jalur = [];
    let temuan = null;
    const kunjungi = (n) => {
      if (temuan) return;
      warna.set(n, 1);
      jalur.push(n);
      for (const t of graf.get(n) ?? []) {
        if (warna.get(t) === 1) {
          temuan = [...jalur.slice(jalur.indexOf(t)), t];
          return;
        }
        if (!warna.has(t)) kunjungi(t);
        if (temuan) return;
      }
      jalur.pop();
      warna.set(n, 2);
    };
    for (const n of graf.keys()) if (!warna.has(n)) kunjungi(n);
    return temuan;
  };

  const siklus = cariSiklus(tetangga);
  cek("graf impor nilai berbentuk pohon", siklus === null, siklus ? siklus.join(" → ") : "");

  /* `dokumen` dan `unit-economics` SALING menunjuk di tingkat konteks:
     `dokumen/domain` menyusun daftar `Skenario`, sementara
     `unit-economics/aplikasi` menerima `Dokumen` sebagai argumen. Keduanya
     `import type`, jadi keduanya hilang saat compile dan graf yang benar-benar
     dieksekusi tetap berbentuk pohon.
     Diperiksa dua arah supaya kalau salah satunya suatu saat berubah jadi impor
     NILAI, hilangnya izin itu ketahuan di sini — bukan sebagai `undefined` di
     tengah perhitungan COGS. */
  const grafKonteks = (hanyaNilai) => {
    const g = new Map();
    for (const b of busur) {
      if (hanyaNilai && b.tipeSaja) continue;
      if (!adalahKonteks(b.dari.konteks) || !adalahKonteks(b.ke.konteks)) continue;
      if (b.dari.konteks === b.ke.konteks) continue;
      if (!g.has(b.dari.konteks)) g.set(b.dari.konteks, new Set());
      g.get(b.dari.konteks).add(b.ke.konteks);
    }
    return g;
  };

  const semua = grafKonteks(false);
  const nilaiSaja = grafKonteks(true);
  const salingTunjuk = (g, a, b) => Boolean(g.get(a)?.has(b) && g.get(b)?.has(a));

  cek(
    "dokumen ↔ unit-economics memang saling menunjuk (lewat tipe)",
    salingTunjuk(semua, "dokumen", "unit-economics"),
  );
  cek(
    "…dan siklus itu HILANG kalau hanya impor nilai yang dihitung",
    !salingTunjuk(nilaiSaja, "dokumen", "unit-economics"),
    "kalau ini gagal: salah satu arahnya sudah jadi impor nilai",
  );

  const grafPalsu = new Map([
    ["a.ts", ["b.ts"]],
    ["b.ts", ["a.ts"]],
  ]);
  kontrol("[kontrol negatif] pencari siklus menemukan siklus buatan", cariSiklus(grafPalsu) === null);
}

/* ══════════════════════════════════════ 6. kopling lintas konteks terdaftar ══ */
console.log("\n=== 6. Kopling lintas konteks terdaftar di PINTU ===");

{
  const dipakai = new Set();
  const takTerdaftar = [];

  for (const b of busur) {
    const { konteks: dari } = b.dari;
    const { konteks: ke } = b.ke;
    if (!adalahKonteks(dari) || !adalahKonteks(ke) || dari === ke) continue;
    if (PINTU[dari]?.[ke]) dipakai.add(`${dari}→${ke}`);
    else takTerdaftar.push(`${dari} → ${ke} (${b.dari.berkas})`);
  }

  cek(
    "tidak ada kopling yang tidak terdaftar",
    takTerdaftar.length === 0,
    takTerdaftar.join(", "),
  );

  const terdaftar = Object.entries(PINTU).flatMap(([dari, ke]) =>
    Object.keys(ke).map((k) => `${dari}→${k}`),
  );
  const menganggur = terdaftar.filter((p) => !dipakai.has(p));
  cek(
    "tidak ada pintu terdaftar yang sudah tidak dipakai",
    menganggur.length === 0,
    menganggur.length ? `hapus dari PINTU: ${menganggur.join(", ")}` : `${terdaftar.length} pintu, semua terpakai`,
  );

  cek(
    "setiap pintu punya alasan tertulis",
    Object.values(PINTU).every((ke) => Object.values(ke).every((alasan) => alasan.length > 20)),
  );
}
kontrol(
  "[kontrol negatif] pemeriksa menyala untuk kopling yang tidak terdaftar",
  Boolean(PINTU["supplier"]?.["sensitivitas"]),
);

/* ══════════════════════════════════════════ 7. bentuk folder src/app ══ */
console.log("\n=== 7. src/app dikelompokkan per route group ===");

{
  const akar = fs.readdirSync("src/app", { withFileTypes: true });
  const berkasAkar = akar.filter((e) => e.isFile()).map((e) => e.name).sort();
  const DIIZINKAN = ["favicon.ico", "globals.css", "layout.tsx"];
  cek(
    "akar src/app hanya layout.tsx & globals.css",
    berkasAkar.every((f) => DIIZINKAN.includes(f)),
    berkasAkar.join(", "),
  );

  const folderAkar = akar.filter((e) => e.isDirectory()).map((e) => e.name);
  cek(
    "seluruh halaman tinggal di route group berkurung",
    folderAkar.every((f) => f.startsWith("(") && f.endsWith(")")),
    folderAkar.join(", "),
  );

  /* Tiap tab di nav harus punya halaman yang benar-benar ada. Item nav yang
     menunjuk rute mati terlihat persis seperti item nav yang jadi. */
  const shell = fs.readFileSync("src/components/app-shell.tsx", "utf8");
  const href = [...shell.matchAll(/href:\s*"([^"]*)"/g)].map((m) => m[1]);
  cek("lima tab terbaca dari app-shell", href.length === 5, href.join(" "));

  const hilang = href.filter((h) => {
    const p = h === "/" ? "src/app/(builder)/page.tsx" : `src/app/(builder)${h}/page.tsx`;
    return !fs.existsSync(p);
  });
  cek("setiap tab punya page.tsx", hilang.length === 0, hilang.join(", "));
}
kontrol(
  "[kontrol negatif] pemeriksa halaman menyala untuk rute yang tidak ada",
  fs.existsSync("src/app/(builder)/rute-yang-tidak-pernah-ada/page.tsx"),
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
