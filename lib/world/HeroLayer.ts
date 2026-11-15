"use client";
// Hero da Home — DIAL + SINAL (pedido de Lucas 12/11; protótipos proposals/hero-about/js/h2.js + h3.js):
//  · DIAL: emblema no centro, cercado por um anel de 8 monólitos com as capturas dos projetos; arrastar gira com
//    inércia e encaixe a cada 45°; hover mostra o projeto; clique abre /works/[slug].
//  · SINAL: a cena inteira é renderizada em ASCII brasa/branco; o cursor é uma lente (com rastro halftone) que revela
//    a imagem real; clique em área vazia = pulso.
//  · Scroll (p, scrub reversível): ASCII → real enquanto a câmera desce em espiral para dentro do anel e os monólitos
//    tombam como pétalas; termina no MESMO morph emblema → tela do reel (trecho q, preservado da etapa 2).
// Tudo no mesmo World/ticker; pausa fora de vista e com o player aberto (Home controla `object.visible`).
import * as THREE from "three";
import type { World, WorldLayer } from "./World";

const TAN = Math.tan(THREE.MathUtils.degToRad(35 / 2));
const FLOOR_Y = -2.2;
const RING_R = 5.2;
const SCREEN_DEPTH = 5;
const EMB_Y = 1.9;
const EMB_SIZE = 3.4;
const STEP = Math.PI / 4;
const TAU = Math.PI * 2;
const MON_W = 1.9;
const MON_H = 3.0;

const sstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const inOut2 = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const outQuart = (t: number) => 1 - Math.pow(1 - clamp01(t), 4);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------- chuva (InstancedMesh, animada no vertex shader) ----------------
const rainVert = /* glsl */ `
attribute vec4 aPos;
attribute vec2 aInfo;
uniform float uTime, uLen, uWidth;
uniform vec3 uBoxMin, uBoxSize;
varying float vEmber;
varying float vFade;
void main() {
  vec2 dir = normalize(vec2(0.35, -1.0));
  vec2 perp = vec2(-dir.y, dir.x);
  float travel = uBoxSize.y * 1.15;
  float s = fract(aPos.w + uTime * aInfo.x / travel);
  vec3 base = vec3(aPos.x, uBoxMin.y + uBoxSize.y, aPos.z);
  base.xy += dir * s * travel;
  base.x = uBoxMin.x + mod(base.x - uBoxMin.x, uBoxSize.x);
  vec3 p = base;
  p.xy += dir * position.y * uLen + perp * position.x * uWidth;
  vEmber = aInfo.y;
  vFade = smoothstep(0.0, 0.12, s) * (1.0 - smoothstep(0.85, 1.0, s));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;
const rainFrag = /* glsl */ `
uniform float uAlpha;
varying float vEmber;
varying float vFade;
void main() {
  vec3 col = mix(vec3(1.0), vec3(0.76, 0.043, 0.13), vEmber);
  gl_FragColor = vec4(col, uAlpha * vFade * mix(1.0, 1.6, vEmber));
}
`;

// ---------------- emblema → tela do reel (o MESMO morph da etapa 2; agora com o emblema em billboard) ----------------
const screenVert = /* glsl */ `
uniform vec3 uWPos;
uniform float uWSize, uM, uDepth, uCurve, uHover, uInflate;
uniform vec4 uRect;
uniform vec2 uHoverUV;
uniform float uFit;
uniform vec3 uCircle;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec2 q = (uv - 0.5) * (1.0 + uInflate);
  // billboard: o emblema sempre encara a câmera enquanto ela gira em espiral
  vec4 mv = viewMatrix * vec4(uWPos, 1.0) + vec4(q.x * uWSize, q.y * uWSize, 0.0, 0.0);
  vec4 cv = vec4(uCircle.x + q.x * uCircle.z, uCircle.y + q.y * uCircle.z, -uDepth, 1.0);
  mv = mix(mv, cv, uFit);
  float cx = 2.0 * uv.x - 1.0;
  vec2 hd = (uv - uHoverUV) * vec2(uRect.z / uRect.w, 1.0);
  vec4 fv = vec4(uRect.x + q.x * uRect.z, uRect.y + q.y * uRect.w, -uDepth + uCurve * cx * cx + uHover * 0.1 * exp(-dot(hd, hd) / 0.06), 1.0);
  gl_Position = projectionMatrix * mix(mv, fv, uM);
}
`;
const screenFrag = /* glsl */ `
uniform sampler2D uEmblem, uVideo;
uniform float uM, uV, uAspect, uRadPx, uRectHpx, uAlpha, uTime, uHasVideo, uMode, uMask, uDim;
varying vec2 vUv;
float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float aspect = mix(1.0, uAspect, uM);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);
  float rad = mix(0.5, uRadPx / uRectHpx, uM);
  float d = sdRound(p, vec2(aspect, 1.0) * 0.5, rad);
  float aa = max(fwidth(d), 1e-4);
  if (uMode > 0.5) {
    float line = 1.0 - smoothstep(0.0, aa * 1.6, abs(d + 0.004));
    gl_FragColor = vec4(vec3(1.0), line * uAlpha);
    return;
  }
  float mask = 1.0 - smoothstep(-aa, aa, d);
  if (mask <= 0.001) discard;
  vec2 ev = (vUv - 0.5) * vec2(aspect, 1.0) / mix(1.0, aspect, uM * 0.6) + 0.5;
  vec4 em = texture2D(uEmblem, clamp(ev, 0.0, 1.0));
  vec2 vv = vUv;
  float va = 16.0 / 9.0;
  if (aspect > va) vv.y = (vv.y - 0.5) * (va / aspect) + 0.5; else vv.x = (vv.x - 0.5) * (aspect / va) + 0.5;
  vec3 vid = texture2D(uVideo, vv).rgb * uHasVideo + vec3(0.04) * (1.0 - uHasVideo);
  vec3 col = mix(em.rgb * em.a * uDim, vid, uV);
  col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.06 * (1.0 - uV);
  float m = smoothstep(uMask - 0.02, uMask + 0.02, vUv.y);
  gl_FragColor = vec4(col, mask * uAlpha * mix(em.a, 1.0, uV) * m);
}
`;

// marcas do dial em billboard em volta do emblema
const tickVert = /* glsl */ `
uniform float uScale, uSpin;
uniform vec3 uCenter;
void main() {
  float c = cos(uSpin), s = sin(uSpin);
  vec2 p = position.xy * uScale;
  p = vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  vec4 mv = viewMatrix * vec4(uCenter, 1.0) + vec4(p, 0.0, 0.0);
  gl_Position = projectionMatrix * mv;
}
`;
const tickFrag = /* glsl */ `
uniform float uAlpha;
void main() { gl_FragColor = vec4(vec3(1.0), uAlpha); }
`;

// monólito: captura do projeto, borda em brasa no hover/frente
const monVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const monFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uHas, uH, uF, uO, uTexA, uBoxA;
varying vec2 vUv;
void main() {
  vec2 u = vUv;
  if (uBoxA < uTexA) u.x = (u.x - 0.5) * (uBoxA / uTexA) + 0.5; else u.y = (u.y - 0.5) * (uTexA / uBoxA) + 0.5;
  vec3 c = mix(vec3(0.08), texture2D(uMap, u).rgb, uHas);
  c *= mix(0.62, 1.05, uH);
  float e = max(max(step(vUv.x, 0.012), step(0.988, vUv.x)), max(step(vUv.y, 0.008), step(0.992, vUv.y)));
  c = mix(c, vec3(0.76, 0.043, 0.13), min(1.0, e * (0.35 + uF + uH)));
  gl_FragColor = vec4(c, uO);
}
`;

