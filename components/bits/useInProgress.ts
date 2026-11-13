"use client";
// Progresso de entrada de uma seção (0 quando o topo encosta na base da viewport → 1 quando chega a `end` da altura).
// Scrub reversível no ticker único (sem ScrollTrigger); escreve --in na seção e chama onProgress.
import { type RefObject, useEffect } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";

export function useInProgress(ref: RefObject<HTMLElement | null>, onProgress?: (p: number) => void, end = 0.55) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = reducedMotion();
    let visible = false;
    let last = -1;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { rootMargin: "10% 0px" });
    io.observe(el);
    const set = (p: number) => {
      if (Math.abs(p - last) < 0.001) return;
      last = p;
      el.style.setProperty("--in", p.toFixed(3));
      onProgress?.(p);
    };
    if (reduced) set(1);
    const untick = addTick(() => {
      if (!visible || reduced) return;
      const r = el.getBoundingClientRect();
      const vh = innerHeight;
      set(Math.min(1, Math.max(0, (vh - r.top) / (vh * end))));
    });
    return () => {
      untick();
      io.disconnect();
    };
  }, [ref, onProgress, end]);
}
