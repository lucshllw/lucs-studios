"use client";
// /lab — corredor com 4 relíquias (proposals/finale/js/lab.js, aprovado 13/11) portado para o World único.
// Orb / Pano usam o renderer do World (render próprio, ACES só durante esta camada); Brasa / Fluido usam um canvas
// 2D da página. Um único despacho por quadro (ticker do site). Microfone só depois de clique explícito.
import * as THREE from "three";
import type { World, WorldLayer } from "./World";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));

export type LabMode = "corr" | "orb" | "cloth" | "word" | "fluid";
export const RELICS: { id: Exclude<LabMode, "corr">; name: string; sub: string }[] = [
  { id: "orb", name: "Orb", sub: "Simplex noise · the pointer pulls it · optional microphone" },
  { id: "cloth", name: "Cloth", sub: "Verlet · pull the emblem, a hard pull tears it" },
  { id: "word", name: "Ember", sub: "Particles form the word you type" },
  { id: "fluid", name: "Fluid", sub: "An ember fluid follows the pointer" },
];

const NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;} vec4 mod289(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 permute(vec4 x){return mod289(((x*34.)+1.)*x);} vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-.85373472095314*r;}
float snoise(vec3 v){ const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
 vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx); vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
 vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy; i=mod289(i);
 vec4 p=permute(permute(permute(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
 float n_=.142857142857; vec3 ns=n_*D.wyz-D.xzx; vec4 j=p-49.*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
 vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y); vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
 vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.)); vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
 vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
 vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3))); p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
 vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
 return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3))); }`;
const orbMat = () =>
  new THREE.ShaderMaterial({
    uniforms: { uT: { value: 0 }, uAmp: { value: 0 }, uM: { value: new THREE.Vector3(0, 0, 1) }, uMs: { value: 0 } },
    vertexShader:
      NOISE +
      `uniform float uT,uAmp,uMs; uniform vec3 uM; varying float vN; varying vec3 vNor; varying vec3 vV;
    void main(){ vec3 p=position; float n=snoise(p*1.4+vec3(0.,0.,uT*.35))*.5+snoise(p*3.1-uT*.2)*.18;
      float pull=pow(max(dot(normalize(p),normalize(uM)),0.),6.)*uMs;
      float d=n*(.16+uAmp*.55)+pull*.35; vN=n+pull; p+=normal*d; vNor=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(p,1.); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `varying float vN; varying vec3 vNor; varying vec3 vV; uniform float uAmp;
    void main(){ float f=pow(1.-max(dot(normalize(vNor),normalize(vV)),0.),2.2); vec3 ember=vec3(.76,.04,.13);
      vec3 c=mix(vec3(.01),ember*1.4,smoothstep(-.1,.5,vN))+vec3(1.,.8,.75)*f*.9+ember*uAmp*.8; gl_FragColor=vec4(c,1.);
      #include <colorspace_fragment>
    }`,
  });
const grid = (size = 30) =>
  new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `varying vec2 vP; void main(){ vec2 g=abs(fract(vP*1.5)-.5)/fwidth(vP*1.5); float l=1.-min(min(g.x,g.y),1.); float f=exp(-length(vP)*.18); gl_FragColor=vec4(vec3(1.)*l*.12*f,1.); }`,
    })
  );

type Pt = { x: number; y: number; z: number; px: number; py: number; pz: number; pin: boolean };
type Con = { a: number; b: number; l: number; on: boolean; q: [number, number, "h" | "v"] };
type Part = { x: number; y: number; vx: number; vy: number; l: number; t: [number, number] | null };

export type LabEls = {
  c2: HTMLCanvasElement;
  word: () => string;
  onSelect: (i: number) => void;
  onMode: (m: LabMode) => void;
  onMic: (s: string) => void;
};

