"use client";

/**
 * Tab 2 & 3 — perbandingan supplier botol.
 *
 * Satu komponen untuk dua tab, dan itu bukan penghematan baris: keduanya
 * menjawab pertanyaan yang persis sama dengan aturan yang persis sama. Menulis
 * dua salinan berarti perbaikan di satu ukuran botol akan lupa dibawa ke yang
 * lain — dan bedanya tidak akan terlihat sampai ada yang membandingkan dua tab
 * berdampingan.
 *
 * Yang berbeda cuma daftar supplier mana yang disunting dan qty batch mana yang
 * dipakai; keduanya masuk lewat prop.
 */
import { angka, pcs, persen, rupiah, usd } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import type { UkuranBotol } from "@/contexts/asumsi/domain/asumsi";
import { pcsPerCBM } from "@/contexts/asumsi/domain/kemasan";
import {
  biayaSatuan,
  freightPerBotol,
  investasiSupplier,
  totalMolding,
} from "@/contexts/supplier/domain/supplier";
import type { MataUang, Supplier } from "@/contexts/supplier/domain/supplier";
import { idBerikutnya } from "@/contexts/dokumen/domain/migrasi";
import { qtyBatch } from "@/contexts/unit-economics/aplikasi/unit-economics";
import { useDokumen } from "./dokumen-provider";
import {
  Bidang,
  BungkusTabel,
  Catatan,
  IsianAngka,
  IsianTeks,
  JudulBlok,
  KepalaHalaman,
  Kartu,
  Sakelar,
  Segmen,
  Tombol,
  TombolHapus,
} from "./ui";

