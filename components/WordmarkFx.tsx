"use client";
// Camada WebGL do wordmark "LUCAS MELO" do rodapé (v5, item 10). Reaproveita o rastro pixelado do emblema do hero
// (lib/pixel-trail.ts: blocos de 20 px, pincel 60 px, decaimento ~1,08 s) e a mesma linguagem do shader: glitch
// em fatias, listras e grão. O texto é rasterizado a partir das caixas reais das letras no DOM (as "fantasmas"
// do SiteFooter), então o canvas coincide com o layout ajustado à largura — nenhuma letra corta.
//  · Loop sutil sempre ativo enquanto o rodapé está (mesmo parcialmente) em vista: listras finas em deriva e
//    fatias de glitch raras. Durante o hover (e o decaimento do rastro) o loop congela: um efeito por vez. Entrada: revelação em blocos da esquerda para a direita na 1ª vez em vista.
//  · Mouse sobre o wordmark: rastro pixelado → mosaico, listras fortes, deslocamento por linhas e blocos apagados.
//  · Toque: um toque dispara um pulso curto do efeito no ponto tocado.
//  · Desligado (DOM estático) em reduced-motion, tier low (lite) / reduced e sem WebGL2. Pausa fora de vista e
//    com a aba oculta.
import { useEffect, useRef, useState, type RefObject } from "react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { hasWebGL2 } from "@/lib/hooks";
import { useTier } from "@/lib/tier";
import { PixelTrail, TRAIL_GLSL } from "@/lib/pixel-trail";
import { HASH_GLSL } from "@/lib/glsl";
import { ScrollTrigger } from "@/lib/gsap";

