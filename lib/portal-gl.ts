// OGL do portal do showreel (parecer Vergil v3-reel §3): o disco do avatar quantiza em células (1→20 px), vira
// halftone, as células trocam (ordem por hash, 1 quadro branco na virada) para o pôster do reel e, na abertura,
// voltam a 1 px (pôster nítido). Reaproveita do Emblem: hash, textura EMBLEM_SRC, grão e a cor brasa (lib/glsl.ts).
// O formato (círculo → retângulo) é do clip-path da .portal__screen; aqui só o conteúdo. DPR ≤ 1,5.
import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { EMBER_GLSL, HASH_GLSL } from "./glsl";

const vertex = /* glsl */ `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;

const fragment = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uAvatar;
uniform sampler2D uPoster;
uniform vec2 uRes;        // canvas, px CSS
uniform vec4 uScreen;     // x, y, w, h da tela 16:9 dentro do canvas
uniform vec3 uDisc;       // cx, cy, r (px)
uniform float uCell;      // 1 → 20
uniform float uDot;       // 0 → 1 halftone
uniform float uSwap;      // 0 → 1 avatar → pôster
uniform float uTemper;    // brasa no aro
uniform float uTime;
in vec2 vUv;
out vec4 fragColor;
${HASH_GLSL}

vec3 avatarAt(vec2 p) {
  // o avatar (disco + aro) ocupa o quadrado de lado 2r/0,926 centrado no disco
  vec2 e = (p - uDisc.xy) / (uDisc.z * 2.0 / 0.926) + 0.5;
  if (any(lessThan(e, vec2(0.0))) || any(greaterThan(e, vec2(1.0)))) return vec3(0.0);
  vec4 t = texture(uAvatar, e);
  return vec3(t.r) * t.a;
}
vec3 posterAt(vec2 p) {
  vec2 u = (p - uScreen.xy) / uScreen.zw;
  return texture(uPoster, clamp(u, 0.0, 1.0)).rgb;
}

void main() {
  vec2 px = vec2(vUv.x, 1.0 - vUv.y) * uRes;
  float cell = max(1.0, uCell);
  vec2 cid = floor(px / cell);
  vec2 cpx = (cid + 0.5) * cell;
  // avatar quantizado: luminância em 4 níveis quando a célula já é grossa
  vec3 av = avatarAt(cell > 1.5 ? cpx : px);
  float lum = av.r;
  float q = mix(lum, floor(lum * 3.999) / 3.0, smoothstep(1.5, 6.0, cell));
  // halftone: ponto de raio ∝ luminância dentro da célula
  float d = length(px - cpx) / (cell * 0.5);
  float dotv = step(d, sqrt(q) * 1.05);
  float a = mix(q, dotv, uDot);
  // grão
  a = clamp(a + (hash(floor(px) + floor(uTime * 24.0) * 1.37) - 0.5) * 0.08, 0.0, 1.0);
  vec3 avc = vec3(a);
  // têmpera brasa no aro (anel externo do disco)
  float rr = length(px - uDisc.xy) / uDisc.z;
  avc = mix(avc, ${EMBER_GLSL}, uTemper * smoothstep(0.86, 0.98, rr) * step(rr, 1.0));
  // troca de sinal por célula de 20 px (ordem por hash) com 1 quadro branco na virada
  float h = hash(floor(px / 20.0) + 3.7);
  float s = step(h, uSwap);
  vec3 pc = posterAt(cell > 1.5 ? cpx : px);
  pc = mix(pc, vec3(dot(pc, vec3(0.299, 0.587, 0.114))) * dotv + pc * (1.0 - uDot), uDot * 0.6);
  float flash = step(abs(h - uSwap), 0.012) * step(0.001, uSwap) * step(uSwap, 0.999);
  vec3 col = mix(avc, pc, s);
  col = mix(col, vec3(1.0), flash);
  fragColor = vec4(col, 1.0);
}`;

export type PortalGLState = { cell: number; dot: number; swap: number; temper: number; disc: [number, number, number]; screen: [number, number, number, number] };

export class PortalGL {
  private renderer: Renderer;
  private program: Program;
  private mesh: Mesh;
  ready = false;
  ok = true;

  constructor(canvas: HTMLCanvasElement, avatarSrc: string, posterSrc: string, onReady: () => void) {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer = new Renderer({ canvas, webgl: 2, alpha: false, antialias: false, dpr });
    const gl = this.renderer.gl;
    if (!this.renderer.isWebgl2 || gl.isContextLost()) {
      this.ok = false;
    }
    gl.clearColor(0, 0, 0, 1);
    const avatar = new Texture(gl, { flipY: false, generateMipmaps: true });
    const poster = new Texture(gl, { flipY: false, generateMipmaps: true });
    this.program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        uAvatar: { value: avatar },
        uPoster: { value: poster },
        uRes: { value: [1, 1] },
        uScreen: { value: [0, 0, 1, 1] },
        uDisc: { value: [0, 0, 1] },
        uCell: { value: 1 },
        uDot: { value: 0 },
        uSwap: { value: 0 },
        uTemper: { value: 0.01 },
        uTime: { value: 0 },
      },
    });
    if (gl.isContextLost() || !gl.getProgramParameter(this.program.program, gl.LINK_STATUS)) this.ok = false;
    this.mesh = new Mesh(gl, { geometry: new Triangle(gl), program: this.program });
    let n = 0;
    const done = () => {
      if (++n === 2) {
        this.ready = true;
        onReady();
      }
    };
    const load = (src: string, tex: Texture) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        tex.image = img;
        done();
      };
      img.src = src;
    };
    load(avatarSrc, avatar);
    load(posterSrc, poster);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h);
    this.program.uniforms.uRes.value = [w, h];
  }

  render(s: PortalGLState, time: number) {
    if (!this.ready || !this.ok) return;
    const u = this.program.uniforms;
    u.uCell.value = s.cell;
    u.uDot.value = s.dot;
    u.uSwap.value = s.swap;
    u.uTemper.value = s.temper;
    u.uDisc.value = s.disc;
    u.uScreen.value = s.screen;
    u.uTime.value = time;
    this.renderer.render({ scene: this.mesh });
  }

  destroy() {
    this.renderer.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