// pós SINAL: ASCII + lente + rastro halftone + pulso
const GLYPHS = " .:-=+*#%@|/";
const fsVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
const postFrag = /* glsl */ `
uniform sampler2D uScene, uTrail, uG;
uniform float uN, uCell, uLensR, uReal, uDen, uTime, uRing, uHalf;
uniform vec2 uRes, uMouse;
varying vec2 vUv;
float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
void main() {
  vec2 px = vUv * uRes;
  vec2 id = floor(px / uCell);
  vec2 cu = fract(px / uCell);
  vec3 sc = texture2D(uScene, (id + 0.5) * uCell / uRes).rgb;
  float l = clamp(pow(dot(sc, vec3(0.299, 0.587, 0.114)) * 1.8, 0.6), 0.0, 1.0) * uDen;
  float rows = uRes.y / uCell;
  float hc = h1(id.x + 1.0);
  float on = step(0.72, hc);
  float head = mod(hc * rows * 3.0 + uTime * (5.0 + hc * 9.0), rows + 14.0);
  float tail = head - (rows - id.y);
  float rainA = on * step(0.0, tail) * (1.0 - smoothstep(0.0, 12.0, tail)) * uDen;
  float gi = floor(clamp(l, 0.0, 0.999) * 10.0);
  vec3 tint = mix(vec3(0.30), vec3(0.95), l);
  // brasa nos tons médios (RITO): o campo é branco/cinza com veios em brasa
  tint = mix(tint, vec3(0.76, 0.043, 0.13) * 1.5, smoothstep(0.25, 0.5, l) * (1.0 - smoothstep(0.55, 0.8, l)) * 0.65);
  if (rainA * 0.7 > l) { gi = hc > 0.86 ? 11.0 : 10.0; tint = mix(vec3(0.25), vec3(0.76, 0.04, 0.13) * 1.4, step(tail, 1.0)); l = rainA * 0.7; }
  float g = texture2D(uG, vec2((gi + cu.x) / uN, cu.y)).r;
  vec3 ascii = tint * g;
  vec3 real = texture2D(uScene, vUv).rgb;
  float tr = texture2D(uTrail, vUv).r * uHalf;
  float dl = length(px - uMouse);
  float lens = 1.0 - smoothstep(uLensR - 1.5, uLensR + 0.5, dl);
  vec2 hc2 = fract(px / 5.0) - 0.5;
  float hd = step(length(hc2), sqrt(dot(real, vec3(0.333))) * 0.62);
  vec3 halftone = real * hd * 1.2;
  vec3 col = mix(ascii, halftone, clamp(tr * 1.4, 0.0, 1.0) * (1.0 - lens));
  col = mix(col, real, max(lens, uReal));
  col += vec3(0.76, 0.043, 0.13) * (1.0 - smoothstep(0.0, 1.6, abs(dl - uLensR))) * uRing;
  gl_FragColor = vec4(col, 1.0);
}
`;
const trailFrag = /* glsl */ `
uniform sampler2D uPrev;
uniform vec2 uA, uB, uRes;
uniform float uR, uDecay, uOn;
varying vec2 vUv;
void main() {
  vec2 px = vUv * uRes;
  vec2 pa = px - uA, ba = uB - uA;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  float d = length(pa - ba * h);
  float brush = (1.0 - smoothstep(uR * 0.45, uR, d)) * uOn;
  float prev = texture2D(uPrev, vUv).r * uDecay;
  gl_FragColor = vec4(max(prev, brush), 0.0, 0.0, 1.0);
}
`;

