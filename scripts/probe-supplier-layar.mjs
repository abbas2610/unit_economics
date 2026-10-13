/**
 * probe-supplier-layar.mjs — probe layar. Butuh `npm run serve:build` lebih dulu.
 *
 * ```bash
 * npm run build && npm run serve:build &
 * npm run tunggu:server
 * node scripts/probe-supplier-layar.mjs http://localhost:4880/perfume-app
 * ```
 *
 * Menjaga susunan tab Supplier Botol Kecil/Besar:
 *
 *   1. Dua bagian yang terpisah jelas — Supplier Botol dan Supplier Packaging —
 *      dan di masing-masing, tabel perbandingan PALING ATAS, di atas kartunya.
 *   2. Kartu per vendor default tertutup; detailnya baru ada setelah dibuka.
 *   3. Urutan bisa diubah dengan SERET pegangan di kanan, kolom tabel ikut
 *      urutannya, dan urutannya tersimpan (bertahan setelah dimuat ulang).
 *   4. Jalur keyboard untuk hal yang sama.
 *   5. Vendor yang baru ditambah langsung terbuka — yang lain tidak ikut.
 *
 * Seret diuji dengan mouse sungguhan (`page.mouse`), bukan memanggil
 * handlernya: pegangan tanpa pendengar yang benar terlihat persis seperti
 * pegangan yang jadi.
 *
 * ⛔ Supabase diputus, sama seperti probe layar lain — bundle CI membawa
 * kredensial produksi dan probe ini MENGUBAH urutan supplier.
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

const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 1280, height: 1000 } });
await konteks.route(/supabase\.co/, (rute) => rute.abort("failed"));
const hal = await konteks.newPage();
const galat = [];
hal.on("pageerror", (e) => galat.push(String(e)));

const tungguSiap = () =>
  hal
    .waitForFunction(
      () => !/Memuat/i.test(document.querySelector("header [role=status]")?.textContent ?? ""),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});

const buka = async (path) => {
  await hal.goto(BASE + path, { waitUntil: "networkidle" });
  await tungguSiap();
};

const KARTU_BOTOL = '[data-seksi="supplier"] > section.card';
const KARTU_PKG = '[data-seksi="packaging"] > section.card';

/** Nama vendor sesuai urutan kartu, dibaca dari tombol buka/tutupnya. */
const urutanKartu = (sel) =>
  hal
    .locator(`${sel} button[aria-expanded]`)
    .evaluateAll((el) => el.map((b) => (b.getAttribute("aria-label") ?? "").replace(/^Detail /, "")));

/** Judul kolom tabel perbandingan botol (tabel pertama), tanpa kolom "Komponen". */
const urutanKolom = () =>
  hal
    .locator("table")
    .first()
    .locator("thead th")
    .evaluateAll((th) => th.slice(1).map((x) => (x.textContent ?? "").trim()));

/* ═══════════════════════ 0. pemutusan awan benar-benar berlaku ══ */
console.log("\n=== 0. Awan diputus (pembuktian, bukan asumsi) ===");

await buka("/supplier-kecil/index.html");
{
  const status = (await hal.locator("header [role=status]").first().textContent()) ?? "";
  cek("status BUKAN 'Tersinkron'", !/Tersinkron/i.test(status), JSON.stringify(status));
}

/* ═══════════════════════ 1. dua bagian, tabel paling atas ══ */
console.log("\n=== 1. Botol vs Packaging terpisah, perbandingan di atas kartu ===");

/** true kalau elemen pertama `a` muncul SEBELUM elemen pertama `b` di dokumen. */
const sebelum = (a, b) =>
  hal.evaluate(
    ([a, b]) => {
      const x = document.querySelector(a);
      const y = document.querySelector(b);
      return Boolean(x && y && x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING);
    },
    [a, b],
  );

