/**
 * Skenario perbandingan custom — kolom "kalau harganya segini" di tab 5.
 *
 * ## Dua jenis baris, dan garis di antaranya yang penting
 *
 *   - **🔒 Otomatis** — fragrance, botol (sudah termasuk freight), aksesoris.
 *     Ikut asumsi & supplier yang sedang aktif untuk ukuran botol yang dipilih
 *     kolom itu. TIDAK disimpan di skenario; dihitung ulang tiap render.
 *   - **✎ Bisa diubah** — OEM, box, fulfillment, royalti, harga jual.
 *     Disimpan di skenario dan bebas diedit.
 *
 * Freight dulu ada di baris yang bisa diubah, dan itu berarti mengganti
 * supplier atau tarif freight di tab lain tidak pernah sampai ke sini kalau
 * skenarionya sudah pernah disentuh. Sekarang ia ikut baris "Botol" yang
 * otomatis — sama seperti perizinan, ia bagian dari harga botol, bukan
 * komponen yang berdiri sendiri untuk ditanyakan "kalau segini".
 *
 * Batas itu bukan selera. Baris otomatis adalah angka yang sudah punya sumber
 * kebenaran di tab lain; menyalinnya ke tiap skenario berarti mengubah supplier
 * tidak lagi memperbarui perbandingan — dan tabel yang menampilkan harga botol
 * supplier yang sudah tidak dipakai terlihat persis seperti tabel yang benar.
 *
 * Baris yang bisa diubah justru sebaliknya: gunanya memang menanyakan "bagaimana
 * kalau OEM-nya bukan segitu", dan menguncinya ke asumsi menghapus alasan tabel
 * ini ada.
 */
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";

/** Komponen yang disimpan per skenario dan bebas diedit. */
export type KomponenSkenario = {
  oem: number;
  box: number;
  fulfillment: number;
  royalti: number;
};

export type Skenario = KomponenSkenario & {
  id: string;
  nama: string;
  ukuran: UkuranBotol;
  harga: number;
};

/** Urutan & label baris yang bisa diedit. Satu sumber untuk tabel dan probe. */
export const BARIS_SKENARIO: ReadonlyArray<readonly [keyof KomponenSkenario, string]> = [
  ["oem", "OEM"],
  ["box", "Box Packaging"],
  ["fulfillment", "Fulfillment"],
  ["royalti", "Royalti"],
] as const;

/** Label baris yang terkunci ke asumsi & supplier aktif. */
export const BARIS_TERKUNCI = [
  ["fragrance", "Fragrance Oil"],
  ["botol", "Botol (unit + perizinan + freight)"],
  ["aksesoris", "Aksesoris + Cap"],
] as const;

/**
 * COGS satu skenario: komponen yang diedit + komponen otomatis dari unit
 * economics ukuran yang dipilih.
 *
 * Sengaja menerima ketiga nilai otomatis sebagai argumen alih-alih menghitungnya
 * sendiri: fungsi ini tinggal di `domain/`, dan menariknya ke `aplikasi/` cuma
 * supaya ia bisa memanggil unit economics akan memindahkan aritmetika paling
 * sederhana di berkas ini ke lapisan yang paling sulit diuji.
 */
export const cogsSkenario = (
  sc: Skenario,
  otomatis: { fragrance: number; botol: number; aksesoris: number },
): number =>
  BARIS_SKENARIO.reduce((a, [k]) => a + (sc[k] || 0), 0) +
  otomatis.fragrance +
  otomatis.botol +
  otomatis.aksesoris;
