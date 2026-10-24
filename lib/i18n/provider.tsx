"use client";
// Idioma (v5, 24/10/2026): o site inteiro é EN (t sempre = EN). A preferência EN/PT-BR vale só para o currículo:
// "lang" exposto é a preferência em /curriculo e "en" em qualquer outra rota. O head script aplica PT antes da
// 1ª pintura apenas em /curriculo. Hidratação em "en" (sem mismatch), html[lang] e document.title por rota.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { EN, HTML_LANG, routeKey, type Dict, type Lang } from "./dict";
import { ScrollTrigger, useIsoLayoutEffect } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis-store";

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: Dict };
const LangCtx = createContext<Ctx>({ lang: "en", setLang: () => {}, t: EN });

export const useLang = () => useContext(LangCtx);
export const useT = () => useContext(LangCtx).t;

const STORE = "lm-lang";

export function readPreferredLang(): Lang {
  try {
    const q = new URLSearchParams(location.search).get("lang");
    if (q === "pt" || q === "en") return q;
    const s = localStorage.getItem(STORE) ?? localStorage.getItem("cv-lang");
    if (s === "pt" || s === "en") return s;
  } catch {}
  return "en";
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function LangProvider({ children }: { children: ReactNode }) {
  const [pref, setLangState] = useState<Lang>("en");
  const pathname = usePathname();
  const lang: Lang = routeKey(pathname) === "cv" ? pref : "en";
  const busy = useRef(false);
  const refreshT = useRef<number | undefined>(undefined);
  const target = useRef<Lang | null>(null);

  // preferência inicial (o head script já gravou html.dataset.lang quando é PT)
  useIsoLayoutEffect(() => {
    const d = document.documentElement;
    const pref = (d.dataset.lang as Lang | undefined) ?? readPreferredLang();
    // só o currículo espera a preferência antes de liberar o bloqueio anti-flash
    target.current = routeKey(location.pathname) === "cv" ? pref : null;
    if (pref === "pt") setLangState("pt");
    // migração única do idioma antigo do CV
    try {
      const old = localStorage.getItem("cv-lang");
      if (old && !localStorage.getItem(STORE)) localStorage.setItem(STORE, old);
    } catch {}
  }, []);

  // html[lang], data-lang, título — e só então remove o bloqueio anti-flash
  useIsoLayoutEffect(() => {
    if (target.current && target.current !== lang) return; // ainda aplicando a preferência
    target.current = null;
    const d = document.documentElement;
    d.lang = HTML_LANG[lang];
    d.dataset.lang = lang;
    delete d.dataset.langPending;
  }, [lang]);

  useEffect(() => {
    document.title = lang === "pt" ? "Currículo — Lucas Melo" : EN.meta[routeKey(pathname)].title;
  }, [lang, pathname]);

  useEffect(() => () => window.clearTimeout(refreshT.current), []);

  const setLang = useCallback(
    (next: Lang) => {
      if (busy.current || next === lang) return;
      const persist = () => {
        try {
          localStorage.setItem(STORE, next);
        } catch {}
        const u = new URL(location.href);
        if (u.searchParams.has("lang")) {
          u.searchParams.delete("lang");
          history.replaceState(history.state, "", u);
        }
      };
      const refresh = (anchor: { el: Element; top: number } | null) => {
        window.clearTimeout(refreshT.current);
        refreshT.current = window.setTimeout(() => {
          ScrollTrigger.refresh();
          if (!anchor || !anchor.el.isConnected) return;
          const delta = anchor.el.getBoundingClientRect().top - anchor.top;
          if (Math.abs(delta) < 1) return;
          const lenis = getLenis();
          const y = window.scrollY + delta;
          if (lenis) lenis.scrollTo(y, { immediate: true, force: true });
          else window.scrollTo(0, y);
        }, 100);
      };
      // âncora: o bloco de texto mais perto do centro da viewport
      const anchorOf = () => {
        const cy = window.innerHeight / 2;
        let best: Element | null = null;
        let bd = Infinity;
        document.querySelectorAll("main h1, main h2, main h3, main p, main li, main tr").forEach((el) => {
          const r = el.getBoundingClientRect();
          if (r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) return;
          const d = Math.abs(r.top + r.height / 2 - cy);
          if (d < bd) {
            bd = d;
            best = el;
          }
        });
        const el = best as Element | null;
        return el ? { el, top: el.getBoundingClientRect().top } : null;
      };
      const html = document.documentElement;
      if (reducedMotion()) {
        const a = anchorOf();
        setLangState(next);
        persist();
        refresh(a);
        return;
      }
      busy.current = true;
      const a = anchorOf();
      html.classList.add("lang-out");
      window.setTimeout(() => {
        setLangState(next);
        persist();
        requestAnimationFrame(() => {
          html.classList.remove("lang-out");
          busy.current = false;
          refresh(a);
        });
      }, 120);
    },
    [lang],
  );

  const value = useMemo<Ctx>(() => ({ lang, setLang, t: EN }), [lang, setLang]);
  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}
