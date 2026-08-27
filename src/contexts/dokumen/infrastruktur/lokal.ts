/**
 * Penyimpanan lokal — jaring pengaman kalau Supabase tidak terjangkau.
 *
 * Kuncinya SENGAJA masih `sos_ue_v1`, sama seperti builder lama. Mengganti nama
 * kunci berarti setiap orang yang sudah punya angka di browsernya membuka
 * halaman baru dan menemukan angka contoh — dan mengira datanya hilang. Bentuk
 * payload-nya berubah, tapi `bacaDokumen()` menerima bentuk lama maupun baru,
 * jadi kunci yang sama justru yang membuat perpindahannya tidak terasa.
 */
import type { Dokumen } from "../domain/dokumen";
import { bacaDokumen } from "../domain/migrasi";

const KUNCI = "sos_ue_v1";

/**
 * `null` kalau belum ada apa pun tersimpan — bukan dokumen awal.
 *
 * Bedanya penting bagi pemanggil: "belum pernah dipakai" adalah alasan untuk
 * menunggu muatan dari Supabase, sementara dokumen awal adalah jawaban akhir
 * yang akan menimpanya.
 */
export function muatLokal(): Dokumen | null {
  if (typeof window === "undefined") return null;
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return null;
    return bacaDokumen(JSON.parse(mentah));
  } catch {
    /* Payload rusak (quota terlampaui saat menulis, atau disunting tangan)
       tidak boleh menghalangi halaman terbuka. */
    return null;
  }
}

export function simpanLokal(dok: Dokumen): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(dok));
  } catch {
    /* Mode privat di Safari melempar di sini. Kehilangan cadangan lokal jauh
       lebih ringan daripada halaman yang berhenti menerima ketikan. */
  }
}

export function hapusLokal(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KUNCI);
  } catch {
    /* sama seperti di atas */
  }
}
