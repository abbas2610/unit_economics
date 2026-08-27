/**
 * Analisis sensitivitas — "bagaimana kalau", tanpa menyentuh angka rencana.
 *
 * ## Bagaimana skenario diterapkan, dan apa yang berubah dari builder lama
 *
 * Builder lama melakukannya dengan menukar variabel global `S` ke kloning,
 * memanggil fungsi hitung, lalu memulihkannya di `finally`. Itu bekerja, dan ia
 * juga berarti **setiap fungsi hitung punya satu argumen tersembunyi** yang
 * tidak muncul di tanda tangannya. Satu `await` yang terselip di tengah blok itu
 * membuat kode lain berjalan sementara `S` masih menunjuk kloning — dan
 * hasilnya angka simulasi tersimpan sebagai angka rencana, tanpa satu error pun.
 *
 * Di sini seluruh fungsi hitung menerima `Dokumen` sebagai argumen, jadi skenario
 * cuma dokumen lain. Tidak ada yang perlu dipulihkan karena tidak ada yang
 * ditukar.
 *
 * ## Slider freight MENSKALA tarif tiap supplier
 *
 * Tiap supplier menyimpan `ratePerCBM`-nya sendiri, terlepas dari asumsi dasar
 * (lihat `supplier/domain/supplier.ts`). Kalau slider ini cuma mengganti
 * `asumsi.freightPerCBM`, ia tidak akan menggerakkan satu pun angka di Unit
 * Economics maupun Initial Investment — slider yang bergerak tanpa akibat, yang
 * terbaca sebagai "freight tidak berpengaruh".
 */
