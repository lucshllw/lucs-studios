"use client";
// Painel do projeto (PROMPT-MESTRE §7.4, maquete aprovada proposals/panel): preto sobre preto, nome gigante
// grotesca + blackletter, vídeo com borda que curva pela velocidade, meta com chips, galeria 4K em paralaxe,
// próximo projeto puxado pelo círculo (overscroll 240/160 px + botão real).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Pic } from "@/components/Pic";
import { addTick } from "@/lib/loop";
import { useLenis } from "@/components/SmoothScroll";
import { SectionIntro } from "@/components/bits/SectionIntro";
import { SectionIndex } from "@/components/SectionIndex";

const P_INDEX = [
  { id: "p-overview", label: "Overview" },
  { id: "p-built", label: "Built" },
  { id: "p-gallery", label: "Gallery" },
  { id: "p-next", label: "Next" },
];
const P_INDEX_NOGAL = P_INDEX.filter((x) => x.id !== "p-gallery");
import { parallaxShift, reducedMotion } from "@/lib/motion";
import { type Project, TAG_LABEL, TOTAL, nextOf, shotUrl, splitName, videoSrc, media } from "@/lib/projects";

export type PanelPhase = "in" | "shown" | "out" | "next-out";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function Panel({
  project,
  phase,
  instant,
  onClose,
  onNext,
}: {
  project: Project;
  phase: PanelPhase;
  instant: boolean;
  onClose: () => void;
  onNext: () => void;
}) {
  const root = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ringArc = useRef<SVGCircleElement>(null);
  const nextSec = useRef<HTMLDivElement>(null);
  const nextRing = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const userPaused = useRef(false);
  const next = nextOf(project);
  const idx = Number(project.n);
  const name = splitName(project.name);
  const nextName = splitName(next.name);
  const gallery = project.shots.slice(1);
  useLenis(scroller, content, "panel");

  // entrada do conteúdo (t relativo à abertura do painel: 0,45–1,10 s da sequência §7.3)
  useIso(() => {
    const el = root.current;
    if (!el) return;
    const q = gsap.utils.selector(el);
    if (phase !== "in" || instant || reducedMotion()) {
      gsap.set(q("[data-in]"), { clearProps: "all" });
      if (phase === "in" && (instant || reducedMotion())) gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: instant ? 0.3 : 0.2 });
      return;
    }
    const tl = gsap.timeline();
    tl.fromTo(q("[data-in=num]"), { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.out" }, 0)
      .fromTo(q("[data-in=line]"), { yPercent: 105 }, { yPercent: 0, duration: 0.5, ease: "expo.out", stagger: 0.06 }, 0)
      .fromTo(q("[data-in=lead]"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.3, ease: "power1.out" }, 0.25)
      .fromTo(q("[data-in=video]"), { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "expo.out" }, 0.15)
      .fromTo(q("[data-in=meta]"), { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.3, ease: "power1.out", stagger: 0.04 }, 0.35);
    return () => void tl.kill();
  }, [phase, instant]);

  // saída para o próximo projeto: conteúdo sobe e some
  useEffect(() => {
    if (phase !== "next-out" || !scroller.current) return;
    const t = gsap.to(scroller.current, { yPercent: -12, opacity: 0, duration: reducedMotion() ? 0.2 : 0.35, ease: "power2.in" });
    return () => void t.kill();
  }, [phase]);

  // vídeo: só toca em vista; botão Pause/Play (WCAG 2.2.2)
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !userPaused.current && !document.hidden) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.25 }
    );
    io.observe(v);
    const vis = () => (document.hidden ? v.pause() : null);
    document.addEventListener("visibilitychange", vis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", vis);
      v.pause();
    };
  }, [project.slug]);

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      userPaused.current = false;
      v.play().catch(() => {});
      setPaused(false);
    } else {
      userPaused.current = true;
      v.pause();
      setPaused(true);
    }
  };

  // rolagem nativa: curva do vídeo pela velocidade, paralaxe da galeria, anel do próximo, overscroll
  useEffect(() => {
    const sc = scroller.current;
    if (!sc) return;
    const reduced = reducedMotion();
    const coarse = matchMedia("(pointer: coarse)").matches;
    const threshold = coarse ? 160 : 240;
    let last = sc.scrollTop;
    let vel = 0;
    let bend = 0;
    let acc = 0;
    let lastPush = 0;
    let fired = false;
    const par = Array.from(sc.querySelectorAll<HTMLElement>("[data-depth]"));
    const inner = Array.from(sc.querySelectorAll<HTMLElement>(".g-mask img"));
    const circ = 2 * Math.PI * 49;

    const atBottom = () => sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
    const push = (d: number) => {
      if (fired || reduced) return;
      if (!atBottom()) {
        acc = 0;
        return;
      }
      acc = Math.max(0, acc + d);
      lastPush = performance.now();
      if (acc >= threshold) {
        fired = true;
        acc = threshold;
        onNext();
      }
    };
    const onWheel = (e: WheelEvent) => push(e.deltaY * (e.deltaMode === 1 ? 16 : 1));
    let ty = 0;
    const onTs = (e: TouchEvent) => (ty = e.touches[0].clientY);
    const onTm = (e: TouchEvent) => {
      const y = e.touches[0].clientY;
      push(ty - y);
      ty = y;
    };
    sc.addEventListener("wheel", onWheel, { passive: true });
    sc.addEventListener("touchstart", onTs, { passive: true });
    sc.addEventListener("touchmove", onTm, { passive: true });

    const untick = addTick((_t, dt) => {
      const y = sc.scrollTop;
      const v = dt > 0 ? (y - last) / dt : 0;
      last = y;
      vel += (v - vel) * (1 - Math.exp(-dt * 10));
      const vh = sc.clientHeight;
      if (!reduced) {
        // borda do vídeo curva no sentido do movimento (máx. ~6% da altura), volta em ~0,45 s
        const target = Math.max(-1, Math.min(1, vel / 2600));
        bend += (target - bend) * (1 - Math.exp(-dt * (Math.abs(target) > Math.abs(bend) ? 14 : 6.5)));
        if (frame.current) {
          const r = frame.current.getBoundingClientRect();
          const enter = Math.min(1, Math.max(0, (vh - (r.top - sc.getBoundingClientRect().top)) / (vh * 0.8)));
          const s = 0.92 + 0.08 * enter;
          frame.current.style.transform = `perspective(1400px) rotateX(${(-bend * 7).toFixed(3)}deg) scale(${s.toFixed(4)}, ${(s * (1 - Math.abs(bend) * 0.03)).toFixed(4)})`;
          frame.current.style.borderRadius = `${12 + Math.abs(bend) * 30}px / ${12 + Math.abs(bend) * 60}px`;
        }
        const top = sc.getBoundingClientRect().top;
        for (const el of par) {
          const r = (el.parentElement ?? el).getBoundingClientRect();
          const off = r.top - top + r.height / 2 - vh / 2;
          el.style.transform = `translate3d(0, ${parallaxShift(Number(el.dataset.depth), off).toFixed(2)}px, 0)`;
        }
        for (const el of inner) {
          const r = (el.closest(".g-mask") ?? el).getBoundingClientRect();
          const p = (r.top - top + r.height / 2 - vh / 2) / vh; // -1..1
          el.style.transform = `translate3d(0, ${(-p * 7).toFixed(3)}%, 0)`;
        }
        if (nextRing.current && nextSec.current) {
          const nr = nextSec.current.getBoundingClientRect();
          const p = Math.min(1, Math.max(0, 1 - (nr.top - top) / vh));
          nextRing.current.style.transform = `scale(${(0.6 + p * 0.4).toFixed(4)}) rotate(${((1 - p) * -25).toFixed(2)}deg)`;
        }
      }
      // anel enche com o overscroll; parar de rolar faz recuar (~0,6 s)
      if (!fired && acc > 0 && performance.now() - lastPush > 140) acc *= Math.exp(-dt / 0.15);
      if (acc < 0.5) acc = 0;
      if (ringArc.current) ringArc.current.style.strokeDashoffset = String(circ * (1 - acc / threshold));
    });
    return () => {
      untick();
      sc.removeEventListener("wheel", onWheel);
      sc.removeEventListener("touchstart", onTs);
      sc.removeEventListener("touchmove", onTm);
    };
  }, [project.slug, onNext]);

  // foco preso no diálogo; Esc fecha
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !root.current) return;
    const f = Array.from(
      root.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0];
    const lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      first.focus();
    }
  };

  const tags = project.tags.map((t) => TAG_LABEL[t]).join(" · ");
  const cover = project.shots[0];

  return (
    <article
      ref={root}
      className={`panel is-${phase}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-title"
      onKeyDown={onKeyDown}
    >
      <div className="panel-crumb" aria-hidden="true">
        <b>{project.name}</b> <span>/ Works / {project.n} of {String(TOTAL).padStart(3, "0")}</span>
      </div>
      <button type="button" className="panel-close" aria-label="Close project" onClick={onClose}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="panel-scroll" ref={scroller}>
        <div className="panel-content" ref={content}>
        <header className="p-open" id="p-overview">
          <div className="p-meta-top" data-in="num">
            <span>( {project.n} / {String(TOTAL).padStart(3, "0")} )</span>
            <span>{tags}</span>
            <span>{project.year}</span>
          </div>
          <h2 className="p-title" id="project-title" tabIndex={-1}>
            {name.grot && (
              <span className="mask">
                <span className="grot" data-in="line">{name.grot}</span>
              </span>
            )}
            <span className="mask">
              <span className={name.grot ? "black" : "black solo"} data-in="line">{name.black}</span>
            </span>
          </h2>
          <div className="p-lead" data-in="lead">
            <p>{project.kind}</p>
            <span className="p-hint" aria-hidden="true">SCROLL ↓</span>
          </div>
        </header>

        <div className="p-video">
          <div className="p-frame" ref={frame} data-in="video">
            <video
              ref={video}
              muted
              loop
              playsInline
              preload="metadata"
              poster={`${media(project)}/poster-desktop.webp`}
              aria-label={`${project.name} website recording`}
            >
              {videoSrc(project).map((s) => (
                <source key={s.src} src={s.src} type={s.type} media={s.media} />
              ))}
            </video>
          </div>
          <button type="button" className="p-play" onClick={togglePlay} aria-pressed={paused}>
            {paused ? "Play video" : "Pause video"}
          </button>
        </div>

        <SectionIntro as="div" n={Number(project.n)} title="Case" className="p-sx" id="p-built" />
        <section className="p-info" aria-label="Project details">
          <div className="p-built" data-in="meta">
            <div className="p-label">( What I built )</div>
            <p>{project.built}</p>
          </div>
          <dl className="p-facts">
            <div data-in="meta">
              <dt className="p-label">Client</dt>
              <dd>{project.client}</dd>
            </div>
            <div data-in="meta">
              <dt className="p-label">Year</dt>
              <dd>{project.year}</dd>
            </div>
            <div data-in="meta">
              <dt className="p-label">Stack</dt>
              <dd>
                <ul className="chips">
                  {project.stack.map((s) => (
                    <li key={s} className="chip">{s}</li>
                  ))}
                </ul>
              </dd>
            </div>
            <div data-in="meta">
              <dt className="sr-only">Live site</dt>
              <dd>
                <a className="visit" href={project.url} target="_blank" rel="noopener">
                  Visit site <span aria-hidden="true">↗</span>
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
          </dl>
        </section>

        {gallery.length > 0 && (
          <section className="p-gallery" id="p-gallery" aria-label={`${project.name} screens`}>
            {gallery.map((s, k) => {
              const cls = galleryClass(k);
              const wide = cls === "g-wide";
              return (
                <figure key={s.id} className={cls}>
                  <div className="g-mask" data-depth={k % 2 === 0 ? 0.88 : 1.12}>
                    <Pic
                      project={project}
                      shot={s}
                      imgClassName="g-img"
                      sizes={
                        wide
                          ? "(max-width: 767px) calc(100vw - 40px), calc(100vw - 150px)"
                          : cls === "g-a"
                            ? "(max-width: 767px) calc(100vw - 40px), 55vw"
                            : "(max-width: 767px) calc(100vw - 40px), 38vw"
                      }
                      alt={`${project.name} website, screen ${k + 2}`}
                    />
                  </div>
                  <figcaption>
                    {String(k + 1).padStart(2, "0")} — {project.name.toUpperCase()}
                  </figcaption>
                </figure>
              );
            })}
            <div className="g-bigword" aria-hidden="true">
              <span data-depth={0.75}>{name.black}</span>
            </div>
          </section>
        )}

        <div className="p-next" id="p-next" ref={nextSec}>
          <div className="p-ring" ref={nextRing} aria-hidden="true">
            {next.shots[0] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={shotUrl(next, next.shots[0].id, 1280)} alt="" loading="lazy" decoding="async" />
            )}
            <svg viewBox="0 0 100 100" className="p-ring-svg">
              <circle cx="50" cy="50" r="49" className="track" />
              <circle cx="50" cy="50" r="49" className="arc" ref={ringArc} style={{ strokeDasharray: 2 * Math.PI * 49, strokeDashoffset: 2 * Math.PI * 49 }} />
            </svg>
          </div>
          <div className="p-next-txt">
            <small>( NEXT — {next.n} / {String(TOTAL).padStart(3, "0")} )</small>
            <span className="p-next-name">
              {nextName.grot && <span className="grot">{nextName.grot}</span>}
              <span className="black">{nextName.black}</span>
            </span>
            <button type="button" className="p-next-btn" onClick={onNext}>
              Next project <span aria-hidden="true">→</span>
            </button>
          </div>
          <div className="p-next-hint" aria-hidden="true">KEEP SCROLLING TO SUMMON ↓</div>
        </div>
        </div>
      </div>
      <SectionIndex items={gallery.length ? P_INDEX : P_INDEX_NOGAL} scroller={scroller} lenisKey="panel" className="sidx-panel" />
      <p className="sr-only">Project {idx} of {TOTAL}.</p>
    </article>
  );
}

/** ritmo editorial: 1 larga, par 7+5 desalinhado, repete */
function galleryClass(k: number) {
  const m = k % 3;
  return m === 0 ? "g-wide" : m === 1 ? "g-a" : "g-b";
}
