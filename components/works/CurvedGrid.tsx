"use client";
// Grade curva 2.5D em CSS 3D (parecer v4 §6.2; geometria medida no Kavieng e escalada por s): loop infinito,
// wheel + drag (inércia ao soltar) + teclado, um único ticker do GSAP escreve os transforms e PARA em repouso.
// Distribuição em quadrado latino nos índices virtuais (coeficientes por P em coeffs()).
// Tier low: plana (translate 2D, sem perspective). Tier high: blur de borda quantizado em 4 classes.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "@/lib/gsap";
import type { Tier } from "@/lib/tier";
import { frame, shotSet, VARIANTS, videoSrc, type Project } from "@/lib/projects";

export type GridApi = {
  rectFor: (slug: string) => DOMRect | null;
  exit: (dur?: number) => Promise<void>;
  focusProject: (slug: string) => void;
};

type Geo = {
  s: number;
  W: number;
  H: number;
  pX: number;
  pY: number;
  cols: number;
  rows: number;
  Rh: number;
  Rv: number;
  zBase: number;
  persp: number;
  touch: boolean;
};

function geometry(): Geo {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const touch = vw < 768 || window.matchMedia("(hover: none), (pointer: coarse)").matches;
  let s = Math.min(1.25, Math.max(0.62, vw / 1440));
  let W = 432 * s;
  if (vw < 768) {
    W = Math.min(300, Math.max(220, 0.64 * vw));
    s = W / 432;
  }
  const H = (W * 10) / 16;
  const pX = W + 22 * s;
  const pY = H + 18 * s;
  return {
    s,
    W,
    H,
    pX,
    pY,
    cols: Math.ceil(vw / pX) + 3,
    rows: Math.ceil(vh / pY) + 3,
    Rh: 2736 * s,
    Rv: 1125 * s,
    zBase: -820 * s,
    persp: vw < 768 ? Math.max(700, 1120 * s) : 1120 * s,
    touch,
  };
}

const wrap = (x: number, p: number) => ((((x + p / 2) % p) + p) % p) - p / 2;
const mod = (a: number, n: number) => ((a % n) + n) % n;
const expoOut = gsap.parseEase("expo.out");

/**
 * Coeficientes da distribuição (medido no build: a fórmula do parecer, variante = (R + 3C) mod 5, repetia o par
 * projeto+variante a (ΔC, ΔR) = (−2, 1), dentro da viewport). Busca, por P, projeto = (aC + bR) mod P e
 * variante = (cC + dR) mod 5 sem o mesmo projeto em vizinhos (inclusive diagonais) e com a repetição de par mais
 * distante possível na janela visível (~5 × 4 tiles). Para P = 6 resulta em a=1, b=2, c=0, d=1.
 */
const coefCache = new Map<number, [number, number, number, number]>();
function coeffs(P: number): [number, number, number, number] {
  const hit = coefCache.get(P);
  if (hit) return hit;
  let best: [number, number, number, number] = [1, 2, 0, 1];
  let bestScore = -1;
  for (let a = 0; a < P; a++)
    for (let b = 0; b < P; b++)
      for (let c = 0; c < 5; c++)
        for (let d = 0; d < 5; d++) {
          let ok = true;
          let score = 1e9;
          for (let dc = -8; dc <= 8 && ok; dc++)
            for (let dr = -8; dr <= 8; dr++) {
              if (!dc && !dr) continue;
              const pp = mod(a * dc + b * dr, P);
              const vv = mod(c * dc + d * dr, 5);
              if (pp === 0 && vv === 0) score = Math.min(score, Math.max(Math.abs(dc) / 5, Math.abs(dr) / 4));
              if (P > 1 && pp === 0 && Math.max(Math.abs(dc), Math.abs(dr)) === 1) {
                ok = false;
                break;
              }
            }
          if (ok && score > bestScore) {
            bestScore = score;
            best = [a, b, c, d];
          }
        }
  coefCache.set(P, best);
  return best;
}
const p2in = gsap.parseEase("power2.in");