type Mon = { box: THREE.Mesh; pivot: THREE.Group; mat: THREE.ShaderMaterial; h: number };
export type DialProject = { slug: string; name: string; texture: string };

export class HeroLayer implements WorldLayer {
  object = new THREE.Group();
  world: World;
  p = 0;
  q = 0;
  active = true;
  reduced: boolean;
  lite: boolean;
  narrow = false;
  rainA: THREE.Mesh;
  ringG = new THREE.Group();
  mons: Mon[] = [];
  screen: THREE.Mesh;
  frame: THREE.Mesh;
  ticks: THREE.LineSegments;
  screenMat: THREE.ShaderMaterial;
  frameMat: THREE.ShaderMaterial;
  tickMat: THREE.ShaderMaterial;
  rainMat!: THREE.ShaderMaterial;
  video: HTMLVideoElement | null = null;
  vtex: THREE.VideoTexture | null = null;
  emblem: THREE.Texture;
  tilt = { x: 0, y: 0, tx: 0, ty: 0 };
  hover = { on: 0, t: 0, u: 0.5, v: 0.5 };
  /** retângulo da tela do reel em px (botão DOM e moldura HUD) */
  rectPx = { x: 0, y: 0, w: 0, h: 0 };
  /** centro/raio do emblema em px (palavras-chave ao redor) */
  embPx = { x: 0, y: 0, r: 0 };
  /** monólito de frente e sob o cursor (para o HUD/tooltip) */
  front = 0;
  hoverIdx = -1;
  projects: DialProject[];
  // SINAL
  private rt: THREE.WebGLRenderTarget;
  private trailA: THREE.WebGLRenderTarget;
  private trailB: THREE.WebGLRenderTarget;
  private trailMat: THREE.ShaderMaterial;
  private postMat: THREE.ShaderMaterial;
  private fsScene = new THREE.Scene();
  private trailScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private ptr = { x: 0, y: 0, inside: false, type: "mouse", lastMove: -1e9 };
  private lens = { x: 0, y: 0, k: 0, pulse: 0 };
  private lastTrail: THREE.Vector2 | null = null;
  private born = -1;
  // dial
  private ang = 0;
  private vel = 0;
  private snapTo: number | null = null;
  private drag = { on: false, x: 0, last: 0, moved: 0 };
  private ray = new THREE.Raycaster();
  private v2 = new THREE.Vector2();
  private clock = 0;
  private rainMats: THREE.ShaderMaterial[] = [];

