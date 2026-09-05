/**
 * Formatter Unit Economics.
 *
 * Semuanya sengaja TIDAK memakai `Intl`, dan alasannya berlaku bahkan di
 * aplikasi export statis seperti ini: halaman tetap dirender sekali di Node saat
 * `next build`, lalu di-hydrate browser. Kalau data ICU kedua runtime berbeda —
 * dan itu berbeda; Node build "small-icu" hanya membawa en-US — hasil
 * `toLocaleString("id-ID")` di HTML hasil build tidak sama dengan yang dihitung
 * ulang browser, dan React melempar hydration mismatch.
 *
 * Builder lama memakai `toLocaleString("id-ID")` di 60+ tempat dan lolos karena
 * ia tidak punya tahap render server sama sekali. Begitu halaman yang sama
 * dipindah ke Next, jaminan itu hilang tanpa satu baris pun berubah tampilannya.
 *
 * ⚠️ Aturan yang tidak boleh dilanggar: **setiap angka yang punya ARAH keluar
 * dari sini sudah bertanda.** Lihat `delta()` dan `persenDelta()`. Warna hijau
 * dan merah adalah lapisan kedua, bukan pertama — sekitar 8% laki-laki tidak
 * bisa memisahkan keduanya, dan margin negatif yang ditandai hanya dengan warna
 * tidak jadi "kurang jelas" bagi mereka, ia hilang.
 *
 * Dijaga `npm run probe:format`, dengan kontrol negatif.
 */

/** Sisipkan titik ribuan ke deret digit. Dipakai seluruh formatter di bawah. */
function ribuan(digit: string): string {
  let out = "";
  for (let i = 0; i < digit.length; i++) {
    if (i > 0 && (digit.length - i) % 3 === 0) out += ".";
    out += digit[i];
  }
  return out;
}

/** `10000000` → `Rp10.000.000`. Tanpa spasi setelah Rp, tanpa desimal. */
export function rupiah(nilai: number): string {
  const bulat = Math.round(Math.abs(nilai || 0));
  return (nilai < 0 ? "-Rp" : "Rp") + ribuan(String(bulat));
}

/** `4574150` → `4.574.150`. Sama seperti `rupiah()` tapi tanpa prefiks. */
export function angka(nilai: number): string {
  const bulat = Math.round(Math.abs(nilai || 0));
  return (nilai < 0 ? "-" : "") + ribuan(String(bulat));
}

/**
 * Angka dengan desimal tetap, koma sebagai pemisah desimal.
 *
 * `1234.5678, 4` → `1.234,5678`. Dasar dari `persen()` dan `liter()`.
 */
export function desimal(nilai: number, digit: number): string {
  const n = nilai || 0;
  const faktor = 10 ** digit;
  const bulat = Math.round(Math.abs(n) * faktor);
  const utuh = Math.floor(bulat / faktor);
  const pecahan = bulat % faktor;
  const tanda = n < 0 ? "-" : "";
  if (digit === 0) return tanda + ribuan(String(utuh));
  return tanda + ribuan(String(utuh)) + "," + String(pecahan).padStart(digit, "0");
}

/** Buang nol di belakang koma: `10,0000` → `10`, `2,350` → `2,35`. */
function rapikan(s: string): string {
  if (!s.includes(",")) return s;
  return s.replace(/,?0+$/, "");
}

/**
 * `1.5` → `1,5%`, `3` → `3%`, `12.34` → `12,34%`.
 *
 * TANPA tanda arah — dipakai untuk besaran yang tidak punya arah (komposisi,
 * alokasi volume, PPN, waste). Untuk margin dan selisih pakai `persenDelta()`.
 */
export function persen(nilai: number, digit = 1): string {
  return rapikan(desimal(nilai, digit)) + "%";
}

/**
 * Volume dalam liter: `1234.5` → `1.234,5 L`.
 *
 * Satu desimal, dan itu batas bawah yang berarti: batch 75 L yang dibulatkan
 * jadi "75 L" padahal 75,4 L menyembunyikan ±26 botol kecil dari estimasi hasil
 * produksi — dan estimasi itulah yang jadi qty batch di Initial Investment.
 */
export function liter(nilai: number, digit = 1): string {
  return rapikan(desimal(nilai, digit)) + " L";
}

/** `2125` → `2.125 pcs`. Dipakai qty batch, MOQ, dan target penjualan. */
export function pcs(nilai: number): string {
  return angka(nilai) + " pcs";
}

/**
 * Harga dalam USD: `2.4` → `$2,40`.
 *
 * Dua desimal SELALU, tidak dirapikan. Harga fragrance oil bergerak di rentang
 * $2,40–$2,60 per liter; `$2,4` dan `$2,40` sama nilainya tapi kolom yang
 * panjang digitnya berubah-ubah tidak bisa dibandingkan sekilas.
 */
export function usd(nilai: number): string {
  const n = nilai || 0;
  return (n < 0 ? "-$" : "$") + desimal(Math.abs(n), 2);
}

