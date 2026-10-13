/**
 * Pindahkan satu elemen ke indeks lain — dipakai mengurutkan kartu supplier
 * dan vendor packaging dengan seret.
 *
 * Dicari lewat `id`, bukan indeks asal: antara seret dimulai dan dilepas,
 * siaran realtime dari rekan tim bisa menambah atau menghapus supplier, dan
 * indeks yang diingat sejak awal seret bisa sudah menunjuk elemen lain.
 *
 * `ke` adalah indeks AKHIR elemen itu di larik hasil. Di luar batas dijepit
 * ke ujung terdekat — pointer yang dilepas di atas kartu pertama memang berarti
 * "taruh paling atas". Larik asalnya tidak pernah diubah.
 */
export function pindahkan<T extends { id: string }>(
  daftar: readonly T[],
  id: string,
  ke: number,
): T[] {
  const dari = daftar.findIndex((x) => x.id === id);
  if (dari === -1 || !Number.isFinite(ke)) return [...daftar];
  const sisa = daftar.filter((_, i) => i !== dari);
  const tujuan = Math.max(0, Math.min(sisa.length, Math.trunc(ke)));
  return [...sisa.slice(0, tujuan), daftar[dari], ...sisa.slice(tujuan)];
}
