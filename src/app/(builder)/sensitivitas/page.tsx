import type { Metadata } from "next";
import { SensitivitasLayar } from "./sensitivitas-layar";

export const metadata: Metadata = { title: "Sensitivity Analysis" };

export default function Halaman() {
  return <SensitivitasLayar />;
}
