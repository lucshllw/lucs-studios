"use client";
// Showreel da home — v5 (parecer Vergil v3-reel + v3.1 ornamento). O disco do avatar vira sinal e abre num player
// CONTIDO 16:9 (nunca tela cheia fora do modo Expandir), dentro de uma "ilha de edição" (grade, réguas, marcas de
// corte, metadados mono). Um pin (220 vh desktop / 160 vh mobile, scrub .8) dirige UMA timeline: progresso p 0→1
// alimenta o clip-path da tela, o shader OGL (lib/portal-gl.ts), o dial de timecode (ReelDial) e o HUD.
//  F0 0–.10 herança (disco = avatar, SHOW/REEL se afastam) · F1 .10–.34 quantização/halftone · F2 .34–.56 troca de
//  sinal para o pôster · F3 .56–.80 abertura círculo→retângulo, ticks viram a régua · F4 .80–1 vídeo assume.
// O vídeo não decodifica antes do fim do pin (preload none até o fim do pin ou gesto; uma requisição por sessão; play só no onLeave), exceto após gesto
// (clique no disco abre o ReelPlayer). Tiers: low = sem WebGL e sem pin (transição CSS de 700 ms ao entrar em vista,
// play sob demanda); reduced = player estático; sem JS = <video controls poster>. Um só Lenis (o ScrollTrigger usa o
// proxy existente). Ornamento do círculo = ReelDial (slot do v3.1).
import { useEffect, useRef, useState } from "react";
import { Maximize2, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { useTier, useTierGuard } from "@/lib/tier";
import { gsap, isReduced, ScrollTrigger, useIsoLayoutEffect } from "@/lib/gsap";
import { EMBLEM_SRC, pickReelSources, REEL_CUTS, REEL_DURATION, REEL_POSTER, REEL_POSTER_SMALL, REEL_SOURCES_SSR, wakeVideo, type ReelSource } from "@/lib/media";
import { PortalGL, type PortalGLState } from "@/lib/portal-gl";
import { hasWebGL2 } from "@/lib/hooks";
import { fmt } from "@/lib/i18n/dict";
import { PROJECTS } from "@/lib/projects";
import ReelPlayer, { type ReelPlayerApi } from "./ReelPlayer";
import ReelDial, { type DialApi, type DialGeom } from "./ReelDial";
import PauseButton from "./PauseButton";

type Mode = "ssr" | "pin" | "low" | "static";
const DISC = 474 / 1024;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const seg = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
const sm = (t: number) => t * t * (3 - 2 * t);
const p2in = (t: number) => t * t;
const p3io = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const p1in = (t: number) => t;
const timecode = (s: number) => {
  const f = Math.floor((s % 1) * 24);
  const t = Math.floor(s);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}:${p(f)}`;
};
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const emblemSize = () => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return vw < 768 ? Math.min(0.72 * vw, 0.4 * vh) : Math.min(0.46 * vh, 0.4 * vw);
};

/** Medidas do player (parecer v3-reel §2) */
function geometry() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const landscape = vh < 500 && vw > vh;
  const mobile = vw < 768 && !landscape;
  let W: number;
  let R: number;
  if (landscape) {
    W = Math.min(0.78 * vw, ((vh - 96) * 16) / 9);
    R = 8;
  } else if (mobile) {
    W = vw - 32;
    R = 8;
  } else if (vw < 1024) {
    W = Math.min(0.86 * vw, 900);
    R = 10;
  } else {
    W = Math.min(0.72 * vw, 1100, ((vh - 220) * 16) / 9);
    R = 12;
  }
  const H = (W * 9) / 16;
  const cx = vw / 2;
  const cy = vh / 2 - (mobile ? 0.06 * vh : 0);
  const r0 = emblemSize() * DISC;
  const r1 = mobile ? Math.min(r0, H / 2 - 8) : r0;
  return { vw, vh, W, H, R, cx, cy, r0, r1, mobile: mobile || landscape, ticks: vw < 768 ? 40 : 60 };
}
type Geo = ReturnType<typeof geometry>;

export default function PortalReel() {
  const t = useT().home.portal;
  const pauseL = useT().a11y;
  const tier = useTier();
  const root = useRef<HTMLElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const words = useRef<HTMLParagraphElement>(null);
  const ui = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLSpanElement>(null);
  const recTc = useRef<HTMLSpanElement>(null);
  const disc = useRef<HTMLButtonElement>(null);
  const expandBtn = useRef<HTMLButtonElement>(null);
  const dial = useRef<DialApi>(null);
  const player = useRef<ReelPlayerApi>(null);
  const [mode, setMode] = useState<Mode>("ssr");
  const [sources, setSources] = useState<ReelSource[]>(REEL_SOURCES_SSR);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const [settled, setSettled] = useState(false); // fim do pin (F4 concluída, rolando para baixo)
  const [dur, setDur] = useState(REEL_DURATION);
  const [ticks, setTicks] = useState(60);
  const [lowOpen, setLowOpen] = useState(false);
  const qa = useRef({ glFrames: 0, glRaf: false, p: 0, tweens: 0, spinScale: 1 });

  useEffect(() => {
    setMode(isReduced() || tier === "reduced" ? "static" : tier === "low" ? "low" : "pin");
  }, [tier]);

  // JS presente: tira os controles nativos do fallback, escolhe a fonte e o nº de ticks
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.controls = false;
    // largura final do player (a .portal__frame já tem o tamanho de chegada) × DPR
    const fw = root.current?.querySelector(".portal__frame")?.getBoundingClientRect().width || window.innerWidth;
    const pick = pickReelSources(fw, window.devicePixelRatio);
    if (pick[0]?.src !== REEL_SOURCES_SSR[0]?.src) setSources(pick);
    setTicks(window.innerWidth < 768 ? 40 : 60);
    const onMeta = () => Number.isFinite(v.duration) && v.duration > 0 && setDur(v.duration);
    v.addEventListener("loadedmetadata", onMeta);
    (window as unknown as { __qa?: object }).__qa = { ...(window as unknown as { __qa?: object }).__qa, portal: qa.current };
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, []);

  // troca de <source> só vale após nova seleção; com preload="none" o load() não baixa nada
  useEffect(() => {
    const v = video.current;
    if (v && sources !== REEL_SOURCES_SSR && v.preload === "none") v.load();
  }, [sources]);

  // visibilidade ≥ 10%
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting && e.intersectionRatio >= 0.1), { threshold: [0, 0.1, 0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // vídeo inline: só depois do pin (mid/high), em vista, sem pausa do usuário e com o player fechado
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const sync = () => {
      const should = mode === "pin" && settled && inView && !paused && !playerOpen && document.visibilityState === "visible";
      if (should) {
        wakeVideo(v);
        v.play().catch(() => {});
      } else if (!v.paused) v.pause();
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, [mode, settled, inView, paused, playerOpen]);

  // estado de play + timecode REC e cursor da régua (~12 Hz, só tocando)
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (now - last < 83) return;
      last = now;
      if (recTc.current) recTc.current.textContent = timecode(v.currentTime);
      if (cursor.current) cursor.current.style.transform = `translateX(${((v.currentTime / (v.duration || dur)) * 100).toFixed(2)}cqw)`;
    };
    const on = () => {
      setPlaying(true);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    const off = () => {
      setPlaying(false);
      cancelAnimationFrame(raf);
      raf = 0;
    };
    v.addEventListener("playing", on);
    v.addEventListener("pause", off);
    v.addEventListener("ended", off);
    return () => {
      off();
      v.removeEventListener("playing", on);
      v.removeEventListener("pause", off);
      v.removeEventListener("ended", off);
    };
  }, [dur]);

  useTierGuard(inView && mode === "pin", "portal");

  // ---------- timeline única com pin (mid/high) ----------
  useIsoLayoutEffect(() => {
    const el = root.current;
    const scr = screen.current;
    const cv = canvas.current;
    if (!el || !scr || !cv || mode !== "pin") return;
    let g: Geo = geometry();
    // OGL criado só quando o portal se aproxima (½ viewport): nada de contexto WebGL/shader no carregamento da home.
    // Até ficar pronto, o <img> do avatar (mesma imagem do hero) preenche o disco.
    let gl: PortalGL | null = null;
    const near = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || gl) return;
        near.disconnect();
        if (!hasWebGL2()) return;
        const g0 = new PortalGL(cv, EMBLEM_SRC, REEL_POSTER_SMALL, () => {
          el.dataset.gl = "on";
          kick();
        });
        if (!g0.ok) {
          g0.destroy();
          return;
        }
        gl = g0;
        gl.resize(g.W, canvasH);
      },
      { rootMargin: "50% 0px" },
    );
    // só depois do 1º scroll do usuário: na home o portal começa logo abaixo do hero (já "perto" no carregamento)
    const arm = () => {
      if (window.scrollY < 8) return;
      window.removeEventListener("scroll", arm);
      near.observe(el);
    };
    window.addEventListener("scroll", arm, { passive: true });
    arm();
    let trackBox: DialGeom["track"] = null;
    let canvasH = 1;
    let p = 0;
    const layout = () => {
      g = geometry();
      el.style.setProperty("--pw", `${g.W}px`);
      el.style.setProperty("--ph", `${g.H}px`);
      el.style.setProperty("--pr", `${g.R}px`);
      el.style.setProperty("--pcy", `${g.cy}px`);
      // canvas: largura da tela; altura cobre o disco do hero quando ele é maior que a tela (mobile)
      canvasH = Math.max(g.H, 2 * g.r0 + 8);
      cv.style.width = `${g.W}px`;
      cv.style.height = `${canvasH}px`;
      cv.style.top = `${(g.H - canvasH) / 2}px`;
      gl?.resize(g.W, canvasH);
      const tr = track.current?.getBoundingClientRect();
      const st = el.querySelector(".portal__stage")!.getBoundingClientRect();
      // a faixa entra com translateY((1 − f4) · 16 px): mede-se a posição final, sem esse deslocamento
      const f4 = parseFloat(el.style.getPropertyValue("--f4") || "0") || 0;
      trackBox = tr && tr.width > 0 ? { left: tr.left - st.left, top: tr.top - st.top - (1 - f4) * 16, width: tr.width } : null;
    };

    // giro ocioso do dial: 360°/40 s, timeScale ligado à velocidade do scroll (só antes de F2)
    const spin = { a: 0 };
    const spinTw = gsap.to(spin, { a: 360, duration: 40, ease: "none", repeat: -1, paused: true });
    const scaleTo = gsap.quickTo(spinTw, "timeScale", { duration: 0.6, ease: "power3.out" });
    let hoverArm = 0;
    const hoverObj = { v: 0 };

    const glState = (): PortalGLState => {
      const f1 = seg(p, 0.1, 0.34);
      const f2 = seg(p, 0.34, 0.56);
      const f3 = seg(p, 0.56, 0.8);
      const cellUp = 1 + 19 * p2in(f1);
      const cell = f3 > 0 ? 20 - 19 * p3io(f3) : cellUp;
      const dot = f3 > 0 ? 1 - p3io(f3) : sm(seg(p, 0.22, 0.34));
      const r = g.r0 + (g.r1 - g.r0) * sm(f1);
      const temper = 0.01 + 0.17 * Math.sin(Math.PI * f1);
      const offY = (canvasH - g.H) / 2;
      return { cell, dot, swap: f2, temper, disc: [g.W / 2, canvasH / 2, r], screen: [0, offY, g.W, g.H] };
    };

    // estilos só mudam quando p (ou o "armar" do hover) muda; no giro ocioso só o grupo de ticks gira
    let lastP = -1;
    let lastArm = -1;
    const apply = () => {
      qa.current.p = p;
      if (p === lastP && hoverArm === lastArm) {
        const f2s = seg(p, 0.34, 0.56);
        dialUpdate(seg(p, 0.1, 0.34), f2s, seg(p, 0.56, 0.8), g.r0 + (g.r1 - g.r0) * sm(seg(p, 0.1, 0.34)));
        return;
      }
      lastP = p;
      lastArm = hoverArm;
      const f0 = seg(p, 0, 0.1);
      const f1 = seg(p, 0.1, 0.34);
      const f2 = seg(p, 0.34, 0.56);
      const f3 = seg(p, 0.56, 0.8);
      const r = g.r0 + (g.r1 - g.r0) * sm(f1);
      // clip-path: círculo de raio r → inset(0 round R)
      const o = p3io(f3);
      const iy = (1 - o) * (g.H / 2 - r);
      const ix = (1 - o) * (g.W / 2 - r);
      const rad = r + (g.R - r) * o;
      scr.style.clipPath = `inset(${iy.toFixed(2)}px ${ix.toFixed(2)}px round ${rad.toFixed(2)}px)`;
      // SHOW / REEL
      if (words.current) {
        const k = p1in(f0);
        const [w1, w2] = words.current.children as unknown as HTMLElement[];
        const dx = g.mobile ? 0 : 1;
        const off = (g.vw * 0.12 + 24) * k;
        w1.style.transform = g.mobile ? `translateY(${-off * 0.6}px)` : `translateX(${-off * dx}px)`;
        w2.style.transform = g.mobile ? `translateY(${off * 0.6}px)` : `translateX(${off * dx}px)`;
        w1.style.opacity = w2.style.opacity = String(1 - k);
      }
      // canvas → vídeo (F4)
      cv.style.opacity = String(1 - seg(p, 0.8, 0.86));
      // HUD / ilha de edição
      el.style.setProperty("--f3", String(sm(f3)));
      el.style.setProperty("--f4", String(sm(seg(p, 0.8, 0.95))));
      if (disc.current) disc.current.style.visibility = p < 0.56 ? "visible" : "hidden";
      if (disc.current) {
        disc.current.style.width = disc.current.style.height = `${2 * r}px`;
      }
      // sem preload="metadata" no meio do pin: o Chrome abriria uma 2ª requisição ao tocar (v5.1: uma por sessão)
      dialUpdate(f1, f2, f3, r);
    };
    const dialUpdate = (f1: number, f2: number, f3: number, r: number) => {
      const arc = p < 0.1 ? hoverArm : p < 0.34 ? 0.4 * f1 : 0.4 + 0.6 * f2;
      const spinWeight = 1 - sm(f2);
      dial.current?.update(
        { cx: g.cx, cy: g.cy, r, mobile: g.mobile, track: trackBox },
        {
          spin: spin.a,
          spinWeight,
          arc: Math.max(arc, p < 0.1 ? hoverArm : 0),
          u3: f3,
          labelsOpacity: 1 - seg(p, 0.56, 0.62),
          tc: timecode(arc * 24),
          top: hoverArm > 0.01 && p < 0.1 ? "PLAY REEL" : "SHOWREEL '26",
        },
      );
    };

    // laço do OGL: só em vista, entre onEnter e p .85
    let raf = 0;
    let visible = false;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = 0;
      if (gl && p < 0.85) {
        gl.render(glState(), (now - t0) / 1000);
        qa.current.glFrames++;
      }
      apply();
      if (visible && p < 0.85 && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
      qa.current.glRaf = raf !== 0;
    };
    function kick() {
      if (!raf && visible && document.visibilityState === "visible") raf = requestAnimationFrame(frame);
    }
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && e.intersectionRatio > 0;
      if (visible) {
        kick();
        if (p < 0.34) spinTw.play();
      } else {
        cancelAnimationFrame(raf);
        raf = 0;
        qa.current.glRaf = false;
        spinTw.pause();
      }
      // limiar 0,01: com só [0], um carregamento com o portal encostado na base da viewport (ratio 0, "intersecting")
      // não gerava novo aviso quando ele entrava de fato, e o laço nunca começava
    }, { threshold: [0, 0.01] });
    io.observe(el);
    const onVis = () => kick();
    document.addEventListener("visibilitychange", onVis);

    // hover no disco: "armar" (timeScale 3, arco 0→.12, rótulo PLAY REEL)
    const dEl = disc.current;
    const onEnterD = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      scaleTo(3);
      gsap.to(hoverObj, { v: 0.12, duration: 0.4, ease: "expo.out", onUpdate: () => ((hoverArm = hoverObj.v), apply()) });
    };
    const onLeaveD = () => {
      scaleTo(1);
      gsap.to(hoverObj, { v: 0, duration: 0.4, ease: "expo.out", onUpdate: () => ((hoverArm = hoverObj.v), apply()) });
    };
    dEl?.addEventListener("pointerenter", onEnterD);
    dEl?.addEventListener("pointerleave", onLeaveD);

    const ctx = gsap.context(() => {
      const proxy = { p: 0 };
      let velT = 0;
      gsap.to(proxy, {
        p: 1,
        ease: "none",
        onUpdate: () => {
          p = proxy.p;
          if (p >= 0.34) spinTw.pause();
          else if (visible) spinTw.play();
          if (p >= 0.85) {
            cancelAnimationFrame(raf);
            raf = 0;
            qa.current.glRaf = false;
            apply();
          } else kick();
        },
        scrollTrigger: {
          trigger: el,
          start: "top top",
          end: () => "+=" + Math.round((window.innerWidth < 768 ? 1.6 : 2.2) * window.innerHeight),
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          refreshPriority: 3,
          onRefresh: () => {
            layout();
            apply();
          },
          onUpdate: (self) => {
            if (p >= 0.34) return;
            const v = self.getVelocity();
            const s = Math.min(6, 1 + Math.abs(v) / 600) * (v < 0 ? -1 : 1);
            scaleTo(s);
            qa.current.spinScale = Math.abs(s);
            window.clearTimeout(velT);
            velT = window.setTimeout(() => {
              scaleTo(1);
              qa.current.spinScale = 1;
            }, 120);
          },
          onLeave: () => setSettled(true),
          onEnterBack: () => setSettled(false),
        },
      });
    }, el);
    layout();
    apply();
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    return () => {
      ctx.revert();
      spinTw.kill();
      gsap.killTweensOf(hoverObj);
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      dEl?.removeEventListener("pointerenter", onEnterD);
      dEl?.removeEventListener("pointerleave", onLeaveD);
      near.disconnect();
      window.removeEventListener("scroll", arm);
      gl?.destroy();
      scr.style.clipPath = "";
      cv.style.opacity = "";
      delete el.dataset.gl;
    };
  }, [mode, ticks]);

  // ---------- tier low: sem pin e sem WebGL; transição CSS única de 700 ms a 40% em vista ----------
  useEffect(() => {
    const el = root.current;
    if (!el || mode !== "low") return;
    const g = geometry();
    el.style.setProperty("--pw", `${g.W}px`);
    el.style.setProperty("--ph", `${g.H}px`);
    el.style.setProperty("--pr", `${g.R}px`);
    el.style.setProperty("--pdisc", `${2 * g.r1}px`);
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        setLowOpen(true);
      },
      { threshold: 0.4 },
    );
    // observa a moldura (sem clip-path): o Chrome desconta o clip-path da área visível do alvo
    io.observe(el.querySelector(".portal__frame")!);
    // dial estático (rotação por CSS, pausada fora de vista)
    const st = el.querySelector(".portal__stage")!.getBoundingClientRect();
    const sr = el.querySelector(".portal__frame")!.getBoundingClientRect();
    const cx = sr.left - st.left + sr.width / 2;
    const cy = sr.top - st.top + sr.height / 2;
    el.style.setProperty("--dcx", `${cx}px`);
    el.style.setProperty("--dcy", `${cy}px`);
    dial.current?.update({ cx, cy, r: g.r1, mobile: g.mobile, track: null }, { spin: 0, spinWeight: 0, arc: 0, u3: 0, labelsOpacity: 1, tc: "00:00:00:00", top: "SHOWREEL '26" });
    const vis = new IntersectionObserver(([e]) => (el.dataset.dialRun = String(e.isIntersecting)));
    vis.observe(el);
    return () => {
      io.disconnect();
      vis.disconnect();
    };
  }, [mode, ticks]);

  const openFrom = (rectEl: HTMLElement | null, time: number, opener: HTMLElement) => {
    const v = video.current;
    v?.pause();
    setPlayerOpen(true);
    player.current?.open(rectEl?.getBoundingClientRect() ?? null, time, opener);
  };
  const expand = (e: React.MouseEvent<HTMLButtonElement>) => openFrom(screen.current, video.current?.currentTime ?? 0, e.currentTarget);
  const playDisc = (e: React.MouseEvent<HTMLButtonElement>) => openFrom(e.currentTarget, 0, e.currentTarget);
  const toggleSound = () => {
    const v = video.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };
  const seek = (s: number) => {
    const v = video.current;
    if (!v) return;
    wakeVideo(v);
    const go = () => {
      v.currentTime = s;
      if (cursor.current) cursor.current.style.transform = `translateX(${((s / (v.duration || dur)) * 100).toFixed(2)}cqw)`;
    };
    if (v.readyState >= 1) go();
    else v.addEventListener("loadedmetadata", go, { once: true });
  };

  // tecla F: expandir (quando o portal está assentado e em vista)
  useEffect(() => {
    if (!settled || !inView || playerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "f" || e.key === "F") && !e.metaKey && !e.ctrlKey && !(e.target as HTMLElement)?.closest("input, textarea")) {
        expandBtn.current?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [settled, inView, playerOpen]);

  const count = PROJECTS.length;
  return (
    <section className="portal" ref={root} data-mode={mode} data-low-open={lowOpen} data-playing={playing} aria-label={t.label}>
      <div className="portal__stage">
        <div className="portal__grid" aria-hidden="true" />
        <div className="portal__ruler" aria-hidden="true" />
        <p className="portal__words" ref={words} aria-hidden="true">
          <span className="portal__w1">{t.w1}</span>
          <span className="portal__w2">{t.w2}</span>
        </p>
        <div className="portal__frame">
          <div className="portal__screen" ref={screen}>
            <video ref={video} muted loop playsInline controls preload="none" poster={REEL_POSTER_SMALL} aria-label={t.videoTitle}>
              {sources.map((s) => (
                <source key={s.src} src={s.src} type={s.type} />
              ))}
            </video>
            {/* tier low: avatar → pôster por CSS */}
            {(mode === "low" || mode === "pin") && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="portal__avatar" src={EMBLEM_SRC} alt="" width={1024} height={1024} />
              </>
            )}
            {mode === "pin" && <canvas ref={canvas} className="portal__gl" aria-hidden="true" />}
          </div>
          <div className="portal__ui" ref={ui}>
            <span className="portal__crop portal__crop--tl" aria-hidden="true" />
            <span className="portal__crop portal__crop--tr" aria-hidden="true" />
            <span className="portal__crop portal__crop--bl" aria-hidden="true" />
            <span className="portal__crop portal__crop--br" aria-hidden="true" />
            <p className="portal__meta portal__meta--tl mono">{t.label}</p>
            <p className="portal__meta portal__meta--tr mono" aria-hidden="true">
              <span className="portal__rec">●</span> REC <span ref={recTc}>00:00:00:00</span>
            </p>
            <p className="portal__meta portal__meta--bl mono">{fmt(t.spec, { dur: mmss(dur) })}</p>
            <div className="portal__meta portal__meta--br mono">
              <span>{fmt(t.sites, { count })}</span>
              <button type="button" className="portal__btn" onClick={toggleSound} aria-label={muted ? t.soundOn : t.soundOff} aria-pressed={!muted}>
                {muted ? <VolumeX aria-hidden /> : <Volume2 aria-hidden />}
              </button>
              <button type="button" className="portal__btn" ref={expandBtn} onClick={expand} aria-haspopup="dialog" aria-label={t.expand}>
                <Maximize2 aria-hidden />
              </button>
            </div>
            <div className="portal__track" ref={track} role="group" aria-label={t.track}>
              {REEL_CUTS.map((s) => (
                <button key={s} type="button" className="portal__cut" style={{ left: `${(s / dur) * 100}%` }} onClick={() => seek(s)} aria-label={fmt(t.seek, { t: mmss(s) })} />
              ))}
              <span className="portal__cursor" ref={cursor} aria-hidden="true" />
            </div>
            <button type="button" className="portal__play mono" onClick={(e) => openFrom(screen.current, 0, e.currentTarget)} aria-haspopup="dialog">
              {t.play}
            </button>
            {mode === "pin" && (
              <PauseButton
                size="sm"
                pos="br"
                paused={paused}
                onToggle={() => setPaused((x) => !x)}
                label="showreel"
                ariaLabel={paused ? pauseL.playVideo : pauseL.pauseVideo}
              />
            )}
          </div>
        </div>
        {(mode === "pin" || mode === "low") && <ReelDial ref={dial} ticks={ticks} />}
        <button type="button" className="portal__disc" ref={disc} onClick={playDisc} aria-haspopup="dialog" aria-label={t.disc} />
      </div>
      <ReelPlayer ref={player} title={t.videoTitle} onClose={() => setPlayerOpen(false)} />
    </section>
  );
}
