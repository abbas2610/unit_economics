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
];

const peramban = await chromium.launch();
const konteks = await peramban.newContext({ viewport: { width: 1280, height: 900 } });

/**
 * ⛔ Supabase DIPUTUS untuk seluruh probe ini. Dua alasan, dan yang pertama tidak
 * bisa ditawar.
 *
 * **1. Probe ini tidak boleh bisa menyentuh data tim.** Bundle yang dibangun CI
 * membawa kredensial produksi. Tanpa pemutusan ini, tiap ketikan probe —
 * dan bagian 5 di bawah memang mengetik ke kotak kurs — tersimpan ke dokumen
 * bersama yang sungguhan. Menjalankan CI akan merusak angka rapat tim, tiap kali,
 * tanpa satu pun tanda di log yang hijau.
 *
 * **2. Assertion-nya jadi bisa dipercaya.** Dengan awan hidup, memuat ulang
 * halaman menarik dokumen dari server dan membuang apa yang baru saja diketik —
 * jadi bagian 5 gagal karena alasan yang tidak ada hubungannya dengan yang
 * diujinya.
 *
 * Yang menguji sisi awan `probe:rls`, dan ia memakai id buangan. Pemisahannya
 * disengaja: probe layar menguji LAYAR.
 */
await konteks.route(/supabase\.co/, (rute) => rute.abort("failed"));

const hal = await konteks.newPage();

/**
 * Aset yang gagal dimuat adalah gejala `basePath` yang salah, dan gejalanya di
 * layar cuma halaman tanpa gaya — bukan error.
 *
 * ⚠️ `net::ERR_ABORTED` DIKECUALIKAN, dan itu bukan pelonggaran yang malas:
 * tab bar dulu memakai `<Link>` Next yang melakukan prefetch halaman tetangga,
 * dan prefetch yang belum selesai saat kita berpindah halaman memang
 * dibatalkan browser. Tab bar sekarang anchor biasa (lihat app-shell.tsx —
 * transisi sisi klien Next 404 di produksi), tapi pengecualian ini tetap
 * dipertahankan: bagian 5 mengetik cepat di beberapa kotak sekaligus, dan
 * permintaan yang saling menyusul bisa saling membatalkan dengan alasan yang
 * sama-sama tidak berarti kegagalan.
 *
 * 404 sungguhan tetap dihitung: itu yang akan terjadi kalau `basePath` hilang.
 */
