/**
 * probe-pembelian.mts — `npm run probe:pembelian`
 *
 * Menjaga pemisahan yang baru: **kapasitas cairan**, **qty diminta**, **qty
 * dibeli**, dan **qty produksi** adalah empat angka berbeda.
 *
 * ## Kenapa probe ini ada
 *
 * Sebelumnya keempatnya satu angka (`qtyBatch`), dan penyatuan itu melahirkan
 * empat kesalahan sekaligus — semuanya diam, semuanya menghasilkan rupiah yang
 * kelihatan wajar:
 *
 *   1. MOQ 100 pcs pada kebutuhan 8.500 menghasilkan Rp84 juta, dan tidak ada
 *      cara memodelkan "beli 100 botol saja". Yang bertanya mendapat jawaban
 *      untuk 8.500 botol tanpa satu pun tanda bahwa pertanyaannya tidak dijawab.
 *   2. Botol kelebihan MOQ dinilai TANPA freight — 9,6% lebih rendah dari yang
 *      benar-benar dibayar, padahal botol itu ikut dikapalkan.
 *   3. Toggle amortisasi cuma membagi molding; kelebihan MOQ yang jumlahnya
 *      sebanding tidak muncul di mana pun.
 *   4. Tabel perbandingan menobatkan "termurah" di atas qty yang berbeda, jadi
 *      supplier yang seluruh harganya masih Rp0 selalu menang.
 *
 * Tiap kelompok punya kontrol negatif: pelanggarannya disuntikkan, dan
 * detektornya harus menyala. Kontrol yang ikut lulus berarti ujinya tidak
 * menguji apa pun, dan itu tidak terlihat dari baris hijaunya.
 */
import { biayaSatuan, investasiSupplier } from "@/contexts/supplier/domain/supplier";
import type { Supplier } from "@/contexts/supplier/domain/supplier";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import { bacaDokumen } from "@/contexts/dokumen/domain/migrasi";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import {
  kapasitasCairan,
  qtyBeli,
  qtyDiminta,
  qtyProduksi,
  supplierTerpilih,
  unitEconomics,
} from "@/contexts/unit-economics/aplikasi/unit-economics";

let lulus = 0;
let gagal = 0;

