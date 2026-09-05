/**
 * Initial investment — seluruh uang yang keluar sebelum botol pertama terjual.
 *
 * Dua kategori, dan pemisahannya adalah pertanyaan yang paling sering ditanya
 * ke halaman ini: berapa yang jadi BARANG, dan berapa yang jadi PERHATIAN.
 *
 *     Category 1 — Produk     bahan baku + botol & packaging + fulfillment + biaya custom
 *     Category 2 — Marketing  offline + online + lainnya
 *
 * ## Pajak tidak jadi baris sendiri
 *
 * PPN fragrance dan perizinan botol sudah menempel di komponennya
 * masing-masing — PPN di nilai pembelian fragrance, perizinan di harga botol
 * per pcs. `totalPajak` di bawah MENJUMLAHKAN ULANG keduanya untuk ditampilkan
 * sebagai satu KPI, bukan menambahkannya lagi ke total. Menjadikannya baris
 * tersendiri di rincian akan menghitungnya dua kali, dan hasilnya masih terlihat
 * seperti angka yang wajar.
 */
import { boxPerBotol } from "@/contexts/asumsi/domain/asumsi";
import { nilaiPembelian, totalLegalVarian } from "@/contexts/fragrance/domain/varian";
import { investasiSupplier } from "@/contexts/supplier/domain/supplier";
import type { InvestasiSupplier, Supplier } from "@/contexts/supplier/domain/supplier";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import {
  kapasitasCairan,
  qtyDiminta,
  qtyProduksi,
  supplierTerpilih,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
import { mlBotol } from "@/contexts/asumsi/domain/asumsi";

export type RincianInvestasi = {
  supplierKecil: Supplier | undefined;
  supplierBesar: Supplier | undefined;
  invKecil: InvestasiSupplier;
  invBesar: InvestasiSupplier;

  /** Botol yang JADI. Ini yang mengalikan OEM, box, dan fulfillment. */
  qtyKecil: number;
  qtyBesar: number;
  totalBotol: number;

  /** Botol yang cairannya cukup — batas atas, sebelum pembelian membatasinya. */
  kapasitasKecil: number;
  kapasitasBesar: number;
  /** Cairan yang tidak kebagian botol, mL. Uang yang sudah keluar tanpa barang. */
  mlTakTerbotolkanKecil: number;
  mlTakTerbotolkanBesar: number;

  /* — bahan baku — */
  fragranceDasar: number;
  fragrancePPN: number;
  fragranceTotal: number;
  oemTotal: number;
  legalVarian: number;
  bahanBaku: number;

  /* — botol & packaging — */
  boxTotal: number;
  botolPacking: number;

  fulfillmentTotal: number;

  /** Jumlah `dok.investasiCustom` — biaya bebas nama & angka, Category 1. */
  customTotal: number;

  /** Category 1 */
  produk: number;
  /** Category 2 */
  marketing: number;
  total: number;

  /** Ditampilkan sebagai KPI. Sudah termasuk di `total`, bukan tambahan. */
  totalPajak: number;

  /** Botol yang dibeli melebihi kebutuhan batch karena MOQ. */
  kelebihanKecil: number;
  kelebihanBesar: number;
  nilaiKelebihanKecil: number;
  nilaiKelebihanBesar: number;
};

const NOL: InvestasiSupplier = {
  qty: 0,
  moqMengikat: false,
  molding: 0,
  botol: 0,
  aksesoris: 0,
  perizinan: 0,
  freight: 0,
  total: 0,
  satuan: { botol: 0, perizinan: 0, aksesoris: 0, total: 0, freight: 0, totalLengkap: 0 },
};

export function initialInvestment(dok: Dokumen): RincianInvestasi {
  const { kurs, perizinanPct, ppnPct, oemKecil, oemBesar, fulfillment } = dok.asumsi;

  /* Tiga qty yang berbeda, dan memisahkannya adalah inti perbaikan ini:
       kapasitas — berapa botol yang cairannya cukup
       diminta   — berapa botol yang dipesan (bisa lebih kecil: pembelian sampel)
       produksi  — berapa botol yang JADI = min(kapasitas, yang dibayar)
     OEM, box, dan fulfillment mengalikan PRODUKSI; supplier menagih yang DIBAYAR. */
  const kapasitasKecil = kapasitasCairan(dok, "kecil");
  const kapasitasBesar = kapasitasCairan(dok, "besar");
  const qtyKecil = qtyProduksi(dok, "kecil");
  const qtyBesar = qtyProduksi(dok, "besar");

  const supKecil = supplierTerpilih(dok, "kecil");
  const supBesar = supplierTerpilih(dok, "besar");
  const invKecil = supKecil
    ? investasiSupplier(supKecil, kurs, perizinanPct, qtyDiminta(dok, "kecil"))
    : NOL;
  const invBesar = supBesar
    ? investasiSupplier(supBesar, kurs, perizinanPct, qtyDiminta(dok, "besar"))
    : NOL;

  const totalBotol = qtyKecil + qtyBesar;

  const fragranceDasar = nilaiPembelian(dok.varian, kurs);
  const fragrancePPN = fragranceDasar * ((ppnPct || 0) / 100);
  const fragranceTotal = fragranceDasar + fragrancePPN;
  const oemTotal = qtyKecil * oemKecil + qtyBesar * oemBesar;
  const legalVarian = totalLegalVarian(dok.varian, dok.legalPerVarian);
  const bahanBaku = fragranceTotal + oemTotal + legalVarian;

  const boxTotal = totalBotol * boxPerBotol(dok.asumsi);
  const botolPacking = invKecil.total + invBesar.total + boxTotal;
  const fulfillmentTotal = totalBotol * fulfillment;
  const customTotal = dok.investasiCustom.reduce((a, c) => a + (c.nilai || 0), 0);

  const produk = bahanBaku + botolPacking + fulfillmentTotal + customTotal;
  const marketing = dok.marketing.offline + dok.marketing.online + dok.marketing.lainnya;

  /* Botol yang dibayar tapi tidak terisi. Dinilai `satuan.totalLengkap` —
     botol + perizinan + aksesoris + FREIGHT — bukan `satuan.total`.

     ⚠️ Freight-nya sempat hilang di sini, dan itu bug yang diam: botol kelebihan
     itu benar-benar ikut dikapalkan dan benar-benar ikut dibayar per CBM.
     Mengecualikannya melaporkan modal tertahan 9,6% lebih rendah dari yang
     sesungguhnya (Rp30,2 juta dilaporkan untuk Rp33,4 juta yang dibayar).

     Molding tetap DIKECUALIKAN, dan itu memang benar: ia dibayar penuh berapa
     pun qty-nya, jadi memasukkannya akan melebih-lebihkan modal yang tertahan
     di gudang sebagai barang. */
  const kelebihanKecil = Math.max(0, invKecil.qty - qtyKecil);
  const kelebihanBesar = Math.max(0, invBesar.qty - qtyBesar);

  return {
    supplierKecil: supKecil,
    supplierBesar: supBesar,
    invKecil,
    invBesar,
    qtyKecil,
    qtyBesar,
    totalBotol,
    kapasitasKecil,
    kapasitasBesar,
    mlTakTerbotolkanKecil: Math.max(0, kapasitasKecil - qtyKecil) * mlBotol(dok.asumsi, "kecil"),
    mlTakTerbotolkanBesar: Math.max(0, kapasitasBesar - qtyBesar) * mlBotol(dok.asumsi, "besar"),
    fragranceDasar,
    fragrancePPN,
    fragranceTotal,
    oemTotal,
    legalVarian,
    bahanBaku,
    boxTotal,
    botolPacking,
    fulfillmentTotal,
    customTotal,
    produk,
    marketing,
    total: produk + marketing,
    totalPajak: fragrancePPN + invKecil.perizinan + invBesar.perizinan + legalVarian,
    kelebihanKecil,
    kelebihanBesar,
    nilaiKelebihanKecil: kelebihanKecil * invKecil.satuan.totalLengkap,
    nilaiKelebihanBesar: kelebihanBesar * invBesar.satuan.totalLengkap,
  };
}
