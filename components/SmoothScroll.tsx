"use client";
import Lenis from "lenis";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { gsap, ScrollTrigger } from "@/lib/gsap";
import { holdScroll, releaseScroll, setLenisStore } from "@/lib/lenis-store";
import { initTier, useTier } from "@/lib/tier";

const LenisCtx = createContext<Lenis | null>(null);
export const useLenis = () => useContext(LenisCtx);

/**
 * Único controlador de smooth scroll (Lenis), persistente no layout (v4 §1). Relógio = ticker do GSAP e cada
 * scroll atualiza o ScrollTrigger. Desligado em reduced-motion e em /curriculo (scroll nativo, impressão); em
 * /works modo grade a própria página chama stop(). O stop() de 3300 ms vale só na intro do 1º carregamento.
 */
export default function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null);
  const pathname = usePathname();
  const tier = useTier();
  // v5: tier low (lite) = scroll nativo. initTier() é síncrono e idempotente: decide antes do 1º Lenis.
  const lite = tier === "low";
  const enabled = !pathname.startsWith("/curriculo") && !lite;

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    const refresh = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(refresh);
    window.addEventListener("load", refresh);
    // v5: a altura do documento muda depois da montagem (ex.: /about troca o acordeão por colunas no desktop);
    // sem refresh, gatilhos ficavam além do fim da rolagem. Um refresh por mudança de altura, com debounce.
    let t = 0;
    let lastH = document.documentElement.scrollHeight;
    const ro = new ResizeObserver(() => {
      const h = document.documentElement.scrollHeight;
      if (Math.abs(h - lastH) < 2) return;
      lastH = h;
      window.clearTimeout(t);
      t = window.setTimeout(refresh, 250);
    });
    ro.observe(document.body);
    return () => {
      window.removeEventListener("load", refresh);
      ro.disconnect();
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !enabled || initTier().tier === "low") return;
    const intro = document.documentElement.dataset.intro === "run";
    if (intro) window.scrollTo(0, 0);
    const l = new Lenis({ duration: 1.2, smoothWheel: true, syncTouch: false, autoRaf: false });
    l.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => l.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    setLenis(l);
    setLenisStore(l);

    let t: number | undefined;
    if (intro && performance.now() < 3300) {
      holdScroll("intro");
      t = window.setTimeout(() => {
        releaseScroll("intro");
        ScrollTrigger.refresh();
      }, Math.max(0, 3300 - performance.now()));
    }
    return () => {
      if (t) {
        clearTimeout(t);
        releaseScroll("intro");
      }
      gsap.ticker.remove(tick);
      l.destroy();
      setLenis(null);
      setLenisStore(null);
    };
  }, [enabled]);

  return <LenisCtx.Provider value={lenis}>{children}</LenisCtx.Provider>;
}
