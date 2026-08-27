import type { Metadata } from "next";
import { InvestasiLayar } from "./investasi-layar";

export const metadata: Metadata = { title: "Initial Investment — Unit Economics" };

export default function Halaman() {
  return <InvestasiLayar />;
}
