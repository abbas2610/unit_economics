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
import { legalPerVarianAwal, rataUsdPerLiter, varianAwal } from "@/contexts/fragrance/domain/varian";
import type { Supplier } from "@/contexts/supplier/domain/supplier";
import { supplierAwal } from "@/contexts/supplier/domain/supplier";
import type { Skenario } from "@/contexts/unit-economics/domain/skenario";

/**
 * Variabel yang digeser di analisis sensitivitas.
 *
 * Terpisah dari asumsi, dan itu inti tab 6: menggesernya TIDAK boleh mengubah
 * angka yang sebenarnya. Tim yang mensimulasikan "kalau kurs 20.000" lalu lupa
 * mengembalikannya akan membawa angka simulasi ke rapat sebagai angka rencana.
 */
export type Simulasi = {
  kurs: number;
  freightPerCBM: number;
  fragAvgUsdPerLiter: number;
  wastePct: number;
  susutPct: number;
  hargaKecil: number;
  hargaBesar: number;
  targetOmzet: number;
};

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
  simulasi: Simulasi;
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
    harga: { kecil: 200_000, besar: 350_000 },
    marketing: { offline: 300_000_000, online: 200_000_000, lainnya: 50_000_000 },
    opsi: { amortisasiMolding: false },
    skenario: [],
    simulasi: {
      kurs: asumsi.kurs,
      freightPerCBM: asumsi.freightPerCBM,
      fragAvgUsdPerLiter: rataUsdPerLiter(varian),
      wastePct: asumsi.wastePct,
      susutPct: 15,
      hargaKecil: 200_000,
      hargaBesar: 350_000,
      targetOmzet: 100_000_000,
    },
  };
}

/** Nilai simulasi yang mencerminkan kondisi saat ini — tombol "sync" di tab 6. */
export const simulasiDariDokumen = (dok: Dokumen): Simulasi => ({
  kurs: dok.asumsi.kurs,
  freightPerCBM: dok.asumsi.freightPerCBM,
  fragAvgUsdPerLiter: rataUsdPerLiter(dok.varian),
  wastePct: dok.asumsi.wastePct,
  susutPct: dok.campuran.susutPct,
  hargaKecil: dok.harga.kecil,
  hargaBesar: dok.harga.besar,
  targetOmzet: dok.simulasi.targetOmzet,
});
