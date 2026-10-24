"use client";
import { useEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";

const SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/—";

/**
 * Scramble de rótulos curtos em mono (parecer v4 §8.1): 450 ms; o caractere i resolve em t = i/len · 0,7 e os
 * sorteados trocam a cada 30 ms no ticker do GSAP. Texto final em sr-only, camada animada aria-hidden.
 * Reduced-motion ou > 40 caracteres: troca direta. Sem JS: o texto do SSR.
 */
export default function Scramble({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState(text);
  const prev = useRef(text);

  useEffect(() => {
    if (prev.current === text) return;
    prev.current = text;
    if (text.length > 40 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(text);
      return;
    }
    const dur = 450;
    const t0 = performance.now();
    let lastSwap = 0;
    const len = Math.max(1, text.length);
    const tick = () => {
      const now = performance.now();
      const p = (now - t0) / dur;
      if (p >= 1) {
        setShown(text);
        gsap.ticker.remove(tick);
        return;
      }
      if (now - lastSwap < 30) return;
      lastSwap = now;
      let s = "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === " " || p >= (i / len) * 0.7) s += ch;
        else s += SET[(Math.random() * SET.length) | 0];
      }
      setShown(s);
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, [text]);

  return (
    <span className={`scr ${className ?? ""}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">{shown}</span>
    </span>
  );
}
