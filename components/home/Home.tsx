"use client";
// Home (etapa 4): hero DIAL + SINAL (HeroLayer no World) → o MESMO morph emblema → tela do reel → player RITO → footer.
// Sem WebGL: emblema + lista de projetos + palavras-chave estáticas. Reduced-motion: estado real estático.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addTick } from "@/lib/loop";
import { reducedMotion, tier } from "@/lib/motion";
import { ui } from "@/lib/store";
import { REEL, SITE } from "@/lib/site";
import { PROJECTS, cardTexture } from "@/lib/projects";
import { getWorld } from "@/lib/world/World";
import { HeroLayer } from "@/lib/world/HeroLayer";
import { HomeFooter } from "./HomeFooter";
import { openReel } from "@/components/shell/ReelPlayer";
import { Keyword } from "./Keyword";
import { DecryptedText } from "@/components/bits/DecryptedText";
import { SplitText } from "@/components/bits/SplitText";
import { useInProgress } from "@/components/bits/useInProgress";
import { SectionIndex } from "@/components/SectionIndex";

const INDEX = [
  { id: "signal", label: "Signal" },
  { id: "reel", label: "Reel" },
  { id: "contact", label: "Contact", goAt: 0.9 },
];

const KEYWORDS = ["Creative dev", "WebGL", "Motion", "Full-stack", "Automation", "GSAP / Three.js"];
// ângulos (graus, 0 = direita) e profundidade aparente de cada palavra em volta do emblema
const ORBIT = [
  { a: -150, d: 1.08 },
  { a: -30, d: 0.92 },
  { a: 180, d: 1.14 },
  { a: 0, d: 1.02 },
  { a: 150, d: 0.9 },
  { a: 30, d: 1.12 },
];

let layer: HeroLayer | null = null;

