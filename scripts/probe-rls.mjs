/**
 * probe-rls.mjs — `npm run probe:rls`
 *
 * Menembak project Supabase yang sungguhan dengan anon key yang sungguhan, lalu
 * menuntut RLS berperilaku seperti yang dijanjikan migrasi.
 *
 * ## Kenapa ini ada
 *
 * Karena "kebijakannya sudah dijalankan" dan "kebijakannya berlaku" adalah dua
 * klaim berbeda, dan repo ini sudah membayar mahal untuk mengetahuinya. Keadaan
 * yang pernah nyata di project ini:
 *
 *   - migrasi dijalankan → berhenti di error publikasi → blok RLS tidak pernah
 *     jalan, sementara pesan di layar cuma soal publikasi;
 *   - migrasi dijalankan lagi → `rls_menyala = true` dengan ENAM kebijakan, tiga
 *     peninggalan dashboard berpredikat `true`. Kebijakan bersifat OR, jadi RLS
 *     menyala dan meloloskan segalanya.
 *
 * Dua-duanya lolos dari pemeriksaan yang membaca katalog. Yang tidak bisa
 * dibohongi: benar-benar meminta datanya, dan benar-benar mencoba melanggarnya.
 *
 * ⚠️ Probe ini MENULIS ke project sungguhan — tepatnya, ia mencoba menulis dan
 * menuntut ditolak. Kalau RLS regresi dan tulisannya berhasil, ia membersihkan
 * jejaknya sendiri lalu GAGAL. Ia tidak pernah menyentuh dokumen tim: satu-satunya
 * id yang ditulis `probe-rls-jangan-dipakai`.
 *
 * ## Tanpa kredensial
 *
 * Di lokal ia melaporkan dirinya DILEWATI dan keluar dengan kode 0 — menuntut
 * `.env.local` ada akan membuat `npm run probe:data` merah bagi semua orang yang
 * cuma menyunting rumus biaya, dan probe yang merah tanpa sebab akan dimatikan.
 *
 * **Di CI ia WAJIB jalan.** Repository variables memang sudah wajib di sana (job
 * `bundel` menolak build tanpanya), jadi tidak ada alasan sah untuk melewatinya —
 * dan probe yang bisa melewati dirinya sendiri di CI tidak menjaga apa pun.
 */
import { readFileSync, existsSync } from "node:fs";

let lulus = 0;
let gagal = 0;
const cek = (nama, kondisi, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};

/* ── kredensial ───────────────────────────────────────────────────────────── */

