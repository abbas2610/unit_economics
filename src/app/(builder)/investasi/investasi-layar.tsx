"use client";

/**
 * Tab 4 - Initial Investment.
 *
 * Yang dijawab halaman ini satu kalimat: berapa uang yang keluar sebelum botol
 * pertama terjual, dan ke mana perginya.
 *
 * Qty batch di sini **tidak bisa diketik**. Ia hasil produksi dari campuran di
 * tab 1, dan menyediakan kotak isian untuknya berarti membuat angka kedua yang
 * boleh berbeda dari volume cairan yang benar-benar ada - yang berarti membeli
 * botol untuk parfum yang tidak akan pernah jadi.
 */
import { pcs, persen, rupiah, rupiahRingkas } from "@/bersama/format";
import { boxPerBotol } from "@/contexts/asumsi/domain/asumsi";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import { useDokumen } from "@/components/dokumen-provider";
import {
  BarisRincian,
  Bidang,
  Donat,
  IsianAngka,
  IsianTeks,
  JudulBlok,
  KepalaHalaman,
  Kartu,
  Kpi,
  NilaiTurunan,
  Petak,
  PetakKpi,
  Rincian,
  KepalaRincian,
  Sakelar,
  Tombol,
  TombolHapus,
} from "@/components/ui";

