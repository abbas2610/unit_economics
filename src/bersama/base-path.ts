/**
 * Prefix rute aplikasi ini di dalam repo portfolio.
 *
 * Satu sumber untuk `next.config.ts` (dipakai Next saat build) dan
 * `app-shell.tsx` (dipakai membangun tautan tab yang menghindari
 * client-side transition Next router di produksi — lihat catatan di sana).
 * Dua salinan string yang sama akan diam-diam bercerai begitu salah satunya
 * diedit sendirian.
 */
export const BASE_PATH = "/perfume-app";
