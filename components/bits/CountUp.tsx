"use client";
// Adaptado de React Bits · CountUp (TS-CSS, MIT + Commons Clause, https://reactbits.dev).
// Mudanças: sem `motion`; o valor segue um progresso 0..1 externo (scrub reversível no ticker). Leitor de tela lê o final.
import { useEffect, useRef } from "react";

export function CountUp({ to, progress, pad = 2, className = "" }: { to: number; progress: number; pad?: number; className?: string }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (el.current) el.current.textContent = String(Math.round(to * Math.min(1, Math.max(0, progress)))).padStart(pad, "0");
  }, [to, progress, pad]);
  return (
    <span className={`count-up ${className}`}>
      <span className="sr-only">{String(to).padStart(pad, "0")}</span>
      <span ref={el} aria-hidden="true">
        {String(to).padStart(pad, "0")}
      </span>
    </span>
  );
}