const tc = (s: number) => {
  const f = Math.floor((s % 1) * 24);
  const sec = Math.floor(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}:${p(f)}`;
};

export function Home() {
  const main = useRef<HTMLElement>(null);
  const reelRef = useRef<HTMLElement>(null);
  const router = useRouter();
  const [gl, setGl] = useState(false);
  const [stage, setStage] = useState(0);
  useInProgress(reelRef, undefined, 0.6);

  useEffect(() => {
    const el = main.current!;
    const reduced = reducedMotion();
    const t = tier();
    const world = t > 0 ? getWorld({ tier: t === 1 ? 1 : 2, reduced }) : null;
    const sticky = el.querySelector<HTMLElement>(".hero-sticky")!;
    const hud = el.querySelector<HTMLElement>(".reel-hud");
    const hit = el.querySelector<HTMLElement>(".reel-hit");
    const poster = el.querySelector<HTMLElement>(".reel-window");
    const tcEl = el.querySelector<HTMLElement>(".reel-tc");
    const keys = el.querySelector<HTMLElement>(".hero-keys");
    const kws = Array.from(el.querySelectorAll<HTMLElement>(".kw"));
    const tip = el.querySelector<HTMLElement>(".dial-tip");
    const frontEl = el.querySelector<HTMLElement>(".hero-front");
    const nameEl = el.querySelector<HTMLElement>(".hero-name");
    const heroEl = el.querySelector<HTMLElement>(".hero")!;
    const reelEl = el.querySelector<HTMLElement>(".reel-slot")!;
    const prox = { p: 0, q: 0 };
    const target = () => {
      const vh = innerHeight;
      const hr = heroEl.getBoundingClientRect();
      const rr = reelEl.getBoundingClientRect();
      return {
        p: Math.min(1, Math.max(0, -hr.top / Math.max(1, hr.height - vh))),
        q: Math.min(1, Math.max(0, (vh - rr.top) / Math.max(1, rr.height))),
      };
    };

    let hero: HeroLayer | null = null;
    let inView = true;
    const cleanups: (() => void)[] = [];
    if (world) {
      if (!layer) {
        layer = new HeroLayer(world, {
          reduced,
          lite: t === 1,
          videoSrc: REEL.src1080,
          projects: PROJECTS.map((p) => ({ slug: p.slug, name: p.name, texture: cardTexture(p) })),
        });
        world.addLayer(layer);
        void world.warm(layer, layer.warmList());
      }
      hero = layer;
      hero.reduced = reduced;
      hero.resetVisit();
      hero.object.visible = true;
      world.setMode("home");
      el.classList.add("home-gl");
      setGl(true);
      requestAnimationFrame(() => window.dispatchEvent(new Event("rito:ready")));
      const onResize = () => world.resize();
      window.addEventListener("resize", onResize);
      cleanups.push(() => window.removeEventListener("resize", onResize));

      // ponteiro no palco do hero: lente, arrasto do dial (horizontal), clique (monólito → painel; vazio → pulso)
      // toque: a lente aparece no ponto tocado; segurar ≥ 250 ms sem arrastar = lente segue o dedo;
      // arrasto horizontal rápido = girar o anel; vertical = rolagem nativa (touch-action: pan-y)
      let down: { x: number; y: number; t: number; mode: "pending" | "pending-mouse" | "ring" | "lens"; touch: boolean } | null = null;
      const onDown = (e: PointerEvent) => {
        if (e.button !== 0 || (e.target as HTMLElement).closest("button, a")) return;
        const touch = e.pointerType !== "mouse";
        down = { x: e.clientX, y: e.clientY, t: performance.now(), mode: touch ? "pending" : "pending-mouse", touch };
        if (touch) hero!.pointerPx(e.clientX, e.clientY, true, e.pointerType);
        // mouse: o arrasto só começa após 6 px (um clique curto nunca gira o anel)
      };
      const onMove = (e: PointerEvent) => {
        if (e.pointerType === "mouse") {
          hero!.pointerPx(e.clientX, e.clientY, true, e.pointerType);
          hero!.pointer((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2);
          hero!.setHover(e.clientX, e.clientY);
          if (down) {
            if (down.mode === "pending-mouse" && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= 6) {
              down.mode = "ring";
              hero!.dragStart(down.x);
              sticky.classList.add("is-dragging");
            }
            if (down.mode === "ring") hero!.dragMove(e.clientX);
          }
          return;
        }
        if (!down) return;
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (down.mode === "pending") {
          if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) && performance.now() - down.t < 250) {
            down.mode = "ring";
            hero!.dragStart(down.x);
          } else if (performance.now() - down.t >= 250) down.mode = "lens";
        }
        if (down.mode === "ring") hero!.dragMove(e.clientX);
        else hero!.pointerPx(e.clientX, e.clientY, true, e.pointerType);
      };
      const onUp = (e: PointerEvent) => {
        if (!down) return;
        const d = down;
        down = null;
        sticky.classList.remove("is-dragging");
        const moved = d.mode === "ring" ? hero!.dragEnd() : Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (e.type === "pointercancel") {
          if (d.mode === "ring") hero!.dragEnd();
          return;
        }
        if (d.touch) hero!.pointerPx(e.clientX, e.clientY, true, e.pointerType); // lente some ~1,2 s depois
        if (moved < 6 && performance.now() - d.t < 500) {
          const i = hero!.click(e.clientX, e.clientY);
          if (i >= 0) router.push(`/works/${PROJECTS[i].slug}/`);
        }
      };
      // toque longo vira lente: a partir daí o dedo não rola a página (touchmove ainda cancelável)
      const onTouchMove = (e: TouchEvent) => {
        if (down && down.touch && (down.mode === "lens" || (down.mode === "pending" && performance.now() - down.t >= 250)) && e.cancelable) e.preventDefault();
      };
      sticky.addEventListener("touchmove", onTouchMove, { passive: false });
      cleanups.push(() => sticky.removeEventListener("touchmove", onTouchMove));
      const onLeave = (e: PointerEvent) => {
        if (e.pointerType === "mouse") hero!.pointerPx(-999, -999, false, "mouse");
      };
      sticky.addEventListener("pointerdown", onDown);
      window.addEventListener("pointermove", onMove, { passive: true });
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      sticky.addEventListener("pointerleave", onLeave);
      cleanups.push(() => {
        sticky.removeEventListener("pointerdown", onDown);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        sticky.removeEventListener("pointerleave", onLeave);
      });
      // giroscópio opcional (sem pedir permissão)
      const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
      const onOri = (e: DeviceOrientationEvent) => hero!.pointer(Math.max(-1, Math.min(1, (e.gamma ?? 0) / 30)), Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 30)));
      if (DOE && typeof DOE.requestPermission !== "function" && matchMedia("(pointer: coarse)").matches) {
        window.addEventListener("deviceorientation", onOri);
        cleanups.push(() => window.removeEventListener("deviceorientation", onOri));
      }
      const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting));
      io.observe(el.querySelector(".home-stage")!);
      cleanups.push(() => io.disconnect());
    } else {
      window.dispatchEvent(new Event("rito:ready"));
    }

    let lastFront = -1;
    let lastStage = -1;
    const untick = addTick((_t, dt) => {
      const tg = target();
      const k = reduced ? 1 : 1 - Math.exp(-dt * 6);
      prox.p += (tg.p - prox.p) * k;
      prox.q += (tg.q - prox.q) * k;
      if (Math.abs(tg.p - prox.p) < 1e-4) prox.p = tg.p;
      if (Math.abs(tg.q - prox.q) < 1e-4) prox.q = tg.q;
      const p = prox.p;
      const q = prox.q;
      const st = p < 0.45 ? 0 : p < 0.8 ? 1 : 2;
      if (st !== lastStage) {
        lastStage = st;
        setStage(st);
      }
      if (!hero) return;
      const live3d = inView && !ui.get().reel;
      hero.active = live3d;
      hero.object.visible = live3d;
      hero.p = p;
      hero.q = q;
      // palavras-chave em órbita, em profundidades diferentes; somem antes das pétalas/morph
      const narrow = innerWidth < 768;
      const e = hero.embPx;
      const fade = 1 - Math.min(1, Math.max(0, (p - 0.28) / 0.2));
      if (keys) {
        keys.style.opacity = String(fade);
        keys.style.visibility = fade < 0.02 ? "hidden" : "visible";
        // 390: duas linhas acima do emblema, com fundo de contraste (não disputam com o monólito central)
        if (narrow) keys.style.transform = `translate3d(0, ${Math.round(Math.max(112, e.y - e.r - 104))}px, 0)`;
        else keys.style.transform = "";
      }
      if (!narrow)
        kws.forEach((w, i) => {
          const o = ORBIT[i];
          const a = (o.a * Math.PI) / 180;
          const R = e.r * 1.5 * o.d + 40;
          const px = e.x + Math.cos(a) * R + hero!.tilt.y * 18 * (o.d - 1) * 6;
          const py = e.y + Math.sin(a) * R * 0.78 + hero!.tilt.x * 12 * (o.d - 1) * 6;
          w.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) translate(-50%, -50%) scale(${o.d.toFixed(2)})`;
        });
      if (nameEl) nameEl.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.55) / 0.2)));
      if (frontEl && hero.front !== lastFront) {
        lastFront = hero.front;
        frontEl.textContent = `${String(hero.front + 1).padStart(2, "0")}/08 · ${PROJECTS[hero.front].name.toUpperCase()}`;
      }
      if (tip) {
        const i = hero.hoverIdx;
        tip.style.opacity = i >= 0 ? "1" : "0";
        if (i >= 0) {
          tip.textContent = `${String(i + 1).padStart(2, "0")}/08 · ${PROJECTS[i].name} — open →`;
          const pt = (hero as unknown as { ptr: { x: number; y: number } }).ptr;
          tip.style.transform = `translate3d(${pt.x + 18}px, ${pt.y + 14}px, 0)`;
        }
        // pointer só sobre o que é clicável (monólito); área vazia mantém o cursor padrão (a lente é o retorno visual)
        sticky.style.cursor = i >= 0 ? "pointer" : sticky.classList.contains("is-dragging") ? "grabbing" : "";
      }
      // reel
      const r = hero.rectPx;
      const on = reduced ? (q > 0.5 ? 1 : 0) : Math.min(1, Math.max(0, (q - 0.55) / 0.25));
      if (hit) {
        hit.style.left = `${r.x}px`;
        hit.style.top = `${r.y}px`;
        hit.style.width = `${r.w}px`;
        hit.style.height = `${r.h}px`;
        hit.style.opacity = String(on);
        hit.style.pointerEvents = on > 0.5 ? "auto" : "none";
      }
      if (hud) {
        hud.style.left = `${r.x - 18}px`;
        hud.style.top = `${r.y - 18}px`;
        hud.style.width = `${r.w + 36}px`;
        hud.style.height = `${r.h + 36}px`;
        hud.style.transform = `translate3d(${(hero.tilt.y * 10).toFixed(1)}px, ${(hero.tilt.x * 6).toFixed(1)}px, 0)`;
        hud.style.opacity = String(reduced ? on : Math.min(1, Math.max(0, (q - 0.45) / 0.3)));
      }
      if (poster) poster.classList.toggle("is-on", reduced && q > 0.5);
      if (tcEl && hero.video) tcEl.textContent = `TC ${tc(hero.video.currentTime)}`;
      const sr = el.querySelector<HTMLElement>(".home-stage")!.getBoundingClientRect();
      world!.canvas.style.opacity = String(Math.min(1, Math.max(0, sr.bottom / (innerHeight * 0.6))));
    });

    return () => {
      untick();
      cleanups.forEach((c) => c());
      if (hero) {
        hero.object.visible = false;
        hero.active = false;
      }
      if (world && world.mode === "home") world.setMode("off");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const STAGES = ["Signal · ASCII → real", "Dial · petals fall", "Emblem → reel"];

  return (
    <main id="main" tabIndex={-1} className="home" ref={main}>
      <div className="home-stage">
        <section className="hero" id="signal" aria-labelledby="hero-title" data-hero-scene>
          <div className="hero-sticky">
            {/* sem WebGL: emblema real + lista de projetos */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="hero-emblem" src="/brand/avatar-emblem.webp" alt="" aria-hidden="true" width={1024} height={1024} />
            <p className="hero-hud hl" aria-hidden="true">
              <span className="dot">●</span> REC · <span className="hero-front">01/08 · ORINOCO</span>
            </p>
            <p className="hero-hud hr" aria-hidden="true">
              {gl ? <DecryptedText key={stage} text={STAGES[stage]} animateOn="view" speed={36} /> : STAGES[0]}
            </p>
            <ul className="hero-keys" aria-label="What I do">
              {KEYWORDS.map((k, i) => (
                <li key={k}>
                  <Keyword label={k} index={i} />
                </li>
              ))}
            </ul>
            <div className="dial-tip" aria-hidden="true" />
            <div className="hero-name">
              <h1 id="hero-title">
                <SplitText tag="span" text="Lucas" className="grot" /> <span className="black">Melo</span>
              </h1>
              <p className="hero-support">{SITE.support}</p>
            </div>
            <nav className="dial-nav" aria-label="Projects on the dial">
              <ol>
                {PROJECTS.map((p, i) => (
                  <li key={p.slug}>
                    <a href={`/works/${p.slug}/`} onFocus={() => layer?.goTo(i)}>
                      <span className="n">{p.n}</span> {p.name}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
            <p className="hero-hint" aria-hidden="true">
              Drag the dial · click a monolith · scroll ↓
            </p>
          </div>
        </section>

        <section className="reel-slot sx" id="reel" ref={reelRef} aria-labelledby="reel-title">
          <div className="reel-sticky">
            <h2 id="reel-title" className="sr-only">
              Showreel
            </h2>
            <div className="reel-window">
              <picture>
                <source media="(min-width: 1921px)" srcSet={REEL.poster[3840]} />
                <source media="(min-width: 829px)" srcSet={REEL.poster[1920]} />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={REEL.poster[828]} alt="" className="reel-poster" width={1920} height={1080} loading="lazy" />
              </picture>
            </div>
            {gl && (
              <div className="reel-hud" aria-hidden="true">
                <span className="c tl" />
                <span className="c tr" />
                <span className="c bl" />
                <span className="c br" />
                <span className="lbl l1">[ REEL — 2026 ]</span>
                <span className="lbl l2">
                  <i /> REC · <span className="reel-tc">TC 00:00:00:00</span>
                </span>
                <span className="lbl l3">{REEL.duration} · 8 LIVE PROJECTS · NO SOUND</span>
              </div>
            )}
            <button
              type="button"
              className="reel-hit"
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                openReel({ x: r.left, y: r.top, w: r.width, h: r.height }, layer?.video?.currentTime ?? 0);
              }}
            >
              <span className="reel-play">[ Play reel ]</span>
              <span className="sr-only"> — opens the showreel player in full screen</span>
            </button>
            <div className="reel-copy">
              <p className="reel-desc">{REEL.transcript}</p>
              <p className="reel-alt">
                <a href={REEL.src1080}>Open the video file (MP4, 1080p)</a>
              </p>
            </div>
          </div>
        </section>
      </div>
      <HomeFooter />
      <SectionIndex items={INDEX} />
    </main>
  );
}