type Anim = { t0: number; dur: number; z: number; ease: (t: number) => number; k: number; max: number; out: boolean; done?: () => void };

type Props = {
  projects: Project[];
  tier: Tier;
  hint: string;
  hintTouch: string;
  onActive: (p: Project | null, i: number) => void;
  entrance: "full" | "short" | "fade";
};

const CurvedGrid = forwardRef<GridApi, Props>(function CurvedGrid({ projects, tier, onActive, entrance, hint, hintTouch }, ref) {
  const stage = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const tiles = useRef<HTMLElement[]>([]);
  const state = useRef({
    cx: 0,
    cy: 0,
    tx: 0,
    ty: 0,
    running: false,
    last: 0,
    hover: -1,
    hoverUntil: 0,
    keys: [] as string[],
    proj: [] as number[],
    pos: [] as { u: number; v: number }[],
    anim: null as Anim | null,
    active: -1,
  });
  const projRef = useRef(projects);
  if (typeof window !== "undefined") (window as unknown as { __grid?: unknown }).__grid = state.current; // QA
  const flat = tier === "low" || tier === "reduced";
  const blur = tier === "high";
  const onActiveRef = useRef(onActive);
  onActiveRef.current = onActive;
  const videoT = useRef<number | undefined>(undefined);
  const videoEl = useRef<HTMLVideoElement | null>(null);

  // geometria (e no resize)
  useLayoutEffect(() => {
    setGeo(geometry());
    let t = 0;
    const onR = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        setGeo(geometry());
      }, 120);
    };
    window.addEventListener("resize", onR);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onR);
    };
  }, []);

  const removeVideo = useCallback(() => {
    window.clearTimeout(videoT.current);
    const v = videoEl.current;
    if (v) {
      v.pause();
      v.removeAttribute("src");
      v.querySelectorAll("source").forEach((s) => s.remove());
      v.load();
      v.remove();
      videoEl.current = null;
    }
  }, []);

  const setContent = (el: HTMLElement, p: Project, vi: number) => {
    const v = VARIANTS[vi];
    const g = el.querySelector<HTMLImageElement>(".ct__g")!;
    const c = el.querySelector<HTMLImageElement>(".ct__c")!;
    // captura real 16:10: srcset 800/1200/1600; sizes = largura do tile × 1,4 — a perspectiva amplia o tile em até
    // ~1,27× (390) / ~1,37× (1440) medidos (v5.1), então a largura de layout sozinha escolhia 800 em DPR 3
    const sizes = `${Math.round((geo?.W ?? 400) * 1.4)}px`;
    g.sizes = sizes;
    g.srcset = shotSet(p, true);
    g.src = frame(p, v, true);
    c.sizes = sizes;
    c.dataset.srcset = shotSet(p);
    c.dataset.src = frame(p, v);
    if (c.dataset.loaded === "1" || el.classList.contains("is-on")) {
      c.srcset = c.dataset.srcset;
      c.src = c.dataset.src;
    } else {
      c.removeAttribute("srcset");
      c.removeAttribute("src");
    }
    el.dataset.slug = p.slug;
    el.dataset.variant = v;
    const cap = el.querySelector(".ct__cap");
    if (cap) cap.textContent = `${p.n} — ${p.name}`;
  };

  const loadColor = (el: HTMLElement) => {
    const c = el.querySelector<HTMLImageElement>(".ct__c");
    if (c && c.dataset.src && c.getAttribute("src") !== c.dataset.src) {
      if (c.dataset.srcset) c.srcset = c.dataset.srcset;
      c.src = c.dataset.src;
      c.dataset.loaded = "1";
    }
  };

  const setOn = useCallback(
    (i: number) => {
      const st = state.current;
      if (st.active === i) return;
      if (st.active >= 0) tiles.current[st.active]?.classList.remove("is-on");
      removeVideo();
      st.active = i;
      st.hoverUntil = performance.now() + 600;
      const el = tiles.current[i];
      if (!el) {
        onActiveRef.current(null, -1);
        return;
      }
      loadColor(el);
      el.classList.add("is-on");
      const p = projRef.current[st.proj[i]];
      onActiveRef.current(p, st.proj[i]);
      // vídeo após intenção (200 ms fino / 400 ms parado no touch), tier ≥ mid, no máximo 1
      if (tier === "mid" || tier === "high") {
        videoT.current = window.setTimeout(
          () => {
            if (state.current.active !== i || !p) return;
            const v = document.createElement("video");
            v.muted = true;
            v.loop = true;
            v.playsInline = true;
            v.preload = "none";
            v.className = "ct__v";
            v.setAttribute("aria-hidden", "true");
            v.tabIndex = -1;
            videoSrc(p).forEach((s) => {
              const so = document.createElement("source");
              so.src = s.src;
              so.type = s.type;
              v.appendChild(so);
            });
            v.addEventListener("playing", () => v.classList.add("is-playing"), { once: true });
            el.querySelector(".ct__in")!.appendChild(v);
            videoEl.current = v;
            v.load();
            v.play().catch(() => {});
          },
          geo?.touch ? 400 : 200,
        );
      }
      wake();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tier, geo, removeVideo],
  );

  // ticker: escreve os transforms e para em repouso
  const tick = useCallback(() => {
    const g = geo;
    const st = state.current;
    if (!g) return;
    const now = performance.now();
    const dt = Math.min(64, now - (st.last || now - 16));
    st.last = now;
    (window as unknown as { __gridTicks?: number }).__gridTicks = ((window as unknown as { __gridTicks?: number }).__gridTicks ?? 0) + 1;
    const k = 1 - Math.exp(-dt / 55); // τ 55 ms: 200 px assentam (< 1 px) em ~290 ms
    st.cx += (st.tx - st.cx) * k;
    st.cy += (st.ty - st.cy) * k;
    const P = projRef.current.length || 1;
    const [ca, cb, cc, cd] = coeffs(P);
    const perX = g.cols * g.pX;
    const perY = g.rows * g.pY;
    const a = st.anim;
    let animating = false;
    let nearest = -1;
    let nd = Infinity;
    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const i = r * g.cols + c;
        const el = tiles.current[i];
        if (!el) continue;
        const bu = (c - (g.cols - 1) / 2) * g.pX + st.cx;
        const bv = (r - (g.rows - 1) / 2) * g.pY + st.cy;
        const u = wrap(bu, perX);
        const v = wrap(bv, perY);
        const C = c - Math.round((bu - u) / perX) * g.cols;
        const R = r - Math.round((bv - v) / perY) * g.rows;
        const pi = mod(ca * C + cb * R, P);
        const vi = mod(cc * C + cd * R, VARIANTS.length);
        const key = `${pi}:${vi}`;
        if (st.keys[i] !== key) {
          st.keys[i] = key;
          st.proj[i] = pi;
          const p = projRef.current[pi];
          if (p) setContent(el, p, vi);
        }
        st.pos[i] = { u, v };
        const d = Math.hypot(u / g.W, v / g.H);
        if (d < nd) {
          nd = d;
          nearest = i;
        }
        let x = u;
        let y = v;
        let z = 0;
        let rx = 0;
        let ry = 0;
        if (!flat) {
          const th = u / g.Rh;
          const tv = v / g.Rv;
          x = g.Rh * Math.sin(th);
          y = g.Rv * Math.sin(tv);
          z = g.zBase + g.Rh * (1 - Math.cos(th)) + g.Rv * (1 - Math.cos(tv));
          rx = (tv * 180) / Math.PI;
          ry = (-0.42 * th * 180) / Math.PI;
        }
        let op = d >= 2 ? 0.8 : 1;
        if (a) {
          const delay = Math.min(a.max, d * a.k);
          const p = Math.min(1, Math.max(0, (now - a.t0 - delay * 1000) / a.dur));
          const e = a.ease(p);
          if (p < 1) animating = true;
          if (a.out) {
            z += a.z * e;
            op *= 1 - e;
          } else {
            z += a.z * (1 - e);
            op *= e;
          }
        }
        el.style.transform = flat && !a
          ? `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
          : `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
        el.style.opacity = op.toFixed(3);
        if (blur) {
          const b = d < 1 ? "b0" : d < 2 ? "b1" : d < 3 ? "b2" : "b3";
          if (el.dataset.b !== b) el.dataset.b = b;
        }
      }
    }
    if (a && !animating) {
      st.anim = null;
      a.done?.();
    }
    // touch: ativo = mais perto do centro
    if (g.touch && nearest >= 0 && st.active !== nearest && nd < 0.75) setOn(nearest);
    const settled = Math.abs(st.tx - st.cx) < 0.1 && Math.abs(st.ty - st.cy) < 0.1;
    if (settled && !st.anim && now > st.hoverUntil) {
      st.cx = st.tx;
      st.cy = st.ty;
      gsap.ticker.remove(tick);
      st.running = false;
      st.last = 0;
    }
  }, [geo, flat, blur, setOn]);

  const wake = useCallback(() => {
    const st = state.current;
    if (st.running) return;
    st.running = true;
    st.last = 0;
    gsap.ticker.add(tick);
  }, [tick]);

  // monta / desmonta o ticker
  useEffect(() => {
    if (!geo) return;
    state.current.keys = [];
    const st = state.current;
    st.anim = {
      t0: performance.now(),
      dur: entrance === "full" ? 1000 : 600,
      z: entrance === "fade" ? 0 : -1200 * geo.s,
      ease: expoOut,
      k: 0.012,
      max: 0.5,
      out: false,
    };
    wake();
    return () => {
      gsap.ticker.remove(tick);
      st.running = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, tick]);

  // troca de filtro: sai (z −300·s, 350 ms), reatribui e entra (z +200·s, 650 ms)
  useEffect(() => {
    if (projRef.current === projects) return;
    const st = state.current;
    const s = geo?.s ?? 1;
    removeVideo();
    if (st.active >= 0) tiles.current[st.active]?.classList.remove("is-on");
    st.active = -1;
    st.anim = {
      t0: performance.now(),
      dur: 350,
      z: -300 * s,
      ease: p2in,
      k: 0.008,
      max: 0.25,
      out: true,
      done: () => {
        projRef.current = projects;
        st.keys = [];
        st.tx = 0;
        st.ty = 0;
        st.cx = 0;
        st.cy = 0;
        st.anim = { t0: performance.now(), dur: 650, z: 200 * s, ease: expoOut, k: 0.008, max: 0.25, out: false };
        onActiveRef.current(null, -1);
      },
    };
    wake();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  useEffect(() => () => removeVideo(), [removeVideo]);

  const centerTile = (i: number) => {
    const st = state.current;
    const p = st.pos[i];
    if (!p) return;
    st.tx = st.cx - p.u;
    st.ty = st.cy - p.v;
    wake();
  };

  const tileFor = (slug: string) => {
    const st = state.current;
    let best = -1;
    let bd = Infinity;
    tiles.current.forEach((el, i) => {
      if (el.dataset.slug !== slug || !st.pos[i]) return;
      const pr = el.dataset.variant === "poster" ? 0 : 1e6;
      const d = Math.hypot(st.pos[i].u, st.pos[i].v) + pr;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  };

  useImperativeHandle(ref, () => ({
    rectFor(slug) {
      const i = tileFor(slug);
      return i >= 0 ? tiles.current[i].querySelector(".ct__in")!.getBoundingClientRect() : null;
    },
    exit(dur = 300) {
      return new Promise<void>((res) => {
        const st = state.current;
        removeVideo();
        st.anim = { t0: performance.now(), dur, z: -300 * (geo?.s ?? 1), ease: p2in, k: 0.008, max: 0.2, out: true, done: res };
        wake();
      });
    },
    focusProject(slug) {
      const i = tileFor(slug);
      if (i < 0) return;
      centerTile(i);
      setOn(i);
    },
  }));

  // entrada: wheel, drag, teclado
  useEffect(() => {
    const el = stage.current;
    if (!el || !geo) return;
    const st = state.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      st.ty -= e.deltaY * m;
      st.tx -= e.deltaX * m;
      wake();
    };
    let down: { x: number; y: number; id: number; moved: boolean; t: number; vx: number; vy: number; lx: number; ly: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, t: performance.now(), vx: 0, vy: 0, lx: e.clientX, ly: e.clientY };
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.lx;
      const dy = e.clientY - down.ly;
      if (!down.moved && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) {
        down.moved = true;
        el.setPointerCapture(e.pointerId);
        el.dataset.drag = "true";
      }
      if (!down.moved) return;
      const now = performance.now();
      const dtt = Math.max(1, now - down.t);
      down.vx = dx / dtt;
      down.vy = dy / dtt;
      down.t = now;
      down.lx = e.clientX;
      down.ly = e.clientY;
      st.tx += dx;
      st.ty += dy;
      st.cx += dx;
      st.cy += dy;
      wake();
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const d = down;
      down = null;
      el.dataset.drag = "false";
      if (d.moved) {
        const clamp = (x: number) => Math.max(-600, Math.min(600, x));
        st.tx += clamp(d.vx * 120);
        st.ty += clamp(d.vy * 120);
        wake();
        return;
      }
      // clique/toque
      const tile = (e.target as HTMLElement).closest<HTMLElement>(".ct");
      if (!tile) return;
      const i = tiles.current.indexOf(tile);
      const p = projRef.current[st.proj[i]];
      if (!p) return;
      if (geo.touch && st.active !== i) {
        centerTile(i);
        setOn(i);
        return;
      }
      window.open(p.url, "_blank", "noopener,noreferrer");
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || down?.moved) return;
      const tile = (e.target as HTMLElement).closest<HTMLElement>(".ct");
      if (!tile) return;
      setOn(tiles.current.indexOf(tile));
    };
    const onLeave = () => {
      if (!geo.touch) setOn(-1);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("pointerover", onOver);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerover", onOver);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [geo, wake, setOn]);

  // teclado (setas / PgUp / PgDn) em qualquer foco dentro de /works em grade
  useEffect(() => {
    if (!geo) return;
    const st = state.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const tgt = e.target as HTMLElement;
      if (tgt.closest("dialog, input, textarea, .works-bar")) return;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [geo.pX, 0],
        ArrowRight: [-geo.pX, 0],
        ArrowUp: [0, geo.pY],
        ArrowDown: [0, -geo.pY],
        PageUp: [0, 3 * geo.pY],
        PageDown: [0, -3 * geo.pY],
      };
      const m = map[e.key];
      if (!m) return;
      e.preventDefault();
      st.tx += m[0];
      st.ty += m[1];
      wake();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [geo, wake]);

  const n = geo ? geo.cols * geo.rows : 0;
  if (tiles.current.length > n) tiles.current.length = n;
  return (
    <div
      className="cgrid"
      ref={stage}
      data-flat={flat}
      data-touch={geo?.touch ?? false}
      style={geo ? ({ perspective: flat ? "none" : `${geo.persp}px`, "--tw": `${geo.W}px`, "--th": `${geo.H}px` } as React.CSSProperties) : undefined}
      aria-hidden="true"
    >
      <div className="cgrid__world" ref={world}>
        {Array.from({ length: n }, (_, i) => (
          <div
            key={i}
            className="ct"
            ref={(el) => {
              if (el) tiles.current[i] = el;
            }}
            style={{ opacity: 0 }}
          >
            <div className="ct__in">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ct__g" alt="" decoding="async" draggable={false} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ct__c" alt="" decoding="async" draggable={false} />
              <span className="ct__cap mono" />
            </div>
          </div>
        ))}
      </div>
      <p className="cgrid__hint mono">{geo?.touch ? hintTouch : hint}</p>
    </div>
  );
});

export default CurvedGrid;