const cek = (nama: string, kondisi: boolean, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const sama = (nama: string, dapat: unknown, harus: unknown) =>
  cek(nama, Object.is(dapat, harus), `dapat ${JSON.stringify(dapat)}, harus ${JSON.stringify(harus)}`);
const dekat = (nama: string, dapat: number, harus: number, toleransi = 0.005) =>
  cek(nama, Math.abs(dapat - harus) <= toleransi, `dapat ${dapat}, harus ≈${harus}`);
const kontrol = (nama: string, kondisiSalah: boolean, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

const awal = dokumenAwal();

/* ═══════════════════════ 1. MOQ adalah LANTAI, bukan pesanan ══ */
console.log("\n=== 1. MOQ adalah lantai, bukan jumlah yang dipesan ===");

{
  /* Kasus nyata yang melahirkan seluruh perubahan ini: harga botol $0,5 dengan
     MOQ 100, dan hasilnya Rp84 juta. Benar — karena yang dikalikan 8.500, bukan
     100. Angka 100 tidak mengikat apa pun. */
  const murah: Supplier = {
    id: "s9",
    nama: "MOQ rendah",
    mataUang: "USD",
    moq: 100,
    molding: { botol: 0, cap: 0, silikon: 0 },
    satuan: { botol: 0.5, cap: 0, aksesoris: 0 },
    freight: { aktif: false, pcsPerCBM: 3272, ratePerCBM: 7_000_000 },
  };
  const dok: Dokumen = {
    ...awal,
    asumsi: { ...awal.asumsi, kurs: 18_000 },
    supplierKecil: [murah],
    pilihan: { ...awal.pilihan, kecilId: "s9" },
  };

  sama("kapasitas cairan 8.500 pcs", kapasitasCairan(dok, "kecil"), 8500);
  sama("qty diminta ikut kapasitas kalau pembelian null", qtyDiminta(dok, "kecil"), 8500);
  sama("MOQ 100 TIDAK mengikat", qtyBeli(dok, "kecil", murah), 8500);
  sama("qty produksi 8.500", qtyProduksi(dok, "kecil"), 8500);

  const inv = investasiSupplier(murah, 18_000, 10, qtyDiminta(dok, "kecil"));
  sama("moqMengikat = false", inv.moqMengikat, false);
  dekat("total = 8.500 × Rp9.000 × 1,1 perizinan = Rp84.150.000", inv.total, 84_150_000, 0.5);
}

kontrol(
  "[kontrol negatif] MOQ 100 memang jauh di bawah kapasitas — kalau tidak, uji di atas hampa",
  100 >= kapasitasCairan(awal, "kecil"),
);

/* ═══════════════════════ 2. beli 100 botol saja ══ */
console.log("\n=== 2. Pembelian sampel — beli 100 botol saja ===");

{
  const dok: Dokumen = { ...awal, pembelian: { kecil: 100, besar: null } };

  sama("qty diminta = 100", qtyDiminta(dok, "kecil"), 100);
  sama("kapasitas cairan tetap 8.500", kapasitasCairan(dok, "kecil"), 8500);
  /* Supplier default ber-MOQ 10.000, jadi MOQ-nya yang menang di sini. */
  sama("qty dibeli = MOQ 10.000 (MOQ mengikat)", qtyBeli(dok, "kecil", supplierTerpilih(dok, "kecil")), 10_000);

  /* Supplier ber-MOQ rendah supaya pembelian 100 benar-benar terpakai. */
  const kecilMoqRendah: Supplier = { ...awal.supplierKecil[0], id: "s9", moq: 1 };
  const dok2: Dokumen = {
    ...dok,
    supplierKecil: [kecilMoqRendah],
    pilihan: { ...dok.pilihan, kecilId: "s9" },
  };
  sama("qty dibeli = 100", qtyBeli(dok2, "kecil", kecilMoqRendah), 100);
  sama("qty produksi = 100, bukan 8.500", qtyProduksi(dok2, "kecil"), 100);

  const u = unitEconomics(dok2, "kecil");
  sama("RincianUnit.qtyProduksi = 100", u.qtyProduksi, 100);
  sama("tidak ada botol kelebihan", u.kelebihanBotol, 0);
  sama(
    "cairan 8.400 botol tidak terbotolkan = 126.000 mL",
    u.mlTakTerbotolkan,
    8_400 * 15,
  );

  const i = initialInvestment(dok2);
  sama("OEM & box mengalikan 100, bukan 8.500", i.qtyKecil, 100);
  dekat("OEM botol kecil = 100 × Rp10.000", i.qtyKecil * dok2.asumsi.oemKecil, 1_000_000, 1e-6);
  cek("sisa cairan dilaporkan", i.mlTakTerbotolkanKecil > 0, `${i.mlTakTerbotolkanKecil} mL`);
}

kontrol(
  "[kontrol negatif] pembelian null TIDAK dibaca sebagai 0 botol",
  qtyDiminta({ ...awal, pembelian: { kecil: null, besar: null } }, "kecil") === 0,
);
kontrol(
  "[kontrol negatif] pembelian 0 BERBEDA dari null",
  qtyDiminta({ ...awal, pembelian: { kecil: 0, besar: null } }, "kecil") ===
    qtyDiminta({ ...awal, pembelian: { kecil: null, besar: null } }, "kecil"),
);

/* ═══════════════════════ 3. qty produksi dibatasi DUA arah ══ */
console.log("\n=== 3. Produksi dibatasi cairan DAN botol ===");

{
  /* Beli lebih banyak dari kapasitas cairan → produksi tetap dibatasi cairan. */
  const banyak: Dokumen = { ...awal, pembelian: { kecil: 50_000, besar: null } };
  sama("beli 50.000, cairan cukup 8.500 → produksi 8.500", qtyProduksi(banyak, "kecil"), 8500);
  const u = unitEconomics(banyak, "kecil");
  sama("kelebihan botol = 41.500", u.kelebihanBotol, 41_500);
  sama("tidak ada cairan tersisa", u.mlTakTerbotolkan, 0);

  /* Beli lebih sedikit → produksi dibatasi botol. */
  const sedikit: Dokumen = {
    ...awal,
    supplierKecil: [{ ...awal.supplierKecil[0], id: "s9", moq: 1 }],
    pilihan: { ...awal.pilihan, kecilId: "s9" },
    pembelian: { kecil: 2_000, besar: null },
  };
  sama("beli 2.000 → produksi 2.000", qtyProduksi(sedikit, "kecil"), 2000);
  sama("cairan tersisa 6.500 botol", unitEconomics(sedikit, "kecil").mlTakTerbotolkan, 6_500 * 15);
}

kontrol(
  "[kontrol negatif] produksi TIDAK boleh melebihi kapasitas cairan",
  qtyProduksi({ ...awal, pembelian: { kecil: 50_000, besar: null } }, "kecil") > 8500,
);

/* ═══════════════════════ 4. freight ikut di biaya botol per unit ══ */
console.log("\n=== 4. Biaya botol per unit memuat freight ===");

{
  const sup = awal.supplierKecil[0];
  const b = biayaSatuan(sup, awal.asumsi.kurs, awal.asumsi.perizinanPct);
  dekat("totalLengkap = total + freight", b.totalLengkap, b.total + b.freight, 1e-9);
  cek("freight supplier default > 0", b.freight > 0, `${Math.round(b.freight)}`);

  /* Yang ditampilkan tabel harus sama dengan yang dipakai COGS. */
  const u = unitEconomics(awal, "kecil");
  dekat(
    "totalLengkap = botol + perizinan + aksesoris + freight di COGS",
    b.totalLengkap,
    u.botol + u.aksesoris + u.freight,
    1e-9,
  );

  /* Kasus yang MEMBALIK pemenang: X lebih murah per botol tapi botolnya gemuk,
     jadi freight-nya jauh lebih mahal. Tanpa freight, tabel menobatkan X. */
  const dasar = { molding: { botol: 0, cap: 0, silikon: 0 }, mataUang: "IDR" as const, moq: 1 };
  const X: Supplier = {
    ...dasar,
    id: "l1",
    nama: "X gemuk",
    satuan: { botol: 10_000, cap: 0, aksesoris: 0 },
    freight: { aktif: true, pcsPerCBM: 400, ratePerCBM: 7_000_000 },
  };
  const Y: Supplier = {
    ...dasar,
    id: "l2",
    nama: "Y ramping",
    satuan: { botol: 11_000, cap: 0, aksesoris: 0 },
    freight: { aktif: true, pcsPerCBM: 4_000, ratePerCBM: 7_000_000 },
  };
  const bX = biayaSatuan(X, awal.asumsi.kurs, awal.asumsi.perizinanPct);
  const bY = biayaSatuan(Y, awal.asumsi.kurs, awal.asumsi.perizinanPct);
  const dokX: Dokumen = { ...awal, supplierBesar: [X], pilihan: { ...awal.pilihan, besarId: "l1" } };
  const dokY: Dokumen = { ...awal, supplierBesar: [Y], pilihan: { ...awal.pilihan, besarId: "l2" } };

  cek("tanpa freight, X terlihat lebih murah", bX.total < bY.total);
  cek("dengan freight, Y yang lebih murah", bX.totalLengkap > bY.totalLengkap);
  cek(
    "totalLengkap sepakat dengan COGS soal siapa yang menang",
    bX.totalLengkap > bY.totalLengkap &&
      unitEconomics(dokX, "besar").cogs > unitEconomics(dokY, "besar").cogs,
  );
}

kontrol(
  "[kontrol negatif] `total` yang lama MEMANG membalik pemenangnya — itu bugnya",
  biayaSatuan(
    {
      id: "x",
      nama: "x",
      mataUang: "IDR",
      moq: 1,
      molding: { botol: 0, cap: 0, silikon: 0 },
      satuan: { botol: 10_000, cap: 0, aksesoris: 0 },
      freight: { aktif: true, pcsPerCBM: 400, ratePerCBM: 7_000_000 },
    },
    17_000,
    10,
  ).total >
    biayaSatuan(
      {
        id: "y",
        nama: "y",
        mataUang: "IDR",
        moq: 1,
        molding: { botol: 0, cap: 0, silikon: 0 },
        satuan: { botol: 11_000, cap: 0, aksesoris: 0 },
        freight: { aktif: true, pcsPerCBM: 4_000, ratePerCBM: 7_000_000 },
      },
      17_000,
      10,
    ).total,
);

/* ═══════════════════════ 5. amortisasi menyerap kelebihan MOQ ══ */
console.log("\n=== 5. Amortisasi menyerap molding DAN kelebihan MOQ ===");

{
  const dok: Dokumen = { ...awal, opsi: { amortisasiMolding: true } };
  const u = unitEconomics(dok, "kecil");
  const i = initialInvestment(dok);

  cek("ada kelebihan MOQ untuk diuji", u.kelebihanBotol > 0, `${u.kelebihanBotol} pcs`);
  cek("amortisasi kelebihan > 0", u.amortisasiKelebihan > 0, `${Math.round(u.amortisasiKelebihan)}`);
  dekat("amortisasi = molding + kelebihan", u.amortisasi, u.amortisasiMolding + u.amortisasiKelebihan, 1e-9);
  dekat(
    "amortisasi kelebihan = kelebihan × biaya per unit lengkap ÷ produksi",
    u.amortisasiKelebihan,
    (u.kelebihanBotol * i.invKecil.satuan.totalLengkap) / u.qtyProduksi,
    1e-6,
  );

  const mati = unitEconomics(awal, "kecil");
  cek("toggle mati → amortisasi nol", mati.amortisasi === 0 && mati.amortisasiKelebihan === 0);
  cek("toggle nyala menaikkan COGS", u.cogs > mati.cogs, `${Math.round(u.cogs)} > ${Math.round(mati.cogs)}`);
}

kontrol(
  "[kontrol negatif] amortisasi TIDAK boleh cuma molding — kelebihan MOQ harus ikut",
  (() => {
    const u = unitEconomics({ ...awal, opsi: { amortisasiMolding: true } }, "kecil");
    return u.amortisasi === u.amortisasiMolding;
  })(),
);

/* ═══════════════════════ 6. penimbangan pakai qty produksi ══ */
console.log("\n=== 6. Gross profit ditimbang qty PRODUKSI, bukan kapasitas ===");

{
  const dok: Dokumen = {
    ...awal,
    supplierKecil: [{ ...awal.supplierKecil[0], id: "s9", moq: 1 }],
    pilihan: { ...awal.pilihan, kecilId: "s9" },
    pembelian: { kecil: 100, besar: null },
  };
  const k = unitEconomics(dok, "kecil");
  const b = unitEconomics(dok, "besar");
  sama("bobot botol kecil = 100", k.qtyProduksi, 100);
  cek("bobot botol besar tetap penuh", b.qtyProduksi === kapasitasCairan(dok, "besar"));
  cek(
    "botol besar mendominasi campuran sekarang",
    b.qtyProduksi > k.qtyProduksi * 10,
    `${b.qtyProduksi} vs ${k.qtyProduksi}`,
  );
}

kontrol(
  "[kontrol negatif] bobot TIDAK boleh memakai kapasitas cairan",
  unitEconomics(
    {
      ...awal,
      supplierKecil: [{ ...awal.supplierKecil[0], id: "s9", moq: 1 }],
      pilihan: { ...awal.pilihan, kecilId: "s9" },
      pembelian: { kecil: 100, besar: null },
    },
    "kecil",
  ).qtyProduksi === 8500,
);

/* ═══════════════════════ 7. migrasi ══ */
console.log("\n=== 7. Dokumen lama tetap terbaca ===");

{
  /* Payload tanpa `pembelian` sama sekali — seluruh dokumen tim hari ini. */
  const tanpa = bacaDokumen({ ...JSON.parse(JSON.stringify(awal)), pembelian: undefined });
  sama("pembelian.kecil jadi null, bukan 0", tanpa.pembelian.kecil, null);
  sama("pembelian.besar jadi null, bukan 0", tanpa.pembelian.besar, null);
  sama("perilakunya persis seperti sebelumnya", qtyProduksi(tanpa, "kecil"), 8500);

  const nol = bacaDokumen({ ...JSON.parse(JSON.stringify(awal)), pembelian: { kecil: 0, besar: null } });
  sama("pembelian 0 dipertahankan sebagai 0", nol.pembelian.kecil, 0);

  const isi = bacaDokumen({ ...JSON.parse(JSON.stringify(awal)), pembelian: { kecil: 100, besar: 50 } });
  sama("pembelian terisi dibaca apa adanya", isi.pembelian.kecil, 100);
  sama("pembelian besar dibaca apa adanya", isi.pembelian.besar, 50);

  /* Bentuk v0 (builder HTML) tidak punya konsep ini sama sekali. */
  const v0 = bacaDokumen({ base: { kurs: 17_000 } });
  sama("v0 → pembelian null", v0.pembelian.kecil, null);
}

kontrol(
  "[kontrol negatif] payload tanpa pembelian TIDAK boleh jadi 0 botol",
  bacaDokumen({ ...JSON.parse(JSON.stringify(awal)), pembelian: undefined }).pembelian.kecil === 0,
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
