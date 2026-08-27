/**
 * probe-builder.mjs — probe layar. Butuh `npm run serve:build` lebih dulu.
 *
 * ```bash
 * npm run build && npm run serve:build &
 * npm run tunggu:server
 * node scripts/probe-builder.mjs http://localhost:4880/perfume-app
 * ```
 *
 * ## Kenapa ini menembak browser, bukan memanggil fungsinya
 *
 * `probe-hitung` sudah membuktikan aritmetikanya. Yang TIDAK bisa dibuktikan
 * tanpa browser adalah apakah angka itu sampai ke layar: komponen yang tidak
 * pernah dirender, tombol tanpa handler, dan rute yang mati setelah export
 * statis semuanya lolos typecheck dan build. Tombol tanpa handler terlihat
 * persis seperti tombol yang jadi.
 *
 * Yang diukur **computed style dan teks sungguhan**, bukan screenshot: gambar
 * hanya bisa dibandingkan dengan gambar lain, dan yang perlu dijawab di sini
 * berupa pernyataan ("tidak ada bayangan", "angkanya bertanda").
 *
 * Tiap aturan punya KONTROL NEGATIF — pelanggarannya disuntikkan ke halaman
 * sungguhan lalu detektornya harus menyala. Kontrol yang ikut lolos berarti
 * ujinya tidak menguji apa pun.
 */
import { chromium } from "playwright";

const BASE = (process.argv[2] ?? "http://localhost:4880/perfume-app").replace(/\/+$/, "");

