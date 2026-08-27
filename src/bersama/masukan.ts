/**
 * Baca-tulis angka di kotak isian, dalam konvensi Indonesia.
 *
 * Terpisah dari `format.ts` dengan sengaja: yang di sana untuk DIBACA manusia,
 * yang di sini untuk BOLAK-BALIK antara string di `<input>` dan `number` di
 * dokumen. Keduanya kelihatan mirip dan kalau digabung akan saling menarik ke
 * arah yang berlawanan — formatter tampilan ingin merapikan, parser masukan
 * harus menerima apa adanya.
 *
 * ## Kenapa `<input type="text">`, bukan `type="number"`
 *
 * Builder lama sudah memilih ini dan pilihannya benar. `type="number"` menolak
 * titik ribuan, jadi `Rp7.000.000` harus diketik `7000000` — dan angka sebesar
 * itu tanpa pemisah adalah undangan salah ketik satu digit yang menggeser
 * seluruh initial investment sepuluh kali lipat tanpa satu peringatan pun.
 * `inputMode="decimal"` tetap memunculkan papan angka di ponsel.
 */

/**
 * `"7.000.000"` → `7000000`, `"2,45"` → `2.45`, `""` → `0`.
 *
 * ⚠️ Titik dibuang SEBELUM koma ditukar jadi titik desimal, dan urutan itu
 * tidak boleh dibalik: `"1.234,5"` yang diproses terbalik jadi `1.234.5`, yang
 * `parseFloat` baca sebagai `1.234` — salah seribu kali lipat, dan salahnya
 * berupa angka yang masih masuk akal di layar.
 */
export function bacaAngka(teks: string | number | null | undefined): number {
  if (typeof teks === "number") return Number.isFinite(teks) ? teks : 0;
  if (teks == null) return 0;
  const s = String(teks).trim();
  if (s === "") return 0;
  const n = parseFloat(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/**
 * `7000000, 0` → `"7.000.000"`, `2.4, 2` → `"2,4"`.
 *
 * Nilai yang ditulis kembali ke kotak isian setelah fokus lepas. Nol di
 * belakang koma dibuang supaya `2,40` yang belum disunting tidak terbaca
 * seperti nilai yang baru saja diubah.
 */
export function tulisAngka(nilai: number, digit = 0): string {
  const n = Number.isFinite(nilai) ? nilai : 0;
  const faktor = 10 ** digit;
  const bulat = Math.round(Math.abs(n) * faktor);
  const utuh = Math.floor(bulat / faktor);
  const pecahan = bulat % faktor;

  let out = "";
  const d = String(utuh);
  for (let i = 0; i < d.length; i++) {
    if (i > 0 && (d.length - i) % 3 === 0) out += ".";
    out += d[i];
  }
  if (digit > 0 && pecahan > 0) {
    out += "," + String(pecahan).padStart(digit, "0").replace(/0+$/, "");
  }
  return (n < 0 ? "-" : "") + out;
}

/**
 * Batasi nilai ke rentang. Dipakai persentase yang tidak boleh keluar 0–100.
 *
 * Bukan kosmetik: komposisi fragrance 0% membuat total campuran jadi pembagian
 * dengan nol, dan alokasi volume 120% menghasilkan estimasi hasil produksi yang
 * lebih besar daripada cairan yang ada.
 */
export const jepit = (nilai: number, min: number, maks: number): number =>
  Math.min(maks, Math.max(min, Number.isFinite(nilai) ? nilai : min));
