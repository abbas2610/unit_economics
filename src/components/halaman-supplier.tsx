"use client";

/**
 * Tab 2 & 3 - perbandingan supplier botol + vendor packaging.
 *
 * Satu komponen untuk dua tab (kecil/besar), dan itu bukan penghematan baris:
 * keduanya menjawab pertanyaan yang persis sama dengan aturan yang persis
 * sama. Menulis dua salinan berarti perbaikan di satu ukuran botol akan lupa
 * dibawa ke yang lain - dan bedanya tidak akan terlihat sampai ada yang
 * membandingkan dua tab berdampingan.
 *
 * Yang berbeda cuma daftar supplier/packaging mana yang disunting dan qty
 * batch mana yang dipakai; keduanya masuk lewat prop.
 *
 * ## Packaging memakai kartu & tabel yang SAMA dengan supplier botol
 *
 * `KartuSupplier` dan `TabelBanding` di bawah menerima prop `jenis` yang cuma
 * mengganti label ("Molding botol" vs "Molding box", dst) - datanya sendiri
 * (`Supplier`), rumusnya (`investasiSupplier`, `biayaSatuan`), dan interaksinya
 * (tambah/hapus/pakai) identik. Menulis kartu packaging terpisah berarti dua
 * salinan lagi yang bisa diam-diam berbeda - persis alasan kecil/besar sudah
 * satu komponen.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { angka, pcs, persen, rupiah, usd } from "@/bersama/format";
import { cx } from "@/bersama/cx";
import { pindahkan } from "@/bersama/urutan";
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
import {
  kapasitasCairan,
  qtyDiminta,
  qtyProduksi,
} from "@/contexts/unit-economics/aplikasi/unit-economics";
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
  LightboxFoto,
  Segmen,
  Tombol,
  TombolHapus,
  UnggahFoto,
} from "./ui";

type Jenis = "botol" | "packaging";

const LABEL: Record<
  Jenis,
  {
    /** Dipakai tombol "Pakai … ini" di kartu. */
    namaPakai: string;
    /** Dipakai baris "Biaya … / unit" di tabel perbandingan. */
    namaUnit: string;
    /** Chip jenis di kepala kartu — supaya kartu yang tertutup tetap ketahuan
     *  botol atau packaging walau digulir jauh dari judul bagiannya. */
    chip: string;
    molding: [string, string, string];
    satuan: [string, string, string];
    labelKomponenMolding: [string, string, string];
    labelKomponenSatuan: [string, string, string];
    labelQty: string;
    labelTerisi: string;
  }
> = {
  botol: {
    namaPakai: "supplier",
    namaUnit: "botol",
    chip: "Botol",
    molding: ["Molding botol", "Molding cap / tutup", "Molding silikon / aksesoris"],
    satuan: ["Harga botol / pcs", "Harga cap / pcs", "Aksesoris / pcs"],
    labelKomponenMolding: ["Botol", "Cap", "Silikon"],
    labelKomponenSatuan: ["Botol", "Cap", "Aksesoris"],
    labelQty: "Qty dibeli",
    labelTerisi: "Botol terisi",
  },
  packaging: {
    namaPakai: "packaging",
    namaUnit: "packaging",
    chip: "Packaging",
    molding: ["Molding box", "Molding tutup box", "Molding aksesoris box"],
    satuan: ["Harga box / pcs", "Harga tutup box / pcs", "Aksesoris box / pcs"],
    labelKomponenMolding: ["Box", "Tutup", "Aksesoris"],
    labelKomponenSatuan: ["Box", "Tutup", "Aksesoris"],
    labelQty: "Qty box dibeli",
    labelTerisi: "Box terpakai",
  },
};

