/**
 * probe-riwayat.mts — `npm run probe:riwayat`
 *
 * Menjaga dua hal yang lahir dari insiden: data supplier tim berubah jadi
 * nilai contoh tanpa satu pun jejak atau tanda di layar.
 *
 *   1. `diffDokumen()` (src/bersama/diff.ts) — dipakai halaman Riwayat untuk
 *      menjawab "apa yang berubah" antar snapshot. Kalau ia salah mencocokkan
 *      elemen array (index alih-alih id), menghapus baris PERTAMA dari daftar
 *      supplier akan terbaca sebagai "semua baris berubah" — persis kelas
 *      kesalahan yang membuat log riwayat tidak bisa dipercaya.
 *
 *   2. `deteksiAnomaliV1()` (src/contexts/dokumen/domain/migrasi.ts) — harus
 *      diam untuk dokumen v0 dan dokumen baru (supplier/varian kosong itu
 *      WAJAR di sana), dan bersuara untuk payload v1 yang array wajibnya
 *      kosong (itu seharusnya MUSTAHIL, dan diam-diam mengisi nilai contoh
 *      adalah mekanisme yang membuat data asli tertimpa tanpa jejak).
 */
import { diffDokumen } from "@/bersama/diff";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import { deteksiAnomaliV1 } from "@/contexts/dokumen/domain/migrasi";

let lulus = 0;
let gagal = 0;

const cek = (nama: string, kondisi: boolean, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const kontrol = (nama: string, kondisiSalah: boolean, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

/* ══════════════════════════════════════════════════ 1. diffDokumen ══ */
console.log("\n=== 1. diffDokumen mencocokkan array lewat id, bukan index ===");

{
  const awal = dokumenAwal();
  // dokumenAwal() punya dua supplier kecil: s1, s2. Hapus s1 saja.
  const setelahHapus = {
    ...awal,
    supplierKecil: awal.supplierKecil.filter((s) => s.id !== "s1"),
  };

  const diff = diffDokumen(awal, setelahHapus);
  const hapusS1 = diff.filter((d) => d.jenis === "hapus" && d.path === "supplierKecil[s1]");
  const ubahS2 = diff.filter((d) => d.path.startsWith("supplierKecil[s2]"));

  cek("menghapus s1 tercatat sebagai satu 'hapus'", hapusS1.length === 1, JSON.stringify(diff));
  cek("s2 yang TIDAK disentuh tidak ikut tercatat berubah", ubahS2.length === 0, JSON.stringify(ubahS2));

  /* Kontrol negatif: PEMBANDING NAIF berbasis index, tanpa pencocokan id —
     inilah tepatnya kesalahan yang harus DIHINDARI diffDokumen sungguhan.
     Kalau ini TIDAK salah, kontrolnya sendiri yang rusak. */
  const naif = (lama: unknown[], baru: unknown[]) =>
    lama.some((v, i) => JSON.stringify(v) !== JSON.stringify(baru[i]));
  const naifMendeteksiS2Berubah = naif(awal.supplierKecil, setelahHapus.supplierKecil);
  kontrol(
    "[kontrol negatif] pembanding berbasis index SALAH menganggap s2 berubah",
    !naifMendeteksiS2Berubah, // kalau naif TIDAK salah, sesuatu di setup probe ini rusak
  );
}

{
  const a = { x: 1, y: { z: 2 } };
  const b = { x: 1, y: { z: 3 } };
  const diff = diffDokumen(a, b);
  cek("nilai identik tidak menghasilkan diff apa pun", diffDokumen(a, a).length === 0);
  cek("perubahan bersarang tercatat dengan path lengkap", diff.length === 1 && diff[0].path === "y.z", JSON.stringify(diff));
  cek("dari/ke terbaca benar", diff[0]?.dari === 2 && diff[0]?.ke === 3);
}

{
  const diff = diffDokumen([1, 2], [1, 2, 3]);
  cek(
    "elemen tambahan di array tanpa id tercatat 'tambah'",
    diff.length === 1 && diff[0].jenis === "tambah" && diff[0].ke === 3,
    JSON.stringify(diff),
  );
}

/* ══════════════════════════════════════════════ 2. deteksiAnomaliV1 ══ */
console.log("\n=== 2. deteksiAnomaliV1 diam untuk yang wajar, bersuara untuk yang mustahil ===");

{
  const awal = dokumenAwal();
  cek("payload v1 lengkap → tidak ada peringatan", deteksiAnomaliV1(awal).length === 0);
  cek("dokumen benar-benar baru ({}) → tidak ada peringatan", deteksiAnomaliV1({}).length === 0);

  const v0 = { base: { kurs: 17000 } }; // tidak ada `fragrances`/`smallSuppliers` — wajar untuk v0
  cek("payload v0 tanpa varian/supplier → tidak ada peringatan", deteksiAnomaliV1(v0).length === 0);
}

{
  const awal = dokumenAwal();
  const rusakKecil = deteksiAnomaliV1({ ...awal, supplierKecil: [] });
  const rusakBesar = deteksiAnomaliV1({ ...awal, supplierBesar: undefined });
  const rusakVarian = deteksiAnomaliV1({ ...awal, varian: [] });

  cek("supplierKecil kosong pada payload v1 → 1 peringatan", rusakKecil.length === 1, JSON.stringify(rusakKecil));
  cek("supplierBesar hilang pada payload v1 → 1 peringatan", rusakBesar.length === 1, JSON.stringify(rusakBesar));
  cek("varian kosong pada payload v1 → 1 peringatan", rusakVarian.length === 1, JSON.stringify(rusakVarian));

  const rusakSemua = deteksiAnomaliV1({ ...awal, supplierKecil: [], supplierBesar: [], varian: [] });
  cek("ketiganya kosong sekaligus → 3 peringatan terpisah", rusakSemua.length === 3, JSON.stringify(rusakSemua));
}

kontrol(
  "[kontrol negatif] pemeriksa menyala kalau supplierKecil kosong TIDAK diperiksa",
  deteksiAnomaliV1({ ...dokumenAwal(), supplierKecil: [] }).length === 0, // salah kalau tetap 0
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
