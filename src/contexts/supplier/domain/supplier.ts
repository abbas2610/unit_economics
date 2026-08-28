/**
 * Supplier botol, dan apa yang dibayar kepadanya.
 *
 * Dua jenis biaya, dan memisahkannya adalah inti seluruh halaman perbandingan:
 *
 *   - **molding** — sekali bayar, tidak peduli berapa pcs dipesan
 *   - **satuan**  — per pcs
 *
 * Supplier dengan molding mahal dan satuan murah menang pada volume besar dan
 * kalah telak pada volume kecil. Membandingkan salah satunya saja — atau
 * menjumlahkan keduanya jadi "harga per botol" tanpa menyebut qty-nya — adalah
 * cara paling umum salah memilih vendor.
 */
import { keIDR } from "@/contexts/asumsi/domain/asumsi";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";

export type MataUang = "IDR" | "USD";

export type Supplier = {
  id: string;
  nama: string;
  /** Botol kecil umumnya dari China (USD), botol besar vendor lokal (IDR). */
  mataUang: MataUang;
  /** Minimum order quantity. Sering MELEBIHI kebutuhan batch — lihat `investasi`. */
  moq: number;
  /** Biaya sekali bayar, dalam `mataUang`. */
  molding: { botol: number; cap: number; silikon: number };
  /** Biaya per pcs, dalam `mataUang`. */
  satuan: { botol: number; cap: number; aksesoris: number };
  /**
   * Freight forwarder milik supplier ini sendiri.
   *
   * ⚠️ Nilainya disalin dari asumsi dasar saat supplier dibuat, lalu HIDUP
   * TERPISAH. Mengubah tarif per CBM di tab 1 tidak menggeser supplier yang
   * sudah ada. Itu disengaja — tiap vendor bisa punya forwarder sendiri — tapi
   * cukup mengejutkan sampai tiap kartu supplier punya tombol
   * "pakai default asumsi dasar", dan analisis sensitivitas harus MENSKALA
   * tarif tiap supplier alih-alih mengganti tarif dasarnya.
   */
  freight: { aktif: boolean; pcsPerCBM: number; ratePerCBM: number };
};

/** Rincian biaya per pcs, sudah dalam IDR. */
export type BiayaSatuan = {
  /** Harga botol saja. */
  botol: number;
  /** Perizinan & legalitas, % dari harga botol. */
  perizinan: number;
  /** Cap + aksesoris. */
  aksesoris: number;
  /**
   * botol + perizinan + aksesoris. **TANPA freight.**
   *
   * ⚠️ Ini BUKAN biaya botol per unit yang dipakai COGS — untuk itu ada
   * `totalLengkap`. Namanya tetap `total` karena ia memang total dari tiga
   * baris di atasnya, tapi memakainya sebagai "biaya botol per unit" adalah
   * kesalahan yang sudah pernah terjadi di TIGA tempat sekaligus: kartu
   * supplier, baris terakhir tabel perbandingan, dan nilai kelebihan stok di
   * Initial Investment. Ketiganya melaporkan angka yang terlalu rendah tanpa
   * satu pun error.
   */
  total: number;
  /** Freight per botol menurut supplier ini. `0` kalau freight-nya dimatikan. */
  freight: number;
  /**
   * total + freight. **Ini yang setara dengan komponen botol di COGS.**
   *
   * Freight ikut karena `unitEconomics()` memasukkannya ke `botolPacking`.
   * Membandingkan supplier tanpa freight bisa menobatkan vendor yang COGS-nya
   * JUSTRU lebih mahal: botol yang lebih murah tapi lebih gemuk membayar lebih
   * banyak per CBM. Dijaga `probe:hitung` dengan kontrol negatif yang membalik
   * pemenangnya.
   */
  totalLengkap: number;
};

export function biayaSatuan(sup: Supplier, kurs: number, perizinanPct: number): BiayaSatuan {
  const botol = keIDR(sup.satuan.botol, sup.mataUang, kurs);
  const perizinan = botol * ((perizinanPct || 0) / 100);
  const aksesoris =
    keIDR(sup.satuan.aksesoris, sup.mataUang, kurs) + keIDR(sup.satuan.cap, sup.mataUang, kurs);
  const total = botol + perizinan + aksesoris;
  const freight = freightPerBotol(sup);
  return { botol, perizinan, aksesoris, total, freight, totalLengkap: total + freight };
}

/** Total molding, IDR. Sekali bayar. */
export const totalMolding = (sup: Supplier, kurs: number): number =>
  keIDR(sup.molding.botol, sup.mataUang, kurs) +
  keIDR(sup.molding.cap, sup.mataUang, kurs) +
  keIDR(sup.molding.silikon, sup.mataUang, kurs);

/**
 * Biaya freight per botol menurut angka supplier ini sendiri.
 *
 * `0` kalau freight-nya dimatikan — mis. harga vendor sudah franco gudang.
 */
