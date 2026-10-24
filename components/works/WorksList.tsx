"use client";
// Lista suíça 001–006 (parecer v4 §6.4): linha inteira = link externo; hover/foco esmaece as outras e desloca o
// título; preview flutuante magnético único (quickTo) com pôster + vídeo da linha (1 por vez). No foco por teclado
// o preview ancora à direita da linha. M: cartões com pôster estático, sem preview.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/provider";
import { gsap, Flip, isReduced, ScrollTrigger, useIsoLayoutEffect } from "@/lib/gsap";
import { fmt } from "@/lib/i18n/dict";
import { frame, PROJECTS, shotSet, videoSrc, type Project } from "@/lib/projects";
import type { Tier } from "@/lib/tier";

export type ListApi = { thumbFor: (slug: string) => HTMLElement | null; root: () => HTMLElement | null };

const ListRow = ({ p, onEnter, onLeave }: { p: Project; onEnter: (p: Project, el: HTMLElement, kb: boolean) => void; onLeave: () => void }) => {
  const { t, lang } = useLang();
  return (
    <li className="wl__row" data-slug={p.slug} data-flip-id={p.slug} id={p.slug}>
      <a
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        className="wl__link"
        onPointerEnter={(e) => e.pointerType === "mouse" && onEnter(p, e.currentTarget, false)}
        onPointerLeave={onLeave}
        onFocus={(e) => e.currentTarget.matches(":focus-visible") && onEnter(p, e.currentTarget, true)}
        onBlur={onLeave}
      >
        <span className="wl__n mono">{p.n}</span>
        <span className="wl__title">
          <span className="wl__mask">
            <span className="wl__t">{p.name}</span>
          </span>
        </span>
        <span className="wl__client mono">
          <span className="wl__mask">
            <span>{p.client[lang]}</span>
          </span>
        </span>
        <span className="wl__year mono">{p.year}</span>
        <span className="wl__stack mono">
          <span className="wl__mask">
            <span>{p.stack.join(" · ")}</span>
          </span>
        </span>
        <span className="wl__thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={frame(p, "shot")} srcSet={shotSet(p)} sizes="160px" alt="" width={800} height={500} loading="lazy" decoding="async" />
        </span>
        <span className="wl__arrow" aria-hidden="true">
          ↗
        </span>
        <span className="sr-only">{t.a11y.newTab}</span>
      </a>
    </li>
  );
};

