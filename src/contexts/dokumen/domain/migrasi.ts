/**
 * Membaca dokumen dari mana pun ia datang — Supabase, localStorage, atau berkas
 * JSON yang di-import — dan mengembalikannya dalam bentuk yang sekarang.
 *
 * ## Ini bukan pekerjaan kosmetik
 *
 * Baris Supabase `sos-unit-economics` yang dipakai tim hari ini berisi payload
 * bentuk LAMA: `base.kurs`, `bottles.small.dims.l`, `smallSuppliers`,
 * `projection.priceSmall`. Kalau berkas ini salah, yang hilang bukan tampilan —
 * yang hilang seluruh angka penawaran supplier yang sudah dikumpulkan.
 *
 * Karena itu `bacaDokumen()` **tidak pernah melempar**. Payload yang tidak
 * dikenali menghasilkan dokumen awal, bukan layar kosong dengan stack trace.
 *
 * ## Dua jebakan yang sudah pernah menggigit, dan keduanya diam
 *
 * **1. `Object.assign` itu dangkal.** Builder lama memuat dokumen dengan
 * `Object.assign(defaultState(), payload)`. Objek bersarang diganti UTUH, bukan
 * digabung — jadi payload lama yang tidak punya `base.mix` membuat seluruh
 * `mix` hilang, bukan terisi default. Itu sebabnya di sana ada `normalizeBase()`
 * sepanjang dua puluh baris `if (… === undefined)` yang harus ditambah setiap
 * kali ada field baru, dan yang lupa ditambah tidak menghasilkan error apa pun —
 * cuma `NaN` di satu kolom.
 *
 * **2. Id yang bentrok merusak data lintas kolom.** Supplier dan skenario
 * mendapat id dari pencacah yang mulai dari 100 setiap kali halaman dimuat,
 * sementara id yang tersimpan bisa sudah melewati 100. Dua entitas ber-id sama
 * berarti menyunting yang satu menulis ke yang lain. `perbaikiIdGanda()` di
 * bawah menambal payload yang sudah terlanjur rusak, dan `idBerikutnya()`
 * mencegahnya terulang dengan mulai dari id tertinggi yang ADA.
 */
import type { Dimensi } from "@/contexts/asumsi/domain/kemasan";
import type { Varian } from "@/contexts/fragrance/domain/varian";
import type { MataUang, Supplier } from "@/contexts/supplier/domain/supplier";
import type { KomponenCustom, Skenario } from "@/contexts/unit-economics/domain/skenario";
import type { Dokumen } from "./dokumen";
import { dokumenAwal } from "./dokumen";

type Rekaman = Record<string, unknown>;

const objek = (v: unknown): Rekaman => (v && typeof v === "object" ? (v as Rekaman) : {});
const larik = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/**
 * Angka dari payload apa pun, dengan default kalau tidak masuk akal.
 *
 * JSON yang lewat export/import bisa membawa `null`, string, atau `NaN`
 * ter-serialisasi jadi `null`. Membiarkannya lewat berarti satu `NaN` menjalar
 * ke seluruh kolom yang menyentuhnya, dan `NaN` tidak berhenti di satu sel — ia
 * merambat sampai ke total.
 */
function num(v: unknown, bawaan: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return bawaan;
}

const teks = (v: unknown, bawaan: string): string =>
  typeof v === "string" && v.trim() !== "" ? v : bawaan;

const boolean = (v: unknown, bawaan: boolean): boolean =>
  typeof v === "boolean" ? v : bawaan;

/**
 * Angka yang boleh `null`, dan `null`-nya BERARTI sesuatu.
 *
 * Dipakai `pembelian`, di mana `null` = "ikuti kapasitas cairan" dan `0` =
 * "tidak memesan botol sama sekali". Memakai `num(v, 0)` di sana akan melebur
 * keduanya, dan dokumen yang belum pernah menyentuh field ini akan terbaca
 * sebagai keputusan untuk tidak berproduksi — nol botol, COGS tak hingga.
 */
