"use client";
// Casca persistente (layout raiz): canvas do mundo, HUD de 4 cantos, Menu (portal), Reel (player) e Profile.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ui, useUI } from "@/lib/store";
import { copyText, reducedMotion } from "@/lib/motion";
import { SITE } from "@/lib/site";
import { useDialog } from "./useDialog";
import { Intro, intro } from "./Intro";
import { ReelPlayer } from "./ReelPlayer";
import { Cursor } from "./Cursor";
import { startPerfProbe } from "@/lib/perf";

// Menu final (etapa 5, 13/11): Home, Works, Studio, Lab, About, Résumé — o Reel vive na Home e no Studio.
export const MENU = [
  { n: "00", label: "Home", href: "/", style: "black" },
  { n: "01", label: "Works", href: "/works/", style: "grot" },
  { n: "02", label: "Studio", href: "/studio/", style: "black" },
  { n: "03", label: "Lab", href: "/lab/", style: "grot" },
  { n: "04", label: "About", href: "/about/", style: "black" },
  { n: "05", label: "Résumé", href: "/resume/", style: "grot" },
] as const;

export function Shell() {
  const pathname = usePathname() ?? "/";
  const inWorks = pathname.startsWith("/works");
  const s = useUI((x) => x);
  const overlayOpen = s.menu || s.reel || s.profile;

  useEffect(() => startPerfProbe(), []);

  // etapa 6: chunks de todas as rotas do Menu pré-carregados em ocioso logo após a carga (1ª navegação já sem rede)
  const router = useRouter();
  useEffect(() => {
    const go = () => MENU.forEach((m) => router.prefetch(m.href));
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (n: number) => void };
    if (w.requestIdleCallback && w.cancelIdleCallback) {
      const id = w.requestIdleCallback(go, { timeout: 2500 });
      return () => w.cancelIdleCallback!(id);
    }
    const id = window.setTimeout(go, 1500);
    return () => clearTimeout(id);
  }, [router]);

  // fecha overlays ao trocar de rota
  useEffect(() => {
    ui.set({ menu: false, profile: false });
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("overlay-open", overlayOpen);
  }, [overlayOpen]);

  // etapa 6: páginas de rolagem de documento ganham uma faixa escura sob o HUD (o texto não passa por baixo do logo)
  useEffect(() => {
    document.documentElement.classList.toggle("hud-fade", pathname.startsWith("/about") || pathname.startsWith("/resume"));
  }, [pathname]);

  const topRight = () => {
    if (s.menu) ui.set({ menu: false });
    else if (s.profile) ui.set({ profile: false });
    else ui.set({ menu: true });
  };

  return (
    <>
      <canvas id="world" className="world" aria-hidden="true" />
      <header className={`hud${s.panel ? " has-panel" : ""}`}>
        <Link href="/" className="hud-logo" aria-label="Lucas Melo — home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/avatar-emblem.webp" alt="" width={36} height={36} />
        </Link>
        <button
          type="button"
          className="hud-btn hud-menu"
          aria-expanded={s.menu}
          aria-controls="site-menu"
          onClick={topRight}
        >
          {s.menu || s.profile ? "Close" : "Menu"}
        </button>
        <div className="hud-bl">
          {inWorks ? (
            <nav aria-label="Works view" className="hud-views">
              <Link href="/works/" scroll={false} aria-current={s.works === "featured" ? "page" : undefined} className={s.works !== "full" ? "on" : ""}>
                Featured
              </Link>
              <span aria-hidden="true">/</span>
              <Link href="/works/full/" scroll={false} aria-current={s.works === "full" ? "page" : undefined} className={s.works === "full" ? "on" : ""}>
                Full
              </Link>
            </nav>
          ) : (
            <span className="hud-scroll" aria-hidden="true">{pathname.startsWith("/studio") || pathname.startsWith("/lab") ? "( Drag )" : "( Scroll )"}</span>
          )}
        </div>
        <button type="button" className="hud-btn hud-profile" aria-expanded={s.profile} onClick={() => ui.set({ profile: !s.profile, menu: false })}>
          {s.profile ? "Close" : "Profile"}
        </button>
      </header>
      <Menu open={s.menu} />
      <Intro />
      <Profile open={s.profile} />
      <ReelPlayer open={s.reel} />
      <Cursor />
    </>
  );
}

