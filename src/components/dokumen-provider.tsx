"use client";

/**
 * Satu dokumen untuk seluruh aplikasi, plus penyimpanannya.
 *
 * ## Kenapa satu state di atas, bukan per halaman
 *
 * Keenam tab membaca dan menulis dokumen yang sama: mengubah kurs di tab 1
 * menggeser COGS di tab 5 dan total investasi di tab 4. Kalau tiap halaman punya
 * salinannya sendiri, berpindah tab berarti menyinkronkan tiga salinan — dan
 * yang tertinggal tidak menghasilkan error, cuma angka yang berbeda di dua
 * layar yang seharusnya sama.
 *
 * ## Urutan pemuatan, dan kenapa render pertama SELALU dokumen awal
 *
 * Halaman ini di-prerender saat `next build`, di Node, tanpa localStorage
 * maupun jaringan. Kalau render pertama di browser sudah membaca localStorage,
 * HTML hasil build dan hasil hydrate berbeda — hydration mismatch, dan React
 * membuang seluruh pohonnya lalu merender ulang. Jadi: render pertama dokumen
 * awal, muatan sungguhan masuk di `useEffect`.
 *
 * Urutannya:  awan → lokal → awal
 *
 * Awan menang karena ia yang dilihat bersama. Lokal cuma jaring pengaman untuk
 * wifi ruang rapat yang putus, dan ia sengaja TIDAK menimpa awan — dokumen yang
 * tertinggal di satu laptop tidak boleh mengembalikan angka lama ke seluruh tim.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Dokumen } from "@/contexts/dokumen/domain/dokumen";
import { dokumenAwal } from "@/contexts/dokumen/domain/dokumen";
import { bacaDokumen } from "@/contexts/dokumen/domain/migrasi";
import { muatLokal, simpanLokal } from "@/contexts/dokumen/infrastruktur/lokal";
import {
  langgananDokumen,
  muatDariAwan,
  simpanKeAwan,
} from "@/contexts/dokumen/infrastruktur/awan";
import { awanTersedia } from "@/infrastruktur/supabase/env";

export type StatusAwan = "memuat" | "tersinkron" | "menyimpan" | "diperbarui" | "gagal" | "lokal";

type Isi = {
  dok: Dokumen;
  status: StatusAwan;
  /** Pesan sementara di pojok layar ("Tersimpan", "Data diimport", …). */
  kabar: string | null;
  ubah: (fn: (d: Dokumen) => Dokumen) => void;
  ganti: (dok: Dokumen, pesan?: string) => void;
  beriKabar: (pesan: string) => void;
};

const Konteks = createContext<Isi | null>(null);

/** Jeda sebelum perubahan dikirim ke Supabase. */
const JEDA_SIMPAN_MS = 700;

