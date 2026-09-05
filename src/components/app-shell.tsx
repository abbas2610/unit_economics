"use client";

/**
 * Rangka aplikasi: topbar identitas + status sinkron, deretan tab, dan kolom isi.
 *
 * ## Tab adalah RUTE, bukan state
 *
 * Builder lama menyembunyikan lima panel dengan `display:none` dan menukar class
 * `.active`. Yang hilang karenanya bukan kerapian: tidak ada satu pun tab yang
 * bisa ditautkan. "Lihat perbandingan supplier botol besar" cuma bisa
 * disampaikan sebagai instruksi - buka halaman, klik tab ketiga - dan tombol
 * back browser melompat keluar dari aplikasi alih-alih kembali ke tab
 * sebelumnya.
 *
 * Sekarang tiap tab punya URL. Dokumennya tetap satu karena `<DokumenProvider>`
 * duduk di layout, di atas rutenya.
 */
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BASE_PATH } from "@/bersama/base-path";
import { cx } from "@/bersama/cx";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import { Kabar } from "./ui";
import { useDokumen, type StatusAwan } from "./dokumen-provider";

export const TAB = [
  { href: "/", nomor: 1, label: "Asumsi Dasar" },
  { href: "/supplier-kecil", nomor: 2, label: "Supplier Botol Kecil" },
  { href: "/supplier-besar", nomor: 3, label: "Supplier Botol Besar" },
  { href: "/investasi", nomor: 4, label: "Initial Investment" },
  { href: "/unit-economics", nomor: 5, label: "Unit Economics" },
] as const;

/**
 * URL tab yang BENAR-BENAR bisa dituju - dan itu beda antara `next dev` dan
 * bundle statis yang dikirim ke abbas.co.id.
 *
 * `next dev` menyajikan tiap rute App Router langsung; path apa adanya sudah
 * cukup. Bundle statis sebaliknya HANYA dilayani proses Next milik repo
 * portfolio, yang menyajikan berkas `public/` cuma pada path PERSISNYA
 * (lihat AGENTS.md - "Tidak ada directory index di produksi"): `.../index.html`
 * → 200, `.../` tanpa nama berkas → 404.
 *
 * Klik `<Link>` Next router sempat dipakai di sini dengan asumsi transisi
 * sisi klien-nya tidak pernah menyentuh URL itu langsung - asumsi itu salah:
 * navigasi antar tab di produksi 404 persis pada URL yang sama yang 404 kalau
 * diketik manual. Anchor biasa yang menuju berkas persisnya menghindari
 * seluruh mekanisme itu; reload penuh aman di sini karena setiap tab membaca
 * ulang dari `Dokumen` yang sudah tersimpan (localStorage/Supabase), bukan
 * dari state React yang cuma hidup di memori.
 *
 * Bukan cuma dipakai tab nav — tombol "Export / Print PDF" juga memakainya
 * untuk menuju `/cetak`, rute yang sengaja TIDAK ada di `TAB` (bukan tab
 * biasa, jadi diterima `string` polos, bukan dibatasi union href TAB).
 */
const tautanTab = (route: string): string => {
  if (process.env.NODE_ENV !== "production") return route;
  return `${BASE_PATH}${route === "/" ? "" : route}/index.html`;
};

const STATUS: Record<StatusAwan, { teks: string; kelas: string }> = {
  memuat: { teks: "Memuat data tim…", kelas: "text-fg-subtle" },
  menyimpan: { teks: "Menyimpan…", kelas: "text-fg-subtle" },
  tersinkron: { teks: "Tersinkron ke tim", kelas: "text-naik" },
  diperbarui: { teks: "Diperbarui dari tim", kelas: "text-primary" },
  gagal: { teks: "Gagal sync - tersimpan lokal", kelas: "text-turun" },
  lokal: { teks: "Mode lokal (belum terhubung cloud)", kelas: "text-fg-subtle" },
};

/**
 * Tombol tema - TANPA state React, dan itu yang membuatnya benar.
 *
 * Tema disimpan sebagai class `.dark` di `<html>`, dipasang script sebelum
 * paint (layout.tsx). Menyalinnya ke `useState` melahirkan dua sumber untuk satu
 * keadaan, dan yang kedua tidak punya jawaban saat render pertama: HTML hasil
 * build tidak tahu tema pembacanya, jadi label tombol akan selalu ditulis
 * salah dulu lalu diperbaiki setelah hydrate.
 *
 * Solusinya merender KEDUA label dan membiarkan varian `dark:` memilih. Tidak
 * ada yang perlu disinkronkan, dan tidak ada yang berkedip.
 */
