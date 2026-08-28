"use client";

/**
 * Tab 6 — Sensitivity Analysis.
 *
 * Tiga pertanyaan berbeda, dan memisahkannya penting karena ketiganya memakai
 * titik awal yang berbeda:
 *
 *   1. **Simulasi skenario** — geser beberapa variabel sekaligus, bandingkan
 *      dengan kondisi saat ini. Titik awalnya posisi slider.
 *   2. **Dampak per variabel** — satu variabel diguncang sekaligus, diurutkan.
 *      Titik awalnya KONDISI SAAT INI, bukan posisi slider; kalau ia mengikuti
 *      slider, urutan pengaruhnya berubah tiap kali seseorang menggeser hal lain.
 *   3. **Target penjualan** — berapa pcs untuk mencapai omzet tertentu. Memakai
 *      harga & COGS saat ini, bukan skenario.
 *
 * Yang menyatukan ketiganya: **tidak satu pun mengubah angka rencana.**
 */
import { pcs, persen, rupiah, usd } from "@/bersama/format";
import { simulasiDariDokumen } from "@/contexts/dokumen/domain/dokumen";
import type { Simulasi } from "@/contexts/dokumen/domain/dokumen";
import {
  hitungSemua,
  jalankanSkenario,
  targetPenjualan,
  tornado,
} from "@/contexts/sensitivitas/aplikasi/sensitivitas";
import { unitEconomics } from "@/contexts/unit-economics/aplikasi/unit-economics";
import { useDokumen } from "@/components/dokumen-provider";
import {
  Bidang,
  BungkusTabel,
  Catatan,
  IsianAngka,
  JudulBlok,
  KepalaHalaman,
  Kartu,
  Kpi,
  Nilai,
  PetakKpi,
} from "@/components/ui";

/** Rentang slider. Batasnya dipilih supaya nilai saat ini duduk di tengah. */
const SLIDER = [
  { kunci: "kurs", label: "Kurs USD/IDR", min: 10_000, maks: 25_000, langkah: 100, format: rupiah },
  {
    kunci: "freightPerCBM",
    label: "Tarif Freight per CBM",
    min: 3_000_000,
    maks: 12_000_000,
    langkah: 100_000,
    format: rupiah,
  },
  {
    kunci: "fragAvgUsdPerLiter",
    label: "Harga Fragrance Oil (rata-rata/L)",
    min: 1,
    maks: 5,
    langkah: 0.05,
    format: usd,
  },
  { kunci: "wastePct", label: "Waste", min: 0, maks: 60, langkah: 1, format: persen },
  { kunci: "susutPct", label: "Penyusutan Produksi", min: 0, maks: 40, langkah: 1, format: persen },
  {
    kunci: "hargaKecil",
    label: "Harga Jual Kecil",
    min: 100_000,
    maks: 400_000,
    langkah: 5_000,
    format: rupiah,
  },
  {
    kunci: "hargaBesar",
    label: "Harga Jual Besar",
    min: 150_000,
    maks: 600_000,
    langkah: 5_000,
    format: rupiah,
  },
] as const satisfies ReadonlyArray<{
  kunci: keyof Simulasi;
  label: string;
  min: number;
  maks: number;
  langkah: number;
  format: (n: number) => string;
}>;

