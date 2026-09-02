"use client";

/**
 * Tab 5 — Unit Economics per botol, plus tabel skenario custom.
 *
 * Dua kartu SKU memakai skala batang yang SAMA (harga jual tertinggi di antara
 * keduanya bukan patokan; tiap batang diskalakan ke harga jualnya sendiri).
 * Yang dibandingkan antar kartu adalah PROPORSI — berapa bagian dari harga jual
 * yang dimakan biaya — bukan rupiahnya, dan proporsi itulah yang menentukan mana
 * SKU yang lebih layak didorong.
 */
import { persen, persenDelta, pcs, rupiah } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import { idBerikutnya } from "@/contexts/dokumen/domain/migrasi";
import {
  BARIS_SKENARIO,
  BARIS_TERKUNCI,
  cogsSkenario,
} from "@/contexts/unit-economics/domain/skenario";
import type { Skenario } from "@/contexts/unit-economics/domain/skenario";
import {
  breakEven,
  grossProfitBatch,
  unitEconomics,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
import type { RincianUnit } from "@/contexts/unit-economics/aplikasi/unit-economics";
import { useDokumen } from "@/components/dokumen-provider";
import {
  BarisRincian,
  BatangKomposisi,
  Bidang,
  BungkusTabel,
  Catatan,
  IsianAngka,
  IsianTeks,
  JudulBlok,
  KepalaHalaman,
  KepalaRincian,
  Kartu,
  Kpi,
  Nilai,
  Peringatan,
  Petak,
  PetakKpi,
  Rincian,
  Tombol,
  TombolHapus,
} from "@/components/ui";

export function UnitEconomicsLayar() {
  const { dok, ubah } = useDokumen();
  const kecil = unitEconomics(dok, "kecil");
  const besar = unitEconomics(dok, "besar");
  const inv = initialInvestment(dok);
  const be = breakEven(kecil, besar, inv.total);
  const profitBatch = grossProfitBatch(kecil, besar);

  return (
    <>
      <KepalaHalaman
        langkah="Langkah 5"
        judul="Unit Economics per Botol"
        catatan="Mengikuti supplier yang dipilih di Initial Investment. Ubah harga jual untuk melihat dampaknya ke gross profit — ingat royalti dihitung dari harga jual, jadi kenaikan harga tidak seluruhnya jatuh ke profit."
      />

      <PetakKpi>
        <Kpi
          label="Gross Margin — Kecil"
          nilai={persenDelta(kecil.grossMargin)}
          keterangan={`Harga ${rupiah(kecil.harga)} · COGS ${rupiah(kecil.cogs)}`}
          warna={kecil.grossMargin < 0 ? "turun" : "primer"}
        />
        <Kpi
          label="Gross Margin — Besar"
          nilai={persenDelta(besar.grossMargin)}
          keterangan={`Harga ${rupiah(besar.harga)} · COGS ${rupiah(besar.cogs)}`}
          warna={besar.grossMargin < 0 ? "turun" : "primer"}
        />
        <Kpi
          label="Proyeksi Gross Profit Batch"
          nilai={<Nilai nilai={profitBatch} className="text-kpi" />}
          keterangan={`${pcs(kecil.qtyProduksi)} kecil + ${pcs(besar.qtyProduksi)} besar, kalau seluruhnya terjual`}
        />
        <Kpi
          label="Break-even (unit terjual)"
          nilai={be === null ? "—" : pcs(be)}
          keterangan={
            be === null
              ? "Tidak akan balik modal pada harga ini"
              : "untuk menutup seluruh initial investment"
          }
          warna={be === null ? "turun" : "biasa"}
        />
      </PetakKpi>

      <div className="mt-4">
        <Petak>
          <KartuSKU judul="Botol Kecil — 15 ML" r={kecil} dok={dok} ubah={ubah} />
          <KartuSKU
            judul={`Botol Besar — ${dok.asumsi.mlBotolBesar} ML`}
            r={besar}
            dok={dok}
            ubah={ubah}
          />
        </Petak>
      </div>

      <div className="mt-4">
        <Kartu>
          <Catatan>
            Secara default molding <strong>tidak</strong> masuk COGS per botol — ia capex yang
            sudah dihitung penuh di Initial Investment, jadi memasukkannya di sini berarti
            menghitungnya dua kali kalau kedua angka dibaca berdampingan. Nyalakan{" "}
            <strong>Amortisasi molding</strong> di tab Initial Investment saat yang ditanya
            &ldquo;berapa biaya per unit sesungguhnya untuk batch ini&rdquo;.
          </Catatan>
        </Kartu>
      </div>

      <div className="mt-4">
        <TabelSkenario />
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════════ kartu SKU ══ */

function KartuSKU({
  judul,
  r,
  dok,
  ubah,
}: {
  judul: string;
  r: RincianUnit;
  dok: ReturnType<typeof useDokumen>["dok"];
  ubah: ReturnType<typeof useDokumen>["ubah"];
}) {
  const kecil = r.ukuran === "kecil";
  return (
    <Kartu>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-card-title text-fg">{judul}</h2>
        <span className="text-meta text-fg-subtle">{r.supplier?.nama ?? "—"}</span>
      </div>

      <Rincian>
        <KepalaRincian>Bahan Baku</KepalaRincian>
        <BarisRincian
          label={`Fragrance oil (rata-rata + waste ${persen(dok.asumsi.wastePct)} + PPN)`}
        >
          {rupiah(r.fragrance)}
        </BarisRincian>
        <BarisRincian label="OEM (biang jadi + pencampuran)">{rupiah(r.oem)}</BarisRincian>

        <KepalaRincian>Botol &amp; Packaging</KepalaRincian>
        <BarisRincian
          label={`Botol (unit + perizinan ${persen(dok.asumsi.perizinanPct)} + freight)`}
        >
          {rupiah(r.botol + r.freight)}
        </BarisRincian>
        <BarisRincian label="Aksesoris + cap">{rupiah(r.aksesoris)}</BarisRincian>
        <BarisRincian label="Box packaging">{rupiah(r.box)}</BarisRincian>

        <KepalaRincian>Fulfillment</KepalaRincian>
        <BarisRincian label="Fulfillment cost">{rupiah(r.fulfillment)}</BarisRincian>
        <BarisRincian label={`Royalti Miranti (${persen(dok.asumsi.mirantiPct)} dari harga jual)`}>
          {rupiah(r.royalti)}
        </BarisRincian>
        {/* Dua baris, bukan satu. Kelebihan MOQ dulu tidak muncul di mana pun
            walau toggle-nya menyala, padahal jumlahnya bisa sebanding molding —
            dan ia uang yang sama nyatanya. */}
        {dok.opsi.amortisasiMolding ? (
          <>
            <BarisRincian label={`Amortisasi molding (÷ ${pcs(r.qtyProduksi)})`}>
              {rupiah(r.amortisasiMolding)}
            </BarisRincian>
            {r.kelebihanBotol > 0 ? (
              <BarisRincian
                label={`Kelebihan MOQ ${pcs(r.kelebihanBotol)} (÷ ${pcs(r.qtyProduksi)})`}
              >
                {rupiah(r.amortisasiKelebihan)}
              </BarisRincian>
            ) : null}
          </>
        ) : null}

        <BarisRincian label="Total COGS / botol" jenis="subtotal">
          {rupiah(r.cogs)}
        </BarisRincian>
      </Rincian>

      <div className="mt-4">
        <Bidang label="Harga jual">
          <IsianAngka
            nilai={r.harga}
            awalan="Rp"
            ariaLabel={`Harga jual ${judul}`}
            onUbah={(n) =>
              ubah((d) => ({
                ...d,
                harga: kecil ? { ...d.harga, kecil: n } : { ...d.harga, besar: n },
              }))
            }
          />
        </Bidang>
      </div>

      <BatangKomposisi
        harga={r.harga}
        bagian={[
          { label: "Bahan baku", nilai: r.bahanBaku, kelas: "bg-primary" },
          { label: "Botol & packaging", nilai: r.botolPacking, kelas: "bg-brand" },
          {
            label: "Fulfillment & royalti",
            nilai: r.fulfillment + r.royalti + r.amortisasi,
            kelas: "bg-primary-disabled",
          },
        ]}
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
        <div>
          <p className="text-meta text-fg-muted">Gross profit / botol</p>
          <p className="mt-0.5">
            <Nilai nilai={r.grossProfit} className="text-card-title" />
          </p>
        </div>
        <Nilai nilai={r.grossMargin} jenis="persen" className="text-kpi" />
      </div>

      {r.grossMargin < 0 ? (
        <Peringatan>
          COGS melebihi harga jual sebesar <strong>{rupiah(r.cogs - r.harga)}</strong> per botol —
          tiap botol yang terjual menambah kerugian.
        </Peringatan>
      ) : null}
    </Kartu>
  );
}

/* ═══════════════════════════════════════════════════ skenario custom ══ */

function TabelSkenario() {
  const { dok, ubah } = useDokumen();
  const daftar = dok.skenario;

  const otomatis = (ukuran: UkuranBotol) => {
    const u = unitEconomics(dok, ukuran);
    /* Freight ikut baris "Botol" — ia bukan lagi sesuatu yang bisa diedit
       per skenario, mengikuti supplier & tarif freight yang sedang aktif. */
    return { fragrance: u.fragrance, botol: u.botol + u.freight, aksesoris: u.aksesoris };
  };

  const dariSaatIni = (ukuran: UkuranBotol, nama: string): Skenario => {
    const u = unitEconomics(dok, ukuran);
    return {
      id: "sc" + idBerikutnya(dok),
      nama,
      ukuran,
      harga: Math.round(u.harga),
      oem: Math.round(u.oem),
      box: Math.round(u.box),
      fulfillment: Math.round(u.fulfillment),
      royalti: Math.round(u.royalti),
    };
  };

  const setSkenario = (id: string, fn: (s: Skenario) => Skenario) =>
    ubah((d) => ({ ...d, skenario: d.skenario.map((s) => (s.id === id ? fn(s) : s)) }));

  return (
    <Kartu>
      <JudulBlok
        judul="Perbandingan Skenario Custom"
        sub={
          <>
            Baris <strong>🔒 Otomatis</strong> ikut asumsi &amp; supplier yang sedang aktif untuk
            ukuran botol yang dipilih kolom itu. Baris <strong>✎ Bisa diubah</strong> bebas
            diedit per skenario — di situlah pertanyaan &ldquo;kalau OEM-nya segini&rdquo;
            dijawab tanpa mengubah angka rencana.
          </>
        }
      />

      {daftar.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">
          Belum ada skenario. Tambahkan satu kolom untuk mulai membandingkan — kolom baru selalu
          diisi angka yang sedang berlaku, bukan nol.
        </p>
      ) : (
        <BungkusTabel>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="th">Skenario</th>
                {daftar.map((sc) => (
                  <th key={sc.id} className="th min-w-[180px] text-right">
                    <span className="flex items-center justify-end gap-1.5">
                      <IsianTeks
                        nilai={sc.nama}
                        className="flex-1"
                        ariaLabel={`Nama skenario ${sc.nama}`}
                        onUbah={(t) => setSkenario(sc.id, (s) => ({ ...s, nama: t }))}
                      />
                      <TombolHapus
                        label={`Hapus skenario ${sc.nama}`}
                        onClick={() =>
                          ubah((d) => ({
                            ...d,
                            skenario: d.skenario.filter((s) => s.id !== sc.id),
                          }))
                        }
                      />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="td text-fg-muted">Ukuran botol</td>
                {daftar.map((sc) => (
                  <td key={sc.id} className="td text-right">
                    <select
                      aria-label={`Ukuran botol ${sc.nama}`}
                      className="h-control-sm w-full rounded-sm border border-border bg-surface px-2 text-right text-body text-fg"
                      value={sc.ukuran}
                      onChange={(e) =>
                        setSkenario(sc.id, (s) => ({
                          ...s,
                          ukuran: e.target.value as UkuranBotol,
                        }))
                      }
                    >
                      <option value="kecil">Kecil</option>
                      <option value="besar">Besar</option>
                    </select>
                  </td>
                ))}
              </tr>

              <BarisIsian
                label="Harga jual"
                daftar={daftar}
                kunci="harga"
                onUbah={setSkenario}
              />

              <tr>
                <td colSpan={daftar.length + 1} className="th">
                  🔒 Otomatis — ikut ukuran botol &amp; supplier aktif
                </td>
              </tr>
              {BARIS_TERKUNCI.map(([kunci, label]) => (
                <tr key={kunci} className="bg-primary-subtle/30">
                  <td className="td text-primary">{label}</td>
                  {daftar.map((sc) => (
                    <td key={sc.id} className="td tabular text-right text-fg" data-numeric>
                      {rupiah(otomatis(sc.ukuran)[kunci])}
                    </td>
                  ))}
                </tr>
              ))}

              <tr>
                <td colSpan={daftar.length + 1} className="th">
                  ✎ Bisa diubah — custom per skenario
                </td>
              </tr>
              {BARIS_SKENARIO.map(([kunci, label]) => (
                <BarisIsian
                  key={kunci}
                  label={label}
                  daftar={daftar}
                  kunci={kunci}
                  onUbah={setSkenario}
                />
              ))}

              <tr className="border-t border-border-strong">
                <td className="td font-semibold text-fg">Total COGS</td>
                {daftar.map((sc) => (
                  <td key={sc.id} className="td tabular text-right font-bold text-fg" data-numeric>
                    {rupiah(cogsSkenario(sc, otomatis(sc.ukuran)))}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="td font-semibold text-fg">Gross profit / botol</td>
                {daftar.map((sc) => (
                  <td key={sc.id} className="td text-right" data-numeric>
                    <Nilai nilai={sc.harga - cogsSkenario(sc, otomatis(sc.ukuran))} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="td font-semibold text-fg">Gross margin</td>
                {daftar.map((sc) => {
                  const cogs = cogsSkenario(sc, otomatis(sc.ukuran));
                  const gpm = sc.harga > 0 ? ((sc.harga - cogs) / sc.harga) * 100 : 0;
                  return (
                    <td key={sc.id} className="td text-right" data-numeric>
                      <Nilai nilai={gpm} jenis="persen" />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </BungkusTabel>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Tombol
          jenis="garis"
          onClick={() =>
            ubah((d) => ({ ...d, skenario: [...d.skenario, dariSaatIni("kecil", "Skenario Kecil")] }))
          }
        >
          + Tambah skenario Botol Kecil
        </Tombol>
        <Tombol
          jenis="garis"
          onClick={() =>
            ubah((d) => ({ ...d, skenario: [...d.skenario, dariSaatIni("besar", "Skenario Besar")] }))
          }
        >
          + Tambah skenario Botol Besar
        </Tombol>
      </div>
    </Kartu>
  );
}

function BarisIsian({
  label,
  daftar,
  kunci,
  onUbah,
}: {
  label: string;
  daftar: Skenario[];
  kunci: "harga" | "oem" | "box" | "fulfillment" | "royalti";
  onUbah: (id: string, fn: (s: Skenario) => Skenario) => void;
}) {
  return (
    <tr className={cx("bg-success-bg/30")}>
      <td className="td text-naik">{label}</td>
      {daftar.map((sc) => (
        <td key={sc.id} className="td text-right">
          <IsianAngka
            nilai={sc[kunci]}
            className="w-full"
            ariaLabel={`${label} ${sc.nama}`}
            onUbah={(n) => onUbah(sc.id, (s) => ({ ...s, [kunci]: n }))}
          />
        </td>
      ))}
    </tr>
  );
}
