"use client";

/**
 * Riwayat — jejak SETIAP perubahan dokumen bersama.
 *
 * Dibuat setelah baris `unit_economics` kehilangan data supplier tanpa satu
 * pun jejak: dokumennya cuma satu baris, ditimpa PENUH tiap simpan, dan tidak
 * ada cara menjawab "kapan dan apa yang berubah" dari mana pun selain
 * localStorage browser orang yang kebetulan belum menimpa miliknya sendiri.
 *
 * Sumber datanya `unit_economics_riwayat` (lihat
 * supabase/migrations/0002_riwayat.sql) — snapshot versi LAMA, ditulis trigger
 * Postgres sebelum tiap UPDATE, bukan kode aplikasi ini. Halaman ini cuma
 * membaca dan membandingkan; tidak ada satu pun tulisan dari sini.
 *
 * Tiap versi dibandingkan dengan `diffDokumen()` (src/bersama/diff.ts) —
 * generik, tidak tahu bentuk `Dokumen` — terhadap versi SEBELUMNYA, sehingga
 * yang tampil bukan "isi dokumen versi ini" (itu sudah bisa dibaca di lima tab
 * lain) melainkan "apa yang BERUBAH sejak versi sebelumnya".
 */
import { useEffect, useState } from "react";
import { diffDokumen, type PerubahanNilai } from "@/bersama/diff";
import { waktu } from "@/bersama/format";
import { awanTersedia } from "@/infrastruktur/supabase/env";
import { useDokumen } from "@/components/dokumen-provider";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import { bacaDokumen } from "@/contexts/dokumen/domain/migrasi";
import { muatRiwayat, type BarisRiwayat } from "@/contexts/dokumen/infrastruktur/awan";
import { Angka, BarisRincian, Catatan, JudulBlok, Kartu, KepalaHalaman, Rincian } from "@/components/ui";

const LABEL_BAGIAN: Record<string, string> = {
  asumsi: "Asumsi Dasar",
  campuran: "Komposisi Campuran",
  legalPerVarian: "Perizinan per Varian",
  varian: "Varian Fragrance",
  dimensi: "Dimensi Botol",
  supplierKecil: "Supplier Botol Kecil",
  supplierBesar: "Supplier Botol Besar",
  pilihan: "Supplier Terpilih",
  pembelian: "Qty Pembelian",
  harga: "Harga Jual",
  marketing: "Marketing",
  opsi: "Opsi",
  skenario: "Skenario",
  investasiCustom: "Biaya Custom Investasi",
};

/** `supplierKecil[s2].nama` → `Supplier Botol Kecil[s2].nama` — cuma segmen
 *  pertama yang diterjemahkan; sisanya sudah cukup jelas apa adanya. */
function labelPath(path: string): string {
  const m = /^([a-zA-Z]+)(.*)$/.exec(path);
  if (!m) return path || "(dokumen)";
  return (LABEL_BAGIAN[m[1]] ?? m[1]) + m[2];
}

function tampilNilai(v: unknown): string {
  if (v === undefined) return "(kosong)";
  if (v === null) return "(null)";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function teksPerubahan(p: PerubahanNilai): string {
  if (p.jenis === "tambah") return `+ ditambahkan: ${tampilNilai(p.ke)}`;
  if (p.jenis === "hapus") return `− dihapus: ${tampilNilai(p.dari)}`;
  return `${tampilNilai(p.dari)} → ${tampilNilai(p.ke)}`;
}

type Versi = { label: string; dokumen: Dokumen };

export function RiwayatLayar() {
  const { dok } = useDokumen();
  const [riwayat, setRiwayat] = useState<BarisRiwayat[] | null>(null);

  useEffect(() => {
    if (!awanTersedia()) return;
    let batal = false;
    muatRiwayat().then((r) => {
      if (!batal) setRiwayat(r);
    });
    return () => {
      batal = true;
    };
  }, []);

  return (
    <>
      <KepalaHalaman
        langkah="Riwayat"
        judul="Log Perubahan Dokumen"
        catatan="Setiap versi dokumen bersama, dari yang paling baru. Ditulis otomatis oleh trigger database tiap kali baris utama berubah — bukan oleh aplikasi ini, supaya tidak bisa dilewati bug atau sesi yang terputus di tengah simpan."
      />

      {!awanTersedia() ? (
        <Catatan>
          Riwayat cuma tersedia saat tersambung ke Supabase. Mode lokal (localStorage
          browser ini saja) tidak punya jejak versi — lihat status di topbar.
        </Catatan>
      ) : riwayat === null ? (
        <Catatan>Memuat riwayat…</Catatan>
      ) : riwayat.length === 0 ? (
        <Catatan>
          Belum ada riwayat tercatat. Baris pertama baru muncul di sini setelah
          simpanan BERIKUTNYA terjadi — riwayat mencatat versi SEBELUM tiap
          perubahan, jadi versi yang sedang berjalan sekarang belum punya versi
          yang mendahuluinya.
        </Catatan>
      ) : (
        <Timeline dokSekarang={dok} riwayat={riwayat} />
      )}
    </>
  );
}

function Timeline({ dokSekarang, riwayat }: { dokSekarang: Dokumen; riwayat: BarisRiwayat[] }) {
  /* `riwayat` datang terbaru dulu (disalin_pada desc). Dibalik supaya kronologis
     menua → sekarang, lalu tiap versi dibandingkan dengan TETANGGA SEBELUMNYA. */
  const lama = [...riwayat].reverse();
  const versi: Versi[] = [
    ...lama.map((r) => ({ label: waktu(r.updatedAt), dokumen: bacaDokumen(r.payload) })),
    { label: "Sekarang", dokumen: dokSekarang },
  ];

  const entri = versi.slice(1).map((v, i) => ({
    versi: v,
    perubahan: diffDokumen(versi[i].dokumen, v.dokumen),
  }));

  return (
    <div className="flex flex-col gap-4">
      {[...entri].reverse().map((e, i) => (
        <Kartu key={i}>
          <JudulBlok
            judul={e.versi.label}
            sub={
              e.perubahan.length === 0
                ? "Tidak ada perubahan terdeteksi dari versi sebelumnya."
                : `${e.perubahan.length} field berubah dari versi sebelumnya.`
            }
          />
          {e.perubahan.length > 0 ? (
            <Rincian>
              {e.perubahan.map((p, j) => (
                <BarisRincian key={j} label={labelPath(p.path)}>
                  <Angka className="whitespace-normal wrap-break-word text-right">
                    {teksPerubahan(p)}
                  </Angka>
                </BarisRincian>
              ))}
            </Rincian>
          ) : null}
        </Kartu>
      ))}
    </div>
  );
}