function numOpsional(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/* ═════════════════════════════════════════════════════════════════ id ══ */

/**
 * Id berikutnya, dihitung dari id TERTINGGI yang sudah ada — bukan dari
 * pencacah yang mulai ulang di 100 tiap muat halaman.
 */
export function idBerikutnya(dok: Dokumen): number {
  let maks = 99;
  for (const id of [
    ...dok.supplierKecil.map((s) => s.id),
    ...dok.supplierBesar.map((s) => s.id),
    ...dok.skenario.map((s) => s.id),
  ]) {
    const m = /(\d+)$/.exec(id ?? "");
    if (m) maks = Math.max(maks, Number(m[1]));
  }
  return maks + 1;
}

/**
 * Beri id baru pada entitas yang id-nya bentrok, dan ikut memindahkan pilihan
 * supplier kalau yang diganti kebetulan yang sedang dipakai.
 *
 * Memindahkan `pilihan` itu yang mudah terlewat: tanpa itu, memperbaiki id
 * ganda membuat supplier terpilih menunjuk id yang sudah tidak ada, dan halaman
 * diam-diam jatuh ke supplier pertama — dengan angka penawaran yang berbeda.
 */
function perbaikiIdGanda(dok: Dokumen): Dokumen {
  let counter = idBerikutnya(dok);
  const terlihat = new Set<string>();
  const pilihan = { ...dok.pilihan };

  const bersihkan = <T extends { id: string }>(daftar: T[], awalan: string): T[] =>
    daftar.map((item) => {
      if (!item.id || terlihat.has(item.id)) {
        const idLama = item.id;
        const idBaru = awalan + counter++;
        if (pilihan.kecilId === idLama) pilihan.kecilId = idBaru;
        if (pilihan.besarId === idLama) pilihan.besarId = idBaru;
        terlihat.add(idBaru);
        return { ...item, id: idBaru };
      }
      terlihat.add(item.id);
      return item;
    });

  return {
    ...dok,
    supplierKecil: bersihkan(dok.supplierKecil, "s"),
    supplierBesar: bersihkan(dok.supplierBesar, "l"),
    skenario: bersihkan(dok.skenario, "sc"),
    pilihan,
  };
}

/* ═══════════════════════════════════════════════════════ bentuk lama ══ */

const dimensiDari = (v: unknown, bawaan: Dimensi): Dimensi => {
  const d = objek(v);
  /* Bentuk lama memakai l/w/h (length/width/height); yang sekarang memakai
     panjang/lebar/tinggi. Keduanya diterima supaya berkas JSON yang sudah
     terlanjur di-export tim tetap bisa di-import. */
  return {
    panjang: num(d.panjang ?? d.l, bawaan.panjang),
    lebar: num(d.lebar ?? d.w, bawaan.lebar),
    tinggi: num(d.tinggi ?? d.t ?? d.h, bawaan.tinggi),
  };
};

const supplierDari = (v: unknown, awalan: string, urut: number, kursBawaan: number): Supplier => {
  const s = objek(v);
  const molding = objek(s.molding);
  const satuan = objek(s.satuan ?? s.unit);
  const freight = objek(s.freight);
  const mataUang: MataUang = (s.mataUang ?? s.currency) === "USD" ? "USD" : "IDR";
  return {
    id: teks(s.id, awalan + urut),
    nama: teks(s.nama ?? s.name, "Supplier"),
    mataUang,
    moq: num(s.moq, 0),
    molding: {
      botol: num(molding.botol, 0),
      cap: num(molding.cap, 0),
      silikon: num(molding.silikon ?? molding.silicon, 0),
    },
    satuan: {
      botol: num(satuan.botol, 0),
      cap: num(satuan.cap, 0),
      aksesoris: num(satuan.aksesoris, 0),
    },
    freight: {
      aktif: boolean(freight.aktif ?? freight.enabled, true),
      pcsPerCBM: num(freight.pcsPerCBM, 1),
      ratePerCBM: num(freight.ratePerCBM, kursBawaan),
    },
  };
};

const komponenCustomDari = (v: unknown, urut: number): KomponenCustom => {
  const c = objek(v);
  return {
    id: teks(c.id, "cust" + urut),
    label: teks(c.label ?? c.nama, ""),
    nilai: num(c.nilai ?? c.value, 0),
  };
};

const skenarioDari = (v: unknown, urut: number): Skenario => {
  const s = objek(v);
  return {
    id: teks(s.id, "sc" + urut),
    nama: teks(s.nama ?? s.name, "Skenario"),
    ukuran: (s.ukuran ?? s.sizeKey) === "large" || (s.ukuran ?? s.sizeKey) === "besar"
      ? "besar"
      : "kecil",
    harga: num(s.harga ?? s.price, 0),
    /* Payload lama tidak pernah menyimpan tiga ini — dulu baris otomatis,
       dihitung ulang, tidak pernah tersimpan di skenario. Default 0 wajar:
       skenario lama tidak pernah membawa angka ini sama sekali. */
    fragrance: num(s.fragrance, 0),
    botol: num(s.botol, 0),
    aksesoris: num(s.aksesoris, 0),
    oem: num(s.oem, 0),
    box: num(s.box, 0),
    fulfillment: num(s.fulfillment ?? s.fulfill, 0),
    custom: larik(s.custom).map((c, i) => komponenCustomDari(c, i + 1)),
  };
};

const varianDari = (v: unknown): Varian => {
  const f = objek(v);
  return {
    nama: teks(f.nama ?? f.name, "Varian"),
    usdPerLiter: num(f.usdPerLiter, 0),
    qtyLiter: num(f.qtyLiter, 0),
  };
};

/**
 * Payload bentuk v0 (builder HTML) → dokumen sekarang.
 *
 * Dikenali dari adanya kunci `base`. Tiap field dibaca satu per satu dengan
 * default — bukan disebar dengan spread — supaya field yang hilang terisi dan
 * field asing tidak ikut masuk.
 */
function dariV0(payload: Rekaman): Dokumen {
  const awal = dokumenAwal();
  const base = objek(payload.base);
  const mix = objek(base.mix);
  const legal = objek(base.legalPerVarian);
  const bottles = objek(payload.bottles);
  const selection = objek(payload.selection);
  const projection = objek(payload.projection);
  const marketing = objek(payload.marketing);
  const options = objek(payload.options);

  const kurs = num(base.kurs, awal.asumsi.kurs);
  const freightPerCBM = num(base.freightPerCBM, awal.asumsi.freightPerCBM);

  /* `oemCost` tunggal adalah bentuk yang lebih tua lagi: satu biaya OEM untuk
     kedua ukuran. Nilainya disalin ke dua-duanya — bukan dibiarkan default —
     karena angka yang pernah diisi tim lebih benar daripada angka contoh. */
  const oemLama = base.oemCost;

  const varianList = larik(base.fragrances).map(varianDari);
  const supKecil = larik(payload.smallSuppliers).map((s, i) => supplierDari(s, "s", i + 1, freightPerCBM));
  const supBesar = larik(payload.largeSuppliers).map((s, i) => supplierDari(s, "l", i + 1, freightPerCBM));

  return {
    versi: 1,
    asumsi: {
      kurs,
      freightPerCBM,
      packingEfficiency: num(base.packingEfficiency, awal.asumsi.packingEfficiency),
      oemKecil: num(base.oemCostSmall ?? oemLama, awal.asumsi.oemKecil),
      oemBesar: num(base.oemCostLarge ?? oemLama, awal.asumsi.oemBesar),
      wastePct: num(base.wastePct, awal.asumsi.wastePct),
      ppnPct: num(base.ppnPct, awal.asumsi.ppnPct),
      perizinanPct: num(base.perizinanPct, awal.asumsi.perizinanPct),
      boxPackaging: num(base.boxPackaging, awal.asumsi.boxPackaging),
      boxAksesoris: num(base.boxAksesoris, awal.asumsi.boxAksesoris),
      fulfillment: num(base.fulfillmentCost, awal.asumsi.fulfillment),
      /* Payload v0 tidak pernah punya field ini — botol kecil dulu konstanta,
         bukan asumsi tersimpan. `num()` jatuh ke default 15 mL. */
      mlBotolKecil: num(base.smallSizeML, awal.asumsi.mlBotolKecil),
      mlBotolBesar: num(base.largeSizeML, awal.asumsi.mlBotolBesar),
    },
    campuran: {
      fragrancePct: num(mix.fragrancePct, awal.campuran.fragrancePct),
      susutPct: num(mix.shrinkagePct, awal.campuran.susutPct),
      alokasiBesarPct: num(mix.splitLargePct, awal.campuran.alokasiBesarPct),
    },
    legalPerVarian: {
      bpom: num(legal.bpom, awal.legalPerVarian.bpom),
      halal: num(legal.halal, awal.legalPerVarian.halal),
    },
    varian: varianList.length > 0 ? varianList : awal.varian,
    dimensi: {
      kecil: dimensiDari(objek(bottles.small).dims, awal.dimensi.kecil),
      besar: dimensiDari(objek(bottles.large).dims, awal.dimensi.besar),
    },
    supplierKecil: supKecil.length > 0 ? supKecil : awal.supplierKecil,
    supplierBesar: supBesar.length > 0 ? supBesar : awal.supplierBesar,
    pilihan: {
      kecilId: teks(selection.smallId, awal.pilihan.kecilId),
      besarId: teks(selection.largeId, awal.pilihan.besarId),
    },
    /* Bentuk v0 tidak punya konsep pembelian terpisah — di sana qty botol SELALU
       mengikuti kapasitas cairan. `null` mempertahankan perilaku itu persis. */
    pembelian: { kecil: null, besar: null },
    harga: {
      kecil: num(projection.priceSmall, awal.harga.kecil),
      besar: num(projection.priceLarge, awal.harga.besar),
    },
    marketing: {
      offline: num(marketing.offline, awal.marketing.offline),
      online: num(marketing.online, awal.marketing.online),
      lainnya: num(marketing.others, awal.marketing.lainnya),
    },
    opsi: { amortisasiMolding: boolean(options.amortize, false) },
    skenario: larik(payload.ueScenarios).map(skenarioDari),
    /* Payload v0 tidak pernah punya fitur ini sama sekali — jatuh ke array
       kosong lewat `larik()`. */
    investasiCustom: larik(payload.investasiCustom).map((c, i) => komponenCustomDari(c, i + 1)),
  };
}

/** Payload bentuk sekarang → dokumen, dengan tiap field diperiksa. */
function dariV1(payload: Rekaman): Dokumen {
  const awal = dokumenAwal();
  const asumsi = objek(payload.asumsi);
  const campuran = objek(payload.campuran);
  const legal = objek(payload.legalPerVarian);
  const dimensi = objek(payload.dimensi);
  const pilihan = objek(payload.pilihan);
  const pembelian = objek(payload.pembelian);
  const harga = objek(payload.harga);
  const marketing = objek(payload.marketing);
  const opsi = objek(payload.opsi);

  const kurs = num(asumsi.kurs, awal.asumsi.kurs);
  const freightPerCBM = num(asumsi.freightPerCBM, awal.asumsi.freightPerCBM);
  const varianList = larik(payload.varian).map(varianDari);
  const supKecil = larik(payload.supplierKecil).map((s, i) => supplierDari(s, "s", i + 1, freightPerCBM));
  const supBesar = larik(payload.supplierBesar).map((s, i) => supplierDari(s, "l", i + 1, freightPerCBM));

  return {
    versi: 1,
    asumsi: {
      kurs,
      freightPerCBM,
      packingEfficiency: num(asumsi.packingEfficiency, awal.asumsi.packingEfficiency),
      oemKecil: num(asumsi.oemKecil, awal.asumsi.oemKecil),
      oemBesar: num(asumsi.oemBesar, awal.asumsi.oemBesar),
      wastePct: num(asumsi.wastePct, awal.asumsi.wastePct),
      ppnPct: num(asumsi.ppnPct, awal.asumsi.ppnPct),
      perizinanPct: num(asumsi.perizinanPct, awal.asumsi.perizinanPct),
      boxPackaging: num(asumsi.boxPackaging, awal.asumsi.boxPackaging),
      boxAksesoris: num(asumsi.boxAksesoris, awal.asumsi.boxAksesoris),
      fulfillment: num(asumsi.fulfillment, awal.asumsi.fulfillment),
      mlBotolKecil: num(asumsi.mlBotolKecil, awal.asumsi.mlBotolKecil),
      mlBotolBesar: num(asumsi.mlBotolBesar, awal.asumsi.mlBotolBesar),
    },
    campuran: {
      fragrancePct: num(campuran.fragrancePct, awal.campuran.fragrancePct),
      susutPct: num(campuran.susutPct, awal.campuran.susutPct),
      alokasiBesarPct: num(campuran.alokasiBesarPct, awal.campuran.alokasiBesarPct),
    },
    legalPerVarian: {
      bpom: num(legal.bpom, awal.legalPerVarian.bpom),
      halal: num(legal.halal, awal.legalPerVarian.halal),
    },
    varian: varianList.length > 0 ? varianList : awal.varian,
    dimensi: {
      kecil: dimensiDari(dimensi.kecil, awal.dimensi.kecil),
      besar: dimensiDari(dimensi.besar, awal.dimensi.besar),
    },
    supplierKecil: supKecil.length > 0 ? supKecil : awal.supplierKecil,
    supplierBesar: supBesar.length > 0 ? supBesar : awal.supplierBesar,
    pilihan: {
      kecilId: teks(pilihan.kecilId, awal.pilihan.kecilId),
      besarId: teks(pilihan.besarId, awal.pilihan.besarId),
    },
    pembelian: {
      kecil: numOpsional(pembelian.kecil),
      besar: numOpsional(pembelian.besar),
    },
    harga: {
      kecil: num(harga.kecil, awal.harga.kecil),
      besar: num(harga.besar, awal.harga.besar),
    },
    marketing: {
      offline: num(marketing.offline, awal.marketing.offline),
      online: num(marketing.online, awal.marketing.online),
      lainnya: num(marketing.lainnya, awal.marketing.lainnya),
    },
    opsi: { amortisasiMolding: boolean(opsi.amortisasiMolding, false) },
    skenario: larik(payload.skenario).map(skenarioDari),
    investasiCustom: larik(payload.investasiCustom).map((c, i) => komponenCustomDari(c, i + 1)),
  };
}

/**
 * Satu-satunya pintu masuk dokumen dari luar aplikasi.
 *
 * Tidak pernah melempar. Payload yang tidak dikenali → dokumen awal, karena
 * layar berisi angka contoh masih bisa dipakai sementara, sedangkan layar putih
 * dengan stack trace tidak bisa dipakai siapa pun.
 */
export function bacaDokumen(payload: unknown): Dokumen {
  const p = objek(payload);
  if (Object.keys(p).length === 0) return dokumenAwal();
  const dok = p.base !== undefined && p.asumsi === undefined ? dariV0(p) : dariV1(p);
  return pastikanPilihanSahih(perbaikiIdGanda(dok));
}

/**
 * Supplier terpilih harus benar-benar ada.
 *
 * Kalau supplier yang dipakai Initial Investment dihapus di sesi lain, id-nya
 * tetap tersimpan dan halaman akan diam-diam jatuh ke supplier pertama — dengan
 * angka penawaran yang berbeda, tanpa satu pun tanda di layar. Diselesaikan di
 * sini, sekali, alih-alih di tiap pemanggil.
 */
function pastikanPilihanSahih(dok: Dokumen): Dokumen {
  const adaKecil = dok.supplierKecil.some((s) => s.id === dok.pilihan.kecilId);
  const adaBesar = dok.supplierBesar.some((s) => s.id === dok.pilihan.besarId);
  if (adaKecil && adaBesar) return dok;
  return {
    ...dok,
    pilihan: {
      kecilId: adaKecil ? dok.pilihan.kecilId : (dok.supplierKecil[0]?.id ?? ""),
      besarId: adaBesar ? dok.pilihan.besarId : (dok.supplierBesar[0]?.id ?? ""),
    },
  };
}
