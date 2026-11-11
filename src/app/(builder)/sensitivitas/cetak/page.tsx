import type { Metadata } from "next";
import { CetakSensitivitas } from "./cetak-sensitivitas";

export const metadata: Metadata = { title: "Sensitivity Analysis - Laporan" };

export default function Halaman() {
  return <CetakSensitivitas />;
}
