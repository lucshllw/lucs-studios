"use client";
// Palavras da hero ("CREATIVE" / "Developer"), v5.1 — pedido de Lucas (24/10/2026):
//  · Sempre em movimento: loop próprio só em CSS (deriva orbital lenta em transform, compositor), diferente do
//    wordmark do rodapé (listras/glitch). Vale em todos os tiers, inclusive lite; só prefers-reduced-motion para.
//    Pausa apenas com a hero inteira fora de vista (Hero.tsx → data-off).
//  · Junto com o emblema: paralaxe por cursor (--em-ox/--em-oy) e máscara de scroll (--em-end) vêm do estado do
//    Emblem (escritos por ele na .hero4) — nada é recalculado aqui.
//  · Hover: o mesmo rastro pixelado do emblema/rodapé (lib/pixel-trail.ts: blocos 20 px, pincel 60 px, decaimento
//    ~1,08 s) com mosaico 6 px, deslocamento por linha, blocos apagados e listras, num canvas 2D sobre a palavra
//    (sem novo contexto WebGL). O loop CSS continua durante o hover. Toque: pulso curto no ponto tocado.
//  · O texto real fica no DOM (selecionável); o canvas só existe enquanto há rastro e some depois (data-fx).
import { useEffect, useRef } from "react";
import { PixelTrail, TRAIL_CELL } from "@/lib/pixel-trail";

const PAD = 24; // folga do canvas em volta da palavra (deslocamentos de linha)
const MOSAIC = 6;
const hash = (a: number, b: number) => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

