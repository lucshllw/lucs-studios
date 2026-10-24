"use client";
import { useEffect, useRef, useState } from "react";
import { ROTATING_WORDS, STACK } from "@/lib/content";

type Props = {
  /** loop ativo (visível e sem reduced-motion) */
  active: boolean;
  /** encerra o loop após N ms (preloader) */
  stopAfter?: number;
  intervalMs?: number;
  className?: string;
  as?: "div" | "p";
  /** texto para leitor de tela (v4: vem do dicionário) */
  srText?: string;
};

/** Bloco de 3 linhas: LUCAS (serif condensada) / verbo rotativo / MELO. Troca seca a cada 120ms. */
export default function RotatingStack({ active, stopAfter, intervalMs = 120, className = "", srText }: Props) {
  const [i, setI] = useState(0);
  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let n = 0;
    const start = last;
    const tick = (now: number) => {
      if (stopAfter && now - start > stopAfter) return;
      if (now - last >= intervalMs) {
        last = now - ((now - last) % intervalMs);
        n += 1;
        setI(n);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, stopAfter, intervalMs]);

  const word = ROTATING_WORDS[i % ROTATING_WORDS.length];
  const style = i % 3;

  return (
    <div ref={elRef} className={`stack ${className}`}>
      <span className="stack__l1">{STACK.l1}</span>
      <span className="stack__l2" data-style={style} aria-hidden="true">
        {word}
      </span>
      <span className="stack__l3">{STACK.l3}</span>
      <span className="sr-only">{srText ?? `Lucas Melo ${ROTATING_WORDS.join(", ").toLowerCase()}`}</span>
    </div>
  );
}
