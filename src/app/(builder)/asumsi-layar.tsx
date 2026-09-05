"use client";

/**
 * Tab 1 - Asumsi Dasar.
 *
 * Diisi sekali, diikuti seluruh halaman lain. Susunannya mengikuti urutan orang
 * mengisinya, bukan urutan rumusnya: parameter yang datang dari luar (kurs,
 * tarif, pajak) dulu, lalu yang ditentukan sendiri (packaging, ukuran botol),
 * baru yang dihitung dari keduanya (campuran, hasil produksi, freight).
 */
import { liter, pcs as pcsTeks, persen, rupiah, usd } from "@/bersama/format";
import { jepit } from "@/bersama/masukan";
import { hitungCampuran } from "@/contexts/fragrance/domain/campuran";
import {
  idrPerML,
  nilaiPembelian,
  rataIdrPerLiter,
  rataUsdPerLiter,
  totalLegalVarian,
} from "@/contexts/fragrance/domain/varian";
import { freightPerBotolDasar, pcsPerCBM } from "@/contexts/asumsi/domain/kemasan";
import type { Dimensi } from "@/contexts/asumsi/domain/kemasan";
import { useDokumen } from "@/components/dokumen-provider";
import {
  BarisRincian,
  Bidang,
  Catatan,
  Donat,
  IsianAngka,
  IsianTeks,
  JudulBlok,
  KepalaHalaman,
  KepalaRincian,
  Kartu,
  NilaiTurunan,
  Petak,
  Rincian,
  Sublabel,
  Tombol,
  TombolHapus,
  Angka,
} from "@/components/ui";