let lulus = 0;
let gagal = 0;
const cek = (nama, kondisi, ket = "") => {
  console.log(`  ${kondisi ? "LULUS " : "GAGAL "} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisi) lulus++;
  else gagal++;
};
const kontrol = (nama, kondisiSalah, ket = "") => {
  console.log(`  ${kondisiSalah ? "RUSAK  " : "KONTROL"} ${nama}${ket ? ` — ${ket}` : ""}`);
  if (kondisiSalah) gagal++;
  else lulus++;
};

/** Semua tab, dengan judul yang harus benar-benar muncul di halamannya. */
const TAB = [
  { path: "/index.html", judul: "Asumsi Dasar" },
  { path: "/supplier-kecil/index.html", judul: "Supplier Botol Kecil" },
  { path: "/supplier-besar/index.html", judul: "Supplier Botol Besar" },
  { path: "/investasi/index.html", judul: "Initial Investment" },
  { path: "/unit-economics/index.html", judul: "Unit Economics per Botol" },
  { path: "/sensitivitas/index.html", judul: "Sensitivity Analysis" },
];

const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 1280, height: 900 } });
const hal = await konteks.newPage();

/**
 * Aset yang gagal dimuat adalah gejala `basePath` yang salah, dan gejalanya di
 * layar cuma halaman tanpa gaya — bukan error.
 *
 * ⚠️ `net::ERR_ABORTED` DIKECUALIKAN, dan itu bukan pelonggaran yang malas:
 * `<Link>` Next melakukan prefetch halaman tetangga, dan prefetch yang belum
 * selesai saat kita berpindah halaman memang dibatalkan browser. Menghitungnya
 * sebagai kegagalan membuat probe ini merah pada perilaku yang benar — dan probe
 * yang merah pada perilaku yang benar akan dimatikan orang, bukan diperbaiki.
 *
 * 404 sungguhan tetap dihitung: itu yang akan terjadi kalau `basePath` hilang.
 */
const gagalMuat = [];
hal.on("requestfailed", (r) => {
  const sebab = r.failure()?.errorText ?? "";
  if (sebab.includes("ERR_ABORTED")) return;
  gagalMuat.push(`${sebab} ${r.url()}`);
});
hal.on("response", (r) => {
  if (r.status() >= 400) gagalMuat.push(`${r.status()} ${r.url()}`);
});
const galatKonsol = [];
hal.on("pageerror", (e) => galatKonsol.push(String(e)));

/* ═════════════════════════════════════════════════ 1. tiap tab hidup ══ */
console.log("\n=== 1. Setiap tab benar-benar merender ===");

for (const t of TAB) {
  await hal.goto(BASE + t.path, { waitUntil: "networkidle" });
  const h1 = await hal.locator("h1").first().textContent();
  cek(`${t.path} menampilkan "${t.judul}"`, (h1 ?? "").includes(t.judul), `h1 = ${JSON.stringify(h1)}`);
}

cek("tidak ada aset yang gagal dimuat", gagalMuat.length === 0, gagalMuat.slice(0, 3).join(", "));
cek("tidak ada galat JavaScript", galatKonsol.length === 0, galatKonsol.slice(0, 2).join(" | "));

kontrol(
  "[kontrol negatif] halaman ngawur memang tidak menampilkan judul mana pun",
  await hal
    .goto(BASE + "/tab-yang-tidak-ada/index.html")
    .then((r) => (r?.status() ?? 0) === 200)
    .catch(() => false),
);

/* ═════════════════════════════════════════════════ 2. tab aktif ditandai ══ */
console.log("\n=== 2. Tab aktif ditandai, dan bisa ditautkan ===");

{
  await hal.goto(BASE + "/investasi/index.html", { waitUntil: "networkidle" });
  const aktif = hal.locator('nav a[aria-current="page"]');
  cek("tepat satu tab bertanda aktif", (await aktif.count()) === 1, `${await aktif.count()} tab`);
  cek(
    "yang aktif adalah tab yang URL-nya dibuka",
    ((await aktif.first().textContent()) ?? "").includes("Initial Investment"),
  );

  /* Ini yang TIDAK mungkin di builder lama: tab bukan state, jadi tiap tab punya
     URL sendiri dan bisa dikirim lewat chat. */
  const href = await aktif.first().getAttribute("href");
  cek("tab membawa href sungguhan, bukan tombol", Boolean(href), String(href));
  cek("href sudah membawa basePath /perfume-app", (href ?? "").startsWith("/perfume-app"), String(href));
}

kontrol(
  "[kontrol negatif] tab lain memang TIDAK bertanda aktif",
  (await hal.locator('nav a[aria-current="page"]').count()) > 1,
);

/* ═══════════════════════════════════════════════════ 3. nol drop shadow ══ */
console.log("\n=== 3. Nol drop shadow di kolom konten ===");

{
  await hal.goto(BASE + "/unit-economics/index.html", { waitUntil: "networkidle" });
  const berbayang = await hal.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("main *")) {
      const s = getComputedStyle(el).boxShadow;
      if (s && s !== "none") out.push(el.className?.toString().slice(0, 60) ?? el.tagName);
    }
    return out;
  });
  cek("tidak ada box-shadow di dalam <main>", berbayang.length === 0, berbayang.slice(0, 3).join(" | "));

  /* Kontrol negatif: suntikkan satu bayangan sungguhan ke halaman sungguhan dan
     tuntut pendeteksi yang SAMA menyala. Tanpa ini, baris hijau di atas juga
     bisa berarti selektornya salah dan tidak memeriksa apa pun. */
  const setelahDisuntik = await hal.evaluate(() => {
    const k = document.querySelector("main .card");
    if (!k) return -1;
    k.style.boxShadow = "0 4px 8px rgba(0,0,0,0.4)";
    let n = 0;
    for (const el of document.querySelectorAll("main *")) {
      const s = getComputedStyle(el).boxShadow;
      if (s && s !== "none") n++;
    }
    k.style.boxShadow = "";
    return n;
  });
  kontrol("[kontrol negatif] pendeteksi menyala saat bayangan disuntikkan", setelahDisuntik < 1, `${setelahDisuntik} elemen`);
}

/* ═════════════════════════════════════ 4. angka berarah membawa tandanya ══ */
console.log("\n=== 4. Angka berarah membawa tandanya, bukan cuma warna ===");

{
  await hal.goto(BASE + "/unit-economics/index.html", { waitUntil: "networkidle" });

  /* Gross margin ditampilkan lewat <Nilai>, yang wajib menuliskan + atau −. */
  const teksMargin = await hal.locator("text=/[+−]\\d/").first().textContent();
  cek(
    "ada angka bertanda di layar",
    /[+−]/.test(teksMargin ?? ""),
    JSON.stringify(teksMargin),
  );

  /* Yang benar-benar diuji: angka berwarna hijau/merah TIDAK PERNAH tanpa tanda.
     Buta warna merah-hijau membaca tandanya; kalau tandanya hilang, angka itu
     hilang bagi mereka. */
  const berwarnaTanpaTanda = await hal.evaluate(() => {
    const warnaArah = new Set();
    const gaya = getComputedStyle(document.documentElement);
    for (const t of ["--color-naik", "--color-turun"]) warnaArah.add(gaya.getPropertyValue(t).trim());
    const rgb = (hex) => {
      const h = hex.replace("#", "");
      return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`;
    };
    const target = new Set([...warnaArah].filter(Boolean).map(rgb));
    const out = [];
    for (const el of document.querySelectorAll("main span, main td, main p")) {
      if (el.children.length > 0) continue;
      const teks = (el.textContent ?? "").trim();
      if (!/\d/.test(teks)) continue;
      if (!target.has(getComputedStyle(el).color)) continue;
      if (!/[+−]/.test(teks)) out.push(teks.slice(0, 40));
    }
    return out;
  });
  cek(
    "tidak ada angka hijau/merah tanpa tanda",
    berwarnaTanpaTanda.length === 0,
    berwarnaTanpaTanda.slice(0, 4).join(" | "),
  );

  cek(
    "minus memakai U+2212, bukan hyphen",
    await hal.evaluate(() => !/(^|\s)-Rp/.test(document.querySelector("main")?.textContent ?? "")),
  );
}

