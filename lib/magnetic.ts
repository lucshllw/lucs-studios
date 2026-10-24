"use client";
import { useEffect, type RefObject } from "react";
import { gsap } from "./gsap";

/**
 * Magnético (parecer v3 §1): dentro de `radius` px do centro, o elemento segue o ponteiro até `max` px
 * (quickTo .4 s power3.out) e volta a 0 em .6 s ao sair. Só em hover+pointer fine e sem reduced-motion.
 */
export function useMagnetic<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { radius = 120, max = 14, strength = 0.4 }: { radius?: number; max?: number; strength?: number } = {},
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;
    const xTo = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
    let inside = false;
    let raf = 0;
    let last: PointerEvent | null = null;
    const apply = () => {
      raf = 0;
      if (!last) return;
      const r = el.getBoundingClientRect();
      // posição sem o deslocamento atual (evita realimentação)
      const cx = r.left + r.width / 2 - (Number(gsap.getProperty(el, "x")) || 0);
      const cy = r.top + r.height / 2 - (Number(gsap.getProperty(el, "y")) || 0);
      const dx = last.clientX - cx;
      const dy = last.clientY - cy;
      const reach = radius + Math.max(r.width, r.height) / 2;
      if (Math.hypot(dx, dy) < reach) {
        inside = true;
        const k = strength;
        xTo(gsap.utils.clamp(-max, max, dx * k));
        yTo(gsap.utils.clamp(-max, max, dy * k));
      } else if (inside) {
        inside = false;
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "power3.out", overwrite: true });
      }
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
      gsap.killTweensOf(el);
      gsap.set(el, { clearProps: "transform" });
    };
  }, [ref, radius, max, strength]);
}
