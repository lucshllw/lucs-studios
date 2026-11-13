"use client";
// Entrada de seção pelo scroll (etapa 4): cantos de HUD que se desenham, linha que se traça, título que decodifica
// letra a letra (SplitText adaptado) e número que conta (CountUp adaptado) — tudo função de --in (scrub reversível
// no ticker único). Sem JS: --in ausente → estado final.
import { type ReactNode, useCallback, useRef, useState } from "react";
import { useInProgress } from "./useInProgress";
import { SplitText } from "./SplitText";
import { CountUp } from "./CountUp";

export function SectionIntro({
  n,
  title,
  children,
  className = "",
  id,
  as = "section",
}: {
  n?: number;
  title: string;
  children?: ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div";
}) {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(1);
  const last = useRef(-1);
  const onP = useCallback((v: number) => {
    const s = Math.round(v * 20) / 20;
    if (s !== last.current) {
      last.current = s;
      setP(s);
    }
  }, []);
  useInProgress(ref, onP, 0.5);
  const Tag = as;
  return (
    <Tag ref={ref as never} className={`sx ${className}`} id={id}>
      <span className="sx-c tl" aria-hidden="true" />
      <span className="sx-c br" aria-hidden="true" />
      <span className="sx-line" aria-hidden="true" />
      <header className="sx-head">
        {n !== undefined && <CountUp to={n} progress={p} className="sx-n" />}
        <SplitText tag="h2" text={title} className="sx-title" />
      </header>
      {children}
    </Tag>
  );
}
