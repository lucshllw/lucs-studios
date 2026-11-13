"use client";
// Lenis no MESMO gsap.ticker (lib/loop); sem ScrollTrigger (o plugin mantém um rAF próprio) — o progresso é lido no ticker: documento em /, /about, /resume; wrapper interno no painel do Works.
// Nunca no canvas do Featured/Full. Reduced-motion = scroll nativo. Um registro global permite ao QA contar instâncias.
import { type RefObject, useEffect } from "react";
import Lenis from "lenis";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";
import { ui } from "@/lib/store";

type Reg = { lenis: Lenis; key: string }[];
declare global {
  interface Window {
    __lenis?: Reg;
  }
}

export function useLenis(wrapper?: RefObject<HTMLElement | null>, content?: RefObject<HTMLElement | null>, key = "document") {
  useEffect(() => {
    if (reducedMotion()) return;
    const w = wrapper?.current ?? undefined;
    const c = content?.current ?? undefined;
    if (wrapper && !w) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1, wrapper: w ?? window, content: c ?? document.documentElement, anchors: false }); // âncoras tratadas pelo índice (SectionIndex)
    const reg = (window.__lenis ??= []);
    const entry = { lenis, key };
    reg.push(entry);
    const untick = addTick((t) => lenis.raf(t * 1000));
    // documento: parado durante intro/overlays (overlays rolam nativo com data-lenis-prevent)
    const sync = () => {
      if (w) return;
      const s = ui.get();
      if (s.intro || s.menu || s.reel || s.profile) lenis.stop();
      else lenis.start();
    };
    sync();
    const unsub = ui.subscribe(sync);
    return () => {
      unsub();
      untick();
      lenis.destroy();
      const i = reg.indexOf(entry);
      if (i >= 0) reg.splice(i, 1);
    };
  }, [wrapper, content, key]);
}

export function SmoothScroll() {
  useLenis();
  return null;
}