export function HalamanSupplier({ ukuran }: { ukuran: UkuranBotol }) {
  const { dok, ubah, beriKabar } = useDokumen();
  const kecil = ukuran === "kecil";
  const daftar = kecil ? dok.supplierKecil : dok.supplierBesar;
  const terpilihId = kecil ? dok.pilihan.kecilId : dok.pilihan.besarId;
  const batch = qtyBatch(dok, ukuran);
  const dimensi = kecil ? dok.dimensi.kecil : dok.dimensi.besar;

  const setDaftar = (fn: (d: Supplier[]) => Supplier[]) =>
    ubah((d) =>
      kecil ? { ...d, supplierKecil: fn(d.supplierKecil) } : { ...d, supplierBesar: fn(d.supplierBesar) },
    );

  const setSupplier = (id: string, fn: (s: Supplier) => Supplier) =>
    setDaftar((list) => list.map((s) => (s.id === id ? fn(s) : s)));

  const tambah = () =>
    ubah((d) => {
      const id = (kecil ? "s" : "l") + idBerikutnya(d);
      const baru: Supplier = {
        id,
        nama: "Supplier Baru",
        mataUang: kecil ? "USD" : "IDR",
        moq: 10_000,
        molding: { botol: 0, cap: 0, silikon: 0 },
        satuan: { botol: 0, cap: 0, aksesoris: 0 },
        freight: {
          aktif: true,
          pcsPerCBM: Math.round(pcsPerCBM(dimensi, d.asumsi.packingEfficiency)) || 1,
          ratePerCBM: d.asumsi.freightPerCBM,
        },
      };
      return kecil
        ? { ...d, supplierKecil: [...d.supplierKecil, baru] }
        : { ...d, supplierBesar: [...d.supplierBesar, baru] };
    });

  const hapus = (id: string) => {
    if (daftar.length <= 1) {
      beriKabar("Minimal satu supplier");
      return;
    }
    ubah((d) => {
      const sisa = (kecil ? d.supplierKecil : d.supplierBesar).filter((s) => s.id !== id);
      const pilihan = { ...d.pilihan };
      /* Kalau yang dihapus sedang dipakai Initial Investment, pilihannya harus
         ikut pindah. Membiarkannya menunjuk id yang tidak ada membuat halaman
         diam-diam jatuh ke supplier pertama — dengan angka penawaran berbeda,
         tanpa satu pun tanda di layar. */
      if (kecil && pilihan.kecilId === id) pilihan.kecilId = sisa[0]?.id ?? "";
      if (!kecil && pilihan.besarId === id) pilihan.besarId = sisa[0]?.id ?? "";
      return kecil
        ? { ...d, supplierKecil: sisa, pilihan }
        : { ...d, supplierBesar: sisa, pilihan };
    });
  };

  const label = kecil ? "Botol Kecil — 15 ML" : `Botol Besar — ${dok.asumsi.mlBotolBesar} ML`;

  return (
    <>
      <KepalaHalaman
        langkah={kecil ? "Langkah 2" : "Langkah 3"}
        judul={`Supplier ${label}`}
        catatan={
          kecil
            ? "Umumnya dari China (USD). Isi biaya molding (sekali bayar) dan harga satuan (per pcs) terpisah — supplier dengan molding mahal dan satuan murah menang pada volume besar dan kalah telak pada volume kecil."
            : "Rencana dari vendor Indonesia (IDR), termasuk molding cap sendiri. Struktur sama seperti botol kecil; mata uang bisa diganti ke USD bila ada opsi impor."
        }
      />

      <div className="flex flex-col gap-3">
        {daftar.map((sup) => (
          <KartuSupplier
            key={sup.id}
            sup={sup}
            terpilih={sup.id === terpilihId}
            batch={batch}
            kurs={dok.asumsi.kurs}
            perizinanPct={dok.asumsi.perizinanPct}
            onUbah={(fn) => setSupplier(sup.id, fn)}
            onHapus={() => hapus(sup.id)}
            onResetFreight={() => {
              setSupplier(sup.id, (s) => ({
                ...s,
                freight: {
                  ...s.freight,
                  pcsPerCBM: Math.round(pcsPerCBM(dimensi, dok.asumsi.packingEfficiency)) || 1,
                  ratePerCBM: dok.asumsi.freightPerCBM,
                },
              }));
              beriKabar("Freight direset ke default asumsi dasar");
            }}
          />
        ))}
      </div>

      <div className="mt-3">
        <Tombol jenis="garis" onClick={tambah}>
          + Tambah supplier {kecil ? "botol kecil" : "botol besar"}
        </Tombol>
      </div>

      <div className="mt-6">
        <Kartu>
          <JudulBlok
            judul={`Perbandingan Supplier — ${label}`}
            sub={`Kolom bertanda adalah supplier yang sedang dipakai Initial Investment. Total memakai qty MOQ atau qty batch (${pcs(batch)}), mana yang lebih besar.`}
          />
          <TabelBanding
            daftar={daftar}
            terpilihId={terpilihId}
            batch={batch}
            kurs={dok.asumsi.kurs}
            perizinanPct={dok.asumsi.perizinanPct}
          />
        </Kartu>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════ kartu editor ══ */

function KartuSupplier({
  sup,
  terpilih,
  batch,
  kurs,
  perizinanPct,
  onUbah,
  onHapus,
  onResetFreight,
}: {
  sup: Supplier;
  terpilih: boolean;
  batch: number;
  kurs: number;
  perizinanPct: number;
  onUbah: (fn: (s: Supplier) => Supplier) => void;
  onHapus: () => void;
  onResetFreight: () => void;
}) {
  const simbol = sup.mataUang === "USD" ? "$" : "Rp";
  const inv = investasiSupplier(sup, kurs, perizinanPct, batch);
  const cbm = sup.freight.pcsPerCBM > 0 ? inv.qty / sup.freight.pcsPerCBM : 0;

  return (
    <section
      className={cx(
        "card p-5",
        terpilih && "border-primary bg-primary-subtle/40",
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="min-w-[180px] flex-1">
          <IsianTeks
            nilai={sup.nama}
            ariaLabel="Nama supplier"
            onUbah={(s) => onUbah((x) => ({ ...x, nama: s }))}
          />
        </span>
        <Segmen<MataUang>
          label={`Mata uang ${sup.nama}`}
          nilai={sup.mataUang}
          pilihan={[
            { nilai: "IDR", label: "IDR" },
            { nilai: "USD", label: "USD $" },
          ]}
          onUbah={(m) => onUbah((x) => ({ ...x, mataUang: m }))}
        />
        {terpilih ? (
          <span className="badge bg-primary-subtle text-primary">dipakai</span>
        ) : null}
        <TombolHapus label={`Hapus ${sup.nama}`} onClick={onHapus} />
      </div>

      <p className="mb-2 text-label uppercase text-fg-muted">
        Fixed cost — molding (sekali bayar)
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Bidang label="Molding botol">
          <IsianAngka
            nilai={sup.molding.botol}
            awalan={simbol}
            ariaLabel="Molding botol"
            onUbah={(n) => onUbah((x) => ({ ...x, molding: { ...x.molding, botol: n } }))}
          />
        </Bidang>
        <Bidang label="Molding cap / tutup">
          <IsianAngka
            nilai={sup.molding.cap}
            awalan={simbol}
            ariaLabel="Molding cap"
            onUbah={(n) => onUbah((x) => ({ ...x, molding: { ...x.molding, cap: n } }))}
          />
        </Bidang>
        <Bidang label="Molding silikon / aksesoris">
          <IsianAngka
            nilai={sup.molding.silikon}
            awalan={simbol}
            ariaLabel="Molding silikon"
            onUbah={(n) => onUbah((x) => ({ ...x, molding: { ...x.molding, silikon: n } }))}
          />
        </Bidang>
      </div>

      <p className="mb-2 mt-5 text-label uppercase text-fg-muted">Variable cost — per unit</p>
      <div className="grid gap-3 sm:grid-cols-4">
        <Bidang label="Harga botol / pcs">
          <IsianAngka
            nilai={sup.satuan.botol}
            digit={2}
            awalan={simbol}
            ariaLabel="Harga botol per pcs"
            onUbah={(n) => onUbah((x) => ({ ...x, satuan: { ...x.satuan, botol: n } }))}
          />
        </Bidang>
        <Bidang label="Harga cap / pcs">
          <IsianAngka
            nilai={sup.satuan.cap}
            digit={2}
            awalan={simbol}
            ariaLabel="Harga cap per pcs"
            onUbah={(n) => onUbah((x) => ({ ...x, satuan: { ...x.satuan, cap: n } }))}
          />
        </Bidang>
        <Bidang label="Aksesoris / pcs">
          <IsianAngka
            nilai={sup.satuan.aksesoris}
            digit={2}
            awalan={simbol}
            ariaLabel="Aksesoris per pcs"
            onUbah={(n) => onUbah((x) => ({ ...x, satuan: { ...x.satuan, aksesoris: n } }))}
          />
        </Bidang>
        <Bidang label="Minimum order qty">
          <IsianAngka
            nilai={sup.moq}
            akhiran="pcs"
            ariaLabel="Minimum order quantity"
            onUbah={(n) => onUbah((x) => ({ ...x, moq: n }))}
          />
        </Bidang>
      </div>

      <div className="mt-5 rounded-md border border-border bg-surface-muted p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Sakelar
            nyala={sup.freight.aktif}
            label="Freight Forwarder"
            onUbah={(n) => onUbah((x) => ({ ...x, freight: { ...x.freight, aktif: n } }))}
          />
          <button
            type="button"
            onClick={onResetFreight}
            className="text-meta font-semibold text-primary hover:text-primary-hover"
          >
            ↺ pakai default asumsi dasar
          </button>
        </div>

        {sup.freight.aktif ? (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Bidang label="Pcs per CBM">
                <IsianAngka
                  nilai={sup.freight.pcsPerCBM}
                  akhiran="pcs"
                  ariaLabel="Pcs per CBM"
                  onUbah={(n) =>
                    onUbah((x) => ({ ...x, freight: { ...x.freight, pcsPerCBM: n } }))
                  }
                />
              </Bidang>
              <Bidang label="Rate per CBM">
                <IsianAngka
                  nilai={sup.freight.ratePerCBM}
                  awalan="Rp"
                  ariaLabel="Rate per CBM"
                  onUbah={(n) =>
                    onUbah((x) => ({ ...x, freight: { ...x.freight, ratePerCBM: n } }))
                  }
                />
              </Bidang>
              <Bidang label="Freight / botol (hasil)">
                <span className="flex h-control items-center px-0.5">
                  <span className="tabular text-body font-bold text-primary">
                    {rupiah(freightPerBotol(sup))}
                  </span>
                </span>
              </Bidang>
            </div>
            <p className="mt-3 text-meta text-fg-subtle">
              Total volume pengiriman: <strong>{pcs(inv.qty)}</strong> ÷ {angka(sup.freight.pcsPerCBM)}{" "}
              pcs/CBM = <strong>{cbm.toFixed(2).replace(".", ",")} CBM</strong> (biaya freight{" "}
              {rupiah(cbm * sup.freight.ratePerCBM)})
            </p>
          </>
        ) : (
          <p className="text-meta text-fg-subtle">
            Freight nonaktif — biayanya dianggap sudah termasuk harga vendor, dan tidak
            dihitung di COGS maupun Initial Investment.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-meta text-fg-muted">Total investasi (qty {pcs(inv.qty)})</p>
          <p className="mt-0.5 text-meta text-fg-subtle">
            Biaya botol per unit (variable): {rupiah(inv.satuan.total)}
          </p>
        </div>
        <p className="tabular text-card-title font-bold text-fg">{rupiah(inv.total)}</p>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════ tabel ══ */

function TabelBanding({
  daftar,
  terpilihId,
  batch,
  kurs,
  perizinanPct,
}: {
  daftar: Supplier[];
  terpilihId: string;
  batch: number;
  kurs: number;
  perizinanPct: number;
}) {
  const baris = daftar.map((s) => ({
    sup: s,
    inv: investasiSupplier(s, kurs, perizinanPct, batch),
    satuan: biayaSatuan(s, kurs, perizinanPct),
  }));
  const totalTermurah = Math.min(...baris.map((b) => b.inv.total));
  const unitTermurah = Math.min(...baris.map((b) => b.satuan.total));

  const kolomHi = (id: string) => (id === terpilihId ? "bg-primary-subtle/50" : "");

  return (
    <BungkusTabel>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="th rounded-tl-md">
              Komponen{" "}
              <span className="font-normal normal-case tracking-normal text-fg-subtle">
                (kurs terpakai {rupiah(kurs)}/USD)
              </span>
            </th>
            {baris.map((b) => (
              <th key={b.sup.id} className={cx("th text-right", kolomHi(b.sup.id))}>
                {b.sup.nama}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Baris label="MOQ" kolom={baris} hi={kolomHi} render={(b) => pcs(b.sup.moq)} />

          <BarisTumpuk
            label="Molding (sekali bayar)"
            kolom={baris}
            hi={kolomHi}
            item={(b) => [
              ["Botol", b.sup.molding.botol],
              ["Cap", b.sup.molding.cap],
              ["Silikon", b.sup.molding.silikon],
            ]}
            total={(b) => totalMolding(b.sup, kurs)}
            mataUang={(b) => b.sup.mataUang}
            kurs={kurs}
          />

          <BarisTumpuk
            label="Biaya variable / pcs"
            kolom={baris}
            hi={kolomHi}
            item={(b) => [
              ["Botol", b.sup.satuan.botol],
              ["Cap", b.sup.satuan.cap],
              ["Aksesoris", b.sup.satuan.aksesoris],
            ]}
            total={(b) => b.satuan.botol + b.satuan.aksesoris}
            labelTotal="Total /pcs"
            ekstra={(b) => [`Total beli (${pcs(b.inv.qty)})`, b.inv.botol + b.inv.aksesoris]}
            mataUang={(b) => b.sup.mataUang}
            kurs={kurs}
          />

          <Baris
            label={`Perizinan ${persen(perizinanPct)} (total)`}
            kolom={baris}
            hi={kolomHi}
            render={(b) => rupiah(b.inv.perizinan)}
          />

          <Baris
            label="Freight Forwarder"
            kolom={baris}
            hi={kolomHi}
            render={(b) =>
              b.sup.freight.aktif ? (
                <span className="flex flex-col items-end">
                  <span className="text-meta text-fg-subtle">
                    {angka(b.sup.freight.pcsPerCBM)} pcs/CBM @ {rupiah(b.sup.freight.ratePerCBM)}
                  </span>
                  <span>{rupiah(b.inv.freight)}</span>
                </span>
              ) : (
                <span className="text-fg-subtle">nonaktif</span>
              )
            }
          />

          <tr className="border-t border-border-strong">
            <td className="td font-semibold text-fg">Total investasi</td>
            {baris.map((b) => (
              <td
                key={b.sup.id}
                className={cx("td tabular text-right font-bold", kolomHi(b.sup.id))}
                data-numeric
              >
                <span className={b.inv.total === totalTermurah ? "text-naik" : "text-fg"}>
                  {rupiah(b.inv.total)}
                </span>
                {b.inv.total === totalTermurah ? (
                  <span className="badge ml-2 bg-success-bg text-success-fg">termurah</span>
                ) : null}
              </td>
            ))}
          </tr>
          <tr>
            <td className="td font-semibold text-fg">Biaya botol / unit</td>
            {baris.map((b) => (
              <td
                key={b.sup.id}
                className={cx("td tabular text-right font-bold", kolomHi(b.sup.id))}
                data-numeric
              >
                <span className={b.satuan.total === unitTermurah ? "text-naik" : "text-fg"}>
                  {rupiah(b.satuan.total)}
                </span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <Catatan>
          &ldquo;Termurah&rdquo; pada total investasi dan pada biaya per unit bisa jatuh ke
          supplier yang <strong>berbeda</strong>, dan itu bukan kesalahan hitung: yang satu
          menyerap molding, yang lain tidak. Yang menentukan mana yang relevan adalah berapa
          lama molding itu akan dipakai — satu batch, atau tiga tahun.
        </Catatan>
      </div>
    </BungkusTabel>
  );
}

type Kolom = {
  sup: Supplier;
  inv: ReturnType<typeof investasiSupplier>;
  satuan: ReturnType<typeof biayaSatuan>;
};

function Baris({
  label,
  kolom,
  hi,
  render,
}: {
  label: string;
  kolom: Kolom[];
  hi: (id: string) => string;
  render: (b: Kolom) => React.ReactNode;
}) {
  return (
    <tr>
      <td className="td text-fg-muted">{label}</td>
      {kolom.map((b) => (
        <td key={b.sup.id} className={cx("td tabular text-right", hi(b.sup.id))} data-numeric>
          {render(b)}
        </td>
      ))}
    </tr>
  );
}

/**
 * Sel bertumpuk: rincian komponen + totalnya.
 *
 * Nilai USD ditulis di sebelah rupiahnya, bukan menggantikannya. Kolom yang
 * cuma menampilkan `$0,48` memaksa pembaca mengalikan kurs di kepalanya untuk
 * membandingkannya dengan vendor lokal — dan seluruh guna tabel ini adalah
 * membandingkan keduanya.
 */
function BarisTumpuk({
  label,
  kolom,
  hi,
  item,
  total,
  labelTotal = "Total",
  ekstra,
  mataUang,
  kurs,
}: {
  label: string;
  kolom: Kolom[];
  hi: (id: string) => string;
  item: (b: Kolom) => Array<[string, number]>;
  total: (b: Kolom) => number;
  labelTotal?: string;
  ekstra?: (b: Kolom) => [string, number];
  mataUang: (b: Kolom) => MataUang;
  kurs: number;
}) {
  return (
    <tr>
      <td className="td text-fg-muted">{label}</td>
      {kolom.map((b) => {
        const mu = mataUang(b);
        const tambahan = ekstra?.(b);
        return (
          <td key={b.sup.id} className={cx("td text-right", hi(b.sup.id))}>
            <div className="ml-auto flex max-w-[240px] flex-col gap-1 rounded-md bg-surface-muted p-2">
              {item(b).map(([lbl, nilai]) => (
                <span key={lbl} className="flex items-baseline justify-between gap-3 text-meta">
                  <span className="text-fg-subtle">{lbl}</span>
                  <span className="tabular text-fg-muted">
                    {rupiah(mu === "USD" ? nilai * kurs : nilai)}
                    {mu === "USD" ? (
                      <span className="ml-1 text-fg-subtle">({usd(nilai)})</span>
                    ) : null}
                  </span>
                </span>
              ))}
              <span className="flex items-baseline justify-between gap-3 border-t border-border pt-1 text-meta font-semibold">
                <span className="text-fg-muted">{labelTotal}</span>
                <span className="tabular text-fg">{rupiah(total(b))}</span>
              </span>
              {tambahan ? (
                <span className="flex items-baseline justify-between gap-3 text-meta font-semibold">
                  <span className="text-fg-muted">{tambahan[0]}</span>
                  <span className="tabular text-fg">{rupiah(tambahan[1])}</span>
                </span>
              ) : null}
            </div>
          </td>
        );
      })}
    </tr>
  );
}
