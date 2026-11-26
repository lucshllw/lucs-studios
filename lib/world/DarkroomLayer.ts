"use client";
// About — A3 CÂMARA ESCURA (proposals/hero-about/js/a3.js, aprovado por Lucas 12/11), portado para o World único:
// retrato em ~90k pontos halftone (30k no 390) sob luz de segurança; o cursor revela a foto real (rastro FBO, decai
// 1,2 s); ≥ 70% revelado = cópia fixa + recompensa no "Résumé (PDF)". Scroll: 6 estações do método mudam o tratamento
// (negativo → enquadramento → halftone brasa → fluxo → medição → cópia final). Cena e câmera próprias; mesmo renderer.
import * as THREE from "three";
import type { World, WorldLayer } from "./World";

const PH = 1;
const PW = 620 / 814;
const fsVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
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
  gl_FragColor = vec4(max(texture2D(uPrev, vUv).r * uDecay, brush), 0.0, 0.0, 1.0);
}
`;

export type DarkroomEls = {
  overlays: { grid: HTMLElement; meas: HTMLElement; final: HTMLElement; frame: HTMLElement };
  onStation: (i: number) => void;
  onReveal: (frac: number, rewarded: boolean) => void;
};

export class DarkroomLayer implements WorldLayer {
  object = new THREE.Group(); // marcador de visibilidade para o World (a cena própria fica em `scene`)
  world: World;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, 1, 0.05, 30);
  p = 0;
  reduced: boolean;
  narrow: boolean;
  els: DarkroomEls | null = null;
  private shared: Record<string, THREE.IUniform>;
  private pts: THREE.Points;
  private trailA: THREE.WebGLRenderTarget;
  private trailB: THREE.WebGLRenderTarget;
  private trailMat: THREE.ShaderMaterial;
  private trailScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private last: THREE.Vector2 | null = null;
  private ptr = { x: 0, y: 0, inside: false, type: "mouse", down: false };
  private cov = new Uint8Array(64 * 64);
  private covered = 0;
  rewarded = false;
  private fix = 0;
  private born = -1;
  private act = -2;
  private rect = { x: 0, y: 0, w: 1, h: 1 };
  private W = 1;
  private H = 1;
  private photo: THREE.Texture;

  constructor(world: World, opts: { reduced: boolean }) {
    this.world = world;
    this.reduced = opts.reduced;
    this.narrow = window.innerWidth < 768;
    this.photo = new THREE.TextureLoader().load("/brand/foto-620.webp");
    this.photo.colorSpace = THREE.NoColorSpace;
    const W7 = () => ({ value: [1, 0, 0, 0, 0, 0, 0] });
    this.shared = { uW: W7(), uTrail: { value: null }, uTime: { value: 0 }, uPx: { value: 1 }, uFix: { value: 0 }, uIn: { value: 0 }, uPW: { value: PW }, uPH: { value: PH } };
    const half = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
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

    // cópia (foto real) por trás, revelada pelo rastro
    const print = new THREE.Mesh(
      new THREE.PlaneGeometry(PW, PH),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { ...this.shared, uPhoto: { value: this.photo } },
        vertexShader: `varying vec2 vUv; varying vec4 vC; void main(){ vUv=uv; vec4 c=projectionMatrix*modelViewMatrix*vec4(position,1.); vC=c; gl_Position=c; }`,
        fragmentShader: `uniform sampler2D uPhoto,uTrail; uniform float uW[7]; uniform float uFix; varying vec2 vUv; varying vec4 vC;
          void main(){ vec2 s=vC.xy/vC.w*.5+.5; float tr=texture2D(uTrail,s).r; vec3 c=texture2D(uPhoto,vUv).rgb; float g=dot(c,vec3(.299,.587,.114));
            vec3 bw=vec3(smoothstep(.04,.96,g)); float a=max(max(smoothstep(.05,.6,tr),uFix),uW[6]);
            gl_FragColor=vec4(mix(c,bw,uW[6]), a); }`,
      })
    );
    print.position.z = -0.002;
    this.scene.add(print);

    // LITE (sem GPU): halftone na densidade do celular (~30 mil pontos em vez de ~90 mil)
    const few = this.narrow || document.documentElement.classList.contains("lite");
    const cols = few ? 151 : 262;
    const rows = few ? 199 : 344;
    const N = cols * rows;
    const aUv = new Float32Array(N * 2);
    const aLum = new Float32Array(N);
    const aRnd = new Float32Array(N);
    for (let j = 0, i = 0; j < rows; j++)
      for (let k = 0; k < cols; k++, i++) {
        aUv[i * 2] = (k + 0.5 + (j % 2) * 0.5) / cols;
        aUv[i * 2 + 1] = (j + 0.5) / rows;
        aRnd[i] = Math.random();
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aUv", new THREE.BufferAttribute(aUv, 2));
    g.setAttribute("aLum", new THREE.BufferAttribute(aLum, 1));
    g.setAttribute("aRnd", new THREE.BufferAttribute(aRnd, 1));
    const pm = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: this.shared,
      vertexShader: `uniform float uW[7]; uniform float uTime,uPx,uIn,uPW,uPH,uFix; uniform sampler2D uTrail; attribute vec2 aUv; attribute float aLum,aRnd; varying float vA; varying vec3 vC;
        void main(){
          vec3 p=vec3((aUv.x-.5)*uPW,(aUv.y-.5)*uPH,0.);
          p.z+=(aRnd-.5)*.05*(1.-uW[6])+sin(uTime*.9+aRnd*6.283)*.006;
          vec2 cg=vec2(44.,58.); vec2 co=(floor(aUv*cg)+.5)/cg; p.xy=mix(p.xy, vec2((co.x-.5)*uPW,(co.y-.5)*uPH), uW[3]);
          float ph=uTime*.6; vec2 fl=vec2(sin(p.y*11.+ph*2.1+aRnd*2.)+sin(p.y*23.-ph*1.3), cos(p.x*13.-ph*1.7+aRnd*3.)+cos(p.x*7.+ph))*.018; p.xy+=fl*uW[4];
          vec4 c0=projectionMatrix*modelViewMatrix*vec4(p,1.); float tr=texture2D(uTrail,c0.xy/c0.w*.5+.5).r;
          p.z+=tr*.08*(1.-uW[6]);
          p.z+=(1.-uIn)*(aRnd-.5)*1.2;
          vec4 mv=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mv;
          float l=aLum; float ln=mix(l,1.-l,uW[1]);
          float sz=mix(1.2,3.4,ln);
          sz*=mix(1.,7.5*step(aRnd,.11)*(.4+.6*l),uW[3]);
          gl_PointSize=sz*uPx*(2.4/-mv.z);
          vec3 safe=vec3(1.,.62,.6)*l; vec3 neg=vec3(1.-l)*.95; vec3 pos=vec3(l)*.95; vec3 forge=vec3(.62,.01,.03)*(.35+l*1.1); vec3 flow=vec3(.9)*(.25+l*.8);
          vC=safe*uW[0]+neg*uW[1]+pos*uW[2]+forge*uW[3]+flow*uW[4]+pos*.8*uW[5]+pos*uW[6];
          vA=(1.-smoothstep(.05,.6,tr))*(1.-uFix*.85)*(1.-uW[6])*mix(1.,step(aRnd,.11),uW[3])*uIn;
        }`,
      fragmentShader: `varying float vA; varying vec3 vC; void main(){ float d=length(gl_PointCoord-.5); if(d>.5||vA<.01) discard; gl_FragColor=vec4(vC, vA*(1.-smoothstep(.35,.5,d))); }`,
    });
    this.pts = new THREE.Points(g, pm);
    this.pts.frustumCulled = false;
    this.scene.add(this.pts);
    const img = new Image();
    img.src = "/brand/foto-620.webp";
    img.onload = () => {
      const cv = document.createElement("canvas");
      cv.width = cols;
      cv.height = rows;
      const x = cv.getContext("2d")!;
      x.drawImage(img, 0, 0, cols, rows);
      const d = x.getImageData(0, 0, cols, rows).data;
      for (let i = 0; i < N; i++) {
        const k = Math.min(cols - 1, Math.floor(aUv[i * 2] * cols));
        const j = Math.min(rows - 1, Math.floor((1 - aUv[i * 2 + 1]) * rows));
        const o = (j * cols + k) * 4;
        aLum[i] = Math.pow((d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) / 255, 1.1);
      }
      g.attributes.aLum.needsUpdate = true;
      window.dispatchEvent(new Event("rito:ready"));
    };
  }

  private tap: { x: number; y: number } | null = null;
  /** nova visita ao About: revelação, cópia fixa, estação e rastro voltam ao estado inicial (antes persistiam
   *  no singleton → a partir da 2ª visita a foto já entrava "fixada" e os pontos quase sumiam) */
  resetVisit() {
    this.born = -1;
    this.cov.fill(0);
    this.covered = 0;
    this.rewarded = false;
    this.fix = 0;
    this.act = -2;
    this.tap = null;
    this.last = null;
    this.shared.uFix.value = 0;
    const r = this.world.renderer;
    for (const t of [this.trailA, this.trailB]) {
      r.setRenderTarget(t);
      r.clear();
    }
    r.setRenderTarget(null);
  }

  pointer(x: number, y: number, inside: boolean, type: string, down = false) {
    Object.assign(this.ptr, { x, y, inside, type, down });
    // toque rápido (abaixo de 1 quadro, seguido de pointerleave) também revela
    if (down && type !== "mouse") this.tap = { x, y };
  }

  /** stage = retângulo do palco em px (o canvas é a tela inteira; a câmera centraliza o retrato no palco) */
  resize() {
    const w = this.world.vw;
    const h = this.world.vh;
    this.W = w;
    this.H = h;
    this.narrow = w < 768;
    this.cam.aspect = w / h;
    const asp = w / h;
    const tn = Math.tan(THREE.MathUtils.degToRad(15));
    const vh = Math.max(PH / (asp < 0.8 ? 0.6 : 0.82), (PW * 1.2) / asp);
    this.cam.position.set(w >= 1000 ? -vh * asp * 0.08 : 0, asp < 0.8 ? -vh * 0.12 : 0, vh / (2 * tn));
    this.cam.lookAt(this.cam.position.x, this.cam.position.y, 0);
    this.cam.updateProjectionMatrix();
    this.cam.updateMatrixWorld();
    this.shared.uPx.value = this.world.renderer.getPixelRatio();
    this.trailA.setSize(Math.max(4, Math.round(w * 0.25)), Math.max(4, Math.round(h * 0.25)));
    this.trailB.setSize(Math.max(4, Math.round(w * 0.25)), Math.max(4, Math.round(h * 0.25)));
    this.trailMat.uniforms.uRes.value.set(w, h);
    const v = new THREE.Vector3(-PW / 2, PH / 2, 0).project(this.cam);
    const x0 = (v.x * 0.5 + 0.5) * w;
    const y0 = (-v.y * 0.5 + 0.5) * h;
    v.set(PW / 2, -PH / 2, 0).project(this.cam);
    this.rect = { x: x0, y: y0, w: (v.x * 0.5 + 0.5) * w - x0, h: (-v.y * 0.5 + 0.5) * h - y0 };
    if (this.els) for (const el of Object.values(this.els.overlays)) Object.assign(el.style, { left: this.rect.x + "px", top: this.rect.y + "px", width: this.rect.w + "px", height: this.rect.h + "px" });
  }

  update(dt: number, time: number) {
    if (!this.object.visible) return;
    if (this.born < 0) {
      this.born = time;
      this.resize();
    }
    // 26/11: também quando o regulador SOFT muda a resolução (uPx = tamanho dos pontos)
    if (this.W !== this.world.vw || this.H !== this.world.vh || this.shared.uPx.value !== this.world.renderer.getPixelRatio()) this.resize();
    const t = time - this.born;
    const red = this.reduced;
    const p = this.p;
    const st = p * 6;
    const w = [0, 0, 0, 0, 0, 0, 0];
    const i0 = Math.min(5, Math.floor(st));
    const f = st - i0;
    const fr = f * f * (3 - 2 * f);
    w[i0] = 1 - fr;
    w[i0 + 1] = fr;
    this.shared.uW.value = w;
    this.shared.uTime.value = red ? 0 : time;
    this.shared.uIn.value = red ? 1 : 1 - Math.pow(1 - Math.min(1, t / 1.6), 4);
    // pincel de revelação
    const tap = this.tap;
    this.tap = null;
    if (tap && !(this.ptr.inside && this.ptr.down)) {
      this.ptr.x = tap.x;
      this.ptr.y = tap.y;
    }
    const live = (this.ptr.inside && (this.ptr.type === "mouse" || this.ptr.down)) || !!tap;
    const LR = this.narrow ? 120 : 80;
    const r = this.world.renderer;
    const cur = new THREE.Vector2(this.ptr.x, this.H - this.ptr.y);
    const u = this.trailMat.uniforms;
    u.uA.value.copy(live && this.last ? this.last : cur);
    u.uB.value.copy(cur);
    u.uR.value = LR;
    u.uOn.value = live ? 1 : 0;
    u.uDecay.value = red ? 1 : Math.exp((-3 * dt) / 1.2);
    u.uPrev.value = this.trailA.texture;
    r.setRenderTarget(this.trailB);
    r.render(this.trailScene, this.fsCam);
    r.setRenderTarget(null);
    [this.trailA, this.trailB] = [this.trailB, this.trailA];
    this.last = live ? cur : null;
    this.shared.uTrail.value = this.trailA.texture;
    if (live) {
      const R = this.rect;
      const uu = (this.ptr.x - R.x) / R.w;
      const vv = (this.ptr.y - R.y) / R.h;
      const rr = ((LR * 0.7) / R.w) * 64;
      const rv = ((LR * 0.7) / R.h) * 64;
      for (let y = Math.floor(vv * 64 - rv); y <= vv * 64 + rv; y++)
        for (let x = Math.floor(uu * 64 - rr); x <= uu * 64 + rr; x++) {
          if (x < 0 || y < 0 || x > 63 || y > 63) continue;
          if (((x - uu * 64) / rr) ** 2 + ((y - vv * 64) / rv) ** 2 > 1) continue;
          const k = y * 64 + x;
          if (!this.cov[k]) {
            this.cov[k] = 1;
            this.covered++;
          }
        }
    }
    const frac = this.covered / 4096;
    if (!this.rewarded && frac >= 0.7) this.rewarded = true;
    this.els?.onReveal(frac, this.rewarded);
    this.fix += ((this.rewarded ? 1 : 0) - this.fix) * (red ? 1 : 0.05);
    this.shared.uFix.value = this.fix;
    const a = p < 0.02 ? -1 : Math.min(5, Math.floor(st - 0.001));
    if (a !== this.act) {
      this.act = a;
      this.els?.onStation(a);
    }
    if (this.els) {
      const o = this.els.overlays;
      o.grid.style.opacity = String(w[2]);
      o.meas.style.opacity = String(w[5]);
      o.final.style.opacity = String(w[6]);
      o.frame.style.opacity = String(Math.max(w[2], w[5]) * 0.8);
    }
  }

  render(renderer: THREE.WebGLRenderer) {
    renderer.setRenderTarget(null);
    renderer.render(this.scene, this.cam);
  }

  dispose() {
    this.pts.geometry.dispose();
    (this.pts.material as THREE.Material).dispose();
    this.photo.dispose();
    this.trailA.dispose();
    this.trailB.dispose();
    this.trailMat.dispose();
  }
}
