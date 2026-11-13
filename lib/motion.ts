"use client";
export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const isNarrow = () => typeof window !== "undefined" && window.innerWidth < 768;

/** Tier (§9): T0 sem WebGL2 / ?webgl=0; T1 celular ou máquina modesta; T2 resto. */
export function tier(): 0 | 1 | 2 {
  if (typeof document === "undefined") return 0;
  if (!document.documentElement.classList.contains("gl")) return 0;
  if (document.documentElement.classList.contains("lite")) return 1; // etapa 6: sem GPU / máquina lenta
  const nav = navigator as Navigator & { deviceMemory?: number };
  const low = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
  if (low || matchMedia("(pointer: coarse)").matches) return 1;
  return 2;
}

/**
 * Paralaxe por profundidade (§5.2): fator aparente de um plano em relação ao plano focal (1,00).
 * Único lugar onde fatores viram deslocamento; 390 = metade; reduced-motion = 0.
 * Retorna o deslocamento extra (em px) para um elemento cujo centro está a `offset` px do centro da viewport.
 */
export function parallaxShift(factor: number, offset: number) {
  if (reducedMotion()) return 0;
  const k = isNarrow() ? 0.5 : 1;
  return (factor - 1) * k * offset;
}

export function copyText(text: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const ta = document.createElement("textarea");
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
  return Promise.resolve();
}
