"use client";
import { useRef } from "react";
import { useActive, usePrefersReducedMotion } from "@/lib/hooks";
import { useT } from "@/lib/i18n/provider";
import RotatingStack from "./RotatingStack";

/** Pré-footer aprovado (LUCAS / verbo / MELO); o loop só roda em vista e sem reduced-motion. */
export default function PreFooter() {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const reduced = usePrefersReducedMotion();
  const t = useT();
  return (
    <article className="prefooter layer" ref={ref} aria-label={t.home.prefooter}>
      <RotatingStack active={active && !reduced} srText={t.home.prefooter} />
    </article>
  );
}