export function DokumenProvider({ children }: { children: ReactNode }) {
  const [dok, setDok] = useState<Dokumen>(dokumenAwal);
  const [status, setStatus] = useState<StatusAwan>(awanTersedia() ? "memuat" : "lokal");
  const [kabar, setKabar] = useState<string | null>(null);

  /* Stempel waktu versi terakhir yang KITA tulis. Dipakai mengabaikan gema
     realtime dari simpanan kita sendiri — tanpa ini tiap ketikan memantul balik
     dari server dan menimpa kotak isian yang sedang diketik. */
  const stempelKita = useRef<string | null>(null);
  const timerSimpan = useRef<ReturnType<typeof setTimeout> | null>(null);
  /* Sudah pernah dimuat? Sebelum itu, jangan menyimpan apa pun — menyimpan
     dokumen awal sebelum muatan awan datang akan menimpa angka tim dengan
     angka contoh. */
  const siap = useRef(false);

  /**
   * Sudah ada yang diketik sebelum muatan awal mendarat?
   *
   * ⚠️ Tanpa ini, mengetik pada detik pertama halaman dibuka akan HILANG:
   * pemuatan berjalan asinkron, dan hasilnya memanggil `setDok()` yang menimpa
   * apa pun yang sudah disunting sementara ia menunggu. Yang terlihat di layar
   * cuma angka yang melompat kembali sendiri — tanpa error, dan tanpa cara
   * menebak apa yang barusan terjadi.
   *
   * Kalau ada yang sudah mengetik, ketikannya yang menang. Ia menyatakan niat;
   * muatan awal cuma titik mulai.
   */
  const sudahDisunting = useRef(false);

  const beriKabar = useCallback((pesan: string) => {
    setKabar(pesan);
    setTimeout(() => setKabar((k) => (k === pesan ? null : k)), 1600);
  }, []);

  /* ── muat ──────────────────────────────────────────────────────────────── */
  useEffect(() => {
    let batal = false;

    (async () => {
      const lokal = muatLokal();

      if (!awanTersedia()) {
        if (!batal && lokal && !sudahDisunting.current) setDok(lokal);
        siap.current = true;
        setStatus("lokal");
        return;
      }

      const hasil = await muatDariAwan();
      if (batal) return;

      if (hasil.jenis === "ada") {
        if (!sudahDisunting.current) setDok(hasil.dokumen);
        stempelKita.current = hasil.diperbaruiPada;
        setStatus("tersinkron");
      } else if (hasil.jenis === "kosong") {
        /* Baris bersama belum ada. Kirim yang ada di layar — lokal kalau ada,
           kalau tidak dokumen awal — supaya tim berikutnya punya titik mulai. */
        const awal = lokal ?? dokumenAwal();
        setDok(awal);
        const simpan = await simpanKeAwan(awal);
        if (!batal && simpan.jenis === "tersimpan") {
          stempelKita.current = simpan.diperbaruiPada;
          setStatus("tersinkron");
        } else if (!batal) {
          setStatus("gagal");
        }
      } else {
        /* Gagal atau mati: pakai cadangan lokal, dan JANGAN menulis balik.
           Gangguan jaringan sesaat tidak boleh menimpa dokumen tim. */
        if (lokal && !sudahDisunting.current) setDok(lokal);
        setStatus(hasil.jenis === "mati" ? "lokal" : "gagal");
      }
      siap.current = true;
    })();

    return () => {
      batal = true;
    };
  }, []);

  /* ── dengarkan perubahan tim ───────────────────────────────────────────── */
  useEffect(() => {
    if (!awanTersedia()) return;
    return langgananDokumen((dokBaru, stempel) => {
      if (stempel && stempel === stempelKita.current) return; // gema simpanan kita

      /* Jangan mengganti dokumen saat ada yang sedang mengetik: nilai di kotak
         isian akan melompat di tengah kalimat, dan yang sudah diketik hilang.
         Perubahan itu akan ikut terbawa pada muatan berikutnya. */
      const aktif = document.activeElement;
      if (aktif && (aktif.tagName === "INPUT" || aktif.tagName === "TEXTAREA")) return;

      stempelKita.current = stempel;
      setDok(dokBaru);
      setStatus("diperbarui");
      beriKabar("Data diperbarui oleh tim");
    });
  }, [beriKabar]);

  /* ── simpan ────────────────────────────────────────────────────────────── */
  const jadwalkanSimpan = useCallback((dokBaru: Dokumen) => {
    simpanLokal(dokBaru);
    if (!awanTersedia() || !siap.current) return;

    if (timerSimpan.current) clearTimeout(timerSimpan.current);
    setStatus("menyimpan");
    timerSimpan.current = setTimeout(async () => {
      const hasil = await simpanKeAwan(dokBaru);
      if (hasil.jenis === "tersimpan") {
        stempelKita.current = hasil.diperbaruiPada;
        setStatus("tersinkron");
      } else {
        setStatus(hasil.jenis === "mati" ? "lokal" : "gagal");
      }
    }, JEDA_SIMPAN_MS);
  }, []);

  const ubah = useCallback(
    (fn: (d: Dokumen) => Dokumen) => {
      sudahDisunting.current = true;
      setDok((lama) => {
        const baru = fn(lama);
        jadwalkanSimpan(baru);
        return baru;
      });
    },
    [jadwalkanSimpan],
  );

  const ganti = useCallback(
    (dokBaru: Dokumen, pesan?: string) => {
      /* Lewat `bacaDokumen()` walau sumbernya sudah bertipe Dokumen: berkas
         JSON yang di-import bisa saja bentuk lama, dan id gandanya harus
         diperbaiki sebelum masuk. */
      const bersih = bacaDokumen(dokBaru);
      setDok(bersih);
      jadwalkanSimpan(bersih);
      if (pesan) beriKabar(pesan);
    },
    [jadwalkanSimpan, beriKabar],
  );

  const nilai = useMemo<Isi>(
    () => ({ dok, status, kabar, ubah, ganti, beriKabar }),
    [dok, status, kabar, ubah, ganti, beriKabar],
  );

  return <Konteks.Provider value={nilai}>{children}</Konteks.Provider>;
}

export function useDokumen(): Isi {
  const isi = useContext(Konteks);
  if (!isi) throw new Error("useDokumen dipakai di luar <DokumenProvider>");
  return isi;
}
