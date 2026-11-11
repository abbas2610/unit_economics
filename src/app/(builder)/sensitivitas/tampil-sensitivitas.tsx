/**
 * Cara SATU angka sensitivitas ditulis — dipakai tab dan laporan PDF-nya.
 *
 * Satu tempat, karena dua tampilan yang menulis angka yang sama dengan aturan
 * berbeda akan berbeda pada hari pertama salah satunya disunting: tab
 * menulis margin "+62,1%" sementara PDF yang dibawa ke manajemen menulis
 * "62,1%" tanpa tanda, dan margin negatif yang cuma ditandai warna hilang bagi
 * pembaca yang buta warna merah-hijau.
 *
 * Aturannya:
 *   - biaya (COGS, investasi)         → rupiah polos; tidak punya arah
 *   - gross profit & margin           → `<Nilai>`, BERTANDA
 *   - break-even                      → pcs, atau `—` kalau tak pernah tercapai
 *   - Δ rupiah / pcs                  → bertanda + persen relatif
 *   - Δ margin                        → POIN, tanpa persen (bukan persen dari persen)
 */
import type { ReactNode } from "react";
import { pcs, rupiah } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import type { DefinisiMetrik, Selisih } from "@/contexts/sensitivitas/aplikasi/sensitivitas";
import { Angka, Nilai } from "@/components/ui";

export function NilaiMetrik({
  metrik,
  nilai,
  className,
}: {
  metrik: DefinisiMetrik;
  nilai: number | null;
  className?: string;
}): ReactNode {
  if (metrik.jenis === "pcs") {
    return nilai == null ? (
      <span className={cx("tabular font-semibold text-turun", className)} title="Gross profit tidak positif, tidak akan balik modal">
        tak tercapai
      </span>
    ) : (
      <Angka className={className}>{pcs(nilai)}</Angka>
    );
  }
  const n = nilai ?? 0;
  if (metrik.jenis === "margin") return <Nilai nilai={n} jenis="persen" className={className} />;
  if (!metrik.biaya) return <Nilai nilai={n} className={className} />;
  return <Angka className={className}>{rupiah(n)}</Angka>;
}

/**
 * Δ terhadap default. Kosong kalau tidak bergeser — "Rp0 · 0%" di tiap sel
 * yang tidak tersentuh membuat sel yang BENAR-BENAR bergeser sulit ditemukan.
 */
export function SelisihMetrik({
  jenis,
  biaya,
  sel,
  className,
}: {
  jenis: DefinisiMetrik["jenis"];
  biaya: boolean;
  sel: Selisih;
  className?: string;
}): ReactNode {
  if (sel.selisih == null) return null;
  if (Math.abs(sel.selisih) < (jenis === "margin" ? 0.05 : 0.5)) return null;
  return (
    <span className={cx("inline-flex flex-wrap items-baseline justify-end gap-x-1.5 text-meta", className)}>
      {jenis === "margin" ? (
        <Nilai nilai={sel.selisih} jenis="poin" />
      ) : (
        <>
          <Nilai nilai={sel.selisih} jenis={jenis === "pcs" ? "pcs" : "rupiah"} biaya={biaya} />
          {sel.persen != null ? (
            <Nilai nilai={sel.persen} jenis="persen" biaya={biaya} className="font-normal" />
          ) : null}
        </>
      )}
    </span>
  );
}
