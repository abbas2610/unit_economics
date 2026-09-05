"use client";

/**
 * Laporan cetak — satu klik dari "Export / Print PDF" di topbar.
 *
 * Bukan "cetak tab yang sedang dibuka": setiap tab adalah rute terpisah, jadi
 * tidak ada satu DOM yang berisi keempatnya sekaligus untuk dicetak bareng.
 * Halaman ini SATU-SATUNYA tempat isi empat tab (Asumsi Dasar, perbandingan
 * Supplier, Initial Investment, Unit Economics) digabung jadi satu dokumen —
 * lalu `window.print()` dipanggil sekali setelah render pertama.
 *
 * ## Ringkas, bukan lengkap
 *
 * Versi pertama menyalin HAMPIR SEMUA angka dari tiap tab dengan font sekecil
 * mungkin — hasilnya rapat tapi kosong: banyak baris turunan/sekunder (rata-rata
 * per mL, dimensi freight default) yang tidak ada di sini lagi. Yang tersisa
 * cuma angka yang benar-benar dibawa ke rapat: asumsi INPUT, bukan langkah
 * antara perhitungannya.
 *
 * Kontennya BUKAN kartu layar yang di-embed apa adanya. Kartu itu didesain
 * untuk layar interaktif dengan spacing lega; dipaksa masuk kertas 1 halaman
 * ia akan meluber. Yang dipakai di sini panel padat sendiri (`Panel`), dengan
 * skala font yang dinaikkan khusus untuk `.cetak-dokumen` (lihat globals.css)
 * supaya tetap terbaca jelas di kertas — skala LAYAR di theme.css tidak
 * tersentuh sama sekali.
 *
 * ⚠️ "1 halaman per bagian" adalah target desain untuk isi wajar (beberapa
 * varian, beberapa supplier), bukan jaminan matematis untuk daftar yang bisa
 * tumbuh tanpa batas.
 */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { liter, pcs, persen, rupiah, usd } from "@/bersama/format";
