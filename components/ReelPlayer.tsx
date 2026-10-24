"use client";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { gsap } from "@/lib/gsap";
import { useMagnetic } from "@/lib/magnetic";
import { holdScroll, releaseScroll } from "@/lib/lenis-store";
import { useT } from "@/lib/i18n/provider";
import { pickReelSources, REEL_POSTER, REEL_SOURCES_SSR, wakeVideo } from "@/lib/media";

export type ReelPlayerApi = { open: (from: DOMRect | null, time: number, opener: HTMLElement | null) => void };

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const t = Math.floor(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
type V = HTMLVideoElement & {
  audioTracks?: { length: number };
  mozHasAudio?: boolean;
  webkitAudioDecodedByteCount?: number;
  webkitEnterFullscreen?: () => void;
  fastSeek?: (t: number) => void;
};
/** null = ainda não dá para saber */
function detectAudio(v: V): boolean | null {
  if (v.audioTracks && typeof v.audioTracks.length === "number") return v.audioTracks.length > 0;
  if (typeof v.mozHasAudio === "boolean") return v.mozHasAudio;
  if (typeof v.webkitAudioDecodedByteCount === "number") {
    if (v.webkitAudioDecodedByteCount > 0) return true;
    return v.currentTime > 0.6 ? false : null;
  }
  return null;
}

/**
 * Player do reel em <dialog> modal (parecer v3 §4): foco preso e Esc nativos (cancel → fechamento animado),
 * Lenis parado enquanto aberto, foco devolvido a quem abriu. FLIP da prévia até a moldura (600 ms expo.out),
 * fechar reverso (350 ms power2.in); reduced = só opacidade 150 ms. Sem trilha de áudio no arquivo, o botão
 * de som fica desativado com o rótulo "Reel sem trilha" (não simula áudio).
 */
export default function ReelPlayer({ ref, title, onClose }: { ref?: Ref<ReelPlayerApi>; title: string; onClose?: () => void }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLDivElement>(null);
  const video = useRef<V>(null);
  const bar = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const cursor = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const fromRect = useRef<DOMRect | null>(null);
  const wasPlaying = useRef(false);
  const idle = useRef<number | undefined>(undefined);
  const closing = useRef(false);
  const L = useT().player;

  const [isOpen, setIsOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [audio, setAudio] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cursorLabel, setCursorLabel] = useState("");
  // fonte pela largura do player expandido (≈ viewport) × DPR; com preload="none" a troca + load() não baixa nada
  const [sources, setSources] = useState(REEL_SOURCES_SSR);
  useEffect(() => {
    const pick = pickReelSources(window.innerWidth, window.devicePixelRatio);
    if (pick[0]?.src !== REEL_SOURCES_SSR[0]?.src) setSources(pick);
  }, []);
  useEffect(() => {
    const v = video.current;
    if (v && sources !== REEL_SOURCES_SSR && v.preload === "none") v.load();
  }, [sources]);

  useMagnetic(close, { radius: 120, max: 14, strength: 0.35 });

  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- barra que some quando ocioso ----
  const wake = useCallback(() => {
    setHidden(false);
    window.clearTimeout(idle.current);
    idle.current = window.setTimeout(() => {
      const v = video.current;
      const focusInBar = bar.current?.contains(document.activeElement);
      if (v && !v.paused && !focusInBar) setHidden(true);
    }, 2500);
  }, []);

  // ---- abrir / fechar ----
  useImperativeHandle(ref, () => ({
    open(from, time, op) {
      const d = dlg.current;
      const v = video.current;
      if (!d || !v || d.open) return;
      opener.current = op;
      fromRect.current = from;
      closing.current = false;
      d.showModal();
      setIsOpen(true);
      holdScroll("player");
      // pôster só ao abrir (o atributo baixaria a imagem no carregamento da página mesmo com preload="none")
      if (!v.poster) v.poster = REEL_POSTER;
      wakeVideo(v);
      const seek = () => {
        try {
          if (time > 0 && v.duration && time < v.duration) v.currentTime = time;
        } catch {}
        v.play().catch(() => {});
      };
      if (v.readyState >= 1) seek();
      else v.addEventListener("loadedmetadata", seek, { once: true });
      const f = frame.current!;
      const w = veil.current!;
      if (reduced() || !from) {
        gsap.fromTo([f, w], { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "none" });
      } else {
        const to = f.getBoundingClientRect();
        gsap.fromTo(w, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: "power2.out" });
        gsap.fromTo(
          f,
          {
            x: from.left + from.width / 2 - (to.left + to.width / 2),
            y: from.top + from.height / 2 - (to.top + to.height / 2),
            scaleX: from.width / to.width,
            scaleY: from.height / to.height,
            opacity: 1,
          },
          { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.6, ease: "expo.out", clearProps: "transform" },
        );
      }
      wake();
    },
  }));

  const finish = useCallback(() => {
    const d = dlg.current;
    video.current?.pause();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    d?.close();
  }, []);

  const requestClose = useCallback(() => {
    const d = dlg.current;
    if (!d?.open || closing.current) return;
    closing.current = true;
    video.current?.pause();
    const f = frame.current!;
    const w = veil.current!;
    const from = fromRect.current;
    if (reduced() || !from) {
      gsap.to([f, w], { opacity: 0, duration: 0.15, ease: "none", onComplete: finish });
      return;
    }
    const to = f.getBoundingClientRect();
    gsap.to(w, { opacity: 0, duration: 0.35, ease: "power2.in" });
    gsap.to(f, {
      x: from.left + from.width / 2 - (to.left + to.width / 2),
      y: from.top + from.height / 2 - (to.top + to.height / 2),
      scaleX: from.width / to.width,
      scaleY: from.height / to.height,
      opacity: 0,
      duration: 0.35,
      ease: "power2.in",
      onComplete: finish,
    });
  }, [finish]);

  const onClosed = () => {
    setIsOpen(false);
    setPlaying(false);
    window.clearTimeout(idle.current);
    gsap.set([frame.current, veil.current], { clearProps: "all" });
    releaseScroll("player");
    opener.current?.focus();
    onClose?.();
  };

  // ---- controles ----
  const toggle = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
    wake();
  }, [wake]);
  const seekTo = useCallback((t: number) => {
    const v = video.current;
    if (!v || !v.duration) return;
    const x = Math.max(0, Math.min(v.duration, t));
    if (v.fastSeek && drag) v.fastSeek(x);
    else v.currentTime = x;
    setCur(x);
  }, [drag]);
  const toggleMute = useCallback(() => {
    const v = video.current;
    if (!v || audio !== true) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, [audio]);
  const fullscreen = useCallback(() => {
    const d = dlg.current;
    const v = video.current;
    if (!d || !v) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (d.requestFullscreen) d.requestFullscreen().catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    const tgt = e.target as HTMLElement;
    if (e.key === "Tab") {
      // foco preso: o <dialog> modal deixa o Tab sair para a interface do navegador; aqui ele circula
      const list = Array.from(
        dlg.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"], input') ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
      wake();
      return;
    }
    if (tgt.closest(".rp__track")) return; // o slider trata as próprias setas
    const k = e.key.toLowerCase();
    if (k === " " || k === "k") {
      if (tgt.tagName === "BUTTON" && k === " ") return; // Espaço num botão = clique do botão
      e.preventDefault();
      toggle();
    } else if (k === "m") toggleMute();
    else if (k === "f") fullscreen();
    else if (k === "arrowleft" || k === "arrowright") {
      e.preventDefault();
      seekTo((video.current?.currentTime ?? 0) + (k === "arrowleft" ? -5 : 5));
    }
    wake();
  };

  // slider
  const pctFromEvent = (e: React.PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  };
  const onTrackDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const v = video.current;
    if (!v || !v.duration) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    wasPlaying.current = !v.paused;
    v.pause();
    setDrag(true);
    seekTo(pctFromEvent(e) * v.duration);
  };
  const onTrackMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || !video.current) return;
    seekTo(pctFromEvent(e) * video.current.duration);
  };
  const onTrackUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDrag(false);
    const v = video.current;
    if (v) {
      v.currentTime = Math.max(0, Math.min(v.duration, pctFromEvent(e) * v.duration));
      if (wasPlaying.current) v.play().catch(() => {});
    }
  };
  const onTrackKey = (e: React.KeyboardEvent) => {
    const v = video.current;
    if (!v || !v.duration) return;
    const map: Record<string, number> = {
      ArrowLeft: v.currentTime - 5,
      ArrowDown: v.currentTime - 5,
      ArrowRight: v.currentTime + 5,
      ArrowUp: v.currentTime + 5,
      PageDown: v.currentTime - 10,
      PageUp: v.currentTime + 10,
      Home: 0,
      End: v.duration,
    };
    if (e.key in map) {
      e.preventDefault();
      seekTo(map[e.key]);
      wake();
    }
  };

  // eventos do vídeo
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.volume = 0.8;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => {
      setCur(v.currentTime);
      setAudio((a) => (a === null ? detectAudio(v) : a));
    };
    const onMeta = () => {
      setDur(v.duration || 0);
      setAudio(detectAudio(v));
    };
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
    };
  }, []);

  // cursor customizado (pointer fine, sem reduced), só com o dialog aberto
  useEffect(() => {
    const d = dlg.current;
    const c = cursor.current;
    if (!isOpen || !d || !c) return;
    const ok = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches;
    if (!ok) return;
    d.dataset.cursor = "on";
    const xTo = gsap.quickTo(c, "x", { duration: 0.25, ease: "power3.out" });
    const yTo = gsap.quickTo(c, "y", { duration: 0.25, ease: "power3.out" });
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      xTo(e.clientX);
      yTo(e.clientY);
      const t = e.target as HTMLElement;
      if (t.closest(".rp__bar, .rp__close")) setCursorLabel("");
      else if (t.closest(".rp__video")) setCursorLabel(video.current?.paused ? L.cursorPlay : L.cursorPause);
      else setCursorLabel(L.cursorClose);
      wake();
    };
    d.addEventListener("pointermove", onMove);
    return () => {
      d.removeEventListener("pointermove", onMove);
      delete d.dataset.cursor;
    };
  }, [isOpen, wake]);
  useEffect(() => {
    setCursorLabel((l) => (l === L.cursorPlay || l === L.cursorPause ? (playing ? L.cursorPause : L.cursorPlay) : l));
    if (!playing) setHidden(false);
  }, [playing]);

  const pct = dur ? (cur / dur) * 100 : 0;
  const audioLabel = audio === true ? (muted ? L.unmute : L.mute) : audio === false ? L.noAudio : L.checking;

  return (
    <dialog
      ref={dlg}
      className="rp"
      aria-label={`${L.dialog}: ${title}`}
      data-lenis-prevent
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClose={onClosed}
      onKeyDown={onKey}
      data-hidden={hidden && !drag}
    >
      <div ref={veil} className="rp__veil" onClick={requestClose} aria-hidden="true" />
      <button ref={close} type="button" className="rp__close" onClick={requestClose} autoFocus>
        <span aria-hidden="true">[ {L.cursorClose} ]</span>
        <span className="sr-only">{L.close}</span>
      </button>
      <div ref={frame} className="rp__frame">
        <video
          ref={video}
          className="rp__video"
          playsInline
          muted
          preload="none"
          onClick={toggle}
          aria-label={title}
        >
          {sources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
        <div ref={bar} className="rp__bar" onFocus={wake} onPointerMove={wake}>
          <button type="button" className="rp__btn" onClick={toggle} aria-label={playing ? L.pause : L.play}>
            {playing ? <Pause aria-hidden fill="currentColor" /> : <Play aria-hidden fill="currentColor" />}
          </button>
          <div
            ref={track}
            className="rp__track"
            role="slider"
            tabIndex={0}
            aria-label={L.progress}
            aria-valuemin={0}
            aria-valuemax={Math.round(dur)}
            aria-valuenow={Math.round(cur)}
            aria-valuetext={`${fmt(cur)} ${L.of} ${fmt(dur)}`}
            data-drag={drag}
            onPointerDown={onTrackDown}
            onPointerMove={onTrackMove}
            onPointerUp={onTrackUp}
            onPointerCancel={onTrackUp}
            onKeyDown={onTrackKey}
            style={{ "--p": `${pct}%` } as React.CSSProperties}
          >
            <span className="rp__fill" />
            <span className="rp__thumb" />
          </div>
          <span className="rp__time mono">
            {fmt(cur)} / {fmt(dur)}
          </span>
          <button
            type="button"
            className="rp__btn rp__btn--audio"
            onClick={toggleMute}
            disabled={audio !== true}
            aria-label={audioLabel}
            title={audioLabel}
          >
            {audio === true && !muted ? <Volume2 aria-hidden /> : <VolumeX aria-hidden />}
            {audio === false && <span className="rp__noaudio mono">{L.noAudio}</span>}
          </button>
          {audio === true && (
            <input
              className="rp__vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={L.volume}
              onChange={(e) => {
                const v = video.current;
                const n = Number(e.target.value);
                setVolume(n);
                if (v) {
                  v.volume = n;
                  v.muted = n === 0;
                  setMuted(v.muted);
                }
              }}
            />
          )}
          <button type="button" className="rp__btn" onClick={fullscreen} aria-label={L.fullscreen}>
            <Maximize aria-hidden />
          </button>
        </div>
      </div>
      <div ref={cursor} className="rp__cursor" aria-hidden="true" data-label={cursorLabel || undefined}>
        <span className="mono">{cursorLabel}</span>
      </div>
    </dialog>
  );
}
