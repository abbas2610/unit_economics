"use client";

/**
 * Laporan PDF Sensitivity Analysis: SATU halaman A4, tabel selebar kertas.
 *
 * ## Kenapa A4, bukan kertas selebar ponsel
 *
 * Dua versi sebelumnya memakai kertas custom selebar ponsel (100 mm). Di
 * mesin pemilik keduanya gagal dengan cara yang sama: tujuan print "Microsoft
 * Print to PDF" (dan printer mana pun) hanya mengenal kertas standar, jadi
 * Chrome memakai Letter/A4 lalu MENGECILKAN laporan sempit itu ke tengah.
 * Hasilnya satu kolom kecil di tengah kertas putih. Pemilik ingin kertasnya
 * terisi kiri-kanan. A4 dikenali semua tujuan, jadi tidak ada lagi yang
 * bergantung pada pilihan di dialog.
 *
 * ## Satu halaman, dijamin
 *
 * Isi dirender pada lebar cetak A4 (`LEBAR_ISI_MM`) juga di layar, lalu
 * tingginya diukur. Kalau melebihi tinggi cetak A4, `--zoom-cetak` dikecilkan
 * secukupnya (hanya berlaku saat print, lihat globals.css). Skenario yang
 * bertambah membuat tabel lebih rapat, bukan membuat halaman kedua.
 *
 * ## Tabel
 *
 * Baris = asumsi & hasil, kolom = A · Default, B, C, … Tiap nilai skenario
 * membawa Δ terhadap A di bawahnya. Baris yang tidak bergeser di skenario
 * MANA PUN dipadatkan jadi satu baris "Tetap di semua skenario" per
 * kelompok: nilainya tetap tertulis, tapi tidak memakan sepuluh baris.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { pcs, rupiah, waktu } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import { hurufKolom, VARIABEL } from "@/contexts/sensitivitas/domain/sensitivitas";
import { bergeser, jalankan, metrikTampil, selisih } from "@/contexts/sensitivitas/aplikasi/sensitivitas";
import type {
  DefinisiMetrik,
  HasilSkenario,
  JenisMetrik,
  KelompokHasil,
} from "@/contexts/sensitivitas/aplikasi/sensitivitas";
import { tautanTab } from "@/components/app-shell";
import { useDokumen } from "@/components/dokumen-provider";
import { Nilai, Tombol } from "@/components/ui";
import { NilaiMetrik } from "../tampil-sensitivitas";

/**
 * Tanggal laporan. Lewat `useSyncExternalStore` dengan snapshot server kosong:
 * HTML hasil build dibuat jauh sebelum laporan dicetak, jadi tanggal yang
 * dihitung saat render akan berbeda antara build dan browser (hydration
 * mismatch). Menyalinnya ke state di `useEffect` ditolak lint Next 16.
 */
const tanpaLangganan = () => () => {};
const tanggalSekarang = () => waktu(new Date().toISOString()).split(",")[0];
const tanggalServer = () => "";

/** A4 potret dengan margin 10 mm: area cetak 190 × 277 mm. */
const MARGIN_MM = 10;
const LEBAR_ISI_MM = 210 - 2 * MARGIN_MM;
/** Sedikit di bawah 277 mm: pembulatan subpiksel antara layar dan mesin cetak. */
const TINGGI_ISI_MM = 297 - 2 * MARGIN_MM - 5;
const mmKePx = (mm: number) => (mm * 96) / 25.4;

/**
 * Pasang aturan kertas A4 dan hitung zoom supaya isi muat satu halaman.
 *
 * `@page` ditulis dari sini, bukan di globals.css, supaya hanya berlaku di
 * rute ini. Dipanggil tiap render dan tepat sebelum print: isi berubah saat
 * dokumen tim selesai dimuat, dan Ctrl+P dari menu browser tidak lewat
 * tombol kita.
 */
