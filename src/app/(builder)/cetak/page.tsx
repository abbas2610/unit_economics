import type { Metadata } from "next";
import { CetakLayar } from "./cetak-layar";

export const metadata: Metadata = { title: "Laporan - Unit Economics" };

export default function Halaman() {
  return <CetakLayar />;
}
