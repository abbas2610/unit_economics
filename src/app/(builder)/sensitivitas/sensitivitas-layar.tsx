"use client";

/**
 * Tab 6 — Sensitivity Analysis: tabel skenario berkolom.
 *
 *     Asumsi              A · Default   B · <nama>     C · <nama>   …
 *     Kurs USD → IDR      Rp18.000      [ 20.000 ]     [ 18.000 ]
 *     Harga jual kecil    Rp200.000     [200.000]      [180.000 ]
 *     ─ Biaya per botol kecil ─
 *     Fragrance oil       Rp227         Rp252 +11%     Rp227 tetap
 *     Botol + perizinan   Rp8.976       Rp9.973 +11%   …
 *     OEM                 Rp10.000      Rp10.000 tetap
 *     COGS                …
 *     ─ Initial investment, profit & break-even ─
 *
 * Asumsi cuma kurs dan harga jual (keputusan pemilik — lihat
 * `sensitivitas/domain`). Semua baris di bawahnya adalah JAWABAN: "kalau
 * rupiah jadi 20 ribu, harga botol kecil jadi berapa, OEM jadi berapa".
 * Baris yang tidak bergeser ditulis "tetap" — bukan dikosongkan — supaya
 * "OEM tidak ikut kurs" terbaca sebagai jawaban, bukan sebagai sel yang lupa
 * dihitung.
 *
 * Kolom A tidak bisa diisi: ia dokumen yang sedang aktif. Mengubahnya di sini
 * akan membuat tab ini jadi tempat kedua untuk menyunting angka rencana.
 */
import type { ReactNode } from "react";
import { rupiah } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import { tautanTab } from "@/components/app-shell";
import { idBerikutnya } from "@/contexts/dokumen/domain/migrasi";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import { hurufKolom, VARIABEL } from "@/contexts/sensitivitas/domain/sensitivitas";
import type { KunciVariabel, SkenarioSensitivitas } from "@/contexts/sensitivitas/domain/sensitivitas";
import {
  bergeser,
  jalankan,
  KELOMPOK_HASIL,
  metrikTampil,
  selisih,
} from "@/contexts/sensitivitas/aplikasi/sensitivitas";
import { useDokumen } from "@/components/dokumen-provider";
import {
  BungkusTabel,
  Catatan,
  IsianAngkaOpsional,
  IsianTeks,
  JudulBlok,
  Kartu,
  KepalaHalaman,
  Tombol,
  TombolHapus,
} from "@/components/ui";
import { NilaiMetrik, SelisihMetrik } from "./tampil-sensitivitas";

/** Kolom label membeku saat tabel digulir — pola yang sama dengan tabel supplier. */
const KOLOM_BEKU =
  "sticky left-0 z-10 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border";

const ubahSkenario = (
  d: Dokumen,
  id: string,
  fn: (s: SkenarioSensitivitas) => SkenarioSensitivitas,
): Dokumen => ({ ...d, sensitivitas: d.sensitivitas.map((s) => (s.id === id ? fn(s) : s)) });

const Tetap = () => <span className="text-meta text-fg-subtle">tetap</span>;

