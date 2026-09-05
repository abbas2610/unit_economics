"use client";

/**
 * Komponen bersama. Semua warna, ukuran, dan radius datang dari token -
 * tidak ada satu pun hex di berkas ini, dan `npm run probe:token` menolak lulus
 * kalau ada yang masuk.
 *
 * ⚠️ Berkas ini `"use client"`. Fungsi murni yang dipakai lintas server/klien
 * TIDAK boleh tinggal di sini - tempatnya `src/bersama/`. Lihat catatan panjang
 * di `src/bersama/cx.ts`; aturan itu lahir dari kegagalan runtime yang lolos
 * build dan typecheck.
 */
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/bersama/cx";
import { arah, arahBiaya, delta, pcsDelta, persenDelta, poinDelta, type Arah } from "@/bersama/format";
import { bacaAngka, tulisAngka } from "@/bersama/masukan";

/* ══════════════════════════════════════════════════════════════ wadah ══ */

export function Kartu({
  children,
  className,
  padat,
}: {
  children: ReactNode;
  className?: string;
  /** Tanpa padding - untuk kartu yang isinya tabel penuh lebar. */
  padat?: boolean;
}) {
  return <div className={cx("card", padat ? "" : "p-5", className)}>{children}</div>;
}

export function KepalaHalaman({
  langkah,
  judul,
  catatan,
}: {
  langkah: string;
  judul: ReactNode;
  catatan?: ReactNode;
}) {
  return (
    <header className="mb-5">
      <p className="text-label uppercase text-primary">{langkah}</p>
      <h1 className="page-title mt-1">{judul}</h1>
      {catatan ? <p className="page-subtitle max-w-[68ch]">{catatan}</p> : null}
    </header>
  );
}

export function JudulBlok({
  judul,
  sub,
  aksen,
  nomor,
}: {
  judul: ReactNode;
  sub?: ReactNode;
  /** Menonjolkan blok ini dari kartu-kartu polos di sekitarnya - bar warna
   *  di kiri + judul berwarna, dipakai untuk satu bagian yang memang beda
   *  perannya (mis. area yang seluruhnya bisa diedit bebas), bukan hiasan. */
  aksen?: boolean;
  /** Chip bernomor di depan judul - urutan sub-langkah di dalam satu tab,
   *  bukan urutan tab (itu sudah dipegang topbar). Sama gayanya dengan
   *  chip nomor di `TAB` topbar, supaya bahasa visualnya konsisten. */
  nomor?: number;
}) {
  return (
    <div className={cx("mb-4 flex items-start gap-2.5", aksen && "border-l-4 border-primary pl-3")}>
      {nomor ? (
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-badge font-bold text-primary">
          {nomor}
        </span>
      ) : null}
      <div>
        <h2 className={cx("text-card-title", aksen ? "text-primary" : "text-fg")}>{judul}</h2>
        {sub ? <p className="mt-1 text-meta text-fg-subtle">{sub}</p> : null}
      </div>
    </div>
  );
}

/** Label pengelompokan bidang isian di dalam satu kartu - abu-abu, bukan
 *  primary: primary sudah dipakai `KepalaRincian` untuk menandai "ini hasil
 *  turunan", jadi warnanya sengaja beda supaya "kelompok isian" dan "hasil
 *  hitung" tidak pernah tertukar sekilas. */
export const Sublabel = ({ children }: { children: ReactNode }) => (
  <p className="mb-2 mt-5 text-label uppercase text-fg-muted first:mt-0">{children}</p>
);

export const Petak = ({ kolom = 2, children }: { kolom?: 2 | 3; children: ReactNode }) => (
  <div className={cx("grid gap-4", kolom === 3 ? "md:grid-cols-3" : "md:grid-cols-2")}>
    {children}
  </div>
);

/* ══════════════════════════════════════════════════════════════ isian ══ */

