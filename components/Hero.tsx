"use client";
// Hero v4 (parecer §5.1): emblema centrado, "CREATIVE" (grotesca) e "Developer" (gótica) orbitando o selo,
// rótulo no topo esquerdo (v5.1: palavras em loop CSS + efeito de hover do emblema, components/HeroWord.tsx), intro na base esquerda e SCROLL na base direita. Palavras visuais aria-hidden; h1 sr-only.
import { useLang } from "@/lib/i18n/provider";
import { fmt } from "@/lib/i18n/dict";
import { countWord } from "@/lib/projects";
import { useTier } from "@/lib/tier";
import { useMounted } from "@/lib/hooks";
import { useEffect, useRef } from "react";
import Emblem from "./Emblem";
import HeroWord from "./HeroWord";

export default function Hero() {
  const { t: all, lang } = useLang();
  const t = all.home.hero;
  const tier = useTier();
  const mounted = useMounted();
  const gl = mounted && (tier === "mid" || tier === "high");
  // v5.1: o loop CSS das palavras pausa só com a hero inteira fora de vista
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (el.dataset.off = e.isIntersecting ? "false" : "true"));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section className="hero4" ref={root} aria-labelledby="hero-title">
      <h1 id="hero-title" className="sr-only" tabIndex={-1}>
        {t.h1}
      </h1>
      <Emblem gl={gl} alt={t.emblemAlt} />
      <p className="hero4__words" aria-hidden="true">
        <HeroWord text={t.wordGrot} variant="grot" fx={gl} />
        <HeroWord text={t.wordBlack} variant="black" fx={gl} />
      </p>
      <p className="hero4__eyebrow mono">{t.eyebrow}</p>
      <p className="hero4__intro i18n-fade">{fmt(t.intro, { count: countWord(lang) })}</p>
      <p className="hero4__scroll mono" aria-hidden="true">
        {t.scroll}
      </p>
    </section>
  );
}