export class LabLayer implements WorldLayer {
  object = new THREE.Group();
  world: World;
  reduced: boolean;
  narrow: boolean;
  els: LabEls | null = null;
  mode: LabMode = "corr";
  sel = 0;
  cutMode = false;
  P = { x: 0, y: 0, nx: 0.5, ny: 0.5, in: false, down: false, sx: 0, type: "mouse" };
  private t0 = -1;
  private time = 0;
  private camX = 0;
  // corredor
  private corr = new THREE.Scene();
  private ccam = new THREE.PerspectiveCamera(42, 1, 0.05, 50);
  private previews: { obj: THREE.Object3D; rim: THREE.Mesh; base?: Float32Array }[] = [];
  private emb: THREE.Texture;
  // orb
  private orbS = new THREE.Scene();
  private ocam = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  private orb: THREE.Mesh;
  private mic: { s: MediaStream; ac: AudioContext; an: AnalyserNode; buf: Uint8Array<ArrayBuffer> } | null = null;
  private micLvl = 0;
  // pano
  private clothS = new THREE.Scene();
  private ccam2 = new THREE.PerspectiveCamera(40, 1, 0.05, 50);
  private CN: number;
  private CS = 2.2;
  private cgeo: THREE.PlaneGeometry;
  private pts: Pt[] = [];
  private cons: Con[] = [];
  private grab = -1;
  // 2D
  private x2: CanvasRenderingContext2D | null = null;
  private d2 = 1;
  private parts: Part[] = [];
  private FN = 0;
  private FM = 0;
  private F: Record<"u" | "v" | "u0" | "v0" | "dn" | "d0" | "pr" | "dv", Float32Array> | null = null;
  private img: ImageData | null = null;
  private off: HTMLCanvasElement | null = null;
  private offx: CanvasRenderingContext2D | null = null;
  private lastF: [number, number] | null = null;
  private rc = new THREE.Raycaster();
  private pl = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  private hv = new THREE.Vector3();
  private nv = new THREE.Vector2();
  private size = { w: 0, h: 0 };

