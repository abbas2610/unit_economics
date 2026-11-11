/**
 * Menjalankan skenario sensitivitas — skenario adalah DOKUMEN LAIN, bukan rumus lain.
 *
 * `terapkan()` menghasilkan salinan dokumen dengan asumsi skenario (kurs,
 * harga jual) tertanam, lalu salinan itu dihitung oleh `unitEconomics()` dan
 * `initialInvestment()` yang SAMA dengan tab 4 dan 5. Tidak ada satu pun rumus
 * biaya di berkas ini. Sensitivitas yang menghitung COGS-nya sendiri akan
 * berbeda dari tab Unit Economics pada hari pertama seseorang menambah komponen
 * di sana dan lupa menambahkannya di sini — dan selisih itu akan terbaca
 * sebagai dampak skenario.
 *
 * Karena itu juga kurs "menjalar" dengan benar tanpa kode khusus: fragrance
 * (USD/liter), botol & aksesoris supplier USD, dan molding USD ikut kurs
 * skenario; OEM, fulfillment, dan vendor ber-Rupiah tetap. Yang menentukan
 * mata uangnya adalah data supplier, bukan daftar di sini.
 *
 * Tidak ada state global yang ditukar (lihat CLAUDE.md): dokumen asli tidak
 * pernah disentuh.
 */
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import {
  breakEven,
  grossMarginTertimbang,
  grossProfitBatch,
  unitEconomics,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
import type { RincianUnit } from "@/contexts/unit-economics/aplikasi/unit-economics";
import { KUNCI_VARIABEL } from "@/contexts/sensitivitas/domain/sensitivitas";
import type { KunciVariabel, SkenarioSensitivitas } from "@/contexts/sensitivitas/domain/sensitivitas";

/* ═══════════════════════════════════════════════════════════ asumsi ══ */

/** Nilai satu asumsi di dokumen ini (kolom Default, atau dokumen skenario). */
export function nilaiVariabel(dok: Dokumen, kunci: KunciVariabel): number {
  switch (kunci) {
    case "kurs":
      return dok.asumsi.kurs;
    case "hargaKecil":
      return dok.harga.kecil;
    case "hargaBesar":
      return dok.harga.besar;
  }
}

/** Dokumen versi skenario. Dokumen asli TIDAK disentuh. */
export function terapkan(dok: Dokumen, sk: SkenarioSensitivitas): Dokumen {
  const n = sk.nilai;
  return {
    ...dok,
    asumsi: n.kurs == null ? dok.asumsi : { ...dok.asumsi, kurs: n.kurs },
    harga: {
      kecil: n.hargaKecil ?? dok.harga.kecil,
      besar: n.hargaBesar ?? dok.harga.besar,
    },
  };
}

/* ═══════════════════════════════════════════════════════════════ hasil ══ */

export type KunciHasil =
  | "fragranceKecil" | "oemKecil" | "botolKecil" | "aksesorisKecil" | "boxKecil"
  | "freightKecil" | "fulfillmentKecil" | "amortisasiKecil" | "cogsKecil"
  | "fragranceBesar" | "oemBesar" | "botolBesar" | "aksesorisBesar" | "boxBesar"
  | "freightBesar" | "fulfillmentBesar" | "amortisasiBesar" | "cogsBesar"
  | "bahanBaku" | "botolPacking" | "totalInvestasi"
  | "gpKecil" | "gpBesar" | "marginKecil" | "marginBesar" | "marginBlended"
  | "gpBatch" | "breakEven";

/** Seluruh angka hasil satu kolom. `breakEven` `null` = tak pernah balik modal. */
export type Ringkasan = Record<KunciHasil, number | null>;

const rincian = (r: RincianUnit, akhiran: "Kecil" | "Besar") => ({
  [`fragrance${akhiran}`]: r.fragrance,
  [`oem${akhiran}`]: r.oem,
  [`botol${akhiran}`]: r.botol,
  [`aksesoris${akhiran}`]: r.aksesoris,
  [`box${akhiran}`]: r.box,
  [`freight${akhiran}`]: r.freight,
  [`fulfillment${akhiran}`]: r.fulfillment,
  [`amortisasi${akhiran}`]: r.amortisasi,
  [`cogs${akhiran}`]: r.cogs,
});

export function ringkas(dok: Dokumen): Ringkasan {
  const kecil = unitEconomics(dok, "kecil");
  const besar = unitEconomics(dok, "besar");
  const inv = initialInvestment(dok);
  return {
    ...rincian(kecil, "Kecil"),
    ...rincian(besar, "Besar"),
    bahanBaku: inv.bahanBaku,
    botolPacking: inv.botolPacking,
    totalInvestasi: inv.total,
    gpKecil: kecil.grossProfit,
    gpBesar: besar.grossProfit,
    marginKecil: kecil.grossMargin,
    marginBesar: besar.grossMargin,
    marginBlended: grossMarginTertimbang(kecil, besar),
    gpBatch: grossProfitBatch(kecil, besar),
    breakEven: breakEven(kecil, besar, inv.total),
  } as Ringkasan;
}

export type JenisMetrik = "rupiah" | "margin" | "pcs";

export type KelompokHasil =
  | "Biaya per botol kecil"
  | "Biaya per botol besar"
  | "Initial investment"
  | "Profit & break-even";

export type DefinisiMetrik = {
  kunci: KunciHasil;
  label: string;
  kelompok: KelompokHasil;
  jenis: JenisMetrik;
  /** Naiknya buruk — biaya, investasi, dan pcs untuk balik modal. */
  biaya: boolean;
  /** Baris yang ditebalkan dan masuk ikhtisar PDF. */
  utama?: boolean;
  /** Disembunyikan kalau nol di SEMUA kolom (amortisasi yang dimatikan). */
  opsional?: boolean;
};

const komponen = (ukuran: "Kecil" | "Besar"): DefinisiMetrik[] => {
  const kelompok: KelompokHasil = ukuran === "Kecil" ? "Biaya per botol kecil" : "Biaya per botol besar";
  const k = (kunci: string) => `${kunci}${ukuran}` as KunciHasil;
  return [
    { kunci: k("fragrance"), label: "Fragrance oil", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("oem"), label: "OEM", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("botol"), label: "Botol + perizinan", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("aksesoris"), label: "Aksesoris + cap", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("box"), label: "Box packaging", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("freight"), label: "Freight botol", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("fulfillment"), label: "Fulfillment", kelompok, jenis: "rupiah", biaya: true },
    { kunci: k("amortisasi"), label: "Amortisasi molding & MOQ", kelompok, jenis: "rupiah", biaya: true, opsional: true },
    { kunci: k("cogs"), label: `COGS / botol ${ukuran.toLowerCase()}`, kelompok, jenis: "rupiah", biaya: true, utama: true },
  ];
};

/** Urutan baris hasil. Satu sumber untuk layar, PDF, dan probe. */
export const METRIK: ReadonlyArray<DefinisiMetrik> = [
  ...komponen("Kecil"),
  ...komponen("Besar"),
  { kunci: "bahanBaku", label: "Bahan baku (fragrance + OEM + legal)", kelompok: "Initial investment", jenis: "rupiah", biaya: true },
  { kunci: "botolPacking", label: "Botol & packaging", kelompok: "Initial investment", jenis: "rupiah", biaya: true },
  { kunci: "totalInvestasi", label: "Total Initial Investment", kelompok: "Initial investment", jenis: "rupiah", biaya: true, utama: true },
  { kunci: "gpKecil", label: "Gross profit / botol kecil", kelompok: "Profit & break-even", jenis: "rupiah", biaya: false },
  { kunci: "gpBesar", label: "Gross profit / botol besar", kelompok: "Profit & break-even", jenis: "rupiah", biaya: false },
  { kunci: "marginKecil", label: "Gross margin botol kecil", kelompok: "Profit & break-even", jenis: "margin", biaya: false },
  { kunci: "marginBesar", label: "Gross margin botol besar", kelompok: "Profit & break-even", jenis: "margin", biaya: false },
  { kunci: "marginBlended", label: "Gross margin gabungan", kelompok: "Profit & break-even", jenis: "margin", biaya: false, utama: true },
  { kunci: "gpBatch", label: "Gross profit 1 batch (terjual habis)", kelompok: "Profit & break-even", jenis: "rupiah", biaya: false },
  { kunci: "breakEven", label: "Break-even", kelompok: "Profit & break-even", jenis: "pcs", biaya: true, utama: true },
];

export const KELOMPOK_HASIL: ReadonlyArray<KelompokHasil> = [
  "Biaya per botol kecil",
  "Biaya per botol besar",
  "Initial investment",
  "Profit & break-even",
];

/**
 * Baris yang tampil untuk sekumpulan kolom: baris `opsional` hanya kalau
 * bukan nol di salah satu kolom. Amortisasi yang dimatikan tidak perlu jadi
 * dua baris "Rp0" di tiap kolom.
 */
export const metrikTampil = (hasil: ReadonlyArray<HasilSkenario>): DefinisiMetrik[] =>
  METRIK.filter((m) => !m.opsional || hasil.some((h) => Math.abs(h.ringkasan[m.kunci] ?? 0) >= 0.5));

/**
 * Selisih skenario terhadap default.
 *
 * `persen` = perubahan RELATIF (Rp12.000 → Rp13.000 = +8,33%). `null` kalau
 * pembandingnya nol atau salah satu nilainya `null` — persen dari nol bukan
 * angka besar, ia tidak terdefinisi, dan menulisnya "+∞%" atau "0%" sama-sama
 * bohong.
 *
 * Untuk margin, `selisih` sudah dalam POIN (44% → 40% = −4 poin) dan
 * `persen` sengaja `null`: "margin turun 9,1%" untuk empat poin adalah persen
 * dari persen, dan pembaca hampir selalu membacanya sebagai poin.
 */
export type Selisih = { selisih: number | null; persen: number | null };

export function selisih(dasar: number | null, baru: number | null, jenis: JenisMetrik = "rupiah"): Selisih {
  if (dasar == null || baru == null) return { selisih: null, persen: null };
  const s = baru - dasar;
  if (jenis === "margin") return { selisih: s, persen: null };
  return { selisih: s, persen: dasar !== 0 ? (s / Math.abs(dasar)) * 100 : null };
}

/** Apakah selisihnya cukup besar untuk disebut "bergeser". */
export const bergeser = (sel: Selisih, jenis: JenisMetrik): boolean =>
  sel.selisih != null && Math.abs(sel.selisih) >= (jenis === "margin" ? 0.05 : 0.5);

/** Seluruh asumsi dan hasil satu kolom, siap ditampilkan. */
export type HasilSkenario = {
  dokumen: Dokumen;
  ringkasan: Ringkasan;
  variabel: Record<KunciVariabel, number>;
};

export function jalankan(dok: Dokumen, sk?: SkenarioSensitivitas): HasilSkenario {
  const d = sk ? terapkan(dok, sk) : dok;
  const variabel = Object.fromEntries(
    KUNCI_VARIABEL.map((k) => [k, nilaiVariabel(d, k)]),
  ) as Record<KunciVariabel, number>;
  return { dokumen: d, ringkasan: ringkas(d), variabel };
}
