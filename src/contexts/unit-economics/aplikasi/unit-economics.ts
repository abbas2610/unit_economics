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
 *                     [amortisasi molding — kalau dinyalakan]
 *
 * Tiga kelompok itu bukan hiasan: yang pertama bergerak dengan harga bahan,
 * yang kedua dengan pilihan supplier, yang ketiga tinggal fulfillment (dan
 * amortisasi molding kalau dinyalakan).
 */
import { boxPerBotol, mlBotol, oemPerBotol } from "@/contexts/asumsi/domain/asumsi";
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

/**
 * Berapa botol yang CAIRANNYA cukup. Batas atas produksi, bukan pesanan.
 *
 * Dulu bernama `qtyBatch` dan merangkap tiga peran sekaligus — kapasitas,
 * pesanan, dan hasil. Ketiganya berbeda begitu MOQ atau pembelian sampel ikut
 * bermain, dan menyatukannya berarti satu angka menjawab tiga pertanyaan yang
 * jawabannya tidak sama.
 */
export const kapasitasCairan = (dok: Dokumen, ukuran: UkuranBotol): number => {
  const h = hasilProduksi(dok);
  return ukuran === "kecil" ? h.pcsKecil : h.pcsBesar;
};

/**
 * Berapa botol yang DIMINTA ke supplier, sebelum MOQ ikut bicara.
 *
 * `dok.pembelian` yang `null` berarti "sebanyak yang cairannya cukup". Angka
 * yang diisi tim menang atas kapasitas — termasuk kalau ia lebih kecil, yang
 * memang gunanya (pembelian sampel).
 */
export const qtyDiminta = (dok: Dokumen, ukuran: UkuranBotol): number => {
  const diminta = ukuran === "kecil" ? dok.pembelian?.kecil : dok.pembelian?.besar;
  return diminta == null ? kapasitasCairan(dok, ukuran) : Math.max(0, diminta);
};

/** Berapa botol yang BENAR-BENAR dibayar ke supplier ini. MOQ adalah lantainya. */
export const qtyBeli = (dok: Dokumen, ukuran: UkuranBotol, sup: Supplier | undefined): number =>
  Math.max(sup?.moq || 0, qtyDiminta(dok, ukuran));

/**
 * Berapa botol yang JADI — dan ini yang menghitung COGS, gross profit, dan
 * break-even.
 *
 * `min(kapasitas cairan, botol yang dibeli)`, karena kedua-duanya membatasi:
 * cairan tanpa botol tidak jadi produk, dan botol tanpa cairan juga tidak.
 * Membeli 100 botol saat cairannya cukup untuk 8.500 menghasilkan 100 botol —
 * sisanya jadi cairan yang tidak terbotolkan, yang ditampilkan tersendiri
 * karena ia uang yang sudah dibelanjakan tanpa barang yang bisa dijual.
 */
export const qtyProduksi = (dok: Dokumen, ukuran: UkuranBotol): number =>
  Math.min(kapasitasCairan(dok, ukuran), qtyBeli(dok, ukuran, supplierTerpilih(dok, ukuran)));

/** Botol yang dibayar tapi tidak terisi — MOQ melebihi yang bisa diproduksi. */
export const kelebihanBotol = (dok: Dokumen, ukuran: UkuranBotol): number =>
  Math.max(0, qtyBeli(dok, ukuran, supplierTerpilih(dok, ukuran)) - qtyProduksi(dok, ukuran));

/** Cairan yang tidak kebagian botol, dalam mL. Lawan dari `kelebihanBotol`. */
export const mlTakTerbotolkan = (dok: Dokumen, ukuran: UkuranBotol): number =>
  Math.max(0, kapasitasCairan(dok, ukuran) - qtyProduksi(dok, ukuran)) * mlBotol(dok.asumsi, ukuran);

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
  /** Botol yang JADI. Ini pembagi tiap angka per-botol di bawah. */
  qtyProduksi: number;
  /** Botol yang dibayar ke supplier — bisa lebih besar karena MOQ. */
  qtyBeli: number;
  /** Botol yang cairannya cukup, sebelum MOQ dan pembelian ikut membatasi. */
  kapasitasCairan: number;
  /** Botol dibayar tapi tidak terisi (`qtyBeli − qtyProduksi`). */
  kelebihanBotol: number;
  /** Cairan yang tidak kebagian botol, mL. Lawan dari `kelebihanBotol`. */
  mlTakTerbotolkan: number;

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
  /** Molding ÷ qty produksi. `0` kalau opsi amortisasi mati. */
  amortisasiMolding: number;
  /**
   * Botol kelebihan MOQ ÷ qty produksi. `0` kalau opsi amortisasi mati.
   *
   * Ada karena toggle "amortisasi molding" dulu cuma membagi molding, sementara
   * botol yang dibeli melebihi kebutuhan adalah uang yang sama nyatanya dan
   * jumlahnya bisa lebih besar. Pada kasus yang melahirkan field ini: molding
   * Rp45,2 juta, kelebihan MOQ Rp33,4 juta — dan yang kedua tidak terlihat di
   * mana pun walau toggle-nya menyala.
   */
  amortisasiKelebihan: number;
  /** amortisasiMolding + amortisasiKelebihan. Yang benar-benar masuk COGS. */
  amortisasi: number;

  cogs: number;
  grossProfit: number;
  /** Gross margin, %. `0` kalau harga jual belum diisi. */
  grossMargin: number;
};