  constructor(world: World, opts: { reduced: boolean }) {
    this.world = world;
    this.reduced = opts.reduced;
    // LITE usa as versões leves do celular (orb com menos subdivisões, pano 20×20, fluido 72 colunas)
    this.narrow = window.innerWidth < 760 || document.documentElement.classList.contains("lite");
    this.CN = this.narrow ? 20 : 30;
    this.emb = new THREE.TextureLoader().load("/brand/avatar-emblem.webp");
    this.emb.colorSpace = THREE.SRGBColorSpace;
    // corredor
    const corr = this.corr;
    corr.background = new THREE.Color(0);
    corr.fog = new THREE.Fog(0, 5, 14);
    const fl = grid(40);
    fl.rotation.x = -Math.PI / 2;
    fl.position.y = -1;
    corr.add(fl);
    corr.add(new THREE.AmbientLight(0xffffff, 0.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 4, 3);
    corr.add(key);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, metalness: 0.4 });
    RELICS.forEach((r, i) => {
      const g = new THREE.Group();
      g.position.x = i * 2.6;
      corr.add(g);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.62, 0.9, 40), pedMat);
      ped.position.y = -0.55;
      g.add(ped);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.012, 8, 64), new THREE.MeshBasicMaterial({ color: 0xc20b21 }));
      rim.rotation.x = Math.PI / 2;
      rim.position.y = -0.1;
      g.add(rim);
      let obj: THREE.Object3D;
      let base: Float32Array | undefined;
      if (r.id === "orb") obj = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 24), orbMat());
      else if (r.id === "cloth") {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75, 12, 12), new THREE.MeshStandardMaterial({ map: this.emb, side: THREE.DoubleSide, roughness: 0.7, alphaTest: 0.5 }));
        base = (m.geometry.attributes.position.array as Float32Array).slice();
        obj = m;
      } else if (r.id === "word") {
        const n = 500;
        const p = new Float32Array(n * 3);
        for (let k = 0; k < n; k++) {
          const a = Math.random() * 6.28;
          const rr = Math.cbrt(Math.random()) * 0.42;
          const b = Math.acos(2 * Math.random() - 1);
          p.set([Math.sin(b) * Math.cos(a) * rr, Math.cos(b) * rr, Math.sin(b) * Math.sin(a) * rr], k * 3);
        }
        const gg = new THREE.BufferGeometry();
        gg.setAttribute("position", new THREE.BufferAttribute(p, 3));
        obj = new THREE.Points(gg, new THREE.PointsMaterial({ color: 0xff3a2a, size: 0.025, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      } else
        obj = new THREE.Mesh(
          new THREE.CircleGeometry(0.42, 64),
          new THREE.ShaderMaterial({
            uniforms: { uT: { value: 0 } },
            vertexShader: `varying vec2 v; void main(){ v=uv-.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
            fragmentShader: `varying vec2 v; uniform float uT; void main(){ float r=length(v); float a=atan(v.y,v.x); float s=sin(a*3.+r*18.-uT*2.)*.5+.5; float d=smoothstep(.5,.0,r)*s; vec3 c=mix(vec3(0.),vec3(.76,.04,.13),d); c=mix(c,vec3(1.,.7,.4),pow(d,3.)); gl_FragColor=vec4(c,1.);
              #include <colorspace_fragment>
            }`,
          })
        );
      obj.position.y = 0.45;
      obj.userData.i = i;
      g.add(obj);
      this.previews.push({ obj, rim, base });
    });
    // orb
    this.orbS.background = new THREE.Color(0x020202);
    this.ocam.position.set(0, 0, 4.2);
    this.orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.15, this.narrow ? 48 : 96), orbMat());
    this.orbS.add(this.orb);
    const og = grid(30);
    og.position.z = -4;
    this.orbS.add(og);
    // pano
    this.clothS.background = new THREE.Color(0x020202);
    this.ccam2.position.set(0, -0.1, 4);
    this.clothS.add(new THREE.AmbientLight(0xffffff, 0.55));
    const cl = new THREE.DirectionalLight(0xffffff, 1.6);
    cl.position.set(-1, 1, 3);
    this.clothS.add(cl);
    const ember = new THREE.PointLight(0xc20b21, 6, 6, 1.2);
    ember.position.set(1.5, -1, 1.5);
    this.clothS.add(ember);
    this.cgeo = new THREE.PlaneGeometry(this.CS, this.CS, this.CN - 1, this.CN - 1);
    this.clothS.add(new THREE.Mesh(this.cgeo, new THREE.MeshStandardMaterial({ map: this.emb, side: THREE.DoubleSide, roughness: 0.75, metalness: 0.05, alphaTest: 0.5 })));
    const cg2 = grid(30);
    cg2.position.z = -3;
    this.clothS.add(cg2);
    this.base = (this.cgeo.attributes.position.array as Float32Array).slice();
    this.resetCloth();
  }
  private base: Float32Array;

  // ---------- seleção / modos ----------
  select(i: number) {
    this.sel = (i + RELICS.length) % RELICS.length;
    this.els?.onSelect(this.sel);
  }
  setMode(m: LabMode) {
    if (this.mode === "orb" && m !== "orb") this.stopMic();
    this.mode = m;
    if (m === "word") this.buildTargets();
    if (m === "fluid") {
      this.initFluid();
      if (this.x2 && this.els) {
        this.x2.fillStyle = "#000";
        this.x2.fillRect(0, 0, this.els.c2.width, this.els.c2.height);
      }
    }
    if (m === "word" && this.x2 && this.els) {
      this.x2.globalCompositeOperation = "source-over";
      this.x2.fillStyle = "#000";
      this.x2.fillRect(0, 0, this.els.c2.width, this.els.c2.height);
    }
    if (m === "cloth") this.resetCloth();
    this.els?.onMode(m);
  }
  async enableMic() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ac = new AudioContext();
      const an = ac.createAnalyser();
      an.fftSize = 512;
      ac.createMediaStreamSource(s).connect(an);
      this.mic = { s, ac, an, buf: new Uint8Array(new ArrayBuffer(an.fftSize)) };
      this.els?.onMic("Microphone on — speak or play music");
    } catch {
      this.els?.onMic("Microphone unavailable or denied — the orb keeps noise and pointer");
    }
  }
  stopMic() {
    if (!this.mic) return;
    this.mic.s.getTracks().forEach((t) => t.stop());
    void this.mic.ac.close();
    this.mic = null;
    this.els?.onMic("");
  }

  // ---------- pano ----------
  resetCloth() {
    const CN = this.CN;
    this.pts = [];
    this.cons = [];
    const pa = this.base;
    for (let j = 0; j < CN; j++)
      for (let i = 0; i < CN; i++) {
        const k = j * CN + i;
        const x = pa[k * 3];
        const y = pa[k * 3 + 1] + 0.2;
        this.pts.push({ x, y, z: 0, px: x, py: y, pz: 0, pin: j === 0 && (i % 3 === 0 || i === CN - 1) });
      }
    const L = this.CS / (CN - 1);
    for (let j = 0; j < CN; j++)
      for (let i = 0; i < CN; i++) {
        const k = j * CN + i;
        if (i < CN - 1) this.cons.push({ a: k, b: k + 1, l: L, on: true, q: [i, j, "h"] });
        if (j < CN - 1) this.cons.push({ a: k, b: k + CN, l: L, on: true, q: [i, j, "v"] });
      }
    this.rebuildIndex();
    this.writeCloth();
  }
  private rebuildIndex() {
    const CN = this.CN;
    const h = new Set<string>();
    const v = new Set<string>();
    this.cons.forEach((c) => {
      if (!c.on) (c.q[2] === "h" ? h : v).add(c.q[0] + "," + c.q[1]);
    });
    const idx: number[] = [];
    for (let j = 0; j < CN - 1; j++)
      for (let i = 0; i < CN - 1; i++) {
        if (h.has(i + "," + j) || h.has(i + "," + (j + 1)) || v.has(i + "," + j) || v.has(i + 1 + "," + j)) continue;
        const a = j * CN + i;
        const b = a + 1;
        const c = a + CN;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    this.cgeo.setIndex(idx);
  }
  private writeCloth() {
    const pa = this.cgeo.attributes.position.array as Float32Array;
    this.pts.forEach((p, k) => {
      pa[k * 3] = p.x;
      pa[k * 3 + 1] = p.y;
      pa[k * 3 + 2] = p.z;
    });
    this.cgeo.attributes.position.needsUpdate = true;
    this.cgeo.computeVertexNormals();
  }
  private screenToPlane(cam: THREE.Camera) {
    const P = this.P;
    if (!P.in && !P.down) return null;
    this.nv.set(P.nx * 2 - 1, -(P.ny * 2 - 1));
    this.rc.setFromCamera(this.nv, cam);
    return this.rc.ray.intersectPlane(this.pl, this.hv) ? this.hv : null;
  }
  private stepCloth(dt: number) {
    const P = this.P;
    const mw = this.screenToPlane(this.ccam2);
    if (P.down && !this.cutMode && this.grab < 0 && mw) {
      let bd = 0.25;
      this.pts.forEach((p, k) => {
        const d = Math.hypot(p.x - mw.x, p.y - mw.y);
        if (d < bd) {
          bd = d;
          this.grab = k;
        }
      });
    }
    if (!P.down) this.grab = -1;
    let broke = false;
    const sub = 2;
    for (let s = 0; s < sub; s++) {
      const h = dt / sub;
      const wind = Math.sin(this.time / 0.9) * 0.15;
      for (const p of this.pts) {
        if (p.pin) continue;
        const vx = (p.x - p.px) * 0.985;
        const vy = (p.y - p.py) * 0.985;
        const vz = (p.z - p.pz) * 0.985;
        p.px = p.x;
        p.py = p.y;
        p.pz = p.z;
        p.x += vx;
        p.y += vy - 4.2 * h * h;
        p.z += vz + wind * h * h;
      }
      if (this.grab >= 0 && mw) {
        const p = this.pts[this.grab];
        p.x = mw.x;
        p.y = mw.y;
        p.z = 0.25;
      }
      for (let it = 0; it < 4; it++)
        for (const c of this.cons) {
          if (!c.on) continue;
          const A = this.pts[c.a];
          const B = this.pts[c.b];
          const dx = B.x - A.x;
          const dy = B.y - A.y;
          const dz = B.z - A.z;
          const d = Math.hypot(dx, dy, dz) || 1e-6;
          if (d > c.l * 3.2) {
            c.on = false;
            broke = true;
            continue;
          }
          const f = ((d - c.l) / d) * 0.5;
          const wa = A.pin ? 0 : 1;
          const wb = B.pin ? 0 : 1;
          const sw = wa + wb || 1;
          A.x += (dx * f * wa * 2) / sw;
          A.y += (dy * f * wa * 2) / sw;
          A.z += (dz * f * wa * 2) / sw;
          B.x -= (dx * f * wb * 2) / sw;
          B.y -= (dy * f * wb * 2) / sw;
          B.z -= (dz * f * wb * 2) / sw;
        }
    }
    if (this.cutMode && P.down && mw)
      for (const c of this.cons) {
        if (!c.on) continue;
        const A = this.pts[c.a];
        const B = this.pts[c.b];
        if (Math.hypot((A.x + B.x) / 2 - mw.x, (A.y + B.y) / 2 - mw.y) < 0.07) {
          c.on = false;
          broke = true;
        }
      }
    if (broke) this.rebuildIndex();
    this.writeCloth();
  }

  // ---------- palavra ----------
  buildTargets() {
    const c2 = this.els?.c2;
    if (!c2) return;
    const W = c2.width;
    const H = c2.height;
    const txt = (this.els!.word() || "RITO").slice(0, 16).toUpperCase();
    const o = document.createElement("canvas");
    o.width = W;
    o.height = H;
    const ox = o.getContext("2d")!;
    let fs = H * 0.3;
    const font = () => (ox.font = `900 ${fs}px "Inter Tight Variable", "Inter Tight", sans-serif`);
    font();
    const mw0 = ox.measureText(txt).width;
    if (mw0 > W * 0.86) {
      fs *= (W * 0.86) / mw0;
      font();
    }
    ox.textAlign = "center";
    ox.textBaseline = "middle";
    ox.fillStyle = "#fff";
    ox.fillText(txt, W / 2, H * 0.48);
    const d = ox.getImageData(0, 0, W, H).data;
    const step = Math.round(5 * this.d2);
    const targets: [number, number][] = [];
    for (let y = 0; y < H; y += step)
      for (let x = 0; x < W; x += step) if (d[(y * W + x) * 4 + 3] > 128) targets.push([x + (Math.random() - 0.5) * step * 0.6, y + (Math.random() - 0.5) * step * 0.6]);
    targets.sort(() => Math.random() - 0.5);
    if (targets.length > 3200) targets.length = 3200;
    while (this.parts.length < targets.length) this.parts.push({ x: Math.random() * W, y: H + Math.random() * 80, vx: 0, vy: 0, l: Math.random(), t: null });
    this.parts.forEach((p, i) => (p.t = targets[i] || null));
    if (this.reduced)
      this.parts.forEach((p) => {
        if (p.t) {
          p.x = p.t[0];
          p.y = p.t[1];
        }
      });
  }
  private stepWord(dt: number) {
    const c2 = this.els!.c2;
    const x2 = this.x2!;
    const W = c2.width;
    const H = c2.height;
    const d = this.d2;
    const P = this.P;
    x2.globalCompositeOperation = "source-over";
    x2.fillStyle = "rgba(0,0,0,.28)";
    x2.fillRect(0, 0, W, H);
    x2.globalCompositeOperation = "lighter";
    const mx = P.x * d;
    const my = P.y * d;
    const f = Math.min(2, dt * 60);
    const red = this.reduced;
    const now = this.time * 1000;
    this.parts = this.parts.filter((p) => p.t || (p.y > -20 && p.l > 0));
    for (const p of this.parts) {
      if (p.t) {
        const ax = (p.t[0] - p.x) * 0.045;
        const ay = (p.t[1] - p.y) * 0.045;
        p.vx = (p.vx + ax * f) * Math.pow(0.86, f);
        p.vy = (p.vy + ay * f) * Math.pow(0.86, f);
      } else {
        p.vy -= 0.08 * f;
        p.l -= dt * 0.7;
      }
      if (P.in && !red) {
        const dx = p.x - mx;
        const dy = p.y - my;
        const dd = dx * dx + dy * dy;
        const R = 90 * d;
        if (dd < R * R) {
          const k = (1 - Math.sqrt(dd) / R) * 2.2;
          p.vx += (dx / (Math.sqrt(dd) + 1)) * k * f;
          p.vy += (dy / (Math.sqrt(dd) + 1)) * k * f;
        }
      }
      if (!red) {
        p.x += p.vx * f;
        p.y += p.vy * f;
      } else if (p.t) {
        p.x = p.t[0];
        p.y = p.t[1];
      }
      const sp = Math.min(1, Math.hypot(p.vx, p.vy) / 6);
      const fl = 0.55 + 0.45 * Math.sin(now / 120 + p.l * 40);
      x2.fillStyle = `rgba(${200 + 55 * sp},${30 + 150 * sp * fl},${30 + 40 * sp},${p.t ? 0.9 : p.l})`;
      const s = (1.3 + sp * 1.4) * d;
      x2.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
  }

  // ---------- fluido (Stam, CPU) ----------
  private initFluid() {
    const c2 = this.els?.c2;
    if (!c2) return;
    this.FN = this.narrow ? 72 : 144;
    this.FM = Math.max(8, Math.round((this.FN * c2.height) / Math.max(1, c2.width)));
    const S = (this.FN + 2) * (this.FM + 2);
    this.F = { u: new Float32Array(S), v: new Float32Array(S), u0: new Float32Array(S), v0: new Float32Array(S), dn: new Float32Array(S), d0: new Float32Array(S), pr: new Float32Array(S), dv: new Float32Array(S) };
    this.off = document.createElement("canvas");
    this.off.width = this.FN;
    this.off.height = this.FM;
    this.offx = this.off.getContext("2d")!;
    this.img = this.offx.createImageData(this.FN, this.FM);
  }
  private IX = (i: number, j: number) => i + (this.FN + 2) * j;
  private advect(d: Float32Array, s: Float32Array, uu: Float32Array, vv: Float32Array, dt: number) {
    const { FN, FM, IX } = this;
    const dx = dt * FN;
    for (let j = 1; j <= FM; j++)
      for (let i = 1; i <= FN; i++) {
        const x = clamp(i - dx * uu[IX(i, j)], 0.5, FN + 0.5);
        const y = clamp(j - dx * vv[IX(i, j)], 0.5, FM + 0.5);
        const i0 = x | 0;
        const j0 = y | 0;
        const s1 = x - i0;
        const t1 = y - j0;
        d[IX(i, j)] = (1 - s1) * ((1 - t1) * s[IX(i0, j0)] + t1 * s[IX(i0, j0 + 1)]) + s1 * ((1 - t1) * s[IX(i0 + 1, j0)] + t1 * s[IX(i0 + 1, j0 + 1)]);
      }
  }
  private project() {
    const { FN, FM, IX } = this;
    const { u, v, pr, dv } = this.F!;
    const h = 1 / FN;
    for (let j = 1; j <= FM; j++)
      for (let i = 1; i <= FN; i++) {
        dv[IX(i, j)] = -0.5 * h * (u[IX(i + 1, j)] - u[IX(i - 1, j)] + v[IX(i, j + 1)] - v[IX(i, j - 1)]);
        pr[IX(i, j)] = 0;
      }
    for (let k = 0; k < 14; k++)
      for (let j = 1; j <= FM; j++) for (let i = 1; i <= FN; i++) pr[IX(i, j)] = (dv[IX(i, j)] + pr[IX(i - 1, j)] + pr[IX(i + 1, j)] + pr[IX(i, j - 1)] + pr[IX(i, j + 1)]) / 4;
    for (let j = 1; j <= FM; j++)
      for (let i = 1; i <= FN; i++) {
        u[IX(i, j)] -= (0.5 * (pr[IX(i + 1, j)] - pr[IX(i - 1, j)])) / h;
        v[IX(i, j)] -= (0.5 * (pr[IX(i, j + 1)] - pr[IX(i, j - 1)])) / h;
      }
  }
  private stepFluid(dt: number) {
    if (!this.F) this.initFluid();
    if (!this.F) return;
    const { FN, FM, IX } = this;
    const { u, v, u0, v0, dn, d0 } = this.F;
    const P = this.P;
    const h = Math.max(dt, 1 / 60);
    if (P.in) {
      const gi = clamp(Math.round(P.nx * FN), 1, FN);
      const gj = clamp(Math.round(P.ny * FM), 1, FM);
      if (this.lastF) {
        const du = (P.nx - this.lastF[0]) * 40;
        const dvv = (P.ny - this.lastF[1]) * 40;
        for (let a = -2; a <= 2; a++)
          for (let b = -2; b <= 2; b++) {
            const ii = clamp(gi + a, 1, FN);
            const jj = clamp(gj + b, 1, FM);
            const w = 1 - Math.hypot(a, b) / 3.2;
            if (w <= 0) continue;
            u[IX(ii, jj)] += du * w;
            v[IX(ii, jj)] += dvv * w;
            dn[IX(ii, jj)] = Math.min(4, dn[IX(ii, jj)] + (0.6 + Math.hypot(du, dvv) * 0.6) * w);
          }
      }
      this.lastF = [P.nx, P.ny];
    } else this.lastF = null;
    this.project();
    u0.set(u);
    v0.set(v);
    this.advect(u, u0, u0, v0, h);
    this.advect(v, v0, u0, v0, h);
    this.project();
    d0.set(dn);
    this.advect(dn, d0, u, v, h);
    for (let k = 0; k < dn.length; k++) {
      dn[k] *= 0.988;
      u[k] *= 0.995;
      v[k] *= 0.995;
    }
    const D = this.img!.data;
    for (let j = 0; j < FM; j++)
      for (let i = 0; i < FN; i++) {
        const q = Math.min(1, dn[IX(i + 1, j + 1)] * 0.55);
        const o = (j * FN + i) * 4;
        D[o] = Math.min(255, 255 * Math.min(1, q * 1.9));
        D[o + 1] = 255 * Math.max(0, q - 0.45) * 1.5 * (q > 0.45 ? 1 : 0) + 11 * q;
        D[o + 2] = 255 * Math.max(0, q - 0.75) * 3 + 25 * q;
        D[o + 3] = 255;
      }
    this.offx!.putImageData(this.img!, 0, 0);
    const x2 = this.x2!;
    x2.globalCompositeOperation = "source-over";
    x2.imageSmoothingEnabled = true;
    x2.drawImage(this.off!, 0, 0, this.els!.c2.width, this.els!.c2.height);
  }

  // ---------- entrada ----------
  pointer(kind: "move" | "down" | "up" | "leave", x: number, y: number, type: string) {
    const P = this.P;
    if (kind === "leave") return void (P.in = false);
    Object.assign(P, { x, y, nx: x / innerWidth, ny: y / innerHeight, in: true, type });
    if (kind === "down") {
      P.down = true;
      P.sx = x;
    }
    if (kind === "up") {
      P.down = false;
      if (this.mode === "corr") {
        if (Math.abs(x - P.sx) > 40) this.select(this.sel + (x < P.sx ? 1 : -1));
        else {
          this.nv.set(P.nx * 2 - 1, -(P.ny * 2 - 1));
          this.rc.setFromCamera(this.nv, this.ccam);
          const hit = this.rc.intersectObjects(this.previews.map((p) => p.obj), false)[0];
          if (hit) {
            const i = hit.object.userData.i as number;
            if (i === this.sel) this.setMode(RELICS[i].id);
            else this.select(i);
          }
        }
      }
      if (type !== "mouse") P.in = false;
      this.grab = -1;
    }
  }
  overRelic() {
    if (this.mode !== "corr" || !this.P.in) return false;
    this.nv.set(this.P.nx * 2 - 1, -(this.P.ny * 2 - 1));
    this.rc.setFromCamera(this.nv, this.ccam);
    return this.rc.intersectObjects(this.previews.map((p) => p.obj), false).length > 0;
  }
  resize2d() {
    const c2 = this.els?.c2;
    if (!c2) return;
    const w = innerWidth;
    const h = innerHeight;
    const d = Math.min(devicePixelRatio || 1, 1.5);
    this.d2 = d;
    c2.width = Math.round(w * d);
    c2.height = Math.round(h * d);
    this.x2 = c2.getContext("2d");
    if (this.mode === "word") this.buildTargets();
    if (this.mode === "fluid") this.initFluid();
  }

  // ---------- loop ----------
  update(dt: number, time: number) {
    if (!this.object.visible) return;
    const w = this.world.vw;
    const h = this.world.vh;
    if (w !== this.size.w || h !== this.size.h) {
      this.size = { w, h };
      for (const c of [this.ccam, this.ocam, this.ccam2]) {
        c.aspect = w / h;
        c.fov = w / h < 0.8 ? 60 : 42;
        c.updateProjectionMatrix();
      }
    }
    if (this.t0 < 0) this.t0 = time;
    this.time = time;
    const red = this.reduced;
    const t = time - this.t0;
    const P = this.P;
    if (this.mode === "corr") {
      this.camX += (this.sel * 2.6 - this.camX) * (red ? 1 : 0.08);
      const narrow = this.ccam.aspect < 0.8;
      this.ccam.position.set(this.camX + (P.in && P.type === "mouse" ? (P.nx - 0.5) * 0.4 : 0), 0.55, narrow ? 4.6 : 3.6);
      this.ccam.lookAt(this.camX, 0.1, 0);
      this.previews.forEach((p, i) => {
        const a = i === this.sel ? 1 : 0.35;
        if (!red) p.obj.rotation.y += dt * (i === this.sel ? 0.8 : 0.2);
        (p.rim.material as THREE.MeshBasicMaterial).color.setRGB(0.76 * a + 0.1, 0.04, 0.13);
        p.obj.position.y = 0.45 + (red ? 0 : Math.sin(t * 1.2 + i) * 0.04);
        const m = (p.obj as THREE.Mesh).material as THREE.ShaderMaterial;
        if (m.uniforms?.uT) m.uniforms.uT.value = red ? 0 : t;
        if (p.base) {
          const geo = (p.obj as THREE.Mesh).geometry;
          const pa = geo.attributes.position.array as Float32Array;
          const b = p.base;
          for (let k = 0; k < pa.length; k += 3) pa[k + 2] = red ? 0 : Math.sin(b[k] * 5 + t * 2.4) * 0.05 * (b[k + 1] + 0.4);
          geo.attributes.position.needsUpdate = true;
        }
      });
    } else if (this.mode === "orb") {
      if (this.mic) {
        this.mic.an.getByteTimeDomainData(this.mic.buf);
        let s = 0;
        for (const b of this.mic.buf) {
          const q = (b - 128) / 128;
          s += q * q;
        }
        this.micLvl += (Math.min(1, Math.sqrt(s / this.mic.buf.length) * 5) - this.micLvl) * 0.3;
      } else this.micLvl *= 0.9;
      const U = (this.orb.material as THREE.ShaderMaterial).uniforms;
      U.uT.value = red ? 0 : t;
      U.uAmp.value = this.micLvl;
      const mw = P.in ? this.screenToPlane(this.ocam) : null;
      U.uMs.value += ((mw ? 1 : 0) - U.uMs.value) * 0.08;
      if (mw) U.uM.value.set(mw.x, mw.y, 1.2);
      if (!red) this.orb.rotation.y += dt * 0.15;
    } else if (this.mode === "cloth") {
      if (!red || P.down) this.stepCloth(red ? 1 / 60 : Math.min(dt, 1 / 30));
    } else if (this.mode === "word") {
      if (this.x2) this.stepWord(dt);
    } else if (this.mode === "fluid") {
      if (this.x2) this.stepFluid(dt);
    }
  }
  warmList() {
    return [
      { scene: this.corr, camera: this.ccam, aces: true },
      { scene: this.orbS, camera: this.ocam, aces: true },
      { scene: this.clothS, camera: this.ccam2, aces: true },
    ];
  }
  render(r: THREE.WebGLRenderer) {
    if (this.mode === "word" || this.mode === "fluid") return;
    const prevTM = r.toneMapping;
    const prevCS = r.outputColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.setRenderTarget(null);
    if (this.mode === "corr") r.render(this.corr, this.ccam);
    else if (this.mode === "orb") r.render(this.orbS, this.ocam);
    else r.render(this.clothS, this.ccam2);
    r.toneMapping = prevTM;
    r.outputColorSpace = prevCS;
  }
  dispose() {
    this.stopMic();
    this.emb.dispose();
  }
}
