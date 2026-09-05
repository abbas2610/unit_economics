import type { Metadata } from "next";
import { RiwayatLayar } from "./riwayat-layar";

export const metadata: Metadata = { title: "Riwayat - Unit Economics" };

export default function Halaman() {
  return <RiwayatLayar />;
}
