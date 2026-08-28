"use client";

/**
 * Tab 4 — Initial Investment.
 *
 * Yang dijawab halaman ini satu kalimat: berapa uang yang keluar sebelum botol
 * pertama terjual, dan ke mana perginya.
 *
 * Qty batch di sini **tidak bisa diketik**. Ia hasil produksi dari campuran di
 * tab 1, dan menyediakan kotak isian untuknya berarti membuat angka kedua yang
 * boleh berbeda dari volume cairan yang benar-benar ada — yang berarti membeli
 * botol untuk parfum yang tidak akan pernah jadi.
 */
import { liter, pcs, persen, rupiah, rupiahRingkas } from "@/bersama/format";
import { boxPerBotol } from "@/contexts/asumsi/domain/asumsi";
import { initialInvestment } from "@/contexts/investasi/aplikasi/investasi";
import { useDokumen } from "@/components/dokumen-provider";
import {
  BarisRincian,
  Bidang,
  Catatan,
  Donat,
  IsianAngka,
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
} from "@/components/ui";

export function InvestasiLayar() {
  const { dok, ubah } = useDokumen();
  const inv = initialInvestment(dok);
  const pctProduk = inv.total > 0 ? (inv.produk / inv.total) * 100 : 0;

  return (
    <>
      <KepalaHalaman
        langkah="Langkah 4"
        judul="Initial Investment"
        catatan="Pilih supplier yang dipakai untuk masing-masing ukuran botol, lalu atur anggaran marketing. Total sudah termasuk pajak — PPN fragrance dan perizinan botol menempel di komponennya masing-masing."
      />

      <Kartu>
        <div className="grid gap-4 md:grid-cols-3">
          <Bidang label="Supplier botol kecil (15 ML)">
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
            keterangan="PPN + perizinan — sudah di dalam total, bukan tambahan"
          />
        </PetakKpi>
      </div>

      <div className="mt-4">
        <Petak>
          <Kartu>
            <JudulBlok
              judul="Rincian — Category 1: Produk"
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
                label={`Perizinan varian — BPOM + Halal (${dok.varian.length} varian)`}
              >
                {rupiah(inv.legalVarian)}
              </BarisRincian>
              <BarisRincian label="Total bahan baku" jenis="subtotal">
                {rupiah(inv.bahanBaku)}
              </BarisRincian>

              <KepalaRincian>Botol &amp; Packaging</KepalaRincian>
              <BarisRincian label={`Botol kecil — ${inv.supplierKecil?.nama ?? "—"}`}>
                {rupiah(inv.invKecil.total)}
              </BarisRincian>
              <BarisRincian label={`Botol besar — ${inv.supplierBesar?.nama ?? "—"}`}>
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

              <BarisRincian label="Total Investasi Produk" jenis="utama">
                {rupiah(inv.produk)}
              </BarisRincian>
            </Rincian>
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

      <div className="mt-4">
        <Kartu>
          <JudulBlok
            judul="Catatan MOQ, Kelebihan Stok & Sisa Cairan"
            sub="Dua arah yang berlawanan. MOQ yang melebihi pesanan meninggalkan botol tanpa isi; pesanan yang lebih kecil dari kapasitas meninggalkan cairan tanpa botol. Keduanya uang yang sudah keluar tanpa barang yang bisa dijual."
          />
          <Rincian>
            <BarisRincian label={`Botol kecil dibeli (terisi ${pcs(inv.qtyKecil)})`}>
              {pcs(inv.invKecil.qty)}
            </BarisRincian>
            <BarisRincian label="→ Kelebihan stok botol kecil">
              {inv.kelebihanKecil > 0 ? (
                <span className="text-warning-fg">
                  {pcs(inv.kelebihanKecil)} ({rupiah(inv.nilaiKelebihanKecil)})
                </span>
              ) : (
                <span className="text-naik">tidak ada</span>
              )}
            </BarisRincian>
            <BarisRincian label="→ Cairan botol kecil tanpa botol">
              {inv.mlTakTerbotolkanKecil > 0 ? (
                <span className="text-warning-fg">
                  {liter(inv.mlTakTerbotolkanKecil / 1000)} (setara{" "}
                  {pcs(inv.kapasitasKecil - inv.qtyKecil)})
                </span>
              ) : (
                <span className="text-naik">tidak ada</span>
              )}
            </BarisRincian>
            <BarisRincian label={`Botol besar dibeli (terisi ${pcs(inv.qtyBesar)})`}>
              {pcs(inv.invBesar.qty)}
            </BarisRincian>
            <BarisRincian label="→ Kelebihan stok botol besar">
              {inv.kelebihanBesar > 0 ? (
                <span className="text-warning-fg">
                  {pcs(inv.kelebihanBesar)} ({rupiah(inv.nilaiKelebihanBesar)})
                </span>
              ) : (
                <span className="text-naik">tidak ada</span>
              )}
            </BarisRincian>
            <BarisRincian label="→ Cairan botol besar tanpa botol">
              {inv.mlTakTerbotolkanBesar > 0 ? (
                <span className="text-warning-fg">
                  {liter(inv.mlTakTerbotolkanBesar / 1000)} (setara{" "}
                  {pcs(inv.kapasitasBesar - inv.qtyBesar)})
                </span>
              ) : (
                <span className="text-naik">tidak ada</span>
              )}
            </BarisRincian>
          </Rincian>
          <div className="mt-4">
            <Catatan>
              Nilai kelebihan stok memakai biaya botol per unit <strong>termasuk freight</strong> —
              botol yang terpaksa dibeli itu benar-benar ikut dikapalkan dan ikut dibayar per CBM.
              Molding tetap dikecualikan: ia dibayar penuh berapa pun qty-nya, jadi memasukkannya
              akan melebih-lebihkan modal yang tertahan sebagai barang di gudang.
            </Catatan>
          </div>
        </Kartu>
      </div>
    </>
  );
}
