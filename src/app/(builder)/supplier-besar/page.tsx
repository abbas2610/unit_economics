import type { Metadata } from "next";
import { HalamanSupplier } from "@/components/halaman-supplier";

export const metadata: Metadata = { title: "Supplier Botol Besar — Unit Economics" };

export default function Halaman() {
  return <HalamanSupplier ukuran="besar" />;
}
