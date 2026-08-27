/**
 * Resolver untuk menjalankan modul `src/` di Node tanpa bundler.
 *
 * Node bisa melepas tipe TypeScript sendiri, tapi ia tetap butuh ekstensi yang
 * eksplisit — sementara kode aplikasi memakai gaya bundler (`./master`, `@/data/x`).
 * Hook ini menambal keduanya khusus untuk probe; aplikasinya sendiri di-resolve
 * webpack dan tidak menyentuh file ini.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

const SRC = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;
const EXT = [".ts", ".tsx", "/index.ts", "/index.tsx"];

export async function resolve(specifier, context, next) {
  let spec = specifier;
  if (spec.startsWith("@/")) spec = SRC + spec.slice(2);

  try {
    return await next(spec, context);
  } catch (err) {
    for (const ext of EXT) {
      try {
        return await next(spec + ext, context);
      } catch {
        /* coba ekstensi berikutnya */
      }
    }
    throw err;
  }
}
