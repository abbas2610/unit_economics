import type { ReactNode } from "react";
import { DokumenProvider } from "@/components/dokumen-provider";
import { AppShell } from "@/components/app-shell";

/**
 * Layout untuk seluruh tab builder.
 *
 * `(builder)` adalah route group — tanda kurungnya membuat nama folder ini TIDAK
 * muncul di URL, jadi `page.tsx` di dalamnya tetap melayani `/`. Yang didapat
 * dari mengelompokkannya: satu `<DokumenProvider>` di atas keenam tab, sehingga
 * berpindah tab tidak memuat ulang dokumen — dan tidak menghapus perubahan yang
 * belum sempat tersimpan.
 *
 * Berkas ini sengaja BUKAN `"use client"`. Ia cuma merangkai dua komponen klien;
 * menandainya klien akan menyeret seluruh isi tab ke bundle yang sama tanpa satu
 * pun manfaat.
 */
export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <DokumenProvider>
      <AppShell>{children}</AppShell>
    </DokumenProvider>
  );
}