export default function HeroWord({ text, variant, fx }: { text: string; variant: "grot" | "black"; fx: boolean }) {
  const inRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = inRef.current;
    const span = textRef.current;
    const canvas = canvasRef.current;
    if (!fx || !box || !span || !canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pt = new PixelTrail();
    const base = document.createElement("canvas");
    const mosaic = document.createElement("canvas");
    let W = 0;
    let H = 0;
    let k = 1;
    let dirty = true;

    // rasteriza a palavra nas posições reais de cada caractere do DOM (respeita tracking e text-transform)
    const raster = () => {
      dirty = false;
      W = box.offsetWidth + PAD * 2;
      H = box.offsetHeight + PAD * 2;
      k = Math.min(window.devicePixelRatio || 1, 2);
      for (const c of [base, mosaic, canvas]) {
        c.width = Math.ceil(W * k);
        c.height = Math.ceil(H * k);
      }
      const b = base.getContext("2d")!;
      b.setTransform(k, 0, 0, k, 0, 0);
      const cs = getComputedStyle(span);
      b.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      b.fillStyle = getComputedStyle(box).color; // o .hero4__t fica transparente durante o efeito
      b.textBaseline = "alphabetic";
      const ascent = b.measureText("H").fontBoundingBoxAscent || parseFloat(cs.fontSize) * 0.9;
      const o = box.getBoundingClientRect();
      const node = span.firstChild;
      const upper = cs.textTransform === "uppercase";
      if (node && node.nodeType === Node.TEXT_NODE) {
        const s = node.textContent ?? "";
        const r = document.createRange();
        for (let i = 0; i < s.length; i++) {
          const ch = upper ? s[i].toUpperCase() : s[i];
          if (!ch.trim()) continue;
          r.setStart(node, i);
          r.setEnd(node, i + 1);
          const q = r.getBoundingClientRect();
          b.fillText(ch, q.left - o.left + PAD, q.top - o.top + PAD + ascent);
        }
      }
      // mosaico: reduz a 1/6 com suavização e amplia sem suavização
      const sw = Math.max(1, Math.round(base.width / (MOSAIC * k)));
      const sh = Math.max(1, Math.round(base.height / (MOSAIC * k)));
      const tmp = document.createElement("canvas");
      tmp.width = sw;
      tmp.height = sh;
      tmp.getContext("2d")!.drawImage(base, 0, 0, sw, sh);
      const m = mosaic.getContext("2d")!;
      m.imageSmoothingEnabled = false;
      m.drawImage(tmp, 0, 0, mosaic.width, mosaic.height);
      pt.resize(W, H);
    };

    let mouse: { x: number; y: number } | null = null;
    let raf = 0;
    let prev = 0;
    const t0 = performance.now();

    /** desenha o quadro; devolve se algum bloco ainda tem rastro visível */
    const render = (time: number) => {
      let live = false;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const slot10 = Math.floor(time * 10);
      const slot12 = Math.floor(time * 12);
      const C = TRAIL_CELL;
      const { cols, rows, field } = pt;
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const x = i * C;
          const y = j * C;
          const t = smooth(0.05, 0.6, field[j * cols + i]);
          if (t > 0.01) live = true;
          if (t <= 0.01) {
            ctx.drawImage(base, x * k, y * k, C * k, C * k, x * k, y * k, C * k, C * k);
            continue;
          }
          // blocos apagados aleatórios (mesma regra do shader: célula > 0,72 some na proporção do rastro)
          ctx.globalAlpha = hash(i + slot10 * 0.37, j + slot10 * 1.13) > 0.72 ? 1 - t : 1;
          for (let ry = 0; ry < C; ry += MOSAIC) {
            const dx = t * (hash(Math.floor((y + ry) / MOSAIC), slot12) - 0.5) * 22;
            ctx.drawImage(mosaic, (x - dx) * k, (y + ry) * k, C * k, MOSAIC * k, x * k, (y + ry) * k, C * k, MOSAIC * k);
          }
          ctx.globalAlpha = 1;
          // listras em deriva sob o rastro
          ctx.globalCompositeOperation = "source-atop";
          ctx.fillStyle = `rgba(0,0,0,${(0.55 * t).toFixed(3)})`;
          for (let ry = 0; ry < C; ry += 1) {
            if (Math.sin((y + ry - time * 36) * 0.85) < 0) ctx.fillRect(x * k, (y + ry) * k, C * k, k);
          }
          ctx.globalCompositeOperation = "source-over";
        }
      return live;
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      box.dataset.fx = "off";
    };
    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (mouse) pt.moveTo(mouse.x, mouse.y);
      pt.decay(dt);
      if (!mouse && !pt.active) return stop();
      // abaixo do limiar do smoothstep o quadro é igual ao texto do DOM: devolve a palavra ao DOM e encerra
      if (!render((now - t0) / 1000) && !mouse) return stop();
      box.dataset.fx = "on";
      raf = requestAnimationFrame(frame);
    };
    const wake = () => {
      if (raf) return;
      if (dirty) raster();
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const local = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      return { x: e.clientX - r.left + PAD, y: e.clientY - r.top + PAD };
    };
    const host = box.parentElement ?? box; // .hero4__w (recebe ponteiro)
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      mouse = local(e);
      wake();
    };
    const onLeave = () => {
      mouse = null;
      pt.lift();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      if (dirty) raster();
      const p = local(e);
      pt.lift();
      for (let dx = -80; dx <= 80; dx += 10) pt.stamp(p.x + dx, p.y, 0.9);
      wake();
    };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeave);
    host.addEventListener("pointerdown", onDown);
    const invalidate = () => {
      dirty = true;
    };
    const ro = new ResizeObserver(invalidate);
    ro.observe(box);
    document.fonts?.ready.then(invalidate);

    return () => {
      stop();
      ro.disconnect();
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      host.removeEventListener("pointerdown", onDown);
    };
  }, [fx, text]);

  return (
    <span className={`hero4__w hero4__w--${variant}`}>
      <span className="hero4__in" ref={inRef}>
        <span className="hero4__t" ref={textRef}>
          {text}
        </span>
        {fx && <canvas ref={canvasRef} className="hero4__fx" aria-hidden="true" />}
      </span>
    </span>
  );
}
