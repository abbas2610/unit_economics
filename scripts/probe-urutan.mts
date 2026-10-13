/**
 * probe-urutan.mts — `node --import ./scripts/ts-register.mjs scripts/probe-urutan.mts`
 *
 * Menjaga `pindahkan()` di `src/bersama/urutan.ts`, satu-satunya jalan urutan
 * kartu supplier/packaging berubah. Urutannya TERSIMPAN di dokumen tim dan
 * menentukan urutan kolom tabel perbandingan, jadi elemen yang hilang atau
 * terduplikasi di sini bukan soal tampilan: supplier sungguhan lenyap dari
 * dokumen bersama begitu disimpan, tanpa satu pun error.
 */
import { pindahkan } from "@/bersama/urutan";

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

const daftar = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }] as const;
const ids = (x: readonly { id: string }[]) => x.map((e) => e.id).join("");

console.log("\n=== 1. Memindah ke posisi yang diminta ===");
cek("turun: a → indeks 2", ids(pindahkan(daftar, "a", 2)) === "bcad", ids(pindahkan(daftar, "a", 2)));
cek("naik: d → indeks 0", ids(pindahkan(daftar, "d", 0)) === "dabc", ids(pindahkan(daftar, "d", 0)));
cek("ke ujung bawah", ids(pindahkan(daftar, "b", 3)) === "acdb", ids(pindahkan(daftar, "b", 3)));
cek("ke posisinya sendiri = tidak berubah", ids(pindahkan(daftar, "c", 2)) === "abcd");

console.log("\n=== 2. Tidak pernah kehilangan atau menggandakan elemen ===");
{
  /* Seluruh kombinasi (id × tujuan, termasuk di luar batas): himpunan id-nya
     harus tetap persis empat id yang sama. Ini yang melindungi data tim —
     bukan urutan yang benar, tapi tidak ada supplier yang lenyap. */
  let rusak = "";
  for (const { id } of daftar) {
    for (const ke of [-5, -1, 0, 1, 2, 3, 4, 99, 1.7, Number.NaN]) {
      const hasil = pindahkan(daftar, id, ke);
      if (hasil.length !== 4 || new Set(hasil.map((e) => e.id)).size !== 4) rusak = `${id}→${ke}: ${ids(hasil)}`;
    }
  }
  cek("4 elemen unik di setiap kombinasi", rusak === "", rusak);
}

console.log("\n=== 3. Batas dan masukan aneh ===");
cek("indeks negatif dijepit ke paling atas", ids(pindahkan(daftar, "c", -3)) === "cabd");
cek("indeks kebesaran dijepit ke paling bawah", ids(pindahkan(daftar, "a", 99)) === "bcda");
cek("NaN tidak menggeser apa pun", ids(pindahkan(daftar, "b", Number.NaN)) === "abcd");
cek("id yang tidak ada → salinan utuh", ids(pindahkan(daftar, "zzz", 0)) === "abcd");
cek("larik kosong aman", pindahkan([], "a", 0).length === 0);

console.log("\n=== 4. Larik asal tidak diubah ===");
{
  const asal = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const hasil = pindahkan(asal, "a", 2);
  cek("asal tetap abc", ids(asal) === "abc", ids(asal));
  cek("hasil adalah larik baru", hasil !== asal);
}

console.log("\n--- kontrol negatif ---");
/* Pemeriksa "tidak kehilangan elemen" di bagian 2 harus menyala untuk
   implementasi yang memang kehilangan elemen. Diuji ke implementasi rusak
   yang lupa menyisipkan kembali elemen yang dipindah. */
{
  const rusak = <T extends { id: string }>(d: readonly T[], id: string) => d.filter((e) => e.id !== id);
  const hasil = rusak(daftar, "b");
  kontrol(
    "[kontrol negatif] pemeriksa menangkap elemen yang hilang",
    hasil.length === 4 && new Set(hasil.map((e) => e.id)).size === 4,
  );
}
kontrol("[kontrol negatif] pemeriksa urutan membedakan urutan yang salah", ids(pindahkan(daftar, "a", 2)) === "abcd");

console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
