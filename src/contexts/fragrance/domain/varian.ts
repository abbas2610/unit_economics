/**
 * Varian fragrance oil — biang parfum yang dibeli dari Perfume House (USD/liter).
 *
 * ## Kenapa unit economics memakai RATA-RATA, bukan harga tiap varian
 *
 * Selisih antar varian di penawaran yang ada sekarang $2,40–$2,60 per liter.
 * Pada botol 15 mL dengan komposisi 25%, itu selisih **Rp16 per botol** di atas
 * COGS yang lewat Rp90.000 — di bawah 0,02%. Menghitungnya per varian
 * menambahkan tiga kolom ke tiap tabel dan tidak mengubah satu pun keputusan.
 *
 * ⚠️ Yang membuat asumsi ini basi bukan jumlah varian, tapi SEBARANNYA. Kalau
 * suatu saat ada varian yang harganya berlipat (biang premium, absolut mahal),
 * rata-rata berhenti mewakili dan tiap SKU harus dihitung sendiri. Batasnya ada
 * di `probe:hitung`, yang menolak sebaran lebih dari 2× tanpa peringatan.
 *
 * Jumlah varian TIDAK dibatasi tiga. Ia mengalikan biaya perizinan (BPOM +
 * Halal dibayar per varian produk), jadi varian keempat menambah biaya tetap
 * yang nyata — itu terlihat di Initial Investment, bukan di COGS per botol.
 */
import type { Asumsi, UkuranBotol } from "@/contexts/asumsi/domain/asumsi";
import { mlBotol } from "@/contexts/asumsi/domain/asumsi";

export type Varian = {
  nama: string;
  /** Harga biang dari Perfume House, USD per liter. */
  usdPerLiter: number;
  /** Qty yang dipesan, liter. Menentukan total campuran dan hasil produksi. */
  qtyLiter: number;
};

/** Biaya perizinan yang dibayar PER VARIAN PRODUK, bukan per batch. */
export type LegalPerVarian = { bpom: number; halal: number };

/** Rata-rata harga biang, USD per liter. `0` kalau belum ada varian. */
export function rataUsdPerLiter(varian: Varian[]): number {
  if (varian.length === 0) return 0;
  return varian.reduce((a, v) => a + (v.usdPerLiter || 0), 0) / varian.length;
}

/** Rata-rata harga biang dalam IDR per liter. */
export const rataIdrPerLiter = (varian: Varian[], kurs: number): number =>
  rataUsdPerLiter(varian) * kurs;

/** Rata-rata harga biang dalam IDR per mL. */
export const idrPerML = (varian: Varian[], kurs: number): number =>
  rataIdrPerLiter(varian, kurs) / 1000;

/** Total liter biang yang dipesan, semua varian. Dasar hitungan campuran. */
export const totalLiterDipesan = (varian: Varian[]): number =>
  varian.reduce((a, v) => a + (v.qtyLiter || 0), 0);

/** Nilai pembelian fragrance sebelum PPN, IDR. */
export const nilaiPembelian = (varian: Varian[], kurs: number): number =>
  varian.reduce((a, v) => a + (v.usdPerLiter || 0) * kurs * (v.qtyLiter || 0), 0);

/**
 * Biaya fragrance oil di dalam SATU botol.
 *
 * Urutannya berarti dan tidak boleh ditukar:
 *
 *     mL biang di botol  = isi nominal × komposisi fragrance
 *     × harga per mL
 *     × (1 + waste)      ← bahan yang terbuang tetap dibeli
 *     × (1 + PPN)        ← PPN dikenakan pada nilai belinya
 *
 * Waste dikalikan SEBELUM PPN karena PPN memang dibayar atas seluruh biang yang
 * dibeli, termasuk yang nanti terbuang. Membalik urutannya menghasilkan angka
 * yang berbeda ~3% — cukup kecil untuk lolos pandangan sekilas, cukup besar
 * untuk menggeser gross margin satu poin penuh.
 */
export function biayaFragrancePerBotol(
  varian: Varian[],
  asumsi: Asumsi,
  ukuran: UkuranBotol,
  komposisiFragrancePct: number,
): number {
  const ml = mlBotol(asumsi, ukuran) * ((komposisiFragrancePct || 0) / 100);
  const dasar = ml * idrPerML(varian, asumsi.kurs);
  return dasar * (1 + (asumsi.wastePct || 0) / 100) * (1 + (asumsi.ppnPct || 0) / 100);
}

/**
 * Total biaya perizinan varian: (BPOM + Halal) × jumlah varian.
 *
 * Ini satu-satunya tempat jumlah varian punya konsekuensi rupiah yang besar.
 * Menambah varian keempat menambah Rp1,7 juta ke Initial Investment tanpa
 * mengubah COGS per botol sepeser pun.
 */
export const totalLegalVarian = (varian: Varian[], legal: LegalPerVarian): number =>
  ((legal.bpom || 0) + (legal.halal || 0)) * varian.length;

export const varianAwal = (): Varian[] => [
  { nama: "Prime Obsession", usdPerLiter: 2.4, qtyLiter: 25 },
  { nama: "Recomm by Strangers", usdPerLiter: 2.4, qtyLiter: 25 },
  { nama: "I Feel The Rush", usdPerLiter: 2.6, qtyLiter: 25 },
];

export const legalPerVarianAwal = (): LegalPerVarian => ({
  bpom: 1_000_000,
  halal: 700_000,
});
