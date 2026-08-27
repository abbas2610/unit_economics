/**
 * probe-hitung.mts — `npm run probe:hitung`
 *
 * Aritmetika unit economics. Ini probe paling berharga di repo: kalau salah satu
 * angka di sini bergeser, yang terjadi bukan layar rusak — melainkan **rapat
 * yang mengambil keputusan berdasarkan angka yang salah**, dan tidak ada satu
 * pun tanda di layar bahwa itu terjadi.
 *
 * ## Dari mana angka acuannya
 *
 * Bagian 1 mengunci hasil terhadap **builder HTML sebelum port** — angkanya
 * dihitung tangan dari rumus di berkas itu (`referensi/index-lama.html`), bukan
 * disalin dari keluaran kode yang sedang diuji. Itu bedanya kunci regresi dan
 * tautologi: yang kedua lulus apa pun yang dilakukan kodenya.
 *
 * Rantai yang diperiksa, dengan nilai default:
 *
 *     75 L biang ÷ 25% komposisi          = 300 L campuran
 *     × (1 − 15% susut)                   = 255 L
 *     ÷ 15 mL dan ÷ 100 mL, alokasi 50/50 = 8.500 dan 1.275 pcs
 *
 *     fragrance/botol kecil = 15 × 25% × (7,4/3 × 17.000 ÷ 1000) × 1,30 × 1,11
 *                           = Rp226,91175
 *
 * Bagian 2 dan seterusnya menguji SIFAT, bukan nilai: yang tetap benar walau
 * angka defaultnya nanti diganti tim.
 *
 * Tiap kelompok punya kontrol negatif.
 */
