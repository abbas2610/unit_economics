/**
 * probe-pembelian-layar.mjs — probe layar. Butuh `npm run serve:build` lebih dulu.
 *
 * ```bash
 * npm run build && npm run serve:build &
 * npm run tunggu:server
 * node scripts/probe-pembelian-layar.mjs http://localhost:4880/perfume-app
 * ```
 *
 * ## Apa yang dibuktikan di sini, dan kenapa tidak cukup `probe:pembelian`
 *
 * `probe:pembelian` sudah membuktikan aritmetikanya. Yang TIDAK bisa dibuktikan
 * tanpa browser adalah apakah tiga hal ini benar-benar SAMPAI ke tangan orang:
 *
 *   1. Tombol "Pakai supplier ini" punya handler yang benar-benar memindahkan
 *      pilihan. Sebelum ini tidak ada tombolnya sama sekali — menambah supplier
 *      tidak pernah mengubah satu angka pun, dan tombol tanpa handler terlihat
 *      persis seperti tombol yang jadi.
 *   2. Sakelar "ikuti kapasitas cairan" benar-benar melepas qty dari cairan,
 *      sehingga "beli 100 botol saja" bisa dimodelkan.
 *   3. Tabel menyebut qty yang DIPAKAI, bukan MOQ — keluhan yang melahirkan
 *      seluruh perubahan ini.
 *
 * ⛔ Supabase diputus, dengan alasan yang sama seperti `probe-builder.mjs`:
 * bundle CI membawa kredensial produksi, dan probe ini MENGETIK ke kotak isian.
 * Pemutusannya dibuktikan berlaku dengan menuntut status topbar "Mode lokal".
 *
 * Tiap aturan punya kontrol negatif.
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "http://localhost:4880/perfume-app").replace(/\/+$/, "");

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

/** Angka dari teks rupiah Indonesia: "Rp84.150.000" → 84150000. */
const angkaDari = (teks) => Number(String(teks).replace(/[^\d-]/g, "")) || 0;

const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 1280, height: 1000 } });
/* Regex, sama seperti probe-builder. Pola glob sempat dipakai di sini dan
   pemblokirannya memang bekerja — tapi menyamakan bentuknya dengan probe yang
   sudah terbukti menghilangkan satu hal yang perlu dipikirkan ulang tiap kali. */
await konteks.route(/supabase\.co/, (rute) => rute.abort("failed"));

const hal = await konteks.newPage();

/**
 * Tunggu muatan awal MENDARAT sebelum menyentuh apa pun.
 *
 * Aplikasi memuat dokumen secara asinkron. Mengetik sementara ia menunggu adalah
 * kondisi balapan sungguhan — dijaga `sudahDisunting` di dokumen-provider — dan
 * yang diuji di sini bukan balapan itu, jadi ia dihindari alih-alih ditumpangi.
 * Tanpa ini, klik "Pakai supplier ini" bisa tertimpa muatan awal dan probe merah
 * pada perilaku yang benar. Itu persis yang terjadi pada jalan CI pertama.
 */
const tungguSiap = () =>
  hal
    .waitForFunction(
      () => !/Memuat/i.test(document.querySelector("header [role=status]")?.textContent ?? ""),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});

/** Ketik ke kotak isian ber-aria-label, lalu lepas fokus supaya nilainya ditulis ulang rapi. */
async function isi(label, nilai) {
  const kotak = hal.getByLabel(label, { exact: true }).first();
  await kotak.click();
  await kotak.press("ControlOrMeta+a");
  await kotak.type(String(nilai));
  await kotak.blur();
}

/* ═══════════════════════ 0. pemutusan awan benar-benar berlaku ══ */
console.log("\n=== 0. Awan diputus (pembuktian, bukan asumsi) ===");

await hal.goto(`${BASE}/supplier-kecil/index.html`, { waitUntil: "networkidle" });
await tungguSiap();
{
  /* ⚠️ DUA status yang sah, dan menerima cuma satu membuat probe ini merah
     justru saat pemutusannya bekerja — itu yang terjadi pada jalan CI pertama.
     Bundle CI MEMBAWA kredensial, jadi permintaan yang diputus berbunyi
     "Gagal sync"; bundle lokal tanpa kredensial berbunyi "Mode lokal".

     Yang menjadi PENGAMAN sesungguhnya bukan keduanya, melainkan assertion di
     bawahnya: kalau pemutusan tidak berlaku, statusnya "Tersinkron" dan probe
     ini sedang mengetik ke dokumen tim yang sungguhan. */
  const status = (await hal.locator("header [role=status]").first().textContent()) ?? "";
  cek("status = mode lokal ATAU gagal sync", /lokal|Gagal sync/i.test(status), JSON.stringify(status));
  cek(
    "status BUKAN 'Tersinkron' — pemutusan terbukti berlaku",
    !/Tersinkron/i.test(status),
    "kalau ini gagal, probe sedang menyentuh data tim",
  );
}
kontrol(
  "[kontrol negatif] halaman memang termuat — kalau kosong, seluruh probe ini hampa",
  (await hal.locator("table").count()) === 0,
);

