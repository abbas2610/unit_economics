/**
 * probe-dokumen.mts — `npm run probe:dokumen`
 *
 * Menjaga jalan masuk data dari luar aplikasi: baris Supabase yang dipakai tim,
 * cadangan localStorage, dan berkas JSON hasil export.
 *
 * ## Kenapa ini bukan uji "nice to have"
 *
 * Baris `sos-unit-economics` di Supabase hari ini berisi payload bentuk LAMA.
 * Kalau `bacaDokumen()` salah membacanya, yang hilang bukan tampilan — yang
 * hilang seluruh angka penawaran supplier yang sudah dikumpulkan tim, diganti
 * angka contoh, lalu **ditulis balik ke Supabase oleh penyimpanan otomatis**.
 * Tidak ada satu pun error di layar saat itu terjadi.
 *
 * Payload v0 di bawah disalin dari `defaultState()` di
 * `referensi/index-lama.html` — bentuknya, bukan sekadar contoh yang dikarang.
 */
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import { bacaDokumen, idBerikutnya } from "@/contexts/dokumen/domain/migrasi";
import { unitEconomics } from "@/contexts/unit-economics/aplikasi/unit-economics";

let lulus = 0;
let gagal = 0;

const cek = (nama: string, kondisi: boolean, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const sama = (nama: string, dapat: unknown, harus: unknown) =>
  cek(nama, Object.is(dapat, harus), `dapat ${JSON.stringify(dapat)}, harus ${JSON.stringify(harus)}`);
const kontrol = (nama: string, kondisiSalah: boolean, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

/** Bentuk v0 — persis seperti yang tersimpan builder HTML. */
const payloadV0 = {
  base: {
    kurs: 17000,
    freightPerCBM: 7000000,
    packingEfficiency: 70,
    oemCostSmall: 10000,
    oemCostLarge: 10000,
    wastePct: 30,
    ppnPct: 11,
    perizinanPct: 10,
    mirantiPct: 2,
    boxPackaging: 20000,
    boxAksesoris: 5000,
    fulfillmentCost: 5000,
    largeSizeML: 100,
    mix: { fragrancePct: 25, shrinkagePct: 15, splitLargePct: 50 },
    legalPerVarian: { bpom: 1000000, halal: 700000 },
    fragrances: [
      { name: "Prime Obsession", usdPerLiter: 2.4, qtyLiter: 25 },
      { name: "Recomm by Strangers", usdPerLiter: 2.4, qtyLiter: 25 },
      { name: "I Feel The Rush", usdPerLiter: 2.6, qtyLiter: 25 },
    ],
  },
  bottles: {
    small: { dims: { l: 10.25, w: 5.96, h: 3.5 } },
    large: { dims: { l: 12.5, w: 7.0, h: 4.5 } },
  },
  smallSuppliers: [
    {
      id: "s1",
      name: "Gelas Bening (A)",
      currency: "USD",
      moq: 10000,
      molding: { botol: 1475, cap: 0, silicon: 1036 },
      unit: { botol: 0.48, cap: 0, aksesoris: 0.59 },
      freight: { enabled: true, pcsPerCBM: 3272, ratePerCBM: 7000000 },
    },
    {
      id: "s2",
      name: "Model Batu (B)",
      currency: "USD",
      moq: 10000,
      molding: { botol: 1475, cap: 1160, silicon: 1475 },
      unit: { botol: 0.59, cap: 0, aksesoris: 0.46 },
      freight: { enabled: true, pcsPerCBM: 3272, ratePerCBM: 7000000 },
    },
  ],
  largeSuppliers: [
    {
      id: "l1",
      name: "Vendor Lokal A",
      currency: "IDR",
      moq: 10000,
      molding: { botol: 25000000, cap: 20000000, silicon: 0 },
      unit: { botol: 16000, cap: 0, aksesoris: 3000 },
      freight: { enabled: true, pcsPerCBM: 1778, ratePerCBM: 7000000 },
    },
  ],
  selection: { smallId: "s1", largeId: "l1" },
  projection: { batchSmall: 2125, batchLarge: 2125, priceSmall: 200000, priceLarge: 350000 },
  marketing: { offline: 300000000, online: 200000000, others: 50000000 },
  options: { amortize: false },
  ueScenarios: [],
  sim: {
    kurs: 17000,
    freightPerCBM: 7000000,
    fragAvgUsdPerLiter: 2.4666666666666663,
    wastePct: 30,
    shrinkagePct: 15,
    priceSmall: 200000,
    priceLarge: 350000,
    targetRevenue: 100000000,
  },
};

/* ═══════════════════════════════════ 1. bentuk lama terbaca utuh ══ */
console.log("\n=== 1. Payload v0 terbaca utuh ===");

{
  const d = bacaDokumen(payloadV0);
  sama("versi dinaikkan ke 1", d.versi, 1);
  sama("kurs", d.asumsi.kurs, 17000);
  sama("fulfillmentCost → fulfillment", d.asumsi.fulfillment, 5000);
  sama("largeSizeML → mlBotolBesar", d.asumsi.mlBotolBesar, 100);
  sama("mix.shrinkagePct → campuran.susutPct", d.campuran.susutPct, 15);
  sama("mix.splitLargePct → alokasiBesarPct", d.campuran.alokasiBesarPct, 50);
  sama("jumlah varian", d.varian.length, 3);
  sama("fragrances[].name → varian[].nama", d.varian[0].nama, "Prime Obsession");
  sama("dims.l → dimensi.panjang", d.dimensi.kecil.panjang, 10.25);
  sama("dims.w → dimensi.lebar", d.dimensi.kecil.lebar, 5.96);
  sama("dims.h → dimensi.tinggi", d.dimensi.kecil.tinggi, 3.5);
  sama("smallSuppliers → supplierKecil", d.supplierKecil.length, 2);
  sama("supplier.name → nama", d.supplierKecil[0].nama, "Gelas Bening (A)");
  sama("supplier.currency → mataUang", d.supplierKecil[0].mataUang, "USD");
  sama("molding.silicon → silikon", d.supplierKecil[0].molding.silikon, 1036);
  sama("unit → satuan", d.supplierKecil[0].satuan.botol, 0.48);
  sama("freight.enabled → aktif", d.supplierKecil[0].freight.aktif, true);
  sama("selection.smallId → pilihan.kecilId", d.pilihan.kecilId, "s1");
  sama("projection.priceSmall → harga.kecil", d.harga.kecil, 200000);
  sama("marketing.others → lainnya", d.marketing.lainnya, 50000000);
  sama("options.amortize → opsi.amortisasiMolding", d.opsi.amortisasiMolding, false);
  sama("sim.targetRevenue → simulasi.targetOmzet", d.simulasi.targetOmzet, 100000000);

  /* Yang paling penting: hasil hitungnya sama dengan dokumen awal. Kalau satu
     field terlewat, angkanya bergeser tanpa satu pun field terlihat kosong. */
  const dariV0 = unitEconomics(d, "kecil");
  const dariAwal = unitEconomics(dokumenAwal(), "kecil");
  cek(
    "COGS hasil migrasi = COGS dokumen awal",
    Math.abs(dariV0.cogs - dariAwal.cogs) < 1e-9,
    `${dariV0.cogs} vs ${dariAwal.cogs}`,
  );
}

kontrol(
  "[kontrol negatif] payload v0 memang bukan bentuk sekarang",
  "asumsi" in payloadV0,
);

/* ══════════════════════ 2. qty batch TIDAK diambil dari payload lama ══ */
console.log("\n=== 2. Qty batch diturunkan, tidak diwarisi ===");

{
  /* `projection.batchSmall: 2125` ada di payload v0, dan di sana ia SELALU
     ditimpa hasil campuran sebelum dipakai. Kalau migrasi menyimpannya, angka
     basi itu hidup lagi — dan ia dipakai membagi amortisasi molding. */
  const d = bacaDokumen(payloadV0);
  const r = unitEconomics(d, "kecil");
  sama("qty batch = hasil campuran, bukan 2.125 dari payload", r.qtyBatch, 8500);
  cek("tidak ada field batch tersimpan di dokumen", !("projection" in (d as object)));
}

/* ═══════════════════════════ 3. bentuk yang lebih tua lagi ══ */
console.log("\n=== 3. oemCost tunggal (bentuk lebih tua) ===");

{
  const lebihTua = {
    ...payloadV0,
    base: {
      ...payloadV0.base,
      oemCost: 12345,
      oemCostSmall: undefined,
      oemCostLarge: undefined,
    },
  };
  const d = bacaDokumen(lebihTua);
  sama("oemCost disalin ke botol kecil", d.asumsi.oemKecil, 12345);
  sama("oemCost disalin ke botol besar", d.asumsi.oemBesar, 12345);
  cek(
    "bukan diganti angka contoh",
    d.asumsi.oemKecil !== dokumenAwal().asumsi.oemKecil,
    "angka yang pernah diisi tim lebih benar daripada default",
  );
}

/* ══════════════════ 4. jebakan Object.assign yang dangkal ══ */
console.log("\n=== 4. Objek bersarang yang hilang terisi default ===");

{
  /* Builder lama memuat dengan `Object.assign(defaultState(), payload)`. Payload
     tanpa `base.mix` membuat SELURUH `mix` hilang, bukan terisi default. */
  const tanpaMix = { ...payloadV0, base: { ...payloadV0.base, mix: undefined } };
  const d = bacaDokumen(tanpaMix);
  sama("fragrancePct terisi default", d.campuran.fragrancePct, 25);
  sama("susutPct terisi default", d.campuran.susutPct, 15);
  sama("alokasiBesarPct terisi default", d.campuran.alokasiBesarPct, 50);
  cek("nilai lain tidak ikut hilang", d.asumsi.kurs === 17000);

  const tanpaLegal = { ...payloadV0, base: { ...payloadV0.base, legalPerVarian: undefined } };
  sama("legalPerVarian terisi default", bacaDokumen(tanpaLegal).legalPerVarian.bpom, 1_000_000);
}

kontrol(
  "[kontrol negatif] Object.assign memang menghapus objek bersarang",
  Object.assign({ base: { mix: { a: 1 }, kurs: 1 } }, { base: { kurs: 2 } }).base.mix !== undefined,
);

/* ═════════════════════════════════ 5. id ganda merusak data ══ */
console.log("\n=== 5. Id ganda diperbaiki, pilihan ikut pindah ===");

{
  const idGanda = {
    ...payloadV0,
    smallSuppliers: [
      { ...payloadV0.smallSuppliers[0], id: "s1" },
      { ...payloadV0.smallSuppliers[1], id: "s1" }, // bentrok
    ],
    selection: { smallId: "s1", largeId: "l1" },
  };
  const d = bacaDokumen(idGanda);
  const ids = d.supplierKecil.map((s) => s.id);
  sama("dua supplier tetap ada", d.supplierKecil.length, 2);
  cek("id-nya sekarang berbeda", new Set(ids).size === 2, ids.join(", "));
  cek(
    "supplier terpilih menunjuk supplier yang benar-benar ada",
    ids.includes(d.pilihan.kecilId),
    `pilihan ${d.pilihan.kecilId}, ada ${ids.join("/")}`,
  );

  /* Id berikutnya dihitung dari yang TERTINGGI, bukan pencacah yang mulai
     ulang di 100 tiap muat halaman. */
  const tinggi = bacaDokumen({
    ...payloadV0,
    smallSuppliers: [{ ...payloadV0.smallSuppliers[0], id: "s450" }],
  });
  cek("id berikutnya melewati id tertinggi", idBerikutnya(tinggi) > 450, String(idBerikutnya(tinggi)));
}

kontrol(
  "[kontrol negatif] pemeriksa benar-benar mendeteksi id kembar",
  new Set(["s1", "s1"]).size === 2,
);

/* ═════════════════════════ 6. pilihan menunjuk supplier terhapus ══ */
console.log("\n=== 6. Pilihan yang menunjuk supplier tidak ada ===");

{
  const d = bacaDokumen({ ...payloadV0, selection: { smallId: "sudah-dihapus", largeId: "l1" } });
  cek(
    "pilihan dipindah ke supplier yang ada",
    d.supplierKecil.some((s) => s.id === d.pilihan.kecilId),
    d.pilihan.kecilId,
  );
  cek("pilihan yang sahih tidak ikut diubah", d.pilihan.besarId === "l1");
}

/* ═════════════════════════════════ 7. payload rusak tidak melempar ══ */
console.log("\n=== 7. Payload rusak → dokumen awal, bukan lemparan ===");

for (const [nama, payload] of [
  ["null", null],
  ["undefined", undefined],
  ["string", "bukan dokumen"],
  ["angka", 42],
  ["objek kosong", {}],
  ["larik", [1, 2, 3]],
  ["payload asing", { entah: "apa" }],
] as const) {
  let lempar = false;
  let versi: unknown = null;
  try {
    versi = bacaDokumen(payload).versi;
  } catch {
    lempar = true;
  }
  cek(`${nama} tidak melempar dan menghasilkan dokumen sahih`, !lempar && versi === 1);
}

/* ═══════════════════════════ 8. angka tidak masuk akal ══ */
console.log("\n=== 8. Nilai yang tidak masuk akal tidak jadi NaN ===");

{
  const kotor = {
    ...payloadV0,
    base: {
      ...payloadV0.base,
      kurs: null,
      wastePct: "30",
      ppnPct: "bukan angka",
    },
  };
  const d = bacaDokumen(kotor);
  sama("null → default", d.asumsi.kurs, 17000);
  sama("string angka → angka", d.asumsi.wastePct, 30);
  sama("string sampah → default", d.asumsi.ppnPct, 11);

  const r = unitEconomics(d, "kecil");
  cek("tidak ada NaN yang menjalar ke COGS", Number.isFinite(r.cogs));
  cek("tidak ada NaN di gross margin", Number.isFinite(r.grossMargin));
}

kontrol(
  "[kontrol negatif] NaN memang menjalar kalau dibiarkan",
  Number.isFinite(NaN + 1000),
);

/* ═══════════════════════════════ 9. bolak-balik JSON ══ */
console.log("\n=== 9. Export → import mempertahankan dokumen ===");

{
  const asli = dokumenAwal();
  const balik = bacaDokumen(JSON.parse(JSON.stringify(asli)));
  sama("dokumen identik setelah bolak-balik JSON", JSON.stringify(balik), JSON.stringify(asli));

  /* Berkas JSON hasil export builder LAMA juga harus bisa di-import — itu satu
     kotak masuk yang tim benar-benar pakai saat menukar skenario lewat chat. */
  const dariLama = bacaDokumen(JSON.parse(JSON.stringify(payloadV0)));
  cek("berkas export builder lama bisa di-import", dariLama.supplierKecil.length === 2);
}

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