export function Bidang({
  label,
  petunjuk,
  children,
}: {
  label: ReactNode;
  petunjuk?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-meta font-semibold text-fg-muted">
        {label}
        {petunjuk ? <span className="ml-1 font-normal text-fg-subtle">{petunjuk}</span> : null}
      </span>
      {children}
    </label>
  );
}

const kelasKotak =
  "flex h-control items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 " +
  "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/25";

/**
 * Kotak isian angka dalam konvensi Indonesia.
 *
 * ## Dua state, dan kenapa keduanya perlu ada
 *
 * Saat kotak sedang difokus, nilainya adalah apa yang diketik - apa adanya,
 * termasuk keadaan setengah jadi seperti `"1.2"` yang sedang menuju `"1.250"`.
 * Memformat ulang tiap ketikan memindahkan kursor ke ujung dan membuat angka
 * tidak bisa disunting di tengah; itu keluhan pertama tiap kotak angka yang
 * "pintar".
 *
 * Begitu fokus lepas, nilainya ditulis ulang dari dokumen dalam bentuk rapi.
 */
export function IsianAngka({
  nilai,
  onUbah,
  awalan,
  akhiran,
  digit = 0,
  className,
  ariaLabel,
}: {
  nilai: number;
  onUbah: (n: number) => void;
  awalan?: string;
  akhiran?: string;
  digit?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [draf, setDraf] = useState<string | null>(null);
  const tampil = draf ?? tulisAngka(nilai, digit);

  return (
    <span className={cx(kelasKotak, className)}>
      {awalan ? <span className="text-meta text-fg-subtle">{awalan}</span> : null}
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        className="tabular w-full min-w-0 bg-transparent text-body font-medium text-fg outline-none"
        value={tampil}
        onChange={(e) => {
          setDraf(e.target.value);
          onUbah(bacaAngka(e.target.value));
        }}
        onBlur={() => setDraf(null)}
      />
      {akhiran ? <span className="text-meta text-fg-subtle">{akhiran}</span> : null}
    </span>
  );
}

export function IsianTeks({
  nilai,
  onUbah,
  className,
  ariaLabel,
}: {
  nilai: string;
  onUbah: (s: string) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <span className={cx(kelasKotak, className)}>
      <input
        type="text"
        aria-label={ariaLabel}
        className="w-full min-w-0 bg-transparent text-body font-semibold text-fg outline-none"
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
      />
    </span>
  );
}

/** Nilai turunan yang ditampilkan di tempat isian, supaya barisnya tetap rata. */
export const NilaiTurunan = ({
  children,
  akhiran,
}: {
  children: ReactNode;
  akhiran?: string;
}) => (
  <span className="flex h-control items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2.5">
    <span className="tabular text-body font-semibold text-fg">{children}</span>
    {akhiran ? <span className="text-meta text-fg-subtle">{akhiran}</span> : null}
  </span>
);

export function Segmen<T extends string | number>({
  nilai,
  pilihan,
  onUbah,
  label,
}: {
  nilai: T;
  pilihan: ReadonlyArray<{ nilai: T; label: string }>;
  onUbah: (n: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-md border border-border bg-surface-muted p-0.5"
    >
      {pilihan.map((p) => {
        const aktif = p.nilai === nilai;
        return (
          <button
            key={String(p.nilai)}
            type="button"
            role="radio"
            aria-checked={aktif}
            onClick={() => onUbah(p.nilai)}
            className={cx(
              "h-control-sm rounded-sm px-3 text-meta font-semibold transition-colors",
              aktif
                ? "bg-primary text-white"
                : "text-fg-muted hover:bg-surface hover:text-fg",
            )}
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export function Sakelar({
  nyala,
  onUbah,
  label,
}: {
  nyala: boolean;
  onUbah: (n: boolean) => void;
  label: ReactNode;
}) {
  const id = useId();
  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={nyala}
        onClick={() => onUbah(!nyala)}
        className={cx(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          nyala ? "border-primary bg-primary" : "border-border-strong bg-surface-muted",
        )}
      >
        <span
          className={cx(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-surface transition-all",
            nyala ? "left-4.5" : "left-0.5",
          )}
        />
      </button>
      <label htmlFor={id} className="cursor-pointer text-body text-fg-muted">
        {label}
      </label>
    </span>
  );
}

/* ═════════════════════════════════════════════════════════════ tombol ══ */

export function Tombol({
  children,
  onClick,
  jenis = "biasa",
  penuh,
  tipe = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  jenis?: "biasa" | "utama" | "garis";
  penuh?: boolean;
  tipe?: "button" | "submit";
}) {
  return (
    <button
      type={tipe}
      onClick={onClick}
      className={cx(
        "h-control rounded-md px-3 text-meta font-semibold transition-colors",
        penuh && "w-full",
        jenis === "utama" && "bg-primary text-white hover:bg-primary-hover",
        jenis === "biasa" &&
          "border border-border bg-surface text-fg-muted hover:border-border-strong hover:text-fg",
        jenis === "garis" &&
          "border border-dashed border-border-strong bg-transparent text-fg-muted hover:border-primary hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}

/** Tombol hapus. Selalu bertanda `×` dan selalu punya label yang bisa dibaca. */
export const TombolHapus = ({
  onClick,
  label,
  nonaktif,
}: {
  onClick: () => void;
  label: string;
  nonaktif?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={nonaktif}
    aria-label={label}
    title={label}
    className={cx(
      "flex h-control-sm w-control-sm items-center justify-center rounded-sm border border-border text-fg-subtle transition-colors",
      nonaktif
        ? "cursor-not-allowed opacity-40"
        : "hover:border-danger-fg hover:bg-danger-bg hover:text-danger-fg",
    )}
  >
    ×
  </button>
);

/* ══════════════════════════════════════════════════════════════ angka ══ */

/**
 * Angka yang punya ARAH. Tandanya tertulis, warnanya lapisan kedua.
 *
 * ⚠️ Ini satu-satunya cara menampilkan selisih, margin, dan dampak di aplikasi
 * ini. Sekitar 8% laki-laki tidak bisa memisahkan merah dari hijau; margin
 * negatif yang ditandai hanya dengan warna tidak jadi "kurang jelas" bagi
 * mereka, ia hilang. Dijaga `probe:format` dan `probe:builder`.
 *
 * `biaya` membalik pemilihan warnanya: total investasi yang NAIK bukan kabar
 * baik, dan mewarnainya hijau karena angkanya positif adalah cara tercepat
 * membuat orang salah baca tabel sensitivitas.
 */
export function Nilai({
  nilai,
  jenis = "rupiah",
  biaya = false,
  className,
}: {
  nilai: number;
  jenis?: "rupiah" | "persen" | "poin" | "pcs";
  biaya?: boolean;
  className?: string;
}) {
  const teks =
    jenis === "rupiah"
      ? delta(nilai)
      : jenis === "poin"
        ? poinDelta(nilai)
        : jenis === "pcs"
          ? pcsDelta(nilai)
          : persenDelta(nilai);
  const a: Arah = biaya ? arahBiaya(nilai) : arah(nilai);
  return (
    <span
      className={cx(
        "tabular font-semibold",
        a === "naik" && "text-naik",
        a === "turun" && "text-turun",
        a === "datar" && "text-datar",
        className,
      )}
    >
      {teks}
    </span>
  );
}

export const Angka = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx("tabular text-fg", className)}>{children}</span>
);

export function Kpi({
  label,
  nilai,
  keterangan,
  warna = "biasa",
}: {
  label: ReactNode;
  nilai: ReactNode;
  keterangan?: ReactNode;
  warna?: "biasa" | "primer" | "naik" | "turun";
}) {
  return (
    <div className="card p-4">
      <p className="text-meta font-semibold text-fg-muted">{label}</p>
      <p
        className={cx(
          "tabular mt-2 text-kpi break-words",
          warna === "primer" && "text-primary",
          warna === "naik" && "text-naik",
          warna === "turun" && "text-turun",
          warna === "biasa" && "text-fg",
        )}
      >
        {nilai}
      </p>
      {keterangan ? <p className="mt-1.5 text-meta text-fg-subtle">{keterangan}</p> : null}
    </div>
  );
}

export const PetakKpi = ({ children }: { children: ReactNode }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
);

/* ═════════════════════════════════════════════════════════════ rincian ══ */

export const Rincian = ({ children }: { children: ReactNode }) => (
  <dl className="flex flex-col">{children}</dl>
);

export const KepalaRincian = ({ children }: { children: ReactNode }) => (
  <dt className="mt-4 mb-1 text-label uppercase text-primary first:mt-0">{children}</dt>
);

export function BarisRincian({
  label,
  children,
  jenis = "biasa",
}: {
  label: ReactNode;
  children: ReactNode;
  jenis?: "biasa" | "subtotal" | "utama";
}) {
  return (
    <div
      className={cx(
        "flex items-center justify-between gap-4 py-2",
        jenis === "biasa" && "border-b border-border last:border-b-0",
        jenis === "subtotal" && "mt-1 border-t border-border-strong font-semibold",
        jenis === "utama" &&
          "mt-2 rounded-md border border-primary/30 bg-primary-subtle px-3 font-semibold",
      )}
    >
      <dt className={cx("text-body", jenis === "biasa" ? "text-fg-muted" : "text-fg")}>{label}</dt>
      <dd
        className={cx(
          "tabular text-body font-semibold",
          jenis === "utama" ? "text-primary" : "text-fg",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** Tabel lebar selalu punya scroll sendiri, supaya halaman tidak ikut bergeser. */
export const BungkusTabel = ({ children }: { children: ReactNode }) => (
  <div className="-mx-5 overflow-x-auto px-5">{children}</div>
);

export const Catatan = ({ children }: { children: ReactNode }) => (
  <p className="rounded-md border border-border bg-surface-muted p-3 text-meta text-fg-muted">
    {children}
  </p>
);

/* ═══════════════════════════════════════════════════════════ komposisi ══ */

/**
 * Donat dua bagian.
 *
 * Persentasenya ditulis di legenda, bukan cuma dikodekan sebagai sudut: satu
 * cincin yang terbagi 62/38 dan yang terbagi 58/42 terlihat sama, dan seluruh
 * gunanya bagan ini adalah menjawab "berapa persen".
 */
export function Donat({
  bagian,
  tengah,
  labelTengah,
}: {
  bagian: [{ label: string; nilai: number }, { label: string; nilai: number }];
  tengah: ReactNode;
  labelTengah: string;
}) {
  const total = bagian[0].nilai + bagian[1].nilai;
  const pct0 = total > 0 ? (bagian[0].nilai / total) * 100 : 0;
  const r = 62;
  const keliling = 2 * Math.PI * r;
  const panjang0 = (pct0 / 100) * keliling;

  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <svg viewBox="0 0 150 150" className="h-full w-full" role="img" aria-label={labelTengah}>
          <circle cx="75" cy="75" r={r} fill="none" strokeWidth="18" className="stroke-border" />
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            strokeWidth="18"
            strokeDasharray={`${panjang0} ${keliling}`}
            transform="rotate(-90 75 75)"
            className="stroke-primary"
          />
          <circle
            cx="75"
            cy="75"
            r={r}
            fill="none"
            strokeWidth="18"
            strokeDasharray={`${keliling - panjang0} ${keliling}`}
            transform={`rotate(${-90 + (pct0 / 100) * 360} 75 75)`}
            className="stroke-brand"
          />
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tabular text-card-title text-fg">{tengah}</span>
          <span className="text-meta text-fg-subtle">{labelTengah}</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2 text-body">
        {bagian.map((b, i) => (
          <li key={b.label} className="flex items-center gap-2">
            <span
              className={cx("h-2.5 w-2.5 rounded-sm", i === 0 ? "bg-primary" : "bg-brand")}
              aria-hidden
            />
            <span className="text-fg-muted">{b.label}</span>
            <span className="tabular font-semibold text-fg">
              {total > 0
                ? (i === 0 ? pct0 : 100 - pct0).toFixed(1).replace(".", ",") + "%"
                : "-"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Batang komposisi COGS terhadap harga jual.
 *
 * Menggantikan gambar botol yang terisi di builder lama. Botolnya bagus dilihat
 * dan sulit dibaca: tinggi cairan di dalam bentuk yang menyempit ke leher bukan
 * proporsi linear, jadi mata membaca porsi yang salah - dan dua botol
 * berdampingan tidak bisa dibandingkan sama sekali karena bentuknya berbeda.
 * Batang lurus dengan skala yang sama menjawab pertanyaan yang sama, dan
 * menjawabnya dengan benar.
 */
export function BatangKomposisi({
  harga,
  bagian,
}: {
  harga: number;
  bagian: ReadonlyArray<{ label: string; nilai: number; kelas: string }>;
}) {
  const cogs = bagian.reduce((a, b) => a + b.nilai, 0);
  const skala = Math.max(harga, cogs);
  const persen = (n: number) => (skala > 0 ? (n / skala) * 100 : 0);
  const margin = harga - cogs;

  return (
    <div className="mt-3">
      <div className="flex h-5 w-full overflow-hidden rounded-sm border border-border bg-surface-muted">
        {bagian.map((b) => (
          <span
            key={b.label}
            className={b.kelas}
            style={{ width: `${persen(b.nilai)}%` }}
            title={`${b.label}`}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-fg-subtle">
        {bagian.map((b) => (
          <span key={b.label} className="flex items-center gap-1.5">
            <span className={cx("h-2 w-2 rounded-sm", b.kelas)} aria-hidden />
            {b.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm border border-border bg-surface-muted" aria-hidden />
          {margin >= 0 ? "Gross margin" : "COGS melebihi harga"}
        </span>
      </div>
    </div>
  );
}

/**
 * Peringatan yang cuma muncul kalau ada yang perlu diperingatkan.
 *
 * Teksnya menyebut ANGKANYA, bukan cuma keadaannya. "Margin negatif" membuat
 * pembaca mencari sendiri seberapa negatif; menyebut selisihnya menghemat
 * langkah itu di layar yang isinya sudah padat.
 */
export const Peringatan = ({ children }: { children: ReactNode }) => (
  <p className="mt-3 flex items-start gap-2 rounded-md border border-danger-fg/30 bg-danger-bg p-2.5 text-meta text-danger-fg">
    <span aria-hidden>⚠</span>
    <span>{children}</span>
  </p>
);

/* ═══════════════════════════════════════════════════════════════ kabar ══ */

/**
 * Pesan sementara di pojok kanan bawah.
 *
 * Tanpa state sendiri: kapan ia hilang diputuskan `DokumenProvider`, yang
 * memang sudah memegang timer-nya. Menyalin "sedang tampil" ke state di sini
 * berarti dua sumber untuk satu keadaan - dan yang kedua cuma bisa salah.
 *
 * `role="status"` membuat pembaca layar mengumumkannya tanpa memindahkan fokus;
 * `alert` akan memotong apa pun yang sedang dibaca demi kata "Tersimpan".
 */
export function Kabar({ pesan }: { pesan: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-cetak="sembunyi"
      className={cx(
        "fixed bottom-5 right-5 z-50 rounded-md border border-border bg-surface px-3 py-2 text-meta font-semibold text-fg transition-opacity",
        pesan ? "opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{ boxShadow: "var(--shadow-overlay)" }}
    >
      {pesan}
    </div>
  );
}
