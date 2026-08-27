/**
 * probe-pemulihan.mts — `npm run probe:pemulihan`
 *
 * Menjaga dua hal yang lahir dari insiden 27 Agustus 2026: **cadangan yang
 * dipakai memulihkan dokumen tim**, dan **alat yang memulihkannya**.
 *
 * ## Kenapa cadangannya ikut diuji
 *
 * Karena berkas JSON yang tidak lagi terbaca migrasi **tidak menghasilkan satu
 * pun error**. `bacaDokumen()` sengaja tidak pernah melempar: payload yang tidak
 * dikenali menghasilkan dokumen awal. Jadi cadangan yang rusak terlihat persis
 * seperti cadangan yang baik sampai hari ia dipakai — dan hari itu, yang
 * ditulis ke baris tim adalah angka contoh.
 *
 * Yang diperiksa karena itu bukan "apakah ia parse", melainkan apakah hasilnya
 * **masih berbeda dari `dokumenAwal()`**. Kontrol negatifnya `{"uji": true}` —
 * kerusakan yang sungguhan terjadi — yang harus terbaca sebagai dokumen awal.
 *
 * ## Kenapa alatnya diuji dengan DIJALANKAN, bukan dibaca
 *
 * Sifat yang dijaga di sini adalah sifat perilaku: "tidak pernah `POST`",
 * "tidak mengirim apa pun tanpa `--tulis`", "menolak menimpa baris yang hidup".
 * Membuktikannya dengan `grep` ke kode sumber berarti mempercayai bahwa jalur
 * yang dibaca sama dengan jalur yang jalan — persis asumsi yang sudah pernah
 * salah di repo ini (pemeriksa CI yang mencari kata "supabase.co" hijau pada
 * bundle tanpa kredensial).
 *
 * Jadi probe ini menyalakan PostgREST palsu, menjalankan alatnya sungguhan
 * terhadapnya, dan menuntut **metode HTTP yang benar-benar sampai**. Servernya
 * mencatat setiap permintaan; kontrol negatif di bagian 2 menembak `POST` ke
 * server itu sendiri untuk membuktikan pencatatnya memang menyala — pencatat
 * yang mati membuat seluruh "nol POST" di bawahnya tidak berarti apa-apa.
 *
 * Tidak ada jaringan keluar. Servernya localhost, portnya ephemeral.
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";
import { bacaDokumen } from "@/contexts/dokumen/domain/migrasi";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import { unitEconomics } from "@/contexts/unit-economics/aplikasi/unit-economics";

const UKURAN: UkuranBotol[] = ["kecil", "besar"];

let lulus = 0;
let gagal = 0;

const cek = (nama: string, kondisi: boolean, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
/** Kontrol negatif: `kondisiSalah` true berarti detektornya TIDAK menyala. */
const kontrol = (nama: string, kondisiSalah: boolean, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

const DIR_PEMULIHAN = "referensi/pemulihan";
const ALAT = "scripts/pulihkan-dokumen.mjs";

/**
 * Cadangan yang benar-benar dipakai memulihkan. Yang lain disimpan sebagai
 * riwayat, bukan sebagai calon.
 *
 * Perbedaannya bukan formalitas: export 22 Juli dibuat sebelum model biayanya
 * berubah bentuk (`usdPerLiter` masih 2,4 bukan 60, `largeSizeML` masih 100,
 * dan `base.mix` belum ada sama sekali). Dibaca migrasi hari ini ia tetap
 * menghasilkan dokumen yang sah dan COGS yang berhingga — dengan **margin −3431%
 * pada botol kecil dan −1919% pada botol besar**. Angka yang salah tidak terlihat
 * berbeda dari angka yang benar, jadi calon pemulihan disebut namanya di sini,
 * dan hanya ia yang dituntut masuk akal.
 */
const CADANGAN_PILIHAN = "2026-07-27-sos-unit-economics.json";

/** Cadangan kurasi, bukan berkas `sebelum-pulih-*` yang dihasilkan alatnya. */
const cadangan = existsSync(DIR_PEMULIHAN)
  ? readdirSync(DIR_PEMULIHAN)
      .filter((f) => f.endsWith(".json") && !f.startsWith("sebelum-pulih-"))
      .sort()
  : [];

/* ═════════════════════════════ 1. cadangan masih benar-benar terbaca ══ */
console.log("\n=== 1. Setiap cadangan terbaca sebagai dokumen nyata ===");

cek("ada cadangan yang dijaga", cadangan.length > 0, `${cadangan.length} berkas`);

const awalTeks = JSON.stringify(dokumenAwal());

for (const berkas of cadangan) {
  const mentah = JSON.parse(readFileSync(path.join(DIR_PEMULIHAN, berkas), "utf8"));
  const dok = bacaDokumen(mentah);

  /* Inti bagian ini. Cadangan yang tidak lagi dikenali migrasi jatuh ke dokumen
     awal DIAM-DIAM — dan memulihkannya berarti menulis angka contoh ke baris
     tim, kerusakan yang persis sama dengan yang sedang diperbaiki. */
  cek(`${berkas} — bukan dokumen awal`, JSON.stringify(dok) !== awalTeks);

  cek(
    `${berkas} — supplier & varian ikut terbawa`,
    dok.varian.length > 0 && dok.supplierKecil.length > 0 && dok.supplierBesar.length > 0,
    `${dok.varian.length} varian, ${dok.supplierKecil.length} kecil, ${dok.supplierBesar.length} besar`,
  );

  /* Terbaca belum tentu bisa dihitung: satu `NaN` yang lolos migrasi merambat
     sampai ke total tanpa melempar apa pun.

     ⚠️ KEDUA ukuran diperiksa, dan itu bukan kelengkapan yang manis. Botol kecil
     dan besar memakai supplier, harga jual, dan biaya OEM yang BERBEDA — satu
     cadangan bisa masuk akal pada yang satu dan omong kosong pada yang lain,
     dan yang diperiksa cuma satu tidak akan menunjukkannya. */
  for (const ukuran of UKURAN) {
    const ue = unitEconomics(dok, ukuran);
    cek(
      `${berkas} (${ukuran}) — COGS & margin berhingga`,
      Number.isFinite(ue.cogs) && Number.isFinite(ue.grossMargin) && ue.cogs > 0,
      `COGS ${Math.round(ue.cogs)}, margin ${ue.grossMargin.toFixed(1)}%`,
    );
  }
}

/* ── sha256 yang tertulis di README harus benar ───────────────────────────── */
console.log("\n--- provenance ---");

/**
 * README menjanjikan berkas ini byte per byte sama dengan yang keluar dari
 * tombol "Export data". Janji itu diperiksa di sini, bukan dipercaya.
 *
 * Yang paling mungkin mematahkannya bukan penyuntingan melainkan **checkout**:
 * `core.autocrlf=true` adalah bawaan Git di Windows, dan tanpa `.gitattributes`
 * tiap clone baru menulis ulang JSON-nya dengan CRLF. Isinya sama, hash-nya
 * berbeda — dan berkas yang tidak bisa dibuktikan asalnya kehilangan seluruh
 * gunanya sebagai cadangan.
 */
{
  const readme = readFileSync(path.join(DIR_PEMULIHAN, "README.md"), "utf8");

  for (const berkas of cadangan) {
    const isi = readFileSync(path.join(DIR_PEMULIHAN, berkas));
    const hash = createHash("sha256").update(isi).digest("hex");

    /* Baris tabel README: | `nama` | … | `hash12` | … | */
    const baris = readme.split("\n").find((l) => l.includes(berkas));
    const tertulis = baris ? /`([0-9a-f]{12})`/.exec(baris)?.[1] : undefined;

    cek(
      `${berkas} — sha256 cocok dengan yang ditulis README`,
      tertulis === hash.slice(0, 12),
      `berkas ${hash.slice(0, 12)}, README ${tertulis ?? "tidak tercatat"}`,
    );

    /* CRLF di sini berarti .gitattributes tidak berlaku, dan hash di atas cuma
       kebetulan masih cocok di mesin ini. */
    cek(`${berkas} — tanpa CRLF`, !isi.includes("\r\n"));
  }
}

/* ── calon pemulihan dituntut lebih dari sekadar terbaca ──────────────────── */
console.log("\n--- calon pemulihan ---");

cek(
  `${CADANGAN_PILIHAN} ada`,
  cadangan.includes(CADANGAN_PILIHAN),
  cadangan.join(", ") || "tidak ada cadangan",
);

if (cadangan.includes(CADANGAN_PILIHAN)) {
  const dok = bacaDokumen(
    JSON.parse(readFileSync(path.join(DIR_PEMULIHAN, CADANGAN_PILIHAN), "utf8")),
  );
  /* Batas yang dilewati satu data: export 22 Juli menghasilkan −1919% di sini.
     Tanpa baris ini, cadangan yang salah zaman bisa dipulihkan ke baris tim dan
     yang terlihat cuma angka yang aneh, bukan kesalahan. */
  for (const ukuran of UKURAN) {
    const ue = unitEconomics(dok, ukuran);
    cek(
      `calon pemulihan (${ukuran}) bermargin masuk akal`,
      ue.grossMargin > 0 && ue.grossMargin < 100,
      `${ue.grossMargin.toFixed(1)}%`,
    );
    cek(
      `calon pemulihan (${ukuran}) ber-COGS di bawah harga jualnya`,
      ue.cogs < ue.harga,
      `${Math.round(ue.cogs)} < ${ue.harga}`,
    );
  }
}

console.log("\n--- kontrol negatif ---");

/* Kontrol untuk batas margin di atas: cadangan yang salah zaman HARUS jatuh di
   luarnya. Kalau ia ikut lolos, batas itu tidak memisahkan apa pun. */
kontrol(
  "cadangan 22 Juli memang gagal batas margin yang sama",
  (() => {
    const lama = "2026-07-22-1453-sos-unit-economics.json";
    if (!cadangan.includes(lama)) return true;
    const dok = bacaDokumen(JSON.parse(readFileSync(path.join(DIR_PEMULIHAN, lama), "utf8")));
    /* Lolos kalau SEMUA ukuran masuk akal — kalau satu pun di luar batas, ia
       memang tertangkap, dan kontrolnya benar. */
    return UKURAN.every((u) => {
      const m = unitEconomics(dok, u).grossMargin;
      return m > 0 && m < 100;
    });
  })(),
);

/* Kerusakan yang SUNGGUHAN terjadi pada baris tim. Kalau ini tidak terbaca
   sebagai dokumen awal, detektor di atas tidak menjaga apa pun. */
kontrol(
  'payload insiden {"uji": true} terbaca sebagai dokumen awal',
  JSON.stringify(bacaDokumen({ uji: true })) !== awalTeks,
);

kontrol("payload kosong terbaca sebagai dokumen awal", JSON.stringify(bacaDokumen({})) !== awalTeks);

/* ═════════════════════════════ 2. alat pulih berperilaku seperti janjinya ══ */
console.log("\n=== 2. Alat pemulihan, dijalankan sungguhan ===");

type Permintaan = { metode: string; badan: string };

/** PostgREST palsu. Mencatat tiap permintaan, dan menyimpan payload hasil PATCH. */
function nyalakanServerPalsu(payloadAwal: unknown) {
  const dilihat: Permintaan[] = [];
  let payload = payloadAwal;
  let updatedAt = "2026-08-11T09:28:13.873+00:00";

  const server: Server = createServer((req, res) => {
    let badan = "";
    req.on("data", (d) => (badan += d));
    req.on("end", () => {
      dilihat.push({ metode: req.method ?? "?", badan });

      if (req.method === "PATCH") {
        const kirim = JSON.parse(badan);
        payload = kirim.payload;
        updatedAt = kirim.updated_at;
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify([{ payload, updated_at: updatedAt }]));
      }
      if (req.method === "POST") {
        res.writeHead(201, { "Content-Type": "application/json" });
        return res.end("[]");
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify([{ payload, updated_at: updatedAt }]));
    });
  });

  return new Promise<{ port: number; dilihat: Permintaan[]; tutup: () => Promise<void> }>((siap) => {
    server.listen(0, "127.0.0.1", () => {
      const alamat = server.address();
      const port = typeof alamat === "object" && alamat ? alamat.port : 0;
      siap({
        port,
        dilihat,
        tutup: () => new Promise<void>((selesai) => server.close(() => selesai())),
      });
    });
  });
}

