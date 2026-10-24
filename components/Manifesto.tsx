"use client";
import { useLang } from "@/lib/i18n/provider";
import WordScrub from "./WordScrub";

/** Manifesto (6 linhas aprovadas: gótica na 2ª, brasa na última), agora com scrub por palavra (v4 §5.4). */
export default function Manifesto() {
  const { t, lang } = useLang();
  const m = t.home.manifesto;
  return (
    <article className="manifesto layer" aria-labelledby="manifesto-title">
      <span className="manifesto__label mono label">{m.label}</span>
      <WordScrub key={lang} id="manifesto-title" className="manifesto__title ws" lines={m.lines.map((l) => ({ ...l }))} />
    </article>
  );
}
