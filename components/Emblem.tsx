"use client";
import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { hasWebGL2 } from "@/lib/hooks";
import { NAME } from "@/lib/content";
import { EMBLEM_SRC as SRC } from "@/lib/media";
import { PixelTrail, TRAIL_CELL } from "@/lib/pixel-trail";
import { EMBER_GLSL, HASH_GLSL } from "@/lib/glsl";

/** Avatar original recortado em círculo (derivado de brand/lucas-avatar.png por scripts/derive-avatar.py). */
export const EMBLEM_SRC = SRC;
const CELL = TRAIL_CELL; // px CSS por bloco do rastro (spec Flash 1.4) — lógica do rastro em lib/pixel-trail.ts
const DISC = 474 / 512; // raio do disco / raio externo (o resto é o aro branco)
const WORD_W = 1.6; // largura do wordmark em diâmetros
const WORD_H = 0.4; // altura do quad do wordmark em diâmetros (canvas 2048×512)
const WORD_CAP = 0.29; // caixa-alta em diâmetros (spec Flash)

const vertex = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTexture;      // avatar circular (RGBA)
uniform sampler2D uOffsetTexture;
uniform sampler2D uTrail;        // grade de blocos (R), NEAREST
uniform sampler2D uWord;         // wordmark rasterizado (A)
uniform vec2 uCanvasSize;        // px CSS
uniform vec3 uEmblem;            // centro x, centro y, diâmetro (px)
uniform vec2 uTrailGrid;         // colunas, linhas
uniform vec2 uWordAspect;        // largura e altura do wordmark em diâmetros
uniform vec2 uRingOff;           // px
uniform vec2 uIllusOff;          // px
uniform float uTime;
uniform float uEdge;
uniform float uFade;
uniform float uGrain;
uniform float uHover;            // 0 = rastro desligado (touch / reduced)
in vec2 vUv;
out vec4 fragColor;

${HASH_GLSL}