import { hitungCampuran } from "@/contexts/fragrance/domain/campuran";
import { totalLegalVarian } from "@/contexts/fragrance/domain/varian";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import { biayaSatuan, investasiSupplier } from "@/contexts/supplier/domain/supplier";
import type { Supplier } from "@/contexts/supplier/domain/supplier";
import {
  breakEven,
  grossProfitBatch,
  kapasitasCairan,
  qtyDiminta,
  unitEconomics,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
import type { RincianUnit } from "@/contexts/unit-economics/aplikasi/unit-economics";
import { useDokumen } from "@/components/dokumen-provider";

export function CetakLayar() {
  const { dok } = useDokumen();

  /* Tunggu satu tick render supaya layout & font selesai, baru panggil
     dialog print — memanggilnya di render pertama bisa menangkap halaman
     yang belum sempat mengukur tabel-tabelnya. */
  useEffect(() => {
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, []);

  const { asumsi, campuran, varian, legalPerVarian } = dok;
  const hasil = hitungCampuran(varian, campuran, asumsi);
  const legalTotal = totalLegalVarian(varian, legalPerVarian);

  const kapasitasKecil = kapasitasCairan(dok, "kecil");
  const kapasitasBesar = kapasitasCairan(dok, "besar");
  const dimintaKecil = qtyDiminta(dok, "kecil");
  const dimintaBesar = qtyDiminta(dok, "besar");

  const inv = initialInvestment(dok);
  const kecil = unitEconomics(dok, "kecil");
  const besar = unitEconomics(dok, "besar");
  const be = breakEven(kecil, besar, inv.total);
  const profitBatch = grossProfitBatch(kecil, besar);

  return (
    <div className="cetak-dokumen">
      {/* ══════════════════════════════════════ halaman 1 — asumsi dasar ══ */}
      <section className="cetak-halaman p-8">
        <Kop judul="Asumsi Dasar" nomor={1} />

        <Panel judul="Parameter Global">
          <GridKV kolom={3}>
            <KV label="Kurs USD → IDR">{rupiah(asumsi.kurs)}</KV>
            <KV label="Freight / CBM">{rupiah(asumsi.freightPerCBM)}</KV>
            <KV label="Perizinan botol">{persen(asumsi.perizinanPct)}</KV>
            <KV label="OEM botol kecil">{rupiah(asumsi.oemKecil)}</KV>
            <KV label="OEM botol besar">{rupiah(asumsi.oemBesar)}</KV>
            <KV label="Waste bahan baku">{persen(asumsi.wastePct)}</KV>
            <KV label="PPN">{persen(asumsi.ppnPct)}</KV>
            <KV label="Box + aksesoris packaging">
              {rupiah(asumsi.boxPackaging + asumsi.boxAksesoris)}
            </KV>
            <KV label="Fulfillment / botol">{rupiah(asumsi.fulfillment)}</KV>
            <KV label="Ukuran botol kecil">{asumsi.mlBotolKecil} ML</KV>
            <KV label="Ukuran botol besar">{asumsi.mlBotolBesar} ML</KV>
          </GridKV>
        </Panel>

        <Panel judul="Varian Fragrance Oil">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Varian</th>
                <th className="th text-right">Harga / Liter</th>
                <th className="th text-right">Qty Order</th>
              </tr>
            </thead>
            <tbody>
              {varian.map((v, i) => (
                <tr key={i}>
                  <td className="td">{v.nama}</td>
                  <td className="td text-right">{usd(v.usdPerLiter)}</td>
                  <td className="td text-right">{liter(v.qtyLiter)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2">
            <GridKV kolom={3}>
              <KV label="Total order fragrance">{liter(hasil.literFragrance)}</KV>
              <KV label={`Perizinan (BPOM+Halal × ${varian.length} varian)`}>
                {rupiah(legalTotal)}
              </KV>
              <KV label="">{""}</KV>
            </GridKV>
          </div>
        </Panel>

        <Panel judul="Hasil Produksi">
          <GridKV kolom={3}>
            <KV label="Komposisi fragrance oil">{persen(campuran.fragrancePct)}</KV>
            <KV label="Alokasi volume ke botol besar">{persen(campuran.alokasiBesarPct)}</KV>
            <KV label="Total campuran (pasca susut)">{liter(hasil.literPascaSusut)}</KV>
            <KV label="Hasil produksi — botol kecil">{pcs(hasil.pcsKecil)}</KV>
            <KV label="Hasil produksi — botol besar">{pcs(hasil.pcsBesar)}</KV>
            <KV label="">{""}</KV>
          </GridKV>
        </Panel>
      </section>

      {/* ═══════════════════════════════════ halaman 2 — supplier ══ */}
      <section className="cetak-halaman p-8">
        <Kop judul="Perbandingan Supplier" nomor={2} />

        {/* Bukan `TabelBanding` layar apa adanya: tabel itu merinci Molding
            dan Biaya variable sampai ke Botol/Cap/Silikon per baris — bagus
            di layar (lebar bebas), tapi dipaksa berdampingan Kecil|Besar di
            kertas MEMOTONG kolom supplier kedua (lihat riwayat git — "Model
            Batu (B)" hilang separuh). Kecil & Besar tetap FULL WIDTH,
            bertumpuk; yang dipadatkan rincinya jadi satu baris per komponen. */}
        <Panel judul={`Botol Kecil — ${asumsi.mlBotolKecil} ML`}>
          <TabelBandingRingkas
            daftar={dok.supplierKecil}
            kurs={asumsi.kurs}
            perizinanPct={asumsi.perizinanPct}
            diminta={dimintaKecil}
            kapasitas={kapasitasKecil}
          />
        </Panel>

        <Panel judul={`Botol Besar — ${asumsi.mlBotolBesar} ML`}>
          <TabelBandingRingkas
            daftar={dok.supplierBesar}
            kurs={asumsi.kurs}
            perizinanPct={asumsi.perizinanPct}
            diminta={dimintaBesar}
            kapasitas={kapasitasBesar}
          />
        </Panel>
      </section>

      {/* ═══════════════════════════════ halaman 3 — initial investment ══ */}
      <section className="cetak-halaman p-8">
        <Kop judul="Initial Investment" nomor={3} />

        <Panel judul="Ringkasan">
          <GridKV kolom={4}>
            <KV label="Total Initial Investment">{rupiah(inv.total)}</KV>
            <KV label="Investasi Produk">{rupiah(inv.produk)}</KV>
            <KV label="Investasi Marketing">{rupiah(inv.marketing)}</KV>
            <KV label="Total Pajak Termasuk">{rupiah(inv.totalPajak)}</KV>
          </GridKV>
        </Panel>

        <Panel judul="Category 1 — Produk">
          <Baris label={`Fragrance oil, termasuk PPN ${persen(dok.asumsi.ppnPct)}`}>
            {rupiah(inv.fragranceTotal)}
          </Baris>
          <Baris label="OEM (botol kecil + besar)">{rupiah(inv.oemTotal)}</Baris>
          <Baris label="Perizinan varian (BPOM + Halal)">{rupiah(inv.legalVarian)}</Baris>
          <Baris label="Total bahan baku" tebal>
            {rupiah(inv.bahanBaku)}
          </Baris>
          <Baris label={`Botol kecil — ${inv.supplierKecil?.nama ?? "-"}`}>
            {rupiah(inv.invKecil.total)}
          </Baris>
          <Baris label={`Botol besar — ${inv.supplierBesar?.nama ?? "-"}`}>
            {rupiah(inv.invBesar.total)}
          </Baris>
          <Baris label="Box packaging">{rupiah(inv.boxTotal)}</Baris>
          <Baris label="Total botol & packaging" tebal>
            {rupiah(inv.botolPacking)}
          </Baris>
          <Baris label="Fulfillment">{rupiah(inv.fulfillmentTotal)}</Baris>
          {dok.investasiCustom.map((c) => (
            <Baris key={c.id} label={c.label || "(tanpa nama)"}>
              {rupiah(c.nilai)}
            </Baris>
          ))}
          <Baris label="Total Investasi Produk" tebal>
            {rupiah(inv.produk)}
          </Baris>
        </Panel>

        <Panel judul="Category 2 — Marketing">
          <Baris label="Offline activation">{rupiah(dok.marketing.offline)}</Baris>
          <Baris label="Online activation">{rupiah(dok.marketing.online)}</Baris>
          <Baris label="Others">{rupiah(dok.marketing.lainnya)}</Baris>
          <Baris label="Total Marketing" tebal>
            {rupiah(inv.marketing)}
          </Baris>
        </Panel>
      </section>

      {/* ═══════════════════════════════════ halaman 4 — unit economics ══ */}
      <section className="cetak-halaman p-8">
        <Kop judul="Unit Economics per Botol" nomor={4} />

        <Panel judul="Ringkasan">
          <GridKV kolom={4}>
            <KV label="Gross Margin — Kecil">{persen(kecil.grossMargin)}</KV>
            <KV label="Gross Margin — Besar">{persen(besar.grossMargin)}</KV>
            <KV label="Proyeksi Gross Profit Batch">{rupiah(profitBatch)}</KV>
            <KV label="Break-even">{be === null ? "-" : pcs(be)}</KV>
          </GridKV>
        </Panel>

        <div className="grid grid-cols-2 gap-4">
          <Panel judul={`Botol Kecil — ${asumsi.mlBotolKecil} ML`}>
            <RincianSKU r={kecil} />
          </Panel>
          <Panel judul={`Botol Besar — ${asumsi.mlBotolBesar} ML`}>
            <RincianSKU r={besar} />
          </Panel>
        </div>
      </section>
    </div>
  );
}

/* ══════════════════════════════════════════════════ komponen padat ══ */

function Kop({ judul, nomor }: { judul: string; nomor: number }) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b-2 border-fg pb-2">
      <h1 className="text-page-title font-bold text-fg">{judul}</h1>
      <span className="text-meta text-fg-subtle">
        Societies of Strangers — Unit Economics · Halaman {nomor}/4
      </span>
    </div>
  );
}

function Panel({ judul, children }: { judul: string; children: ReactNode }) {
  return (
    <div className="mb-4 rounded-md border border-border" style={{ breakInside: "avoid" }}>
      <div className="rounded-t-[7px] border-b border-border bg-surface-muted px-3 py-1.5">
        <h2 className="text-label font-bold uppercase tracking-wide text-primary">{judul}</h2>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function GridKV({ kolom, children }: { kolom: 3 | 4; children: ReactNode }) {
  return (
    <div className={kolom === 4 ? "grid grid-cols-4 gap-x-4 gap-y-2" : "grid grid-cols-3 gap-x-4 gap-y-2"}>
      {children}
    </div>
  );
}

function KV({ label, children }: { label: string; children: ReactNode }) {
  if (!label) return <div />;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-meta text-fg-subtle">{label}</span>
      <span className="tabular text-body font-bold text-fg">{children}</span>
    </div>
  );
}

function Baris({ label, children, tebal }: { label: ReactNode; children: ReactNode; tebal?: boolean }) {
  return (
    <div
      className={
        tebal
          ? "flex items-baseline justify-between gap-2 border-t border-border-strong py-1 text-body font-bold text-fg"
          : "flex items-baseline justify-between gap-2 border-b border-border py-1 text-body text-fg-muted"
      }
    >
      <span>{label}</span>
      <span className="tabular text-fg">{children}</span>
    </div>
  );
}

/**
 * Perbandingan supplier, versi ringkas untuk cetak.
 *
 * BUKAN `TabelBanding` (layar) — itu merinci Molding dan Biaya variable
 * sampai ke baris Botol/Cap/Silikon, yang di kertas cuma menambah tinggi
 * tanpa menambah keputusan (pembandingnya tetap "Biaya botol / unit" di
 * baris terakhir). Setiap komponen di sini SATU baris, sekali total.
 */
function TabelBandingRingkas({
  daftar,
  kurs,
  perizinanPct,
  diminta,
  kapasitas,
}: {
  daftar: Supplier[];
  kurs: number;
  perizinanPct: number;
  diminta: number;
  kapasitas: number;
}) {
  if (daftar.length === 0) {
    return <p className="text-body text-fg-subtle">Belum ada supplier.</p>;
  }

  const baris = daftar.map((s) => {
    const inv = investasiSupplier(s, kurs, perizinanPct, diminta);
    const satuan = biayaSatuan(s, kurs, perizinanPct);
    return { sup: s, inv, satuan, jadi: Math.min(kapasitas, inv.qty) };
  });
  const termurah = Math.min(...baris.map((b) => b.satuan.totalLengkap));

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className="th">Komponen</th>
          {baris.map((b) => (
            <th key={b.sup.id} className="th text-right">
              {b.sup.nama}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <BarisBanding baris={baris} label="Qty dibeli" render={(b) => pcs(b.inv.qty)} />
        <BarisBanding baris={baris} label="Botol terisi" render={(b) => pcs(b.jadi)} />
        <BarisBanding baris={baris} label="Molding (sekali bayar)" render={(b) => rupiah(b.inv.molding)} />
        <BarisBanding baris={baris} label="Biaya variable + perizinan / pcs" render={(b) => rupiah(b.satuan.total)} />
        <BarisBanding baris={baris} label="Freight / pcs" render={(b) => rupiah(b.satuan.freight)} />
        <BarisBanding baris={baris} label="Total investasi" render={(b) => rupiah(b.inv.total)} tebal />
        <BarisBanding
          baris={baris}
          label="Biaya botol / unit (termasuk freight)"
          tebal
          render={(b) => (
            <>
              <span className={b.satuan.totalLengkap === termurah ? "text-naik" : ""}>
                {rupiah(b.satuan.totalLengkap)}
              </span>
              {b.satuan.totalLengkap === termurah ? (
                <span className="badge ml-2 bg-success-bg text-success-fg">termurah</span>
              ) : null}
            </>
          )}
        />
      </tbody>
    </table>
  );
}

type BarisBandingItem = {
  sup: Supplier;
  inv: ReturnType<typeof investasiSupplier>;
  satuan: ReturnType<typeof biayaSatuan>;
  jadi: number;
};

/** Satu baris tabel `TabelBandingRingkas` - komponen sendiri di luar render,
 *  bukan ditutup di dalamnya, supaya tidak dibuat ulang tiap render. */
function BarisBanding({
  baris,
  label,
  render,
  tebal,
}: {
  baris: BarisBandingItem[];
  label: string;
  render: (b: BarisBandingItem) => ReactNode;
  tebal?: boolean;
}) {
  return (
    <tr>
      <td className={tebal ? "td font-bold" : "td"}>{label}</td>
      {baris.map((b) => (
        <td key={b.sup.id} className={tebal ? "td text-right font-bold" : "td text-right"}>
          {render(b)}
        </td>
      ))}
    </tr>
  );
}

function RincianSKU({ r }: { r: RincianUnit }) {
  return (
    <>
      <Baris label="Fragrance oil">{rupiah(r.fragrance)}</Baris>
      <Baris label="OEM">{rupiah(r.oem)}</Baris>
      <Baris label="Botol (unit + perizinan + freight)">
        {rupiah(r.botol + r.freight)}
      </Baris>
      <Baris label="Aksesoris + cap">{rupiah(r.aksesoris)}</Baris>
      <Baris label="Box packaging">{rupiah(r.box)}</Baris>
      <Baris label="Fulfillment">{rupiah(r.fulfillment)}</Baris>
      {r.amortisasi > 0 ? <Baris label="Amortisasi molding">{rupiah(r.amortisasi)}</Baris> : null}
      <Baris label="Total COGS" tebal>
        {rupiah(r.cogs)}
      </Baris>
      <Baris label="Harga jual">{rupiah(r.harga)}</Baris>
      <Baris label="Gross profit / botol" tebal>
        {rupiah(r.grossProfit)}
      </Baris>
    </>
  );
}
