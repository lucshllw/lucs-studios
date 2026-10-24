"use client";
// /about (parecer v4 §7): retrato com "Lucas"/"Melo" gigantes em volta, manifesto técnico com escada de camadas,
// tabela de formação, clientes em colunas interativas (D) / <details> exclusivo (M e sem JS) e CTAs de currículo.
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/provider";
import { useTier } from "@/lib/tier";
import { gsap, MOTION_OK, useIsoLayoutEffect } from "@/lib/gsap";
import { useMagnetic } from "@/lib/magnetic";
import { CV } from "@/lib/curriculo";
import { PROJECTS } from "@/lib/projects";
import { useMounted } from "@/lib/hooks";
import WordScrub from "../WordScrub";
import Rain from "../Rain";
import HudFrame from "../HudFrame";
import { TransitionLink } from "../PageTransition";

const PHOTO = { base: "/brand/lucas-foto-sobre", width: 828, height: 1087 };
export const PDF = { pt: "/arquivos/curriculo-lucas-melo.pdf", en: "/arquivos/curriculo-lucas-melo-en.pdf" };

function Picture({ alt, eager = false }: { alt: string; eager?: boolean }) {
  return (
    <picture>
      <source srcSet={`${PHOTO.base}.avif`} type="image/avif" />
      <source srcSet={`${PHOTO.base}.webp`} type="image/webp" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="hq" src={`${PHOTO.base}.jpg`} width={PHOTO.width} height={PHOTO.height} alt={alt} loading={eager ? "eager" : "lazy"} decoding="async" />
    </picture>
  );
}

/** Hover P&B → cor com máscara radial que segue o ponteiro (v3 aprovado). Touch/reduced/sem JS: P&B estático. */
function PhotoReveal({ alt }: { alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;
    el.dataset.hover = "on";
    let raf = 0;
    let tx = 0.5;
    let ty = 0.3;
    let x = tx;
    let y = ty;
    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.setProperty("--mx", `${(x * 100).toFixed(2)}%`);
      el.style.setProperty("--my", `${(y * 100).toFixed(2)}%`);
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.0005 ? requestAnimationFrame(loop) : 0;
    };
    const kick = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const pos = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = (e.clientX - r.left) / r.width;
      ty = (e.clientY - r.top) / r.height;
    };
    const onMove = (e: PointerEvent) => {
      pos(e);
      kick();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pos(e);
      x = tx;
      y = ty;
      el.dataset.active = "true";
      kick();
    };
    const onLeave = () => (el.dataset.active = "false");
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      delete el.dataset.hover;
    };
  }, []);
  return (
    <div className="aboutme__photo ah__photo" ref={ref} data-active="false">
      <div className="aboutme__layer aboutme__layer--base">
        <Picture alt={alt} eager />
      </div>
      <div className="aboutme__layer aboutme__layer--color" aria-hidden="true">
        <Picture alt="" eager />
      </div>
    </div>
  );
}

function AboutHero() {
  const { t } = useLang();
  const a = t.about;
  const tier = useTier();
  const mounted = useMounted();
  const root = useRef<HTMLElement>(null);
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      const photo = el.querySelector(".ah__photowrap");
      const first = el.querySelector(".ah__first");
      const last = el.querySelector(".ah__last");
      gsap.fromTo(photo, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "expo.out", clearProps: "clipPath" });
      gsap.fromTo(first, { x: "-8vw", opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "expo.out", delay: 0.15 });
      gsap.fromTo(last, { x: "8vw", opacity: 0 }, { x: 0, opacity: 1, duration: 1, ease: "expo.out", delay: 0.15 });
    });
    mm.add(`${MOTION_OK} and (min-width: 768px)`, () => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: el, start: "top top", end: "bottom top", scrub: 0.5 } });
      tl.to(el.querySelector(".ah__first"), { xPercent: -12, ease: "none" }, 0)
        .to(el.querySelector(".ah__last"), { xPercent: 12, ease: "none" }, 0)
        .to(el.querySelector(".ah__photo"), { scale: 1.06, ease: "none" }, 0);
    });
    return () => mm.revert();
  }, []);
  return (
    <section className="ah" ref={root} aria-labelledby="about-title">
      {mounted && tier === "high" && <Rain />}
      <p className="mono ah__label">{a.label}</p>
      <h1 className="ah__name" id="about-title" tabIndex={-1}>
        <span className="ah__first black">{a.first}</span>
        <span className="ah__photowrap">
          <HudFrame className="ah__hud" topLeft="FRAME 01 · PORTRAIT · ISO 800" layout="sides" start={3.5} />
          <PhotoReveal alt={a.photoAlt} />
        </span>
        <span className="ah__last black">{a.last}</span>
      </h1>
      <p className="mono ah__cap">{a.caption}</p>
    </section>
  );
}