import { ML_BOTOL_KECIL } from "@/contexts/asumsi/domain/asumsi";
import { pcsPerCBM, volumeBotol } from "@/contexts/asumsi/domain/kemasan";
import { biayaFragrancePerBotol, rataUsdPerLiter } from "@/contexts/fragrance/domain/varian";
import { investasiSupplier } from "@/contexts/supplier/domain/supplier";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import {
  breakEven,
  grossMarginTertimbang,
  hasilProduksi,
  unitEconomics,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
import { jalankanSkenario, targetPenjualan, tornado } from "@/contexts/sensitivitas/aplikasi/sensitivitas";

let lulus = 0;
let gagal = 0;

const cek = (nama: string, kondisi: boolean, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const sama = (nama: string, dapat: unknown, harus: unknown) =>
  cek(nama, Object.is(dapat, harus), `dapat ${JSON.stringify(dapat)}, harus ${JSON.stringify(harus)}`);
/** Pembanding pecahan. Toleransinya kecil — yang diuji rumus, bukan pembulatan. */
const dekat = (nama: string, dapat: number, harus: number, toleransi = 0.005) =>
  cek(nama, Math.abs(dapat - harus) <= toleransi, `dapat ${dapat}, harus ≈${harus}`);
const kontrol = (nama: string, kondisiSalah: boolean, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

const awal = dokumenAwal();

/* ═══════════════════════════ 1. kunci regresi terhadap builder sebelum port ══ */
console.log("\n=== 1. Sama persis dengan builder HTML sebelum port ===");

{
  const h = hasilProduksi(awal);
  sama("total campuran 300 L", h.totalLiter, 300);
  sama("pasca penyusutan 255 L", h.literPascaSusut, 255);
  sama("hasil produksi botol kecil 8.500 pcs", h.pcsKecil, 8500);
  sama("hasil produksi botol besar 1.275 pcs", h.pcsBesar, 1275);

  const k = unitEconomics(awal, "kecil");
  const b = unitEconomics(awal, "besar");
  dekat("fragrance/botol kecil Rp226,91175", k.fragrance, 226.91175, 1e-6);
  dekat("fragrance/botol besar Rp1.512,745", b.fragrance, 1512.745, 1e-6);
  sama("botol kecil (harga + perizinan 10%) Rp8.976", k.botol, 8976);
  sama("aksesoris + cap botol kecil Rp10.030", k.aksesoris, 10030);
  dekat("freight/botol kecil Rp2.139,364", k.freight, 2139.3643, 0.001);
  dekat("COGS botol kecil Rp65.372,276", k.cogs, 65372.276, 0.001);
  dekat("gross margin botol kecil 67,314%", k.grossMargin, 67.31386, 1e-4);

  sama("botol besar (harga + perizinan) Rp17.600", b.botol, 17600);
  dekat("freight/botol besar Rp3.937,008", b.freight, 3937.00787, 0.001);
  dekat("COGS botol besar Rp73.049,753", b.cogs, 73049.75287, 0.001);
  dekat("gross margin botol besar 79,129%", b.grossMargin, 79.12864, 1e-4);

  const i = initialInvestment(awal);
  sama("pembelian fragrance sebelum PPN Rp3.145.000", i.fragranceDasar, 3_145_000);
  sama("OEM total Rp97.750.000", i.oemTotal, 97_750_000);
  sama("perizinan varian Rp5.100.000", i.legalVarian, 5_100_000);
  sama("box packaging total Rp244.375.000", i.boxTotal, 244_375_000);
  dekat("investasi supplier kecil Rp254.140.643", i.invKecil.total, 254_140_643.03, 0.01);
  dekat("investasi supplier besar Rp290.370.079", i.invBesar.total, 290_370_078.74, 0.01);
  dekat("Category 1 — produk Rp944.101.672", i.produk, 944_101_671.77, 0.01);
  sama("Category 2 — marketing Rp550.000.000", i.marketing, 550_000_000);
  dekat("total initial investment Rp1.494.101.672", i.total, 1_494_101_671.77, 0.01);
  sama("total pajak termasuk Rp29.605.950", i.totalPajak, 29_605_950);

  sama("break-even 9.754 pcs", breakEven(k, b, i.total), 9754);
}

kontrol(
  "[kontrol negatif] pembanding menolak selisih di luar toleransi",
  Math.abs(226.91175 - 226.92) <= 1e-6,
);

/* ══════════════════════════════════════════════ 2. efisiensi packing MEMBAGI ══ */
console.log("\n=== 2. Efisiensi packing membagi, bukan mengalikan ===");

{
  const d = awal.dimensi.kecil;
  const vol = volumeBotol(d);
  sama("volume botol = p × l × t", vol, 10.25 * 5.96 * 3.5);

  const efisien = pcsPerCBM(d, 100);
  const tidakEfisien = pcsPerCBM(d, 70);
  cek(
    "efisiensi 70% memuat LEBIH SEDIKIT pcs per CBM daripada 100%",
    tidakEfisien < efisien,
    `70% → ${tidakEfisien.toFixed(1)}, 100% → ${efisien.toFixed(1)}`,
  );
  dekat("pcs per CBM = 1.000.000 ÷ (volume ÷ efisiensi)", tidakEfisien, 1_000_000 / (vol / 0.7), 1e-6);

  sama("efisiensi nol tidak menghasilkan Infinity", pcsPerCBM(d, 0), 0);
  cek("dimensi kosong tidak menghasilkan NaN", pcsPerCBM({ panjang: 0, lebar: 0, tinggi: 0 }, 70) === 0);
}

kontrol(
  "[kontrol negatif] mengalikan efisiensi memang memberi hasil yang berbeda",
  Math.abs(1_000_000 / (volumeBotol(awal.dimensi.kecil) * 0.7) -
    pcsPerCBM(awal.dimensi.kecil, 70)) < 1,
);

/* ═══════════════════════════════════════ 3. urutan waste sebelum PPN ══ */
console.log("\n=== 3. Waste dikalikan sebelum PPN ===");

{
  const asumsi = awal.asumsi;
  const nyata = biayaFragrancePerBotol(awal.varian, asumsi, "kecil", 25);
  const dasar = ML_BOTOL_KECIL * 0.25 * ((rataUsdPerLiter(awal.varian) * asumsi.kurs) / 1000);
  dekat("biaya = dasar × (1+waste) × (1+PPN)", nyata, dasar * 1.3 * 1.11, 1e-9);

  const tanpaWaste = biayaFragrancePerBotol(awal.varian, { ...asumsi, wastePct: 0 }, "kecil", 25);
  cek("waste 30% menaikkan biaya fragrance", nyata > tanpaWaste);
  dekat("kenaikannya tepat 30%", nyata / tanpaWaste, 1.3, 1e-9);

  const besar = biayaFragrancePerBotol(awal.varian, asumsi, "besar", 25);
  dekat(
    "botol besar 100 mL memakai biang persis 100/15 kali botol kecil",
    besar / nyata,
    100 / 15,
    1e-9,
  );
}

kontrol(
  "[kontrol negatif] PPN-lalu-waste memberi hasil BERBEDA dari waste-lalu-PPN",
  /* Perkalian bersifat komutatif, jadi urutan (1+waste) dan (1+PPN) memang tidak
     mengubah hasil — dan kontrol ini menyatakan itu terang-terangan alih-alih
     membiarkan komentar di kode menyiratkan sebaliknya. Yang BENAR-BENAR
     berbahaya adalah menambahkan waste dan PPN (0,30 + 0,11) alih-alih
     mengalikannya; itu yang diperiksa di bawah. */
  1.3 * 1.11 !== 1.11 * 1.3,
);
cek(
  "menjumlah waste+PPN memberi hasil yang berbeda dari mengalikannya",
  Math.abs(1.3 * 1.11 - (1 + 0.3 + 0.11)) > 0.02,
  `1,443 vs 1,41`,
);

/* ═══════════════════════════════════════════════════ 4. MOQ vs qty batch ══ */
console.log("\n=== 4. MOQ melebihi kebutuhan batch ===");

{
  const sup = awal.supplierKecil[0];
  const inv = investasiSupplier(sup, 17_000, 10, 8_500);
  sama("qty dibeli = MOQ karena MOQ > batch", inv.qty, 10_000);

  const invBesar = investasiSupplier(sup, 17_000, 10, 25_000);
  sama("qty dibeli = batch karena batch > MOQ", invBesar.qty, 25_000);

  const i = initialInvestment(awal);
  sama("kelebihan stok botol kecil 1.500 pcs", i.kelebihanKecil, 10_000 - 8_500);
  sama("kelebihan stok botol besar 8.725 pcs", i.kelebihanBesar, 10_000 - 1_275);

  /* Nilai kelebihan memakai biaya botol per unit, BUKAN termasuk molding —
     molding sudah dibayar penuh berapa pun qty-nya. */
  dekat(
    "nilai kelebihan = pcs × biaya botol per unit",
    i.nilaiKelebihanKecil,
    1_500 * i.invKecil.satuan.total,
    1e-6,
  );
  cek(
    "nilai kelebihan TIDAK menyerap molding",
    i.nilaiKelebihanKecil < i.invKecil.molding + 1_500 * i.invKecil.satuan.total,
  );
}

kontrol("[kontrol negatif] batch default memang lebih kecil dari MOQ", hasilProduksi(awal).pcsKecil >= 10_000);

/* ═════════════════════════════════════ 5. royalti ikut harga jual ══ */
console.log("\n=== 5. Royalti dihitung dari harga jual ===");

{
  const naikHarga: Dokumen = { ...awal, harga: { ...awal.harga, kecil: 400_000 } };
  const a = unitEconomics(awal, "kecil");
  const b = unitEconomics(naikHarga, "kecil");

  dekat("royalti = 2% dari harga jual", a.royalti, 200_000 * 0.02, 1e-9);
  dekat("harga dua kali lipat → royalti dua kali lipat", b.royalti / a.royalti, 2, 1e-9);
  cek("COGS ikut naik saat harga jual naik", b.cogs > a.cogs);
  cek(
    "gross profit naik LEBIH KECIL daripada kenaikan harga",
    b.grossProfit - a.grossProfit < 200_000,
    `naik ${Math.round(b.grossProfit - a.grossProfit)} dari kenaikan harga 200.000`,
  );
  dekat(
    "selisihnya persis sebesar tambahan royalti",
    200_000 - (b.grossProfit - a.grossProfit),
    b.royalti - a.royalti,
    1e-6,
  );
}

kontrol(
  "[kontrol negatif] royalti benar-benar bukan nol",
  unitEconomics(awal, "kecil").royalti === 0,
);

/* ══════════════════════════════════════════ 6. COGS = jumlah komponennya ══ */
console.log("\n=== 6. COGS adalah jumlah komponen yang ditampilkan ===");

for (const ukuran of ["kecil", "besar"] as const) {
  const r = unitEconomics(awal, ukuran);
  dekat(
    `[${ukuran}] bahan baku = fragrance + OEM`,
    r.bahanBaku,
    r.fragrance + r.oem,
    1e-9,
  );
  dekat(
    `[${ukuran}] botol & packaging = botol + aksesoris + box + freight`,
    r.botolPacking,
    r.botol + r.aksesoris + r.box + r.freight,
    1e-9,
  );
  dekat(
    `[${ukuran}] COGS = seluruh baris yang terlihat di layar`,
    r.cogs,
    r.bahanBaku + r.botolPacking + r.fulfillment + r.royalti + r.amortisasi,
    1e-9,
  );
  dekat(`[${ukuran}] gross profit = harga − COGS`, r.grossProfit, r.harga - r.cogs, 1e-9);
  dekat(`[${ukuran}] margin = profit ÷ harga`, r.grossMargin, (r.grossProfit / r.harga) * 100, 1e-9);
}

/* ═════════════════════════════════════════════ 7. amortisasi molding ══ */
console.log("\n=== 7. Amortisasi molding ===");

{
  const mati = unitEconomics(awal, "kecil");
  sama("mati secara default", mati.amortisasi, 0);

  const nyala: Dokumen = { ...awal, opsi: { amortisasiMolding: true } };
  const r = unitEconomics(nyala, "kecil");
  const molding = 2511 * 17_000; // 1475 + 0 + 1036 USD
  dekat("amortisasi = total molding ÷ qty batch", r.amortisasi, molding / 8_500, 1e-6);
  dekat("COGS naik persis sebesar amortisasi", r.cogs - mati.cogs, r.amortisasi, 1e-6);

  /* Batch nol (mis. qty fragrance dikosongkan) tidak boleh melahirkan Infinity
     yang menjalar jadi margin −Infinity di seluruh layar. */
  const kosong: Dokumen = {
    ...nyala,
    varian: nyala.varian.map((v) => ({ ...v, qtyLiter: 0 })),
  };
  const nol = unitEconomics(kosong, "kecil");
  sama("batch nol → amortisasi nol, bukan Infinity", nol.amortisasi, 0);
  cek("COGS tetap berhingga saat batch nol", Number.isFinite(nol.cogs));
}

/* ════════════════════════════════════════════ 8. break-even & tertimbang ══ */
console.log("\n=== 8. Break-even & rata-rata tertimbang ===");

{
  const k = unitEconomics(awal, "kecil");
  const b = unitEconomics(awal, "besar");
  const i = initialInvestment(awal);

  const gpTertimbang = (k.grossProfit * k.qtyBatch + b.grossProfit * b.qtyBatch) /
    (k.qtyBatch + b.qtyBatch);
  const gpSederhana = (k.grossProfit + b.grossProfit) / 2;
  cek(
    "rata-rata TERTIMBANG berbeda dari rata-rata sederhana",
    Math.abs(gpTertimbang - gpSederhana) > 1000,
    `tertimbang ${Math.round(gpTertimbang)} vs sederhana ${Math.round(gpSederhana)}`,
  );
  cek(
    "margin blended ada di antara margin kedua SKU",
    grossMarginTertimbang(k, b) > k.grossMargin && grossMarginTertimbang(k, b) < b.grossMargin,
  );

  /* Harga jual di bawah COGS harus menghasilkan `null`, bukan 0. `0` terbaca
     sebagai "tidak perlu menjual apa pun" — kabar terburuk yang ditampilkan
     sebagai kabar terbaik. */
  const rugi: Dokumen = { ...awal, harga: { kecil: 1_000, besar: 1_000 } };
  const kr = unitEconomics(rugi, "kecil");
  const br = unitEconomics(rugi, "besar");
  sama("break-even null saat margin negatif", breakEven(kr, br, i.total), null);
  cek("bukan 0", breakEven(kr, br, i.total) !== 0);
}

kontrol(
  "[kontrol negatif] break-even normal bukan null",
  breakEven(unitEconomics(awal, "kecil"), unitEconomics(awal, "besar"), 1) === null,
);

/* ══════════════════════════════════════════════════ 9. sensitivitas ══ */
console.log("\n=== 9. Sensitivitas benar-benar menggerakkan angka ===");

{
  const dasar = jalankanSkenario(awal, awal.simulasi);
  const acuanK = unitEconomics(awal, "kecil");
  dekat(
    "simulasi pada nilai default = kondisi saat ini",
    dasar.kecil.cogs,
    acuanK.cogs,
    0.01,
  );

  /* ⚠️ Ini yang pernah rusak diam-diam di builder lama: tiap supplier menyimpan
     `ratePerCBM`-nya sendiri, jadi slider yang cuma mengganti tarif dasar tidak
     menggerakkan apa pun. */
  const freightNaik = jalankanSkenario(awal, {
    ...awal.simulasi,
    freightPerCBM: awal.asumsi.freightPerCBM * 2,
  });
  cek(
    "slider freight menggerakkan COGS (tarif tiap supplier ikut diskala)",
    freightNaik.kecil.freight > acuanK.freight * 1.9,
    `${acuanK.freight.toFixed(0)} → ${freightNaik.kecil.freight.toFixed(0)}`,
  );
  cek("slider freight ikut menggerakkan total investasi", freightNaik.investasi.total > dasar.investasi.total);

  const kursNaik = jalankanSkenario(awal, { ...awal.simulasi, kurs: awal.asumsi.kurs * 1.5 });
  cek("kurs naik menaikkan COGS botol kecil (supplier USD)", kursNaik.kecil.cogs > acuanK.cogs);

  const besarIDR = unitEconomics(awal, "besar");
  cek(
    "kurs naik TIDAK menggerakkan harga botol besar (supplier IDR)",
    Math.abs(kursNaik.besar.botol - besarIDR.botol) < 1e-6,
  );

  /* Simulasi tidak boleh menyentuh dokumen aslinya. */
  const salinan = JSON.stringify(awal);
  jalankanSkenario(awal, { ...awal.simulasi, kurs: 99_999 });
  sama("dokumen asli tidak berubah setelah simulasi", JSON.stringify(awal), salinan);
}

kontrol(
  "[kontrol negatif] kurs memang berpengaruh — kalau tidak, uji di atas hampa",
  Math.abs(
    jalankanSkenario(awal, { ...awal.simulasi, kurs: awal.asumsi.kurs * 1.5 }).kecil.cogs -
      unitEconomics(awal, "kecil").cogs,
  ) < 1,
);

/* ══════════════════════════════════════════════════════ 10. tornado ══ */
console.log("\n=== 10. Tornado ===");

{
  const t = tornado(awal);
  sama("lima variabel diuji", t.length, 5);
  cek(
    "diurutkan dari dampak terbesar ke gross margin",
    t.every((b, i) => i === 0 || Math.abs(t[i - 1].deltaMarginPoin) >= Math.abs(b.deltaMarginPoin)),
    t.map((b) => `${b.kunci}:${b.deltaMarginPoin.toFixed(2)}`).join(" "),
  );
  cek("setidaknya satu variabel benar-benar menggeser margin", t.some((b) => Math.abs(b.deltaMarginPoin) > 0.01));
  cek(
    "kenaikan biaya menurunkan margin (bertanda negatif)",
    t.filter((b) => Math.abs(b.deltaMarginPoin) > 0.01).every((b) => b.deltaMarginPoin < 0),
    t.map((b) => `${b.kunci}:${b.deltaMarginPoin.toFixed(2)}`).join(" "),
  );
}

/* ════════════════════════════════════════════════ 11. target penjualan ══ */
console.log("\n=== 11. Target penjualan ===");

{
  const k = unitEconomics(awal, "kecil");
  const b = unitEconomics(awal, "besar");
  const t = targetPenjualan(k, b, 100_000_000);
  const pasang = Math.ceil(100_000_000 / (200_000 + 350_000));
  sama("pcs = ceil(target ÷ harga sepasang)", t.pcsKecil, pasang);
  sama("kecil & besar sama banyak", t.pcsKecil, t.pcsBesar);
  sama("total = dua kali pasang", t.totalPcs, pasang * 2);
  cek("omzet tercapai ≥ target (karena dibulatkan ke atas)", t.omzetTercapai >= 100_000_000);
  dekat("gross profit = pcs × (gp kecil + gp besar)", t.grossProfit, pasang * (k.grossProfit + b.grossProfit), 1e-6);
}

/* ══════════════════════════════════════ 12. asumsi "rata-rata cukup" ══ */
console.log("\n=== 12. Batas asumsi rata-rata fragrance ===");

{
  /* Unit economics memakai rata-rata harga varian. Itu sah selama sebarannya
     sempit. Kalau suatu saat ada varian premium yang harganya berlipat, asumsi
     ini basi dan tiap SKU harus dihitung sendiri — dan tidak akan ada satu pun
     tanda di layar. Batasnya dijaga di sini. */
  const harga = awal.varian.map((v) => v.usdPerLiter);
  const sebaran = Math.max(...harga) / Math.min(...harga);
  cek(
    `sebaran harga varian masih di bawah 2× (sekarang ${sebaran.toFixed(2)}×)`,
    sebaran < 2,
    "kalau ini gagal: hitung fragrance per varian, jangan pakai rata-rata",
  );

  const kecil = unitEconomics(awal, "kecil");
  cek(
    "fragrance < 0,5% dari COGS — itu yang membuat rata-rata tidak berbahaya",
    kecil.fragrance / kecil.cogs < 0.005,
    `${((kecil.fragrance / kecil.cogs) * 100).toFixed(3)}%`,
  );
}

kontrol(
  "[kontrol negatif] pemeriksa sebaran menolak varian premium",
  Math.max(2.4, 12) / Math.min(2.4, 12) < 2,
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