const gagalMuat = [];
hal.on("requestfailed", (r) => {
  const sebab = r.failure()?.errorText ?? "";
  if (sebab.includes("ERR_ABORTED")) return;
  /* Permintaan ke Supabase memang sengaja diputus di atas — menghitungnya
     sebagai kegagalan aset akan membuat probe merah atas tindakannya sendiri. */
  if (r.url().includes("supabase.co")) return;
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

/* Sekaligus membuktikan pemutusan Supabase di atas benar-benar berlaku: kalau ia
   tidak berlaku, statusnya akan berbunyi "Tersinkron" dan probe ini sedang
   menulis ke dokumen tim tanpa ada yang tahu.

   Yang diuji juga hal yang nyata: builder ini sering dibuka di ruang rapat dengan
   wifi yang tidak bisa diandalkan, dan halaman yang menolak menghitung karena
   Supabase tidak terjangkau tidak berguna bagi siapa pun. */
{
  /* ⚠️ DITUNGGU, bukan dibaca sekali. "Memuat data tim…" adalah keadaan
     sementara, dan `networkidle` bisa terpenuhi sebelum penolakan permintaan
     sempat diproses aplikasinya. Membacanya sekali menghasilkan probe yang
     kadang merah — dan probe yang kadang merah lebih cepat diabaikan orang
     daripada probe yang tidak ada. Polling, jangan `sleep`. */
  await hal
    .waitForFunction(
      () => !/Memuat/i.test(document.querySelector("header [role=status]")?.textContent ?? ""),
      undefined,
      { timeout: 10_000 },
    )
    .catch(() => {});

  const status = (await hal.locator("header [role=status]").first().textContent()) ?? "";
  cek(
    "awan terputus → aplikasi tetap jalan dan MENGATAKANNYA",
    /lokal|Gagal sync/i.test(status),
    JSON.stringify(status),
  );
  cek(
    "…dan tidak mengaku tersinkron",
    !/Tersinkron/i.test(status),
    "status yang bohong lebih buruk daripada tidak ada status",
  );
  cek(
    "angka tetap terhitung tanpa jaringan",
    /Rp/.test((await hal.locator("main").first().textContent()) ?? ""),
  );
}

kontrol(
  "[kontrol negatif] halaman ngawur memang tidak menampilkan judul mana pun",
  await hal
    .goto(BASE + "/tab-yang-tidak-ada/index.html")
    .then((r) => (r?.status() ?? 0) === 200)
    .catch(() => false),
);

/* Snapshot SETELAH kontrol negatif di atas — 404 ke "tab-yang-tidak-ada" itu
   sengaja dan sudah masuk `gagalMuat` lewat listener `response`. Bagian 8 di
   bawah cuma boleh menuntut nol kegagalan BARU sejak titik ini. */
const gagalMuatSebelumKlik = gagalMuat.length;

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

  /* ⚠️ Tunggu muatan awal MENDARAT sebelum mengetik. Aplikasi memuat dokumen
     secara asinkron, dan mengetik sementara ia menunggu adalah kondisi balapan
     yang sungguhan — dijaga `sudahDisunting` di dokumen-provider. Yang diuji di
     bagian ini bukan balapan itu, jadi ia dihindari alih-alih ditumpangi. */
  const tungguSiap = () =>
    hal
      .waitForFunction(
        () => !/Memuat/i.test(document.querySelector("header [role=status]")?.textContent ?? ""),
        undefined,
        { timeout: 10_000 },
      )
      .catch(() => {});
  await tungguSiap();

  /* Baca COGS awal lewat tab Unit Economics, ubah kurs di Asumsi Dasar, lalu
     baca lagi. Ini menguji rantai yang paling mudah putus tanpa gejala:
     dokumen dibagi lintas rute oleh satu provider di layout. */
  const bacaCogs = async () => {
    await hal.goto(BASE + "/unit-economics/index.html", { waitUntil: "networkidle" });
    await tungguSiap();
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

/* ═══════════════ 8. klik tab sungguhan dari dalam aplikasi, bukan goto ══ */
console.log("\n=== 8. Klik tab dari dalam aplikasi tidak 404 ===");

{
  /* Seluruh navigasi di bagian 1–7 di atas pindah halaman lewat
     `page.goto(...index.html)` langsung — jalur yang TIDAK PERNAH menyentuh
     tautan tab sungguhan. Tab-nya sempat memakai `<Link>` Next dengan asumsi
     transisi sisi kliennya tidak pernah menyentuh URL itu langsung; asumsi itu
     salah, dan tidak ada probe yang mengklik menunya untuk membuktikannya —
     sampai seseorang benar-benar mengklik menu itu di abbas.co.id dan
     mendapat 404. Bagian ini mengklik tab persis seperti pengguna. */
  const NAV_LABEL = [
    "Supplier Botol Kecil",
    "Supplier Botol Besar",
    "Initial Investment",
    "Unit Economics",
  ];

  await hal.goto(BASE + "/index.html", { waitUntil: "networkidle" });

  for (let i = 0; i < NAV_LABEL.length; i++) {
    const tautan = hal.locator("nav a", { hasText: NAV_LABEL[i] });
    await Promise.all([
      hal.waitForLoadState("networkidle"),
      tautan.click(),
    ]);
    const h1 = (await hal.locator("h1").first().textContent()) ?? "";
    cek(
      `klik "${NAV_LABEL[i]}" mendarat di halamannya, bukan 404`,
      h1.includes(TAB[i + 1].judul),
      `h1 = ${JSON.stringify(h1)}`,
    );
  }
}

/* Navigasi klik di atas ikut lewat listener `response` yang sama dengan
   bagian 1; kalau salah satu klik mendarat di 404 sungguhan, barisnya masuk
   ke sini walau perbandingan judul di bagian 8 kebetulan lolos karena
   mencocokkan longgar. */
const gagalMuatBaru = gagalMuat.slice(gagalMuatSebelumKlik);
cek(
  "tidak ada respons 4xx/5xx baru akibat klik tab",
  gagalMuatBaru.length === 0,
  gagalMuatBaru.slice(0, 3).join(", "),
);

kontrol(
  "[kontrol negatif] URL tab tanpa index.html memang 404 di server statis ini",
  await hal
    .goto(BASE + "/unit-economics/", { waitUntil: "domcontentloaded" })
    .then((r) => (r?.status() ?? 0) < 400)
    .catch(() => false),
);

/* ═══════════════ 9. Skenario Custom: kartu, reset, komponen custom ══ */
console.log("\n=== 9. Skenario Custom: kartu hidup, bukan tombol tanpa handler ===");

const angkaDari = (teks) => Number(String(teks).replace(/[^\d-]/g, "")) || 0;

{
  await hal.goto(BASE + "/unit-economics/index.html", { waitUntil: "networkidle" });
  await hal.getByRole("button", { name: "+ Tambah skenario Botol Kecil" }).click();

  /* BUKAN `hasText` — nama kartu hidup di dalam VALUE input, bukan sebagai
     teks node, jadi `textContent` tidak pernah melihatnya. Dokumen bersih
     (Supabase diputus di atas) berarti ini satu-satunya kartu yang ada. */
  const kartu = hal.locator("section.card").first();
  cek("kartu skenario baru muncul", (await hal.locator("section.card").count()) === 1);

  const totalCogs = () =>
    kartu
      .locator("div", { hasText: /^Total COGS/ })
      .last()
      .textContent()
      .then(angkaDari);

  const cogsAwal = await totalCogs();
  cek("Total COGS awal terbaca dan bukan nol", cogsAwal > 0, `Rp${cogsAwal}`);

  /* Baris "otomatis" (fragrance/botol/aksesoris) sekarang field biasa yang
     bisa diedit — buktikan mengubahnya benar-benar menggerakkan Total COGS,
     lalu tombol ↺ mengembalikannya persis ke angka semula. */
  const inputFragrance = kartu.getByLabel(/^Fragrance Oil - /);
  const fragranceAwal = await inputFragrance.inputValue();
  await inputFragrance.fill("999999");
  await inputFragrance.blur();
  const cogsSetelahEdit = await totalCogs();
  cek(
    "mengedit baris yang dulu 'otomatis' menggerakkan Total COGS",
    cogsSetelahEdit > cogsAwal,
    `${cogsAwal} → ${cogsSetelahEdit}`,
  );

  await kartu.getByRole("button", { name: /^Pakai angka Fragrance Oil saat ini/ }).click();
  const fragranceSetelahReset = await inputFragrance.inputValue();
  const cogsSetelahReset = await totalCogs();
  cek(
    "tombol ↺ mengembalikan field ke angka semula",
    fragranceSetelahReset === fragranceAwal,
    `${fragranceSetelahReset} vs ${fragranceAwal}`,
  );
  cek(
    "…dan Total COGS ikut kembali ke angka semula",
    cogsSetelahReset === cogsAwal,
    `${cogsSetelahReset} vs ${cogsAwal}`,
  );

  /* Komponen custom: biaya yang tidak punya padanan di tab mana pun. */
  await kartu.getByRole("button", { name: "+ Tambah komponen" }).click();
  await kartu.getByLabel("Nilai komponen custom").fill("7500");
  await kartu.getByLabel("Nama komponen custom").fill("Tarif impor");
  const cogsSetelahCustom = await totalCogs();
  cek(
    "menambah komponen custom Rp7.500 menaikkan Total COGS persis segitu",
    cogsSetelahCustom === cogsAwal + 7500,
    `${cogsAwal} → ${cogsSetelahCustom}`,
  );

  await kartu.getByRole("button", { name: /^Hapus komponen Tarif impor/ }).click();
  const cogsSetelahHapus = await totalCogs();
  cek(
    "menghapus komponen custom mengembalikan Total COGS",
    cogsSetelahHapus === cogsAwal,
    `${cogsSetelahHapus} vs ${cogsAwal}`,
  );
}

cek(
  "tidak ada kartu liar — cuma satu yang benar-benar ditambah",
  (await hal.locator("section.card").count()) === 1,
);

/* ═══════════════ 10. Laporan cetak: 4 halaman, tanpa Sensitivity ══ */
console.log("\n=== 10. Laporan cetak (/cetak) ===");

{
  await hal.goto(BASE + "/cetak/index.html", { waitUntil: "networkidle" });
  const teks = (await hal.locator("body").innerText()) ?? "";

  cek("halaman 1 — Asumsi Dasar ada", teks.includes("Asumsi Dasar"));
  cek("halaman 2 — Perbandingan Supplier ada", teks.includes("Perbandingan Supplier"));
  cek("halaman 3 — Initial Investment ada", teks.includes("Initial Investment"));
  cek("halaman 4 — Unit Economics ada", teks.includes("Unit Economics"));

  /* Render PDF sungguhan lewat mesin cetak Chromium — bukan cuma menghitung
     elemen `.cetak-halaman` di DOM, yang bisa lolos walau CSS `break-after`-nya
     rusak. Jumlah halaman dihitung dari PDF yang benar-benar dihasilkan. */
  await hal.emulateMedia({ media: "print" });
  const pdf = await hal.pdf({ format: "A4", printBackground: true });
  const jumlahHalaman = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
  cek(
    "PDF yang dihasilkan persis 4 halaman (bukan meluber)",
    jumlahHalaman === 4,
    `${jumlahHalaman} halaman`,
  );

  /* ⚠️ Ini yang pernah rusak diam-diam: kolom kedua tabel supplier ("Model
     Batu (B)") sempat kepotong separuh saat Kecil|Besar dipaksa berdampingan
     untuk hemat tinggi halaman — `overflow-x-auto` di layar diam-diam
     memotong isinya di kertas, bukan menyediakan scrollbar. Teks tetap ADA
     di DOM (innerText tidak berubah), jadi hanya `scrollWidth > clientWidth`
     yang menangkapnya. */
  const luber = await hal.evaluate(() =>
    [...document.querySelectorAll(".cetak-dokumen table")].some(
      (t) => t.scrollWidth > t.clientWidth + 1,
    ),
  );
  cek("tabel di laporan cetak tidak ada yang meluber ke samping (terpotong)", !luber);

  cek(
    "kedua supplier botol kecil (Gelas Bening & Model Batu) utuh, tidak kepotong",
    teks.includes("GELAS BENING") && teks.includes("MODEL BATU"),
  );

  await hal.emulateMedia({ media: null });
}

kontrol(
  "[kontrol negatif] /sensitivitas/index.html memang sudah 404 — dihapus, bukan cuma disembunyikan dari nav",
  await hal
    .goto(BASE + "/sensitivitas/index.html")
    .then((r) => (r?.status() ?? 0) < 400)
    .catch(() => false),
);

/* ══════════════════════════════════════════════════════════════ selesai ══ */
await peramban.close();
console.log(`\n${lulus} lulus, ${gagal} gagal — ${lulus + gagal} pemeriksaan`);
if (gagal > 0) process.exit(1);
