"use client";
// Header fixo de extremidades (parecer v4 §3; v5): marca à esquerda, status no centro (D), MENU à direita.
// v5: site só em inglês — sem seletor EN/PT aqui (a alternância existe só em /curriculo); sem localização.
// Sem botão central sobreposto. Sobre seções data-theme="light" (footer branco) inverte para preto sobre branco.
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { TransitionLink } from "./PageTransition";
import MenuOverlay from "./MenuOverlay";
import { MenuButton } from "./HeaderControls";

export default function SiteHeader() {
  const t = useT();
  const pathname = usePathname();
  const header = useRef<HTMLElement>(null);
  const menuBtn = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);

  // tema claro: o footer branco é sticky (bottom: 0) e fica atrás do <main>; o header inverte quando a base
  // do <main> sobe acima da linha y = 28 px, ou seja, quando o footer está sob o header. Um rect por quadro de scroll.
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const main = document.querySelector("main");
      const footer = document.querySelector('[data-theme="light"]');
      setLight(!!main && !!footer && main.getBoundingClientRect().bottom < 28);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const t0 = window.setTimeout(check, 60);
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => {
      window.clearTimeout(t0);
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
    };
  }, [pathname]);

  return (
    <>
      <header className="site-header" ref={header} data-light={light}>
        <div className="sh__l">
          <TransitionLink href="/" className="sh__brand mono">
            <span aria-hidden="true">[ </span>
            <span className="sh__brand-long">{t.header.brand}</span>
            <span className="sh__brand-short">{t.header.brandShort}</span>
            <span aria-hidden="true"> ]</span>
          </TransitionLink>
        </div>
        <p className="sh__c mono">
          <span aria-hidden="true">[ </span>
          <span className="sh__dot" aria-hidden="true" />
          {t.header.status}
          <span aria-hidden="true"> ]</span>
        </p>
        <div className="sh__r">
          <nav className="sh__nojs mono" aria-label="Site">
            <a href="/works">{t.header.noJsWorks}</a>
            <span aria-hidden="true">·</span>
            <a href="/about">{t.header.noJsAbout}</a>
          </nav>
          <MenuButton open={open} onClick={() => setOpen(true)} btnRef={menuBtn} controls="site-menu" />
        </div>
      </header>
      <MenuOverlay open={open} onClose={() => setOpen(false)} returnFocus={menuBtn} />
    </>
  );
}