vec4 avatarAt(vec2 px, vec2 off) {
  vec2 e = (px - off - (uEmblem.xy - uEmblem.z * 0.5)) / uEmblem.z;
  if (any(lessThan(e, vec2(0.0))) || any(greaterThan(e, vec2(1.0)))) return vec4(0.0);
  vec2 o = texture(uOffsetTexture, e * 1.5 + vec2(uTime * 0.021, -uTime * 0.017)).rg - 0.5;
  return texture(uTexture, e + o * 0.008 * uGrain);
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uCanvasSize;
  vec2 c = px - uEmblem.xy;
  float r = length(c) / uEmblem.z;               // 0.5 = borda externa
  float ringZone = step(${(DISC * 0.5).toFixed(4)}, r);

  // avatar: miolo com paralaxe da ilustração, aro com paralaxe oposta
  vec4 tex = mix(avatarAt(px, uIllusOff), avatarAt(px, uRingOff), ringZone);
  float lum = tex.r;
  float g = (hash(floor(px) + floor(uTime * 24.0) * 1.37) - 0.5) * 0.12 * uGrain;
  lum = clamp(lum + g * tex.a, 0.0, 1.0);
  // "têmpera": anel brasa a 1–2% respirando a 0,25 Hz no aro
  float temper = ringZone * uGrain * (0.01 + 0.01 * sin(6.2831853 * 0.25 * uTime));
  vec3 col = mix(vec3(lum), ${EMBER_GLSL}, temper);

  // rastro pixelado
  float trail = 0.0;
  if (uHover > 0.5) {
    vec2 tuv = px / (uTrailGrid * ${CELL.toFixed(1)});
    trail = smoothstep(0.05, 0.6, texture(uTrail, tuv).r);
  }
  float aA = tex.a * (1.0 - trail);

  // wordmark listrado revelado pelo rastro
  float aW = 0.0;
  float gray = 1.0;
  if (trail > 0.0) {
    vec2 wsize = uWordAspect * uEmblem.z;
    vec2 w = (c + wsize * 0.5) / wsize;
    float slot = floor(uTime * 10.0);
    if (hash(vec2(slot, 1.7)) > 0.94) {
      float b1 = hash(vec2(slot, 3.1));
      float b2 = hash(vec2(slot, 5.3));
      if (abs(w.y - b1) < 0.1 || abs(w.y - b2) < 0.1) w.x += (hash(vec2(slot, 7.9)) - 0.5) * 0.04;
    }
    vec2 n = texture(uOffsetTexture, w * 2.0 + uTime * 0.2).rg - 0.5;
    w -= n * 0.002;
    if (all(greaterThanEqual(w, vec2(0.0))) && all(lessThanEqual(w, vec2(1.0)))) {
      aW = texture(uWord, w).a * trail;
      gray = mix(0.8, 1.0, sin((w.y - uTime * 0.05) * 150.0));
    }
  }

  // máscara de scroll (mesma banda de 12%) sobre o conjunto, relativa ao disco
  float ey = (px.y - (uEmblem.y - uEmblem.z * 0.5)) / uEmblem.z;
  float edge = uEdge * 1.12;
  float m = (1.0 - smoothstep(edge - 0.12, edge, ey)) * uFade;
  vec3 rgb = col * aA + vec3(gray) * aW * (1.0 - aA);
  float a = aA + aW * (1.0 - aA);
  fragColor = vec4(rgb * m, a * m);
}`;

function makeNoise(size = 256) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  const g = 16;
  const grid = Array.from({ length: (g + 1) * (g + 1) * 2 }, () => Math.random());
  const at = (x: number, y: number, ch: number) => grid[((y % g) * (g + 1) + (x % g)) * 2 + ch];
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * g;
      const fy = (y / size) * g;
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = sm(fx - x0);
      const ty = sm(fy - y0);
      const i = (y * size + x) * 4;
      for (let ch = 0; ch < 2; ch++) {
        const a = at(x0, y0, ch) * (1 - tx) + at(x0 + 1, y0, ch) * tx;
        const b = at(x0, y0 + 1, ch) * (1 - tx) + at(x0 + 1, y0 + 1, ch) * tx;
        img.data[i + ch] = (a * (1 - ty) + b * ty) * 255;
      }
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Wordmark "LUCAS MELO" em Roboto Serif condensada 600 (fonte do projeto), largura 1,6× o disco. */
async function makeWordmark() {
  const W = 2048;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const family = '"Roboto Serif LM"';
  try {
    await document.fonts.load(`600 200px ${family}`);
  } catch {
    /* usa o fallback serifado */
  }
  const setFont = (px: number) => {
    ctx.font = `600 ${px}px ${family}, Georgia, serif`;
    (ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = "ultra-condensed";
  };
  // quad = 1,6D × 0,4D (W×H). Caixa-alta = 0,29D → 0,29/0,4·H px; largura = 98% de W (escala só em X,
  // independe de o eixo wdth condensar no canvas).
  const capTarget = (WORD_CAP / WORD_H) * H;
  setFont(100);
  const m = ctx.measureText(NAME);
  const cap100 = m.actualBoundingBoxAscent || 70;
  const size = (100 * capTarget) / cap100;
  setFont(size);
  const w = ctx.measureText(NAME).width;
  const sx = (W * 0.98) / w;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.save();
  ctx.translate(W / 2, H / 2 + capTarget / 2);
  ctx.scale(sx, 1);
  ctx.fillText(NAME, 0, 0);
  ctx.restore();
  return c;
}

/** Curva lenta no fim (ease-out cúbica): emblema cheio em ~5,4s, como no comparativo Flash. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Emblema do hero: avatar de Lucas no shader OGL com grão, máscara por scroll (uEdge), rastro pixelado no hover
 * que revela o wordmark listrado, glitch e paralaxe. Sem WebGL2: <img> com mask-image ligada ao mesmo valor.
 * A <img> é o conteúdo sem JS. Touch e reduced-motion: sem rastro (estático).
 */
/** v4: `gl` = false (tier low/reduced) mantém só o <img>; o tamanho vem do CSS (--emblem-size) via o <img>. */
export default function Emblem({ gl: glOn = true, alt }: { gl?: boolean; alt: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [gl, setGl] = useState<"pending" | "on" | "off">("pending");

  const { scrollY } = useScroll();
  // [ajuste dos comparativos v1/v2] linear 110→690: 300px ≈ 0,67 · 500px ≈ 0,33 na entrada da banda
  const edge = useTransform(scrollY, [0, 110, 690], [1, 1, 0]);
  const edgeRef = useRef(1);
  const wakeRef = useRef<() => void>(() => {});

  const applyImgMask = (v: number) => {
    // v5.1: estado compartilhado com as palavras da hero (HeroWord): mesma máscara de scroll, mesma função de v
    wrapRef.current?.parentElement?.style.setProperty("--em-end", v >= 1 ? "200%" : `${(v * 112).toFixed(2)}%`);
    const img = imgRef.current;
    if (!img) return;
    if (v >= 1) {
      img.style.maskImage = "";
      img.style.webkitMaskImage = "";
      return;
    }
    const end = v * 112;
    const m = `linear-gradient(to bottom, #000 ${end - 12}%, transparent ${end}%)`;
    img.style.maskImage = m;
    img.style.webkitMaskImage = m;
  };

  useMotionValueEvent(edge, "change", (v) => {
    edgeRef.current = v;
    applyImgMask(v);
    wakeRef.current();
  });

  useEffect(() => {
    edgeRef.current = edge.get();
    applyImgMask(edgeRef.current);
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!glOn || !canvas || !wrap) {
      setGl("off");
      return;
    }
    if (!hasWebGL2()) {
      setGl("off");
      return;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const hoverOn = fine && !reduced;
    const intro = document.documentElement.dataset.intro === "run";
    const renderer = new Renderer({
      canvas,
      webgl: 2,
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      dpr: Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2), // v5: ≤1,5 no toque
    });
    const glc = renderer.gl;
    if (!renderer.isWebgl2 || glc.isContextLost()) {
      setGl("off");
      return;
    }
    glc.clearColor(0, 0, 0, 0);

    const texture = new Texture(glc, { flipY: false, generateMipmaps: true });
    const offset = new Texture(glc, { image: makeNoise(), wrapS: glc.REPEAT, wrapT: glc.REPEAT, flipY: false });
    const word = new Texture(glc, { flipY: false, generateMipmaps: true });
    // rastro: 1 byte por bloco, NEAREST, reenviado por quadro só enquanto há rastro (lib/pixel-trail.ts)
    const pt = new PixelTrail();
    const trail = new Texture(glc, {
      image: pt.bytes,
      width: 1,
      height: 1,
      format: glc.LUMINANCE,
      internalFormat: glc.LUMINANCE,
      type: glc.UNSIGNED_BYTE,
      minFilter: glc.NEAREST,
      magFilter: glc.NEAREST,
      generateMipmaps: false,
      flipY: false,
      unpackAlignment: 1,
    });

    const program = new Program(glc, {
      vertex,
      fragment,
      transparent: true,
      uniforms: {
        uTexture: { value: texture },
        uOffsetTexture: { value: offset },
        uTrail: { value: trail },
        uWord: { value: word },
        uCanvasSize: { value: [1, 1] },
        uEmblem: { value: [0, 0, 1] },
        uTrailGrid: { value: [1, 1] },
        uWordAspect: { value: [WORD_W, WORD_H] },
        uRingOff: { value: [0, 0] },
        uIllusOff: { value: [0, 0] },
        uTime: { value: 0 },
        uEdge: { value: 1 },
        uFade: { value: 0 },
        uGrain: { value: reduced ? 0 : 1 },
        uHover: { value: hoverOn ? 1 : 0 },
      },
    });
    // v5: contexto perdido / shader sem link → mantém o <img> (fallback), sem lançar no render
    if (glc.isContextLost() || !glc.getProgramParameter(program.program, glc.LINK_STATUS)) {
      setGl("off");
      return;
    }
    const mesh = new Mesh(glc, { geometry: new Triangle(glc), program });

    let ready = false;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      texture.image = img;
      ready = true;
      setGl("on");
      wake();
    };
    img.src = EMBLEM_SRC;
    if (hoverOn)
      makeWordmark().then((c) => {
        word.image = c;
        program.uniforms.uWordAspect.value = [WORD_W, WORD_H];
      });

    let W = 1;
    let H = 1;
    let D = 1;
    const resize = () => {
      W = wrap.clientWidth;
      H = wrap.clientHeight;
      renderer.setSize(W, H);
      const im = imgRef.current;
      const wr = wrap.getBoundingClientRect();
      const ir = im?.getBoundingClientRect();
      D = ir && ir.width > 0 ? ir.width : Math.min(window.innerHeight * 0.46, window.innerWidth * 0.4);
      const cx = ir && ir.width > 0 ? ir.left - wr.left + ir.width / 2 : W / 2;
      const cy = ir && ir.width > 0 ? ir.top - wr.top + ir.height / 2 : H / 2;
      program.uniforms.uCanvasSize.value = [W, H];
      program.uniforms.uEmblem.value = [cx, cy, D];
      pt.resize(W, H);
      trail.image = pt.bytes;
      trail.width = pt.cols;
      trail.height = pt.rows;
      trail.needsUpdate = true;
      program.uniforms.uTrailGrid.value = [pt.cols, pt.rows];
      wake();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ponteiro: rastro + paralaxe
    let mouse: { x: number; y: number } | null = null;
    const ring = [0, 0];
    const illus = [0, 0];
    const host = wrap.parentElement ?? wrap;
    const shared = [0, 0];
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const r = wrap.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      wake();
    };
    const onLeave = () => {
      mouse = null;
      pt.lift();
    };
    if (hoverOn) {
      host.addEventListener("pointermove", onMove);
      host.addEventListener("pointerleave", onLeave);
    }

    const fadeAt = (now: number) =>
      !intro || reduced ? 1 : easeOut(Math.max(0, Math.min(1, (now - 4500) / 900)));

    let inView = true;
    let docVisible = document.visibilityState === "visible";
    let raf = 0;
    let running = false;
    const t0 = performance.now();
    let prev = t0;

    const updateTrail = (dt: number) => {
      if (!hoverOn) return;
      const e = edgeRef.current;
      if (mouse && e > 0) pt.moveTo(mouse.x, mouse.y);
      // decaimento por quadro a 60fps, normalizado por dt
      if (pt.decay(dt)) trail.needsUpdate = true;
      // paralaxe: aro até 6px (oposto), ilustração até 3px; lerp 0,15/quadro
      let tr = [0, 0];
      let ti = [0, 0];
      if (mouse) {
        const mx = Math.max(-1, Math.min(1, (mouse.x - W / 2) / (D / 2)));
        const my = Math.max(-1, Math.min(1, (mouse.y - H / 2) / (D / 2)));
        tr = [-6 * mx, -6 * my];
        ti = [3 * mx, 3 * my];
      }
      const a = 1 - Math.pow(0.85, dt * 60);
      ring[0] += (tr[0] - ring[0]) * a;
      ring[1] += (tr[1] - ring[1]) * a;
      illus[0] += (ti[0] - illus[0]) * a;
      illus[1] += (ti[1] - illus[1]) * a;
      program.uniforms.uRingOff.value = ring;
      program.uniforms.uIllusOff.value = illus;
      // v5.1: a paralaxe do aro vale também para as palavras da hero (lidas em CSS: --em-ox/--em-oy)
      if (Math.abs(ring[0] - shared[0]) > 0.05 || Math.abs(ring[1] - shared[1]) > 0.05) {
        shared[0] = ring[0];
        shared[1] = ring[1];
        host.style.setProperty("--em-ox", `${ring[0].toFixed(2)}px`);
        host.style.setProperty("--em-oy", `${ring[1].toFixed(2)}px`);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (!ready) return;
      const dt = Math.min(0.1, (now - prev) / 1000);
      prev = now;
      const fade = fadeAt(now);
      const e = edgeRef.current;
      updateTrail(dt);
      program.uniforms.uTime.value = reduced ? 0 : (now - t0) / 1000;
      program.uniforms.uEdge.value = e;
      program.uniforms.uFade.value = fade;
      renderer.render({ scene: mesh });
      const animating = !reduced || fade < 1;
      if (inView && docVisible && e > 0 && animating) raf = requestAnimationFrame(frame);
      else running = false;
    };
    function wake() {
      if (!ready || raf) return;
      if (!inView || !docVisible) return;
      running = true;
      prev = performance.now();
      raf = requestAnimationFrame(frame);
    }
    wakeRef.current = () => {
      if (!running) wake();
    };

    const io = new IntersectionObserver(([en]) => {
      inView = en.isIntersecting;
      if (inView) wake();
    });
    io.observe(wrap);
    const onVis = () => {
      docVisible = document.visibilityState === "visible";
      if (docVisible) wake();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeave);
      wakeRef.current = () => {};
      glc.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [edge, glOn]);

  return (
    <div className="emblem" ref={wrapRef} data-gl={gl} data-asset="avatar">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        className="emblem__img"
        src={EMBLEM_SRC}
        alt={alt}
        width={1024}
        height={1024}
      />
      {glOn && <canvas ref={canvasRef} className="emblem__canvas" aria-hidden="true" />}
    </div>
  );
}