/* ═══════════════════════ 1. keluhan aslinya: MOQ bukan qty ══ */
console.log("\n=== 1. Tabel menyebut qty DIBELI, bukan MOQ ===");

{
  const tabel = hal.locator("table").first();
  const teks = await tabel.innerText();
  cek("baris pertama tabel adalah 'Qty dibeli'", /Qty dibeli/i.test(teks));
  cek("MOQ turun jadi keterangan, bukan baris sendiri", /MOQ .*(mengikat|tidak mengikat)/i.test(teks));
  cek("ada baris 'Botol terisi'", /Botol terisi/i.test(teks));
  cek("ada baris setara 'Biaya per botol terpakai'", /Biaya per botol terpakai/i.test(teks));
  cek(
    "biaya botol per unit menyebut freight",
    /Biaya botol \/ unit[\s\S]{0,40}termasuk freight/i.test(teks),
  );
}
kontrol(
  "[kontrol negatif] badge 'termurah' TIDAK boleh menempel di baris Total investasi",
  await hal
    .locator("tr", { hasText: "Total investasi" })
    .first()
    .locator("text=termurah")
    .count()
    .then((n) => n > 0),
);

/* ═══════════════════════ 2. beli 100 botol saja ══ */
console.log("\n=== 2. 'Beli 100 botol saja' bisa dimodelkan ===");

{
  /* Supplier pertama ber-MOQ 10.000 secara default; turunkan supaya pembelian
     100 benar-benar mengikat dan bukan MOQ-nya. */
  await isi("Minimum order quantity", 1);

  const sakelar = hal.getByRole("switch", { name: /ikuti kapasitas cairan/i }).first();
  const sebelum = await sakelar.getAttribute("aria-checked");
  cek("sakelar default = ikut kapasitas cairan", sebelum === "true", `aria-checked=${sebelum}`);

  await sakelar.click();
  await isi("Qty botol yang dipesan", 100);
  await hal.waitForTimeout(150);

  const kartu = hal.locator("section.card").first();
  const teksKartu = await kartu.innerText();
  cek("kartu menyebut 100 pcs dibeli", /100 pcs dibeli/.test(teksKartu), teksKartu.match(/[\d.]+ pcs dibeli/)?.[0] ?? "");

  /* Angka yang jadi keluhan: harga botol $0,48 × 100 pcs, bukan × 8.500. */
  const total = angkaDari(await kartu.locator("p.text-card-title").first().innerText());
  cek(
    "total investasi turun drastis dari Rp267 juta",
    total < 50_000_000,
    `Rp${total.toLocaleString("de-DE")}`,
  );

  const catatan = await hal.locator("text=/tidak akan terbotolkan/").count();
  cek("sisa cairan diperingatkan di layar", catatan > 0);
}
kontrol(
  "[kontrol negatif] qty 100 TIDAK boleh tetap menghasilkan total 8.500 botol",
  angkaDari(await hal.locator("section.card").first().locator("p.text-card-title").first().innerText()) >
    100_000_000,
);

/* ═══════════════════════ 3. tombol 'Pakai supplier ini' benar-benar bekerja ══ */
console.log("\n=== 3. Supplier baru bisa dipakai dari tab-nya sendiri ===");

{
  await hal.goto(`${BASE}/supplier-besar/index.html`, { waitUntil: "networkidle" });
  await tungguSiap();
  await hal.getByRole("button", { name: /Tambah supplier botol besar/i }).click();
  await hal.waitForTimeout(150);

  const kartuBaru = hal.locator("section.card").last();
  const tombol = kartuBaru.getByRole("button", { name: "Pakai supplier ini" });
  cek("supplier baru punya tombol 'Pakai supplier ini'", (await tombol.count()) === 1);
  cek(
    "supplier baru BELUM dipakai sebelum tombolnya ditekan",
    (await kartuBaru.locator("text=dipakai").count()) === 0,
  );

  await tombol.click();
  await hal.waitForTimeout(150);
  cek(
    "setelah ditekan, supplier baru bertanda 'dipakai'",
    (await hal.locator("section.card").last().locator("text=dipakai").count()) > 0,
  );

  /* Dan pilihannya benar-benar sampai ke tab 4 — bukan cuma badge di layar ini.
     Itu inti bug-nya: badge yang benar sementara Initial Investment tetap
     memakai supplier lama adalah persis gejala yang dilaporkan. */
  await hal.goto(`${BASE}/investasi/index.html`, { waitUntil: "networkidle" });
  await tungguSiap();
  const pilih = hal.locator("select").nth(1);
  const namaTerpilih = async () => {
    const v = await pilih.inputValue();
    return (await pilih.locator(`option[value="${v}"]`).innerText()).trim();
  };
  const nama = await namaTerpilih();
  cek("Initial Investment ikut memakai supplier baru", nama === "Supplier Baru", nama);

  kontrol("[kontrol negatif] tab 4 TIDAK boleh masih menunjuk supplier lama", nama === "Vendor Lokal A");
}

await peramban.close();

console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
