/**
 * Skenario perbandingan custom — satu kartu "kalau harganya segini" di tab 5.
 *
 * ## Semua komponen tersimpan, dan kenapa itu berubah dari sebelumnya
 *
 * Versi awal fitur ini mengunci fragrance/botol/aksesoris sebagai baris
 * "🔒 Otomatis" — dihitung ulang tiap render dari asumsi & supplier aktif,
 * TIDAK BOLEH disimpan di skenario, supaya tabel tidak diam-diam menampilkan
 * harga supplier yang sudah tidak dipakai.
 *
 * Atas permintaan tim, itu dibalik: SEMUA komponen sekarang tersimpan dan
 * bebas diedit — termasuk yang dulu terkunci — supaya skenario bisa hidup
 * sendiri lepas dari asumsi/supplier yang sedang aktif ("bagaimana kalau
 * harga botol tahun depan segini", ditanya tanpa mengubah tab Supplier).
 * Risiko yang tadinya dicegah kuncian itu (skenario diam-diam basi begitu
 * supplier diganti) sekarang ditangani BEDA: SETIAP komponen baku di bawah
 * punya padanan "hidup" di asumsi/supplier aktif, jadi SEMUANYA dapat tombol
 * reset eksplisit yang menyalin ulang angka itu — persis pola
 * `onResetFreight` di `halaman-supplier.tsx` (lihat `otomatisSekarang()` di
 * `unit-economics-layar.tsx` untuk nilai hidupnya). Basi jadi pilihan yang
 * kelihatan di layar, bukan kesalahan diam-diam.
 *
 * Komponen custom (`custom[]`) melengkapi ini: biaya yang tidak punya
 * padanan di tab lain sama sekali (tidak ada "nilai hidup" untuk direset),
 * jadi pertanyaan "kalau ada biaya tambahan X" bisa dijawab tanpa memaksa
 * pengguna menumpangkannya ke salah satu baris baku.
 *
 * Royalti sempat jadi salah satu baris baku (persentase dari harga jual,
 * lihat riwayat git) — dihapus total begitu skema royaltinya tidak lagi
 * berlaku. Kalau kerja sama semacam ini muncul lagi, tambahkan lagi sebagai
 * baris baru di sini, bukan menghidupkan kembali field yang sudah dibuang.
 */
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";

/** Komponen biaya baku, satu per skenario. Semuanya tersimpan & bebas diedit. */
export type KomponenSkenario = {
  fragrance: number;
  botol: number;
  aksesoris: number;
  oem: number;
  box: number;
  fulfillment: number;
};

/** Satu baris biaya yang ditambahkan sendiri oleh pengguna. */
export type KomponenCustom = {
  id: string;
  label: string;
  nilai: number;
};

export type Skenario = KomponenSkenario & {
  id: string;
  nama: string;
  ukuran: UkuranBotol;
  harga: number;
  /** Baris tambahan bebas nama & angka. Kosong = belum ada yang ditambah. */
  custom: KomponenCustom[];
};

/**
 * Urutan & label seluruh baris komponen baku. Satu sumber untuk kartu dan
 * probe. Semuanya punya nilai hidup di asumsi/supplier aktif — lihat
 * `otomatisSekarang()` di `unit-economics-layar.tsx` — jadi semuanya dapat
 * tombol reset di kartu.
 */
export const BARIS_KOMPONEN: ReadonlyArray<{ kunci: keyof KomponenSkenario; label: string }> = [
  { kunci: "fragrance", label: "Fragrance Oil" },
  { kunci: "botol", label: "Botol (unit + perizinan + freight)" },
  { kunci: "aksesoris", label: "Aksesoris + Cap" },
  { kunci: "oem", label: "OEM" },
  { kunci: "box", label: "Box Packaging" },
  { kunci: "fulfillment", label: "Fulfillment" },
] as const;

/** COGS satu skenario: seluruh komponen baku + seluruh baris custom. */
export const cogsSkenario = (sc: Skenario): number =>
  BARIS_KOMPONEN.reduce((a, { kunci }) => a + (sc[kunci] || 0), 0) +
  sc.custom.reduce((a, c) => a + (c.nilai || 0), 0);
