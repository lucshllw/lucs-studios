"use client";
// GSAP 3.15: ScrollTrigger (no relógio do Lenis), SplitText e ScrambleText (v5: entrada do rodapé, parecer v3.1) e Flip (gratuito desde a 3.13; troca GRID/LIST e filtros da lista,
// parecer v4 §6.5). As animações aprovadas em motion 14 continuam em motion.
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { SplitText } from "gsap/SplitText";
import { ScrambleTextPlugin } from "gsap/ScrambleTextPlugin";
import { useEffect, useLayoutEffect } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, Flip, SplitText, ScrambleTextPlugin);
  ScrollTrigger.config({ ignoreMobileResize: true });
  // inspeção de QA (scripts/qa-v4.mjs): contagem de ScrollTriggers por rota
  (window as unknown as { __ST?: typeof ScrollTrigger }).__ST = ScrollTrigger;
}

export const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
/** media query padrão dos efeitos: nada é criado em reduced-motion */
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const isReduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export { gsap, ScrollTrigger, Flip, SplitText };