export function unitEconomics(dok: Dokumen, ukuran: UkuranBotol): RincianUnit {
  const sup = supplierTerpilih(dok, ukuran);
  const harga = hargaJual(dok, ukuran);
  const kapasitas = kapasitasCairan(dok, ukuran);
  const beli = qtyBeli(dok, ukuran, sup);
  const produksi = Math.min(kapasitas, beli);
  const lebih = Math.max(0, beli - produksi);

  const satuan = sup
    ? biayaSatuan(sup, dok.asumsi.kurs, dok.asumsi.perizinanPct)
    : { botol: 0, perizinan: 0, aksesoris: 0, total: 0, freight: 0, totalLengkap: 0 };

  const fragrance = biayaFragrancePerBotol(
    dok.varian,
    dok.asumsi,
    ukuran,
    dok.campuran.fragrancePct,
  );
  const oem = oemPerBotol(dok.asumsi, ukuran);
  const box = boxPerBotol(dok.asumsi);
  const freight = sup ? freightPerBotol(sup) : 0;

  /* Serapan biaya sekali-bayar ke unit cost, hanya kalau dinyalakan DAN ada
     botol jadi untuk membaginya. `produksi === 0` (mis. qty fragrance belum
     diisi) akan menghasilkan Infinity yang menjalar jadi COGS `Infinity` dan
     margin `-Infinity`.

     DUA komponen, bukan satu. Molding jelas; yang mudah terlupa adalah botol
     kelebihan MOQ — ia dinilai `totalLengkap` (freight ikut, karena botol itu
     benar-benar dikapalkan) dan pada kasus nyata jumlahnya sebanding molding. */
  const menyerap = dok.opsi.amortisasiMolding && sup && produksi > 0;
  const amortisasiMolding = menyerap ? totalMolding(sup, dok.asumsi.kurs) / produksi : 0;
  const amortisasiKelebihan = menyerap ? (lebih * satuan.totalLengkap) / produksi : 0;
  const amortisasi = amortisasiMolding + amortisasiKelebihan;

  const bahanBaku = fragrance + oem;
  const botol = satuan.botol + satuan.perizinan;
  const botolPacking = botol + satuan.aksesoris + box + freight;
  const cogs = bahanBaku + botolPacking + dok.asumsi.fulfillment + amortisasi;
  const grossProfit = harga - cogs;

  return {
    ukuran,
    supplier: sup,
    harga,
    qtyProduksi: produksi,
    qtyBeli: beli,
    kapasitasCairan: kapasitas,
    kelebihanBotol: lebih,
    mlTakTerbotolkan: Math.max(0, kapasitas - produksi) * mlBotol(dok.asumsi, ukuran),
    fragrance,
    oem,
    bahanBaku,
    botol,
    aksesoris: satuan.aksesoris,
    box,
    freight,
    botolPacking,
    fulfillment: dok.asumsi.fulfillment,
    amortisasiMolding,
    amortisasiKelebihan,
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
 *
 * ⚠️ Bobotnya `qtyProduksi` — botol yang JADI — bukan kapasitas cairan. Beli 100
 * botol kecil sementara cairannya cukup untuk 8.500 berarti bobot botol kecil
 * memang 100, dan memakai kapasitas di sini akan menimbang campuran yang tidak
 * pernah diproduksi.
 */
export function grossProfitTertimbang(kecil: RincianUnit, besar: RincianUnit): number {
  const total = kecil.qtyProduksi + besar.qtyProduksi;
  if (total <= 0) return 0;
  return (kecil.grossProfit * kecil.qtyProduksi + besar.grossProfit * besar.qtyProduksi) / total;
}

/** Gross margin gabungan (blended), ditimbang qty produksi. */
export function grossMarginTertimbang(kecil: RincianUnit, besar: RincianUnit): number {
  const total = kecil.qtyProduksi + besar.qtyProduksi;
  if (total <= 0) return 0;
  const gp = grossProfitTertimbang(kecil, besar);
  const harga = (kecil.harga * kecil.qtyProduksi + besar.harga * besar.qtyProduksi) / total;
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
  kecil.grossProfit * kecil.qtyProduksi + besar.grossProfit * besar.qtyProduksi;