function siapkanKertas(isi: HTMLElement | null) {
  if (!isi) return;
  let gaya = document.getElementById("kertas-laporan") as HTMLStyleElement | null;
  if (!gaya) {
    gaya = document.createElement("style");
    gaya.id = "kertas-laporan";
    document.head.appendChild(gaya);
  }
  gaya.textContent = `@page { size: A4 portrait; margin: ${MARGIN_MM}mm; }`;
  const zoom = Math.min(1, mmKePx(TINGGI_ISI_MM) / Math.max(1, isi.scrollHeight));
  isi.style.setProperty("--zoom-cetak", zoom.toFixed(3));
}

const URUTAN: ReadonlyArray<KelompokHasil> = [
  "Initial investment",
  "Profit & break-even",
  "Biaya per botol kecil",
  "Biaya per botol besar",
];

export function CetakSensitivitas() {
  const { dok, status } = useDokumen();
  const tanggal = useSyncExternalStore(tanpaLangganan, tanggalSekarang, tanggalServer);
  const isiRef = useRef<HTMLDivElement>(null);

  /* Tanpa daftar dependensi: tiap render bisa mengubah tinggi isi. Ini menulis
     ke DOM, bukan ke state React, jadi tidak memicu render ulang. */
  useEffect(() => {
    siapkanKertas(isiRef.current);
  });

  /* Dialog print baru dibuka setelah dokumen tim SELESAI dimuat. Mencetak di
     render pertama berarti mencetak `dokumenAwal()` (angka contoh) dalam PDF
     yang dikirim ke manajemen, tanpa satu pun tanda bahwa itu terjadi. */
  const sudahDicetak = useRef(false);
  useEffect(() => {
    if (status === "memuat" || sudahDicetak.current) return;
    sudahDicetak.current = true;
    const t = setTimeout(() => {
      siapkanKertas(isiRef.current);
      window.print();
    }, 400);
    return () => clearTimeout(t);
  }, [status]);

  const dasar = jalankan(dok);
  const kolom = dok.sensitivitas.map((sk) => ({ sk, hasil: jalankan(dok, sk) }));
  const semua: HasilSkenario[] = [dasar, ...kolom.map((k) => k.hasil)];
  const metrik = metrikTampil(semua);
  const huruf = ["A", ...kolom.map((_, i) => hurufKolom(i))];
  const nama = ["Default (rencana aktif)", ...kolom.map((k) => k.sk.nama)];
  const jumlahKolom = semua.length + 1;

  return (
    <>
      <div
        className="mx-auto mb-4 flex flex-wrap items-center justify-between gap-2"
        style={{ maxWidth: `${LEBAR_ISI_MM}mm` }}
        data-cetak="sembunyi"
      >
        <a href={tautanTab("/sensitivitas")} className="text-meta font-semibold text-primary hover:underline">
          ← Kembali ke tabel
        </a>
        <Tombol
          jenis="utama"
          onClick={() => {
            siapkanKertas(isiRef.current);
            window.print();
          }}
        >
          Cetak / Simpan PDF
        </Tombol>
      </div>

      <article className="cetak-satu-halaman mx-auto w-fit rounded-lg border border-border bg-surface p-6">
        <div ref={isiRef} className="cetak-isi" style={{ width: `${LEBAR_ISI_MM}mm` }}>
          {/* ═══════════════════════════════════════════════════ kop ══ */}
          <header className="mb-3 flex items-end justify-between gap-4 border-b-2 border-fg pb-2">
            <div>
              <p className="text-label uppercase text-primary">Societies of Strangers</p>
              <h1 className="mt-0.5 text-page-title text-fg">Sensitivity Analysis</h1>
            </div>
            <p className="text-right text-meta text-fg-subtle">
              PT Kreasi Tiga Generasi Indonesia
              {tanggal ? <span className="block">{tanggal}</span> : null}
            </p>
          </header>

          {/* ══════════════════════════════════════════ legenda kolom ══ */}
          <div className="mb-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(semua.length, 4)}, minmax(0, 1fr))` }}>
            {semua.map((h, i) => (
              <div key={huruf[i]} className="flex items-start gap-2 rounded-md border border-border px-2.5 py-2">
                <Lencana huruf={huruf[i]} utama={i === 0} />
                <div className="min-w-0">
                  <p className="text-meta font-semibold text-fg">{nama[i]}</p>
                  <p className="text-badge text-fg-subtle">
                    {i === 0 ? ringkasDefault(h) : ringkasAsumsi(kolom[i - 1].sk.nilai, h)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════ tabel ══ */}
          <table className="w-full table-fixed border-collapse">
            <colgroup>
              <col style={{ width: semua.length <= 2 ? "34%" : "26%" }} />
              {semua.map((_, i) => (
                <col key={huruf[i]} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b-2 border-border-strong">
                <th className="py-1.5 pr-2 text-left text-label uppercase text-fg-muted">Asumsi &amp; hasil</th>
                {semua.map((_, i) => (
                  <th key={huruf[i]} className="px-2 py-1.5 text-right align-bottom">
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <Lencana huruf={huruf[i]} utama={i === 0} />
                      <span className="text-meta font-semibold text-fg">{i === 0 ? "Default" : nama[i]}</span>
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Kelompok judul="Asumsi" kolom={jumlahKolom} />
              {VARIABEL.map((v) => (
                <tr key={v.kunci} className="border-b border-border">
                  <td className="py-1 pr-2 align-top text-meta font-semibold text-fg">{v.label}</td>
                  {semua.map((h, i) => (
                    <Sel
                      key={huruf[i]}
                      nilai={<span className="tabular font-semibold text-fg">{rupiah(h.variabel[v.kunci])}</span>}
                      delta={i === 0 ? null : <Delta jenis="rupiah" biaya={v.biaya} a={dasar.variabel[v.kunci]} b={h.variabel[v.kunci]} />}
                    />
                  ))}
                </tr>
              ))}

              {URUTAN.map((kelompok) => {
                const baris = metrik.filter((m) => m.kelompok === kelompok);
                const gerak = (m: DefinisiMetrik) =>
                  m.utama ||
                  semua.some((h) => {
                    const a = dasar.ringkasan[m.kunci];
                    const b = h.ringkasan[m.kunci];
                    return bergeser(selisih(a, b, m.jenis), m.jenis) || (a == null) !== (b == null);
                  });
                const tetap = baris.filter((m) => !gerak(m));
                return [
                  <Kelompok key={`k-${kelompok}`} judul={kelompok} kolom={jumlahKolom} />,
                  ...baris.filter(gerak).map((m) => (
                    <tr key={m.kunci} className={cx("border-b border-border", m.utama && "bg-primary-subtle/50")}>
                      <td className={cx("py-1 pr-2 align-top text-meta", m.utama ? "font-semibold text-fg" : "text-fg-muted")}>
                        {m.label}
                      </td>
                      {semua.map((h, i) => (
                        <Sel
                          key={huruf[i]}
                          nilai={<NilaiMetrik metrik={m} nilai={h.ringkasan[m.kunci]} className={m.utama ? "font-semibold" : undefined} />}
                          delta={
                            i === 0 ? null : (
                              <Delta jenis={m.jenis} biaya={m.biaya} a={dasar.ringkasan[m.kunci]} b={h.ringkasan[m.kunci]} />
                            )
                          }
                        />
                      ))}
                    </tr>
                  )),
                  tetap.length > 0 ? (
                    <tr key={`t-${kelompok}`} className="border-b border-border">
                      <td colSpan={jumlahKolom} className="py-1 text-badge text-fg-subtle">
                        <span className="font-semibold text-fg-muted">
                          {kolom.length > 0 ? "Tetap di semua skenario: " : ""}
                        </span>
                        {tetap.map((m) => `${m.label} ${teksNilai(m, dasar.ringkasan[m.kunci])}`).join(" · ")}
                      </td>
                    </tr>
                  ) : null,
                ];
              })}
            </tbody>
          </table>

          <p className="mt-2.5 text-badge text-fg-subtle">
            Δ terhadap A. Tanda <b>+</b>/<b>−</b> selalu tertulis; warna hanya penegas. Untuk biaya,
            naik (+) ditandai merah. Margin bergeser dalam poin. Ikut kurs: fragrance oil dan
            penawaran supplier dalam USD. OEM, fulfillment, freight, dan vendor Rupiah tetap.
          </p>
        </div>
      </article>
    </>
  );
}

/* ══════════════════════════════════════════════════════════ potongan ══ */

const ringkasDefault = (h: HasilSkenario): string =>
  `Kurs ${rupiah(h.variabel.kurs)} · Jual kecil ${rupiah(h.variabel.hargaKecil)} · besar ${rupiah(h.variabel.hargaBesar)}`;

/** Hanya asumsi yang diubah: "Kurs Rp20.000 · Jual kecil Rp180.000". */
function ringkasAsumsi(nilai: Partial<Record<string, number>>, h: HasilSkenario): string {
  const singkat: Record<string, string> = { kurs: "Kurs", hargaKecil: "Jual kecil", hargaBesar: "Jual besar" };
  const diubah = VARIABEL.filter((v) => nilai[v.kunci] != null);
  if (diubah.length === 0) return "Asumsi sama dengan default";
  return diubah.map((v) => `${singkat[v.kunci]} ${rupiah(h.variabel[v.kunci])}`).join(" · ");
}

/** Teks polos untuk baris "tetap": biaya tidak bertanda, sama seperti di tabel. */
const teksNilai = (m: DefinisiMetrik, n: number | null): string =>
  n == null ? "tak tercapai" : m.jenis === "pcs" ? pcs(n) : rupiah(n);

function Lencana({ huruf, utama }: { huruf: string; utama?: boolean }) {
  return (
    <span
      className={cx(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-badge font-bold",
        utama ? "bg-surface-muted text-fg-muted" : "bg-primary text-white",
      )}
    >
      {huruf}
    </span>
  );
}

function Kelompok({ judul, kolom }: { judul: string; kolom: number }) {
  return (
    <tr>
      <td colSpan={kolom} className="pt-2.5 pb-1 text-label uppercase text-primary">
        {judul}
      </td>
    </tr>
  );
}

function Sel({ nilai, delta }: { nilai: ReactNode; delta: ReactNode }) {
  return (
    <td className="px-2 py-1 text-right align-top text-meta leading-tight">
      <div className="break-words">{nilai}</div>
      {delta ? <div className="mt-0.5">{delta}</div> : null}
    </td>
  );
}

/**
 * Δ untuk satu sel: selisih rupiah (atau pcs) DAN persen relatif; margin
 * cukup dalam poin. Versi sebelumnya cuma persen, dengan alasan nilai baru
 * sudah tertulis di atasnya; pemilik memintanya tertulis ("harus ada info
 * berapa rupiah change-nya"), karena menghitung selisih dua angka sembilan
 * digit di kepala bukan kerja pembaca laporan.
 */
function Delta({ jenis, biaya, a, b }: { jenis: JenisMetrik; biaya: boolean; a: number | null; b: number | null }) {
  const sel = selisih(a, b, jenis);
  if (sel.selisih == null) {
    if (a != null && b == null) return <span className="text-badge text-turun">jadi tak tercapai</span>;
    if (a == null && b != null) return <span className="text-badge text-fg-subtle">jadi tercapai</span>;
    return null;
  }
  if (!bergeser(sel, jenis)) return <span className="text-badge text-fg-subtle">tetap</span>;
  if (jenis === "margin") return <Nilai nilai={sel.selisih} jenis="poin" className="text-badge" />;
  return (
    <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5">
      <Nilai nilai={sel.selisih} jenis={jenis === "pcs" ? "pcs" : "rupiah"} biaya={biaya} className="text-badge" />
      {sel.persen != null ? (
        <Nilai nilai={sel.persen} jenis="persen" biaya={biaya} className="text-badge font-normal" />
      ) : null}
    </span>
  );
}
