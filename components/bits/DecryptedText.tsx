"use client";
// Adaptado de React Bits · DecryptedText (TS-CSS, MIT + Commons Clause, https://reactbits.dev).
// Mudanças: sem `motion`; animação no gsap.ticker (lib/loop); revelação sequencial a partir de glifos ASCII.
// Gatilhos: "view" (ao entrar em vista), "hover" (hover/foco re-embaralha) ou `progress` externo (scrub reversível).
// Texto real em .sr-only; glifos aria-hidden. Reduced-motion = texto final.
import { useEffect, useRef } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";

const ASCII = " .:-=+*#%@/\\|<>[]{}";

export function DecryptedText({
  text,
  className = "",
  animateOn = "view",
  progress,
  speed = 28,
}: {
  text: string;
  className?: string;
  animateOn?: "view" | "hover" | "progress";
  /** 0..1 quando animateOn = "progress" */
  progress?: number;
  speed?: number;
}) {
  const vis = useRef<HTMLSpanElement>(null);
  const run = useRef({ t: 1e9, on: false });
  const prog = useRef(progress ?? 0);
  prog.current = progress ?? 0;

  useEffect(() => {
    const el = vis.current;
    if (!el) return;
    if (reducedMotion()) {
      el.textContent = text;
      return;
    }
    const chars = [...text];
    const paint = (revealed: number) => {
      let s = "";
      for (let i = 0; i < chars.length; i++) {
        const c = chars[i];
        s += c === " " || i < revealed ? c : ASCII[1 + Math.floor(Math.random() * (ASCII.length - 1))];
      }
      el.textContent = s;
    };
    const start = () => {
      run.current = { t: 0, on: true };
    };
    let io: IntersectionObserver | null = null;
    if (animateOn === "view") {
      paint(0);
      io = new IntersectionObserver(([e]) => {
        if (e.isIntersecting) {
          start();
          io?.disconnect();
        }
      });
      io.observe(el);
    }
    const host = el.parentElement?.parentElement ?? el;
    const hov = () => start();
    if (animateOn !== "progress") {
      host.addEventListener("pointerenter", hov);
      host.addEventListener("focusin", hov);
    }
    let lastP = -1;
    const untick = addTick((_t, dt) => {
      if (animateOn === "progress") {
        const p = prog.current;
        if (Math.abs(p - lastP) < 0.002) return;
        lastP = p;
        if (p >= 1) el.textContent = text;
        else paint(Math.round(p * chars.length));
        return;
      }
      const r = run.current;
      if (!r.on) return;
      r.t += dt;
      const revealed = Math.floor(r.t * speed);
      paint(revealed);
      if (revealed >= chars.length) {
        r.on = false;
        el.textContent = text;
      }
    });
    return () => {
      untick();
      io?.disconnect();
      host.removeEventListener("pointerenter", hov);
      host.removeEventListener("focusin", hov);
    };
  }, [text, animateOn, speed]);

  return (
    <span className={`decrypted ${className}`}>
      <span className="sr-only">{text}</span>
      <span ref={vis} aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