function TombolTema() {
  return (
    <button
      type="button"
      onClick={() => {
        const gelapBaru = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", gelapBaru);
        try {
          localStorage.setItem("ue-tema", gelapBaru ? "gelap" : "terang");
        } catch {
          /* mode privat - temanya cuma tidak diingat sesi berikutnya */
        }
      }}
      aria-label="Ganti tema terang / gelap"
      className="h-control-sm rounded-sm border border-white/20 px-2.5 text-meta font-semibold text-white/80 hover:border-white/40 hover:text-white"
    >
      <span className="dark:hidden">Gelap</span>
      <span className="hidden dark:inline">Terang</span>
    </button>
  );
}

function Perkakas() {
  const { ganti } = useDokumen();

  const tombol =
    "h-control-sm rounded-sm border border-white/20 px-2.5 text-meta font-semibold text-white/80 hover:border-white/40 hover:text-white";

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-cetak="sembunyi">
      <TombolTema />
      <button
        type="button"
        className={tombol}
        onClick={() => {
          /* `confirm()` dan bukan dialog sendiri: ini satu-satunya aksi merusak
             di aplikasi, dipakai beberapa kali setahun, dan dialog bawaan
             browser tidak bisa salah dirender maupun terlewat fokusnya. */
          if (window.confirm("Reset semua angka ke nilai awal? Data tim ikut tertimpa."))
            ganti(dokumenAwal(), "Direset ke angka awal");
        }}
      >
        Reset
      </button>
      <a
        href={tautanTab("/cetak")}
        className="flex h-control-sm items-center justify-center rounded-sm bg-primary px-2.5 text-meta font-semibold text-white hover:bg-primary-hover"
      >
        Export / Print PDF
      </a>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, kabar } = useDokumen();
  const path = usePathname();
  const s = STATUS[status];

  /* `basePath` sudah dibuang Next dari `usePathname()`, jadi yang dibandingkan
     path aplikasi - dan `trailingSlash: true` membuat rutenya berakhir dengan
     garis miring di produksi tapi tidak selalu di `next dev`. Dinormalkan di
     sini supaya tab aktif tidak bergantung pada cara servernya menyajikan URL. */
  const kini = path.replace(/\/+$/, "") || "/";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 bg-ink" data-cetak="sembunyi">
        <div className="mx-auto flex max-w-container flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <div>
            <p className="text-card-title text-white">Societies of Strangers</p>
            <p className="text-meta text-white/50">
              Unit Economics · PT Kreasi Tiga Generasi Indonesia
            </p>
            <p className={cx("text-meta", s.kelas)} role="status">
              {s.teks}
            </p>
          </div>
          <Perkakas />
        </div>

        <nav className="border-t border-white/10" aria-label="Langkah">
          <ul className="mx-auto flex max-w-container gap-1 overflow-x-auto px-5 py-1.5">
            {TAB.map((t) => {
              const aktif = kini === t.href;
              return (
                <li key={t.href}>
                  <a
                    href={tautanTab(t.href)}
                    aria-current={aktif ? "page" : undefined}
                    className={cx(
                      "flex h-control items-center gap-2 whitespace-nowrap rounded-md px-3 text-meta font-semibold transition-colors",
                      aktif ? "bg-white/12 text-white" : "text-white/55 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <span
                      className={cx(
                        "flex h-5 w-5 items-center justify-center rounded-full text-badge font-bold",
                        aktif ? "bg-primary text-white" : "bg-white/10 text-white/70",
                      )}
                    >
                      {t.nomor}
                    </span>
                    {t.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-container px-5 py-6 pb-20">{children}</main>

      <footer
        className="mx-auto max-w-container px-5 pb-8 text-meta text-fg-subtle"
        data-cetak="sembunyi"
      >
        Builder internal - angka awal diturunkan dari sheet &ldquo;New Perfume Unit
        Economics&rdquo; sebagai titik mulai, silakan diganti dengan penawaran riil.
      </footer>

      <Kabar pesan={kabar} />
    </div>
  );
}