function Menu({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const close = useCallback(() => ui.set({ menu: false }), []);
  const router = useRouter();
  useDialog(open, ref, close);
  // etapa 6: rotas pré-carregadas ao abrir o Menu (os links ficam ocultos, então o prefetch por viewport não acontece)
  useEffect(() => {
    if (open) MENU.forEach((m) => router.prefetch(m.href));
  }, [open, router]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = reducedMotion();
    const btn = document.querySelector(".hud-menu")?.getBoundingClientRect();
    const cx = btn ? btn.left + btn.width / 2 : window.innerWidth - 80;
    const cy = btn ? btn.top + btn.height / 2 : 40;
    const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
    if (open) {
      setMounted(true);
      el.hidden = false;
      const items = el.querySelectorAll(".menu-item-in");
      if (reduced) {
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
        return;
      }
      gsap.fromTo(el, { clipPath: `circle(0px at ${cx}px ${cy}px)`, opacity: 1 }, { clipPath: `circle(${r}px at ${cx}px ${cy}px)`, duration: 0.45, ease: "expo.out" });
      gsap.fromTo(items, { yPercent: 105 }, { yPercent: 0, duration: 0.35, ease: "power2.out", stagger: 0.05, delay: 0.1 });
    } else if (mounted) {
      const done = () => void (el.hidden = true);
      if (reduced) gsap.to(el, { opacity: 0, duration: 0.2, onComplete: done });
      else gsap.to(el, { clipPath: `circle(0px at ${cx}px ${cy}px)`, duration: 0.35, ease: "power2.in", onComplete: done });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} id="site-menu" className="menu" role="dialog" aria-modal="true" aria-label="Menu" hidden>
      <div className="menu-rim" aria-hidden="true" />
      <nav aria-label="Main">
        <ol className="menu-list">
          {MENU.map((m) => (
            <li key={m.n} className="menu-li">
              <span className="menu-mask">
                <span className="menu-item-in">
                  <Link
                    href={m.href}
                    className={`menu-link ${m.style}`}
                    data-cursor={m.label}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                      e.preventDefault();
                      intro.go(m.href, m.label);
                    }}
                  >
                    <span className="menu-n">{m.n}</span>
                    <span className="menu-label">{m.label}</span>
                  </Link>
                </span>
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="menu-foot">
        <a href={`mailto:${SITE.email}`}>{SITE.email}</a>
        <a href={SITE.github} target="_blank" rel="noopener">GitHub ↗</a>
        <a href={SITE.linkedin} target="_blank" rel="noopener">LinkedIn ↗</a>
      </div>
    </div>
  );
}

function Profile({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => ui.set({ profile: false }), []);
  const [copied, setCopied] = useState(false);
  useDialog(open, ref, close);
  return (
    <div ref={ref} className={`profile${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Profile" hidden={!open}>
      <div className="profile-ring" aria-hidden="true" />
      <div className="profile-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/avatar-emblem.webp" alt="" width={56} height={56} className="profile-emblem" />
        <p className="profile-bio">{SITE.bio}</p>
        <p className="profile-mono">{SITE.mono}</p>
        <ul className="profile-links">
          <li><a href={SITE.github} target="_blank" rel="noopener">GitHub ↗</a></li>
          <li><a href={SITE.linkedin} target="_blank" rel="noopener">LinkedIn ↗</a></li>
          <li>
            <button
              type="button"
              onClick={() => copyText(SITE.email).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              })}
            >
              {copied ? "Email copied" : "Copy email"}
            </button>
          </li>
        </ul>
        <span className="sr-only" aria-live="polite">{copied ? "Email address copied to clipboard" : ""}</span>
      </div>
    </div>
  );
}
