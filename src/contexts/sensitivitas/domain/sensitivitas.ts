/**
 * Analisis sensitivitas — "kalau kurs / harga jual segini, semuanya jadi berapa".
 *
 * ## Asumsinya cuma tiga, dan itu keputusan pemilik
 *
 * Versi pertama tab ini membuka lima belas variabel rupiah (harga botol, box,
 * OEM, molding, marketing, …) untuk diisi per skenario. Pemilik membacanya
 * terbalik dari yang ia butuhkan: ia ingin mengisi SATU asumsi ("rupiah jadi
 * 20 ribu") lalu MELIHAT harga botol, OEM, dan seterusnya jadi berapa —
 * bukan mengisi semuanya sendiri. Sel yang tidak diisi tampil kosong, dan
 * jawabannya ("harga botol kecil jadi berapa") tidak ada di mana pun.
 *
 * Jadi asumsi skenario = **kurs** dan **harga jual** (kecil & besar). Semua
 * yang lain adalah HASIL, dihitung dari asumsi itu oleh fungsi tab 4 & 5.
 *
 * ## Override yang jarang
 *
 * Kolom A — Default — adalah dokumen aktif. Tiap kolom B, C, … hanya
 * menyimpan asumsi yang diubah; yang tidak diisi ikut default dan terus
 * bergerak bersamanya. Kenapa jarang, bukan salinan lengkap: skenario yang
 * menyimpan semua angka diam-diam basi begitu angka rencana diubah, dan
 * selisihnya terbaca sebagai dampak skenario.
 *
 * ⚠️ Kunci yang tidak ada ≠ `0`. Harga jual yang dibiarkan kosong berarti
 * "ikut default"; harga jual `0` berarti "dibagikan gratis". Meleburnya membuat
 * kolom yang belum disentuh terbaca sebagai kabar terburuk.
 */

/** Asumsi yang bisa digeser per skenario. */
export type KunciVariabel = "kurs" | "hargaKecil" | "hargaBesar";

export type SkenarioSensitivitas = {
  id: string;
  nama: string;
  /** HANYA asumsi yang diubah. Kunci yang tidak ada = ikut default. */
  nilai: Partial<Record<KunciVariabel, number>>;
};

export type DefinisiVariabel = {
  kunci: KunciVariabel;
  label: string;
  /** Satuan yang ditulis di bawah label. */
  satuan: string;
  /**
   * `true` kalau naiknya BURUK. Membalik warna Δ: kurs yang naik bukan kabar
   * baik, dan mewarnainya hijau karena angkanya positif adalah cara tercepat
   * membuat orang salah baca tabel ini.
   */
  biaya: boolean;
};

/**
 * Urutan baris asumsi. Satu sumber untuk layar, laporan, migrasi, dan probe —
 * migrasi membuang kunci yang tidak ada di sini, jadi skenario lama yang
 * menyimpan "harga botol" tidak menyelundupkan asumsi yang sudah tidak ada.
 */
export const VARIABEL: ReadonlyArray<DefinisiVariabel> = [
  { kunci: "kurs", label: "Kurs USD → IDR", satuan: "Rp per 1 USD", biaya: true },
  { kunci: "hargaKecil", label: "Harga jual botol kecil", satuan: "/ botol", biaya: false },
  { kunci: "hargaBesar", label: "Harga jual botol besar", satuan: "/ botol", biaya: false },
] as const;

export const KUNCI_VARIABEL: ReadonlyArray<KunciVariabel> = VARIABEL.map((v) => v.kunci);

/**
 * Huruf kolom: Default selalu A, skenario pertama B, dst. Lewat Z jadi "AA".
 * Dihitung dari POSISI, bukan disimpan — menghapus skenario B menggeser C jadi
 * B, persis seperti kolom spreadsheet yang dibayangkan pemiliknya.
 */
export function hurufKolom(indeksSkenario: number): string {
  let n = indeksSkenario + 1; // 0 = A (default)
  let out = "";
  do {
    out = String.fromCharCode(65 + (n % 26)) + out;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return out;
}
