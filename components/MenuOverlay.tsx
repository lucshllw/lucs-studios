"use client";
// Menu overlay escuro (parecer v4 §4): <dialog> com showModal (foco preso, inert e Esc nativos), Lenis parado,
// itens gigantes na base esquerda com máscara por linha, v5: sem cards de prévia (menu limpo), CopyEmail + canais no rodapé.
import { useEffect, useRef, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { Github, Linkedin } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { gsap, isReduced } from "@/lib/gsap";
import { holdScroll, releaseScroll } from "@/lib/lenis-store";
import { PROFILE } from "@/lib/content";
import { routeKey, type RouteKey } from "@/lib/i18n/dict";
import { usePageTransition } from "./PageTransition";
import CopyEmail from "./CopyEmail";
import { MenuButton } from "./HeaderControls";

const ITEMS: { key: Exclude<RouteKey, never>; href: string; n: string }[] = [
  { key: "home", href: "/", n: "01" },
  { key: "works", href: "/works", n: "02" },
  { key: "about", href: "/about", n: "03" },
  { key: "cv", href: "/curriculo", n: "04" },
];

export default function MenuOverlay({ open, onClose, returnFocus }: { open: boolean; onClose: () => void; returnFocus: RefObject<HTMLButtonElement | null> }) {
  const t = useT();
  const pathname = usePathname();
  const active = routeKey(pathname);
  const { go } = usePageTransition();
  const dlg = useRef<HTMLDialogElement>(null);
  const closing = useRef(false);
  const [hover, setHover] = useState<RouteKey | null>(null);

  // abrir
  useEffect(() => {
    const d = dlg.current;
    if (!d || !open || d.open) return;
    closing.current = false;
    d.showModal();
    holdScroll("menu");
    const items = d.querySelectorAll<HTMLElement>(".mo__item-in");
    if (isReduced()) {
      gsap.fromTo(d, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
      return;
    }
    gsap.set(d, { opacity: 1 });
    const tl = gsap.timeline();
    tl.fromTo(d, { clipPath: "inset(0% 0% 100% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.6, ease: "expo.inOut" }, 0)
      .fromTo(items, { yPercent: 110 }, { yPercent: 0, duration: 0.7, ease: "expo.out", stagger: 0.06 }, 0.25)
      .fromTo(d.querySelectorAll(".mo__fade"), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.4);
    return () => {
      tl.kill();
    };
  }, [open]);

  const finish = (after?: () => void) => {
    const d = dlg.current;
    if (!d) return;
    d.close();
    gsap.set(d, { clearProps: "clipPath,opacity" });
    gsap.set(d.querySelectorAll(".mo__item-in"), { clearProps: "transform" });
    releaseScroll("menu");
    onClose();
    closing.current = false;
    if (after) after();
    else returnFocus.current?.focus({ preventScroll: true });
  };

  const close = (after?: () => void) => {
    const d = dlg.current;
    if (!d || !d.open || closing.current) return;
    closing.current = true;
    setHover(null);
    if (isReduced()) {
      gsap.to(d, { opacity: 0, duration: 0.15, ease: "none", onComplete: () => finish(after) });
      return;
    }
    gsap
      .timeline({ onComplete: () => finish(after) })
      .to(d.querySelectorAll(".mo__item-in"), { yPercent: -110, duration: 0.25, ease: "power3.in", stagger: 0.03 }, 0)
      .to(d, { clipPath: "inset(100% 0% 0% 0%)", duration: 0.4, ease: "power3.in" }, 0.12);
  };

  // Esc → fechamento animado
  useEffect(() => {
    const d = dlg.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      close();
    };
    // Tab circular dentro do diálogo (o Chrome deixa o foco sair para a interface do navegador)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const f = [...d.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && (i <= 0)) {
        e.preventDefault();
        f[f.length - 1].focus();
      } else if (!e.shiftKey && i === f.length - 1) {
        e.preventDefault();
        f[0].focus();
      }
    };
    d.addEventListener("cancel", onCancel);
    d.addEventListener("keydown", onKey);
    return () => {
      d.removeEventListener("cancel", onCancel);
      d.removeEventListener("keydown", onKey);
    };
  });

  // fechar se a rota mudar por outro meio (back/forward)
  useEffect(() => {
    const d = dlg.current;
    if (d?.open && !closing.current) finish(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const pick = (href: string, key: RouteKey) => (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    if (key === active) close(() => go(href));
    else close(() => go(href));
  };

  return (
    <dialog className="mo" id="site-menu" ref={dlg} aria-label={t.menu.dialog} data-hover={hover ?? ""}>
      <div className="site-header mo__bar">
        <div className="sh__l">
          <span className="sh__brand mono" aria-hidden="true">
            [ <span className="sh__brand-long">{t.header.brand}</span>
            <span className="sh__brand-short">{t.header.brandShort}</span> ]
          </span>
        </div>
        <p className="sh__c mono" aria-hidden="true" />
        <div className="sh__r">
          <MenuButton open onClick={() => close()} controls="site-menu" />
        </div>
      </div>
      <div className="mo__grid">
        <div className="mo__col">
          <p className="mo__label mono mo__fade">{t.menu.label}</p>
          <nav aria-label={t.menu.dialog}>
            <ul className="mo__list">
              {ITEMS.map((it) => (
                <li key={it.key} className="mo__item" data-active={it.key === active} data-dim={hover != null && hover !== it.key}>
                  <a
                    href={it.href}
                    aria-current={it.key === active ? "page" : undefined}
                    onClick={pick(it.href, it.key)}
                    onPointerEnter={() => setHover(it.key)}
                    onPointerLeave={() => setHover(null)}
                    onFocus={() => setHover(it.key)}
                    onBlur={() => setHover(null)}
                  >
                    <span className="mo__item-in">
                      <span className="mo__n mono">{it.n}</span>
                      <span className="mo__name">
                        {t.menu.items[it.key]}
                        {it.key === active && <span className="mo__dot" aria-hidden="true" />}
                      </span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
      <div className="mo__foot mo__fade">
        <span className="mono mo__foot-l">{t.menu.contact}</span>
        <CopyEmail email={PROFILE.email} compact tone="dark" />
        <ul className="mo__channels" aria-label={t.footer.channels}>
          <li>
            <a href={PROFILE.github} target="_blank" rel="noopener noreferrer" aria-label={t.footer.github}>
              <Github aria-hidden />
            </a>
          </li>
          <li>
            <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer" aria-label={t.footer.linkedin}>
              <Linkedin aria-hidden />
            </a>
          </li>
        </ul>
        <p className="mono mo__status">
          <span className="sh__dot" aria-hidden="true" />
          {t.menu.status}
        </p>
      </div>
    </dialog>
  );
}