/**
 * Rupiah BERTANDA: `+Rp1.250.000`, `−Rp340.000`, `Rp0`.
 *
 * Nol tidak diberi tanda — `+Rp0` menyiratkan untung yang tidak ada. Minusnya
 * memakai MINUS SIGN `−` (U+2212), bukan hyphen: di font tabular hyphen
 * setinggi setengah digit dan mudah terbaca sebagai coretan.
 */
export function delta(nilai: number): string {
  const bulat = Math.round(nilai || 0);
  if (bulat === 0) return "Rp0";
  return (bulat > 0 ? "+" : "−") + "Rp" + ribuan(String(Math.abs(bulat)));
}

/** Persentase BERTANDA: `+12,4%`, `−3,1%`, `0%`. Pasangan `delta()`. */
export function persenDelta(nilai: number, digit = 1): string {
  const bersih = rapikan(desimal(Math.abs(nilai || 0), digit));
  if (bersih === "0") return "0%";
  return ((nilai || 0) > 0 ? "+" : "−") + bersih + "%";
}

/**
 * Selisih jumlah pcs, BERTANDA: `+1.234 pcs`, `−450 pcs`, `0 pcs`.
 *
 * Ada karena satu tabel di analisis sensitivitas membandingkan break-even, dan
 * break-even dihitung dalam PCS. Memakai `delta()` di sana menulis `+Rp1.234`
 * untuk selisih seribu dua ratus botol — angka yang benar dengan satuan yang
 * berbohong, dan satuan yang berbohong tidak menghasilkan satu pun error.
 */
export function pcsDelta(nilai: number): string {
  const bulat = Math.round(nilai || 0);
  if (bulat === 0) return "0 pcs";
  return (bulat > 0 ? "+" : "−") + ribuan(String(Math.abs(bulat))) + " pcs";
}

/**
 * Selisih dalam POIN persentase, bukan persen dari persen.
 *
 * Gross margin naik dari 40% ke 44% adalah `+4 poin`, bukan `+10%`. Keduanya
 * benar dan menjawab pertanyaan berbeda; menulisnya `%` membuat pembaca yang
 * mengira yang satu memilih keputusan berdasarkan yang lain. Analisis
 * sensitivitas di tab 6 memakai ini untuk seluruh kolom Δ Gross Margin.
 */
export function poinDelta(nilai: number, digit = 1): string {
  const bersih = rapikan(desimal(Math.abs(nilai || 0), digit));
  if (bersih === "0") return "0 poin";
  return ((nilai || 0) > 0 ? "+" : "−") + bersih + " poin";
}

/**
 * Arah sebuah nilai — dipakai memilih token warna, SETELAH tandanya tertulis.
 *
 * Dikembalikan sebagai kata, bukan boolean, karena `datar` bukan "tidak naik":
 * skenario yang tidak menggeser margin sama sekali tidak boleh terbaca sebagai
 * kerugian.
 */
export type Arah = "naik" | "turun" | "datar";
export const arah = (nilai: number): Arah =>
  nilai > 0 ? "naik" : nilai < 0 ? "turun" : "datar";

/**
 * Arah TERBALIK — untuk besaran yang naiknya buruk.
 *
 * Total investasi yang naik 10% bukan kabar baik, dan mewarnainya hijau karena
 * angkanya positif adalah cara tercepat membuat orang salah baca tabel
 * sensitivitas. Dipakai kolom Δ Total Investasi.
 */
export const arahBiaya = (nilai: number): Arah =>
  nilai > 0 ? "turun" : nilai < 0 ? "naik" : "datar";

/** `2600000000` → `Rp2,60 M`. Untuk label ringkas di tengah donat komposisi. */
export function rupiahRingkas(nilai: number): string {
  const n = nilai || 0;
  const abs = Math.abs(n);
  const tanda = n < 0 ? "-" : "";
  if (abs >= 1e9) return tanda + "Rp" + desimal(abs / 1e9, 2) + " M";
  if (abs >= 1e6) return tanda + "Rp" + rapikan(desimal(abs / 1e6, 1)) + " jt";
  return rupiah(n);
}

const BULAN = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];
const dua = (n: number) => String(n).padStart(2, "0");

/**
 * Stempel ISO → `"6 Sep 2026, 21:05 WIB"`, TANPA `Intl`/`toLocaleString` —
 * lihat catatan di puncak berkas ini. Offset WIB (+7 jam) dijumlahkan manual
 * lalu dibaca lewat getter UTC, supaya hasilnya sama persis di mana pun
 * viewer berada — bukan cuma menghindari Node vs browser, tapi juga browser
 * yang jam sistemnya sendiri diset ke zona waktu lain.
 */
export function waktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const w = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${w.getUTCDate()} ${BULAN[w.getUTCMonth()]} ${w.getUTCFullYear()}, ${dua(w.getUTCHours())}:${dua(w.getUTCMinutes())} WIB`;
}
