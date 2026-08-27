import type { Metadata } from "next";
import { UnitEconomicsLayar } from "./unit-economics-layar";

export const metadata: Metadata = { title: "Unit Economics per Botol" };

export default function Halaman() {
  return <UnitEconomicsLayar />;
}
