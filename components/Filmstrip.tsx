"use client";
// Filmstrip dos 6 projetos + CTA (parecer v4 §5.3). ≥768 com motion: pin e o scroll vertical move a faixa (scrub 1).
// <768, reduced e sem JS: faixa nativa com scroll-snap. Ativo = tile mais perto do centro (hover/foco têm prioridade):
// camada colorida, scale 1 e o único vídeo tocando (tier ≥ mid). Inativos em P&B (arquivo -gray), sem vídeo.
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/provider";
import { useTier, useTierGuard } from "@/lib/tier";
import { gsap, isReduced, ScrollTrigger, useIsoLayoutEffect } from "@/lib/gsap";
import { getLenis } from "@/lib/lenis-store";
import { fmt } from "@/lib/i18n/dict";
import { PROJECTS, frame, pad2, pad3, videoSrc } from "@/lib/projects";
import { TransitionLink } from "./PageTransition";
import PauseButton from "./PauseButton";
import Scramble from "./Scramble";

const N = PROJECTS.length;

export default function Filmstrip() {
  const { t, lang } = useLang();
  const f = t.home.films;
  const tier = useTier();
  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const st = useRef<ScrollTrigger | null>(null);
  const dist = useRef(0);
  const [pin, setPin] = useState(false);
  const [scrollIdx, setScrollIdx] = useState(0);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const active = hoverIdx ?? scrollIdx;
  const prevActive = useRef(active);
  const nameRef = useRef<HTMLSpanElement>(null);
  const reduced = tier === "reduced";
  const videoOk = (tier === "mid" || tier === "high") && !paused && inView;

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useTierGuard(inView && pin, "filmstrip");

  // modo pin
  useIsoLayoutEffect(() => {
    const el = root.current;
    const tr = track.current;
    if (!el || !tr) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
      if (document.documentElement.dataset.tier === "reduced") return;
      setPin(true);
      const tiles = () => Array.from(tr.children) as HTMLElement[];
      const D = () => {
        const last = tiles()[tiles().length - 1];
        dist.current = Math.max(0, last.offsetLeft + last.offsetWidth - (window.innerWidth - 32));
        return dist.current;
      };
      const setBar = bar.current ? gsap.quickSetter(bar.current, "scaleX") : null;
      const tw = gsap.to(tr, {
        x: () => -D(),
        ease: "none",
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => "+=" + D(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: 2,
          onUpdate: (self) => {
            setBar?.(self.progress);
            // ativo pelo progresso (adaptação medida: o "mais perto do centro" nunca alcançava os 2 últimos tiles)
            const best = Math.round(self.progress * (tiles().length - 1));
            setScrollIdx((p) => (p === best ? p : best));
          },
        },
      });
      st.current = tw.scrollTrigger ?? null;
      ScrollTrigger.sort();
      ScrollTrigger.refresh();
      return () => {
        st.current = null;
        setPin(false);
      };
    });
    return () => mm.revert();
  }, [tier === "reduced"]);

  // modo nativo: ativo pelo IO dentro da faixa
  useEffect(() => {
    const tr = track.current;
    if (!tr || pin) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) setScrollIdx(Number((e.target as HTMLElement).dataset.i));
        }),
      { root: tr, threshold: 0.6 },
    );
    Array.from(tr.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [pin]);

  // nome do ativo troca por máscara
  useEffect(() => {
    if (prevActive.current === active) return;
    prevActive.current = active;
    const el = nameRef.current;
    if (!el || isReduced()) return;
    gsap.fromTo(el, { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: "expo.out" });
  }, [active]);

  // foco por teclado no modo pin: rola até a posição que centraliza o tile
  const onFocusTile = (i: number) => (e: React.FocusEvent<HTMLElement>) => {
    setHoverIdx(i);
    const s = st.current;
    if (!s || !pin || !e.currentTarget.matches(":focus-visible")) return;
    const c = e.currentTarget;
    const target = Math.min(dist.current, Math.max(0, c.offsetLeft + c.offsetWidth / 2 - window.innerWidth / 2));
    const y = s.start + (dist.current ? (target / dist.current) * (s.end - s.start) : 0);
    const l = getLenis();
    if (l) l.scrollTo(y, { immediate: true, force: true });
    else window.scrollTo(0, y);
  };

  const cur = PROJECTS[Math.min(active, N - 1)];
  const isCta = active >= N;

  return (
    <section className="films" ref={root} data-pin={pin} aria-labelledby="films-title">
      <div className="films__inner">
        <div className="films__head">
          <p className="mono films__label">
            <span id="films-title">{f.label}</span>
            <span className="films__count">
              <Scramble text={fmt(f.count, { n: pad2(Math.min(active + 1, N)), total: pad2(N) })} />
            </span>
          </p>
          <p className="films__name" aria-hidden="true">
            <span ref={nameRef} key={active}>
              {isCta ? t.menu.items.works : cur.name}
            </span>
          </p>
          <p className="mono films__meta" aria-hidden="true">
            <Scramble text={isCta ? `001 — ${pad3(N)}` : `${cur.stack.join(" · ").toUpperCase()} — ${cur.year}`} />
          </p>
          <p className="mono films__hint" aria-hidden="true">
            {f.hint}
          </p>
        </div>
        <div className="films__track" ref={track} data-lenis-prevent={pin ? undefined : true}>
          {PROJECTS.map((p, i) => {
            const on = i === active;
            return (
              <a
                key={p.slug}
                data-i={i}
                className="film"
                data-active={on}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={fmt(f.visitAria, { name: p.name })}
                onPointerEnter={(e) => e.pointerType === "mouse" && setHoverIdx(i)}
                onPointerLeave={() => setHoverIdx(null)}
                onFocus={onFocusTile(i)}
                onBlur={() => setHoverIdx(null)}
              >
                <span className="film__media">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="film__gray" src={frame(p, "poster", true)} alt="" width={864} height={540} loading="lazy" decoding="async" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="film__color" src={frame(p, "poster")} alt="" width={864} height={540} loading="lazy" decoding="async" />
                  {on && videoOk && !reduced && (
                    <video
                      className="film__video"
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="auto"
                      aria-hidden="true"
                      tabIndex={-1}
                      onPlaying={(e) => (e.currentTarget.dataset.playing = "true")}
                    >
                      {videoSrc(p).map((s) => (
                        <source key={s.src} src={s.src} type={s.type} />
                      ))}
                    </video>
                  )}
                </span>
                <span className="film__cap mono">
                  <span>
                    {p.n} — {p.name}
                  </span>
                  <span className="film__visit">{f.visit}</span>
                </span>
              </a>
            );
          })}
          <TransitionLink
            href="/works"
            data-i={N}
            className="film film--cta"
            data-active={isCta}
            onFocus={onFocusTile(N)}
            onBlur={() => setHoverIdx(null)}
            onPointerEnter={() => setHoverIdx(N)}
            onPointerLeave={() => setHoverIdx(null)}
          >
            <span className="film__big black" aria-hidden="true">
              {pad2(N)}
            </span>
            <span className="film__cta" lang={lang === "pt" ? "pt-BR" : "en"}>
              {f.cta}
            </span>
          </TransitionLink>
        </div>
        <span className="films__bar" aria-hidden="true">
          <span ref={bar} />
        </span>
        {!reduced && (tier === "mid" || tier === "high") && (
          <PauseButton
            size="sm"
            pos="br"
            paused={paused}
            onToggle={() => setPaused((p) => !p)}
            label="filmstrip"
            ariaLabel={paused ? t.a11y.playVideo : t.a11y.pauseVideo}
          />
        )}
      </div>
    </section>
  );
}
