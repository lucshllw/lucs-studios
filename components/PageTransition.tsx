"use client";
// Transições de página (parecer v4 §8): overlay persistente + TransitionLink + router.push. Cobre (550 ms), troca
// a rota, espera 2×rAF + fontes (≤300 ms), zera/restaura o scroll, refresh do ScrollTrigger e revela (600 ms).
// Back/forward: sem cover, só fade de 200 ms do main novo e o scroll salvo por rota. Foco no h1 + aria-live.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import { gsap, ScrollTrigger, isReduced } from "@/lib/gsap";
import { getLenis, holdScroll, releaseScroll } from "@/lib/lenis-store";
import { useT } from "@/lib/i18n/provider";
import { fmt, routeKey, type RouteKey } from "@/lib/i18n/dict";
import Scramble from "./Scramble";
import { EMBLEM_SRC } from "@/lib/media";

type Ctx = { go: (href: string) => void };
const TCtx = createContext<Ctx>({ go: () => {} });
export const usePageTransition = () => useContext(TCtx);

const keyOf = () => "lm-scroll:" + location.pathname + location.search;
const norm = (p: string) => p.replace(/\/$/, "") || "/";

export function TransitionLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const { go } = usePageTransition();
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (rest.target && rest.target !== "_self") return;
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return;
    e.preventDefault();
    go(u.pathname + u.search + u.hash);
  };
  return <Link href={href} onClick={handle} {...rest} />;
}

export default function PageTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();
  const overlay = useRef<HTMLDivElement>(null);
  const pending = useRef<{ kind: "push" | "pop"; restoreY: number | null; started: number } | null>(null);
  const saving = useRef(true);
  const first = useRef(true);
  const [dest, setDest] = useState<RouteKey>("home");
  const [announce, setAnnounce] = useState("");

  // salva o scroll por rota (throttle) e em pagehide
  useEffect(() => {
    let raf = 0;
    const save = () => {
      raf = 0;
      if (!saving.current) return;
      try {
        sessionStorage.setItem(keyOf(), String(Math.round(window.scrollY)));
      } catch {}
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(save);
    };
    const onPop = () => {
      saving.current = false;
      let y: number | null = null;
      try {
        const v = sessionStorage.getItem(keyOf());
        if (v != null) y = Number(v);
      } catch {}
      pending.current = { kind: "pop", restoreY: y, started: performance.now() };
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    window.addEventListener("popstate", onPop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const go = useCallback(
    (href: string) => {
      const u = new URL(href, location.href);
      if (norm(u.pathname) === norm(location.pathname)) {
        // mesma rota: só atualiza a query (sem navegação) e volta ao topo
        if (u.search !== location.search) router.replace(u.pathname + u.search, { scroll: false });
        const l = getLenis();
        if (l) l.scrollTo(0, { duration: 1 });
        else window.scrollTo({ top: 0, behavior: isReduced() ? "auto" : "smooth" });
        return;
      }
      if (pending.current) return;
      try {
        sessionStorage.setItem(keyOf(), String(Math.round(window.scrollY)));
      } catch {}
      saving.current = false;
      if (document.documentElement.dataset.intro === "run") document.documentElement.dataset.intro = "done";
      pending.current = { kind: "push", restoreY: null, started: performance.now() };
      setDest(routeKey(u.pathname));
      const el = overlay.current!;
      holdScroll("pt");
      const push = () => router.push(u.pathname + u.search + u.hash, { scroll: false });
      gsap.killTweensOf(el);
      if (isReduced()) {
        gsap.set(el, { clipPath: "inset(0% 0% 0% 0%)", visibility: "visible" });
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none", onComplete: push });
      } else {
        gsap.set(el, { opacity: 1, visibility: "visible" });
        gsap.fromTo(
          el,
          { clipPath: "inset(100% 0% 0% 0%)" },
          { clipPath: "inset(0% 0% 0% 0%)", duration: 0.55, ease: "expo.inOut", onComplete: push },
        );
      }
    },
    [router],
  );

  // rota mudou → assenta e revela
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const p = pending.current ?? { kind: "pop" as const, restoreY: null, started: performance.now() };
    const el = overlay.current!;
    let done = false;
    let safety = 0;
    const reveal = () => {
      if (done) return;
      done = true;
      window.clearTimeout(safety);
      const y = p.kind === "pop" && p.restoreY != null ? p.restoreY : 0;
      const l = getLenis();
      window.scrollTo(0, y);
      if (l) l.scrollTo(y, { immediate: true, force: true });
      ScrollTrigger.refresh();
      if (y) {
        window.scrollTo(0, y);
        l?.scrollTo(y, { immediate: true, force: true });
      }
      releaseScroll("pt");
      const main = document.querySelector("main");
      const firstSec = main?.firstElementChild as HTMLElement | null;
      const reduced = isReduced();
      if (p.kind === "push") {
        if (reduced) gsap.to(el, { opacity: 0, duration: 0.15, ease: "none", onComplete: () => gsap.set(el, { visibility: "hidden" }) });
        else
          gsap.fromTo(
            el,
            { clipPath: "inset(0% 0% 0% 0%)" },
            {
              clipPath: "inset(0% 0% 100% 0%)",
              duration: 0.6,
              ease: "expo.inOut",
              onComplete: () => gsap.set(el, { visibility: "hidden" }),
            },
          );
        if (firstSec && !reduced)
          gsap.fromTo(firstSec, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", delay: 0.1, clearProps: "transform,opacity" });
      } else if (main && !reduced) {
        gsap.fromTo(main, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none", clearProps: "opacity" });
      }
      // foco no h1 e anúncio
      const h1 = document.querySelector<HTMLElement>("main h1");
      if (h1) {
        if (!h1.hasAttribute("tabindex")) h1.tabIndex = -1;
        h1.focus({ preventScroll: true });
      }
      setAnnounce(fmt(t.transition.loaded, { route: t.transition.routes[routeKey(location.pathname)] }));
      pending.current = null;
      window.setTimeout(() => {
        saving.current = true;
      }, 50);
    };
    safety = window.setTimeout(reveal, 1200);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const fonts = document.fonts?.ready ?? Promise.resolve();
        Promise.race([fonts, new Promise((r) => setTimeout(r, 300))]).then(reveal);
      }),
    );
    return () => window.clearTimeout(safety);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <TCtx.Provider value={{ go }}>
      {children}
      <div className="pt" ref={overlay} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={EMBLEM_SRC} alt="" width={64} height={64} />
        <span className="mono pt__route">
          <Scramble text={t.transition.routes[dest]} />
        </span>
      </div>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
    </TCtx.Provider>
  );
}
