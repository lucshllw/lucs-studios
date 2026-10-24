"use client";
// Moldura HUD / viewfinder compartilhada (v5, item 14; mesma linguagem da "ilha de edição" do parecer v3-reel §4):
// marcas de corte em L nos cantos, grade fina, régua lateral com ticks, rótulos mono e "● REC" com timecode.
// Puramente decorativa (aria-hidden). Animação mínima: timecode (hh:mm:ss:ff a 24 fps) e ponto REC piscando,
// só em vista e com a aba visível; reduced-motion e tier low/reduced = estático. Atualiza o texto direto no DOM
// (sem re-render React) a ~12 Hz.
import { useEffect, useRef } from "react";

const tc = (s: number) => {
  const f = Math.floor((s % 1) * 24);
  const t = Math.floor(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}:${p(f)}`;
};

type Props = {
  className?: string;
  topLeft: string;
  bottomLeft?: string;
  bottomRight?: string;
  /** segundos iniciais do timecode */
  start?: number;
  /** "corners" (padrão): rótulos nos 4 cantos; "sides": rótulo e REC em vertical nas laterais (livra o topo/base,
   *  ex. o retrato do /about, onde "Lucas"/"Melo" cobrem os cantos) */
  layout?: "corners" | "sides";
};

export default function HudFrame({ className = "", topLeft, bottomLeft, bottomRight, start = 0, layout = "corners" }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const tcRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = root.current;
    const out = tcRef.current;
    if (!el || !out) return;
    const t = document.documentElement.dataset.tier;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches || t === "low" || t === "reduced";
    if (still) {
      el.dataset.live = "false";
      return;
    }
    let raf = 0;
    let last = 0;
    let inView = false;
    const t0 = performance.now() - start * 1000;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 83) return;
      last = now;
      out.textContent = tc((now - t0) / 1000);
    };
    const sync = () => {
      const run = inView && document.visibilityState === "visible";
      el.dataset.live = String(run);
      if (run && !raf) raf = requestAnimationFrame(loop);
      if (!run && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      sync();
    });
    io.observe(el);
    document.addEventListener("visibilitychange", sync);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [start]);

  return (
    <div className={`vf ${className}`} ref={root} aria-hidden="true" data-live="false" data-layout={layout}>
      <span className="vf__grid" />
      <span className="vf__ruler" />
      <span className="vf__c vf__c--tl" />
      <span className="vf__c vf__c--tr" />
      <span className="vf__c vf__c--bl" />
      <span className="vf__c vf__c--br" />
      <span className="vf__t vf__t--tl mono">{topLeft}</span>
      <span className="vf__t vf__t--tr mono">
        <span className="vf__rec">● REC</span> <span ref={tcRef}>{tc(start)}</span>
      </span>
      {bottomLeft && <span className="vf__t vf__t--bl mono">{bottomLeft}</span>}
      {bottomRight && <span className="vf__t vf__t--br mono">{bottomRight}</span>}
    </div>
  );
}