export function SensitivitasLayar() {
  const { dok, ubah } = useDokumen();
  const dasar = jalankan(dok);
  const kolom = dok.sensitivitas.map((sk) => ({ sk, hasil: jalankan(dok, sk) }));
  const metrik = metrikTampil([dasar, ...kolom.map((k) => k.hasil)]);

  const tambah = () =>
    ubah((d) => ({
      ...d,
      sensitivitas: [
        ...d.sensitivitas,
        {
          id: "sen" + idBerikutnya(d),
          nama: `Skenario ${hurufKolom(d.sensitivitas.length)}`,
          nilai: {},
        },
      ],
    }));

  const setNilai = (id: string, kunci: KunciVariabel, n: number | null) =>
    ubah((d) =>
      ubahSkenario(d, id, (s) => {
        const nilai = { ...s.nilai };
        if (n == null) delete nilai[kunci];
        else nilai[kunci] = n;
        return { ...s, nilai };
      }),
    );

  const lebarTabel = 140 + 150 + kolom.length * 200;

  return (
    <>
      <KepalaHalaman
        langkah="Langkah 6"
        judul="Sensitivity Analysis"
        catatan="Kolom A adalah rencana yang sedang aktif. Tambah skenario, lalu ubah kurs dan/atau harga jual. Seluruh biaya per botol, initial investment, margin, dan break-even dihitung ulang dengan rumus yang sama dengan tab Initial Investment dan Unit Economics."
      />

      <Kartu padat className="overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-4">
          <JudulBlok
            judul="Tabel skenario"
            sub={
              kolom.length === 0
                ? "Belum ada skenario. Tambah satu untuk membandingkannya dengan default."
                : `${kolom.length} skenario dibandingkan dengan default. Δ dihitung terhadap kolom A.`
            }
          />
          <div className="flex flex-wrap items-center gap-2" data-cetak="sembunyi">
            <Tombol jenis="garis" onClick={tambah}>
              + Tambah skenario
            </Tombol>
            <a
              href={tautanTab("/sensitivitas/cetak")}
              className="flex h-control items-center rounded-md bg-primary px-3 text-meta font-semibold text-white hover:bg-primary-hover"
              data-uji="export-sensitivitas"
            >
              Export PDF
            </a>
          </div>
        </div>

        <BungkusTabel>
          <table className="w-full border-collapse" style={{ minWidth: lebarTabel }}>
            <thead>
              <tr>
                {/* Di ponsel kolom label membeku memakan lebar layar; 140px
                    menyisakan cukup ruang untuk satu kolom angka terlihat. */}
                <th className={cx("th w-[140px] bg-surface-muted text-left sm:w-[240px]", KOLOM_BEKU)}>
                  Asumsi &amp; hasil
                </th>
                <th className="th text-right" style={{ width: 150 }}>
                  <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-badge font-bold text-fg-muted">
                    A
                  </span>
                  Default
                </th>
                {kolom.map(({ sk }, i) => (
                  <th key={sk.id} className="th py-2 text-left normal-case tracking-normal" style={{ width: 200 }}>
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-badge font-bold text-white">
                        {hurufKolom(i)}
                      </span>
                      <IsianTeks
                        nilai={sk.nama}
                        onUbah={(nama) => ubah((d) => ubahSkenario(d, sk.id, (s) => ({ ...s, nama })))}
                        ariaLabel={`Nama skenario ${hurufKolom(i)}`}
                        className="h-control-sm flex-1"
                      />
                      <TombolHapus
                        label={`Hapus ${sk.nama}`}
                        onClick={() => {
                          if (!window.confirm(`Hapus kolom "${sk.nama}"?`)) return;
                          ubah((d) => ({ ...d, sensitivitas: d.sensitivitas.filter((s) => s.id !== sk.id) }));
                        }}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* ══════════════════════════════════════ asumsi (bisa diisi) ══ */}
              <BarisKelompok label="Asumsi skenario (isi di sini)" kolom={kolom.length} sorot>
                {VARIABEL.map((v) => {
                  const nDasar = dasar.variabel[v.kunci];
                  return (
                    <tr key={v.kunci} data-baris={v.kunci} className="border-b border-border">
                      <td className={cx("td bg-surface px-2 py-2 sm:px-3", KOLOM_BEKU)}>
                        <span className="block font-semibold text-fg">{v.label}</span>
                        <span className="block text-meta text-fg-subtle">{v.satuan}</span>
                      </td>
                      <td className="td py-2 text-right">
                        <span className="tabular font-semibold text-fg">{rupiah(nDasar)}</span>
                      </td>
                      {kolom.map(({ sk, hasil }, i) => {
                        const diisi = sk.nilai[v.kunci] ?? null;
                        const efektif = hasil.variabel[v.kunci];
                        return (
                          <td key={sk.id} className="td py-2 align-top">
                            <IsianAngkaOpsional
                              nilai={diisi}
                              otomatis={efektif}
                              onUbah={(n) => setNilai(sk.id, v.kunci, n)}
                              awalan="Rp"
                              ariaLabel={`${v.label}, skenario ${hurufKolom(i)}`}
                            />
                            <div className="mt-1 flex min-h-4 items-center justify-between gap-2">
                              {diisi != null ? (
                                <button
                                  type="button"
                                  className="text-meta text-fg-subtle underline-offset-2 hover:text-primary hover:underline"
                                  onClick={() => setNilai(sk.id, v.kunci, null)}
                                  data-cetak="sembunyi"
                                >
                                  kembali ke default
                                </button>
                              ) : (
                                <span className="text-meta text-fg-subtle">sama dengan default</span>
                              )}
                              <SelisihMetrik jenis="rupiah" biaya={v.biaya} sel={selisih(nDasar, efektif)} />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </BarisKelompok>

              {/* ══════════════════════════════════════════ hasil (dihitung) ══ */}
              {KELOMPOK_HASIL.map((kelompok) => (
                <BarisKelompok key={kelompok} label={kelompok} kolom={kolom.length}>
                  {metrik
                    .filter((m) => m.kelompok === kelompok)
                    .map((m) => {
                      const nDasar = dasar.ringkasan[m.kunci];
                      return (
                        <tr
                          key={m.kunci}
                          data-baris={m.kunci}
                          className={cx("border-b border-border", m.utama && "bg-primary-subtle/40")}
                        >
                          <td
                            className={cx(
                              "td bg-surface px-2 py-2 sm:px-3",
                              KOLOM_BEKU,
                              m.utama ? "font-semibold text-fg" : "text-fg-muted",
                            )}
                          >
                            {m.label}
                          </td>
                          <td className="td py-2 text-right">
                            <NilaiMetrik metrik={m} nilai={nDasar} className={m.utama ? "font-semibold" : undefined} />
                          </td>
                          {kolom.map(({ sk, hasil }) => {
                            const nBaru = hasil.ringkasan[m.kunci];
                            const sel = selisih(nDasar, nBaru, m.jenis);
                            return (
                              <td key={sk.id} className="td py-2 text-right">
                                <NilaiMetrik metrik={m} nilai={nBaru} className={m.utama ? "font-semibold" : undefined} />
                                <div>
                                  {bergeser(sel, m.jenis) ? (
                                    <SelisihMetrik jenis={m.jenis} biaya={m.biaya} sel={sel} />
                                  ) : nDasar == null && nBaru == null ? null : (
                                    <Tetap />
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                </BarisKelompok>
              ))}
            </tbody>
          </table>
        </BungkusTabel>

        {kolom.length === 0 ? (
          <div className="border-t border-border p-5">
            <Tombol jenis="utama" onClick={tambah}>
              + Tambah skenario B
            </Tombol>
          </div>
        ) : null}
      </Kartu>

      <div className="mt-4">
        <Catatan>
          Yang bergeser karena kurs: fragrance oil (harga per liter dalam USD), dan botol,
          aksesoris, box, serta molding dari supplier yang penawarannya dalam USD. OEM,
          fulfillment, freight, dan vendor yang penawarannya dalam Rupiah <b>tetap</b>. Δ biaya
          yang naik ditandai <b>+</b> dan merah, karena naiknya biaya bukan kabar baik. Gross margin
          bergeser dalam <b>poin</b>, bukan persen.
        </Catatan>
      </div>
    </>
  );
}

/** Baris judul kelompok + baris-barisnya. Sel pertama ikut membeku. */
function BarisKelompok({
  label,
  kolom,
  sorot,
  children,
}: {
  label: string;
  kolom: number;
  sorot?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <tr className="border-b border-border">
        <td
          className={cx(
            "px-3 py-1.5 text-label uppercase",
            KOLOM_BEKU,
            sorot ? "bg-primary-subtle text-primary" : "bg-surface-muted text-fg-muted",
          )}
        >
          {label}
        </td>
        <td colSpan={kolom + 1} className={sorot ? "bg-primary-subtle" : "bg-surface-muted"} />
      </tr>
      {children}
    </>
  );
}