const WorksList = forwardRef<ListApi, { visible: Set<string>; tier: Tier }>(function WorksList({ visible, tier }, ref) {
  const { t } = useLang();
  const root = useRef<HTMLDivElement>(null);
  const prev = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement | null>(null);
  const [cur, setCur] = useState<Project | null>(null);
  const [hoverSlug, setHoverSlug] = useState<string | null>(null);
  const qx = useRef<((v: number) => void) | null>(null);
  const qy = useRef<((v: number) => void) | null>(null);
  const qr = useRef<((v: number) => void) | null>(null);
  const kb = useRef(false);
  const firstVisible = useRef(true);

  useImperativeHandle(ref, () => ({
    thumbFor: (slug) => root.current?.querySelector<HTMLElement>(`.wl__row[data-slug="${slug}"] .wl__thumb`) ?? null,
    root: () => root.current,
  }));

  // preview magnético
  useEffect(() => {
    const el = prev.current;
    if (!el) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)").matches;
    if (!fine) return;
    qx.current = gsap.quickTo(el, "x", { duration: 0.55, ease: "power3.out" });
    qy.current = gsap.quickTo(el, "y", { duration: 0.55, ease: "power3.out" });
    qr.current = gsap.quickTo(el, "rotation", { duration: 0.6, ease: "power3.out" });
    let lastX = 0;
    let lastT = performance.now();
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || kb.current) return;
      const now = performance.now();
      const vx = (e.clientX - lastX) / Math.max(1, now - lastT);
      lastX = e.clientX;
      lastT = now;
      qx.current?.(e.clientX + 24);
      qy.current?.(e.clientY + 24);
      qr.current?.(Math.max(-6, Math.min(6, vx * 4)));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      gsap.killTweensOf(el);
    };
  }, []);

  // vídeo da linha ativa no preview (1 por vez), sem vídeo no tier low/reduced
  useEffect(() => {
    const box = prev.current?.querySelector(".fp__media");
    if (!box) return;
    if (vid.current) {
      vid.current.pause();
      vid.current.removeAttribute("src");
      vid.current.querySelectorAll("source").forEach((s) => s.remove());
      vid.current.load();
      vid.current.remove();
      vid.current = null;
    }
    if (!cur || !(tier === "mid" || tier === "high") || !qx.current) return;
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "none";
    v.setAttribute("aria-hidden", "true");
    videoSrc(cur).forEach((s) => {
      const so = document.createElement("source");
      so.src = s.src;
      so.type = s.type;
      v.appendChild(so);
    });
    v.addEventListener("playing", () => v.classList.add("is-playing"), { once: true });
    box.appendChild(v);
    vid.current = v;
    v.load();
    v.play().catch(() => {});
  }, [cur, tier]);

  const enter = (p: Project, el: HTMLElement, isKb: boolean) => {
    setHoverSlug(p.slug);
    const pv = prev.current;
    if (!pv || !qx.current) return;
    kb.current = isKb;
    if (isKb) {
      const r = el.getBoundingClientRect();
      gsap.set(pv, { x: Math.min(window.innerWidth - 380, r.right - 380), y: r.top + r.height / 2 - 112, rotation: 0 });
    }
    setCur(p);
    if (isReduced()) gsap.set(pv, { scale: 1 });
    else gsap.to(pv, { scale: 1, duration: 0.45, ease: "expo.out", overwrite: "auto" });
  };
  const leave = () => {
    setHoverSlug(null);
    const pv = prev.current;
    setCur(null);
    if (!pv || !qx.current) return;
    if (isReduced()) gsap.set(pv, { scale: 0 });
    else gsap.to(pv, { scale: 0, duration: 0.3, ease: "power2.in", overwrite: "auto" });
  };

  // filtro na lista com Flip
  const sig = PROJECTS.filter((p) => visible.has(p.slug)).map((p) => p.slug).join();
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const rows = el.querySelectorAll<HTMLElement>(".wl__row");
    if (firstVisible.current || isReduced()) {
      firstVisible.current = false;
      rows.forEach((r) => (r.style.display = visible.has(r.dataset.slug!) ? "" : "none"));
      return;
    }
    const state = Flip.getState(rows);
    rows.forEach((r) => (r.style.display = visible.has(r.dataset.slug!) ? "" : "none"));
    Flip.from(state, {
      duration: 0.5,
      ease: "expo.inOut",
      absolute: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, duration: 0.2 }),
      onComplete: () => ScrollTrigger.refresh(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return (
    <div className="wl" ref={root} data-hover={hoverSlug ?? ""}>
      <div className="wl__head mono" aria-hidden="true">
        <span>{t.works.cols.n}</span>
        <span>{t.works.cols.project}</span>
        <span>{t.works.cols.client}</span>
        <span>{t.works.cols.year}</span>
        <span>{t.works.cols.stack}</span>
      </div>
      <ol className="wl__rows">
        {PROJECTS.map((p) => (
          <ListRow key={p.slug} p={p} onEnter={enter} onLeave={leave} />
        ))}
      </ol>
      <div className="fp" ref={prev} aria-hidden="true">
        <div className="fp__media">
          {cur && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={frame(cur, "shot")} srcSet={shotSet(cur)} sizes="(min-width: 1024px) 34vw, 90vw" alt="" width={800} height={500} />
          )}
        </div>
        {cur && <span className="fp__cap mono">{fmt("{n} — {name}", { n: cur.n, name: cur.name })}</span>}
      </div>
    </div>
  );
});

export default WorksList;
