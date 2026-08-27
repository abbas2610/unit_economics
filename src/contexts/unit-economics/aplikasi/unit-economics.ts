/**
 * Unit economics per botol — COGS, gross profit, gross margin.
 *
 * Tinggal di `aplikasi/` karena ia MERANGKAI empat konteks (asumsi, fragrance,
 * supplier, dokumen) menjadi satu jawaban. Tidak satu pun konteks itu boleh tahu
 * tentang yang lain; yang tahu urutannya cuma berkas ini.
 *
 * ## Susunan COGS, dan kenapa urutannya begitu di layar
 *
 *     Bahan baku      fragrance oil (rata-rata + waste + PPN)
 *                     OEM (biang jadi + pencampuran)
 *     Botol & packing botol (harga + perizinan)
 *                     aksesoris + cap
 *                     box packaging
 *                     freight forwarder
 *     Fulfillment     fulfillment
 *                     royalti Miranti
 *                     [amortisasi molding — kalau dinyalakan]
 *
 * Tiga kelompok itu bukan hiasan: yang pertama bergerak dengan harga bahan,
 * yang kedua dengan pilihan supplier, yang ketiga dengan harga jual. Menaruh
 * royalti di kelompok bahan baku akan menyembunyikan fakta bahwa ia satu-satunya
 * komponen COGS yang IKUT NAIK saat harga jual dinaikkan.
 */
import { boxPerBotol, oemPerBotol } from "@/contexts/asumsi/domain/asumsi";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";
import { hitungCampuran } from "@/contexts/fragrance/domain/campuran";
import type { HasilCampuran } from "@/contexts/fragrance/domain/campuran";
import { biayaFragrancePerBotol } from "@/contexts/fragrance/domain/varian";
import {
  biayaSatuan,
  cariSupplier,
  freightPerBotol,
  totalMolding,
} from "@/contexts/supplier/domain/supplier";
import type { Supplier } from "@/contexts/supplier/domain/supplier";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";

/** Hasil produksi satu batch — SELALU diturunkan, tidak pernah disimpan. */
export const hasilProduksi = (dok: Dokumen): HasilCampuran =>
  hitungCampuran(dok.varian, dok.campuran, dok.asumsi);

/** Qty batch untuk satu ukuran botol. */
export const qtyBatch = (dok: Dokumen, ukuran: UkuranBotol): number => {
  const h = hasilProduksi(dok);
  return ukuran === "kecil" ? h.pcsKecil : h.pcsBesar;
};

export const supplierTerpilih = (dok: Dokumen, ukuran: UkuranBotol): Supplier | undefined =>
  ukuran === "kecil"
    ? cariSupplier(dok.supplierKecil, dok.pilihan.kecilId)
    : cariSupplier(dok.supplierBesar, dok.pilihan.besarId);

export const hargaJual = (dok: Dokumen, ukuran: UkuranBotol): number =>
  ukuran === "kecil" ? dok.harga.kecil : dok.harga.besar;

export type RincianUnit = {
  ukuran: UkuranBotol;
  supplier: Supplier | undefined;
  harga: number;
  qtyBatch: number;

  fragrance: number;
  oem: number;
  /** fragrance + oem */
  bahanBaku: number;

  /** Harga botol + perizinan. Digabung karena perizinan adalah % dari botol. */
  botol: number;
  aksesoris: number;
  box: number;
  freight: number;
  /** botol + aksesoris + box + freight */
  botolPacking: number;

  fulfillment: number;
  royalti: number;
  amortisasi: number;

  cogs: number;
  grossProfit: number;
  /** Gross margin, %. `0` kalau harga jual belum diisi. */
  grossMargin: number;
};

