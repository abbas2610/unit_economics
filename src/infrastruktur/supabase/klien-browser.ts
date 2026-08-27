/**
 * Klien Supabase untuk browser. Satu instans, dibuat malas.
 *
 * ⚠️ Dibuat sekali dan disimpan, bukan dibuat tiap pemanggilan. Tiap
 * `createClient()` membuka koneksi realtime sendiri; membuatnya di dalam
 * komponen React berarti satu koneksi baru tiap render, dan yang lama tidak
 * ditutup siapa pun. Gejalanya bukan error — gejalanya halaman yang makin lambat
 * makin lama dibuka, dan Supabase yang menolak koneksi setelah beberapa jam
 * rapat.
 *
 * Tidak ada `@supabase/ssr` di sini, dan itu bukan kelalaian: aplikasi ini
 * export statis tanpa sesi per pengguna, jadi tidak ada cookie yang perlu
 * dibaca server maupun disegarkan proxy.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { kredensialSupabase } from "./env";

let klien: SupabaseClient | null | undefined;

/** `null` kalau kredensialnya belum diisi — pemanggil wajib menanganinya. */
export function klienBrowser(): SupabaseClient | null {
  if (klien !== undefined) return klien;
  const kredensial = kredensialSupabase();
  if (!kredensial) {
    klien = null;
    return klien;
  }
  klien = createClient(kredensial.url, kredensial.anonKey, {
    auth: {
      /* Tidak ada login di aplikasi ini, jadi tidak ada sesi yang perlu
         disimpan maupun disegarkan. Membiarkannya menyala menaruh entri
         kosong di localStorage dan menyalakan timer refresh yang tidak pernah
         punya token untuk disegarkan. */
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return klien;
}
