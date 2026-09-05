/**
 * Diff generik antara dua nilai berbentuk JSON (objek, array, primitif).
 *
 * Dipakai halaman Riwayat untuk menjawab "apa yang berubah" antara dua
 * snapshot `Dokumen` — tapi ditulis tidak tahu apa pun soal `Dokumen` secara
 * spesifik, supaya tetap murni dan bisa diuji tanpa import konteks mana pun.
 * Lihat docs/ARSITEKTUR-DOMAIN.md — fungsi lintas server/klien tinggal di sini,
 * bukan di berkas ber-`"use client"`.
 *
 * ## Array dicocokkan lewat `id`, bukan index
 *
 * Menghapus supplier pertama dari daftar tiga membuat SELURUH index bergeser;
 * dibandingkan per-index, itu terbaca sebagai "tiga supplier berubah" padahal
 * yang sungguh terjadi cuma "satu dihapus". Elemen yang punya field `id`
 * dicocokkan lewat id-nya; yang tidak (mis. `Varian`, tanpa id) dicocokkan
 * lewat index apa adanya — lebih baik daripada tidak sama sekali untuk daftar
 * yang jarang berubah urutannya.
 */

export type PerubahanNilai = {
  path: string;
  jenis: "ubah" | "tambah" | "hapus";
  dari: unknown;
  ke: unknown;
};

const isObjek = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const setara = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a === "number" && typeof b === "number") return a === b;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

const punyaId = (v: unknown): v is { id: string } =>
  isObjek(v) && typeof v.id === "string";

function diffArray(path: string, lama: unknown[], baru: unknown[], out: PerubahanNilai[]): void {
  const semuaPunyaId = lama.every(punyaId) && baru.every(punyaId);

  if (semuaPunyaId) {
    const idLama = new Map((lama as { id: string }[]).map((v) => [v.id, v]));
    const idBaru = new Map((baru as { id: string }[]).map((v) => [v.id, v]));
    for (const [id, v] of idLama) {
      if (!idBaru.has(id)) out.push({ path: `${path}[${id}]`, jenis: "hapus", dari: v, ke: undefined });
    }
    for (const [id, v] of idBaru) {
      if (!idLama.has(id)) out.push({ path: `${path}[${id}]`, jenis: "tambah", dari: undefined, ke: v });
    }
    for (const [id, v] of idLama) {
      const w = idBaru.get(id);
      if (w !== undefined) diffNilai(`${path}[${id}]`, v, w, out);
    }
    return;
  }

  const n = Math.max(lama.length, baru.length);
  for (let i = 0; i < n; i++) {
    if (i >= lama.length) out.push({ path: `${path}[${i}]`, jenis: "tambah", dari: undefined, ke: baru[i] });
    else if (i >= baru.length) out.push({ path: `${path}[${i}]`, jenis: "hapus", dari: lama[i], ke: undefined });
    else diffNilai(`${path}[${i}]`, lama[i], baru[i], out);
  }
}

function diffNilai(path: string, lama: unknown, baru: unknown, out: PerubahanNilai[]): void {
  if (setara(lama, baru)) return;

  if (Array.isArray(lama) && Array.isArray(baru)) {
    diffArray(path, lama, baru, out);
    return;
  }

  if (isObjek(lama) && isObjek(baru)) {
    const kunci = new Set([...Object.keys(lama), ...Object.keys(baru)]);
    for (const k of kunci) {
      diffNilai(path ? `${path}.${k}` : k, lama[k], baru[k], out);
    }
    return;
  }

  out.push({ path, jenis: "ubah", dari: lama, ke: baru });
}

/** Daftar perubahan level-daun antara dua nilai JSON, path-nya berbentuk `a.b[id].c`. */
export function diffDokumen(lama: unknown, baru: unknown): PerubahanNilai[] {
  const out: PerubahanNilai[] = [];
  diffNilai("", lama, baru, out);
  return out;
}
