import type { Metadata } from "next";
import { AsumsiLayar } from "./asumsi-layar";

/* Pembungkus server: yang dibutuhkan darinya cuma `metadata`, yang tidak boleh
   diekspor dari berkas ber-`"use client"`. Judul per tab bukan hiasan sekarang -
   tiap tab punya URL sendiri, jadi tiap tab bisa jadi tab browser sendiri. */
export const metadata: Metadata = { title: "Asumsi Dasar - Unit Economics" };

export default function Halaman() {
  return <AsumsiLayar />;
}