export function HalamanSupplier({ ukuran }: { ukuran: UkuranBotol }) {
  const { dok, ubah, beriKabar } = useDokumen();
  const kecil = ukuran === "kecil";
  const daftar = kecil ? dok.supplierKecil : dok.supplierBesar;
  const terpilihId = kecil ? dok.pilihan.kecilId : dok.pilihan.besarId;
  /* TIGA angka yang dulu satu. `kapasitas` = berapa botol cairannya cukup;
     `diminta` = berapa yang dipesan (bisa lebih kecil - pembelian sampel);
     yang DIBAYAR tiap supplier = max(MOQ, diminta), dihitung per kolom. */
  const kapasitas = kapasitasCairan(dok, ukuran);
  const diminta = qtyDiminta(dok, ukuran);
  const produksi = qtyProduksi(dok, ukuran);
  const pembelianManual = (kecil ? dok.pembelian?.kecil : dok.pembelian?.besar) ?? null;
  const dimensi = kecil ? dok.dimensi.kecil : dok.dimensi.besar;

  const daftarPackaging = kecil ? dok.packagingKecil : dok.packagingBesar;
  const terpilihPackagingId = kecil ? dok.pilihan.packagingKecilId : dok.pilihan.packagingBesarId;

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

  /* Mengembalikan id yang DIHARAPKAN supaya kartunya bisa langsung dibuka.
     Id yang sungguh dipakai tetap dihitung dari `d` terbaru di dalam updater -
     kalau siaran tim menyelip di antaranya, kartu baru cuma mulai tertutup,
     bukan berbagi id dengan supplier lain. */
  const tambah = (): string => {
    const diharapkan = (kecil ? "s" : "l") + idBerikutnya(dok);
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
    return diharapkan;
  };

  /* Urutan DISIMPAN di dokumen (urutan larik), bukan cuma di layar: tim
     melihat urutan yang sama, dan kolom tabel perbandingan ikut urutannya.
     Tidak menggeser angka apa pun - pilihan supplier menunjuk id, bukan posisi. */
  const urut = (id: string, ke: number) => setDaftar((list) => pindahkan(list, id, ke));

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
         diam-diam jatuh ke supplier pertama - dengan angka penawaran berbeda,
         tanpa satu pun tanda di layar. */
      if (kecil && pilihan.kecilId === id) pilihan.kecilId = sisa[0]?.id ?? "";
      if (!kecil && pilihan.besarId === id) pilihan.besarId = sisa[0]?.id ?? "";
      return kecil
        ? { ...d, supplierKecil: sisa, pilihan }
        : { ...d, supplierBesar: sisa, pilihan };
    });
  };

  /* — packaging: sama persis polanya dengan supplier botol di atas, cuma
       menyunting `packagingKecil`/`packagingBesar` & `pilihan.packaging*Id`. */
  const pakaiPackaging = (id: string) =>
    ubah((d) => ({
      ...d,
      pilihan: kecil
        ? { ...d.pilihan, packagingKecilId: id }
        : { ...d.pilihan, packagingBesarId: id },
    }));

  const setDaftarPackaging = (fn: (d: Supplier[]) => Supplier[]) =>
    ubah((d) =>
      kecil
        ? { ...d, packagingKecil: fn(d.packagingKecil) }
        : { ...d, packagingBesar: fn(d.packagingBesar) },
    );

  const setPackaging = (id: string, fn: (s: Supplier) => Supplier) =>
    setDaftarPackaging((list) => list.map((s) => (s.id === id ? fn(s) : s)));

  const tambahPackaging = (): string => {
    const diharapkan = (kecil ? "pk" : "pb") + idBerikutnya(dok);
    ubah((d) => {
      const id = (kecil ? "pk" : "pb") + idBerikutnya(d);
      const baru: Supplier = {
        id,
        nama: "Packaging Baru",
        mataUang: "IDR",
        moq: 0,
        molding: { botol: 0, cap: 0, silikon: 0 },
        satuan: { botol: 0, cap: 0, aksesoris: 0 },
        freight: {
          aktif: false,
          pcsPerCBM: Math.round(pcsPerCBM(dimensi, d.asumsi.packingEfficiency)) || 1,
          ratePerCBM: d.asumsi.freightPerCBM,
        },
      };
      return kecil
        ? { ...d, packagingKecil: [...d.packagingKecil, baru] }
        : { ...d, packagingBesar: [...d.packagingBesar, baru] };
    });
    return diharapkan;
  };

  const urutPackaging = (id: string, ke: number) =>
    setDaftarPackaging((list) => pindahkan(list, id, ke));

  const hapusPackaging = (id: string) => {
    if (daftarPackaging.length <= 1) {
      beriKabar("Minimal satu vendor packaging");
      return;
    }
    ubah((d) => {
      const sisa = (kecil ? d.packagingKecil : d.packagingBesar).filter((s) => s.id !== id);
      const pilihan = { ...d.pilihan };
      if (kecil && pilihan.packagingKecilId === id) pilihan.packagingKecilId = sisa[0]?.id ?? "";
      if (!kecil && pilihan.packagingBesarId === id) pilihan.packagingBesarId = sisa[0]?.id ?? "";
      return kecil
        ? { ...d, packagingKecil: sisa, pilihan }
        : { ...d, packagingBesar: sisa, pilihan };
    });
  };

  const label = kecil
    ? `Botol Kecil - ${dok.asumsi.mlBotolKecil} ML`
    : `Botol Besar - ${dok.asumsi.mlBotolBesar} ML`;

  return (
    <>
      <KepalaHalaman
        langkah={kecil ? "Langkah 2" : "Langkah 3"}
        judul={`Supplier ${label}`}
        catatan={
          kecil
            ? "Umumnya dari China (USD). Isi biaya molding (sekali bayar) dan harga satuan (per pcs) terpisah - supplier dengan molding mahal dan satuan murah menang pada volume besar dan kalah telak pada volume kecil."
            : "Rencana dari vendor Indonesia (IDR), termasuk molding cap sendiri. Struktur sama seperti botol kecil; mata uang bisa diganti ke USD bila ada opsi impor."
        }
      />

      <div className="mb-5">
        <Kartu>
          <JudulBlok
            judul="Qty botol yang dibeli"
            sub="Berapa botol yang benar-benar dipesan ke supplier. Ini yang mengalikan seluruh harga satuan di bawah - bukan MOQ."
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
                tidak akan terbotolkan - biang, alkohol, dan OEM-nya sudah dibayar tapi tidak jadi
                barang yang bisa dijual. Angkanya muncul di Initial Investment.
              </Catatan>
            </div>
          ) : null}
        </Kartu>
      </div>

      <SeksiVendor
        jenis="botol"
        seksi="supplier"
        huruf="A"
        judul="Supplier Botol"
        sub={`Botol ${label.replace(/^Botol (Kecil|Besar) - /, "")} + cap & aksesoris. Qty-nya mengikuti yang DIPESAN (${pcs(diminta)}).`}
        daftar={daftar}
        terpilihId={terpilihId}
        diminta={diminta}
        kapasitas={kapasitas}
        kurs={dok.asumsi.kurs}
        perizinanPct={dok.asumsi.perizinanPct}
        judulBanding={`Perbandingan Supplier - ${label}`}
        subBanding={`Kolom bertanda adalah supplier yang sedang dipakai Initial Investment. Semua kolom dihitung untuk ${pcs(diminta)} yang dipesan; supplier ber-MOQ lebih tinggi memaksa membeli lebih banyak, dan itu ditandai.`}
        labelTambah={`+ Tambah supplier ${kecil ? "botol kecil" : "botol besar"}`}
        onPakai={(sup) => {
          pakaiSupplier(sup.id);
          beriKabar(`${sup.nama} dipakai Initial Investment & Unit Economics`);
        }}
        onUbah={setSupplier}
        onHapus={hapus}
        onResetFreight={(id) => {
          setSupplier(id, (s) => ({
            ...s,
            freight: {
              ...s.freight,
              pcsPerCBM: Math.round(pcsPerCBM(dimensi, dok.asumsi.packingEfficiency)) || 1,
              ratePerCBM: dok.asumsi.freightPerCBM,
            },
          }));
          beriKabar("Freight direset ke default asumsi dasar");
        }}
        onTambah={tambah}
        onUrut={urut}
      />

      <div className="mt-6">
        <SeksiVendor
          jenis="packaging"
          seksi="packaging"
          huruf="B"
          judul="Supplier Packaging (Box)"
          sub={`Box + aksesoris box - vendor sendiri, terpisah dari supplier botol. Qty-nya mengikuti botol yang JADI (${pcs(produksi)}), bukan yang dipesan: box baru dibutuhkan begitu botolnya benar-benar terisi.`}
          daftar={daftarPackaging}
          terpilihId={terpilihPackagingId}
          diminta={produksi}
          kapasitas={produksi}
          kurs={dok.asumsi.kurs}
          perizinanPct={0}
          judulBanding={`Perbandingan Packaging - ${label}`}
          subBanding={`Kolom bertanda adalah vendor yang sedang dipakai Initial Investment & Unit Economics. Semua kolom dihitung untuk ${pcs(produksi)} botol yang jadi.`}
          labelTambah={`+ Tambah packaging ${kecil ? "botol kecil" : "botol besar"}`}
          onPakai={(sup) => {
            pakaiPackaging(sup.id);
            beriKabar(`${sup.nama} dipakai Initial Investment & Unit Economics`);
          }}
          onUbah={setPackaging}
          onHapus={hapusPackaging}
          onResetFreight={(id) => {
            setPackaging(id, (s) => ({
              ...s,
              freight: {
                ...s.freight,
                pcsPerCBM: Math.round(pcsPerCBM(dimensi, dok.asumsi.packingEfficiency)) || 1,
                ratePerCBM: dok.asumsi.freightPerCBM,
              },
            }));
            beriKabar("Freight direset ke default asumsi dasar");
          }}
          onTambah={tambahPackaging}
          onUrut={urutPackaging}
        />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ seksi ══ */

