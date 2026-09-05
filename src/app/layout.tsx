import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Unit Economics - Societies of Strangers",
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
    <html lang="id-ID" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initTema }} />
      </head>
      <body className="min-h-full bg-canvas text-fg antialiased">{children}</body>
    </html>
  );
}