export function freightPerBotol(sup: Supplier): number {
  if (!sup.freight?.aktif) return 0;
  const p = sup.freight.pcsPerCBM;
  return p > 0 ? sup.freight.ratePerCBM / p : 0;
}

export type InvestasiSupplier = {
  /** Qty yang BENAR-BENAR dibayar: MOQ atau qty diminta, mana yang lebih besar. */
  qty: number;
  /** Apakah MOQ yang menentukan `qty` — bukan jumlah yang diminta. */
  moqMengikat: boolean;
  molding: number;
  botol: number;
  aksesoris: number;
  perizinan: number;
  freight: number;
  total: number;
  satuan: BiayaSatuan;
};

/**
 * Total yang dibayar ke satu supplier untuk `qtyDiminta` botol.
 *
 * ⚠️ `qty = max(MOQ, qtyDiminta)`. **MOQ adalah lantai, bukan pesanan.** MOQ 100
 * pcs sementara yang diminta 8.500 berarti yang dibayar 8.500 — angka 100 tidak
 * ikut menghitung apa pun. Kebalikannya juga: MOQ 10.000 untuk 8.500 yang
 * diminta berarti **1.500 botol dibayar dan disimpan**, dan modal tertahan itu
 * masuk Initial Investment walau tidak satu pun botolnya terisi di batch ini.
 *
 * `qtyDiminta` datang dari `qtyDiminta()` di `unit-economics/aplikasi`, yang
 * membaca `dok.pembelian` — bukan dari kapasitas cairan langsung. Keduanya beda
 * sejak tim bisa memodelkan pembelian sampel (mis. beli 100 botol saja).
 *
 * `moqMengikat` dikembalikan supaya layar bisa MENYEBUTNYA. MOQ yang mengikat
 * dan MOQ yang tidak menghasilkan tabel yang terlihat sama persis, dan pembaca
 * yang mengalikan angka MOQ di kepalanya akan mendapat hasil yang tidak masuk
 * akal — itu keluhan nyata yang melahirkan field ini.
 */
export function investasiSupplier(
  sup: Supplier,
  kurs: number,
  perizinanPct: number,
  qtyDiminta: number,
): InvestasiSupplier {
  const moq = sup.moq || 0;
  const diminta = qtyDiminta || 0;
  const qty = Math.max(moq, diminta);
  const satuan = biayaSatuan(sup, kurs, perizinanPct);
  const molding = totalMolding(sup, kurs);
  const botol = satuan.botol * qty;
  const aksesoris = satuan.aksesoris * qty;
  const perizinan = satuan.perizinan * qty;
  const freight = satuan.freight * qty;
  return {
    qty,
    moqMengikat: moq > diminta,
    molding,
    botol,
    aksesoris,
    perizinan,
    freight,
    total: molding + botol + aksesoris + perizinan + freight,
    satuan,
  };
}

/**
 * Cari supplier menurut id, jatuh ke yang pertama kalau tidak ketemu.
 *
 * Jatuh ke yang pertama, bukan `undefined`, karena layar yang kehilangan
 * supplier terpilih (mis. ia dihapus di tab lain) harus tetap menampilkan
 * angka — dan `undefined` yang menjalar ke perhitungan menghasilkan `NaN` di
 * setiap kolom sekaligus, yang terbaca sebagai aplikasi rusak alih-alih pilihan
 * yang perlu diperbarui.
 */
export const cariSupplier = (daftar: Supplier[], id: string): Supplier | undefined =>
  daftar.find((s) => s.id === id) ?? daftar[0];

export const supplierAwal = (): Record<UkuranBotol, Supplier[]> => ({
  kecil: [
    {
      id: "s1",
      nama: "Gelas Bening (A)",
      mataUang: "USD",
      moq: 10_000,
      molding: { botol: 1475, cap: 0, silikon: 1036 },
      satuan: { botol: 0.48, cap: 0, aksesoris: 0.59 },
      freight: { aktif: true, pcsPerCBM: 3272, ratePerCBM: 7_000_000 },
    },
    {
      id: "s2",
      nama: "Model Batu (B)",
      mataUang: "USD",
      moq: 10_000,
      molding: { botol: 1475, cap: 1160, silikon: 1475 },
      satuan: { botol: 0.59, cap: 0, aksesoris: 0.46 },
      freight: { aktif: true, pcsPerCBM: 3272, ratePerCBM: 7_000_000 },
    },
  ],
  besar: [
    {
      id: "l1",
      nama: "Vendor Lokal A",
      mataUang: "IDR",
      moq: 10_000,
      molding: { botol: 25_000_000, cap: 20_000_000, silikon: 0 },
      satuan: { botol: 16_000, cap: 0, aksesoris: 3_000 },
      freight: { aktif: true, pcsPerCBM: 1778, ratePerCBM: 7_000_000 },
    },
  ],
});
