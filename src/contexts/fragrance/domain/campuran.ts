/**
 * Dari liter biang yang dibeli ke jumlah botol yang bisa jadi.
 *
 *     total campuran = liter biang ÷ komposisi fragrance
 *     non-fragrance  = total campuran − liter biang        (alkohol + aquadest)
 *     pasca susut    = total campuran × (1 − penyusutan)
 *     dialokasikan   → botol besar (x%) dan botol kecil (sisanya)
 *     ÷ isi nominal  → pcs, DIBULATKAN KE BAWAH
 *
 * ## Qty batch DITURUNKAN, tidak pernah disimpan
 *
 * Ini perubahan nyata dari builder lama, dan alasannya bukan kerapian. Di sana
 * `projection.batchSmall` tersimpan di dokumen DAN ditimpa ulang dari hasil
 * campuran setiap kali apa pun dihitung. Dua sumber untuk satu angka: yang
 * tersimpan tidak pernah benar, cuma tidak pernah sempat terbaca. Satu jalur
 * kode yang lupa memanggil `recompute()` sebelum membaca `batchSmall` akan
 * memakai qty batch basi untuk menghitung amortisasi molding — dan hasilnya
 * angka rupiah yang wajar, bukan error.
 *
 * Sekarang qty batch cuma ada di sini, sebagai fungsi.
 *
 * ## Pembulatan ke BAWAH, dan kenapa itu bukan detail
 *
 * Botol ke-2.126 yang cuma terisi separuh bukan barang yang bisa dijual. Membulatkan
 * ke atas menaikkan hasil produksi satu pcs di tiap ukuran, dan pcs itu ikut
 * masuk ke pembagi amortisasi molding serta ke proyeksi gross profit batch.
 */
import type { Asumsi } from "@/contexts/asumsi/domain/asumsi";
import { ML_BOTOL_KECIL } from "@/contexts/asumsi/domain/asumsi";
import type { Varian } from "./varian";
import { totalLiterDipesan } from "./varian";

export type Campuran = {
  /** Komposisi fragrance oil dalam campuran jadi, %. Sisanya alkohol+aquadest. */
  fragrancePct: number;
  /** Asumsi penyusutan proses produksi, %. */
  susutPct: number;
  /** Berapa persen volume pasca susut dialokasikan ke botol BESAR. */
  alokasiBesarPct: number;
};

export type HasilCampuran = {
  /** Liter biang yang dibeli (semua varian). */
  literFragrance: number;
  /** Liter alkohol + aquadest yang dibutuhkan. */
  literNonFragrance: number;
  /** Komposisi non-fragrance, %. Turunan, bukan field — selalu 100 − fragrance. */
  nonFragrancePct: number;
  /** Total campuran sebelum penyusutan, liter. */
  totalLiter: number;
  /** Volume yang benar-benar bisa dibotolkan, liter. */
  literPascaSusut: number;
  alokasiKecilPct: number;
  alokasiBesarPct: number;
  /** Hasil produksi, pcs. Ini yang jadi qty batch di Initial Investment. */
  pcsKecil: number;
  pcsBesar: number;
};

export function hitungCampuran(
  varian: Varian[],
  campuran: Campuran,
  asumsi: Asumsi,
): HasilCampuran {
  const literFragrance = totalLiterDipesan(varian);
  const fragPct = campuran.fragrancePct || 0;
  const nonFragrancePct = 100 - fragPct;

  /* Komposisi 0% berarti tidak ada campuran yang bisa dihitung, bukan campuran
     tak hingga. Menjaganya di sini menghentikan `Infinity` sebelum ia menjalar
     jadi `NaN` di seluruh kolom hasil produksi dan initial investment. */
  const totalLiter = fragPct > 0 ? literFragrance / (fragPct / 100) : 0;
  const literNonFragrance = totalLiter * (nonFragrancePct / 100);
  const literPascaSusut = totalLiter * (1 - (campuran.susutPct || 0) / 100);

  const alokasiBesarPct = campuran.alokasiBesarPct ?? 50;
  const alokasiKecilPct = 100 - alokasiBesarPct;

  const mlPascaSusut = literPascaSusut * 1000;
  const mlBesar = asumsi.mlBotolBesar || 0;

  return {
    literFragrance,
    literNonFragrance,
    nonFragrancePct,
    totalLiter,
    literPascaSusut,
    alokasiKecilPct,
    alokasiBesarPct,
    pcsKecil: Math.floor((mlPascaSusut * (alokasiKecilPct / 100)) / ML_BOTOL_KECIL),
    pcsBesar: mlBesar > 0 ? Math.floor((mlPascaSusut * (alokasiBesarPct / 100)) / mlBesar) : 0,
  };
}

export const campuranAwal = (): Campuran => ({
  fragrancePct: 25,
  susutPct: 15,
  alokasiBesarPct: 50,
});
