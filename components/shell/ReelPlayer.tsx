"use client";
// Player RITO do reel (etapa 3, pedido de Lucas 12/11): nasce da tela 3D do reel (FLIP ~0,6 s expo), moldura HUD de
// câmera com timecode real a 24 fps, dial do emblema como play/pause com progresso em brasa, capítulos dos 8 projetos
// com miniatura, velocidade, qualidade (1080p padrão; 4K servido do site, automático só em tela ≥ 2560 px física), fullscreen real, cursor próprio, auto-ocultar.
// Tudo no ticker único (lib/loop). A cena 3D da Home para de renderizar enquanto o player está aberto.
import { useCallback, useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { addTick } from "@/lib/loop";
import { reducedMotion } from "@/lib/motion";
import { ui } from "@/lib/store";
import { REEL } from "@/lib/site";
import { useDialog } from "./useDialog";
import { isLite } from "@/lib/perf";

type Rect = { x: number; y: number; w: number; h: number };
let origin: { rect: Rect | null; time: number } = { rect: null, time: 0 };
/** a Home informa de onde o player nasce (retângulo da tela 3D) e o tempo atual da prévia */
export function openReel(rect: Rect | null, time = 0) {
  origin = { rect, time };
  ui.set({ reel: true });
}

const CH = REEL.chapters;
const FPS = REEL.fps;
const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
const tcOf = (s: number) => `TC ${pad(s / 3600)}:${pad((s / 60) % 60)}:${pad(s % 60)}:${pad((s % 1) * FPS)}`;
const mmss = (s: number) => `${pad(s / 60)}:${pad(s % 60)}`;
const chapterAt = (t: number) => {
  let i = 0;
  for (let k = 0; k < CH.length; k++) if (t >= CH[k].t - 0.01) i = k;
  return i;
};
const R = 30;
const CIRC = 2 * Math.PI * R;

export function ReelPlayer({ open }: { open: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const arc = useRef<SVGCircleElement>(null);
  const fill = useRef<HTMLDivElement>(null);
  const tcEl = useRef<HTMLSpanElement>(null);
  const timeEl = useRef<HTMLSpanElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [q4k, setQ4k] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [flash, setFlash] = useState<number | null>(null);
  const [idle, setIdle] = useState(false);
  const [hover, setHover] = useState<{ i: number; x: number } | null>(null);
  const [fs, setFs] = useState(false);
  const [live, setLive] = useState("");
  const [slider, setSlider] = useState(0);
  const idleT = useRef(0);
  const flashT = useRef(0);
  const closing = useRef(false);

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = root.current;
    const st = stage.current;
    const v = video.current;
    v?.pause();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    const done = () => {
      closing.current = false;
      ui.set({ reel: false });
    };
    if (!el || !st || reducedMotion() || !origin.rect) {
      if (el) gsap.to(el, { opacity: 0, duration: 0.25, onComplete: done });
      else done();
      return;
    }
    const r = origin.rect;
    gsap.to(el, { backgroundColor: "rgba(0,0,0,0)", duration: 0.45 });
    gsap.to(st, {
      x: r.x + r.w / 2 - innerWidth / 2,
      y: r.y + r.h / 2 - innerHeight / 2,
      scaleX: r.w / innerWidth,
      scaleY: r.h / innerHeight,
      borderRadius: 16,
      duration: 0.45,
      ease: "expo.inOut",
      onComplete: done,
    });
  }, []);
  useDialog(open, root, close);

  // abrir: FLIP a partir do retângulo da tela 3D
  useEffect(() => {
    const el = root.current;
    const st = stage.current;
    const v = video.current;
    if (!open || !el || !st || !v) return;
    setMounted(true);
    gsap.killTweensOf([el, st]);
    gsap.set(el, { opacity: 1, backgroundColor: "rgba(0,0,0,1)" });
    gsap.set(st, { x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 0 });
    const r = origin.rect;
    if (reducedMotion() || !r) {
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: reducedMotion() ? 0.2 : 0.35 });
    } else {
      gsap.fromTo(el, { backgroundColor: "rgba(0,0,0,0)" }, { backgroundColor: "rgba(0,0,0,1)", duration: 0.5 });
      gsap.fromTo(
        st,
        { x: r.x + r.w / 2 - innerWidth / 2, y: r.y + r.h / 2 - innerHeight / 2, scaleX: r.w / innerWidth, scaleY: r.h / innerHeight, borderRadius: 16 },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, borderRadius: 0, duration: 0.6, ease: "expo.out" }
      );
    }
    try {
      if (origin.time > 0 && origin.time < (v.duration || 999)) v.currentTime = origin.time;
    } catch {}
    v.playbackRate = rate;
    v.play().catch(() => {});
    setIdle(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // estado do vídeo
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    const on = () => setPlaying(!v.paused);
    v.addEventListener("play", on);
    v.addEventListener("pause", on);
    v.addEventListener("ended", on);
    return () => {
      v.removeEventListener("play", on);
      v.removeEventListener("pause", on);
      v.removeEventListener("ended", on);
    };
  }, []);

  // 4K automático só em tela grande de verdade (≥ 2560 px físicos), conexão boa e nunca em LITE/celular; padrão 1080p
  useEffect(() => {
    if (!open || !REEL.src4k) return;
    const nav = navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number; saveData?: boolean } };
    const c = nav.connection;
    const goodNet = !c || (!c.saveData && (c.effectiveType ?? "4g") === "4g" && (c.downlink ?? 10) >= 10);
    const big = screen.width * (devicePixelRatio || 1) >= 2560;
    const desk = innerWidth >= 768 && matchMedia("(pointer: fine)").matches;
    setQ4k(big && goodNet && desk && !isLite());
  }, [open]);

  // ticker: timecode, progresso no anel e na barra, capítulo atual, cursor
  useEffect(() => {
    if (!open) return;
    let lastCh = -1;
    let lastS = -1;
    const untick = addTick(() => {
      const v = video.current;
      if (!v) return;
      const t = v.currentTime || 0;
      const d = v.duration || 75;
      const p = Math.min(1, t / d);
      if (tcEl.current) tcEl.current.textContent = tcOf(t);
      if (timeEl.current) timeEl.current.textContent = `${mmss(t)} / ${mmss(d)}`;
      if (arc.current) arc.current.style.strokeDashoffset = String(CIRC * (1 - p));
      if (fill.current) fill.current.style.transform = `scaleX(${p})`;
      const c = chapterAt(t);
      if (c !== lastCh) {
        lastCh = c;
        setChapter(c);
        setLive(`Chapter ${c}: ${CH[c].name}`);
      }
      const s = Math.floor(t);
      if (s !== lastS) {
        lastS = s;
        setSlider(s);
      }
    });
    return untick;
  }, [open]);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const poke = useCallback(() => {
    setIdle(false);
    window.clearTimeout(idleT.current);
    idleT.current = window.setTimeout(() => {
      const v = video.current;
      if (v && !v.paused && !root.current?.querySelector(".rp-ui:hover") && !root.current?.querySelector(".rp-ui :focus-visible")) setIdle(true);
    }, 2000);
  }, []);
  useEffect(() => {
    if (open) poke();
    return () => window.clearTimeout(idleT.current);
  }, [open, playing, poke]);

  const toggle = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    poke();
  };
  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min((v.duration || 75) - 0.05, t));
    poke();
  };
  const jump = (i: number) => {
    if (!CH[i]) return;
    seek(CH[i].t);
    setFlash(i);
    window.clearTimeout(flashT.current);
    flashT.current = window.setTimeout(() => setFlash(null), 1400);
  };
  const setSpeed = (r: number) => {
    setRate(r);
    if (video.current) video.current.playbackRate = r;
  };
  const fullscreen = () => {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen?.().catch(() => {});
  };
  const switchQuality = (want4k: boolean) => {
    const v = video.current;
    if (!v || !REEL.src4k || want4k === q4k) return;
    const t = v.currentTime;
    const was = !v.paused;
    // a troca preserva o tempo atual: restaura depois que os metadados da nova fonte chegam
    const restore = () => {
      v.currentTime = t;
      v.playbackRate = rate;
      if (was) v.play().catch(() => {});
    };
    v.addEventListener("loadedmetadata", restore, { once: true });
    setQ4k(want4k);
    window.setTimeout(() => v.load(), 0);
  };

  // teclado (no diálogo)
  const onKey = (e: React.KeyboardEvent) => {
    const tgt = e.target as HTMLElement;
    const isBtn = tgt.tagName === "BUTTON" || tgt.tagName === "SELECT";
    const v = video.current;
    if (!v) return;
    const k = e.key;
    let handled = true;
    if ((k === " " || k === "Spacebar") && !isBtn) toggle();
    else if (k === "k" || k === "K") toggle();
    else if (k === "ArrowLeft") seek(v.currentTime - 5);
    else if (k === "ArrowRight") seek(v.currentTime + 5);
    else if (k === "j" || k === "J") seek(v.currentTime - 10);
    else if (k === "l" || k === "L") seek(v.currentTime + 10);
    else if (/^[1-8]$/.test(k)) jump(Number(k));
    else if (k === "f" || k === "F") fullscreen();
    else if (k === "m" || k === "M") setLive("Silent reel — this video has no audio track");
    else handled = false;
    if (handled) {
      e.preventDefault();
      poke();
    }
  };

  // barra: clique/arraste para buscar; hover mostra capítulo + miniatura
  const barPos = (clientX: number) => {
    const r = bar.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (clientX - r.left) / r.width));
  };
  const onBarDown = (e: React.PointerEvent) => {
    const v = video.current;
    if (!v) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    seek(barPos(e.clientX) * (v.duration || 75));
  };
  const onBarMove = (e: React.PointerEvent) => {
    const v = video.current;
    if (!v) return;
    const f = barPos(e.clientX);
    const t = f * (v.duration || 75);
    setHover({ i: chapterAt(t), x: f });
    if (e.buttons === 1) seek(t);
  };

  // vídeo: cursor próprio (ponteiro fino), toque mostra/oculta, duplo toque nas laterais ±10 s
  const lastTap = useRef(0);
  const onVideoPointer = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") {
      toggle();
      return;
    }
    const now = performance.now();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const fx = (e.clientX - r.left) / r.width;
    if (now - lastTap.current < 300 && (fx < 0.33 || fx > 0.67)) {
      seek((video.current?.currentTime ?? 0) + (fx < 0.5 ? -10 : 10));
      setLive(fx < 0.5 ? "Back 10 seconds" : "Forward 10 seconds");
      lastTap.current = 0;
      return;
    }
    lastTap.current = now;
    if (idle) poke();
    else {
      window.clearTimeout(idleT.current);
      setIdle(true);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    poke();
    const c = cursor.current;
    if (c && e.pointerType === "mouse") c.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
  };

  const v4kLabel = REEL.src4k ? "4K" : "4K · hosting pending";

  return (
    <div
      ref={root}
      className={`rp${idle ? " is-idle" : ""}${fs ? " is-fs" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Showreel player"
      hidden={!open}
      onKeyDown={onKey}
      onPointerMove={onMove}
      data-lenis-prevent
    >
      <div className="rp-stage" ref={stage}>
        <div className="rp-video-wrap" onPointerUp={onVideoPointer} aria-hidden="true">
          <video
            ref={video}
            className="rp-video"
            playsInline
            muted
            preload={mounted ? "auto" : "none"}
            poster={REEL.poster[1920]}
            src={q4k && REEL.src4k ? REEL.src4k : REEL.src1080}
          />
          <div className="rp-cursor" ref={cursor}>
            {playing ? "Pause" : "Play"}
          </div>
        </div>

        {/* moldura HUD de câmera */}
        <div className="rp-hud" aria-hidden="true">
          <i className="c tl" />
          <i className="c tr" />
          <i className="c bl" />
          <i className="c br" />
          <span className="rp-tl">[ REEL — LUCAS MELO ]</span>
          <span className="rp-tr">
            <b className={playing ? "rec on" : "rec"}>●</b> {playing ? "PLAY" : "REC"} · <span ref={tcEl}>TC 00:00:00:00</span>
          </span>
          <span className="rp-br">REEL 2026 · 24 FPS · 4K</span>
        </div>

        {flash !== null && (
          <div className="rp-flash" aria-hidden="true" key={flash}>
            <small>{String(flash).padStart(2, "0")} / 08</small>
            <span className="grot">{CH[flash].name.split(" ")[0]}</span>
            {CH[flash].name.includes(" ") && <span className="black">{CH[flash].name.split(" ").slice(1).join(" ")}</span>}
          </div>
        )}

        <div className="rp-ui">
          <div className="rp-row">
            <button type="button" className="rp-dial" onClick={toggle} aria-label={playing ? "Pause (K)" : "Play (K)"}>
              <svg viewBox="0 0 72 72" aria-hidden="true">
                <circle cx="36" cy="36" r={R} className="track" />
                <circle cx="36" cy="36" r={R} className="arc" ref={arc} style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC }} />
                {Array.from({ length: 24 }, (_, i) => {
                  const a = (i / 24) * Math.PI * 2;
                  const f = (n: number) => n.toFixed(3);
                  const r2 = i % 6 ? 34.5 : 36;
                  return <line key={i} x1={f(36 + Math.cos(a) * 33)} y1={f(36 + Math.sin(a) * 33)} x2={f(36 + Math.cos(a) * r2)} y2={f(36 + Math.sin(a) * r2)} />;
                })}
              </svg>
              <span className="rp-glyph">{playing ? "❚❚" : "▶"}</span>
            </button>
            <div className="rp-meta">
              <span className="rp-ch">
                {String(chapter).padStart(2, "0")} · {CH[chapter].name}
              </span>
              <span className="rp-time" ref={timeEl}>
                00:00 / 01:15
              </span>
            </div>
            <div className="rp-tools">
              {!REEL.hasAudio && <span className="rp-silent">Silent reel</span>}
              <div className="rp-group" role="group" aria-label="Playback speed">
                {[0.5, 1, 1.5].map((r) => (
                  <button key={r} type="button" aria-pressed={rate === r} onClick={() => setSpeed(r)}>
                    {r}×
                  </button>
                ))}
              </div>
              <div className="rp-group" role="group" aria-label="Quality">
                <button type="button" aria-pressed={!q4k} onClick={() => switchQuality(false)}>
                  1080p
                </button>
                <button type="button" aria-pressed={q4k} disabled={!REEL.src4k} onClick={() => switchQuality(true)} title={REEL.src4k ? "" : "4K hosting pending"}>
                  {v4kLabel}
                </button>
              </div>
              <button type="button" className="rp-btn" onClick={fullscreen} aria-label={fs ? "Exit full screen (F)" : "Full screen (F)"}>
                {fs ? "Exit full" : "Full screen"}
              </button>
            </div>
          </div>

          <div
            className="rp-bar"
            ref={bar}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={75}
            aria-valuenow={slider}
            aria-valuetext={`${mmss(slider)} — ${CH[chapter].name}`}
            onPointerDown={onBarDown}
            onPointerMove={onBarMove}
            onPointerLeave={() => setHover(null)}
          >
            <div className="rp-bar-track">
              <div className="rp-bar-fill" ref={fill} />
            </div>
            {CH.map((c, i) => (
              <button
                key={c.name}
                type="button"
                className={`rp-mark${i === chapter ? " on" : ""}`}
                style={{ left: `${(c.t / 75) * 100}%` }}
                aria-label={`Chapter ${i}: ${c.name}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => jump(i)}
                onFocus={() => setHover({ i, x: c.t / 75 })}
                onBlur={() => setHover(null)}
              />
            ))}
            {hover && (
              <div className="rp-tip" style={{ left: `${hover.x * 100}%` }} aria-hidden="true">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={REEL.chapterThumb(hover.i)} alt="" width={160} height={90} />
                <span>
                  {String(hover.i).padStart(2, "0")} · {CH[hover.i].name}
                </span>
              </div>
            )}
          </div>
        </div>

        <button type="button" className="rp-close" aria-label="Close player (Esc)" onClick={close} data-autofocus>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        {live}
      </p>
      <p className="sr-only">
        Keyboard: Space or K play/pause, arrows ±5 s, J/L ±10 s, 1–8 jump to project chapters, F full screen, Esc close.
      </p>
    </div>
  );
}
