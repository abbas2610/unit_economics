/**
 * probe-jaga.mjs — `npm run probe:jaga`
 *
 * Menjaga satu sifat dari `.github/workflows/jaga-supabase.yml`: **ia tidak
 * pernah menulis.**
 *
 * ## Kenapa sifat ini butuh penjaga sendiri
 *
 * Karena workflow itu jalan otomatis, tiap hari, tanpa ada yang menonton. Kalau
 * suatu saat ia menulis, ia menulis ratusan kali setahun ke dokumen yang dipakai
 * tim — dan tiap jalannya tetap hijau. Repo ini sudah kehilangan seluruh angka
 * tim sekali persis karena bentuk kegagalan itu: perintah yang dimaksudkan
 * sebagai pembacaan ternyata menulis, tanpa satu pun error.
 *
 * Perubahan yang paling mungkin memasukkannya bukan kelalaian melainkan niat
 * baik: "biar pasti dianggap aktif, tulis saja baris heartbeat." Itu terdengar
 * masuk akal, dan itu yang membuatnya berbahaya.
 *
 * ## ⚠️ Komentar dibuang lebih dulu, dan itu bukan detail
 *
 * Berkas yang dijaga MENYEBUT `POST`, `-d`, dan `upsert` di dalam komentarnya —
 * justru untuk menjelaskan kenapa ketiganya terlarang. Detektor yang menyisir
 * seluruh berkas akan menyala pada penjelasan itu sendiri, lalu merah pada
 * perilaku yang benar. Probe yang merah pada perilaku yang benar akan dimatikan
 * orang, bukan diperbaiki — sudah pernah terjadi di `probe:token`, waktu pola
 * nama token ikut menangkap sub-propertinya.
 */
import { readFileSync, existsSync } from "node:fs";

