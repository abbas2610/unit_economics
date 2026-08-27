import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * `output: "export"` — dan itu keputusan yang sudah ditentukan oleh cara
   * aplikasi ini hidup, bukan selera.
   *
   * Seluruh perhitungan di sini berjalan di browser dan satu-satunya backend-nya
   * adalah Supabase yang dipanggil langsung dari klien. Tidak ada satu pun
   * Server Component yang membaca sesi, tidak ada route handler, tidak ada
   * cookie. Menyalakan proses server berarti membayar satu mesin untuk
   * menyajikan berkas statis.
   *
   * ⚠️ Konsekuensi yang mudah terlewat: **variabel NEXT_PUBLIC_* dibekukan ke
   * dalam bundle saat build, bukan dibaca saat jalan.** Mengganti project
   * Supabase berarti build ulang, bukan restart. Lihat docs/INFRASTRUKTUR.md.
   */
  output: "export",

  /*
   * Bukan `/perfume`: repo portfolio yang memiliki rute `/perfume`, dan rute itu
   * mem-`iframe` bundle ini dari `public/perfume-app/`. Konvensi yang sama
   * dipakai sm-app, hr-app, dan whitespace-app.
   *
   * Ditulis di sini sejak hari pertama supaya setiap href dan aset sudah membawa
   * prefiksnya — memindahkannya belakangan berarti menyisir tiap tautan.
   */
  basePath: "/perfume-app",

  /* Export statis tidak punya server yang bisa mengoptimalkan gambar saat
     diminta. Tanpa baris ini `next build` menolak jalan. */
  images: { unoptimized: true },

  /* Hosting statis menyajikan `foo/index.html` untuk `/foo/`. Tanpa
     `trailingSlash`, Next menghasilkan `foo.html` dan setiap tautan internal
     mendarat di 404 — hanya setelah deploy, tidak pernah di `next dev`. */
  trailingSlash: true,
};

export default nextConfig;
