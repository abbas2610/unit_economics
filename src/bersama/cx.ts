/**
 * Penggabung className. Sengaja tinggal di kernel, BUKAN di `components/ui.tsx`.
 *
 * ⚠️ Alasannya bukan kerapian. `ui.tsx` berawalan `"use client"`, dan di React
 * Server Components direktif itu berarti seluruh isinya jadi **referensi
 * klien** — boleh dirender oleh server, tidak boleh DIPANGGIL oleh server. Satu
 * komponen server yang memanggil `cx()` dari badannya sendiri melempar
 *
 *     Attempted to call cx() from the server but cx is on the client.
 *
 * Yang menipu: build sukses, typecheck sukses, dan `next dev` sempat terlihat
 * baik-baik saja. Errornya baru muncul saat halaman benar-benar dirender.
 *
 * Aturannya satu kalimat: **fungsi murni yang dipakai lintas server/klien
 * tinggal di `src/bersama/`, tidak pernah di berkas ber-`"use client"`.**
 */
export const cx = (...c: (string | false | null | undefined)[]) =>
  c.filter(Boolean).join(" ");