let lulus = 0;
let gagal = 0;
const cek = (nama, kondisi, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
/** Kontrol negatif: `kondisiSalah` true berarti detektornya TIDAK menyala. */
const kontrol = (nama, kondisiSalah, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

const BERKAS = ".github/workflows/jaga-supabase.yml";

console.log("\n=== 1. Workflow keepalive ada dan terjadwal ===");

cek(`${BERKAS} ada`, existsSync(BERKAS));
if (!existsSync(BERKAS)) {
  console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
  process.exit(1);
}

const teks = readFileSync(BERKAS, "utf8");

/** Baris yang benar-benar dijalankan — komentar YAML dan shell dibuang. */
const kode = (isi) =>
  isi
    .split("\n")
    .filter((b) => !b.trim().startsWith("#"))
    .join("\n");

cek("punya jadwal cron", /^\s*-\s*cron:/m.test(kode(teks)));
cek("bisa dijalankan tangan (workflow_dispatch)", /workflow_dispatch:/.test(kode(teks)));

/**
 * Jadwalnya harian.
 *
 * Mingguan akan "bekerja" sampai satu jalan terlewat — dan cron GitHub memang
 * bisa tertunda atau dilewati pada jam sibuk. Jadwal tanpa margin gagal justru
 * pada minggu tersibuk, dan gejalanya muncul di Supabase, bukan di sini.
 */
{
  const m = /^\s*-\s*cron:\s*["']([^"']+)["']/m.exec(kode(teks));
  const bagian = m ? m[1].trim().split(/\s+/) : [];
  const harian = bagian.length === 5 && bagian[2] === "*" && bagian[3] === "*" && bagian[4] === "*";
  cek("jadwalnya harian, bukan mingguan", harian, m ? m[1] : "tidak ada cron");
}

console.log("\n=== 2. Ia tidak pernah menulis ===");

/** Kata kerja HTTP yang menulis, plus bentuk curl yang mengirim badan. */
const POLA_TULIS = [
  [/-X\s*(POST|PUT|PATCH|DELETE)/i, "-X <verb menulis>"],
  [/--request\s+(POST|PUT|PATCH|DELETE)/i, "--request <verb menulis>"],
  [/(^|\s)(-d|--data(-raw|-binary|-urlencode)?)(\s|=)/m, "badan permintaan (-d / --data)"],
  [/upsert/i, "upsert"],
];

/** @returns nama pola pertama yang cocok, atau null kalau bersih. */
const cariTulis = (isi) => {
  const k = kode(isi);
  for (const [pola, nama] of POLA_TULIS) if (pola.test(k)) return nama;
  return null;
};

{
  const temuan = cariTulis(teks);
  cek("tidak ada satu pun kata kerja yang menulis", temuan === null, temuan ?? "bersih");
}

cek(
  "kredensialnya dari vars, bukan secrets",
  /vars\.NEXT_PUBLIC_SUPABASE_URL/.test(kode(teks)),
);

/* Bukti bahwa 200 saja tidak dianggap cukup — tanpa ini, keepalive bisa hijau
   tiap hari sambil membiarkan project terjeda di belakang proxy. */
cek("menuntut barisnya benar-benar kembali, bukan cuma HTTP 200", /grep -q/.test(kode(teks)));

console.log("\n--- kontrol negatif ---");

/* Detektor di atas hanya berarti kalau ia menyala saat pelanggarannya ada.
   Pelanggarannya disuntikkan ke SALINAN teks, bukan ke berkasnya. */
kontrol(
  "-X POST yang disuntikkan tertangkap",
  cariTulis(teks.replace("kode=$(curl -sS", "kode=$(curl -X POST -sS")) === null,
);

kontrol(
  "--data yang disuntikkan tertangkap",
  cariTulis(teks.replace("kode=$(curl -sS", "kode=$(curl --data '{}' -sS")) === null,
);

kontrol(
  "upsert yang disuntikkan tertangkap",
  cariTulis(`${teks}\n        run: echo upsert`) === null,
);

/* Kontrol untuk pembuang komentar: kalau ia mati, seluruh pemeriksaan di atas
   akan menyala pada komentar berkas ini sendiri — yang memang menyebut POST. */
kontrol(
  "komentar memang dibuang sebelum disisir",
  cariTulis("# ini komentar yang menyebut -X POST dan upsert\nrun: curl -sS x") !== null,
);

/* Kontrol untuk batas jadwal: cron mingguan harus jatuh di luar. */
{
  const mingguan = teks.replace(/cron:\s*"[^"]+"/, 'cron: "17 6 * * 1"');
  const m = /^\s*-\s*cron:\s*["']([^"']+)["']/m.exec(kode(mingguan));
  const b = m ? m[1].trim().split(/\s+/) : [];
  kontrol(
    "cron mingguan memang gagal batas yang sama",
    b.length === 5 && b[2] === "*" && b[3] === "*" && b[4] === "*",
  );
}

console.log("\n=== 3. Skrip keepalive yang dibangkitkan CI ===");

/**
 * Jalur kedua: cron Hostinger memanggil berkas yang ditulis job `bundel`.
 *
 * Ia ada karena cron Hostinger membatasi perintahnya 255 karakter sementara
 * anon key sendiri sudah ~220 — `curl` lengkap tidak muat di satu baris
 * crontab. Konsekuensinya, ada jalur kedua yang menyentuh Supabase tiap hari,
 * dan jalur itu butuh penjaga yang sama dengan yang pertama.
 *
 * Yang disisir cuma blok heredoc-nya, bukan seluruh `ci.yml` — berkas itu penuh
 * perintah git yang sah (`rsync --delete`, `git commit`) yang akan menyalakan
 * detektor kalau ikut terbawa.
 */
{
  const CI = ".github/workflows/ci.yml";
  const isiCI = existsSync(CI) ? readFileSync(CI, "utf8") : "";
  const blok = /cat > out\/jaga-supabase\.sh <<SKRIP\n([\s\S]*?)\n\s*SKRIP\n/.exec(isiCI);

  cek("blok pembangkit skrip ada di ci.yml", blok !== null);

  if (blok) {
    const skrip = blok[1];
    const temuan = cariTulis(skrip);
    cek("skrip yang dibangkitkan tidak menulis", temuan === null, temuan ?? "bersih");
    cek("ia memakai curl", /curl /.test(skrip));
    cek("ia mencatat hasilnya ke log", /GAGAL/.test(skrip) && /OK /.test(skrip));

    /* Kuncinya datang dari variable CI, bukan ditulis harfiah — kalau harfiah,
       memutar anon key kembali berarti menyunting kode, yang justru alasan
       env.ts dibuat. */
    cek("kuncinya dari variable CI, bukan ditulis di repo", /KEY="\$ANON"/.test(skrip));

    console.log("\n--- kontrol negatif ---");
    kontrol(
      "-X POST yang disuntikkan ke skrip tertangkap",
      cariTulis(skrip.replace("curl -fsS", "curl -X POST -fsS")) === null,
    );
    kontrol(
      "anon key harfiah tertangkap",
      /KEY="\$ANON"/.test(skrip.replace('KEY="$ANON"', 'KEY="eyJhbGciOiJIUzI1NiJ9.abc"')),
    );
  }
}

console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