export function InvestasiLayar() {
  const { dok, ubah } = useDokumen();
  const inv = initialInvestment(dok);
  const pctProduk = inv.total > 0 ? (inv.produk / inv.total) * 100 : 0;

  const tambahBiayaCustom = () =>
    ubah((d) => ({
      ...d,
      investasiCustom: [
        ...d.investasiCustom,
        { id: `invc${d.investasiCustom.length + 1}`, label: "", nilai: 0 },
      ],
    }));
  const setBiayaCustom = (id: string, fn: (c: (typeof dok.investasiCustom)[number]) => (typeof dok.investasiCustom)[number]) =>
    ubah((d) => ({ ...d, investasiCustom: d.investasiCustom.map((c) => (c.id === id ? fn(c) : c)) }));
  const hapusBiayaCustom = (id: string) =>
    ubah((d) => ({ ...d, investasiCustom: d.investasiCustom.filter((c) => c.id !== id) }));

  return (
    <>
      <KepalaHalaman
        langkah="Langkah 4"
        judul="Initial Investment"
        catatan="Pilih supplier yang dipakai untuk masing-masing ukuran botol, lalu atur anggaran marketing. Total sudah termasuk pajak - PPN fragrance dan perizinan botol menempel di komponennya masing-masing."
      />

      <Kartu>
        <div className="grid gap-4 md:grid-cols-3">
          <Bidang label={`Supplier botol kecil (${dok.asumsi.mlBotolKecil} ML)`}>
            <select
              className="h-control rounded-md border border-border bg-surface px-2.5 text-body text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              value={dok.pilihan.kecilId}
              onChange={(e) =>
                ubah((d) => ({ ...d, pilihan: { ...d.pilihan, kecilId: e.target.value } }))
              }
            >
              {dok.supplierKecil.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label={`Supplier botol besar (${dok.asumsi.mlBotolBesar} ML)`}>
            <select
              className="h-control rounded-md border border-border bg-surface px-2.5 text-body text-fg outline-none focus:border-primary focus:ring-2 focus:ring-primary/25"
              value={dok.pilihan.besarId}
              onChange={(e) =>
                ubah((d) => ({ ...d, pilihan: { ...d.pilihan, besarId: e.target.value } }))
              }
            >
              {dok.supplierBesar.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label="Perlakuan molding">
            <span className="flex h-control items-center">
              <Sakelar
                nyala={dok.opsi.amortisasiMolding}
                label="Amortisasi molding ke unit cost"
                onUbah={(n) =>
                  ubah((d) => ({ ...d, opsi: { ...d.opsi, amortisasiMolding: n } }))
                }
              />
            </span>
          </Bidang>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Bidang
            label="Qty produksi botol kecil (batch)"
            petunjuk={`(cairan cukup ${pcs(inv.kapasitasKecil)}, dibeli ${pcs(inv.invKecil.qty)})`}
          >
            <NilaiTurunan akhiran="pcs">{pcs(inv.qtyKecil).replace(" pcs", "")}</NilaiTurunan>
          </Bidang>
          <Bidang
            label="Qty produksi botol besar (batch)"
            petunjuk={`(cairan cukup ${pcs(inv.kapasitasBesar)}, dibeli ${pcs(inv.invBesar.qty)})`}
          >
            <NilaiTurunan akhiran="pcs">{pcs(inv.qtyBesar).replace(" pcs", "")}</NilaiTurunan>
          </Bidang>
        </div>
      </Kartu>

      <div className="mt-4">
        <PetakKpi>
          <Kpi
            label="Total Initial Investment"
            nilai={rupiah(inv.total)}
            keterangan="Produk + Marketing"
            warna="primer"
          />
          <Kpi
            label="Investasi Produk"
            nilai={rupiah(inv.produk)}
            keterangan={`${persen(pctProduk)} dari total`}
          />
          <Kpi
            label="Investasi Marketing"
            nilai={rupiah(inv.marketing)}
            keterangan={`${persen(100 - pctProduk)} dari total`}
          />
          <Kpi
            label="Total Pajak Termasuk"
            nilai={rupiah(inv.totalPajak)}
            keterangan="PPN + perizinan - sudah di dalam total, bukan tambahan"
          />
        </PetakKpi>
      </div>

      <div className="mt-4">
        <Petak>
          <Kartu>
            <JudulBlok
              judul="Rincian - Category 1: Produk"
              sub="Mengikuti supplier & asumsi yang sedang dipilih."
            />
            <Rincian>
              <KepalaRincian>Raw Materials</KepalaRincian>
              <BarisRincian label="Fragrance oil (semua varian)">
                {rupiah(inv.fragranceDasar)}
              </BarisRincian>
              <BarisRincian label={`PPN ${persen(dok.asumsi.ppnPct)} fragrance`}>
                {rupiah(inv.fragrancePPN)}
              </BarisRincian>
              <BarisRincian
                label={`OEM botol kecil (${pcs(inv.qtyKecil)} × ${rupiah(dok.asumsi.oemKecil)})`}
              >
                {rupiah(inv.qtyKecil * dok.asumsi.oemKecil)}
              </BarisRincian>
              <BarisRincian
                label={`OEM botol besar (${pcs(inv.qtyBesar)} × ${rupiah(dok.asumsi.oemBesar)})`}
              >
                {rupiah(inv.qtyBesar * dok.asumsi.oemBesar)}
              </BarisRincian>
              <BarisRincian
                label={`Perizinan varian - BPOM + Halal (${dok.varian.length} varian)`}
              >
                {rupiah(inv.legalVarian)}
              </BarisRincian>
              <BarisRincian label="Total bahan baku" jenis="subtotal">
                {rupiah(inv.bahanBaku)}
              </BarisRincian>

              <KepalaRincian>Botol &amp; Packaging</KepalaRincian>
              <BarisRincian label={`Botol kecil - ${inv.supplierKecil?.nama ?? "-"}`}>
                {rupiah(inv.invKecil.total)}
              </BarisRincian>
              <BarisRincian label={`Botol besar - ${inv.supplierBesar?.nama ?? "-"}`}>
                {rupiah(inv.invBesar.total)}
              </BarisRincian>
              <BarisRincian
                label={`Box packaging (${pcs(inv.totalBotol)} × ${rupiah(boxPerBotol(dok.asumsi))})`}
              >
                {rupiah(inv.boxTotal)}
              </BarisRincian>
              <BarisRincian label="Total botol & packaging" jenis="subtotal">
                {rupiah(inv.botolPacking)}
              </BarisRincian>

              <KepalaRincian>Fulfillment</KepalaRincian>
              <BarisRincian
                label={`Fulfillment (${pcs(inv.totalBotol)} × ${rupiah(dok.asumsi.fulfillment)})`}
              >
                {rupiah(inv.fulfillmentTotal)}
              </BarisRincian>

              {dok.investasiCustom.length > 0 ? (
                <>
                  <KepalaRincian>Biaya Custom</KepalaRincian>
                  {dok.investasiCustom.map((c) => (
                    <BarisRincian
                      key={c.id}
                      label={
                        <IsianTeks
                          nilai={c.label}
                          className="w-full"
                          ariaLabel="Nama biaya custom"
                          onUbah={(t) => setBiayaCustom(c.id, (x) => ({ ...x, label: t }))}
                        />
                      }
                    >
                      <span className="flex items-center gap-1.5">
                        <IsianAngka
                          nilai={c.nilai}
                          awalan="Rp"
                          className="w-32"
                          ariaLabel={`Nilai ${c.label || "biaya custom"}`}
                          onUbah={(n) => setBiayaCustom(c.id, (x) => ({ ...x, nilai: n }))}
                        />
                        <TombolHapus
                          label={`Hapus biaya ${c.label || "custom"}`}
                          onClick={() => hapusBiayaCustom(c.id)}
                        />
                      </span>
                    </BarisRincian>
                  ))}
                </>
              ) : null}

              <BarisRincian label="Total Investasi Produk" jenis="utama">
                {rupiah(inv.produk)}
              </BarisRincian>
            </Rincian>

            <div className="mt-3">
              <Tombol jenis="garis" onClick={tambahBiayaCustom}>
                + Tambah biaya
              </Tombol>
            </div>
          </Kartu>

          <div className="flex flex-col gap-4">
            <Kartu>
              <JudulBlok judul="Category 2: Marketing" sub="Bisa diubah langsung." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Bidang label="Offline activation">
                  <IsianAngka
                    nilai={dok.marketing.offline}
                    awalan="Rp"
                    ariaLabel="Marketing offline"
                    onUbah={(n) =>
                      ubah((d) => ({ ...d, marketing: { ...d.marketing, offline: n } }))
                    }
                  />
                </Bidang>
                <Bidang label="Online activation">
                  <IsianAngka
                    nilai={dok.marketing.online}
                    awalan="Rp"
                    ariaLabel="Marketing online"
                    onUbah={(n) =>
                      ubah((d) => ({ ...d, marketing: { ...d.marketing, online: n } }))
                    }
                  />
                </Bidang>
                <Bidang label="Others">
                  <IsianAngka
                    nilai={dok.marketing.lainnya}
                    awalan="Rp"
                    ariaLabel="Marketing lainnya"
                    onUbah={(n) =>
                      ubah((d) => ({ ...d, marketing: { ...d.marketing, lainnya: n } }))
                    }
                  />
                </Bidang>
              </div>
              <div className="mt-4">
                <Rincian>
                  <BarisRincian label="Total Marketing" jenis="utama">
                    {rupiah(inv.marketing)}
                  </BarisRincian>
                </Rincian>
              </div>
            </Kartu>

            <Kartu>
              <JudulBlok judul="Komposisi" />
              <Donat
                bagian={[
                  { label: "Produk", nilai: inv.produk },
                  { label: "Marketing", nilai: inv.marketing },
                ]}
                tengah={rupiahRingkas(inv.total)}
                labelTengah="Total"
              />
            </Kartu>
          </div>
        </Petak>
      </div>

    </>
  );
}
