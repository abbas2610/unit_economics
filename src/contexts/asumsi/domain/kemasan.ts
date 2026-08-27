/**
 * Dari dimensi botol ke biaya freight per botol.
 *
 * Freight forwarder menagih per CBM (meter kubik), bukan per pcs. Rantai
 * hitungnya pendek tapi tiap mata rantainya pernah jadi sumber salah paham:
 *
 *     volume botol (cm³)
 *       ÷ efisiensi packing   → volume EFEKTIF yang benar-benar dibayar
 *       → pcs per CBM
 *       → tarif per CBM ÷ pcs per CBM = biaya per botol
 *
 * ## Efisiensi packing membagi, bukan mengalikan
 *
 * Ruang kosong di dalam kardus tetap dikirim dan tetap dibayar. Efisiensi 70%
 * berarti tiap botol menempati `volume / 0,7` — LEBIH besar dari volumenya
 * sendiri, bukan lebih kecil. Mengalikannya (`volume × 0,7`) menghasilkan pcs
 * per CBM yang lebih banyak dan freight per botol yang lebih murah — angka yang
 * masih masuk akal di layar dan salah ke arah yang menyenangkan.
 */
import type { Asumsi, UkuranBotol } from "./asumsi";

/** Dimensi kardus satu botol dalam cm. */
export type Dimensi = { panjang: number; lebar: number; tinggi: number };

/** Volume satu botol dalam cm³. */
export const volumeBotol = (d: Dimensi): number =>
  (d.panjang || 0) * (d.lebar || 0) * (d.tinggi || 0);

/**
 * Berapa pcs yang muat dalam satu CBM, setelah efisiensi packing.
 *
 * `0` kalau dimensinya belum diisi — dan itu disengaja: `Infinity` akan menjalar
 * jadi `NaN` di seluruh kolom biaya, sementara `0` berhenti di tempat dan
 * terbaca sebagai "belum ada angkanya".
 */
export function pcsPerCBM(d: Dimensi, packingEfficiency: number): number {
  const efisiensi = (packingEfficiency || 0) / 100;
  if (efisiensi <= 0) return 0;
  const efektif = volumeBotol(d) / efisiensi;
  return efektif > 0 ? 1_000_000 / efektif : 0;
}

/**
 * Biaya freight per botol menurut ASUMSI DASAR.
 *
 * ⚠️ Ini nilai **default** yang diwarisi supplier baru, bukan yang dipakai
 * menghitung COGS. Tiap supplier menyimpan `pcsPerCBM` dan `ratePerCBM`-nya
 * sendiri begitu ia dibuat, dan sejak itu keduanya hidup terpisah: mengubah
 * tarif di tab 1 TIDAK menggeser supplier yang sudah ada.
 *
 * Perilaku itu disengaja (tiap supplier boleh punya forwarder sendiri) tapi
 * mengejutkan, dan ia pernah membuat slider freight di analisis sensitivitas
 * tidak menggerakkan apa pun. Perbaikannya ada di `sensitivitas/aplikasi` —
 * slider itu menskala tarif tiap supplier, bukan mengganti tarif dasar.
 */
export function freightPerBotolDasar(
  d: Dimensi,
  asumsi: Pick<Asumsi, "packingEfficiency" | "freightPerCBM">,
): number {
  const p = pcsPerCBM(d, asumsi.packingEfficiency);
  return p > 0 ? asumsi.freightPerCBM / p : 0;
}

export const dimensiAwal = (): Record<UkuranBotol, Dimensi> => ({
  kecil: { panjang: 10.25, lebar: 5.96, tinggi: 3.5 },
  besar: { panjang: 12.5, lebar: 7.0, tinggi: 4.5 },
});
