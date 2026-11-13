"use client";
// Adaptado de React Bits · VariableProximity (TS-CSS, MIT + Commons Clause, https://reactbits.dev).
// Mudanças: usa a Inter Tight variável já instalada (eixo wght 100–900) em vez de Roboto Flex; um único loop
// (gsap.ticker) e ponteiro global; `focused` (foco por teclado/seleção) leva todas as letras ao peso máximo.
// As letras são aria-hidden: o texto real fica no rótulo do elemento interativo que envolve. Reduced-motion = peso fixo.
import { useEffect, useRef } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";
import { bindPointer, pointer } from "./pointer";

export function VariableProximity({
  label,
  radius = 120,
  from = 300,
  to = 900,
  smoothing = 0.2,
  className = "",
  focused = false,
}: {
  label: string;
  radius?: number;
  from?: number;
  to?: number;
  smoothing?: number;
  className?: string;
  focused?: boolean;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const foc = useRef(focused);
  foc.current = focused;
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    bindPointer();
    const letters = Array.from(el.querySelectorAll<HTMLSpanElement>(".vp-l"));
    const lv = letters.map(() => -1);
    const reduced = reducedMotion();
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(el);
    const untick = addTick(() => {
      if (!visible) return;
      const f = foc.current;
      letters.forEach((l, i) => {
        let t = f ? 1 : 0;
        if (!f && !reduced && pointer.active) {
          const r = l.getBoundingClientRect();
          const d = Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2));
          t = d >= radius ? 0 : 1 - d / radius;
        }
        const cur = lv[i] < 0 ? t : lv[i];
        const nv = reduced ? t : cur + (t - cur) * smoothing;
        if (Math.abs(nv - lv[i]) < 0.002) return;
        lv[i] = nv;
        l.style.fontVariationSettings = `"wght" ${Math.round(from + (to - from) * nv)}`;
      });
    });
    return () => {
      untick();
      io.disconnect();
    };
  }, [radius, from, to, smoothing]);
  return (
    <span ref={root} className={`variable-proximity ${className}`} aria-hidden="true">
      {[...label].map((c, i) => (
        <span key={i} className="vp-l">
          {c}
        </span>
      ))}
    </span>
  );
}
