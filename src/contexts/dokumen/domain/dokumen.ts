/**
 * Dokumen — seluruh isi builder dalam satu nilai.
 *
 * Satu dokumen, satu tim, satu baris di Supabase. Itu keputusan produk, bukan
 * keterbatasan: angka unit economics hanya berguna kalau semua orang di rapat
 * melihat angka yang sama, dan versi per pengguna melahirkan tiga jawaban
 * berbeda untuk "berapa initial investment-nya".
 *
 * ## Aturan bentuknya
 *
 * **Tidak ada nilai turunan di sini.** Qty batch, hasil produksi, rata-rata
 * harga fragrance, COGS — semuanya fungsi dari dokumen, bukan field di
 * dalamnya. Builder lama menyimpan `projection.batchSmall` DAN menghitungnya
 * ulang di tiap render; dua sumber untuk satu angka selalu berbeda pada
 * akhirnya, dan yang tersimpan menang di jalur kode yang lupa menghitung ulang.
 *
 * **`versi` ada supaya migrasi bisa berhenti menebak.** Payload tanpa `versi`
 * adalah bentuk lama (v0) dari builder HTML — lihat `migrasi.ts`.
 */
import type { Asumsi } from "@/contexts/asumsi/domain/asumsi";
import { asumsiAwal } from "@/contexts/asumsi/domain/asumsi";
import type { Dimensi } from "@/contexts/asumsi/domain/kemasan";
import { dimensiAwal } from "@/contexts/asumsi/domain/kemasan";
import type { Campuran } from "@/contexts/fragrance/domain/campuran";
import { campuranAwal } from "@/contexts/fragrance/domain/campuran";
import type { LegalPerVarian, Varian } from "@/contexts/fragrance/domain/varian";
import { legalPerVarianAwal, varianAwal } from "@/contexts/fragrance/domain/varian";
import type { Supplier } from "@/contexts/supplier/domain/supplier";
import { supplierAwal } from "@/contexts/supplier/domain/supplier";
import type { KomponenCustom, Skenario } from "@/contexts/unit-economics/domain/skenario";

export type Dokumen = {
  /** Bentuk dokumen. Naik hanya kalau migrasi dibutuhkan. */
  versi: 1;

  asumsi: Asumsi;
  campuran: Campuran;
  legalPerVarian: LegalPerVarian;
  varian: Varian[];
  dimensi: { kecil: Dimensi; besar: Dimensi };

  supplierKecil: Supplier[];
  supplierBesar: Supplier[];
  /** Supplier yang dipakai Initial Investment & Unit Economics. */
  pilihan: { kecilId: string; besarId: string };

  /**
   * Berapa botol yang DIPESAN, kalau bukan sebanyak yang cairannya cukup.
   *
   * `null` — bukan `0` — berarti "ikuti kapasitas cairan". `0` adalah pernyataan
   * ("tidak memesan botol sama sekali"), dan meleburnya membuat pembelian yang
   * belum diisi terbaca sebagai keputusan untuk tidak berproduksi.
   *
   * ## Kenapa ini ada, dan kenapa ia BUKAN turunan
   *
   * Sebelum field ini, jumlah botol yang dibeli selalu `max(MOQ, kapasitas
   * cairan)` — tidak ada cara memodelkan pembelian sampel. Tim yang ingin
   * bertanya "berapa biayanya kalau saya cuma beli 100 botol dulu" mendapat
   * jawaban untuk 8.500 botol, karena MOQ 100 tidak mengikat apa pun dan
   * kapasitas cairanlah yang menang.
   *
   * Ia tinggal di dokumen dan bukan di supplier dengan sengaja: kalau tiap
   * supplier punya qty-nya sendiri, tabel perbandingan berhenti membandingkan
   * hal yang sama — dan badge "termurah" di atas dua qty berbeda adalah cara
   * tercepat memilih vendor yang salah.
   *
   * Yang JADI botol tetap turunan: `qtyProduksi()` = min(kapasitas cairan, botol
   * yang dibeli). Membeli 100 botol tidak menghilangkan cairannya — ia jadi
   * sisa yang tidak terbotolkan, dan itu ditampilkan.
   */
  pembelian: { kecil: number | null; besar: number | null };

  /** Harga jual per botol. */
  harga: { kecil: number; besar: number };
  marketing: { offline: number; online: number; lainnya: number };

  opsi: {
    /**
     * Serap molding ke COGS per botol (dibagi rata ke qty batch).
     *
     * Mati secara default: molding adalah capex yang sudah dihitung penuh di
     * Initial Investment, dan memasukkannya ke COGS per botol berarti ia
     * dihitung dua kali kalau kedua angka dibaca berdampingan. Dinyalakan saat
     * yang ditanya "berapa biaya per unit sesungguhnya untuk batch ini".
     */
    amortisasiMolding: boolean;
  };

  skenario: Skenario[];
  /** Biaya tambahan bebas nama & angka di Initial Investment — Category 1. */
  investasiCustom: KomponenCustom[];
};

export function dokumenAwal(): Dokumen {
  const varian = varianAwal();
  const supplier = supplierAwal();
  const asumsi = asumsiAwal();
  return {
    versi: 1,
    asumsi,
    campuran: campuranAwal(),
    legalPerVarian: legalPerVarianAwal(),
    varian,
    dimensi: dimensiAwal(),
    supplierKecil: supplier.kecil,
    supplierBesar: supplier.besar,
    pilihan: { kecilId: supplier.kecil[0].id, besarId: supplier.besar[0].id },
    pembelian: { kecil: null, besar: null },
    harga: { kecil: 200_000, besar: 350_000 },
    marketing: { offline: 300_000_000, online: 200_000_000, lainnya: 50_000_000 },
    opsi: { amortisasiMolding: false },
    skenario: [],
    investasiCustom: [],
  };
}
