"use client";

/**
 * Rangka aplikasi: topbar identitas + status sinkron, deretan tab, dan kolom isi.
 *
 * ## Tab adalah RUTE, bukan state
 *
 * Builder lama menyembunyikan lima panel dengan `display:none` dan menukar class
 * `.active`. Yang hilang karenanya bukan kerapian: tidak ada satu pun tab yang
 * bisa ditautkan. "Lihat perbandingan supplier botol besar" cuma bisa
 * disampaikan sebagai instruksi — buka halaman, klik tab ketiga — dan tombol
 * back browser melompat keluar dari aplikasi alih-alih kembali ke tab
 * sebelumnya.
 *
 * Sekarang tiap tab punya URL. Dokumennya tetap satu karena `<DokumenProvider>`
 * duduk di layout, di atas rutenya.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, type ReactNode } from "react";
import { cx } from "@/bersama/cx";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import { bacaDokumen } from "@/contexts/dokumen/domain/migrasi";
import { Kabar } from "./ui";
import { useDokumen, type StatusAwan } from "./dokumen-provider";

export const TAB = [
  { href: "/", nomor: 1, label: "Asumsi Dasar" },
  { href: "/supplier-kecil", nomor: 2, label: "Supplier Botol Kecil" },
  { href: "/supplier-besar", nomor: 3, label: "Supplier Botol Besar" },
  { href: "/investasi", nomor: 4, label: "Initial Investment" },
  { href: "/unit-economics", nomor: 5, label: "Unit Economics" },
  { href: "/sensitivitas", nomor: 6, label: "Sensitivity Analysis" },
] as const;

const STATUS: Record<StatusAwan, { teks: string; kelas: string }> = {
  memuat: { teks: "Memuat data tim…", kelas: "text-fg-subtle" },
  menyimpan: { teks: "Menyimpan…", kelas: "text-fg-subtle" },
  tersinkron: { teks: "Tersinkron ke tim", kelas: "text-naik" },
  diperbarui: { teks: "Diperbarui dari tim", kelas: "text-primary" },
  gagal: { teks: "Gagal sync — tersimpan lokal", kelas: "text-turun" },
  lokal: { teks: "Mode lokal (belum terhubung cloud)", kelas: "text-fg-subtle" },
};

/**
 * Tombol tema — TANPA state React, dan itu yang membuatnya benar.
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
          /* mode privat — temanya cuma tidak diingat sesi berikutnya */
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
  const { dok, ganti, beriKabar } = useDokumen();
  const berkas = useRef<HTMLInputElement>(null);

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
      <button
        type="button"
        className={tombol}
        onClick={() => {
          const blob = new Blob([JSON.stringify(dok, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "sos-unit-economics.json";
          a.click();
          URL.revokeObjectURL(url);
          beriKabar("Data diexport");
        }}
      >
        Export data
      </button>
      <button type="button" className={tombol} onClick={() => berkas.current?.click()}>
        Import data
      </button>
      <input
        ref={berkas}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const pembaca = new FileReader();
          pembaca.onload = () => {
            try {
              /* `bacaDokumen()` menerima bentuk lama maupun baru, jadi berkas
                 JSON yang di-export builder HTML tetap bisa di-import. */
              ganti(bacaDokumen(JSON.parse(String(pembaca.result))), "Data diimport");
            } catch {
              beriKabar("File tidak bisa dibaca");
            }
          };
          pembaca.readAsText(f);
        }}
      />
      <button
        type="button"
        className="h-control-sm rounded-sm bg-primary px-2.5 text-meta font-semibold text-white hover:bg-primary-hover"
        onClick={() => window.print()}
      >
        Print / PDF
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { status, kabar } = useDokumen();
  const path = usePathname();
  const s = STATUS[status];

  /* `basePath` sudah dibuang Next dari `usePathname()`, jadi yang dibandingkan
     path aplikasi — dan `trailingSlash: true` membuat rutenya berakhir dengan
     garis miring di produksi tapi tidak selalu di `next dev`. Dinormalkan di
     sini supaya tab aktif tidak bergantung pada cara servernya menyajikan URL. */
  const kini = path.replace(/\/+$/, "") || "/";

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 bg-fg" data-cetak="sembunyi">
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
                  <Link
                    href={t.href}
                    /*
                     * ⚠️ Prefetch DIMATIKAN, dan alasannya spesifik untuk export
                     * statis.
                     *
                     * Next 16 memuat-di-muka lewat segment cache: ia meminta
                     * `__next.<sandi>.<segmen>.__PAGE__.txt` — nama berkas
                     * BERTITIK. `next build` menuliskannya sebagai FOLDER
                     * bertingkat (`__next.<sandi>/<segmen>/__PAGE__.txt`).
                     * Server aplikasi memetakan keduanya; hosting statis tidak
                     * bisa, jadi tiap prefetch mendarat di 404.
                     *
                     * Akibatnya tidak merusak apa pun — navigasi jatuh ke
                     * permintaan biasa dan tetap jalan — tapi ia mengisi tab
                     * Network dengan 404 merah pada aplikasi yang sehat, dan
                     * itu akan menghabiskan sore seseorang suatu hari nanti.
                     * Enam halaman ini kecil dan sudah statis; yang dibeli
                     * prefetch di sini nyaris nol.
                     */
                    prefetch={false}
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
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-container px-5 py-6 pb-20">{children}</main>

      <footer className="mx-auto max-w-container px-5 pb-8 text-meta text-fg-subtle">
        Builder internal — angka awal diturunkan dari sheet &ldquo;New Perfume Unit
        Economics&rdquo; sebagai titik mulai, silakan diganti dengan penawaran riil.
      </footer>

      <Kabar pesan={kabar} />
    </div>
  );
}
