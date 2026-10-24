import type { Metadata } from "next";
import Curriculo from "@/components/Curriculo";

export const metadata: Metadata = {
  title: "Résumé — Lucas Melo",
  description:
    "Résumé of Lucas Melo (EN/PT): Creative Developer and Full-Stack Developer — React, Next.js, TypeScript, GSAP, WebGL, Supabase and automation.",
  alternates: { canonical: "/curriculo" },
  openGraph: { url: "/curriculo", type: "profile" },
};

/** Sem preloader nem emblema; Lenis desligado nesta rota (scroll nativo, impressão A4). SSR em EN (v4 §2). */
export default function CurriculoPage() {
  return <Curriculo />;
}