/** `.env.local` dibaca manual — probe ini tidak lewat bundler Next. */
function dariEnvLocal(kunci) {
  if (!existsSync(".env.local")) return undefined;
  for (const baris of readFileSync(".env.local", "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(baris);
    if (m && m[1] === kunci) return m[2].replace(/^["']|["']$/g, "");
  }
  return undefined;
}
const env = (k) => process.env[k] || dariEnvLocal(k);

const URL_SUPABASE = env("NEXT_PUBLIC_SUPABASE_URL");
const ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const ID_DOKUMEN = env("NEXT_PUBLIC_DOKUMEN_ID") || "sos-unit-economics";

if (!URL_SUPABASE || !ANON) {
  if (process.env.CI) {
    console.error(
      "GAGAL  NEXT_PUBLIC_SUPABASE_URL / ANON_KEY tidak ada di CI.\n" +
        "       Di CI keduanya wajib — probe yang melewati dirinya sendiri tidak menjaga apa pun.\n" +
        "       Set repository variables-nya; caranya di docs/CI-CD.md.",
    );
    process.exit(1);
  }
  console.log(
    "DILEWATI  tanpa .env.local, probe ini TIDAK MENGUJI APA PUN.\n" +
      "          Salin .env.example jadi .env.local untuk menjalankannya.",
  );
  process.exit(0);
}

const kepala = { apikey: ANON, Authorization: `Bearer ${ANON}` };
const rest = (jalur, opsi = {}) =>
  fetch(`${URL_SUPABASE}/rest/v1/${jalur}`, { ...opsi, headers: { ...kepala, ...opsi.headers } });

/** Id yang dipakai mencoba melanggar. TIDAK PERNAH dokumen tim. */
const ID_NGAWUR = "probe-rls-jangan-dipakai";

console.log(`\nProject: ${URL_SUPABASE}`);
console.log(`Dokumen: ${ID_DOKUMEN}\n`);

/* ── 1. tim masih bisa memakai aplikasinya ────────────────────────────────── */
console.log("=== 1. RLS tidak mengunci tim dari datanya sendiri ===");

{
  const r = await rest(`unit_economics?id=eq.${ID_DOKUMEN}&select=id,updated_at`);
  const baris = r.ok ? await r.json() : [];
  cek(`dokumen bersama terbaca (HTTP ${r.status})`, r.ok && baris.length === 1, JSON.stringify(baris).slice(0, 120));

  /* Ini yang membedakan "RLS menyala" dari "aplikasi masih jalan". Kebijakan yang
     terlalu ketat tidak melempar error di aplikasi — ia mengembalikan nol baris,
     dan aplikasinya menyimpulkan dokumen bersama belum pernah dibuat lalu diam-diam
     memulai dari angka contoh. */
  cek(
    "…dan isinya bukan kosong",
    baris.length === 1 && typeof baris[0]?.updated_at === "string",
    baris[0]?.updated_at ?? "tidak ada updated_at",
  );
}

/* ── 2. penyempitan ke satu baris benar-benar berlaku ─────────────────────── */
console.log("\n=== 2. Kontrol negatif: baris lain tidak terjangkau ===");

{
  const r = await rest(`unit_economics?id=eq.${ID_NGAWUR}&select=id`);
  const baris = r.ok ? await r.json() : null;
  cek("membaca id lain mengembalikan nol baris", Array.isArray(baris) && baris.length === 0, JSON.stringify(baris));

  /* Membaca TANPA filter adalah uji yang lebih tajam: kalau ada kebijakan
     berpredikat `true` yang lolos, di sinilah ia terlihat sebagai baris tambahan. */
  const semua = await rest("unit_economics?select=id");
  const daftar = semua.ok ? await semua.json() : [];
  cek(
    "membaca tanpa filter hanya mengembalikan dokumen bersama",
    Array.isArray(daftar) && daftar.length === 1 && daftar[0]?.id === ID_DOKUMEN,
    `terlihat: ${JSON.stringify(daftar).slice(0, 160)}`,
  );
}

/* ── 3. menulis di luar batas ditolak ─────────────────────────────────────── */
console.log("\n=== 3. Kontrol negatif: menulis di luar batas ditolak ===");

{
  const r = await rest("unit_economics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: ID_NGAWUR, payload: {} }),
  });
  const ditolak = r.status === 401 || r.status === 403;
  cek(`menyisipkan baris ber-id lain ditolak (HTTP ${r.status})`, ditolak);

  /* ⚠️ Kalau ternyata TIDAK ditolak, RLS sudah regresi dan probe ini baru saja
     mengotori tabel produksi. Bersihkan jejaknya sebelum melaporkan gagal —
     probe yang meninggalkan sampah akan dimatikan orang lebih cepat daripada
     bug yang dilaporkannya diperbaiki. */
  if (!ditolak) {
    await rest(`unit_economics?id=eq.${ID_NGAWUR}`, { method: "DELETE" });
    console.log("         (baris uji dibersihkan; RLS SUDAH REGRESI — periksa kebijakannya)");
  }
}

/* ── 4. dokumen tim tidak bisa dihapus ────────────────────────────────────── */
console.log("\n=== 4. Kontrol negatif: dokumen tim tidak bisa dihapus ===");

{
  /* ⚠️ HTTP 204 di sini BUKAN berarti terhapus. Tanpa kebijakan `delete`, tidak
     ada baris yang terlihat untuk dihapus, jadi PostgREST menghapus nol baris dan
     tetap menjawab 204 — jawaban yang terbaca seperti sukses. Yang membuktikan
     bukan kode statusnya, melainkan barisnya masih ada sesudahnya. */
  const r = await rest(`unit_economics?id=eq.${ID_DOKUMEN}`, { method: "DELETE" });

  const sesudah = await rest(`unit_economics?id=eq.${ID_DOKUMEN}&select=id`);
  const baris = sesudah.ok ? await sesudah.json() : [];
  cek(
    `dokumen bersama masih ada setelah DELETE (HTTP ${r.status})`,
    baris.length === 1,
    baris.length === 1 ? "utuh" : "HILANG — kebijakan delete bocor",
  );
}

/* ── selesai ──────────────────────────────────────────────────────────────── */
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
