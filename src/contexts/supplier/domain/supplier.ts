/**
 * Supplier botol, dan apa yang dibayar kepadanya.
 *
 * Dua jenis biaya, dan memisahkannya adalah inti seluruh halaman perbandingan:
 *
 *   - **molding** — sekali bayar, tidak peduli berapa pcs dipesan
 *   - **satuan**  — per pcs
 *
 * Supplier dengan molding mahal dan satuan murah menang pada volume besar dan
 * kalah telak pada volume kecil. Membandingkan salah satunya saja — atau
 * menjumlahkan keduanya jadi "harga per botol" tanpa menyebut qty-nya — adalah
 * cara paling umum salah memilih vendor.
 */
import { keIDR } from "@/contexts/asumsi/domain/asumsi";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";

export type MataUang = "IDR" | "USD";

export type Supplier = {
  id: string;
  nama: string;
  /** Botol kecil umumnya dari China (USD), botol besar vendor lokal (IDR). */
  mataUang: MataUang;
  /** Minimum order quantity. Sering MELEBIHI kebutuhan batch — lihat `investasi`. */
  moq: number;
  /** Biaya sekali bayar, dalam `mataUang`. */
  molding: { botol: number; cap: number; silikon: number };
  /** Biaya per pcs, dalam `mataUang`. */
  satuan: { botol: number; cap: number; aksesoris: number };
  /**
   * Freight forwarder milik supplier ini sendiri.
   *
   * ⚠️ Nilainya disalin dari asumsi dasar saat supplier dibuat, lalu HIDUP
   * TERPISAH. Mengubah tarif per CBM di tab 1 tidak menggeser supplier yang
   * sudah ada. Itu disengaja — tiap vendor bisa punya forwarder sendiri — tapi
   * cukup mengejutkan sampai tiap kartu supplier punya tombol
   * "pakai default asumsi dasar", dan analisis sensitivitas harus MENSKALA
   * tarif tiap supplier alih-alih mengganti tarif dasarnya.
   */
  freight: { aktif: boolean; pcsPerCBM: number; ratePerCBM: number };
};

/** Rincian biaya per pcs, sudah dalam IDR. */
export type BiayaSatuan = {
  /** Harga botol saja. */
  botol: number;
  /** Perizinan & legalitas, % dari harga botol. */
  perizinan: number;
  /** Cap + aksesoris. */
  aksesoris: number;
  /** botol + perizinan + aksesoris. Yang masuk COGS sebagai "biaya botol". */
  total: number;
};

export function biayaSatuan(sup: Supplier, kurs: number, perizinanPct: number): BiayaSatuan {
  const botol = keIDR(sup.satuan.botol, sup.mataUang, kurs);
  const perizinan = botol * ((perizinanPct || 0) / 100);
  const aksesoris =
    keIDR(sup.satuan.aksesoris, sup.mataUang, kurs) + keIDR(sup.satuan.cap, sup.mataUang, kurs);
  return { botol, perizinan, aksesoris, total: botol + perizinan + aksesoris };
}

/** Total molding, IDR. Sekali bayar. */
export const totalMolding = (sup: Supplier, kurs: number): number =>
  keIDR(sup.molding.botol, sup.mataUang, kurs) +
  keIDR(sup.molding.cap, sup.mataUang, kurs) +
  keIDR(sup.molding.silikon, sup.mataUang, kurs);

/**
 * Biaya freight per botol menurut angka supplier ini sendiri.
 *
 * `0` kalau freight-nya dimatikan — mis. harga vendor sudah franco gudang.
 */
export function freightPerBotol(sup: Supplier): number {
  if (!sup.freight?.aktif) return 0;
  const p = sup.freight.pcsPerCBM;
  return p > 0 ? sup.freight.ratePerCBM / p : 0;
}

export type InvestasiSupplier = {
  /** Qty yang BENAR-BENAR dibeli: MOQ atau qty batch, mana yang lebih besar. */
  qty: number;
  molding: number;
  botol: number;
  aksesoris: number;
  perizinan: number;
  freight: number;
  total: number;
  satuan: BiayaSatuan;
};

/**
 * Total yang dibayar ke satu supplier untuk satu batch.
 *
 * ⚠️ `qty = max(MOQ, qtyBatch)`. MOQ 10.000 pcs untuk batch 2.125 pcs berarti
 * **7.875 botol dibayar dan disimpan**, dan modal tertahan itu masuk ke Initial
 * Investment walau tidak satu pun botolnya terjual di batch ini. Halaman
 * Initial Investment menampilkannya sebagai baris "kelebihan stok" tersendiri,
 * karena angka yang cuma terlihat sebagai total supplier yang membengkak akan
 * dikira harga yang mahal, bukan MOQ yang tinggi.
 */
export function investasiSupplier(
  sup: Supplier,
  kurs: number,
  perizinanPct: number,
  qtyBatch: number,
): InvestasiSupplier {
  const qty = Math.max(sup.moq || 0, qtyBatch || 0);
  const satuan = biayaSatuan(sup, kurs, perizinanPct);
  const molding = totalMolding(sup, kurs);
  const botol = satuan.botol * qty;
  const aksesoris = satuan.aksesoris * qty;
  const perizinan = satuan.perizinan * qty;
  const freight = freightPerBotol(sup) * qty;
  return {
    qty,
    molding,
    botol,
    aksesoris,
    perizinan,
    freight,
    total: molding + botol + aksesoris + perizinan + freight,
    satuan,
  };
}

/**
 * Cari supplier menurut id, jatuh ke yang pertama kalau tidak ketemu.
 *
 * Jatuh ke yang pertama, bukan `undefined`, karena layar yang kehilangan
 * supplier terpilih (mis. ia dihapus di tab lain) harus tetap menampilkan
 * angka — dan `undefined` yang menjalar ke perhitungan menghasilkan `NaN` di
 * setiap kolom sekaligus, yang terbaca sebagai aplikasi rusak alih-alih pilihan
 * yang perlu diperbarui.
 */
export const cariSupplier = (daftar: Supplier[], id: string): Supplier | undefined =>
  daftar.find((s) => s.id === id) ?? daftar[0];

export const supplierAwal = (): Record<UkuranBotol, Supplier[]> => ({
  kecil: [
    {
      id: "s1",
      nama: "Gelas Bening (A)",
      mataUang: "USD",
      moq: 10_000,
      molding: { botol: 1475, cap: 0, silikon: 1036 },
      satuan: { botol: 0.48, cap: 0, aksesoris: 0.59 },
      freight: { aktif: true, pcsPerCBM: 3272, ratePerCBM: 7_000_000 },
    },
    {
      id: "s2",
      nama: "Model Batu (B)",
      mataUang: "USD",
      moq: 10_000,
      molding: { botol: 1475, cap: 1160, silikon: 1475 },
      satuan: { botol: 0.59, cap: 0, aksesoris: 0.46 },
      freight: { aktif: true, pcsPerCBM: 3272, ratePerCBM: 7_000_000 },
    },
  ],
  besar: [
    {
      id: "l1",
      nama: "Vendor Lokal A",
      mataUang: "IDR",
      moq: 10_000,
      molding: { botol: 25_000_000, cap: 20_000_000, silikon: 0 },
      satuan: { botol: 16_000, cap: 0, aksesoris: 3_000 },
      freight: { aktif: true, pcsPerCBM: 1778, ratePerCBM: 7_000_000 },
    },
  ],
});