  constructor(world: World, opts: { reduced: boolean; lite: boolean; videoSrc: string; projects: DialProject[] }) {
    this.world = world;
    this.reduced = opts.reduced;
    this.lite = opts.lite;
    this.projects = opts.projects;
    this.object.name = "HeroLayer";
    this.narrow = window.innerWidth < 768;

    const total = opts.lite ? 220 : 650;
    this.rainA = this.makeRain(total, new THREE.Vector3(-14, -3, -14), new THREE.Vector3(28, 14, 28), 0.4);

    // monólitos (8 capturas reais dos projetos)
    const loader = new THREE.TextureLoader();
    const side = new THREE.MeshBasicMaterial({ color: 0x0e0e0e });
    const R = this.narrow ? RING_R * 0.82 : RING_R;
    this.mons = this.projects.map((pr, i) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: monVert,
        fragmentShader: monFrag,
        uniforms: {
          uMap: { value: null }, uHas: { value: 0 }, uH: { value: 0 }, uF: { value: 0 }, uO: { value: 1 },
          uTexA: { value: 16 / 9 }, uBoxA: { value: MON_W / MON_H },
        },
        transparent: true,
      });
      loader.load(pr.texture, (t) => {
        t.colorSpace = THREE.NoColorSpace;
        mat.uniforms.uMap.value = t;
        mat.uniforms.uHas.value = 1;
        const img = t.image as HTMLImageElement;
        mat.uniforms.uTexA.value = img.width / img.height;
      });
      const box = new THREE.Mesh(new THREE.BoxGeometry(MON_W, MON_H, 0.1), [side, side, side, side, mat, side]);
      box.position.y = MON_H / 2;
      box.userData.i = i;
      const pivot = new THREE.Group();
      const a = i * STEP;
      pivot.position.set(Math.sin(a) * R, FLOOR_Y, Math.cos(a) * R);
      pivot.rotation.y = a;
      pivot.add(box);
      this.ringG.add(pivot);
      return { box, pivot, mat, h: 0 };
    });

    this.emblem = loader.load("/brand/avatar-emblem.webp");
    this.emblem.colorSpace = THREE.NoColorSpace;
    const blank = new THREE.DataTexture(new Uint8Array([10, 10, 10, 255]), 1, 1);
    blank.needsUpdate = true;
    const su = () => ({
      uWPos: { value: new THREE.Vector3(0, EMB_Y, 0) }, uWSize: { value: EMB_SIZE }, uM: { value: 0 }, uDepth: { value: SCREEN_DEPTH },
      uCurve: { value: 0 }, uHover: { value: 0 }, uHoverUV: { value: new THREE.Vector2(0.5, 0.5) }, uInflate: { value: 0 },
      uRect: { value: new THREE.Vector4(0, 0, 1, 0.5625) },
      uEmblem: { value: this.emblem }, uVideo: { value: blank }, uHasVideo: { value: 0 },
      uV: { value: 0 }, uAspect: { value: 16 / 9 }, uRadPx: { value: 16 }, uRectHpx: { value: 400 },
      uAlpha: { value: 1 }, uTime: { value: 0 }, uMode: { value: 0 }, uMask: { value: -0.1 },
      uFit: { value: 0 }, uCircle: { value: new THREE.Vector3(0, 0, 1) }, uDim: { value: 0.9 },
    });
    this.screenMat = new THREE.ShaderMaterial({ vertexShader: screenVert, fragmentShader: screenFrag, uniforms: su(), transparent: true, depthTest: false, depthWrite: false });
    this.frameMat = new THREE.ShaderMaterial({ vertexShader: screenVert, fragmentShader: screenFrag, uniforms: su(), transparent: true, depthTest: false, depthWrite: false });
    this.frameMat.uniforms.uMode.value = 1;
    const sg = new THREE.PlaneGeometry(1, 1, 48, 24);
    this.screen = new THREE.Mesh(sg, this.screenMat);
    this.frame = new THREE.Mesh(sg, this.frameMat);
    this.screen.frustumCulled = this.frame.frustumCulled = false;
    this.screen.renderOrder = 5;
    this.frame.renderOrder = 6;

    const tp: number[] = [];
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * TAU;
      const r1 = i % 6 === 0 ? 0.56 : 0.53;
      tp.push(Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0, Math.cos(a) * r1, Math.sin(a) * r1, 0);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3));
    this.tickMat = new THREE.ShaderMaterial({
      vertexShader: tickVert,
      fragmentShader: tickFrag,
      uniforms: { uScale: { value: EMB_SIZE * 1.15 }, uSpin: { value: 0 }, uCenter: { value: new THREE.Vector3(0, EMB_Y, 0) }, uAlpha: { value: 0.35 } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.ticks = new THREE.LineSegments(tg, this.tickMat);
    this.ticks.frustumCulled = false;
    this.ticks.renderOrder = 4;
    this.object.add(this.ringG, this.rainA, this.ticks, this.screen, this.frame);

    // SINAL: alvos de render, rastro e pós
    const half = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: opts.lite ? 0 : 4 });
    this.trailA = new THREE.WebGLRenderTarget(4, 4, half);
    this.trailB = new THREE.WebGLRenderTarget(4, 4, half);
    this.trailMat = new THREE.ShaderMaterial({
      vertexShader: fsVert,
      fragmentShader: trailFrag,
      uniforms: { uPrev: { value: null }, uA: { value: new THREE.Vector2() }, uB: { value: new THREE.Vector2() }, uR: { value: 80 }, uDecay: { value: 0.95 }, uOn: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
      depthTest: false,
      depthWrite: false,
    });
    this.trailScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.trailMat));
    this.postMat = new THREE.ShaderMaterial({
      vertexShader: fsVert,
      fragmentShader: postFrag,
      uniforms: {
        uScene: { value: this.rt.texture }, uTrail: { value: this.trailA.texture }, uG: { value: this.glyphAtlas() }, uN: { value: GLYPHS.length },
        uCell: { value: this.narrow ? 13 : 10 }, uRes: { value: new THREE.Vector2(1, 1) }, uMouse: { value: new THREE.Vector2(-999, -999) },
        uLensR: { value: 0 }, uReal: { value: 0 }, uDen: { value: 1 }, uTime: { value: 0 }, uRing: { value: 0 }, uHalf: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat));

    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "none";
    v.src = opts.videoSrc;
    v.setAttribute("aria-hidden", "true");
    this.video = v;
  }

  private glyphAtlas() {
    const S = 48;
    const c = document.createElement("canvas");
    c.width = S * GLYPHS.length;
    c.height = S;
    const x = c.getContext("2d")!;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    const draw = () => {
      x.clearRect(0, 0, c.width, S);
      x.fillStyle = "#fff";
      x.font = `500 ${S * 0.78}px "Martian Mono Variable", "Martian Mono", ui-monospace, monospace`;
      x.textAlign = "center";
      x.textBaseline = "middle";
      [...GLYPHS].forEach((g, i) => x.fillText(g, i * S + S / 2, S * 0.54));
      tex.needsUpdate = true;
    };
    draw();
    document.fonts?.ready.then(draw).catch(() => {});
    return tex;
  }

  private makeRain(n: number, min: THREE.Vector3, size: THREE.Vector3, alpha: number) {
    const g = new THREE.InstancedBufferGeometry();
    const quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute("position", quad.getAttribute("position"));
    g.instanceCount = n;
    const pos = new Float32Array(n * 4);
    const info = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      pos[i * 4] = min.x + Math.random() * size.x;
      pos[i * 4 + 2] = min.z + Math.random() * size.z;
      pos[i * 4 + 3] = Math.random();
      info[i * 2] = 3 + Math.random() * 3.5;
      info[i * 2 + 1] = Math.random() < 0.06 ? 1 : 0;
    }
    g.setAttribute("aPos", new THREE.InstancedBufferAttribute(pos, 4));
    g.setAttribute("aInfo", new THREE.InstancedBufferAttribute(info, 2));
    const m = new THREE.ShaderMaterial({
      vertexShader: rainVert,
      fragmentShader: rainFrag,
      uniforms: { uTime: { value: 0 }, uLen: { value: 0.42 }, uWidth: { value: 0.014 }, uAlpha: { value: alpha }, uBoxMin: { value: min.clone() }, uBoxSize: { value: size.clone() } },
      transparent: true,
      depthWrite: false,
    });
    this.rainMats.push(m);
    this.rainMat = m;
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    return mesh;
  }

  /** nova visita à Home: intro do anel/lente e estado de interação idênticos à 1ª visita */
  resetVisit() {
    this.born = -1;
    this.lens = { x: this.world.vw / 2, y: this.world.vh / 2, k: 0, pulse: 0 };
    this.drag = { on: false, x: 0, last: 0, moved: 0 };
    this.vel = 0;
    this.snapTo = null;
    this.lastTrail = null;
    this.hoverIdx = -1;
  }

  // ---------------- entrada (Home encaminha eventos do DOM) ----------------
  pointer(nx: number, ny: number) {
    this.tilt.tx = nx;
    this.tilt.ty = ny;
  }
  pointerPx(x: number, y: number, inside: boolean, type: string) {
    this.ptr.x = x;
    this.ptr.y = y;
    this.ptr.inside = inside;
    this.ptr.type = type;
    this.ptr.lastMove = performance.now();
  }
  /** hover na tela do reel (trecho q) */
  setHover(px: number, py: number) {
    const r = this.rectPx;
    const inside = px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h && this.q > 0.6;
    this.hover.t = inside ? 1 : 0;
    if (inside) {
      this.hover.u = (px - r.x) / r.w;
      this.hover.v = 1 - (py - r.y) / r.h;
    }
  }
  dragStart(x: number) {
    this.drag = { on: true, x, last: x, moved: 0 };
    this.snapTo = null;
  }
  dragMove(x: number, dt = 1 / 60) {
    if (!this.drag.on) return;
    const d = (x - this.drag.last) * (this.narrow ? 0.012 : 0.006);
    this.drag.moved += Math.abs(x - this.drag.last);
    this.drag.last = x;
    this.ang += d;
    this.vel = mix(this.vel, d / Math.max(dt, 1 / 120), 0.3);
  }
  dragEnd() {
    const moved = this.drag.moved;
    this.drag.on = false;
    return moved;
  }
  /** gira até o projeto i (teclado / lista) */
  goTo(i: number) {
    this.snapTo = i;
    this.vel = 0;
  }
  /** clique: devolve o índice do monólito ou -1 (área vazia → pulso) */
  click(x: number, y: number, pulse = true) {
    const i = this.pick(x, y);
    if (i < 0 && pulse) this.lens.pulse = 1;
    return i;
  }
  private pick(x: number, y: number) {
    if (this.p > 0.6 || this.q > 0) return -1;
    const w = this.world;
    this.v2.set((x / w.vw) * 2 - 1, -((y / w.vh) * 2 - 1));
    this.ray.setFromCamera(this.v2, w.camera);
    const hit = this.ray.intersectObjects(this.mons.map((m) => m.box), false)[0];
    if (hit && hit.face && hit.face.materialIndex === 4) return hit.object.userData.i as number;
    return -1;
  }

  private setVideo(play: boolean) {
    const v = this.video;
    if (!v) return;
    if (play) {
      if (v.paused) {
        if (v.preload === "none") v.preload = "auto";
        v.play()
          .then(() => {
            if (!this.vtex) {
              this.vtex = new THREE.VideoTexture(v);
              this.vtex.colorSpace = THREE.NoColorSpace;
              this.screenMat.uniforms.uVideo.value = this.vtex;
              this.screenMat.uniforms.uHasVideo.value = 1;
            }
          })
          .catch(() => {});
      }
    } else if (!v.paused) v.pause();
  }

  update(dt: number, time: number) {
    if (!this.object.visible) {
      this.setVideo(false);
      return;
    }
    if (this.born < 0) this.born = time;
    const t = time - this.born;
    const w = this.world;
    const cam = w.camera;
    const p = this.p;
    const q = this.q;
    const red = this.reduced;
    this.clock += red ? 0 : dt;
    const vw = w.vw;
    const vh = w.vh;
    this.narrow = vw < 768;

    // ---- câmera: espiral 180° descendo para dentro do anel (p 0–.55); depois assenta no emblema; reel: dolly ----
    const s = red ? (p > 0.5 ? 1 : 0) : inOut2(clamp01(p / 0.55));
    const settle = red ? (p > 0.8 ? 1 : 0) : inOut2(clamp01((p - 0.55) / 0.45));
    const k = 1 - Math.exp(-dt * 3.5);
    this.tilt.x += ((red ? 0 : this.tilt.ty) - this.tilt.x) * k;
    this.tilt.y += ((red ? 0 : this.tilt.tx) - this.tilt.y) * k;
    const th = mix(0, Math.PI, s) + this.tilt.y * 0.06 * (1 - settle);
    const rr = mix(this.narrow ? 17 : 14, 4.4, s) - (red ? 0 : 0.6 * sstep(0, 1, q));
    const y = mix(4.2, 1.6, s) - this.tilt.x * 0.3 * (1 - s);
    cam.position.set(Math.sin(th) * rr, y, Math.cos(th) * rr);
    cam.lookAt(0, mix(mix(0.9, 1.4, s), EMB_Y, settle), 0);
    cam.updateMatrixWorld();

    // ---- piso e anel (centro = emblema) ----
    const fl = w.floor;
    fl.visible = true;
    fl.position.y = FLOOR_Y;
    fl.material.uniforms.uRing.value = this.narrow ? RING_R * 0.82 : RING_R;
    fl.material.uniforms.uCenter.value.set(cam.position.x, cam.position.z);
    fl.material.uniforms.uGlow.value = 0.35 * (1 - s) + 0.0;
    fl.material.uniforms.uAlpha.value = 1 - 0.6 * sstep(0.2, 0.8, q);

    // ---- dial: intro (uma volta com inércia) + arrasto + encaixe a cada 45° ----
    if (!this.drag.on) {
      if (red) {
        if (this.snapTo !== null) {
          this.ang = -this.snapTo * STEP + th;
          this.snapTo = null;
        }
      } else if (this.snapTo !== null) {
        const target = th - this.snapTo * STEP - s * Math.PI * 0.5;
        const diff = (((target - this.ang) % TAU) + TAU * 1.5) % TAU - Math.PI;
        this.ang += diff * Math.min(1, dt * 6);
        this.vel = 0;
        if (Math.abs(diff) < 0.002) this.snapTo = null;
      } else {
        this.ang += this.vel * dt;
        this.vel *= Math.pow(0.92, dt * 60);
        if (Math.abs(this.vel) < 0.35) {
          const off = th - s * Math.PI * 0.5;
          const tgt = off + Math.round((this.ang - off) / STEP) * STEP;
          this.ang += (tgt - this.ang) * Math.min(1, dt * 7);
        }
      }
    }
    const intro = red ? 0 : -TAU * (1 - outQuart(t / 2.4));
    this.ringG.rotation.y = this.ang + intro + s * Math.PI * 0.5;
    let front = 0;
    let best = 9;
    this.mons.forEach((m, i) => {
      const d = Math.abs(((((i * STEP + this.ringG.rotation.y - th) % TAU) + TAU * 1.5) % TAU) - Math.PI);
      if (d < best) {
        best = d;
        front = i;
      }
    });
    this.front = front;
    this.hoverIdx = this.ptr.inside && this.ptr.type === "mouse" && !this.drag.on ? this.pick(this.ptr.x, this.ptr.y) : -1;
    const petals = red ? (p > 0.6 ? 1 : 0) : sstep(0.42, 0.78, p);
    const flash = t > 2.4 ? Math.exp(-(t - 2.4) * 3.5) : 0;
    this.mons.forEach((m, i) => {
      m.h += ((i === this.hoverIdx ? 1 : 0) - m.h) * (red ? 1 : Math.min(1, dt * 9));
      m.mat.uniforms.uH.value = m.h;
      m.mat.uniforms.uF.value = (i === front ? flash + 0.25 : 0) * (1 - petals);
      m.pivot.rotation.x = THREE.MathUtils.degToRad(this.narrow ? 0 : 75) * petals;
      m.mat.uniforms.uO.value = 1 - (this.narrow ? petals : sstep(0.6, 0.92, p));
    });
    this.ringG.visible = petals < 0.999 || p < 0.95;

    // ---- chuva ----
    for (const m of this.rainMats) {
      m.uniforms.uTime.value = red ? 0 : time;
      m.uniforms.uAlpha.value = (red ? 0.2 : 0.4) * (1 - 0.5 * q);
    }

    // ---- emblema → tela do reel (q) — o MESMO morph da etapa 2 ----
    const fit = red ? (q > 0.05 ? 1 : 0) : inOut2(sstep(0.0, 0.15, q));
    const m = red ? (q > 0.5 ? 1 : 0) : inOut2(sstep(0.25, 0.8, q));
    const mv = red ? m : sstep(0.4, 0.85, q);
    const upp = (2 * SCREEN_DEPTH * TAN) / vh;
    let wpx = vw * (this.narrow ? 0.9 : 0.78);
    let hpx = (wpx * 9) / 16;
    const maxH = vh * (this.narrow ? 0.42 : 0.66);
    if (hpx > maxH) {
      hpx = maxH;
      wpx = (hpx * 16) / 9;
    }
    this.rectPx = { x: (vw - wpx) / 2, y: vh * 0.5 - hpx / 2, w: wpx, h: hpx };
    this.hover.on += (this.hover.t - this.hover.on) * (1 - Math.exp(-dt * 6));
    // dentro do anel o emblema encolhe um pouco para caber inteiro antes do morph
    const embSize = EMB_SIZE * (this.narrow ? 0.9 : 1) * mix(1, 0.72, s);
    for (const [mat, inflate, depth] of [
      [this.screenMat, 0, SCREEN_DEPTH],
      [this.frameMat, 0.035, SCREEN_DEPTH - 0.35 * (1 - m * 0.6)],
    ] as const) {
      const u = mat.uniforms;
      u.uWPos.value.set(0, EMB_Y, 0);
      u.uWSize.value = embSize;
      u.uM.value = m;
      u.uV.value = mv;
      u.uFit.value = fit;
      const circlePx = Math.min(vh * 0.72, vw * (this.narrow ? 0.86 : 0.8));
      u.uCircle.value.set(0, 0, circlePx * upp);
      u.uDim.value = 0.9 + 0.1 * m;
      u.uDepth.value = depth;
      u.uRect.value.set(0, 0, wpx * upp, hpx * upp);
      u.uAspect.value = 16 / 9;
      u.uRectHpx.value = hpx;
      u.uCurve.value = (this.narrow ? 0.12 : 0.32) * m;
      u.uInflate.value = inflate;
      u.uTime.value = this.clock;
      u.uHover.value = red ? 0 : this.hover.on * m;
      u.uHoverUV.value.set(this.hover.u, this.hover.v);
    }
    this.screenMat.uniforms.uAlpha.value = red && q > 0.5 ? 0 : 1;
    this.frameMat.uniforms.uAlpha.value = 0.55 * (0.4 + 0.6 * m) * (red ? 0 : 1);

    // centro/raio do emblema em px (para as palavras-chave)
    const c = new THREE.Vector3(0, EMB_Y, 0).project(cam);
    const top = new THREE.Vector3(0, EMB_Y, 0).applyMatrix4(cam.matrixWorldInverse);
    const dist = -top.z;
    this.embPx = { x: (c.x * 0.5 + 0.5) * vw, y: (-c.y * 0.5 + 0.5) * vh, r: (embSize / 2 / (2 * dist * TAN)) * vh };

    // marcas do dial
    const tu = this.tickMat.uniforms;
    tu.uScale.value = embSize * (1.12 + 0.9 * sstep(0, 0.8, q));
    tu.uSpin.value = red ? 0 : p * 0.8 + q * 1.4 + this.clock * 0.03;
    tu.uCenter.value.set(0, EMB_Y, 0);
    tu.uAlpha.value = (this.narrow ? 0.25 : 0.4) * (1 - sstep(0.6, 0.95, q));

    // ---- SINAL: ASCII → real (p 0–.65), lente, rastro, pulso ----
    const kReal = red ? 1 : sstep(0, 0.65, p);
    const pu = this.postMat.uniforms;
    const live = this.ptr.inside && (this.ptr.type === "mouse" || performance.now() - this.ptr.lastMove < 1200); // toque: lente fica ~1,2 s após soltar
    // etapa 6 (Lucas): no desktop a lente acompanha o cursor ritual padrão (46 px) — raio 46 (antes 140, lente gigante)
    const LR = this.narrow ? 100 : 46;
    const tx = live ? this.ptr.x : vw / 2;
    const ty = live ? this.ptr.y : vh / 2;
    const f = red ? 1 : 1 - Math.pow(1 - 0.22, dt * 60);
    this.lens.x += (tx - this.lens.x) * f;
    this.lens.y += (ty - this.lens.y) * f;
    this.lens.k += ((live ? 1 : 0) - this.lens.k) * Math.min(1, dt * 10);
    this.lens.pulse = Math.max(0, this.lens.pulse - dt / 0.55);
    const introL = red ? 0 : t < 0.6 ? 0 : t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 0.8);
    const diag = Math.hypot(vw, vh);
    let Rl = Math.max(LR * this.lens.k, LR * 1.4 * introL * outQuart((t - 0.6) / 0.4));
    // pulso local (anel que se expande no ponto clicado), não um flash da tela inteira
    Rl = Math.max(Rl, LR * (0.6 + 2.0 * (1 - this.lens.pulse)) * Math.min(1, this.lens.pulse * 4));
    Rl = mix(Rl, diag, kReal * kReal);
    pu.uMouse.value.set(this.lens.x, vh - this.lens.y);
    pu.uLensR.value = Rl;
    pu.uRing.value = (Rl > 2 ? 1 : 0) * (1 - kReal);
    void diag;
    pu.uReal.value = Math.max(kReal * kReal * kReal, q > 0 ? 1 : 0);
    pu.uDen.value = (red ? 1 : outQuart(t / 2.2)) * (1 - kReal * 0.8);
    pu.uTime.value = time;
    pu.uHalf.value = this.narrow || red ? 0 : 1;
    this.trailStep(live, LR * 0.55, dt);

    this.setVideo(this.active && q > 0.25 && !document.hidden && !red);
  }

  private trailStep(on: boolean, radius: number, dt: number) {
    if (this.narrow || this.reduced) return;
    const r = this.world.renderer;
    const vw = this.world.vw;
    const vh = this.world.vh;
    const cur = new THREE.Vector2(this.lens.x, vh - this.lens.y);
    const u = this.trailMat.uniforms;
    u.uA.value.copy(on && this.lastTrail ? this.lastTrail : cur);
    u.uB.value.copy(cur);
    u.uR.value = radius;
    u.uOn.value = on ? 1 : 0;
    u.uDecay.value = Math.exp((-3 * dt) / 0.6);
    u.uPrev.value = this.trailA.texture;
    u.uRes.value.set(vw, vh);
    r.setRenderTarget(this.trailB);
    r.render(this.trailScene, this.fsCam);
    r.setRenderTarget(null);
    [this.trailA, this.trailB] = [this.trailB, this.trailA];
    this.lastTrail = on ? cur : null;
    this.postMat.uniforms.uTrail.value = this.trailA.texture;
  }

  /** alvos para pré-compilar (World.warm) */
  warmList() {
    const w = this.world;
    return [
      { scene: w.scene, camera: w.camera, target: this.rt },
      { scene: w.scene, camera: w.camera, target: null },
      { scene: this.fsScene, camera: this.fsCam, target: null },
      { scene: this.trailScene, camera: this.fsCam, target: this.trailB },
    ];
  }

  /** render próprio da Home: cena → RT → pós SINAL (ou direto quando já é "real" e sem lente) */
  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const pu = this.postMat.uniforms;
    const W = this.world.vw;
    const H = this.world.vh;
    const dpr = renderer.getPixelRatio();
    const bw = Math.floor(W * dpr);
    const bh = Math.floor(H * dpr);
    if (this.rt.width !== bw || this.rt.height !== bh) {
      this.rt.setSize(bw, bh);
      const tw = Math.max(4, Math.round(W * 0.25));
      const th = Math.max(4, Math.round(H * 0.25));
      this.trailA.setSize(tw, th);
      this.trailB.setSize(tw, th);
    }
    pu.uRes.value.set(W, H);
    if (pu.uReal.value >= 0.999 && pu.uRing.value < 0.01) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }
    renderer.setRenderTarget(this.rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.fsScene, this.fsCam);
  }

  dispose() {
    this.video?.pause();
    this.video?.removeAttribute("src");
    this.video?.load();
    this.vtex?.dispose();
    this.screenMat.dispose();
    this.frameMat.dispose();
    this.tickMat.dispose();
    this.emblem.dispose();
    this.screen.geometry.dispose();
    this.ticks.geometry.dispose();
    this.rainA.geometry.dispose();
    this.rainMats.forEach((m) => m.dispose());
    this.mons.forEach((m) => {
      m.box.geometry.dispose();
      m.mat.dispose();
      (m.mat.uniforms.uMap.value as THREE.Texture | null)?.dispose();
    });
    this.rt.dispose();
    this.trailA.dispose();
    this.trailB.dispose();
    this.postMat.dispose();
    this.trailMat.dispose();
  }
}