export function AsumsiLayar() {
  const { dok, ubah } = useDokumen();
  const { asumsi, campuran, varian, legalPerVarian, dimensi } = dok;

  const setAsumsi = <K extends keyof typeof asumsi>(kunci: K, nilai: (typeof asumsi)[K]) =>
    ubah((d) => ({ ...d, asumsi: { ...d.asumsi, [kunci]: nilai } }));

  const hasil = hitungCampuran(varian, campuran, asumsi);
  const rataUsd = rataUsdPerLiter(varian);
  const legalTotal = totalLegalVarian(varian, legalPerVarian);
  const perVarian = legalPerVarian.bpom + legalPerVarian.halal;

  return (
    <>
      <KepalaHalaman
        langkah="Langkah 1"
        judul="Asumsi Dasar"
        catatan="Isi sekali di sini. Seluruh perhitungan supplier, initial investment, dan unit economics mengikuti angka-angka ini secara langsung."
      />

      <Petak>
        <Kartu>
          <JudulBlok
            nomor={1}
            judul="Parameter Global"
            sub="Berlaku untuk seluruh halaman."
          />

          <Sublabel>Kurs &amp; Ongkir</Sublabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Kurs USD → IDR">
              <IsianAngka
                nilai={asumsi.kurs}
                onUbah={(n) => setAsumsi("kurs", n)}
                awalan="Rp"
                ariaLabel="Kurs USD ke IDR"
              />
            </Bidang>
            <Bidang label="Freight Forwarder">
              <IsianAngka
                nilai={asumsi.freightPerCBM}
                onUbah={(n) => setAsumsi("freightPerCBM", n)}
                awalan="Rp"
                akhiran="/CBM"
                ariaLabel="Tarif freight per CBM"
              />
            </Bidang>
          </div>

          <Sublabel>Biaya OEM per Botol</Sublabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang
              label="Botol Kecil"
              petunjuk="(termasuk alkohol, aquadest, pencampuran)"
            >
              <IsianAngka
                nilai={asumsi.oemKecil}
                onUbah={(n) => setAsumsi("oemKecil", n)}
                awalan="Rp"
                ariaLabel="Biaya OEM botol kecil"
              />
            </Bidang>
            <Bidang
              label="Botol Besar"
              petunjuk="(termasuk alkohol, aquadest, pencampuran)"
            >
              <IsianAngka
                nilai={asumsi.oemBesar}
                onUbah={(n) => setAsumsi("oemBesar", n)}
                awalan="Rp"
                ariaLabel="Biaya OEM botol besar"
              />
            </Bidang>
          </div>

          <Sublabel>Rasio &amp; Pajak</Sublabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Packing efficiency">
              <IsianAngka
                nilai={asumsi.packingEfficiency}
                onUbah={(n) => setAsumsi("packingEfficiency", jepit(n, 1, 100))}
                akhiran="%"
                ariaLabel="Packing efficiency"
              />
            </Bidang>
            <Bidang label="Waste / penyusutan bahan">
              <IsianAngka
                nilai={asumsi.wastePct}
                onUbah={(n) => setAsumsi("wastePct", jepit(n, 0, 100))}
                akhiran="%"
                ariaLabel="Waste bahan baku"
              />
            </Bidang>
            <Bidang label="PPN">
              <IsianAngka
                nilai={asumsi.ppnPct}
                onUbah={(n) => setAsumsi("ppnPct", jepit(n, 0, 100))}
                akhiran="%"
                ariaLabel="PPN"
              />
            </Bidang>
            <Bidang label="Perizinan & legalitas" petunjuk="(% dari nilai botol)">
              <IsianAngka
                nilai={asumsi.perizinanPct}
                onUbah={(n) => setAsumsi("perizinanPct", jepit(n, 0, 100))}
                akhiran="%"
                ariaLabel="Perizinan botol"
              />
            </Bidang>
          </div>
        </Kartu>

        <Kartu>
          <JudulBlok
            nomor={2}
            judul="Ukuran Botol & Fulfillment"
            sub="Yang dipilih sendiri, bukan yang datang dari luar."
          />

          <Sublabel>Ukuran Botol</Sublabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Botol kecil">
              <IsianAngka
                nilai={asumsi.mlBotolKecil}
                akhiran="ML"
                ariaLabel="Ukuran botol kecil"
                onUbah={(n) => setAsumsi("mlBotolKecil", n)}
              />
            </Bidang>
            <Bidang label="Botol besar">
              <IsianAngka
                nilai={asumsi.mlBotolBesar}
                akhiran="ML"
                ariaLabel="Ukuran botol besar"
                onUbah={(n) => setAsumsi("mlBotolBesar", n)}
              />
            </Bidang>
          </div>
          <p className="mt-2 text-meta text-fg-subtle">Isi bebas - mL berapa pun bisa dipakai.</p>

          <Sublabel>Kemasan &amp; Fulfillment</Sublabel>
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Box packaging">
              <IsianAngka
                nilai={asumsi.boxPackaging}
                onUbah={(n) => setAsumsi("boxPackaging", n)}
                awalan="Rp"
                ariaLabel="Box packaging"
              />
            </Bidang>
            <Bidang label="Aksesoris box" petunjuk="(gift card, dll)">
              <IsianAngka
                nilai={asumsi.boxAksesoris}
                onUbah={(n) => setAsumsi("boxAksesoris", n)}
                awalan="Rp"
                ariaLabel="Aksesoris box"
              />
            </Bidang>
            <Bidang label="Fulfillment cost per botol">
              <IsianAngka
                nilai={asumsi.fulfillment}
                onUbah={(n) => setAsumsi("fulfillment", n)}
                awalan="Rp"
                ariaLabel="Fulfillment per botol"
              />
            </Bidang>
          </div>
        </Kartu>
      </Petak>

      {/* ─────────────────────────────── varian ─────────────────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            nomor={3}
            judul="Varian Fragrance Oil"
            sub="Harga biang parfum dari Perfume House (USD). Unit economics memakai rata-ratanya - selisih antar varian di bawah 0,02% terhadap COGS. Jumlah varian tidak dibatasi tiga."
          />

          <div className="flex flex-col gap-2.5">
            {varian.map((v, i) => (
              <div key={i} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
                <Bidang label={`Varian ${i + 1}`}>
                  <IsianTeks
                    nilai={v.nama}
                    ariaLabel={`Nama varian ${i + 1}`}
                    onUbah={(s) =>
                      ubah((d) => ({
                        ...d,
                        varian: d.varian.map((x, j) => (j === i ? { ...x, nama: s } : x)),
                      }))
                    }
                  />
                </Bidang>
                <Bidang label="Harga per liter">
                  <IsianAngka
                    nilai={v.usdPerLiter}
                    digit={2}
                    awalan="$"
                    ariaLabel={`Harga per liter varian ${i + 1}`}
                    onUbah={(n) =>
                      ubah((d) => ({
                        ...d,
                        varian: d.varian.map((x, j) => (j === i ? { ...x, usdPerLiter: n } : x)),
                      }))
                    }
                  />
                </Bidang>
                <Bidang label="Qty order">
                  <IsianAngka
                    nilai={v.qtyLiter}
                    akhiran="L"
                    ariaLabel={`Qty order varian ${i + 1}`}
                    onUbah={(n) =>
                      ubah((d) => ({
                        ...d,
                        varian: d.varian.map((x, j) => (j === i ? { ...x, qtyLiter: n } : x)),
                      }))
                    }
                  />
                </Bidang>
                <TombolHapus
                  label={`Hapus varian ${i + 1}`}
                  nonaktif={varian.length <= 1}
                  onClick={() =>
                    ubah((d) => ({ ...d, varian: d.varian.filter((_, j) => j !== i) }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="mt-3">
            <Tombol
              jenis="garis"
              onClick={() =>
                ubah((d) => ({
                  ...d,
                  varian: [
                    ...d.varian,
                    {
                      nama: "Varian Baru",
                      /* Harga awal = rata-rata yang ada, bukan 0. Varian baru
                         berharga nol menurunkan rata-rata seluruh COGS sampai
                         angkanya diisi - dan sementara itu layarnya menunjukkan
                         margin yang lebih baik daripada yang sebenarnya. */
                      usdPerLiter: rataUsdPerLiter(d.varian) || 2.4,
                      qtyLiter: 25,
                    },
                  ],
                }))
              }
            >
              + Tambah Varian
            </Tombol>
          </div>

          <div className="mt-4">
            <Rincian>
              <BarisRincian label="Rata-rata harga per liter" jenis="subtotal">
                {rupiah(rataIdrPerLiter(varian, asumsi.kurs))}
                <span className="ml-2 text-meta font-normal text-fg-subtle">
                  ({usd(rataUsd)})
                </span>
              </BarisRincian>
              <BarisRincian label="Setara per mL biang">
                {rupiah(idrPerML(varian, asumsi.kurs))}
              </BarisRincian>
              <BarisRincian label={`Total pembelian fragrance (semua varian, + PPN ${persen(asumsi.ppnPct)})`}>
                {rupiah(nilaiPembelian(varian, asumsi.kurs) * (1 + asumsi.ppnPct / 100))}
              </BarisRincian>
            </Rincian>
          </div>
        </Kartu>
      </div>

      {/* ────────────────────────── perizinan per varian ───────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            nomor={4}
            judul="Biaya Perizinan per Varian"
            sub={`BPOM & Sertifikat Halal dibayar per varian produk - otomatis dikalikan jumlah varian di atas (${varian.length} varian).`}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Bidang label="Perizinan BPOM / varian">
              <IsianAngka
                nilai={legalPerVarian.bpom}
                awalan="Rp"
                ariaLabel="Perizinan BPOM per varian"
                onUbah={(n) =>
                  ubah((d) => ({ ...d, legalPerVarian: { ...d.legalPerVarian, bpom: n } }))
                }
              />
            </Bidang>
            <Bidang label="Sertifikat Halal / varian">
              <IsianAngka
                nilai={legalPerVarian.halal}
                awalan="Rp"
                ariaLabel="Sertifikat halal per varian"
                onUbah={(n) =>
                  ubah((d) => ({ ...d, legalPerVarian: { ...d.legalPerVarian, halal: n } }))
                }
              />
            </Bidang>
          </div>
          <div className="mt-3">
            <Rincian>
              <BarisRincian label="Biaya per varian (BPOM + Halal)">
                {rupiah(perVarian)}
              </BarisRincian>
              <BarisRincian label={`Total Perizinan Varian (${varian.length} varian)`} jenis="subtotal">
                {rupiah(legalTotal)}
              </BarisRincian>
            </Rincian>
          </div>
        </Kartu>
      </div>

      {/* ────────────────────────────── campuran ────────────────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            nomor={5}
            judul="Komposisi & Hasil Campuran"
            sub="Dari total fragrance oil yang dibeli di atas: campuran jadi berapa liter, dan bisa jadi berapa botol. Angka ini yang dipakai sebagai qty batch di Initial Investment - ia diturunkan, tidak diisi manual."
          />

          <Sublabel>Komposisi</Sublabel>
          <div className="grid gap-4 sm:grid-cols-3">
            <Bidang label="Komposisi Fragrance Oil">
              <IsianAngka
                nilai={campuran.fragrancePct}
                digit={1}
                akhiran="%"
                ariaLabel="Komposisi fragrance oil"
                onUbah={(n) =>
                  ubah((d) => ({
                    ...d,
                    campuran: { ...d.campuran, fragrancePct: jepit(n, 0.1, 100) },
                  }))
                }
              />
            </Bidang>
            <Bidang
              label="Komposisi Non-Fragrance"
              petunjuk="(alkohol + aquadest, otomatis)"
            >
              <NilaiTurunan>{persen(hasil.nonFragrancePct)}</NilaiTurunan>
            </Bidang>
            <Bidang label="Penyusutan proses produksi">
              <IsianAngka
                nilai={campuran.susutPct}
                digit={1}
                akhiran="%"
                ariaLabel="Penyusutan proses produksi"
                onUbah={(n) =>
                  ubah((d) => ({ ...d, campuran: { ...d.campuran, susutPct: jepit(n, 0, 99) } }))
                }
              />
            </Bidang>
          </div>

          <div className="mt-4">
            <Rincian>
              <KepalaRincian>Rincian Campuran</KepalaRincian>
              <BarisRincian label="Fragrance oil (dari total order varian)">
                {liter(hasil.literFragrance)}
              </BarisRincian>
              <BarisRincian label="Non-fragrance (alkohol + aquadest)">
                {liter(hasil.literNonFragrance)}
              </BarisRincian>
              <BarisRincian label="Total campuran perfume" jenis="subtotal">
                {liter(hasil.totalLiter)}
              </BarisRincian>
              <BarisRincian label={`Pasca penyusutan ${persen(campuran.susutPct)}`}>
                {liter(hasil.literPascaSusut)}
              </BarisRincian>
            </Rincian>
          </div>

          <Sublabel>Alokasi ke Botol</Sublabel>
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <Bidang
                label="Alokasi volume ke botol besar"
                petunjuk="(sisanya otomatis ke botol kecil)"
              >
                <IsianAngka
                  nilai={campuran.alokasiBesarPct}
                  akhiran="%"
                  ariaLabel="Alokasi volume ke botol besar"
                  onUbah={(n) =>
                    ubah((d) => ({
                      ...d,
                      campuran: { ...d.campuran, alokasiBesarPct: jepit(n, 0, 100) },
                    }))
                  }
                />
              </Bidang>
              <p className="mt-3 text-meta text-fg-subtle">
                Alokasi ini berbasis <strong>volume</strong>, bukan jumlah botol. Membagi 50:50
                menghasilkan botol kecil jauh lebih banyak daripada botol besar, karena satu
                botol besar menghabiskan {asumsi.mlBotolBesar / asumsi.mlBotolKecil}× isi botol kecil.
              </p>
            </div>
            <Donat
              bagian={[
                { label: "Botol kecil", nilai: hasil.alokasiKecilPct },
                { label: "Botol besar", nilai: hasil.alokasiBesarPct },
              ]}
              tengah={liter(hasil.literPascaSusut)}
              labelTengah="Pasca penyusutan"
            />
          </div>

          <div className="mt-4">
            <Rincian>
              <BarisRincian label="Estimasi hasil produksi" jenis="utama">
                <Angka className="font-semibold text-primary">
                  {pcsTeks(hasil.pcsKecil)} kecil · {pcsTeks(hasil.pcsBesar)} besar
                </Angka>
              </BarisRincian>
            </Rincian>
          </div>
        </Kartu>
      </div>

      {/* ─────────────────────────────── freight ───────────────────────── */}
      <div className="mt-4">
        <Kartu>
          <JudulBlok
            nomor={6}
            judul="Freight Forwarder per Botol (default)"
            sub="Dihitung dari dimensi botol, packing efficiency, dan tarif per CBM di atas. Ini nilai default yang diwarisi supplier BARU - supplier yang sudah ada menyimpan angkanya sendiri dan tidak ikut berubah."
          />
          <Petak>
            <BlokDimensi
              judul={`Botol Kecil (${asumsi.mlBotolKecil} ML)`}
              d={dimensi.kecil}
              onUbah={(d) => ubah((x) => ({ ...x, dimensi: { ...x.dimensi, kecil: d } }))}
              pcsCbm={pcsPerCBM(dimensi.kecil, asumsi.packingEfficiency)}
              freight={freightPerBotolDasar(dimensi.kecil, asumsi)}
            />
            <BlokDimensi
              judul={`Botol Besar (${asumsi.mlBotolBesar} ML)`}
              d={dimensi.besar}
              onUbah={(d) => ubah((x) => ({ ...x, dimensi: { ...x.dimensi, besar: d } }))}
              pcsCbm={pcsPerCBM(dimensi.besar, asumsi.packingEfficiency)}
              freight={freightPerBotolDasar(dimensi.besar, asumsi)}
            />
          </Petak>
          <div className="mt-4">
            <Catatan>
              Efisiensi packing <strong>membagi</strong>, bukan mengalikan: ruang kosong di kardus
              tetap dikirim dan tetap dibayar, jadi tiap botol menempati volumenya sendiri dibagi{" "}
              {persen(asumsi.packingEfficiency)} - lebih besar dari volume botolnya.
            </Catatan>
          </div>
        </Kartu>
      </div>
    </>
  );
}

