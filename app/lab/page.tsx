import type { Metadata } from "next";
import { Lab } from "@/components/lab/Lab";

export const metadata: Metadata = {
  title: "Lab — Lucas Melo",
  description: "Lab: four interactive experiments by Lucas Melo — a noise orb, a Verlet cloth emblem, ember particles that spell your word and an ember fluid.",
};

export default function Page() {
  return <Lab />;
}
