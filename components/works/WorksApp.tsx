"use client";
// Works (PROMPT-MESTRE §7): Featured (arco WebGL), Full (portal + índice), painel em /works/[slug].
// Mora em app/works/layout.tsx, então persiste entre /works, /works/full e /works/[slug]; o estado vem da URL
// (pushState no clique, botão voltar fecha). Sem WebGL (T0 ou ?webgl=0): grade/lista/painel em DOM puro.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pic } from "@/components/Pic";
import { Panel, type PanelPhase } from "@/components/works/Panel";
import { actions, ui, useUI } from "@/lib/store";
import { reducedMotion, tier } from "@/lib/motion";
import { PROJECTS, TAG_LABEL, TOTAL, bySlug, cardTexture, indexOf, videoSrc } from "@/lib/projects";
import { getWorld, type LabelPt, type World } from "@/lib/world/World";
import { addTick } from "@/lib/loop";
import { gsap } from "gsap";

type View = "featured" | "full";
function parse(path: string | null): { view: View; slug: string | null } {
  const p = (path ?? "/works").replace(/\/+$/, "");
  if (p.endsWith("/works/full")) return { view: "full", slug: null };
  const m = p.match(/\/works\/([^/]+)$/);
  if (m && bySlug(m[1])) return { view: "featured", slug: m[1] };
  return { view: "featured", slug: null };
}

const panelRect = () => {
  const inset = window.innerWidth < 768 ? 20 : 18;
  return { x: inset, y: inset, w: window.innerWidth - inset * 2, h: window.innerHeight - inset * 2 };
};