function EndToEnd() {
  const { t, lang } = useLang();
  const e = t.about.e2e;
  const root = useRef<HTMLElement>(null);
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        el.querySelectorAll(".e2e__line"),
        { scaleX: 0 },
        { scaleX: 1, duration: 0.8, ease: "expo.out", stagger: 0.12, scrollTrigger: { trigger: el.querySelector(".e2e__ladder"), start: "top 70%", once: true } },
      );
    });
    return () => mm.revert();
  }, []);
  return (
    <section className="e2e" ref={root} aria-labelledby="e2e-label">
      <p className="mono e2e__label" id="e2e-label">
        {e.label}
      </p>
      <WordScrub key={lang} as="p" className="e2e__text ws" lines={[{ text: e.text }]} start={["top 75%", "top 85%"]} end={["bottom 50%", "bottom 55%"]} />
      <ol className="e2e__ladder">
        {e.layers.map((l) => (
          <li key={l.n} className="e2e__step">
            <span className="e2e__line" aria-hidden="true" />
            <span className="mono e2e__n">{l.n}</span>
            <span className="e2e__name">{l.name}</span>
            <span className="mono e2e__items">{l.items}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EducationTable() {
  const { t, lang } = useLang();
  const d = t.about.edu;
  const edu = CV[lang].education;
  const root = useRef<HTMLElement>(null);
  const [q1, q2] = d.quote.split("{circuit}");
  useIsoLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add(MOTION_OK, () => {
      gsap.fromTo(
        el.querySelectorAll("tbody tr"),
        { yPercent: 100, opacity: 0 },
        { yPercent: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.05, scrollTrigger: { trigger: el, start: "top 75%", once: true } },
      );
    });
    return () => mm.revert();
  }, []);
  const stack = "React · SvelteKit · TypeScript · GSAP · Three.js/WebGL · Node.js · Supabase";
  const rows: { area: string; inst: string; course: string; status: string }[] = [
    { area: d.areas.academic, inst: edu[0].inst, course: edu[0].course, status: edu[0].status },
    { area: d.areas.hardware, inst: edu[2].inst, course: edu[2].course, status: edu[2].status },
    { area: d.areas.hardware, inst: edu[1].inst, course: edu[1].course, status: edu[1].status },
  ];
  return (
    <section className="edu" ref={root} aria-labelledby="edu-label" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 900px" }}>
      <p className="mono edu__label" id="edu-label">
        {d.label}
      </p>
      <table className="edu__table">
        <caption className="sr-only">{d.caption}</caption>
        <thead>
          <tr className="mono">
            <th scope="col">{d.cols.area}</th>
            <th scope="col">{d.cols.inst}</th>
            <th scope="col">{d.cols.course}</th>
            <th scope="col">{d.cols.status}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <th scope="row" className="mono" data-label={d.cols.area}>
                {r.area}
              </th>
              <td data-label={d.cols.inst}>{r.inst}</td>
              <td data-label={d.cols.course}>{r.course}</td>
              <td className="mono" data-label={d.cols.status}>
                {r.status}
              </td>
            </tr>
          ))}
          <tr className="edu__quote">
            <td colSpan={4}>
              <blockquote>
                {q1}
                <span className="black">{d.quoteWord}</span>
                {q2}
              </blockquote>
            </td>
          </tr>
          <tr>
            <th scope="row" className="mono" data-label={d.cols.area}>
              {d.areas.stack}
            </th>
            <td data-label={d.cols.inst}>—</td>
            <td data-label={d.cols.course}>{stack}</td>
            <td className="mono" data-label={d.cols.status}>
              —
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

/** Captura real 16:10 do topo do site (scripts/capture-shots.mjs, 1440×900 @2x → 800/1600 px AVIF/WebP). */
export const shot = (p: (typeof PROJECTS)[number], w: 800 | 1600, ext: "webp" | "avif") => `${p.base}/v5/shot-${w}.${ext}`;

function ClientBody({ i }: { i: number }) {
  const { t, lang } = useLang();
  const c = t.about.clients;
  const p = PROJECTS[i];
  return (
    <div className="cl__body">
      <picture className="cl__pic">
        <source type="image/avif" srcSet={`${shot(p, 800, "avif")} 800w, ${shot(p, 1600, "avif")} 1600w`} sizes="(min-width: 1024px) 40vw, 92vw" />
        <source type="image/webp" srcSet={`${shot(p, 800, "webp")} 800w, ${shot(p, 1600, "webp")} 1600w`} sizes="(min-width: 1024px) 40vw, 92vw" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cl__img" src={shot(p, 800, "webp")} alt={`${p.name}: top of the live site`} width={800} height={500} loading="lazy" decoding="async" />
      </picture>
      <div className="cl__text">
        <p className="mono cl__kind">{p.kind[lang]}</p>
        <p className="mono cl__builtlabel">{c.built}</p>
        <p className="cl__built">{p.built[lang]}</p>
        <p className="mono cl__stack">{p.stack.join(" · ")}</p>
        <p className="cl__links mono">
          <a href={p.url} target="_blank" rel="noopener noreferrer">
            {c.live}
            <span className="sr-only"> {t.a11y.newTab}</span>
          </a>
          <TransitionLink href={`/works?view=list&filter=all#${p.slug}`}>{c.inWorks}</TransitionLink>
        </p>
      </div>
    </div>
  );
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Clientes (v5, item 13). ≥1024: abas horizontais (role tablist/tab/tabpanel, ativação automática): clique,
 * hover com intenção de 120 ms, ←/→ Home/End, Enter/Espaço; contador "05 / 08" + anterior/próximo; swipe no
 * toque. A coluna ativa cresce por grid-template-columns (uma transição de CSS, sem leituras de layout em JS).
 * <1024 e sem JS: acordeão empilhado (<details name> exclusivo) com a captura acima do texto.
 */
function Clients() {
  const { t, lang } = useLang();
  const c = t.about.clients;
  const n = PROJECTS.length;
  const [cols, setCols] = useState(false);
  const [on, setOn] = useState(0);
  const intent = useRef<number | undefined>(undefined);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const f = () => setCols(mq.matches);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  useEffect(() => () => window.clearTimeout(intent.current), []);
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current?.querySelector(`[data-i="${on}"] .cl__body`);
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(el, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out", delay: 0.15 });
  }, [on, cols]);
  const hover = (i: number) => {
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => setOn(i), 120);
  };
  const go = (i: number, focus = false) => {
    const k = (i + n) % n;
    setOn(k);
    if (focus) tabs.current[k]?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: on + 1, ArrowLeft: on - 1, Home: 0, End: n - 1 };
    if (!(e.key in map)) return;
    e.preventDefault();
    go(map[e.key], true);
  };
  // swipe (toque/caneta) na faixa de colunas
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    const s0 = swipe.current;
    swipe.current = null;
    if (!s0) return;
    const dx = e.clientX - s0.x;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - s0.y)) go(on + (dx < 0 ? 1 : -1));
  };
  return (
    <section className="cl" aria-labelledby="cl-title">
      <p className="mono cl__label">{c.label}</p>
      <div className="cl__head">
        <h2 className="cl__title" id="cl-title">
          {c.title}
        </h2>
        {cols && (
          <div className="cl__nav mono">
            <button type="button" className="cl__arrow" onClick={() => go(on - 1)} aria-label={c.prev}>
              ←
            </button>
            <span className="cl__count" aria-live="polite">
              {pad2(on + 1)} / {pad2(n)}
              <span className="sr-only">: {PROJECTS[on].name}</span>
            </span>
            <button type="button" className="cl__arrow" onClick={() => go(on + 1)} aria-label={c.next}>
              →
            </button>
          </div>
        )}
      </div>
      {cols ? (
        <div
          className="cl__cols"
          ref={bodyRef}
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={() => (swipe.current = null)}
          style={{ gridTemplateColumns: PROJECTS.map((_, i) => (i === on ? "5fr" : "1fr")).join(" ") }}
        >
          {/* v5.1: o tablist só contém as abas (subgrid nas mesmas colunas); o painel ativo é irmão, na linha 2 */}
          <div className="cl__tabs" role="tablist" aria-orientation="horizontal" aria-labelledby="cl-title" onKeyDown={onKey}>
            {PROJECTS.map((p, i) => (
              <button
                key={p.slug}
                ref={(el) => {
                  tabs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`cl-tab-${i}`}
                className="cl__col cl__btn"
                data-i={i}
                data-on={i === on}
                aria-selected={i === on}
                aria-controls={`cl-panel-${i}`}
                tabIndex={i === on ? 0 : -1}
                onClick={() => setOn(i)}
                onPointerEnter={(e) => e.pointerType === "mouse" && hover(i)}
              >
                <span className="mono cl__n">{p.n.slice(1)}</span>
                <span className="cl__name">{p.name}</span>
              </button>
            ))}
          </div>
          {PROJECTS.map((p, i) => (
            <div
              key={p.slug}
              id={`cl-panel-${i}`}
              role="tabpanel"
              aria-labelledby={`cl-tab-${i}`}
              className="cl__panel"
              data-i={i}
              hidden={i !== on}
              style={{ gridColumn: i + 1 }}
            >
              {i === on && <ClientBody i={i} />}
            </div>
          ))}
        </div>
      ) : (
        <div className="cl__acc" key={lang}>
          {PROJECTS.map((p, i) => (
            <details key={p.slug} name="clients" className="cl__det" open={i === 0}>
              <summary>
                <span className="mono cl__n">{p.n.slice(1)}</span>
                <span className="cl__name">{p.name}</span>
              </summary>
              <ClientBody i={i} />
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function MagBtn({ children, ...rest }: React.ComponentProps<"a">) {
  const ref = useRef<HTMLAnchorElement>(null);
  useMagnetic(ref, { radius: 120, max: 10, strength: 0.3 });
  return (
    <a ref={ref} {...rest}>
      {children}
    </a>
  );
}

function AboutCta() {
  const { t, lang } = useLang();
  const wrap = useRef<HTMLSpanElement>(null);
  useMagnetic(wrap, { radius: 120, max: 10, strength: 0.3 });
  return (
    <section className="acta" aria-label="Résumé">
      <span ref={wrap} className="acta__mag">
        <TransitionLink href="/curriculo" className="acta__btn mono">
          {t.about.cta.resume}
        </TransitionLink>
      </span>
      <MagBtn href={PDF[lang]} download className="acta__btn mono">
        {t.about.cta.pdf}
      </MagBtn>
    </section>
  );
}

export default function About() {
  return (
    <>
      <AboutHero />
      <EndToEnd />
      <EducationTable />
      <Clients />
      <AboutCta />
    </>
  );
}