function BlokDimensi({
  judul,
  d,
  onUbah,
  pcsCbm,
  freight,
}: {
  judul: string;
  d: Dimensi;
  onUbah: (d: Dimensi) => void;
  pcsCbm: number;
  freight: number;
}) {
  return (
    <div>
      <p className="mb-3 text-label uppercase text-fg-muted">{judul}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <Bidang label="Panjang (cm)">
          <IsianAngka
            nilai={d.panjang}
            digit={2}
            ariaLabel={`Panjang ${judul}`}
            onUbah={(n) => onUbah({ ...d, panjang: n })}
          />
        </Bidang>
        <Bidang label="Lebar (cm)">
          <IsianAngka
            nilai={d.lebar}
            digit={2}
            ariaLabel={`Lebar ${judul}`}
            onUbah={(n) => onUbah({ ...d, lebar: n })}
          />
        </Bidang>
        <Bidang label="Tinggi (cm)">
          <IsianAngka
            nilai={d.tinggi}
            digit={2}
            ariaLabel={`Tinggi ${judul}`}
            onUbah={(n) => onUbah({ ...d, tinggi: n })}
          />
        </Bidang>
      </div>
      <div className="mt-3">
        <Rincian>
          <BarisRincian label="Pcs per CBM">
            {pcsTeks(pcsCbm)}
          </BarisRincian>
          <BarisRincian label="Freight per botol" jenis="subtotal">
            {rupiah(freight)}
          </BarisRincian>
        </Rincian>
      </div>
    </div>
  );
}
