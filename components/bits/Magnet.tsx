"use client";
// Adaptado de React Bits · Magnet (TS-CSS, MIT + Commons Clause, https://reactbits.dev).
// Mudanças: mola integrada no gsap.ticker (sem rAF próprio) e ponteiro global; reduced-motion desliga.
import { type HTMLAttributes, type ReactNode, useEffect, useRef } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";
import { bindPointer, pointer } from "./pointer";

export function Magnet({
  children,
  padding = 60,
  strength = 3,
  className = "",
  ...rest
}: { children: ReactNode; padding?: number; strength?: number; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  const wrap = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reducedMotion()) return;
    bindPointer();
    const w = wrap.current!;
    const el = inner.current!;
    const m = { x: 0, y: 0, vx: 0, vy: 0 };
    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(w);
    const untick = addTick((_t, dt) => {
      if (!visible) return;
      let tx = 0;
      let ty = 0;
      if (pointer.active && pointer.fine) {
        const r = w.getBoundingClientRect();
        const dx = pointer.x - (r.left + r.width / 2);
        const dy = pointer.y - (r.top + r.height / 2);
        if (Math.abs(dx) < r.width / 2 + padding && Math.abs(dy) < r.height / 2 + padding) {
          tx = dx / strength;
          ty = dy / strength;
        }
      }
      // mola (rigidez 170, amortecimento 16 — padrão do original)
      const h = Math.min(dt, 1 / 30);
      m.vx += (170 * (tx - m.x) - 16 * m.vx) * h;
      m.vy += (170 * (ty - m.y) - 16 * m.vy) * h;
      m.x += m.vx * h;
      m.y += m.vy * h;
      if (Math.abs(m.x) + Math.abs(m.y) + Math.abs(m.vx) + Math.abs(m.vy) < 0.01) {
        if (el.style.transform) el.style.transform = "";
        return;
      }
      el.style.transform = `translate3d(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px, 0)`;
    });
    return () => {
      untick();
      io.disconnect();
    };
  }, [padding, strength]);
  return (
    <span ref={wrap} className={`magnet ${className}`} {...rest}>
      <span ref={inner} className="magnet-in">
        {children}
      </span>
    </span>
  );
}