function jalankanAlat(port: number, argumen: string[]) {
  return new Promise<{ kode: number; keluaran: string }>((selesai) => {
    const anak = spawn(
      process.execPath,
      ["--import", "./scripts/ts-register.mjs", ALAT, ...argumen],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: {
          ...process.env,
          NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${port}`,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-palsu-untuk-probe",
          NEXT_PUBLIC_DOKUMEN_ID: "sos-unit-economics",
        },
      },
    );
    let keluaran = "";
    anak.stdout.on("data", (d) => (keluaran += d));
    anak.stderr.on("data", (d) => (keluaran += d));
    anak.on("close", (kode) => selesai({ kode: kode ?? 1, keluaran }));
  });
}

const menulis = (dilihat: Permintaan[]) => dilihat.filter((p) => p.metode !== "GET");
/** Alat diuji dengan cadangan yang memang dipakai memulihkan, bukan sembarang. */
const SUMBER = path.join(DIR_PEMULIHAN, CADANGAN_PILIHAN);

/* ── 2a. kering tidak mengirim apa pun ────────────────────────────────────── */
{
  const s = await nyalakanServerPalsu({ uji: true });
  const r = await jalankanAlat(s.port, [SUMBER]);
  await s.tutup();

  cek("kering: keluar 0", r.kode === 0, `kode ${r.kode}`);
  cek(
    "kering: NOL permintaan yang menulis",
    menulis(s.dilihat).length === 0,
    `terlihat: ${JSON.stringify(menulis(s.dilihat).map((p) => p.metode))}`,
  );
  cek("kering: mengatakan dirinya kering", /KERING/.test(r.keluaran));
}

/* ── 2b. --tulis pada baris rusak memulihkan, lewat PATCH ─────────────────── */
{
  const sebelum = new Set(readdirSync(DIR_PEMULIHAN));
  const s = await nyalakanServerPalsu({ uji: true });
  const r = await jalankanAlat(s.port, [SUMBER, "--tulis"]);
  await s.tutup();

  const tulisan = menulis(s.dilihat);
  cek("tulis: keluar 0", r.kode === 0, `kode ${r.kode}`);
  cek("tulis: tepat satu permintaan yang menulis", tulisan.length === 1, `${tulisan.length}`);
  cek("tulis: metodenya PATCH", tulisan[0]?.metode === "PATCH", tulisan[0]?.metode ?? "tidak ada");

  /* Yang membuat insidennya mungkin. Kalau baris ini pernah merah, alatnya sudah
     berubah jadi alat yang sama dengan yang merusak datanya. */
  cek(
    "tulis: TIDAK PERNAH POST",
    s.dilihat.every((p) => p.metode !== "POST"),
    JSON.stringify(s.dilihat.map((p) => p.metode)),
  );

  /* Cadangan sebelum-menimpa adalah bagian dari kontraknya, bukan kenyamanan:
     ia satu-satunya jalan pulang kalau pemulihannya sendiri ternyata salah. */
  const baru = readdirSync(DIR_PEMULIHAN).filter(
    (f) => !sebelum.has(f) && f.startsWith("sebelum-pulih-"),
  );
  cek("tulis: isi lama dicadangkan lebih dulu", baru.length === 1, baru.join(", ") || "tidak ada");
  if (baru.length === 1) {
    const isi = JSON.parse(readFileSync(path.join(DIR_PEMULIHAN, baru[0]), "utf8"));
    cek(
      "tulis: cadangannya berisi payload yang ditimpa",
      JSON.stringify(isi.payload) === JSON.stringify({ uji: true }),
      JSON.stringify(isi.payload),
    );
  }
  for (const f of baru) unlinkSync(path.join(DIR_PEMULIHAN, f));
}

/* ── 2c. baris yang hidup tidak boleh tertimpa ────────────────────────────── */
{
  const hidup = JSON.parse(readFileSync(SUMBER, "utf8"));
  const s = await nyalakanServerPalsu(hidup);
  const r = await jalankanAlat(s.port, [SUMBER, "--tulis"]);
  await s.tutup();

  cek("baris hidup: keluar bukan 0", r.kode !== 0, `kode ${r.kode}`);
  cek(
    "baris hidup: NOL permintaan yang menulis",
    menulis(s.dilihat).length === 0,
    JSON.stringify(menulis(s.dilihat).map((p) => p.metode)),
  );
  cek("baris hidup: menyebut --paksa sebagai jalan keluarnya", /--paksa/.test(r.keluaran));
}

/* ── 2d. muatan yang tidak terbaca tidak pernah berangkat ─────────────────── */
{
  const rusak = path.join(DIR_PEMULIHAN, "muatan-rusak-untuk-probe.json");
  writeFileSync(rusak, JSON.stringify({ uji: true }));
  const s = await nyalakanServerPalsu({ uji: true });
  const r = await jalankanAlat(s.port, [rusak, "--tulis"]);
  await s.tutup();
  unlinkSync(rusak);

  cek("muatan tak terbaca: keluar bukan 0", r.kode !== 0, `kode ${r.kode}`);
  cek("muatan tak terbaca: NOL permintaan yang menulis", menulis(s.dilihat).length === 0);
}

console.log("\n--- kontrol negatif ---");

/* Seluruh "NOL permintaan" di atas bergantung pada servernya benar-benar
   mencatat. Server yang pencatatnya mati juga melaporkan nol. */
{
  const s = await nyalakanServerPalsu({ uji: true });
  await fetch(`http://127.0.0.1:${s.port}/rest/v1/unit_economics`, {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
  });
  await fetch(`http://127.0.0.1:${s.port}/rest/v1/unit_economics?id=eq.x`, {
    method: "PATCH",
    body: JSON.stringify({ payload: {}, updated_at: "x" }),
    headers: { "Content-Type": "application/json" },
  });
  await s.tutup();

  kontrol(
    "server palsu MENCATAT POST dan PATCH kalau benar-benar ada",
    menulis(s.dilihat).length !== 2,
    JSON.stringify(s.dilihat.map((p) => p.metode)),
  );
}

/* ═════════════════════════════ 3. alatnya tidak ikut terjaring CI ══ */
console.log("\n=== 3. Alat pulih bukan probe, dan tidak boleh dijalankan CI ===");

/* Regex yang SAMA dengan yang dipakai jalankan-probe.mjs untuk menemukan probe.
   Kalau alat ini ikut cocok, CI akan menjalankannya tiap kali — sebuah skrip
   yang menulis ke Supabase, dijalankan otomatis. */
const POLA_PROBE = /^probe-.+\.(mjs|mts)$/;

cek(
  "pulihkan-dokumen.mjs tidak cocok pola penemuan probe",
  !POLA_PROBE.test(path.basename(ALAT)),
  path.basename(ALAT),
);

console.log("\n--- kontrol negatif ---");
kontrol("pola penemuan probe memang cocok dengan berkas ini", !POLA_PROBE.test("probe-pemulihan.mts"));

/* ═════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
