// 15/11 — Hero sem WebGL (classe m2d: aceleração de hardware desligada). Mantém o "rito" vivo sem GPU:
// • Canvas 2D: emblema em ASCII (atlas de glifos, drawImage), decodificação de entrada, cintilação, faixa de varredura,
//   chuva vermelha e grade de pontos; lente com o emblema real só para mouse (sem efeito de toque no celular).
// • Anel de monólitos em CSS 3D com os projetos (arrastar/swipe gira com inércia, auto-giro lento, clique abre).
// Loop único (gsap.ticker via addTick) limitado a ~30 fps; pausa fora da tela, com aba oculta, menu/perfil/reel abertos.
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { addTick } from "@/lib/loop";
import { ui } from "@/lib/store";
import { HERO_PROJECTS as PROJECTS, HERO_TOTAL as TOTAL, shotUrl } from "@/lib/projects";

const RAMP = " .:-=+*#%@";
const RAIN = "01/<>[]{}#%*+=";
const TAU = Math.PI * 2;

export type Hero2DState = { p: number; emb: { x: number; y: number; r: number }; tilt: { x: number; y: number } };

export function Hero2D({ state, onFront }: { state: React.RefObject<Hero2DState>; onFront: (i: number) => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const canvas = cv.current!;
    const ringEl = ring.current!;
    const sticky = canvas.parentElement as HTMLElement;
    const ctx = canvas.getContext("2d", { alpha: true })!;
    const fine = matchMedia("(pointer: fine)").matches;

    // ---------- atlas de glifos (branco e vermelho) ----------
    const CELL = { w: 0, h: 0 };
    let atlas: HTMLCanvasElement | null = null;
    const glyphs = RAMP + RAIN;
    const buildAtlas = (cw: number, ch: number) => {
      const a = document.createElement("canvas");
      a.width = cw * glyphs.length;
      a.height = ch * 2;
      const g = a.getContext("2d")!;
      g.font = `500 ${Math.round(ch * 0.82)}px "Martian Mono Variable", ui-monospace, monospace`;
      g.textAlign = "center";
      g.textBaseline = "middle";
      for (let i = 0; i < glyphs.length; i++) {
        g.fillStyle = "#e9e9e9";
        g.fillText(glyphs[i], i * cw + cw / 2, ch / 2);
        g.fillStyle = "#ff2a2a";
        g.fillText(glyphs[i], i * cw + cw / 2, ch + ch / 2);
      }
      atlas = a;
    };

    // ---------- emblema amostrado em grade ----------
    const img = new Image();
    img.decoding = "async";
    img.src = "/brand/avatar-emblem.webp";
    let lum: Float32Array | null = null;
    let cols = 0;
    let rows = 0;
    let reveal: Float32Array | null = null; // instante (s) em que cada célula assenta
    const sample = () => {
      if (!img.complete || !img.naturalWidth) return;
      const s = document.createElement("canvas");
      s.width = cols;
      s.height = rows;
      const g = s.getContext("2d", { willReadFrequently: true })!;
      g.drawImage(img, 0, 0, cols, rows);
      const d = g.getImageData(0, 0, cols, rows).data;
      lum = new Float32Array(cols * rows);
      reveal = new Float32Array(cols * rows);
      for (let i = 0; i < cols * rows; i++) {
        const l = (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]) / 255;
        lum[i] = l * (d[i * 4 + 3] / 255);
        const x = i % cols;
        reveal[i] = 0.15 + (x / cols) * 0.9 + Math.random() * 0.35;
      }
    };

    // ---------- grade de pontos (estática, desenhada uma vez) ----------
    let dots: HTMLCanvasElement | null = null;
    let vw = 0;
    let vh = 0;
    let embPx = 0;
    const resize = () => {
      vw = sticky.clientWidth;
      vh = sticky.clientHeight;
      canvas.width = vw; // DPR 1: sem GPU cada pixel custa CPU
      canvas.height = vh;
      canvas.style.width = `${vw}px`;
      canvas.style.height = `${vh}px`;
      const narrow = vw < 768;
      CELL.w = narrow ? 6 : 8;
      CELL.h = narrow ? 9 : 12;
      buildAtlas(CELL.w, CELL.h);
      embPx = Math.min(vh * 0.46, vw * 0.7);
      cols = Math.max(24, Math.round(embPx / CELL.w));
      rows = Math.max(16, Math.round(embPx / CELL.h));
      sample();
      dots = document.createElement("canvas");
      dots.width = vw;
      dots.height = vh;
      const g = dots.getContext("2d")!;
      g.fillStyle = "rgba(255,255,255,0.10)";
      for (let y = CELL.h; y < vh; y += CELL.h * 2) for (let x = CELL.w; x < vw; x += CELL.w * 2) g.fillRect(x, y, 1, 1);
      g.fillStyle = "rgba(255,42,42,0.16)";
      for (let i = 0; i < (vw * vh) / 9000; i++) g.fillRect(Math.random() * vw, Math.random() * vh, 1.5, 1.5);
      drops = Array.from({ length: narrow ? 16 : 34 }, () => newDrop(true));
    };
    img.onload = sample;

    type Drop = { x: number; y: number; v: number; n: number; red: boolean };
    let drops: Drop[] = [];
    const newDrop = (any: boolean): Drop => ({
      x: Math.round((Math.random() * vw) / CELL.w) * CELL.w,
      y: any ? Math.random() * vh : -CELL.h * 8,
      v: 40 + Math.random() * 90,
      n: 3 + ((Math.random() * 7) | 0),
      red: Math.random() < 0.45,
    });

    const ptr = { x: -999, y: -999, on: false, lx: 0, ly: 0, k: 0 };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return; // sem lente no toque
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      ptr.on = true;
      state.current.tilt.x = (e.clientY / innerHeight - 0.5) * 2;
      state.current.tilt.y = (e.clientX / innerWidth - 0.5) * 2;
    };
    const onLeave = () => (ptr.on = false);
    if (fine) {
      sticky.addEventListener("pointermove", onMove, { passive: true });
      sticky.addEventListener("pointerleave", onLeave);
    }

    // ---------- anel de monólitos (CSS 3D) ----------
    const cards = Array.from(ringEl.querySelectorAll<HTMLElement>(".m2-mon"));
    const N = cards.length;
    const ringSt = { a: 0, v: 0, drag: false, x0: 0, a0: 0, moved: 0, last: 0, lt: 0, idle: 0 };
    let front = -1;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      ringSt.drag = true;
      ringSt.x0 = ringSt.last = e.clientX;
      ringSt.a0 = ringSt.a;
      ringSt.moved = 0;
      ringSt.v = 0;
      ringSt.lt = performance.now();
      ringEl.classList.add("is-drag");
    };
    const onDrag = (e: PointerEvent) => {
      if (!ringSt.drag) return;
      const k = vw < 768 ? 0.012 : 0.006;
      const dx = e.clientX - ringSt.last;
      const now = performance.now();
      ringSt.moved += Math.abs(dx);
      ringSt.a += dx * k;
      ringSt.v = (dx * k) / Math.max(1 / 120, (now - ringSt.lt) / 1000);
      ringSt.last = e.clientX;
      ringSt.lt = now;
    };
    const onUp = () => {
      if (!ringSt.drag) return;
      ringSt.drag = false;
      ringSt.idle = 0;
      ringEl.classList.remove("is-drag");
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.m2-mon");
      if (!a) return;
      e.preventDefault();
      if (ringSt.moved > 6) return; // foi arrasto
      router.push(a.getAttribute("href")!);
    };
    ringEl.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onDrag, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    ringEl.addEventListener("click", onClick);

    let inView = true;
    const io = new IntersectionObserver(([e]) => (inView = e.isIntersecting));
    io.observe(sticky);
    resize();
    const ro = new ResizeObserver(() => resize());
    ro.observe(sticky);

    let acc = 0;
    let clock = 0;
    const untick = addTick((_t, dt) => {
      const s = ui.get();
      if (!inView || document.hidden || s.menu || s.profile || s.reel) return;
      clock += dt;
      const p = state.current.p;

      // anel: inércia + auto-giro lento + encaixe no monólito da frente
      if (!ringSt.drag) {
        ringSt.idle += dt;
        ringSt.a += ringSt.v * dt;
        ringSt.v *= Math.pow(0.04, dt);
        if (Math.abs(ringSt.v) < 0.05) {
          const step = TAU / N;
          const target = Math.round(ringSt.a / step) * step;
          if (ringSt.idle > 3.5) ringSt.a += dt * 0.12; // passeia sozinho depois de 3,5 s parado
          else ringSt.a += (target - ringSt.a) * Math.min(1, dt * 5);
        }
      }
      const step = TAU / N;
      const fi = ((Math.round(-ringSt.a / step) % N) + N) % N;
      if (fi !== front) {
        front = fi;
        onFront(fi);
        cards.forEach((c, i) => c.classList.toggle("is-front", i === fi));
      }
      const tl = state.current.tilt;
      const lift = Math.min(1, Math.max(0, (p - 0.08) / 0.3));
      ringEl.style.setProperty("--ring-a", `${ringSt.a}rad`);
      ringEl.style.setProperty("--ring-tx", `${(tl.x * -4).toFixed(2)}deg`);
      ringEl.style.setProperty("--ring-ty", `${(tl.y * 3).toFixed(2)}deg`);
      ringEl.style.opacity = String(1 - Math.min(1, Math.max(0, (p - 0.62) / 0.2)));
      ringEl.style.setProperty("--ring-lift", String(lift));

      // canvas a ~30 fps
      acc += dt;
      if (acc < 1 / 30) return;
      const fdt = acc;
      acc = 0;
      ctx.clearRect(0, 0, vw, vh);
      if (!atlas) return;
      const real = Math.min(1, Math.max(0, p / 0.55)); // ASCII → real conforme rola
      const fadeAll = 1 - Math.min(1, Math.max(0, (p - 0.7) / 0.25)) * 0.85; // fundo some; o emblema real fica
      ctx.globalAlpha = 0.9 * fadeAll;
      if (dots) ctx.drawImage(dots, 0, (clock * 6) % (CELL.h * 2) - CELL.h * 2);
      // chuva
      for (const d of drops) {
        d.y += d.v * fdt;
        if (d.y - d.n * CELL.h > vh) Object.assign(d, newDrop(false));
        for (let j = 0; j < d.n; j++) {
          const gi = RAMP.length + (((d.y / CELL.h) | 0) + j * 7) % RAIN.length;
          ctx.globalAlpha = (1 - j / d.n) * 0.55 * fadeAll;
          ctx.drawImage(atlas, gi * CELL.w, d.red && j === 0 ? CELL.h : 0, CELL.w, CELL.h, d.x, d.y - j * CELL.h, CELL.w, CELL.h);
        }
      }
      // emblema ASCII
      const e = state.current.emb;
      const ew = cols * CELL.w;
      const eh = rows * CELL.h;
      const ox = Math.round(e.x - ew / 2);
      const oy = Math.round(e.y - eh / 2);
      if (lum && reveal) {
        const scan = ((clock * 0.35) % 1.4) * rows - rows * 0.2;
        const breathe = 0.85 + 0.15 * Math.sin(clock * 1.7);
        for (let y = 0; y < rows; y++) {
          const band = Math.max(0, 1 - Math.abs(y - scan) / 3);
          for (let x = 0; x < cols; x++) {
            const i = y * cols + x;
            const l = lum[i];
            if (l < 0.06) continue;
            let gi = Math.min(RAMP.length - 1, Math.max(1, Math.round(l * (RAMP.length - 1))));
            const settled = clock >= reveal[i];
            if (!settled || Math.random() < 0.025 + band * 0.25) gi = RAMP.length + ((Math.random() * RAIN.length) | 0);
            const red = band > 0.4 && Math.random() < 0.5;
            ctx.globalAlpha = Math.min(1, (0.25 + l * 0.9) * breathe + band * 0.4) * (1 - real) * fadeAll;
            ctx.drawImage(atlas, gi * CELL.w, red ? CELL.h : 0, CELL.w, CELL.h, ox + x * CELL.w, oy + y * CELL.h, CELL.w, CELL.h);
          }
        }
      }
      // emblema real: cresce com a rolagem; lente do mouse revela o real
      if (img.complete && img.naturalWidth) {
        const sc = 1 + real * 0.12;
        const ws = embPx * sc;
        if (real > 0.01) {
          ctx.globalAlpha = real;
          ctx.drawImage(img, e.x - ws / 2, e.y - ws / 2, ws, ws);
        }
        ptr.k += ((ptr.on ? 1 : 0) - ptr.k) * Math.min(1, fdt * 10);
        ptr.lx += (ptr.x - ptr.lx) * Math.min(1, fdt * 14);
        ptr.ly += (ptr.y - ptr.ly) * Math.min(1, fdt * 14);
        if (ptr.k > 0.02 && real < 0.98) {
          const R = 46 * ptr.k;
          ctx.save();
          ctx.beginPath();
          ctx.arc(ptr.lx, ptr.ly, R, 0, TAU);
          ctx.clip();
          ctx.globalAlpha = fadeAll;
          ctx.fillStyle = "#000";
          ctx.fillRect(ptr.lx - R, ptr.ly - R, R * 2, R * 2);
          ctx.drawImage(img, e.x - embPx / 2, e.y - embPx / 2, embPx, embPx);
          ctx.restore();
          ctx.globalAlpha = 0.8 * ptr.k * fadeAll;
          ctx.strokeStyle = "#ff2a2a";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(ptr.lx, ptr.ly, R, 0, TAU);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    });

    return () => {
      untick();
      io.disconnect();
      ro.disconnect();
      sticky.removeEventListener("pointermove", onMove);
      sticky.removeEventListener("pointerleave", onLeave);
      ringEl.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onDrag);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      ringEl.removeEventListener("click", onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <canvas ref={cv} className="m2-canvas" aria-hidden="true" />
      <div className="m2-ring-wrap" aria-hidden="true">
        <div ref={ring} className="m2-ring" style={{ ["--n" as string]: TOTAL }}>
          {PROJECTS.map((p, i) => (
            <a key={p.slug} href={`/works/${p.slug}/`} className="m2-mon" tabIndex={-1} style={{ ["--i" as string]: i }} draggable={false}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shotUrl(p, p.shots[0]?.id ?? "s00", 828)} alt="" width={828} height={466} loading="lazy" draggable={false} />
              <span className="m2-mon-n">{p.n}</span>
              <span className="m2-mon-name">{p.name}</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
