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
import { kapasitasCairan, qtyDiminta } from "@/contexts/unit-economics/aplikasi/unit-economics";
import { liter } from "@/bersama/format";
import { mlBotol } from "@/contexts/asumsi/domain/asumsi";
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
  NilaiTurunan,
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
  /* TIGA angka yang dulu satu. `kapasitas` = berapa botol cairannya cukup;
     `diminta` = berapa yang dipesan (bisa lebih kecil — pembelian sampel);
     yang DIBAYAR tiap supplier = max(MOQ, diminta), dihitung per kolom. */
  const kapasitas = kapasitasCairan(dok, ukuran);
  const diminta = qtyDiminta(dok, ukuran);
  const pembelianManual = (kecil ? dok.pembelian?.kecil : dok.pembelian?.besar) ?? null;
  const dimensi = kecil ? dok.dimensi.kecil : dok.dimensi.besar;

  const setPembelian = (n: number | null) =>
    ubah((d) => ({
      ...d,
      pembelian: kecil ? { ...d.pembelian, kecil: n } : { ...d.pembelian, besar: n },
    }));

  const pakaiSupplier = (id: string) =>
    ubah((d) => ({
      ...d,
      pilihan: kecil ? { ...d.pilihan, kecilId: id } : { ...d.pilihan, besarId: id },
    }));

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

      <div className="mb-5">
        <Kartu>
          <JudulBlok
            judul="Qty botol yang dibeli"
            sub="Berapa botol yang benar-benar dipesan ke supplier. Ini yang mengalikan seluruh harga satuan di bawah — bukan MOQ."
          />
          <div className="grid gap-4 md:grid-cols-3">
            <Bidang label="Dasar pemesanan">
              <span className="flex h-control items-center">
                <Sakelar
                  nyala={pembelianManual === null}
                  label="Ikuti kapasitas cairan"
                  onUbah={(n) => setPembelian(n ? null : kapasitas)}
                />
              </span>
            </Bidang>

            <Bidang
              label="Qty dipesan"
              petunjuk={pembelianManual === null ? "(otomatis)" : undefined}
            >
              {pembelianManual === null ? (
                <NilaiTurunan akhiran="pcs">{angka(kapasitas)}</NilaiTurunan>
              ) : (
                <IsianAngka
                  nilai={pembelianManual}
                  akhiran="pcs"
                  ariaLabel="Qty botol yang dipesan"
                  onUbah={(n) => setPembelian(n)}
                />
              )}
            </Bidang>

            <Bidang label="Kapasitas cairan" petunjuk="(batas atas produksi)">
              <NilaiTurunan akhiran="pcs">{angka(kapasitas)}</NilaiTurunan>
            </Bidang>
          </div>

          {diminta < kapasitas ? (
            <div className="mt-4">
              <Catatan>
                Memesan <strong>{pcs(diminta)}</strong> sementara cairannya cukup untuk{" "}
                <strong>{pcs(kapasitas)}</strong>. Sisa{" "}
                <strong>{liter(((kapasitas - diminta) * mlBotol(dok.asumsi, ukuran)) / 1000)}</strong>{" "}
                tidak akan terbotolkan — biang, alkohol, dan OEM-nya sudah dibayar tapi tidak jadi
                barang yang bisa dijual. Angkanya muncul di Initial Investment.
              </Catatan>
            </div>
          ) : null}
        </Kartu>
      </div>

      <div className="flex flex-col gap-3">
        {daftar.map((sup) => (
          <KartuSupplier
            key={sup.id}
            sup={sup}
            terpilih={sup.id === terpilihId}
            diminta={diminta}
            kapasitas={kapasitas}
            kurs={dok.asumsi.kurs}
            perizinanPct={dok.asumsi.perizinanPct}
            onPakai={() => {
              pakaiSupplier(sup.id);
              beriKabar(`${sup.nama} dipakai Initial Investment & Unit Economics`);
            }}
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
            sub={`Kolom bertanda adalah supplier yang sedang dipakai Initial Investment. Semua kolom dihitung untuk ${pcs(diminta)} yang dipesan; supplier ber-MOQ lebih tinggi memaksa membeli lebih banyak, dan itu ditandai.`}
          />
          <TabelBanding
            daftar={daftar}
            terpilihId={terpilihId}
            diminta={diminta}
            kapasitas={kapasitas}
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
  diminta,
  kapasitas,
  kurs,
  perizinanPct,
  onPakai,
  onUbah,
  onHapus,
  onResetFreight,
}: {
  sup: Supplier;
  terpilih: boolean;
  diminta: number;
  kapasitas: number;
  kurs: number;
  perizinanPct: number;
  onPakai: () => void;
  onUbah: (fn: (s: Supplier) => Supplier) => void;
  onHapus: () => void;
  onResetFreight: () => void;
}) {
  const simbol = sup.mataUang === "USD" ? "$" : "Rp";
  const inv = investasiSupplier(sup, kurs, perizinanPct, diminta);
  const cbm = sup.freight.pcsPerCBM > 0 ? inv.qty / sup.freight.pcsPerCBM : 0;
  const jadi = Math.min(kapasitas, inv.qty);

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
        {/* Sebelum ini hanya ada badge pasif, dan satu-satunya pemilih supplier
            ada di tab 4 — jadi menambah supplier di sini tidak pernah mengubah
            satu angka pun di Initial Investment maupun Unit Economics, tanpa
            satu pun tanda bahwa pilihannya belum berpindah. */}
        {terpilih ? (
          <span className="badge bg-primary-subtle text-primary">dipakai</span>
        ) : (
          <Tombol onClick={onPakai}>Pakai supplier ini</Tombol>
        )}
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
          <p className="text-meta text-fg-muted">
            Total investasi untuk <strong>{pcs(inv.qty)}</strong> dibeli
            {inv.moqMengikat ? (
              <span className="badge ml-2 bg-warning-bg text-warning-fg">
                MOQ {pcs(sup.moq)} mengikat
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-meta text-fg-subtle">
            Biaya botol per unit: {rupiah(inv.satuan.totalLengkap)}
            {inv.satuan.freight > 0 ? (
              <span> — sudah termasuk freight {rupiah(inv.satuan.freight)}</span>
            ) : null}
          </p>
          {jadi < inv.qty ? (
            <p className="mt-0.5 text-meta text-fg-subtle">
              Hanya {pcs(jadi)} yang terisi — sisanya kelebihan MOQ, jadi stok.
            </p>
          ) : null}
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
  diminta,
  kapasitas,
  kurs,
  perizinanPct,
}: {
  daftar: Supplier[];
  terpilihId: string;
  diminta: number;
  kapasitas: number;
  kurs: number;
  perizinanPct: number;
}) {
  const baris = daftar.map((s) => {
    const inv = investasiSupplier(s, kurs, perizinanPct, diminta);
    /* Botol yang benar-benar TERISI kalau supplier ini yang dipakai. Membeli
       lebih banyak karena MOQ tidak menambah botol jadi — cairannya tetap
       segitu. Ini pembagi satu-satunya angka di tabel ini yang setara antar
       kolom. */
    const jadi = Math.min(kapasitas, inv.qty);
    return {
      sup: s,
      inv,
      satuan: biayaSatuan(s, kurs, perizinanPct),
      jadi,
    };
  });
  /* ⚠️ "Termurah" HANYA diberikan pada biaya botol / unit.
     Total investasi sengaja tidak diberi badge: dua supplier ber-MOQ berbeda
     membelanjakan uang untuk jumlah botol yang berbeda, dan menobatkan yang
     totalnya lebih kecil di atas dua qty yang tidak sama adalah cara tercepat
     memilih vendor yang salah. Supplier yang seluruh harganya masih Rp0 dulu
     selalu menang di baris itu. */
  const unitTermurah = Math.min(...baris.map((b) => b.satuan.totalLengkap));

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
          {/* Qty DIBELI naik ke baris pertama, MOQ turun jadi keterangannya.
              Sebelumnya MOQ punya baris sendiri dengan angka besar, sementara
              qty yang benar-benar mengalikan harga cuma muncul sebagai teks
              kecil di dalam sel — pembaca mengalikan angka MOQ di kepalanya dan
              mendapat hasil yang meleset ribuan kali lipat. */}
          <Baris
            label="Qty dibeli"
            kolom={baris}
            hi={kolomHi}
            render={(b) => (
              <span className="flex flex-col items-end">
                <span className="font-semibold text-fg">{pcs(b.inv.qty)}</span>
                <span className="text-meta text-fg-subtle">
                  {b.inv.moqMengikat ? (
                    <span className="badge bg-warning-bg text-warning-fg">
                      MOQ {pcs(b.sup.moq)} mengikat
                    </span>
                  ) : (
                    <>MOQ {pcs(b.sup.moq)} — tidak mengikat</>
                  )}
                </span>
              </span>
            )}
          />

          <Baris
            label="Botol terisi"
            kolom={baris}
            hi={kolomHi}
            render={(b) => (
              <span className="flex flex-col items-end">
                <span>{pcs(b.jadi)}</span>
                {b.jadi < b.inv.qty ? (
                  <span className="text-meta text-fg-subtle">
                    {pcs(b.inv.qty - b.jadi)} jadi stok
                  </span>
                ) : null}
              </span>
            )}
          />

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
            <td className="td font-semibold text-fg">
              Total investasi
              <span className="ml-1 font-normal text-fg-subtle">(qty masing-masing)</span>
            </td>
            {baris.map((b) => (
              <td
                key={b.sup.id}
                className={cx("td tabular text-right font-bold text-fg", kolomHi(b.sup.id))}
                data-numeric
              >
                {rupiah(b.inv.total)}
              </td>
            ))}
          </tr>
          <tr>
            <td className="td font-semibold text-fg">
              Biaya botol / unit
              <span className="ml-1 font-normal text-fg-subtle">(termasuk freight)</span>
            </td>
            {baris.map((b) => (
              <td
                key={b.sup.id}
                className={cx("td tabular text-right font-bold", kolomHi(b.sup.id))}
                data-numeric
              >
                <span className={b.satuan.totalLengkap === unitTermurah ? "text-naik" : "text-fg"}>
                  {rupiah(b.satuan.totalLengkap)}
                </span>
                {b.satuan.totalLengkap === unitTermurah ? (
                  <span className="badge ml-2 bg-success-bg text-success-fg">termurah</span>
                ) : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="mt-4">
        <Catatan>
          <strong>Total investasi tidak diberi badge &ldquo;termurah&rdquo;</strong>, dan itu
          disengaja: supplier ber-MOQ berbeda membelanjakan uang untuk jumlah botol yang
          berbeda, jadi dua angkanya bukan barang yang sama. Yang setara adalah{" "}
          <strong>biaya botol / unit</strong> — harga satuan supplier termasuk freight, di
          luar molding dan kelebihan MOQ.
        </Catatan>
      </div>
    </BungkusTabel>
  );
}

type Kolom = {
  sup: Supplier;
  inv: ReturnType<typeof investasiSupplier>;
  satuan: ReturnType<typeof biayaSatuan>;
  /** Botol yang benar-benar terisi kalau supplier ini dipakai. */
  jadi: number;
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
