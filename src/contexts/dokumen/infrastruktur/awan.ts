/**
 * Sinkronisasi dokumen ke Supabase — satu baris, satu tim.
 *
 * Tabelnya `unit_economics(id text primary key, payload jsonb, updated_at
 * timestamptz)`. Skemanya di supabase/migrations/0001_awal.sql.
 *
 * ## ⚠️ Tidak ada autentikasi, dan itu keputusan yang harus dibaca
 *
 * Siapa pun yang punya anon key — yang ada di dalam bundle, jadi siapa pun yang
 * membuka halaman ini — bisa membaca dan MENIMPA dokumen tim. Itu memang
 * perilaku builder sejak awal, dan risikonya ditulis lengkap di
 * docs/INFRASTRUKTUR.md → "Yang menjaga dokumen ini, dan yang tidak".
 * Memindahkannya ke Next tidak memperbaikinya, dan tidak juga memperburuknya.
 *
 * ## Konflik diselesaikan dengan "yang terakhir menulis menang"
 *
 * Tidak ada penggabungan. Dua orang yang menyunting kolom berbeda pada saat yang
 * sama akan saling menimpa seluruh dokumen. Yang menahan kerusakannya cuma
 * ukuran tim (satu digit) dan `langgananDokumen()` di bawah, yang mendorong
 * perubahan orang lain ke layar dalam hitungan detik — sehingga jendela waktu
 * dua orang memegang versi berbeda tetap pendek.
 */
import type { RealtimeChannel } from "@supabase/supabase-js";
import { klienBrowser } from "@/infrastruktur/supabase/klien-browser";
import { ID_DOKUMEN } from "@/infrastruktur/supabase/env";
import type { Dokumen } from "../domain/dokumen";
import { bacaDokumen } from "../domain/migrasi";

const TABEL = "unit_economics";

export type MuatanAwan =
  | { jenis: "ada"; dokumen: Dokumen; payloadMentah: unknown; diperbaruiPada: string }
  | { jenis: "kosong" }
  | { jenis: "mati" }
  | { jenis: "gagal"; pesan: string };

/**
 * Muat dokumen bersama.
 *
 * `kosong` — barisnya belum pernah dibuat — dibedakan dari `gagal` dengan
 * sengaja: yang pertama artinya "kirim yang ada di layar ini ke sana", yang
 * kedua artinya "jangan kirim apa pun, jaringan sedang bermasalah". Meleburnya
 * berarti gangguan jaringan sesaat bisa menimpa dokumen tim dengan angka contoh.
 */
export async function muatDariAwan(): Promise<MuatanAwan> {
  const supa = klienBrowser();
  if (!supa) return { jenis: "mati" };
  try {
    const { data, error } = await supa
      .from(TABEL)
      .select("payload,updated_at")
      .eq("id", ID_DOKUMEN)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { jenis: "kosong" };
    return {
      jenis: "ada",
      dokumen: bacaDokumen(data.payload),
      payloadMentah: data.payload,
      diperbaruiPada: String(data.updated_at ?? ""),
    };
  } catch (e) {
    return { jenis: "gagal", pesan: e instanceof Error ? e.message : String(e) };
  }
}

export type BarisRiwayat = { payload: unknown; updatedAt: string; disalinPada: string };

/**
 * Snapshot versi lama, ditulis trigger `simpan_riwayat_unit_economics()` di
 * supabase/migrations/0002_riwayat.sql — bukan kode aplikasi ini. Payload
 * mentah dikembalikan apa adanya (bukan `bacaDokumen()`) supaya halaman
 * Riwayat bisa mem-parse tiap versi dengan bentuknya sendiri-sendiri; migrasi
 * dokumen tetap satu pintu (`bacaDokumen`), dipanggil pemanggil fungsi ini.
 */
export async function muatRiwayat(limit = 100): Promise<BarisRiwayat[]> {
  const supa = klienBrowser();
  if (!supa) return [];
  const { data, error } = await supa
    .from("unit_economics_riwayat")
    .select("payload,updated_at,disalin_pada")
    .eq("dokumen_id", ID_DOKUMEN)
    .order("disalin_pada", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data.map((r) => ({
    payload: r.payload,
    updatedAt: String(r.updated_at ?? ""),
    disalinPada: String(r.disalin_pada ?? ""),
  }));
}

export type HasilSimpan =
  | { jenis: "tersimpan"; diperbaruiPada: string }
  | { jenis: "mati" }
  | { jenis: "gagal"; pesan: string };

export async function simpanKeAwan(dok: Dokumen): Promise<HasilSimpan> {
  const supa = klienBrowser();
  if (!supa) return { jenis: "mati" };
  try {
    const { data, error } = await supa
      .from(TABEL)
      .upsert({ id: ID_DOKUMEN, payload: dok, updated_at: new Date().toISOString() })
      .select("updated_at")
      .single();
    if (error) throw error;
    return { jenis: "tersimpan", diperbaruiPada: String(data.updated_at ?? "") };
  } catch (e) {
    return { jenis: "gagal", pesan: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Dengarkan perubahan dari anggota tim lain.
 *
 * Mengembalikan fungsi pembatal. **Wajib dipanggil saat komponen dilepas** —
 * kanal realtime yang tidak ditutup terus menumpuk tiap kali React memasang
 * ulang efeknya, dan yang terlihat cuma halaman yang makin lambat.
 */
export function langgananDokumen(
  saatBerubah: (dok: Dokumen, payloadMentah: unknown, diperbaruiPada: string) => void,
): () => void {
  const supa = klienBrowser();
  if (!supa) return () => {};

  const kanal: RealtimeChannel = supa
    .channel("unit_economics_changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABEL,
        filter: `id=eq.${ID_DOKUMEN}`,
      },
      (pesan) => {
        const baris = pesan.new as { payload?: unknown; updated_at?: string } | null;
        if (!baris?.payload) return;
        saatBerubah(bacaDokumen(baris.payload), baris.payload, String(baris.updated_at ?? ""));
      },
    )
    .subscribe();

  return () => {
    void supa.removeChannel(kanal);
  };
}
