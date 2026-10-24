"use client";
import { useEffect, useRef, useState } from "react";
import { Mesh, Program, Renderer, Triangle } from "ogl";
import { hasWebGL2 } from "@/lib/hooks";

const vertex = /* glsl */ `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform float u_time;
uniform vec2 u_res;  // px de dispositivo
uniform float u_dpr;
out vec4 fragColor;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }

// tracos finos diagonais: direita-cima -> esquerda-baixo
float rain(float t) {
  vec2 p = gl_FragCoord.xy / u_res.y;
  float a = -0.42;
  mat2 r = mat2(cos(a), -sin(a), sin(a), cos(a));
  vec2 q = r * p;
  float cols = 9.0;
  float cx = floor(q.x * cols);
  float fx = (fract(q.x * cols) - 0.5) / cols;
  float rnd = h1(cx);
  float rnd2 = h1(cx + 31.7);
  if (rnd2 < 0.35) return 0.0;
  float speed = 0.9 + rnd * 0.9;
  float len = 0.10 + rnd2 * 0.16;
  float period = 1.6 + rnd * 1.4;
  float y = fract(q.y / period + t * speed / period + rnd * 9.0) * period;
  float head = smoothstep(0.0, 0.015, y) * (1.0 - smoothstep(len * 0.6, len, y));
  float w = 0.6 / u_res.y * u_dpr;
  float line = 1.0 - smoothstep(w, w * 2.2, abs(fx + (rnd - 0.5) * 0.06 / cols));
  return line * head;
}

void main() {
  float r = rain(u_time);
  float fadeBottom = smoothstep(0.0, 0.35, gl_FragCoord.y / u_res.y);
  float opacity = 0.65;
  float a = r * opacity * fadeBottom;
  fragColor = vec4(vec3(a), a);
}`;

/** Chuva da seção Agência: OGL, innerWidth x 0.6*innerHeight, 12fps, pausa fora de vista. */
export default function Rain() {
  const ref = useRef<HTMLCanvasElement>(null);
  const [off, setOff] = useState(false);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (!hasWebGL2()) {
      setOff(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, window.matchMedia("(pointer: coarse)").matches ? 1.5 : 2); // v5: ≤1,5 no toque
    const renderer = new Renderer({ canvas, webgl: 2, alpha: true, premultipliedAlpha: true, dpr });
    if (!renderer.isWebgl2 || renderer.gl.isContextLost()) {
      setOff(true);
      return;
    }
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      uniforms: { u_time: { value: 3.7 }, u_res: { value: [1, 1] }, u_dpr: { value: dpr } },
    });
    // v5: contexto perdido ou shader sem link (GPU bloqueada, SwiftShader recusado) → fallback estático, sem
    // derrubar a página (antes o OGL lançava "uniforms.forEach" no 1º render e o React desmontava a árvore).
    if (gl.isContextLost() || !gl.getProgramParameter(program.program, gl.LINK_STATUS)) {
      setOff(true);
      return;
    }
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight * 0.6);
      program.uniforms.u_res.value = [gl.canvas.width, gl.canvas.height];
      renderer.render({ scene: mesh });
    };
    resize();
    window.addEventListener("resize", resize);

    let raf = 0;
    let last = 0;
    let frames = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 1000 / 12) return;
      last = now;
      frames += 1;
      canvas.dataset.frames = String(frames);
      program.uniforms.u_time.value = 3.7 + (now - t0) / 1000;
      renderer.render({ scene: mesh });
    };
    const start = () => {
      if (!raf && !reduced) raf = requestAnimationFrame(loop);
      canvas.dataset.running = String(raf !== 0);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      canvas.dataset.running = "false";
    };
    let inView = false;
    const io = new IntersectionObserver(([e]) => {
      inView = e.isIntersecting;
      if (inView && document.visibilityState === "visible") start();
      else stop();
    });
    io.observe(canvas);
    const onVis = () => (document.visibilityState === "visible" && inView ? start() : stop());
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stop();
      io.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  if (off) return null;
  return <canvas ref={ref} className="rain" aria-hidden="true" data-asset="procedural" />;
}