import type { Dokumen, Simulasi } from "@/contexts/dokumen/domain/dokumen";
import { rataUsdPerLiter } from "@/contexts/fragrance/domain/varian";
import type { Supplier } from "@/contexts/supplier/domain/supplier";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import type { RincianInvestasi } from "@/contexts/investasi/aplikasi/investasi";
import {
  breakEven,
  grossMarginTertimbang,
  unitEconomics,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
import type { RincianUnit } from "@/contexts/unit-economics/aplikasi/unit-economics";

export type HasilSkenario = {
  kecil: RincianUnit;
  besar: RincianUnit;
  investasi: RincianInvestasi;
  breakEven: number | null;
  grossMarginBlended: number;
};

/** Hitung semuanya untuk satu dokumen. Dipakai baseline maupun skenario. */
export function hitungSemua(dok: Dokumen): HasilSkenario {
  const kecil = unitEconomics(dok, "kecil");
  const besar = unitEconomics(dok, "besar");
  const investasi = initialInvestment(dok);
  return {
    kecil,
    besar,
    investasi,
    breakEven: breakEven(kecil, besar, investasi.total),
    grossMarginBlended: grossMarginTertimbang(kecil, besar),
  };
}

const skalaFreight = (daftar: Supplier[], faktor: number): Supplier[] =>
  daftar.map((s) => ({
    ...s,
    freight: { ...s.freight, ratePerCBM: (s.freight?.ratePerCBM || 0) * faktor },
  }));

/**
 * Dokumen versi skenario — hasil menerapkan nilai slider ke dokumen asli.
 *
 * Harga fragrance digeser sebagai FAKTOR terhadap rata-rata saat ini, bukan
 * ditetapkan ke satu nilai. Kalau tiap varian dipaksa ke rata-rata yang sama,
 * sebaran harga antar varian hilang begitu slider disentuh — dan sebaran itulah
 * satu-satunya alasan `probe:hitung` bisa memeriksa asumsi "rata-rata cukup".
 */
export function dokumenSkenario(dok: Dokumen, sim: Simulasi): Dokumen {
  const rataSekarang = rataUsdPerLiter(dok.varian);
  const faktorFragrance = rataSekarang > 0 ? (sim.fragAvgUsdPerLiter || 0) / rataSekarang : 1;
  const faktorFreight =
    dok.asumsi.freightPerCBM > 0 ? (sim.freightPerCBM || 0) / dok.asumsi.freightPerCBM : 1;

  return {
    ...dok,
    asumsi: {
      ...dok.asumsi,
      kurs: sim.kurs,
      freightPerCBM: sim.freightPerCBM,
      wastePct: sim.wastePct,
    },
    campuran: { ...dok.campuran, susutPct: sim.susutPct },
    varian: dok.varian.map((v) => ({ ...v, usdPerLiter: v.usdPerLiter * faktorFragrance })),
    supplierKecil: skalaFreight(dok.supplierKecil, faktorFreight),
    supplierBesar: skalaFreight(dok.supplierBesar, faktorFreight),
    harga: { kecil: sim.hargaKecil, besar: sim.hargaBesar },
  };
}

export const jalankanSkenario = (dok: Dokumen, sim: Simulasi): HasilSkenario =>
  hitungSemua(dokumenSkenario(dok, sim));

/* ══════════════════════════════════════════════════════════════ tornado ══ */

export type BarisTornado = {
  kunci: string;
  label: string;
  /** Selisih gross margin blended, dalam POIN persentase. */
  deltaMarginPoin: number;
  /** Selisih total investasi, dalam PERSEN. */
  deltaInvestasiPct: number;
};

/**
 * Guncangan yang diuji, dan kenapa dua di antaranya `+10 poin` bukan `+10%`.
 *
 * Kurs, freight, dan harga fragrance adalah HARGA — menaikkannya 10% berarti
 * sesuatu. Waste dan penyusutan adalah PERSENTASE; menaikkan waste 30% "sebesar
 * 10%" jadi 33% adalah guncangan yang jauh lebih kecil daripada yang dibayangkan
 * pembacanya, dan tabel yang mencampur dua makna itu tanpa menyebutnya membuat
 * urutan pengaruhnya tidak bisa dipercaya.
 */
const GUNCANGAN = [
  { kunci: "kurs", label: "Kurs USD/IDR (+10%)", kali: 1.1 },
  { kunci: "freightPerCBM", label: "Tarif Freight/CBM (+10%)", kali: 1.1 },
  { kunci: "fragAvgUsdPerLiter", label: "Harga Fragrance Oil (+10%)", kali: 1.1 },
  { kunci: "wastePct", label: "Waste (+10 poin)", tambah: 10 },
  { kunci: "susutPct", label: "Penyusutan Produksi (+10 poin)", tambah: 10 },
] as const;

/**
 * Dampak tiap variabel, diurutkan dari yang paling menggeser gross margin.
 *
 * ⚠️ Dihitung dari kondisi SAAT INI, bukan dari posisi slider. Kalau ia memakai
 * `dok.simulasi`, tabel ini akan menjawab "variabel mana yang paling berpengaruh
 * pada skenario yang sedang dicoba" — pertanyaan yang tidak ditanyakan siapa
 * pun, dan yang jawabannya berubah tiap kali seseorang menggeser slider lain.
 */
export function tornado(dok: Dokumen): BarisTornado[] {
  const dasar: Simulasi = {
    kurs: dok.asumsi.kurs,
    freightPerCBM: dok.asumsi.freightPerCBM,
    fragAvgUsdPerLiter: rataUsdPerLiter(dok.varian),
    wastePct: dok.asumsi.wastePct,
    susutPct: dok.campuran.susutPct,
    hargaKecil: dok.harga.kecil,
    hargaBesar: dok.harga.besar,
    targetOmzet: dok.simulasi.targetOmzet,
  };
  const acuan = jalankanSkenario(dok, dasar);

  return GUNCANGAN.map((g) => {
    const nilaiAwal = dasar[g.kunci];
    const nilaiBaru = "kali" in g ? nilaiAwal * g.kali : nilaiAwal + g.tambah;
    const hasil = jalankanSkenario(dok, { ...dasar, [g.kunci]: nilaiBaru });
    return {
      kunci: g.kunci,
      label: g.label,
      deltaMarginPoin: hasil.grossMarginBlended - acuan.grossMarginBlended,
      deltaInvestasiPct:
        acuan.investasi.total > 0
          ? ((hasil.investasi.total - acuan.investasi.total) / acuan.investasi.total) * 100
          : 0,
    };
  }).sort((a, b) => Math.abs(b.deltaMarginPoin) - Math.abs(a.deltaMarginPoin));
}

/* ═══════════════════════════════════════════════════════ target omzet ══ */

export type TargetPenjualan = {
  pcsKecil: number;
  pcsBesar: number;
  totalPcs: number;
  omzetTercapai: number;
  grossProfit: number;
};

/**
 * Berapa pcs harus terjual untuk mencapai target omzet.
 *
 * ⚠️ Mengasumsikan botol kecil dan besar terjual SAMA BANYAK — bukan mengikuti
 * komposisi batch. Itu asumsi yang berbeda dari yang dipakai break-even, dan
 * bedanya nyata: batch bisa 4.250 kecil : 637 besar, sementara hitungan ini
 * memakai 1:1. Disebut di layar, dan disebut lagi di sini, karena angka pcs yang
 * tidak menyebut asumsi campurannya akan dibawa ke rapat sebagai target
 * produksi.
 */
export function targetPenjualan(
  kecil: RincianUnit,
  besar: RincianUnit,
  targetOmzet: number,
): TargetPenjualan {
  const hargaPasang = kecil.harga + besar.harga;
  const pasang = hargaPasang > 0 ? (targetOmzet || 0) / hargaPasang : 0;
  const pcs = Math.ceil(pasang);
  return {
    pcsKecil: pcs,
    pcsBesar: pcs,
    totalPcs: pcs * 2,
    omzetTercapai: pcs * kecil.harga + pcs * besar.harga,
    grossProfit: pcs * kecil.grossProfit + pcs * besar.grossProfit,
  };
}
