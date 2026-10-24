"use client";
// /works (parecer v4 §6): aplicação de uma tela em GRADE (Lenis parado, a grade consome wheel/pointer) e documento
// rolável em LISTA. Estado na URL (?view=grid|list&filter=all|web|motion|3d) via replaceState. Sem JS: a lista.
// GRID↔LIST com clones 2D (Flip.fit) porque Flip sobre preserve-3d não é confiável; reduced = crossfade 150 ms.
import { useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/i18n/provider";
import { useTier, useTierGuard } from "@/lib/tier";
import { gsap, Flip, isReduced, ScrollTrigger } from "@/lib/gsap";
import { getLenis, holdScroll, releaseScroll } from "@/lib/lenis-store";
import { fmt } from "@/lib/i18n/dict";
import { countFor, filterProjects, FILTERS, frame, PROJECTS, TAG_LABEL, type Filter, type Project } from "@/lib/projects";
import CurvedGrid, { type GridApi } from "./CurvedGrid";
import WorksList, { type ListApi } from "./WorksList";
import Scramble from "../Scramble";
import { useSlideBar } from "@/lib/slidebar";
import SiteFooter from "../SiteFooter";

type View = "grid" | "list";
const pad = (n: number) => String(n).padStart(3, "0");

function clone(src: string, r: DOMRect) {
  const d = document.createElement("div");
  d.className = "flip-clone";
  Object.assign(d.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  const im = document.createElement("img");
  im.src = src;
  im.alt = "";
  d.appendChild(im);
  document.body.appendChild(d);
  return d;
}

export default function WorksApp() {
  const { t, lang } = useLang();
  const w = t.works;
  const tier = useTier();
  const [view, setView] = useState<View>("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<{ p: Project | null; i: number }>({ p: null, i: -1 });
  const [entrance, setEntrance] = useState<"full" | "short" | "fade">("full");
  const [announce, setAnnounce] = useState("");
  const grid = useRef<GridApi>(null);
  const list = useRef<ListApi>(null);
  const busy = useRef(false);
  const viewRef = useRef<HTMLDivElement>(null);
  useSlideBar(viewRef, view);
  const pending = useRef<{ kind: "toList" | "toGrid"; clones: { slug: string; el: HTMLElement }[] } | null>(null);
  const projects = useMemo(() => filterProjects(filter), [filter]);
  const visible = useMemo(() => new Set(projects.map((p) => p.slug)), [projects]);

  // estado inicial pela URL
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const v = q.get("view");
    const f = q.get("filter") as Filter | null;
    setView(v === "grid" || v === "list" ? v : isReduced() ? "list" : "grid");
    if (f && FILTERS.includes(f)) setFilter(f);
    setReady(true);
  }, []);

  // /works?view=list#slug (links do /about): rola até a linha
  useEffect(() => {
    if (!ready || view !== "list" || !location.hash) return;
    const id = decodeURIComponent(location.hash.slice(1));
    const t0 = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (!el) return;
      const l = getLenis();
      if (l) l.scrollTo(el, { offset: -80, immediate: true, force: true });
      else el.scrollIntoView();
    }, 350);
    return () => window.clearTimeout(t0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // URL ← estado (sem navegação)
  useEffect(() => {
    if (!ready) return;
    const u = new URL(location.href);
    u.searchParams.set("view", view);
    u.searchParams.set("filter", filter);
    u.searchParams.delete("lang");
    if (u.href !== location.href) history.replaceState(history.state, "", u);
  }, [view, filter, ready]);

  // modo grade: Lenis parado e documento sem scroll
  useEffect(() => {
    if (!ready || view !== "grid") return;
    const html = document.documentElement;
    window.scrollTo(0, 0);
    getLenis()?.scrollTo(0, { immediate: true, force: true });
    holdScroll("works-grid");
    html.classList.add("works-grid");
    return () => {
      html.classList.remove("works-grid");
      releaseScroll("works-grid");
      ScrollTrigger.refresh();
    };
  }, [view, ready]);

  useTierGuard(ready && view === "grid", "grid");

  // anúncio do ativo
  useEffect(() => {
    const p = active.p;
    if (!p) return;
    setAnnounce(fmt(w.announce, { name: p.name, year: p.year, tags: p.tags.map((x) => TAG_LABEL[x]).join(", ") }));
  }, [active.p, w.announce]);

  // fim das trocas com clones
  useEffect(() => {
    const pd = pending.current;
    if (!pd) return;
    if (pd.kind === "toList" && view === "list") {
      pending.current = null;
      requestAnimationFrame(() => {
        const root = list.current?.root();
        root?.classList.add("is-flipping");
        pd.clones.forEach((c, i) => {
          const th = list.current?.thumbFor(c.slug);
          if (th) Flip.fit(c.el, th, { duration: 0.7, ease: "expo.inOut", delay: 0.1 + i * 0.04, absolute: true });
        });
        const masks = root?.querySelectorAll(".wl__row:not([style*='none']) .wl__mask > *");
        if (masks?.length) {
          gsap.fromTo(
            masks,
            { yPercent: 100 },
            { yPercent: 0, duration: 0.7, ease: "expo.out", stagger: 0.05, delay: 0.35, clearProps: "transform" },
          );
        }
        window.setTimeout(() => {
          pd.clones.forEach((c) => c.el.remove());
          root?.classList.remove("is-flipping");
          ScrollTrigger.refresh();
          busy.current = false;
        }, 100 + pd.clones.length * 40 + 720);
      });
    } else if (pd.kind === "toGrid" && view === "grid") {
      pending.current = null;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          pd.clones.forEach((c, i) => {
            const r = grid.current?.rectFor(c.slug);
            if (!r) {
              gsap.to(c.el, { opacity: 0, duration: 0.3, onComplete: () => c.el.remove() });
              return;
            }
            gsap.to(c.el, {
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
              duration: 0.6,
              ease: "expo.inOut",
              delay: i * 0.03,
              onComplete: () => {
                gsap.to(c.el, { opacity: 0, duration: 0.2, onComplete: () => c.el.remove() });
              },
            });
          });
          window.setTimeout(() => {
            busy.current = false;
          }, 850);
        }),
      );
    }
  }, [view]);

  const switchView = async (next: View) => {
    if (busy.current || next === view) return;
    busy.current = true;
    const main = document.querySelector<HTMLElement>("main.works");
    if (isReduced()) {
      await gsap.to(main, { opacity: 0, duration: 0.15, ease: "none" });
      setEntrance("fade");
      setView(next);
      requestAnimationFrame(() => {
        gsap.to(main, { opacity: 1, duration: 0.15, ease: "none", clearProps: "opacity" });
        busy.current = false;
      });
      return;
    }
    if (next === "list") {
      const items = projects.map((p) => ({ p, r: grid.current?.rectFor(p.slug) ?? null })).filter((x) => x.r && x.r.width > 0);
      const clones = items.map((x) => ({ slug: x.p.slug, el: clone(frame(x.p, "shot"), x.r!) }));
      await grid.current?.exit(300);
      pending.current = { kind: "toList", clones };
      setView("list");
    } else {
      window.scrollTo(0, 0);
      getLenis()?.scrollTo(0, { immediate: true, force: true });
      await new Promise((r) => requestAnimationFrame(r));
      const clones = projects
        .map((p) => {
          const th = list.current?.thumbFor(p.slug);
          const r = th?.getBoundingClientRect();
          return r && r.bottom > 0 && r.top < window.innerHeight ? { slug: p.slug, el: clone(frame(p, "shot"), r) } : null;
        })
        .filter((x): x is { slug: string; el: HTMLDivElement } => !!x);
      const rows = list.current?.root()?.querySelectorAll(".wl__row, .wl__head");
      if (rows) await gsap.to(rows, { opacity: 0, duration: 0.25, ease: "none" });
      pending.current = { kind: "toGrid", clones };
      setEntrance("fade");
      setView("grid");
    }
  };

  const changeFilter = (f: Filter) => {
    if (f === filter) return;
    setFilter(f);
  };

  const total = projects.length;
  const idx = active.p ? projects.indexOf(active.p) + 1 : 0;

  return (
    <>
      <main id="content" tabIndex={-1} className="works" data-view={view} data-ready={ready}>
        <header className="works__head">
          <h1 className="works__h1" tabIndex={-1}>
            <span className="black">{w.h1}</span>
            <span className="works__h1n mono">({String(total).padStart(2, "0")})</span>
          </h1>
        </header>
        {ready && view === "grid" && (
          <section className="works__gridwrap" aria-label={w.index}>
            <CurvedGrid
              ref={grid}
              projects={projects}
              tier={tier}
              entrance={entrance}
              hint={w.hint}
              hintTouch={w.hintTouch}
              onActive={(p, i) => setActive({ p, i })}
            />
            <div className="hud">
              <div className="hud__center" aria-hidden="true">
                <span className="hud__name">{active.p ? `${active.p.name.toUpperCase()} · ${active.p.year}` : ""}</span>
                <span className="hud__stack mono">{active.p ? active.p.stack.join(" · ") : ""}</span>
              </div>
              <p className="hud__count mono" aria-hidden="true">
                <Scramble text={`↳ ${pad(idx)} / ${pad(total)}`} />
              </p>
              <nav className="hud__index" aria-label={w.index}>
                <ul>
                  {projects.map((p) => (
                    <li key={p.slug}>
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hud__idx mono"
                        onFocus={() => grid.current?.focusProject(p.slug)}
                      >
                        {p.n} {p.name} — {w.open}
                        <span className="sr-only"> {t.a11y.newTab}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <p className="sr-only" aria-live="polite">
                {announce}
              </p>
            </div>
          </section>
        )}
        {view === "list" && (
          <section className="works__list" aria-label={w.view.list}>
            <WorksList ref={list} visible={visible} tier={tier} key={lang === "pt" ? "l-pt" : "l-en"} />
          </section>
        )}
      </main>
      {view === "list" && <SiteFooter />}
      <div className="works-bar" role="toolbar" aria-label={`${w.filters.label} · ${w.view.label}`}>
        <div className="wb__filters" role="group" aria-label={w.filters.label}>
          {FILTERS.map((f) => (
            <button key={f} type="button" className="wb__f mono" aria-pressed={filter === f} onClick={() => changeFilter(f)}>
              <span className="wb__dot" aria-hidden="true" />
              {w.filters[f]} ({String(countFor(f)).padStart(2, "0")})
            </button>
          ))}
        </div>
        <div className="wb__right">
          <span className="wb__count mono" aria-hidden="true">
            {String(total).padStart(2, "0")} / {String(PROJECTS.length).padStart(2, "0")}
          </span>
          <div className="lt wb__view" role="group" aria-label={w.view.label} ref={viewRef}>
            <span aria-hidden="true">[</span>
            <button type="button" className="lt__btn wb__vbtn" aria-pressed={view === "grid"} onClick={() => switchView("grid")}>
              {w.view.grid}
            </button>
            <span aria-hidden="true">/</span>
            <button type="button" className="lt__btn wb__vbtn" aria-pressed={view === "list"} onClick={() => switchView("list")}>
              {w.view.list}
            </button>
            <span aria-hidden="true">]</span>
            <span className="lt__bar" aria-hidden="true" />
          </div>
        </div>
      </div>
    </>
  );
}
