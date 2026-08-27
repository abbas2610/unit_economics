/**
 * Kredensial Supabase, dan satu-satunya tempat yang boleh membacanya.
 *
 * ## Kenapa ini tidak lagi ditulis di dalam kode
 *
 * Builder lama menaruh URL project dan anon key sebagai dua `const` di tengah
 * `<script>`, di berkas yang dikomit ke repo publik. Anon key memang dirancang
 * sampai ke browser dan bukan rahasia — yang menjaga datanya RLS, bukan
 * kerahasiaan kuncinya. Tapi menaruhnya di kode punya akibat lain yang nyata:
 * **memutar kunci berarti menyunting kode**, dan memakai project Supabase yang
 * berbeda untuk uji coba berarti mengubah berkas yang sama yang sedang dipakai
 * tim. Dua-duanya berakhir jadi commit yang tidak sengaja terkirim.
 *
 * ## ⚠️ Aplikasi ini export statis
 *
 * `NEXT_PUBLIC_*` DIBEKUKAN KE DALAM BUNDLE saat `npm run build`, bukan dibaca
 * saat halaman dibuka. Mengganti env di panel hosting tidak melakukan apa pun;
 * yang dibutuhkan build ulang dan deploy ulang. Lihat docs/INFRASTRUKTUR.md.
 *
 * ## Tanpa kredensial, aplikasi TETAP JALAN
 *
 * Seluruh perhitungan berjalan di browser dan tidak butuh jaringan. Yang hilang
 * cuma sinkronisasi tim; dokumennya tetap tersimpan di localStorage. Itu
 * disengaja — builder ini sering dibuka di ruang rapat dengan wifi yang tidak
 * bisa diandalkan, dan halaman yang menolak menghitung karena Supabase tidak
 * terjangkau tidak berguna bagi siapa pun.
 */

/**
 * ⚠️ `||`, BUKAN `??`, dan itu perbedaan yang sudah memerahkan CI sekali.
 *
 * `??` hanya jatuh ke default pada `null`/`undefined`. GitHub Actions meneruskan
 * repository variable yang belum diset sebagai **string kosong**, bukan
 * undefined — jadi `?? "sos-unit-economics"` TIDAK berlaku, dan id dokumennya
 * jadi `""`.
 *
 * Gejalanya tidak menunjuk ke sini sama sekali: aplikasi memuat dengan normal,
 * lalu tiap penyimpanan ditolak RLS dengan 401 karena `'' <> 'sos-unit-economics'`.
 * Yang terbaca di layar cuma status "Gagal sync".
 */
const tidakKosong = (v: string | undefined, bawaan: string) => (v && v.trim()) || bawaan;

const URL_SUPABASE = tidakKosong(process.env.NEXT_PUBLIC_SUPABASE_URL, "");
const ANON_KEY = tidakKosong(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "");

/**
 * Id dokumen bersama. Satu tim, satu baris.
 *
 * Bisa diganti lewat env untuk memisahkan ruang kerja — mis. simulasi yang tidak
 * boleh menimpa angka tim. Nilainya ikut dibekukan saat build.
 *
 * ⚠️ Terikat ke kebijakan RLS, yang menyebut id-nya secara harfiah. Mengganti
 * yang satu tanpa yang lain mematikan sinkronisasi tanpa satu pun error — lihat
 * supabase/migrations/0001_awal.sql.
 */
export const ID_DOKUMEN = tidakKosong(process.env.NEXT_PUBLIC_DOKUMEN_ID, "sos-unit-economics");

export const kredensialSupabase = (): { url: string; anonKey: string } | null =>
  URL_SUPABASE && ANON_KEY ? { url: URL_SUPABASE, anonKey: ANON_KEY } : null;

/** Apakah sinkronisasi tim bisa dinyalakan sama sekali. */
export const awanTersedia = (): boolean => kredensialSupabase() !== null;
