/**
 * jalankan-probe.mjs — penjalan seluruh probe, dipakai CI dan manusia.
 *
 * ## Kenapa ini ada, dan bukan daftar di dalam ci.yml
 *
 * Daftar nama probe yang ditulis tangan akan jadi basi tanpa ada yang sadar.
 * Ini bukan kekhawatiran teoretis: di SM Platform, satu berkas probe hidup
 * berbulan-bulan tanpa pernah terdaftar di `package.json` — tiga belas klaim
 * yang tidak pernah dijalankan siapa pun, sementara CI tetap hijau.
 *
 * **CI yang hijau karena tidak menjalankan ujinya lebih buruk daripada tidak
 * ada CI**, karena ia memberi rasa aman yang tidak dibayar apa pun.
 *
 * Jadi penjalan ini **menemukan** probenya, bukan menghafal:
 *
 *   - berkasnya: apa pun yang cocok `scripts/probe-*.{mjs,mts}`
 *   - golongannya: yang mengimpor `playwright` = butuh layar, sisanya node saja
 *   - cara jalannya: `.mts` dapat loader TypeScript, `.mjs` langsung
 *
 * Konsekuensinya disengaja: **menambah berkas probe langsung menambahkannya ke
 * CI.** Tidak ada langkah kedua yang bisa dilupakan.
 *
 * ⚠️ Helper yang dipakai bersama probe HARUS berawalan `lib-`, bukan `probe-`.
 * Berkas bernama `probe-navigasi.mjs` akan ikut dijalankan sebagai probe — dan
 * **lolos**, karena ia cuma mengekspor fungsi lalu keluar dengan kode 0. Satu
 * baris hijau yang tidak menguji apa pun adalah bentuk kegagalan yang paling
 * sulit dilihat.
 *
 * ## Pemakaian
 *
 * ```bash
 * node scripts/jalankan-probe.mjs data                # tanpa server
 * node scripts/jalankan-probe.mjs layar [url]         # butuh `npm run serve:build`
 * node scripts/jalankan-probe.mjs semua [url]
 * node scripts/jalankan-probe.mjs daftar              # cuma tunjukkan
 * ```
 *
 * Dijalankan **berurutan, bukan paralel.** Probe layar berbagi satu server dan
 * masing-masing menyalakan Chromium; menjalankannya serentak melahirkan
 * kegagalan yang bergantung waktu — dan probe yang kadang merah lebih cepat
 * diabaikan orang daripada probe yang tidak ada.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DIR = "scripts";
const [modeArg, urlArg] = process.argv.slice(2);
const mode = modeArg ?? "semua";
const URL_DASAR = urlArg ?? "http://localhost:4880/perfume-app";

if (!["data", "layar", "semua", "daftar"].includes(mode)) {
  console.error(`mode tidak dikenal: ${mode} (pakai: data | layar | semua | daftar)`);
  process.exit(2);
}

/** Semua probe di repo, digolongkan dari ISINYA — bukan dari daftar hafalan. */
function temukanProbe() {
  return fs
    .readdirSync(DIR)
    .filter((f) => /^probe-.+\.(mjs|mts)$/.test(f))
    .sort()
    .map((berkas) => {
      const isi = fs.readFileSync(path.join(DIR, berkas), "utf8");
      /* Pemeriksaan impornya sengaja spesifik: menyebut kata "playwright" di
         komentar tidak boleh membuat satu probe node dianggap butuh server. */
      const butuhLayar = /from\s+["']playwright["']/.test(isi);
      return {
        berkas,
        nama: berkas.replace(/^probe-/, "").replace(/\.(mjs|mts)$/, ""),
        butuhLayar,
        ts: berkas.endsWith(".mts"),
      };
    });
}

const semua = temukanProbe();
const dipilih =
  mode === "data" ? semua.filter((p) => !p.butuhLayar)
  : mode === "layar" ? semua.filter((p) => p.butuhLayar)
  : semua;

if (semua.length === 0) {
  console.error("Tidak satu pun berkas probe ditemukan di scripts/ — itu sendiri kegagalan.");
  process.exit(1);
}

console.log(
  `${semua.length} probe ditemukan · ${semua.filter((p) => !p.butuhLayar).length} node, ` +
    `${semua.filter((p) => p.butuhLayar).length} butuh layar`,
);

if (mode === "daftar") {
  for (const p of semua) console.log(`  ${p.butuhLayar ? "LAYAR" : "node "}  ${p.berkas}`);
  process.exit(0);
}

console.log(`Menjalankan ${dipilih.length} probe (mode: ${mode})`);
if (dipilih.some((p) => p.butuhLayar)) console.log(`URL dasar: ${URL_DASAR}`);
console.log("");

function jalankan(p) {
  const args = [];
  /* `.mts` diimpor lewat loader yang SAMA dengan yang dipakai package.json —
     bukan salinannya, supaya perilaku CI dan lokal tidak bisa bercabang. */
  if (p.ts) args.push("--import", "./scripts/ts-register.mjs");
  args.push(path.join(DIR, p.berkas));
  if (p.butuhLayar) args.push(URL_DASAR);

  return new Promise((selesai) => {
    const mulai = Date.now();
    const anak = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let keluaran = "";
    anak.stdout.on("data", (d) => (keluaran += d));
    anak.stderr.on("data", (d) => (keluaran += d));
    anak.on("close", (kode) =>
      selesai({ kode: kode ?? 1, keluaran, detik: (Date.now() - mulai) / 1000 }),
    );
  });
}

const hasil = [];
for (const p of dipilih) {
  process.stdout.write(`▶ ${p.nama} … `);
  const r = await jalankan(p);
  const lolos = r.kode === 0;
  console.log(`${lolos ? "OK" : "GAGAL"} (${r.detik.toFixed(1)}s)`);
  /* Keluaran probe yang lolos disembunyikan supaya log CI terbaca; yang gagal
     dicetak penuh, karena itulah satu-satunya saat orang membacanya. */
  if (!lolos) {
    console.log(r.keluaran.split("\n").map((l) => "    │ " + l).join("\n"));
  }
  hasil.push({ ...p, lolos });
}

const gagal = hasil.filter((h) => !h.lolos);
console.log("");
console.log(`${hasil.length - gagal.length}/${hasil.length} probe lolos`);
if (gagal.length > 0) {
  console.log(`GAGAL: ${gagal.map((g) => g.nama).join(", ")}`);
  process.exit(1);
}
console.log("SEMUA PROBE LOLOS");