const vertex = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uText;
uniform sampler2D uTrail;
uniform vec2 uTrailGrid;
uniform vec2 uSize;      // px CSS
uniform float uTime;     // relógio do rastro
uniform float uLoop;     // relógio do loop ocioso (congela enquanto o rastro assume)
uniform float uReveal;   // 0 → 1 (entrada em blocos)
in vec2 vUv;
out vec4 fragColor;
${TRAIL_GLSL}
${HASH_GLSL}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uSize;
  vec2 p = px;
  // loop sutil: fatia de glitch rara (≈ 8% dos slots de 125 ms)
  float slot = floor(uLoop * 8.0);
  if (hash(vec2(slot, 1.7)) > 0.92) {
    float b = hash(vec2(slot, 3.1)) * uSize.y;
    float h = 3.0 + hash(vec2(slot, 4.2)) * 12.0;
    if (abs(p.y - b) < h) p.x += (hash(vec2(slot, 7.9)) - 0.5) * 14.0;
  }
  float tr = trailAt(uTrail, uTrailGrid, px);
  // sob o rastro: mosaico de 6 px e deslocamento por linha
  vec2 q = mix(p, (floor(p / 6.0) + 0.5) * 6.0, step(0.01, tr));
  q.x += tr * (hash(vec2(floor(px.y / 6.0), floor(uTime * 12.0))) - 0.5) * 22.0;
  float a = texture(uText, q / uSize).a;
  // blocos apagados aleatórios sob o rastro
  float cell = hash(floor(px / 20.0) + floor(uTime * 10.0));
  a *= 1.0 - step(0.72, cell) * tr;
  // entrada em blocos (20 px) da esquerda para a direita
  float rv = (px.x / uSize.x) * 0.85 + hash(floor(px / 20.0)) * 0.15;
  a *= step(rv, uReveal * 1.02);
  // listras: finas e quase imperceptíveis em repouso; fortes sob o rastro
  float stripe = 0.5 + 0.5 * sin((px.y - uLoop * 36.0) * 0.85);
  float gray = 0.09 * stripe;
  gray = mix(gray, 0.15 + 0.6 * stripe, tr);
  fragColor = vec4(vec3(gray) * a, a);
}`;

export default function WordmarkFx({ host }: { host: RefObject<HTMLParagraphElement | null> }) {
  const tier = useTier();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [on, setOn] = useState(false);
  const enabled = tier === "mid" || tier === "high";
  // o rodapé é sticky atrás do <main> (sempre "em vista" para o IntersectionObserver): o WebGL só é criado quando a
  // base do <main> chega a 2 viewports — nada de contexto/shader no carregamento da página
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!enabled || near) return;
    const main = document.querySelector("main");
    if (!main) return;
    const st = ScrollTrigger.create({ trigger: main, start: "bottom 200%", end: "max", once: true, onEnter: () => setNear(true) });
    return () => st.kill();
  }, [enabled, near]);

  useEffect(() => {
    const el = host.current;
    const canvas = canvasRef.current;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = document.documentElement.dataset.tier;
    if (!el || !canvas || !enabled || !near || reduced || t === "low" || t === "reduced" || !hasWebGL2()) return;

    const dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2);
    const renderer = new Renderer({ canvas, webgl: 2, alpha: true, premultipliedAlpha: true, antialias: false, dpr });
    const gl = renderer.gl;
    if (!renderer.isWebgl2 || gl.isContextLost()) return;
    gl.clearColor(0, 0, 0, 0);

    const pt = new PixelTrail();
    const text = new Texture(gl, { flipY: false, generateMipmaps: false });
    const trail = new Texture(gl, {
      image: pt.bytes,
      width: 1,
      height: 1,
      format: gl.LUMINANCE,
      internalFormat: gl.LUMINANCE,
      type: gl.UNSIGNED_BYTE,
      minFilter: gl.NEAREST,
      magFilter: gl.NEAREST,
      generateMipmaps: false,
      flipY: false,
      unpackAlignment: 1,
    });
    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      uniforms: {
        uText: { value: text },
        uTrail: { value: trail },
        uTrailGrid: { value: [1, 1] },
        uSize: { value: [1, 1] },
        uTime: { value: 0 },
        uLoop: { value: 0 },
        uReveal: { value: 0 },
      },
    });
    if (gl.isContextLost() || !gl.getProgramParameter(program.program, gl.LINK_STATUS)) return;
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    // rasteriza o texto nas posições reais das letras (caixas "fantasma" e linha de base do DOM)
    const raster = document.createElement("canvas");
    let W = 1;
    let H = 1;
    let ready = false;
    const draw = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 2) return;
      W = r.width;
      H = r.height;
      renderer.setSize(W, H);
      const k = Math.min(window.devicePixelRatio || 1, 2);
      raster.width = Math.ceil(W * k);
      raster.height = Math.ceil(H * k);
      const ctx = raster.getContext("2d")!;
      ctx.clearRect(0, 0, raster.width, raster.height);
      ctx.scale(k, k);
      const cs = getComputedStyle(el);
      ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.fillStyle = "#000";
      ctx.textBaseline = "alphabetic";
      const base = el.querySelector<HTMLElement>(".fbig__base")?.getBoundingClientRect();
      const by = base ? base.top - r.top : H * 0.8;
      el.querySelectorAll<HTMLElement>(".fbig__ghost").forEach((g) => {
        const ch = g.textContent ?? "";
        if (!ch.trim()) return;
        ctx.fillText(ch, g.getBoundingClientRect().left - r.left, by);
      });
      text.image = raster;
      text.needsUpdate = true;
      pt.resize(W, H);
      trail.image = pt.bytes;
      trail.width = pt.cols;
      trail.height = pt.rows;
      trail.needsUpdate = true;
      program.uniforms.uSize.value = [W, H];
      program.uniforms.uTrailGrid.value = [pt.cols, pt.rows];
      ready = true;
      setOn(true);
      wake();
    };
    document.fonts?.ready.then(draw);
    window.addEventListener("fbig:fit", draw);

    let mouse: { x: number; y: number } | null = null;
    let rect: DOMRect | null = null;
    const onEnter = () => {
      rect = el.getBoundingClientRect();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      rect ??= el.getBoundingClientRect();
      mouse = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      wake();
    };
    const onLeave = () => {
      mouse = null;
      rect = null;
      pt.lift();
    };
    // toque: pulso curto (varredura horizontal de ~160 px no ponto tocado)
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      pt.lift();
      for (let dx = -80; dx <= 80; dx += 10) pt.stamp(x + dx, y, 0.9);
      wake();
    };
    const onScroll = () => {
      rect = null;
    };
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, { passive: true });

    let inView = false;
    let docVisible = document.visibilityState === "visible";
    let raf = 0;
    let prev = 0;
    let t0 = 0;
    let revealT = -1;
    let loopT = 0;
    const frame = (now: number) => {
      raf = 0;
      if (!ready) return;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      if (revealT < 0) revealT = now;
      if (mouse) pt.moveTo(mouse.x, mouse.y);
      if (pt.decay(dt)) trail.needsUpdate = true;
      // decisão Asta (v3.1): o hover pixelado assume — o loop congela com o cursor sobre o wordmark ou enquanto
      // o rastro ainda decai, e retoma depois
      if (!mouse && !pt.active) loopT += dt;
      program.uniforms.uLoop.value = loopT;
      program.uniforms.uTime.value = (now - t0) / 1000;
      program.uniforms.uReveal.value = Math.min(1, (now - revealT) / 1400);
      renderer.render({ scene: mesh });
      if (inView && docVisible) raf = requestAnimationFrame(frame);
    };
    function wake() {
      if (raf || !ready || !inView || !docVisible) return;
      prev = performance.now();
      if (!t0) t0 = prev;
      raf = requestAnimationFrame(frame);
    }
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(el);
    const onVis = () => {
      docVisible = document.visibilityState === "visible";
      if (docVisible) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("fbig:fit", draw);
      window.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", onDown);
      setOn(false);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [host, enabled, near]);

  useEffect(() => {
    const el = host.current;
    if (el) el.dataset.gl = on ? "on" : "off";
  }, [host, on]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className="fbig__canvas" aria-hidden="true" />;
}
