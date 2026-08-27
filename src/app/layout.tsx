import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Roboto_Mono } from "next/font/google";
import "./globals.css";

/* Plus Jakarta Sans dan Roboto Mono dipertahankan dari builder lama — itu
   identitas yang sudah dikenali tim. Yang berubah cara memuatnya: builder lama
   memakai `<link>` ke fonts.googleapis.com, yang menambah satu permintaan pihak
   ketiga di jalur render DAN membuat halaman menunggu server orang lain sebelum
   satu angka pun terbaca. `next/font` menaruh berkas fontnya di origin sendiri.

   Mono hanya untuk angka. Rupiah di kolom yang lebarnya berubah-ubah tidak bisa
   dibandingkan sekilas — dan seluruh gunanya tabel perbandingan supplier adalah
   membandingkan sekilas. */
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const monoAngka = Roboto_Mono({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-mono-angka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Unit Economics — Societies of Strangers",
  description:
    "Builder unit economics parfum: asumsi dasar, perbandingan supplier botol, initial investment, COGS per botol, dan analisis sensitivitas.",
};

/* Tema mengikuti pilihan pengguna, dan class-nya dipasang SEBELUM paint.
   Mencerminkannya lewat `useState` melahirkan hydration mismatch, dan kedipan
   putih di layar gelap jauh lebih mengganggu daripada sebaliknya.

   Default-nya terang, bukan gelap: halaman ini sering diproyeksikan ke layar
   rapat dan dicetak, dan dua-duanya berangkat dari kertas putih. */
const initTema = `
try {
  if (localStorage.getItem("ue-tema") === "gelap")
    document.documentElement.classList.add("dark");
} catch (e) {}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="id-ID"
      className={`${jakarta.variable} ${monoAngka.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: initTema }} />
      </head>
      <body className="min-h-full bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