{
  const judul = await hal.locator("main h2").allTextContents();
  cek("ada bagian 'Supplier Botol'", judul.includes("Supplier Botol"), judul.join(" | "));
  cek("ada bagian 'Supplier Packaging (Box)'", judul.includes("Supplier Packaging (Box)"));

  /* Tabel perbandingan di bagian yang sama dengan kartunya, dan di ATASNYA. */
  const tabelBotolDulu = await hal.evaluate(() => {
    const kartu = document.querySelector('[data-seksi="supplier"] > section.card');
    const seksi = kartu?.closest("section[aria-labelledby]");
    const tabel = seksi?.querySelector("table");
    return Boolean(tabel && kartu && tabel.compareDocumentPosition(kartu) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  cek("botol: tabel perbandingan di atas kartu supplier, di bagian yang sama", tabelBotolDulu);

  const tabelPkgDulu = await hal.evaluate(() => {
    const kartu = document.querySelector('[data-seksi="packaging"] > section.card');
    const seksi = kartu?.closest("section[aria-labelledby]");
    const tabel = seksi?.querySelector("table");
    return Boolean(tabel && kartu && tabel.compareDocumentPosition(kartu) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  cek("packaging: tabel perbandingan di atas kartu packaging, di bagian yang sama", tabelPkgDulu);

  cek("bagian botol sebelum bagian packaging", await sebelum(KARTU_BOTOL, KARTU_PKG));

  /* Chip jenis di tiap kartu — kartu yang tertutup tetap ketahuan jenisnya. */
  const chipBotol = await hal.locator(`${KARTU_BOTOL} .badge`).allTextContents();
  const chipPkg = await hal.locator(`${KARTU_PKG} .badge`).allTextContents();
  cek("tiap kartu botol berchip 'Botol'", (await hal.locator(KARTU_BOTOL).count()) === chipBotol.filter((t) => t === "Botol").length);
  cek("tiap kartu packaging berchip 'Packaging'", (await hal.locator(KARTU_PKG).count()) === chipPkg.filter((t) => t === "Packaging").length);
}
kontrol("[kontrol negatif] pemeriksa urutan menolak urutan terbalik", await sebelum(KARTU_PKG, KARTU_BOTOL));

/* ═══════════════════════ 2. kartu default tertutup ══ */
console.log("\n=== 2. Kartu per vendor bisa dibuka/tutup, default tertutup ===");

{
  const status = await hal.locator(`${KARTU_BOTOL} button[aria-expanded], ${KARTU_PKG} button[aria-expanded]`).evaluateAll((b) => b.map((x) => x.getAttribute("aria-expanded")));
  cek("semua kartu mulai tertutup", status.length > 0 && status.every((s) => s === "false"), status.join(","));
  cek("detail (kotak MOQ) belum ada di DOM", (await hal.getByLabel("Minimum order quantity").count()) === 0);
  cek(
    "dipakai/pakai tetap terlihat tanpa membuka",
    (await hal.locator(`${KARTU_BOTOL} >> text=dipakai`).count()) === 1 &&
      (await hal.locator(KARTU_BOTOL).getByRole("button", { name: "Pakai supplier ini" }).count()) >= 1,
  );

  const pertama = hal.locator(KARTU_BOTOL).first();
  await pertama.locator("button[aria-expanded]").click();
  cek("klik kepala → terbuka", (await pertama.locator("button[aria-expanded]").getAttribute("aria-expanded")) === "true");
  const adaMoq = await pertama.getByLabel("Minimum order quantity").count();
  cek("detailnya muncul di kartu itu", adaMoq === 1, `${adaMoq} kotak`);
  kontrol("[kontrol negatif] pendeteksi kotak MOQ memang bisa melihatnya", adaMoq === 0);
  cek("kartu lain tetap tertutup", (await hal.locator(KARTU_BOTOL).nth(1).locator("button[aria-expanded]").getAttribute("aria-expanded")) === "false");

  await pertama.locator("button[aria-expanded]").click();
  cek("klik lagi → tertutup", (await pertama.getByLabel("Minimum order quantity").count()) === 0);

  const bagianBotol = hal.locator("section[aria-labelledby]", { has: hal.locator('[data-seksi="supplier"]') });
  await bagianBotol.getByRole("button", { name: "Buka semua" }).click();
  cek(
    "'Buka semua' membuka seluruh kartu botol",
    (await hal.locator(KARTU_BOTOL).getByLabel("Minimum order quantity").count()) === (await hal.locator(KARTU_BOTOL).count()),
  );
  cek("…tanpa ikut membuka bagian packaging", (await hal.locator(KARTU_PKG).getByLabel("Minimum order quantity").count()) === 0);
  await bagianBotol.getByRole("button", { name: "Tutup semua" }).click();
}

/* ═══════════════════════ 3. seret dengan mouse ══ */
console.log("\n=== 3. Seret pegangan di kanan mengubah urutan, dan tersimpan ===");

/** Seret pegangan kartu ke-`dari` sampai pointer di atas tepi atas kartu ke-`ke`. */
async function seret(dari, ke) {
  const pegangan = hal.locator(KARTU_BOTOL).nth(dari).locator('button[aria-label^="Urutkan"]');
  const a = await pegangan.boundingBox();
  const target = await hal.locator(KARTU_BOTOL).nth(ke).boundingBox();
  await hal.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await hal.mouse.down();
  await hal.mouse.move(a.x + a.width / 2, target.y + 3, { steps: 8 });
  await hal.mouse.up();
}

{
  const awal = await urutanKartu(KARTU_BOTOL);
  cek("ada minimal dua supplier botol untuk diurutkan", awal.length >= 2, awal.join(" | "));

  /* Kontrol lebih dulu: tekan-lepas tanpa bergerak tidak boleh mengubah apa pun. */
  const p = await hal.locator(KARTU_BOTOL).nth(1).locator('button[aria-label^="Urutkan"]').boundingBox();
  await hal.mouse.move(p.x + p.width / 2, p.y + p.height / 2);
  await hal.mouse.down();
  await hal.mouse.up();
  kontrol(
    "[kontrol negatif] tekan-lepas tanpa seret TIDAK mengubah urutan",
    (await urutanKartu(KARTU_BOTOL)).join("|") !== awal.join("|"),
  );

  await seret(1, 0);
  const sesudah = await urutanKartu(KARTU_BOTOL);
  cek("kartu kedua naik ke paling atas", sesudah[0] === awal[1] && sesudah[1] === awal[0], sesudah.join(" | "));

  const kolom = await urutanKolom();
  cek(
    "kolom tabel perbandingan ikut urutan baru",
    kolom[0]?.toUpperCase().includes(awal[1].toUpperCase()) && kolom[1]?.toUpperCase().includes(awal[0].toUpperCase()),
    kolom.join(" | "),
  );

  await buka("/supplier-kecil/index.html");
  const setelahMuatUlang = await urutanKartu(KARTU_BOTOL);
  cek("urutannya bertahan setelah halaman dimuat ulang (tersimpan di dokumen)", setelahMuatUlang.join("|") === sesudah.join("|"), setelahMuatUlang.join(" | "));
}

/* ═══════════════════════ 4. keyboard ══ */
console.log("\n=== 4. Panah atas/bawah di pegangan melakukan hal yang sama ===");

{
  const awal = await urutanKartu(KARTU_BOTOL);
  const pegangan = hal.locator(KARTU_BOTOL).first().locator('button[aria-label^="Urutkan"]');
  await pegangan.focus();
  await hal.keyboard.press("ArrowUp");
  cek("panah atas di kartu teratas tidak mengubah apa pun", (await urutanKartu(KARTU_BOTOL)).join("|") === awal.join("|"));

  await pegangan.focus();
  await hal.keyboard.press("ArrowDown");
  const sesudah = await urutanKartu(KARTU_BOTOL);
  cek("panah bawah menurunkan kartu satu posisi", sesudah[0] === awal[1] && sesudah[1] === awal[0], sesudah.join(" | "));
}

/* ═══════════════════════ 5. vendor baru langsung terbuka ══ */
console.log("\n=== 5. Vendor baru langsung terbuka, yang lain tidak ===");

{
  await hal.getByRole("button", { name: /Tambah supplier botol kecil/i }).click();
  const terakhir = hal.locator(KARTU_BOTOL).last();
  cek("kartu baru ada di paling bawah", ((await terakhir.locator("button[aria-expanded]").getAttribute("aria-label")) ?? "").includes("Supplier Baru"));
  cek("kartu baru langsung terbuka", (await terakhir.locator("button[aria-expanded]").getAttribute("aria-expanded")) === "true");
  cek("kartu lama tetap tertutup", (await hal.locator(KARTU_BOTOL).first().locator("button[aria-expanded]").getAttribute("aria-expanded")) === "false");
}

/* ═══════════════════════ 6. tab botol besar memakai susunan yang sama ══ */
console.log("\n=== 6. Tab Supplier Botol Besar memakai susunan yang sama ===");

{
  await buka("/supplier-besar/index.html");
  const judul = await hal.locator("main h2").allTextContents();
  cek("botol besar: bagian botol & packaging ada", judul.includes("Supplier Botol") && judul.includes("Supplier Packaging (Box)"));
  cek("botol besar: kartu packaging bisa dibuka", await hal.locator(KARTU_PKG).first().locator("button[aria-expanded]").count() === 1);
  cek("botol besar: ada pegangan seret di tiap kartu", (await hal.locator(`${KARTU_BOTOL} button[aria-label^="Urutkan"]`).count()) === (await hal.locator(KARTU_BOTOL).count()));
}

/* ═══════════════════════ 7. jarak kiri-kanan secukupnya ══ */
console.log("\n=== 7. Jarak kiri-kanan secukupnya — tidak selebar dulu, tidak mepet ===");

{
  /* Dua keluhan berurutan: 1180px menyisakan ruang kosong terlalu luas,
     selebar layar penuh terlalu mepet. Yang dituntut di monitor 1858px:
     tiap sisi tersisa antara 80 dan 250px. */
  const sisiWajar = (lebarIsi, lebarLayar) => {
    const sisi = (lebarLayar - lebarIsi) / 2;
    return sisi >= 80 && sisi <= 250;
  };
  await hal.setViewportSize({ width: 1858, height: 1000 });
  await buka("/supplier-kecil/index.html");
  const { lebarMain, lebarLayar } = await hal.evaluate(() => ({
    lebarMain: document.querySelector("main")?.getBoundingClientRect().width ?? 0,
    lebarLayar: document.documentElement.clientWidth,
  }));
  cek(
    "jarak tiap sisi 80–250px di monitor lebar",
    sisiWajar(lebarMain, lebarLayar),
    `isi ${lebarMain}px, sisi ${Math.round((lebarLayar - lebarMain) / 2)}px`,
  );
  kontrol("[kontrol negatif] batas lama 1180px (terlalu luas) ditolak", sisiWajar(1180, lebarLayar));
  kontrol("[kontrol negatif] selebar layar penuh (terlalu mepet) ditolak", sisiWajar(lebarLayar, lebarLayar));
}

/* ═══════════════════════ 8. kolom Komponen dibekukan ══ */
console.log("\n=== 8. Kolom 'Komponen' tetap di tempat saat tabel digulir ke samping ===");

{
  await hal.setViewportSize({ width: 700, height: 1000 });
  await buka("/supplier-kecil/index.html");
  const ukur = () =>
    hal.evaluate(() => {
      const t = document.querySelector("table");
      const wadah = t.parentElement;
      const kiri = (el) => el.getBoundingClientRect().left;
      return {
        meluber: wadah.scrollWidth - wadah.clientWidth,
        tepiWadah: kiri(wadah),
        komponen: kiri(t.querySelector("thead th")),
        labelBaris: kiri(t.querySelector("tbody td")),
        kolomData: kiri(t.querySelectorAll("thead th")[1]),
      };
    });
  const awal = await ukur();
  cek("tabel memang lebih lebar dari layarnya (uji tidak hampa)", awal.meluber > 150, `${awal.meluber}px meluber`);

  await hal.evaluate(() => {
    document.querySelector("table").parentElement.scrollLeft = 150;
  });
  const geser = await ukur();
  cek("judul 'Komponen' tidak ikut bergeser", Math.abs(geser.komponen - awal.komponen) <= 1, `${awal.komponen} → ${geser.komponen}`);
  cek("label baris tidak ikut bergeser", Math.abs(geser.labelBaris - awal.labelBaris) <= 1, `${awal.labelBaris} → ${geser.labelBaris}`);
  /* Keluhan kedua: kolom beku sempat menempel 20px ke dalam wadah scroll
     (padding wadahnya), dan isi yang digulir terlihat lewat di celah itu —
     di luar batas tabel. Kolom beku harus menempel PERSIS di tepi wadah. */
  cek(
    "kolom beku menempel persis di tepi wadah — tidak ada celah tempat isi bocor",
    Math.abs(geser.komponen - geser.tepiWadah) <= 1,
    `kolom ${geser.komponen}, tepi wadah ${geser.tepiWadah}`,
  );
  const celahLama = await hal.evaluate(() => {
    const wadah = document.querySelector("table").parentElement;
    wadah.style.padding = "0 20px";
    wadah.scrollLeft = 150;
    const celah = document.querySelector("table thead th").getBoundingClientRect().left - wadah.getBoundingClientRect().left;
    wadah.style.padding = "";
    return celah;
  });
  kontrol(
    "[kontrol negatif] padding lama yang disuntikkan memang memunculkan celah",
    Math.abs(celahLama) <= 1,
    `celah ${celahLama}px`,
  );
  kontrol(
    "[kontrol negatif] kolom supplier di sebelahnya MEMANG bergeser",
    Math.abs(geser.kolomData - awal.kolomData) < 100,
    `${awal.kolomData} → ${geser.kolomData}`,
  );

  /* Labelnya harus tetap terbaca, bukan tertimpa kolom yang lewat di bawahnya. */
  const latar = await hal.evaluate(() => getComputedStyle(document.querySelector("table tbody td")).backgroundColor);
  cek("sel label punya latar sendiri (tidak tembus)", latar !== "rgba(0, 0, 0, 0)" && latar !== "transparent", latar);
}

cek("tidak ada galat JavaScript", galat.length === 0, galat.slice(0, 2).join(" | "));

await peramban.close();
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