export function SensitivitasLayar() {
  const { dok, ubah, beriKabar } = useDokumen();
  const sim = dok.simulasi;

  const acuan = hitungSemua(dok);
  const skenario = jalankanSkenario(dok, sim);
  const barisTornado = tornado(dok);

  const kecil = unitEconomics(dok, "kecil");
  const besar = unitEconomics(dok, "besar");
  const target = targetPenjualan(kecil, besar, sim.targetOmzet);

  const setSim = (kunci: keyof Simulasi, nilai: number) =>
    ubah((d) => ({ ...d, simulasi: { ...d.simulasi, [kunci]: nilai } }));

  return (
    <>
      <KepalaHalaman
        langkah="Langkah 6"
        judul="Sensitivity Analysis"
        catatan="Simulasi “bagaimana jika” tanpa mengubah data di tab 1–5. Geser variabel di bawah untuk melihat dampaknya, lalu bandingkan dengan kondisi saat ini."
      />

      <Kartu>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <JudulBlok
            judul="Simulasi Skenario"
            sub="Perubahan di sini hanya simulasi — Asumsi Dasar dan Initial Investment yang sebenarnya tidak ikut bergeser."
          />
          <button
            type="button"
            className="text-meta font-semibold text-primary hover:text-primary-hover"
            onClick={() => {
              ubah((d) => ({ ...d, simulasi: simulasiDariDokumen(d) }));
              beriKabar("Skenario disinkron ke asumsi saat ini");
            }}
          >
            ↺ sync ke asumsi &amp; harga saat ini
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {SLIDER.map((s) => (
            <div key={s.kunci} className="flex flex-col gap-1.5">
              <label className="flex items-baseline justify-between text-meta font-semibold text-fg-muted">
                <span>{s.label}</span>
                <span className="tabular text-primary">{s.format(sim[s.kunci])}</span>
              </label>
              <input
                type="range"
                min={s.min}
                max={s.maks}
                step={s.langkah}
                value={sim[s.kunci]}
                aria-label={s.label}
                onChange={(e) => setSim(s.kunci, Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
              />
            </div>
          ))}
        </div>
      </Kartu>

      {/* ─────────────────────── saat ini vs skenario ─────────────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            judul="Dampak: Saat Ini vs Skenario"
            sub="Supplier dan komposisi batch sama persis di kedua kolom — hanya variabel di atas yang diubah."
          />
          <BungkusTabel>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Metrik</th>
                  <th className="th text-right">Saat Ini</th>
                  <th className="th bg-primary-subtle text-right text-primary">Skenario</th>
                  <th className="th text-right">Selisih</th>
                </tr>
              </thead>
              <tbody>
                <BarisBanding
                  label="Total Initial Investment"
                  a={acuan.investasi.total}
                  b={skenario.investasi.total}
                  format={rupiah}
                  biaya
                />
                <BarisBanding
                  label="COGS Botol Kecil"
                  a={acuan.kecil.cogs}
                  b={skenario.kecil.cogs}
                  format={rupiah}
                  biaya
                />
                <BarisBanding
                  label="Gross Margin Kecil"
                  a={acuan.kecil.grossMargin}
                  b={skenario.kecil.grossMargin}
                  format={persen}
                  jenisSelisih="poin"
                />
                <BarisBanding
                  label="COGS Botol Besar"
                  a={acuan.besar.cogs}
                  b={skenario.besar.cogs}
                  format={rupiah}
                  biaya
                />
                <BarisBanding
                  label="Gross Margin Besar"
                  a={acuan.besar.grossMargin}
                  b={skenario.besar.grossMargin}
                  format={persen}
                  jenisSelisih="poin"
                />
                <tr>
                  <td className="td text-fg-muted">Break-even (unit terjual)</td>
                  <td className="td tabular text-right" data-numeric>
                    {acuan.breakEven === null ? "—" : pcs(acuan.breakEven)}
                  </td>
                  <td className="td tabular bg-primary-subtle/50 text-right" data-numeric>
                    {skenario.breakEven === null ? "—" : pcs(skenario.breakEven)}
                  </td>
                  <td className="td text-right" data-numeric>
                    {acuan.breakEven !== null && skenario.breakEven !== null ? (
                      <Nilai nilai={skenario.breakEven - acuan.breakEven} jenis="pcs" biaya />
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </BungkusTabel>
          <div className="mt-4">
            <Catatan>
              Kolom selisih break-even ditulis sebagai selisih <strong>jumlah pcs</strong> —
              tandanya mengikuti aturan biaya: lebih banyak pcs yang harus terjual adalah kabar
              buruk, jadi ia merah walau angkanya positif.
            </Catatan>
          </div>
        </Kartu>
      </div>

      {/* ──────────────────────────── tornado ──────────────────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            judul="Dampak per Variabel"
            sub="Satu variabel diguncang sekaligus, dihitung dari kondisi saat ini (bukan dari posisi slider di atas), lalu diurutkan dari yang paling menggeser gross margin gabungan."
          />
          <BungkusTabel>
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="th">Variabel</th>
                  <th className="th text-right">Δ Gross Margin (blended)</th>
                  <th className="th text-right">Δ Total Investasi</th>
                </tr>
              </thead>
              <tbody>
                {barisTornado.map((b) => (
                  <tr key={b.kunci}>
                    <td className="td text-fg-muted">{b.label}</td>
                    <td className="td text-right" data-numeric>
                      <Nilai nilai={b.deltaMarginPoin} jenis="poin" />
                    </td>
                    <td className="td text-right" data-numeric>
                      <Nilai nilai={b.deltaInvestasiPct} jenis="persen" biaya />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </BungkusTabel>
          <div className="mt-4">
            <Catatan>
              Kurs, freight, dan harga fragrance diguncang <strong>+10%</strong>; waste dan
              penyusutan <strong>+10 poin</strong>. Bedanya disengaja: menaikkan waste 30%
              &ldquo;sebesar 10%&rdquo; jadi 33% adalah guncangan yang jauh lebih kecil daripada
              yang dibayangkan pembacanya, dan urutan di tabel ini jadi tidak bisa dipercaya.
            </Catatan>
          </div>
        </Kartu>
      </div>

      {/* ────────────────────────── target omzet ────────────────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            judul="Target Penjualan"
            sub="Berdasarkan unit economics & harga jual SAAT INI — bukan skenario di atas."
          />
          <div className="max-w-sm">
            <Bidang label="Target omzet (total penjualan)">
              <IsianAngka
                nilai={sim.targetOmzet}
                awalan="Rp"
                ariaLabel="Target omzet"
                onUbah={(n) => setSim("targetOmzet", n)}
              />
            </Bidang>
          </div>

          <div className="mt-4">
            <PetakKpi>
              <Kpi label="Pcs Botol Kecil" nilai={pcs(target.pcsKecil)} keterangan="15 ML" />
              <Kpi
                label="Pcs Botol Besar"
                nilai={pcs(target.pcsBesar)}
                keterangan={`${dok.asumsi.mlBotolBesar} ML`}
              />
              <Kpi
                label="Total Pcs Terjual"
                nilai={pcs(target.totalPcs)}
                keterangan="kecil + besar"
                warna="primer"
              />
              <Kpi
                label="Proyeksi Gross Profit"
                nilai={<Nilai nilai={target.grossProfit} className="text-kpi" />}
                keterangan={`Omzet tercapai ${rupiah(target.omzetTercapai)}`}
              />
            </PetakKpi>
          </div>

          <div className="mt-4">
            <Catatan>
              ⚠️ Hitungan ini mengasumsikan botol kecil dan besar terjual{" "}
              <strong>sama banyak</strong> — bukan mengikuti komposisi batch, yang saat ini{" "}
              {pcs(kecil.qtyProduksi)} kecil berbanding {pcs(besar.qtyProduksi)} besar. Asumsinya berbeda
              dari yang dipakai break-even, jadi kedua angka tidak bisa langsung disandingkan.
            </Catatan>
          </div>
        </Kartu>
      </div>
    </>
  );
}

function BarisBanding({
  label,
  a,
  b,
  format,
  biaya,
  jenisSelisih = "rupiah",
}: {
  label: string;
  a: number;
  b: number;
  format: (n: number) => string;
  biaya?: boolean;
  jenisSelisih?: "rupiah" | "poin";
}) {
  return (
    <tr>
      <td className="td text-fg-muted">{label}</td>
      <td className="td tabular text-right" data-numeric>
        {format(a)}
      </td>
      <td className="td tabular bg-primary-subtle/50 text-right" data-numeric>
        {format(b)}
      </td>
      <td className="td text-right" data-numeric>
        <Nilai nilai={b - a} jenis={jenisSelisih} biaya={biaya} />
      </td>
    </tr>
  );
}
