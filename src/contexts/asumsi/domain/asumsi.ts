/**
 * Asumsi dasar — angka yang diisi sekali di tab 1 dan diikuti seluruh halaman.
 *
 * Semuanya nilai skalar, dan itu bukan kebetulan: begitu satu asumsi punya
 * riwayat ("kurs bulan lalu", "waste sebelum perbaikan proses"), ia berhenti
 * jadi asumsi dan jadi data — dan tempatnya bukan di sini.
 */

/** Ukuran botol yang ada. Dua, dan seluruh perhitungan bercabang di sini. */
export type UkuranBotol = "kecil" | "besar";

/**
 * Isi nominal botol kecil, dalam mL.
 *
 * Konstanta, bukan field yang bisa diubah, karena SKU 15 ML itu sendiri yang
 * mendefinisikan "botol kecil" — mengubahnya berarti produk lain, bukan asumsi
 * lain. Botol besar justru belum fix (100 atau 50 ML), jadi ia field.
 */
export const ML_BOTOL_KECIL = 15;

export type Asumsi = {
  /** Kurs USD → IDR. Dipakai tiap supplier bermata uang USD dan harga fragrance. */
  kurs: number;
  /** Tarif freight forwarder per CBM. Ini nilai DEFAULT — lihat catatan di bawah. */
  freightPerCBM: number;
  /** Efisiensi packing, %. Ruang kosong di kardus ikut dibayar per CBM. */
  packingEfficiency: number;

  /**
   * Biaya OEM per botol — sudah termasuk alkohol, aquadest, dan pencampuran.
   *
   * Dipisah per ukuran karena mengisi 100 mL bukan sekadar 6,7× kerja mengisi
   * 15 mL: botol besar lebih sedikit per batch dan penanganannya berbeda.
   * Builder lama sempat memakai satu nilai `oemCost` untuk keduanya; migrasinya
   * menyalin nilai itu ke dua-duanya (lihat `dokumen/domain/migrasi.ts`).
   */
  oemKecil: number;
  oemBesar: number;

  /** Waste / penyusutan bahan baku fragrance, %. Menaikkan biaya per botol. */
  wastePct: number;
  /** PPN, %. Dikenakan ke pembelian fragrance dan biaya fragrance per botol. */
  ppnPct: number;
  /** Perizinan & legalitas botol, % dari nilai botol per pcs. */
  perizinanPct: number;
  /**
   * Royalti Miranti, % dari HARGA JUAL — bukan dari biaya.
   *
   * Konsekuensinya sering terlewat: menaikkan harga jual menaikkan komponen ini
   * juga, jadi gross profit tidak naik sebesar kenaikan harganya.
   */
  mirantiPct: number;

  /** Box packaging per botol. */
  boxPackaging: number;
  /** Aksesoris box (gift card, dll) per botol. */
  boxAksesoris: number;
  /** Fulfillment per botol. */
  fulfillment: number;

  /** Isi botol besar dalam mL — belum fix, 100 atau 50. */
  mlBotolBesar: number;
};

/** Isi nominal satu botol, dalam mL. */
export const mlBotol = (asumsi: Asumsi, ukuran: UkuranBotol): number =>
  ukuran === "kecil" ? ML_BOTOL_KECIL : asumsi.mlBotolBesar;

/** Biaya OEM per botol untuk ukuran tertentu. */
export const oemPerBotol = (asumsi: Asumsi, ukuran: UkuranBotol): number =>
  ukuran === "kecil" ? asumsi.oemKecil : asumsi.oemBesar;

/** Box packaging + aksesoris box. Satu angka, dipakai per botol di mana-mana. */
export const boxPerBotol = (asumsi: Asumsi): number =>
  asumsi.boxPackaging + asumsi.boxAksesoris;

/** Konversi nilai bermata uang ke IDR memakai kurs yang berlaku. */
export const keIDR = (nilai: number, mataUang: "IDR" | "USD", kurs: number): number =>
  mataUang === "USD" ? (nilai || 0) * kurs : nilai || 0;

export const asumsiAwal = (): Asumsi => ({
  kurs: 17_000,
  freightPerCBM: 7_000_000,
  packingEfficiency: 70,
  oemKecil: 10_000,
  oemBesar: 10_000,
  wastePct: 30,
  ppnPct: 11,
  perizinanPct: 10,
  mirantiPct: 2,
  boxPackaging: 20_000,
  boxAksesoris: 5_000,
  fulfillment: 5_000,
  mlBotolBesar: 100,
});