/**
 * Satu bagian vendor: kepala bagian, tabel perbandingan PALING ATAS, lalu
 * kartu per vendor yang bisa dibuka/tutup dan diurutkan dengan seret.
 *
 * Tabel naik ke atas karena itu yang dibaca di rapat; kartunya cuma tempat
 * mengisi angka, dan dulu tiga-empat kartu terbuka mendorong tabelnya ke
 * bawah satu layar penuh.
 *
 * ## Buka/tutup TIDAK disimpan di dokumen, urutan IYA
 *
 * Dokumen ini dibagi seluruh tim lewat realtime. Kalau kartu yang terbuka
 * ikut tersimpan, satu orang menutup kartu = kartu tertutup di layar semua
 * orang, di tengah mereka mengetik. Urutan sebaliknya memang keputusan
 * bersama, dan kolom tabel perbandingan mengikutinya.
 */
function SeksiVendor({
  jenis,
  seksi,
  huruf,
  judul,
  sub,
  daftar,
  terpilihId,
  diminta,
  kapasitas,
  kurs,
  perizinanPct,
  judulBanding,
  subBanding,
  labelTambah,
  onPakai,
  onUbah,
  onHapus,
  onResetFreight,
  onTambah,
  onUrut,
}: {
  jenis: Jenis;
  /** Nilai `data-seksi` daftar kartu — dipakai probe layar sebagai pegangan. */
  seksi: string;
  huruf: string;
  judul: string;
  sub: ReactNode;
  daftar: Supplier[];
  terpilihId: string;
  diminta: number;
  kapasitas: number;
  kurs: number;
  perizinanPct: number;
  judulBanding: string;
  subBanding: string;
  labelTambah: string;
  onPakai: (sup: Supplier) => void;
  onUbah: (id: string, fn: (s: Supplier) => Supplier) => void;
  onHapus: (id: string) => void;
  onResetFreight: (id: string) => void;
  onTambah: () => string;
  onUrut: (id: string, ke: number) => void;
}) {
  const l = LABEL[jenis];
  const idJudul = useId();
  const [terbuka, setTerbuka] = useState<ReadonlySet<string>>(() => new Set());
  const [seret, setSeret] = useState<{ id: string; ke: number } | null>(null);
  const wadah = useRef<HTMLDivElement>(null);
  const keTerakhir = useRef(0);
  const lepasSeret = useRef<(() => void) | null>(null);

  useEffect(() => {
    const ref = lepasSeret;
    return () => ref.current?.();
  }, []);

  /* Selama diseret, daftar dirender dalam urutan PRATINJAU - kartunya
     berpindah tempat mengikuti pointer, jadi yang terlihat persis yang akan
     tersimpan. Dokumen baru disentuh saat dilepas. */
  const tampil = seret ? pindahkan(daftar, seret.id, seret.ke) : daftar;
  const terpilih = daftar.find((s) => s.id === terpilihId);
  const semuaTerbuka = daftar.length > 0 && daftar.every((s) => terbuka.has(s.id));

  const alih = (id: string) =>
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });

  const tambah = () => {
    const id = onTambah();
    setTerbuka((lama) => new Set(lama).add(id));
  };

  /** Indeks tujuan = jumlah kartu LAIN yang titik tengahnya di atas pointer. */
  const posisiDari = (id: string, y: number) => {
    const el = wadah.current;
    if (!el) return 0;
    return [...el.querySelectorAll<HTMLElement>(":scope > [data-urut-id]")]
      .filter((k) => k.dataset.urutId !== id)
      .filter((k) => {
        const r = k.getBoundingClientRect();
        return r.top + r.height / 2 < y;
      }).length;
  };

  /* Pendengar dipasang di `window`, bukan pointer capture di pegangannya:
     React memindahkan node kartu di DOM saat urutan pratinjau berubah, dan
     elemen yang dipindah kehilangan capture-nya di tengah seret. */
  const mulaiSeret = (id: string, e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const awal = daftar.findIndex((s) => s.id === id);
    keTerakhir.current = awal;
    setSeret({ id, ke: awal });

    function gerak(ev: PointerEvent) {
      const ke = posisiDari(id, ev.clientY);
      if (ke === keTerakhir.current) return;
      keTerakhir.current = ke;
      setSeret({ id, ke });
    }
    function lepas() {
      window.removeEventListener("pointermove", gerak);
      window.removeEventListener("pointerup", selesai);
      window.removeEventListener("pointercancel", batal);
      lepasSeret.current = null;
    }
    function selesai() {
      lepas();
      setSeret(null);
      if (keTerakhir.current !== awal) onUrut(id, keTerakhir.current);
    }
    function batal() {
      lepas();
      setSeret(null);
    }
    window.addEventListener("pointermove", gerak);
    window.addEventListener("pointerup", selesai);
    window.addEventListener("pointercancel", batal);
    lepasSeret.current = lepas;
  };

  /** Jalur keyboard untuk hal yang sama - seret saja tidak bisa dipakai tanpa mouse. */
  const geserKeyboard = (id: string, e: React.KeyboardEvent<HTMLButtonElement>) => {
    const i = daftar.findIndex((s) => s.id === id);
    const ke = e.key === "ArrowUp" ? i - 1 : e.key === "ArrowDown" ? i + 1 : null;
    if (ke === null) return;
    e.preventDefault();
    if (ke < 0 || ke >= daftar.length) return;
    onUrut(id, ke);
  };

  return (
    <section
      aria-labelledby={idJudul}
      className="rounded-lg border border-border bg-surface-muted p-4"
    >
      <div className="mb-4 flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-control w-control shrink-0 items-center justify-center rounded-md border border-border bg-surface text-primary"
        >
          {jenis === "botol" ? <IkonBotol /> : <IkonBox />}
        </span>
        <div className="min-w-0">
          <p className="text-label uppercase text-primary">Bagian {huruf}</p>
          <h2 id={idJudul} className="text-card-title text-fg">
            {judul}
          </h2>
          <p className="mt-1 max-w-[80ch] text-meta text-fg-subtle">{sub}</p>
          <p className="mt-1 text-meta text-fg-muted">
            {daftar.length} vendor
            {terpilih ? (
              <>
                {" "}
                · dipakai: <strong className="text-fg">{terpilih.nama}</strong>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <Kartu>
        <JudulBlok judul={judulBanding} sub={subBanding} />
        <TabelBanding
          jenis={jenis}
          daftar={daftar}
          terpilihId={terpilihId}
          diminta={diminta}
          kapasitas={kapasitas}
          kurs={kurs}
          perizinanPct={perizinanPct}
        />
      </Kartu>

      <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-label uppercase text-fg-muted">
          Detail per {l.namaPakai}
          <span className="ml-2 font-normal normal-case tracking-normal text-fg-subtle">
            klik untuk buka/tutup · seret pegangan di kanan untuk mengurutkan
          </span>
        </p>
        {daftar.length > 1 ? (
          <button
            type="button"
            onClick={() => setTerbuka(semuaTerbuka ? new Set() : new Set(daftar.map((s) => s.id)))}
            className="text-meta font-semibold text-primary hover:text-primary-hover"
          >
            {semuaTerbuka ? "Tutup semua" : "Buka semua"}
          </button>
        ) : null}
      </div>

      <div ref={wadah} className="flex flex-col gap-2" data-seksi={seksi}>
        {tampil.map((sup, i) => (
          <KartuSupplier
            key={sup.id}
            jenis={jenis}
            sup={sup}
            terpilih={sup.id === terpilihId}
            diminta={diminta}
            kurs={kurs}
            perizinanPct={perizinanPct}
            terbuka={terbuka.has(sup.id)}
            diseret={seret?.id === sup.id}
            posisi={i + 1}
            total={tampil.length}
            onAlih={() => alih(sup.id)}
            onPeganganDown={(e) => mulaiSeret(sup.id, e)}
            onPeganganKey={(e) => geserKeyboard(sup.id, e)}
            onPakai={() => onPakai(sup)}
            onUbah={(fn) => onUbah(sup.id, fn)}
            onHapus={() => onHapus(sup.id)}
            onResetFreight={() => onResetFreight(sup.id)}
          />
        ))}
      </div>

      <div className="mt-3">
        <Tombol jenis="garis" onClick={tambah}>
          {labelTambah}
        </Tombol>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════ kartu editor ══ */

function KartuSupplier({
  jenis,
  sup,
  terpilih,
  diminta,
  kurs,
  perizinanPct,
  terbuka,
  diseret,
  posisi,
  total,
  onAlih,
  onPeganganDown,
  onPeganganKey,
  onPakai,
  onUbah,
  onHapus,
  onResetFreight,
}: {
  jenis: Jenis;
  sup: Supplier;
  terpilih: boolean;
  diminta: number;
  kurs: number;
  perizinanPct: number;
  terbuka: boolean;
  diseret: boolean;
  posisi: number;
  total: number;
  onAlih: () => void;
  onPeganganDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
  onPeganganKey: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
  onPakai: () => void;
  onUbah: (fn: (s: Supplier) => Supplier) => void;
  onHapus: () => void;
  onResetFreight: () => void;
}) {
  const l = LABEL[jenis];
  const idBadan = useId();
  const simbol = sup.mataUang === "USD" ? "$" : "Rp";
  const inv = investasiSupplier(sup, kurs, perizinanPct, diminta);
  const cbm = sup.freight.pcsPerCBM > 0 ? inv.qty / sup.freight.pcsPerCBM : 0;

  const setFoto = (foto: string[]) =>
    onUbah((x) => {
      if (foto.length > 0) return { ...x, foto };
      // Hapus kuncinya sama sekali - bukan `foto: []` - supaya dokumen yang
      // belum pernah menyentuh foto tetap identik dengan sebelum field ini
      // ada (lihat catatan di `supplierDari`, migrasi.ts).
      const salinan = { ...x };
      delete salinan.foto;
      return salinan;
    });

  return (
    <section
      data-urut-id={sup.id}
      className={cx(
        "card",
        terpilih && "border-primary bg-primary-subtle/40",
        diseret && "relative z-10 opacity-80 ring-2 ring-primary",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <button
          type="button"
          onClick={onAlih}
          aria-expanded={terbuka}
          aria-controls={idBadan}
          aria-label={`Detail ${sup.nama}`}
          className="group flex min-w-[220px] flex-1 items-center gap-3 text-left"
        >
          <IkonPanah terbuka={terbuka} />
          {sup.foto?.[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL lokal, bukan aset yang perlu dioptimalkan Next
            <img
              src={sup.foto[0]}
              alt=""
              className="h-8 w-8 shrink-0 rounded-sm border border-border object-cover"
            />
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate text-card-title text-fg group-hover:text-primary">
                {sup.nama}
              </span>
              <span className="badge shrink-0 bg-neutral-bg text-neutral-fg">{l.chip}</span>
            </span>
            <span className="tabular mt-0.5 block truncate text-meta text-fg-subtle">
              {sup.mataUang} · {rupiah(inv.satuan.totalLengkap)} / {l.namaUnit} · total{" "}
              {rupiah(inv.total)}
            </span>
          </span>
        </button>
        {/* Sebelum ini hanya ada badge pasif, dan satu-satunya pemilih supplier
            ada di tab 4 - jadi menambah supplier di sini tidak pernah mengubah
            satu angka pun di Initial Investment maupun Unit Economics, tanpa
            satu pun tanda bahwa pilihannya belum berpindah. Tetap di kepala
            kartu, jadi bisa dipakai tanpa membuka detailnya. */}
        {terpilih ? (
          <span className="badge bg-primary-subtle text-primary">dipakai</span>
        ) : (
          <Tombol onClick={onPakai}>Pakai {l.namaPakai} ini</Tombol>
        )}
        <TombolHapus label={`Hapus ${sup.nama}`} onClick={onHapus} />
        <button
          type="button"
          onPointerDown={onPeganganDown}
          onKeyDown={onPeganganKey}
          aria-label={`Urutkan ${sup.nama}, posisi ${posisi} dari ${total}. Seret, atau tekan panah atas/bawah.`}
          title="Seret untuk mengurutkan (atau panah atas/bawah)"
          className="flex h-control-sm w-control-sm shrink-0 cursor-grab touch-none items-center justify-center rounded-sm border border-border text-fg-subtle transition-colors hover:border-border-strong hover:text-fg active:cursor-grabbing"
        >
          <IkonPegangan />
        </button>
      </div>

      {terbuka ? (
        <div id={idBadan} className="border-t border-border px-5 pb-5 pt-4">
          <div className="mb-5 flex flex-wrap items-end gap-3">
            <span className="min-w-[200px] flex-1">
              <Bidang label={`Nama ${l.namaPakai}`}>
                <IsianTeks
                  nilai={sup.nama}
                  ariaLabel={`Nama ${l.namaPakai}`}
                  onUbah={(s) => onUbah((x) => ({ ...x, nama: s }))}
                />
              </Bidang>
            </span>
            {/* Bukan <Bidang>: Bidang adalah <label>, dan mengklik teks label
                mengaktifkan kontrol PERTAMA di dalamnya - tombol "IDR". Satu klik
                di judulnya akan diam-diam mengganti mata uang seluruh harga. */}
            <div className="flex flex-col gap-1.5">
              <span className="text-meta font-semibold text-fg-muted">Mata uang</span>
              <Segmen<MataUang>
                label={`Mata uang ${sup.nama}`}
                nilai={sup.mataUang}
                pilihan={[
                  { nilai: "IDR", label: "IDR" },
                  { nilai: "USD", label: "USD $" },
                ]}
                onUbah={(m) => onUbah((x) => ({ ...x, mataUang: m }))}
              />
            </div>
          </div>

          {/* Sama alasannya: di dalam <label>, klik teks "Foto produk" akan
              mengaktifkan tombol × foto pertama - menghapusnya. */}
          <div className="mb-5 flex flex-col gap-1.5">
            <span className="text-meta font-semibold text-fg-muted">
              Foto produk
              <span className="ml-1 font-normal text-fg-subtle">
                (opsional, bisa lebih dari satu, tampil di tabel perbandingan)
              </span>
            </span>
            <UnggahFoto foto={sup.foto} onUbah={setFoto} ariaLabel={`foto ${sup.nama}`} />
          </div>

          <p className="mb-2 text-label uppercase text-fg-muted">
            Fixed cost - molding (sekali bayar)
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Bidang label={l.molding[0]}>
              <IsianAngka
                nilai={sup.molding.botol}
                awalan={simbol}
                ariaLabel={l.molding[0]}
                onUbah={(n) => onUbah((x) => ({ ...x, molding: { ...x.molding, botol: n } }))}
              />
            </Bidang>
            <Bidang label={l.molding[1]}>
              <IsianAngka
                nilai={sup.molding.cap}
                awalan={simbol}
                ariaLabel={l.molding[1]}
                onUbah={(n) => onUbah((x) => ({ ...x, molding: { ...x.molding, cap: n } }))}
              />
            </Bidang>
            <Bidang label={l.molding[2]}>
              <IsianAngka
                nilai={sup.molding.silikon}
                awalan={simbol}
                ariaLabel={l.molding[2]}
                onUbah={(n) => onUbah((x) => ({ ...x, molding: { ...x.molding, silikon: n } }))}
              />
            </Bidang>
          </div>

          <p className="mb-2 mt-5 text-label uppercase text-fg-muted">Variable cost - per unit</p>
          <div className="grid gap-3 sm:grid-cols-4">
            <Bidang label={l.satuan[0]}>
              <IsianAngka
                nilai={sup.satuan.botol}
                digit={2}
                awalan={simbol}
                ariaLabel={l.satuan[0]}
                onUbah={(n) => onUbah((x) => ({ ...x, satuan: { ...x.satuan, botol: n } }))}
              />
            </Bidang>
            <Bidang label={l.satuan[1]}>
              <IsianAngka
                nilai={sup.satuan.cap}
                digit={2}
                awalan={simbol}
                ariaLabel={l.satuan[1]}
                onUbah={(n) => onUbah((x) => ({ ...x, satuan: { ...x.satuan, cap: n } }))}
              />
            </Bidang>
            <Bidang label={l.satuan[2]}>
              <IsianAngka
                nilai={sup.satuan.aksesoris}
                digit={2}
                awalan={simbol}
                ariaLabel={l.satuan[2]}
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
                Freight nonaktif - biayanya dianggap sudah termasuk harga vendor, dan tidak
                dihitung di COGS maupun Initial Investment.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3 border-t border-border pt-3">
            <p className="text-meta text-fg-muted">Total investasi</p>
            <p className="tabular text-card-title font-bold text-fg">{rupiah(inv.total)}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

/* ════════════════════════════════════════════════════════════ ikon ══ */
/* SVG sebaris, warnanya `currentColor` - ikut token teks di sekitarnya, jadi
   tema gelap dan palet cetak berlaku tanpa satu hex pun. */

const IkonPanah = ({ terbuka }: { terbuka: boolean }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden
    className={cx("h-4 w-4 shrink-0 text-fg-subtle transition-transform", terbuka && "rotate-90")}
  >
    <path
      d="M6 3.5 10.5 8 6 12.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IkonPegangan = () => (
  <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4">
    {[4, 8, 12].flatMap((y) =>
      [6, 10].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.25" fill="currentColor" />),
    )}
  </svg>
);

const IkonBotol = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 2.5h4M10.5 2.5v3.2c0 .5-.2 1-.6 1.4l-1.3 1.3a3.5 3.5 0 0 0-1.1 2.5V19a2.5 2.5 0 0 0 2.5 2.5h4a2.5 2.5 0 0 0 2.5-2.5v-8.1a3.5 3.5 0 0 0-1.1-2.5l-1.3-1.3c-.4-.4-.6-.9-.6-1.4V2.5" />
    <path d="M7.5 13.5h9" />
  </svg>
);

const IkonBox = () => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 7.5 12 3 3 7.5 12 12l9-4.5Z" />
    <path d="M3 7.5v9L12 21l9-4.5v-9" />
    <path d="M12 12v9" />
  </svg>
);

/* ══════════════════════════════════════════════════════════════ tabel ══ */

/**
 * Kolom "Komponen" dibekukan: dengan empat-lima supplier tabelnya harus
 * digulir ke samping, dan begitu labelnya ikut hilang, angka di kolom kanan
 * tidak bisa dibaca baris mana. Garis pemisahnya pseudo-elemen, bukan border:
 * border di tabel `border-collapse` tidak ikut menempel saat sel-nya sticky.
 */
const KOLOM_BEKU =
  "sticky left-0 z-10 after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-border";
/** Sel isi butuh latar sendiri — kalau transparan, kolom yang digulir terlihat menembus. */
const KOLOM_BEKU_ISI = `${KOLOM_BEKU} bg-surface`;

function TabelBanding({
  jenis,
  daftar,
  terpilihId,
  diminta,
  kapasitas,
  kurs,
  perizinanPct,
}: {
  jenis: Jenis;
  daftar: Supplier[];
  terpilihId: string;
  diminta: number;
  kapasitas: number;
  kurs: number;
  perizinanPct: number;
}) {
  const l = LABEL[jenis];
  const baris = daftar.map((s) => {
    const inv = investasiSupplier(s, kurs, perizinanPct, diminta);
    /* Botol/box yang benar-benar TERISI/TERPAKAI kalau vendor ini yang
       dipakai. Membeli lebih banyak karena MOQ tidak menambah botol jadi -
       cairannya tetap segitu. Ini pembagi satu-satunya angka di tabel ini
       yang setara antar kolom. */
    const jadi = Math.min(kapasitas, inv.qty);
    return {
      sup: s,
      inv,
      satuan: biayaSatuan(s, kurs, perizinanPct),
      jadi,
    };
  });
  /* ⚠️ "Termurah" HANYA diberikan pada biaya per unit terpakai.
     Total investasi sengaja tidak diberi badge: dua vendor ber-MOQ berbeda
     membelanjakan uang untuk jumlah yang berbeda, dan menobatkan yang
     totalnya lebih kecil di atas dua qty yang tidak sama adalah cara tercepat
     memilih vendor yang salah. Vendor yang seluruh harganya masih Rp0 dulu
     selalu menang di baris itu. */
  const unitTermurah = Math.min(...baris.map((b) => b.satuan.totalLengkap));

  const kolomHi = (id: string) => (id === terpilihId ? "bg-primary-subtle/50" : "");

  /* Setiap FOTO (bukan tiap supplier) jadi satu entri di sini, berurutan per
     kolom - supplier dengan tiga foto menyumbang tiga entri berturutan.
     Panah kiri/kanan di lightbox menyisir daftar ini apa adanya, jadi ia
     otomatis jalan terus ke supplier berikutnya begitu foto supplier ini
     habis, dan tidak pernah berhenti di kolom tanpa gambar sama sekali. */
  const semuaFoto = baris.flatMap((b) =>
    (b.sup.foto ?? []).map((foto, i) => ({
      supplierId: b.sup.id,
      id: `${b.sup.id}-${i}`,
      nama: (b.sup.foto?.length ?? 0) > 1 ? `${b.sup.nama} (${i + 1}/${b.sup.foto!.length})` : b.sup.nama,
      foto,
    })),
  );
  const [fotoAktif, setFotoAktif] = useState<number | null>(null);

  return (
    <>
      <BungkusTabel>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={cx("th rounded-tl-md", KOLOM_BEKU)}>
                Komponen{" "}
                <span className="font-normal normal-case tracking-normal text-fg-subtle">
                  (kurs terpakai {rupiah(kurs)}/USD)
                </span>
              </th>
              {baris.map((b) => {
                const fotoSupplier = b.sup.foto ?? [];
                return (
                  <th key={b.sup.id} className={cx("th text-right", kolomHi(b.sup.id))}>
                    <span className="flex items-center justify-end gap-2">
                      {fotoSupplier.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFotoAktif(semuaFoto.findIndex((f) => f.supplierId === b.sup.id))
                          }
                          aria-label={`Lihat foto ${b.sup.nama}`}
                          className="relative shrink-0 rounded-sm transition hover:ring-2 hover:ring-primary/40"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element -- data URL lokal, bukan aset yang perlu dioptimalkan Next */}
                          <img
                            src={fotoSupplier[0]}
                            alt=""
                            className="h-[22px] w-[22px] rounded-sm border border-border object-cover"
                          />
                          {fotoSupplier.length > 1 ? (
                            <span className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full border border-border bg-surface px-0.5 text-badge font-semibold normal-case text-fg-muted">
                              {fotoSupplier.length}
                            </span>
                          ) : null}
                        </button>
                      ) : null}
                      <span>{b.sup.nama}</span>
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Qty DIBELI naik ke baris pertama, MOQ turun jadi keterangannya.
                Sebelumnya MOQ punya baris sendiri dengan angka besar, sementara
                qty yang benar-benar mengalikan harga cuma muncul sebagai teks
                kecil di dalam sel - pembaca mengalikan angka MOQ di kepalanya dan
                mendapat hasil yang meleset ribuan kali lipat. */}
            <Baris
              label={l.labelQty}
              kolom={baris}
              hi={kolomHi}
              render={(b) => (
                <span className="flex flex-col items-end">
                  <span className="font-semibold text-fg">{pcs(b.inv.qty)}</span>
                  {/* `moq-keterangan`: disembunyikan khusus di laporan cetak
                      (lihat globals.css) — keterangan MOQ berguna saat menyunting
                      supplier di layar, tapi di laporan ringkas cuma menambah
                      baris tanpa menambah keputusan yang bisa diambil dari
                      kertas. */}
                  <span className="moq-keterangan text-meta text-fg-subtle">
                    {b.inv.moqMengikat ? (
                      <span className="badge bg-warning-bg text-warning-fg">
                        MOQ {pcs(b.sup.moq)} mengikat
                      </span>
                    ) : (
                      <>MOQ {pcs(b.sup.moq)} - tidak mengikat</>
                    )}
                  </span>
                </span>
              )}
            />

            <Baris
              label={l.labelTerisi}
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
                [l.labelKomponenMolding[0], b.sup.molding.botol],
                [l.labelKomponenMolding[1], b.sup.molding.cap],
                [l.labelKomponenMolding[2], b.sup.molding.silikon],
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
                [l.labelKomponenSatuan[0], b.sup.satuan.botol],
                [l.labelKomponenSatuan[1], b.sup.satuan.cap],
                [l.labelKomponenSatuan[2], b.sup.satuan.aksesoris],
              ]}
              total={(b) => b.satuan.botol + b.satuan.aksesoris}
              labelTotal="Total /pcs"
              ekstra={(b) => [`Total beli (${pcs(b.inv.qty)})`, b.inv.botol + b.inv.aksesoris]}
              mataUang={(b) => b.sup.mataUang}
              kurs={kurs}
            />

            {perizinanPct > 0 ? (
              <Baris
                label={`Perizinan ${persen(perizinanPct)} (total)`}
                kolom={baris}
                hi={kolomHi}
                render={(b) => rupiah(b.inv.perizinan)}
              />
            ) : null}

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
              <td className={cx("td font-semibold text-fg", KOLOM_BEKU_ISI)}>
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
              <td className={cx("td font-semibold text-fg", KOLOM_BEKU_ISI)}>
                Biaya {l.namaUnit} / unit
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
      </BungkusTabel>

      <LightboxFoto
        daftar={semuaFoto}
        indeks={fotoAktif}
        onTutup={() => setFotoAktif(null)}
        onNavigasi={(arah) =>
          setFotoAktif((i) => (i === null ? null : (i + arah + semuaFoto.length) % semuaFoto.length))
        }
      />
    </>
  );
}

type Kolom = {
  sup: Supplier;
  inv: ReturnType<typeof investasiSupplier>;
  satuan: ReturnType<typeof biayaSatuan>;
  /** Botol/box yang benar-benar terisi/terpakai kalau vendor ini dipakai. */
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
      <td className={cx("td text-fg-muted", KOLOM_BEKU_ISI)}>{label}</td>
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
 * membandingkannya dengan vendor lokal - dan seluruh guna tabel ini adalah
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
      <td className={cx("td text-fg-muted", KOLOM_BEKU_ISI)}>{label}</td>
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