export function WorksApp() {
  const pathname = usePathname();
  const { view, slug } = parse(pathname);
  const [gl, setGl] = useState(false);
  const [panelSlug, setPanelSlug] = useState<string | null>(slug);
  const [phase, setPhase] = useState<PanelPhase>("shown");
  const [instant, setInstant] = useState(true);
  const [fullIn, setFullIn] = useState(view === "full");
  const [hoverName, setHoverName] = useState(-1);
  const [live, setLive] = useState("");
  const overlay = useUI((s) => s.menu || s.reel || s.profile);

  const world = useRef<World | null>(null);
  const labels = useRef<(HTMLAnchorElement | null)[]>([]);
  const arrows = useRef<(HTMLSpanElement | null)[]>([]);
  const prev = useRef<{ view: View; slug: string | null } | null>(null);
  const pendingUV = useRef<{ i: number; uv: import("three").Vector2 | null } | null>(null);
  const openedFrom = useRef<View>("featured");
  const busy = useRef(false);
  const mirror = useRef<HTMLElement>(null);
  const userMoved = useRef(false);
  const stage = useRef<HTMLDivElement>(null);

  // ---- montagem: mundo WebGL (T1/T2) ou DOM puro (T0) ----
  useEffect(() => {
    const html = document.documentElement;
    html.classList.add("route-works");
    const t = tier();
    let w: World | null = null;
    if (t > 0) {
      w = getWorld({ tier: t === 1 ? 1 : 2, reduced: reducedMotion() });
      if (w && !w.cards.length) {
        w.setItems(PROJECTS.map((p) => ({ slug: p.slug, texture: cardTexture(p), videos: videoSrc(p).filter((s) => !s.media) })));
      }
    }
    if (w) {
      world.current = w;
      w.reduced = reducedMotion();
      w.pointer.fine = matchMedia("(pointer: fine)").matches;
      w.onLost = () => {
        html.classList.remove("gl");
        w?.setMode("off");
        world.current = null;
        setGl(false);
      };
      w.onCenter = (i) => {
        if (userMoved.current) setLive(`Project ${i + 1} of ${TOTAL}: ${PROJECTS[i].name}`);
      };
      w.onLabels = (pts: LabelPt[]) => {
        pts.forEach((p, i) => {
          const a = labels.current[i];
          const r = arrows.current[i];
          if (a) {
            a.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translateY(-100%) scale(${p.scale.toFixed(3)})`;
            a.style.opacity = p.visible ? "1" : "0";
            a.style.pointerEvents = p.visible ? "auto" : "none";
          }
          if (r) {
            r.style.transform = `translate3d(${p.rx.toFixed(1)}px, ${p.ry.toFixed(1)}px, 0) translate(-100%, -100%) scale(${p.scale.toFixed(3)})`;
            r.style.opacity = p.visible ? "1" : "0";
          }
        });
      };
      html.classList.add("gl-ready");
      setGl(true);
      const { view: v0, slug: s0 } = parse(window.location.pathname);
      if (s0) w.goTo(indexOf(s0), true);
      w.setMode(v0 === "full" ? "full" : "featured", !!s0);
      if (v0 === "full") w.portalTo(true, 0);
      if (s0) {
        w.openCard(indexOf(s0), null, panelRect(), { instant: true });
        w.covered = true;
      }
    }
    const onResize = () => {
      world.current?.resize();
    };
    const onVis = () => {
      if (!world.current) return;
      if (document.hidden) world.current.pauseVideos();
      else world.current.resumeVideos();
    };
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      html.classList.remove("route-works", "gl-ready");
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVis);
      if (w) {
        w.onLabels = undefined;
        w.onCenter = undefined;
        w.thumbReset();
        w.portalTo(false, 0);
        if (w.openIndex >= 0) {
          w.closeCard();
        }
        w.setMode("off");
      }
      world.current = null;
      ui.set({ works: null, panel: null });
    };
  }, []);

  // ---- abrir / fechar / trocar / portal: tudo derivado da URL ----
  const closeTo = useCallback(() => {
    const target = openedFrom.current === "full" ? "/works/full/" : "/works/";
    window.history.pushState(null, "", target);
  }, []);

  useEffect(() => {
    actions.closePanel = closeTo;
    return () => void (actions.closePanel = undefined);
  }, [closeTo]);

  useEffect(() => {
    const before = prev.current;
    prev.current = { view, slug };
    ui.set({ works: view, panel: slug });
    const w = world.current;
    const reduced = reducedMotion();
    const p = slug ? bySlug(slug) : null;
    document.title = p ? `${p.name} — Lucas Melo` : view === "full" ? "Works, full index — Lucas Melo" : "Works — Lucas Melo";
    if (!before) {
      // primeira montagem: estado já aplicado no efeito acima (abre sem animação; fade 0,3 s)
      if (slug) {
        setInstant(true);
        setPhase("in");
      }
      return;
    }
    const focusTitle = () => requestAnimationFrame(() => document.getElementById("project-title")?.focus({ preventScroll: true }));

    // trocar painel (próximo projeto)
    if (before.slug && slug && before.slug !== slug) {
      if (w && openedFrom.current === "featured") w.swapOpen(indexOf(slug), panelRect());
      setPanelSlug(slug);
      setInstant(false);
      setPhase("in");
      focusTitle();
      return;
    }
    // abrir
    if (!before.slug && slug) {
      const i = indexOf(slug);
      busy.current = true;
      openedFrom.current = before.view;
      const pend = pendingUV.current;
      pendingUV.current = null;
      setPanelSlug(slug);
      const show = () => {
        setInstant(false);
        setPhase("in");
        busy.current = false;
        if (w) w.covered = true;
        focusTitle();
      };
      if (w && !reduced) {
        setPhase("out"); // painel montado porém invisível até a carta chegar ao retângulo
        if (before.view === "full") {
          setFullIn(false);
          if (w.thumb.a < 0.05) {
            w.thumbTarget(window.innerWidth / 2, window.innerHeight / 2);
            w.thumb.x = window.innerWidth / 2;
            w.thumb.y = window.innerHeight / 2;
          }
          w.thumbShow(i);
          w.thumbToPanel(panelRect()).then(show);
        } else w.openCard(i, pend?.uv ?? null, panelRect()).then(show);
      } else {
        if (w && before.view === "featured") w.openCard(i, null, panelRect(), { instant: true });
        if (before.view === "full") setFullIn(false);
        setInstant(true);
        setPhase("in");
        busy.current = false;
        focusTitle();
      }
      return;
    }
    // fechar
    if (before.slug && !slug) {
      const i = indexOf(before.slug);
      busy.current = true;
      setPhase("out");
      const done = () => {
        setPanelSlug(null);
        busy.current = false;
        if (view === "featured") requestAnimationFrame(() => labels.current[i]?.focus({ preventScroll: true }));
      };
      if (w) {
        w.covered = false;
        if (view === "full") {
          w.thumbReset();
          setTimeout(() => {
            setFullIn(true);
            done();
          }, reduced ? 200 : 350);
        } else {
          w.closeCard().then(done);
        }
      } else {
        if (view === "full") setFullIn(true);
        setTimeout(done, 200);
      }
      return;
    }
    // Featured ↔ Full (portal-lente 0,4 s)
    if (before.view !== view && !slug) {
      if (view === "full") {
        if (w) {
          w.setMode("full");
          w.portalTo(true).then(() => setFullIn(true));
        } else setFullIn(true);
      } else {
        setFullIn(false);
        w?.thumbShow(-1);
        if (w) {
          w.mode = "featured";
          w.portalTo(false).then(() => w.resumeVideos());
        }
      }
    }
  }, [view, slug]);

  // ---- entrada: wheel / drag / clique / teclado ----
  useEffect(() => {
    if (!gl) return;
    const el = stage.current;
    const w = world.current;
    if (!el || !w) return;
    let down: { x: number; y: number; t: number; id: number } | null = null;
    let moved = false;
    const axisP = (e: PointerEvent) => (w.L.axis === 0 ? e.clientX : e.clientY);

    const onWheel = (e: WheelEvent) => {
      if (ui.get().panel || ui.get().menu || ui.get().reel || ui.get().profile) return;
      if (parse(window.location.pathname).view !== "featured") return;
      e.preventDefault();
      userMoved.current = true;
      const k = e.deltaMode === 1 ? 16 : 1;
      w.wheel(e.deltaX * k, e.deltaY * k);
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || ui.get().panel) return;
      down = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      moved = false;
      if (parse(window.location.pathname).view === "featured") {
        w.dragStart(axisP(e));
        el.setPointerCapture(e.pointerId);
        document.documentElement.classList.add("grabbing");
      }
    };
    const onMove = (e: PointerEvent) => {
      w.setPointer(e.clientX, e.clientY, true);
      if (!down) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) moved = true;
      if (moved) {
        userMoved.current = true;
        w.dragMove(axisP(e));
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      document.documentElement.classList.remove("grabbing");
      const wasClick = !moved && performance.now() - down.t < 600;
      down = null;
      if (wasClick) {
        w.dragging = false;
        const hit = w.pick(e.clientX, e.clientY);
        if (hit) openProject(hit.i, hit.uv);
        else w.snap();
      } else w.dragEnd();
    };
    const onLeave = () => w.setPointer(-1, -1, false);
    const onKey = (e: KeyboardEvent) => {
      const s = ui.get();
      if (s.menu || s.reel || s.profile || s.panel) return;
      if (parse(window.location.pathname).view !== "featured") return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const vertical = w.L.axis === 1;
      const prevK = vertical ? ["ArrowUp", "ArrowLeft"] : ["ArrowLeft"];
      const nextK = vertical ? ["ArrowDown", "ArrowRight"] : ["ArrowRight"];
      let i = w.centerIndex;
      if (prevK.includes(e.key)) i--;
      else if (nextK.includes(e.key)) i++;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = TOTAL - 1;
      else if (e.key === "Enter" && !(t instanceof HTMLAnchorElement) && !(t instanceof HTMLButtonElement)) {
        e.preventDefault();
        openProject(w.centerIndex, null);
        return;
      } else return;
      e.preventDefault();
      userMoved.current = true;
      w.goTo(Math.max(0, Math.min(TOTAL - 1, i)));
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // Esc fecha o painel (Shell trata menu/reel/profile)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = ui.get();
      if (s.menu || s.reel || s.profile) return;
      if (s.panel) closeTo();
      else if (parse(window.location.pathname).view === "full") window.history.pushState(null, "", "/works/");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeTo]);

  const openProject = (i: number, uv: import("three").Vector2 | null) => {
    if (busy.current || ui.get().panel) return;
    pendingUV.current = { i, uv };
    window.history.pushState(null, "", `/works/${PROJECTS[i].slug}/`);
  };

  const onNext = useCallback(() => {
    const p = bySlug(ui.get().panel);
    if (!p || busy.current) return;
    busy.current = true;
    setPhase("next-out");
    const nxt = PROJECTS[(indexOf(p.slug) + 1) % TOTAL];
    setTimeout(
      () => {
        busy.current = false;
        window.history.pushState(null, "", `/works/${nxt.slug}/`);
      },
      reducedMotion() ? 200 : 350
    );
  }, []);

  // ---- Full: miniatura segue o cursor; arrastar gira em 3D ----
  const fullMove = (e: React.PointerEvent) => {
    const w = world.current;
    if (!w) return;
    w.thumbTarget(e.clientX, e.clientY - 20);
    if (e.buttons === 1 && !reducedMotion()) {
      w.thumb.rotDrag.y = Math.max(-0.35, Math.min(0.35, w.thumb.rotDrag.y + e.movementX * 0.006));
      w.thumb.rotDrag.x = Math.max(-0.35, Math.min(0.35, w.thumb.rotDrag.x - e.movementY * 0.006));
    }
  };

  // 15/11 — modo 2D (sem WebGL / aceleração de hardware desligada): a grade ganha vida em DOM —
  // entrada escalonada em 3D, inclinação pelo ponteiro (mouse), dobra pela velocidade da rolagem e paralaxe da imagem.
  useEffect(() => {
    const sec = mirror.current;
    if (gl || !sec || !document.documentElement.classList.contains("m2d")) return;
    sec.classList.add("m2-works");
    const cards = Array.from(sec.querySelectorAll<HTMLElement>(".mirror-card"));
    const pics = cards.map((c) => c.querySelector<HTMLElement>(".mirror-pic img"));
    gsap.fromTo(
      cards,
      { opacity: 0, y: 70, rotateX: -28, transformOrigin: "50% 0%" },
      { opacity: 1, y: 0, rotateX: 0, duration: 1.1, ease: "expo.out", stagger: 0.07, delay: 0.15, clearProps: "opacity,transform" }
    );
    const tilt = cards.map(() => ({ x: 0, y: 0, tx: 0, ty: 0 }));
    const fine = matchMedia("(pointer: fine)").matches;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cards.forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        tilt[i].tx = inside ? ((e.clientY - r.top) / r.height - 0.5) * -10 : 0;
        tilt[i].ty = inside ? ((e.clientX - r.left) / r.width - 0.5) * 12 : 0;
      });
    };
    const onLeave = () => tilt.forEach((t) => (t.tx = t.ty = 0));
    if (fine) {
      sec.addEventListener("pointermove", onMove, { passive: true });
      sec.addEventListener("pointerleave", onLeave);
    }
    let last = sec.scrollTop;
    let vel = 0;
    const untick = addTick((_t, dt) => {
      if (document.hidden) return;
      const st = sec.scrollTop;
      const v = (st - last) / Math.max(dt, 1 / 120);
      last = st;
      vel += (v - vel) * Math.min(1, dt * 8);
      const bend = Math.max(-7, Math.min(7, vel * 0.006));
      const vh = sec.clientHeight;
      cards.forEach((c, i) => {
        const t = tilt[i];
        t.x += (t.tx - t.x) * Math.min(1, dt * 9);
        t.y += (t.ty - t.y) * Math.min(1, dt * 9);
        const r = c.getBoundingClientRect();
        if (r.bottom < -50 || r.top > vh + 150) return;
        c.style.transform = `perspective(900px) rotateX(${(t.x - bend).toFixed(2)}deg) rotateY(${t.y.toFixed(2)}deg)`;
        const img = pics[i];
        if (img) {
          const off = (r.top + r.height / 2 - vh / 2) / vh; // -1..1
          img.style.transform = `translate3d(${(t.y * -0.8).toFixed(1)}px, ${(off * -14).toFixed(1)}px, 0) scale(1.12)`;
        }
      });
    });
    return () => {
      untick();
      sec.removeEventListener("pointermove", onMove);
      sec.removeEventListener("pointerleave", onLeave);
      sec.classList.remove("m2-works");
      cards.forEach((c) => (c.style.transform = ""));
      pics.forEach((p) => p && (p.style.transform = ""));
    };
  }, [gl]);

  const panelProject = bySlug(panelSlug);
  const featuredHidden = view !== "featured";

  return (
    <div className={`works view-${view}${overlay ? " has-overlay" : ""}`}>
      <h1 className="sr-only">{view === "full" ? "Works — full index" : "Works — featured projects"}</h1>

      {/* espelho DOM: visível no T0 (sem WebGL/JS); com WebGL os rótulos projetados assumem o papel */}
      <section ref={mirror} className="works-mirror" aria-label="Featured projects" hidden={featuredHidden && gl}>
        <ol>
          {PROJECTS.map((p) => (
            <li key={p.slug}>
              <Link href={`/works/${p.slug}/`} className="mirror-card" scroll={false}>
                <Pic project={p} shot={p.shots[0]} sizes="(max-width: 767px) calc(100vw - 40px), 33vw" alt="" className="mirror-pic" fallbackWidth={828} />
                <span className="mirror-n">{p.n}</span>
                <span className="mirror-name">{p.name}</span>
                <span className="mirror-meta">
                  {p.year} · {p.tags.map((t) => TAG_LABEL[t]).join(" · ")}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {gl && (
        <>
          <div ref={stage} className="works-stage" aria-hidden="true" hidden={featuredHidden} />
          <div className="card-labels" hidden={featuredHidden}>
            {PROJECTS.map((p, i) => (
              <a
                key={p.slug}
                ref={(el) => void (labels.current[i] = el)}
                href={`/works/${p.slug}/`}
                className="card-label"
                aria-label={`${p.name} — project ${i + 1} of ${TOTAL}`}
                onFocus={() => {
                  userMoved.current = true;
                  world.current?.goTo(i);
                }}
                onClick={(e) => {
                  e.preventDefault();
                  openProject(i, null);
                }}
              >
                {p.name}
              </a>
            ))}
            {PROJECTS.map((p, i) => (
              <span key={p.slug} ref={(el) => void (arrows.current[i] = el)} className="card-arrow" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="9" height="9">
                  <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
                </svg>
              </span>
            ))}
          </div>
        </>
      )}

      <section
        className={`works-full${fullIn ? " is-in" : ""}`}
        aria-label="Full index"
        hidden={view !== "full"}
        onPointerMove={fullMove}
        onPointerLeave={() => {
          setHoverName(-1);
          world.current?.thumbShow(-1);
        }}
      >
        <ul className={hoverName >= 0 ? "has-hover" : ""}>
          {PROJECTS.map((p, i) => (
            <li key={p.slug} className={hoverName === i ? "is-hover" : ""}>
              <span className="mask">
                <a
                  href={`/works/${p.slug}/`}
                  onPointerEnter={(e) => {
                    setHoverName(i);
                    world.current?.thumbTarget(e.clientX, e.clientY - 20);
                    if (e.pointerType === "mouse") world.current?.thumbShow(i);
                  }}
                  onFocus={() => setHoverName(i)}
                  onBlur={() => setHoverName(-1)}
                  onClick={(e) => {
                    e.preventDefault();
                    openProject(i, null);
                  }}
                  style={{ transitionDelay: `${i * 0.03}s` }}
                >
                  {p.name}
                </a>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="sr-only" aria-live="polite">
        {live}
      </p>

      {panelProject && (
        <Panel key={panelProject.slug} project={panelProject} phase={phase} instant={instant} onClose={closeTo} onNext={onNext} />
      )}
    </div>
  );
}
