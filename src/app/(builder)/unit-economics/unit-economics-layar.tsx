"use client";

/**
 * Tab 5 - Unit Economics per botol, plus tabel skenario custom.
 *
 * Dua kartu SKU memakai skala batang yang SAMA (harga jual tertinggi di antara
 * keduanya bukan patokan; tiap batang diskalakan ke harga jualnya sendiri).
 * Yang dibandingkan antar kartu adalah PROPORSI - berapa bagian dari harga jual
 * yang dimakan biaya - bukan rupiahnya, dan proporsi itulah yang menentukan mana
 * SKU yang lebih layak didorong.
 */
import { persen, persenDelta, pcs, rupiah } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import { idBerikutnya } from "@/contexts/dokumen/domain/migrasi";
import { BARIS_KOMPONEN, cogsSkenario } from "@/contexts/unit-economics/domain/skenario";
import type { KomponenSkenario, Skenario } from "@/contexts/unit-economics/domain/skenario";
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
        catatan="Mengikuti supplier yang dipilih di Initial Investment. Ubah harga jual untuk melihat dampaknya ke gross profit."
      />

      <PetakKpi>
        <Kpi
          label="Gross Margin - Kecil"
          nilai={persenDelta(kecil.grossMargin)}
          keterangan={`Harga ${rupiah(kecil.harga)} · COGS ${rupiah(kecil.cogs)}`}
          warna={kecil.grossMargin < 0 ? "turun" : "primer"}
        />
        <Kpi
          label="Gross Margin - Besar"
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
          nilai={be === null ? "-" : pcs(be)}
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
          <KartuSKU
            judul={`Botol Kecil - ${dok.asumsi.mlBotolKecil} ML`}
            r={kecil}
            dok={dok}
            ubah={ubah}
          />
          <KartuSKU
            judul={`Botol Besar - ${dok.asumsi.mlBotolBesar} ML`}
            r={besar}
            dok={dok}
            ubah={ubah}
          />
        </Petak>
      </div>

      <div className="mt-4">
        <SkenarioCustom />
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
        <span className="text-meta text-fg-subtle">{r.supplier?.nama ?? "-"}</span>
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
        {/* Dua baris, bukan satu. Kelebihan MOQ dulu tidak muncul di mana pun
            walau toggle-nya menyala, padahal jumlahnya bisa sebanding molding -
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
            label: "Fulfillment",
            nilai: r.fulfillment + r.amortisasi,
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
          COGS melebihi harga jual sebesar <strong>{rupiah(r.cogs - r.harga)}</strong> per botol -
          tiap botol yang terjual menambah kerugian.
        </Peringatan>
      ) : null}
    </Kartu>
  );
}

/* ═══════════════════════════════════════════════════ skenario custom ══ */

/** Nilai baku "kalau dipakai sekarang" untuk satu ukuran - sumber tombol ↺. */
const otomatisSekarang = (
  dok: ReturnType<typeof useDokumen>["dok"],
  ukuran: UkuranBotol,
): KomponenSkenario => {
  const u = unitEconomics(dok, ukuran);
  /* Freight ikut baris "Botol" - sama seperti perizinan, bagian dari harga
     botol, bukan komponen yang berdiri sendiri. */
  return {
    fragrance: u.fragrance,
    botol: u.botol + u.freight,
    aksesoris: u.aksesoris,
    oem: u.oem,
    box: u.box,
    fulfillment: u.fulfillment,
  };
};

function SkenarioCustom() {
  const { dok, ubah } = useDokumen();
  const daftar = dok.skenario;

  const dariSaatIni = (ukuran: UkuranBotol, nama: string): Skenario => {
    const u = unitEconomics(dok, ukuran);
    return {
      id: "sc" + idBerikutnya(dok),
      nama,
      ukuran,
      harga: Math.round(u.harga),
      fragrance: Math.round(u.fragrance),
      botol: Math.round(u.botol + u.freight),
      aksesoris: Math.round(u.aksesoris),
      oem: Math.round(u.oem),
      box: Math.round(u.box),
      fulfillment: Math.round(u.fulfillment),
      custom: [],
    };
  };

  const setSkenario = (id: string, fn: (s: Skenario) => Skenario) =>
    ubah((d) => ({ ...d, skenario: d.skenario.map((s) => (s.id === id ? fn(s) : s)) }));

  return (
    <Kartu>
      <JudulBlok
        judul="Perbandingan Skenario Custom"
        aksen
        sub={
          <>
            Tiap kartu adalah rencana sendiri - semua angkanya bisa diedit bebas, termasuk
            fragrance/botol/aksesoris yang tadinya ikut asumsi &amp; supplier aktif. Klik{" "}
            <strong>↺</strong> di sebelah angka itu untuk menyalin ulang angka yang berlaku
            sekarang. Tombol <strong>+ Tambah komponen</strong> di tiap kartu untuk biaya yang
            tidak ada padanannya di tab lain sama sekali.
          </>
        }
      />

      {daftar.length === 0 ? (
        <p className="py-3 text-body text-fg-subtle">
          Belum ada skenario. Tambahkan satu kartu untuk mulai membandingkan - kartu baru selalu
          diisi angka yang sedang berlaku, bukan nol.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {daftar.map((sc) => (
            <KartuSkenario
              key={sc.id}
              sc={sc}
              otomatis={otomatisSekarang(dok, sc.ukuran)}
              onUbah={(fn) => setSkenario(sc.id, fn)}
              onHapus={() =>
                ubah((d) => ({ ...d, skenario: d.skenario.filter((s) => s.id !== sc.id) }))
              }
            />
          ))}
        </div>
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

function KartuSkenario({
  sc,
  otomatis,
  onUbah,
  onHapus,
}: {
  sc: Skenario;
  otomatis: KomponenSkenario;
  onUbah: (fn: (s: Skenario) => Skenario) => void;
  onHapus: () => void;
}) {
  const cogs = cogsSkenario(sc);
  const gpm = sc.harga > 0 ? ((sc.harga - cogs) / sc.harga) * 100 : 0;

  const tambahCustom = () =>
    onUbah((s) => ({
      ...s,
      custom: [...s.custom, { id: `${s.id}-cust${s.custom.length + 1}`, label: "", nilai: 0 }],
    }));
  const setCustom = (id: string, fn: (c: Skenario["custom"][number]) => Skenario["custom"][number]) =>
    onUbah((s) => ({ ...s, custom: s.custom.map((c) => (c.id === id ? fn(c) : c)) }));
  const hapusCustom = (id: string) =>
    onUbah((s) => ({ ...s, custom: s.custom.filter((c) => c.id !== id) }));

  return (
    <section className="card overflow-hidden p-0">
      <div className="flex items-center gap-1.5 border-b border-primary/20 bg-primary-subtle px-5 py-3">
        <IsianTeks
          nilai={sc.nama}
          className="flex-1 font-semibold"
          ariaLabel={`Nama skenario ${sc.nama}`}
          onUbah={(t) => onUbah((s) => ({ ...s, nama: t }))}
        />
        <TombolHapus label={`Hapus skenario ${sc.nama}`} onClick={onHapus} />
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Ukuran botol">
            <select
              aria-label={`Ukuran botol ${sc.nama}`}
              className="h-control w-full rounded-md border border-border bg-surface px-2.5 text-body text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              value={sc.ukuran}
              onChange={(e) => onUbah((s) => ({ ...s, ukuran: e.target.value as UkuranBotol }))}
            >
              <option value="kecil">Kecil</option>
              <option value="besar">Besar</option>
            </select>
          </Bidang>
          <div className="rounded-md border border-primary/40 bg-primary-subtle p-2">
            <Bidang label="Harga jual">
              <IsianAngka
                nilai={sc.harga}
                awalan="Rp"
                className="bg-surface font-bold text-primary"
                ariaLabel={`Harga jual ${sc.nama}`}
                onUbah={(n) => onUbah((s) => ({ ...s, harga: n }))}
              />
            </Bidang>
          </div>
        </div>

        <div className="mt-4">
          <Rincian>
            {BARIS_KOMPONEN.map(({ kunci, label }) => (
              <BarisRincian key={kunci} label={label}>
                <span className="flex items-center gap-1.5">
                  <IsianAngka
                    nilai={sc[kunci]}
                    awalan="Rp"
                    className="w-32"
                    ariaLabel={`${label} - ${sc.nama}`}
                    onUbah={(n) => onUbah((s) => ({ ...s, [kunci]: n }))}
                  />
                  <button
                    type="button"
                    onClick={() => onUbah((s) => ({ ...s, [kunci]: otomatis[kunci] }))}
                    title={`Pakai angka ${label} yang berlaku sekarang: ${rupiah(otomatis[kunci])}`}
                    aria-label={`Pakai angka ${label} saat ini`}
                    className="flex h-control-sm w-control-sm shrink-0 items-center justify-center rounded-sm border border-border text-fg-subtle transition-colors hover:border-primary hover:bg-primary-subtle hover:text-primary"
                  >
                    ↺
                  </button>
                </span>
              </BarisRincian>
            ))}

            {sc.custom.map((c) => (
              <BarisRincian
                key={c.id}
                label={
                  <IsianTeks
                    nilai={c.label}
                    className="w-full"
                    ariaLabel="Nama komponen custom"
                    onUbah={(t) => setCustom(c.id, (x) => ({ ...x, label: t }))}
                  />
                }
              >
                <span className="flex items-center gap-1.5">
                  <IsianAngka
                    nilai={c.nilai}
                    awalan="Rp"
                    className="w-32"
                    ariaLabel={`Nilai ${c.label || "komponen custom"}`}
                    onUbah={(n) => setCustom(c.id, (x) => ({ ...x, nilai: n }))}
                  />
                  <TombolHapus
                    label={`Hapus komponen ${c.label || "custom"}`}
                    onClick={() => hapusCustom(c.id)}
                  />
                </span>
              </BarisRincian>
            ))}

            <BarisRincian label="Total COGS" jenis="subtotal">
              {rupiah(cogs)}
            </BarisRincian>
          </Rincian>
        </div>

        <div className="mt-3">
          <Tombol jenis="garis" onClick={tambahCustom}>
            + Tambah komponen
          </Tombol>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-border bg-surface-muted p-3">
          <div>
            <p className="text-meta text-fg-muted">Gross profit / botol</p>
            <p className="mt-0.5">
              <Nilai nilai={sc.harga - cogs} className="text-card-title" />
            </p>
          </div>
          <Nilai nilai={gpm} jenis="persen" className="text-kpi" />
        </div>
      </div>
    </section>
  );
}