export function unitEconomics(dok: Dokumen, ukuran: UkuranBotol): RincianUnit {
  const sup = supplierTerpilih(dok, ukuran);
  const harga = hargaJual(dok, ukuran);
  const batch = qtyBatch(dok, ukuran);

  const satuan = sup
    ? biayaSatuan(sup, dok.asumsi.kurs, dok.asumsi.perizinanPct)
    : { botol: 0, perizinan: 0, aksesoris: 0, total: 0 };

  const fragrance = biayaFragrancePerBotol(
    dok.varian,
    dok.asumsi,
    ukuran,
    dok.campuran.fragrancePct,
  );
  const oem = oemPerBotol(dok.asumsi, ukuran);
  const box = boxPerBotol(dok.asumsi);
  const freight = sup ? freightPerBotol(sup) : 0;

  /* Royalti dihitung dari HARGA JUAL, bukan dari biaya. Itu sebabnya menaikkan
     harga tidak menaikkan gross profit sebesar kenaikannya. */
  const royalti = harga * ((dok.asumsi.mirantiPct || 0) / 100);

  /* Amortisasi molding hanya kalau dinyalakan DAN ada batch untuk membaginya.
     `batch === 0` (mis. qty fragrance belum diisi) akan menghasilkan Infinity
     yang menjalar jadi COGS `Infinity` dan margin `-Infinity`. */
  const amortisasi =
    dok.opsi.amortisasiMolding && sup && batch > 0
      ? totalMolding(sup, dok.asumsi.kurs) / batch
      : 0;

  const bahanBaku = fragrance + oem;
  const botol = satuan.botol + satuan.perizinan;
  const botolPacking = botol + satuan.aksesoris + box + freight;
  const cogs = bahanBaku + botolPacking + dok.asumsi.fulfillment + royalti + amortisasi;
  const grossProfit = harga - cogs;

  return {
    ukuran,
    supplier: sup,
    harga,
    qtyBatch: batch,
    fragrance,
    oem,
    bahanBaku,
    botol,
    aksesoris: satuan.aksesoris,
    box,
    freight,
    botolPacking,
    fulfillment: dok.asumsi.fulfillment,
    royalti,
    amortisasi,
    cogs,
    grossProfit,
    grossMargin: harga > 0 ? (grossProfit / harga) * 100 : 0,
  };
}

/**
 * Gross profit rata-rata satu botol, ditimbang komposisi batch.
 *
 * ⚠️ Ditimbang qty, bukan rata-rata sederhana dari dua angka. Batch 4.250 kecil
 * dan 637 besar bukan campuran 50:50, dan rata-rata sederhana akan memberi botol
 * besar bobot tujuh kali lipat dari porsinya yang sebenarnya.
 */
export function grossProfitTertimbang(kecil: RincianUnit, besar: RincianUnit): number {
  const total = kecil.qtyBatch + besar.qtyBatch;
  if (total <= 0) return 0;
  return (kecil.grossProfit * kecil.qtyBatch + besar.grossProfit * besar.qtyBatch) / total;
}

/** Gross margin gabungan (blended), ditimbang qty batch. */
export function grossMarginTertimbang(kecil: RincianUnit, besar: RincianUnit): number {
  const total = kecil.qtyBatch + besar.qtyBatch;
  if (total <= 0) return 0;
  const gp = grossProfitTertimbang(kecil, besar);
  const harga = (kecil.harga * kecil.qtyBatch + besar.harga * besar.qtyBatch) / total;
  return harga > 0 ? (gp / harga) * 100 : 0;
}

/**
 * Berapa pcs harus terjual untuk menutup seluruh initial investment.
 *
 * `null` — bukan `0` — kalau gross profit tertimbangnya tidak positif. `0`
 * adalah pernyataan ("tidak perlu menjual apa pun"); yang benar di sini adalah
 * "tidak akan pernah balik modal pada harga ini", dan meleburnya jadi `0`
 * menampilkan kabar terburuk di halaman sebagai kabar terbaik.
 */
export function breakEven(
  kecil: RincianUnit,
  besar: RincianUnit,
  totalInvestasi: number,
): number | null {
  const gp = grossProfitTertimbang(kecil, besar);
  if (gp <= 0) return null;
  return Math.ceil(totalInvestasi / gp);
}

/** Proyeksi gross profit satu batch penuh, kalau seluruhnya terjual. */
export const grossProfitBatch = (kecil: RincianUnit, besar: RincianUnit): number =>
  kecil.grossProfit * kecil.qtyBatch + besar.grossProfit * besar.qtyBatch;
