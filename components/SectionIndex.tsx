"use client";
// Índice de seções (pedido de Lucas 12/11): substitui a barra de rolagem nativa. Números + nome curto em Martian Mono,
// item ativo em branco com traço brasa do progresso da seção; clique rola (Lenis quando existir). Leitura no ticker
// único — sem rAF próprio. `scroller` = painel do Works; sem ele, o documento.
import { type RefObject, useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";

export type IndexItem = {
  id: string;
  label: string;
  /** fração da rolagem interna da seção (seções pinadas) onde o item passa a ser ativo */
  at?: number;
  /** fração para onde o clique rola (ex.: footer Fusion já com o cartão visível) */
  goAt?: number;
};

export function SectionIndex({ items, scroller, lenisKey = "document", className = "" }: { items: IndexItem[]; scroller?: RefObject<HTMLElement | null>; lenisKey?: string; className?: string }) {
  const nav = useRef<HTMLElement>(null);
  const bars = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  // posição de rolagem (px) em que cada item começa
  const targets = (forGo = false) => {
    const sc = scroller?.current ?? null;
    const vh = sc ? sc.clientHeight : innerHeight;
    const top0 = sc ? sc.getBoundingClientRect().top - sc.scrollTop : -window.scrollY;
    return items.map((it) => {
      const el = document.getElementById(it.id);
      if (!el) return Infinity;
      const r = el.getBoundingClientRect();
      const y = r.top - top0;
      return y + Math.max(0, r.height - vh) * ((forGo ? it.goAt : undefined) ?? it.at ?? 0);
    });
  };

  useEffect(() => {
    let last = -1;
    const untick = addTick(() => {
      const sc = scroller?.current ?? null;
      if (scroller && !sc) return;
      const y = (sc ? sc.scrollTop : window.scrollY) + (sc ? sc.clientHeight : innerHeight) * 0.35;
      const ts = targets();
      let a = 0;
      ts.forEach((t, i) => {
        if (y >= t) a = i;
      });
      // no fim da rolagem, a última seção alcançável vira ativa (seções curtas no fim da página)
      const st = sc ? sc.scrollTop : window.scrollY;
      const max = (sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - innerHeight) - 2;
      if (st >= max) a = ts.reduce((k, t, i) => (Number.isFinite(t) ? i : k), a);
      const end = ts[a + 1] ?? (sc ? sc.scrollHeight : document.documentElement.scrollHeight);
      const prog = Math.min(1, Math.max(0, (y - ts[a]) / Math.max(1, end - ts[a])));
      bars.current.forEach((b, i) => {
        if (b) b.style.transform = `scaleX(${i === a ? prog.toFixed(3) : i < a ? 1 : 0})`;
      });
      if (a !== last) {
        last = a;
        setActive(a);
      }
    });
    return untick;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, scroller]);

  const go = (i: number) => {
    const t = targets(true)[i];
    if (!Number.isFinite(t)) return;
    const sc = scroller?.current ?? null;
    const lenis = window.__lenis?.find((x) => x.key === lenisKey)?.lenis;
    const reduced = reducedMotion();
    if (lenis) lenis.scrollTo(t, { duration: reduced ? 0 : 1.1, immediate: reduced });
    else if (sc) sc.scrollTo({ top: t, behavior: reduced ? "auto" : "smooth" });
    else window.scrollTo({ top: t, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <nav ref={nav} className={`sidx ${className}`} aria-label="Sections">
      <ol>
        {items.map((it, i) => (
          <li key={it.id + i}>
            <a
              href={`#${it.id}`}
              aria-current={i === active ? "location" : undefined}
              className={i === active ? "on" : ""}
              onClick={(e) => {
                e.preventDefault();
                go(i);
              }}
            >
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <span className="l">{it.label}</span>
              <i className="b" aria-hidden="true">
                <i ref={(el) => void (bars.current[i] = el)} />
              </i>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
