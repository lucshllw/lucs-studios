"use client";
// Controles do header compartilhados com a barra do menu overlay: toggle EN/PT magnético e botão MENU/CLOSE.
import { useRef } from "react";
import { useLang, useT } from "@/lib/i18n/provider";
import { useMagnetic } from "@/lib/magnetic";
import { useSlideBar } from "@/lib/slidebar";
import Scramble from "./Scramble";

export function LangToggle({ id }: { id?: string }) {
  const { lang, setLang, t } = useLang();
  const ref = useRef<HTMLDivElement>(null);
  useMagnetic(ref, { radius: 80, max: 6, strength: 0.4 });
  useSlideBar(ref, lang);
  return (
    <div className="lt" role="group" aria-label={t.header.langGroup} ref={ref} data-lang={lang} id={id}>
      <span aria-hidden="true">[</span>
      <button type="button" className="lt__btn" aria-pressed={lang === "en"} lang="en" aria-label={t.header.langEn} onClick={() => setLang("en")}>
        EN
      </button>
      <span aria-hidden="true">/</span>
      <button type="button" className="lt__btn" aria-pressed={lang === "pt"} lang="pt-BR" aria-label={t.header.langPt} onClick={() => setLang("pt")}>
        PT
      </button>
      <span aria-hidden="true">]</span>
      <span className="lt__bar" aria-hidden="true" />
    </div>
  );
}

export function MenuButton({ open, onClick, btnRef, controls }: { open: boolean; onClick: () => void; btnRef?: React.Ref<HTMLButtonElement>; controls: string }) {
  const t = useT();
  const wrap = useRef<HTMLSpanElement>(null);
  useMagnetic(wrap, { radius: 80, max: 6, strength: 0.4 });
  return (
    <span className="sh__menuwrap" ref={wrap}>
      <button
        ref={btnRef}
        type="button"
        className="sh__menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onClick}
      >
        <span aria-hidden="true">[ </span>
        <Scramble text={open ? t.header.close : t.header.menu} />
        <span aria-hidden="true"> ]</span>
      </button>
    </span>
  );
}