kontrol(
  "[kontrol negatif] pemeriksa tanda menolak angka tanpa tanda",
  /[+−]/.test("67,3%"),
);

/* ═════════════════════════════════════ 5. mengetik benar-benar menghitung ══ */
console.log("\n=== 5. Mengetik di satu tab menggerakkan angka di tab lain ===");

{
  await hal.goto(BASE + "/index.html", { waitUntil: "networkidle" });

  /* Baca COGS awal lewat tab Unit Economics, ubah kurs di Asumsi Dasar, lalu
     baca lagi. Ini menguji rantai yang paling mudah putus tanpa gejala:
     dokumen dibagi lintas rute oleh satu provider di layout. */
  const bacaCogs = async () => {
    await hal.goto(BASE + "/unit-economics/index.html", { waitUntil: "networkidle" });
    const baris = hal.locator("text=Total COGS / botol").first();
    const nilai = await baris.locator("xpath=following-sibling::*[1]").textContent();
    return nilai ?? "";
  };

  const sebelum = await bacaCogs();
  cek("COGS awal terbaca", /Rp[\d.]+/.test(sebelum), JSON.stringify(sebelum));

  await hal.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  const kotakKurs = hal.getByLabel("Kurs USD ke IDR");
  await kotakKurs.fill("34.000");
  await kotakKurs.blur();

  const sesudah = await bacaCogs();
  cek(
    "menggandakan kurs menggeser COGS botol kecil (supplier USD)",
    sebelum !== sesudah,
    `${sebelum} → ${sesudah}`,
  );

  /* Dikembalikan supaya probe ini tidak meninggalkan localStorage yang aneh
     untuk probe berikutnya di konteks yang sama. */
  await hal.goto(BASE + "/index.html", { waitUntil: "networkidle" });
  await hal.getByLabel("Kurs USD ke IDR").fill("17.000");
  await hal.getByLabel("Kurs USD ke IDR").blur();

  kontrol(
    "[kontrol negatif] membaca COGS dua kali TANPA mengubah apa pun memberi nilai sama",
    (await bacaCogs()) !== (await bacaCogs()),
  );
}

/* ═══════════════════════════════════════ 6. halaman tidak scroll mendatar ══ */
console.log("\n=== 6. Tabel lebar scroll sendiri, halaman tidak ===");

for (const t of TAB) {
  await hal.goto(BASE + t.path, { waitUntil: "networkidle" });
  const meluber = await hal.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  cek(`${t.path} tidak menggeser halaman ke samping`, !meluber);
}

{
  await hal.goto(BASE + "/supplier-kecil/index.html", { waitUntil: "networkidle" });
  const adaWadahScroll = await hal.evaluate(() =>
    [...document.querySelectorAll("main div")].some(
      (el) => getComputedStyle(el).overflowX === "auto" && el.querySelector("table"),
    ),
  );
  cek("tabel perbandingan punya wadah scroll sendiri", adaWadahScroll);
}

kontrol(
  "[kontrol negatif] pendeteksi luber menyala untuk elemen yang benar-benar luber",
  await hal.evaluate(() => {
    const d = document.createElement("div");
    d.style.cssText = "width:5000px;height:1px";
    document.body.appendChild(d);
    const luber = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
    d.remove();
    return !luber;
  }),
);

/* ═══════════════════════════════════════════════ 7. tema gelap ikut berubah ══ */
console.log("\n=== 7. Tema gelap benar-benar menukar seluruh palet ===");

{
  await hal.goto(BASE + "/investasi/index.html", { waitUntil: "networkidle" });
  const latarTerang = await hal.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await hal.evaluate(() => document.documentElement.classList.add("dark"));
  const latarGelap = await hal.evaluate(() => getComputedStyle(document.body).backgroundColor);
  cek("latar body berubah", latarTerang !== latarGelap, `${latarTerang} → ${latarGelap}`);

  /* Satu warna yang tidak ikut berubah = satu hex yang lolos ke komponen. */
  const tidakIkut = await hal.evaluate(() => {
    const ambil = () =>
      [...document.querySelectorAll("main .card")].map((el) => getComputedStyle(el).backgroundColor);
    document.documentElement.classList.remove("dark");
    const terang = ambil();
    document.documentElement.classList.add("dark");
    const gelap = ambil();
    document.documentElement.classList.remove("dark");
    return terang.filter((c, i) => c === gelap[i]).length;
  });
  cek("setiap kartu ikut berganti warna", tidakIkut === 0, `${tidakIkut} kartu tidak ikut`);
}

/* ══════════════════════════════════════════════════════════════ selesai ══ */
await peramban.close();
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
