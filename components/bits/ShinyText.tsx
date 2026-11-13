"use client";
// Adaptado de React Bits · ShinyText (MIT + Commons Clause). Versão só CSS (sem rAF): faixa de brilho que passa em
// loop lento; pausa em reduced-motion. Texto real (sem divisão).
import type { ReactNode } from "react";
export function ShinyText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`shiny-text ${className}`}>{children}</span>;
}
