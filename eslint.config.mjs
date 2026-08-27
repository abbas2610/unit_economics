import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /* Berkas asli sebelum port. Disimpan sebagai rujukan angka, bukan kode yang
       dirawat — melintingnya berarti memperbaiki berkas yang sengaja dibekukan. */
    "referensi/**",
  ]),
]);

export default eslintConfig;
