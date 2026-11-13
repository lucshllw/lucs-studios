"use client";
// /studio — WORKSHOP v3 (proposals/finale/js/workshop3.js, aprovado por Lucas 13/11) portado para o World único:
// GLB bakeado no Blender (meshopt + WebP), carregamento progressivo 1K → 4K (390 fica no 1K), HDRI CC0 (desktop),
// texturas CC0 (Poly Haven), RectAreaLights, pós (bloom seletivo, motion blur só com a câmera em movimento, SMAA,
// vinheta/grão) e render sob demanda (~15 fps parado). Mesmo renderer/ticker do site: o tone mapping ACES + sRGB é
// ligado só durante o render desta camada e restaurado em seguida.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Pass, FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import type { World, WorldLayer } from "./World";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const smooth = (t: number) => {
  t = clamp(t);
  return t * t * (3 - 2 * t);
};
const B = "/studio/";

export type HotId = "reel" | "works" | "keyboard" | "case" | "folder" | "phone" | "lamp";
export const HOT_LABEL: Record<HotId, string> = {
  reel: "Monitor · Reel ▶",
  works: "Monitor · Works",
  keyboard: "Keyboard · Type",
  case: "Case · Stack",
  folder: "Folder · Résumé",
  phone: "Phone · WhatsApp",
  lamp: "Lamp · Night ↔ Ritual",
};
const NODE: Record<HotId, string> = { reel: "MonitorR", works: "MonitorL", keyboard: "Keyboard", case: "Case", folder: "Folder", phone: "Phone", lamp: "Lamp" };

type Hot = { id: HotId; proxy: THREE.Mesh; out: THREE.LineSegments; top: number };
export type StudioEls = {
  label: HTMLElement;
  bar: HTMLElement;
  barText: HTMLElement;
  loader: HTMLElement;
  onAction: (id: HotId, rect: { x: number; y: number; w: number; h: number } | null) => void;
  onStatus: (s: string) => void;
  onLoaded: () => void;
};

class CameraBlurPass extends Pass {
  prev = new THREE.Matrix4();
  inv = new THREE.Matrix4();
  strength = 0;
  mat: THREE.ShaderMaterial;
  fsq: FullScreenQuad;
  constructor() {
    super();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, uInv: { value: new THREE.Matrix4() }, uPrev: { value: new THREE.Matrix4() }, uS: { value: 0 } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `uniform sampler2D tDiffuse,tDepth; uniform mat4 uInv,uPrev; uniform float uS; varying vec2 vUv;
        void main(){ float z=texture2D(tDepth,vUv).x; vec4 w=uInv*vec4(vUv*2.-1.,z*2.-1.,1.); w/=w.w; vec4 pc=uPrev*w; vec2 pu=pc.xy/pc.w*.5+.5;
          vec2 vel=(vUv-pu)*uS; float L=length(vel); if(L>.04) vel*=.04/L; vec4 c=vec4(0.);
          for(int i=0;i<10;i++){ float t=float(i)/9.-.5; c+=texture2D(tDiffuse,vUv+vel*t); } gl_FragColor=c/10.; }`,
    });
    this.fsq = new FullScreenQuad(this.mat);
  }
  render(r: THREE.WebGLRenderer, write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const u = this.mat.uniforms;
    u.tDiffuse.value = read.texture;
    u.tDepth.value = read.depthTexture;
    u.uInv.value.copy(this.inv);
    u.uPrev.value.copy(this.prev);
    u.uS.value = this.strength;
    r.setRenderTarget(this.renderToScreen ? null : write);
    this.fsq.render(r);
  }
}
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uT: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uT; varying vec2 vUv; float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233))+uT)*43758.5453); }
    void main(){ vec4 c=texture2D(tDiffuse,vUv); vec2 d=vUv-.5; float v=smoothstep(.85,.25,length(d*vec2(1.,.8))); c.rgb*=mix(.62,1.,v); c.rgb+=(h(vUv*1000.)-.5)*.022; gl_FragColor=c; }`,
};

export class StudioLayer implements WorldLayer {
  object = new THREE.Group(); // marcador de visibilidade (cena própria em `scene`)
  world: World;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(36, 1, 0.03, 40);
  reduced: boolean;
  narrow: boolean;
  lite = false;
  weak: boolean;
  els: StudioEls | null = null;
  hots: Hot[] = [];
  hover: Hot | null = null;
  ritual = 0;
  private ritualT = 0;
  private target = new THREE.Vector3(-0.1, 0.34, -0.2);
  private COL = { night: new THREE.Color(0x7b3cff), ritual: new THREE.Color(0xc20b21) };
  private modeCol = new THREE.Color(0x7b3cff);
  private rectR = new THREE.RectAreaLight(0xcfd8ff, 0, 0.98, 0.55);
  private rectL = new THREE.RectAreaLight(0xe8e8ff, 0, 0.86, 0.5);
  private rectWall: THREE.RectAreaLight;
  private rectStrip: THREE.RectAreaLight;
  private fanLight = new THREE.PointLight(0xffffff, 0, 1.3, 1.6);
  private lampLight = new THREE.PointLight(0xc20b21, 0, 2.2, 1.5);
  private SR: { c: HTMLCanvasElement; x: CanvasRenderingContext2D; t: THREE.CanvasTexture };
  private SL: { c: HTMLCanvasElement; x: CanvasRenderingContext2D; t: THREE.CanvasTexture };
  private scrR: THREE.MeshPhysicalMaterial;
  private scrL: THREE.MeshPhysicalMaterial;
  private U: Record<string, THREE.IUniform>;
  private ringMat: THREE.ShaderMaterial;
  private ledMat: THREE.ShaderMaterial;
  private CC: Record<string, THREE.Texture>;
  private GRAIN: THREE.CanvasTexture;
  private emblem: HTMLImageElement | null = null;
  private caps: HTMLImageElement[] = [];
  private names: string[];
  private typed = "";
  leftMode: "chat" | "works" | "type" = "chat";
  private worksT = 0;
  private kbPlate: THREE.MeshPhysicalMaterial | null = null;
  private gltfRoot: THREE.Object3D | null = null;
  private proxies: THREE.Mesh[] = [];
  private keys: THREE.InstancedMesh | null = null;
  private keyHeat: Float32Array | null = null;
  private keyIndex = new Map<string, number>();
  private fanBlades: THREE.Object3D[] = [];
  private lampDome: THREE.MeshStandardMaterial | null = null;
  private phoneScr: THREE.MeshStandardMaterial | null = null;
  private fanBoost = 0;
  private pmrem: THREE.PMREMGenerator;
  private composer: EffectComposer | null = null;
  private blur: CameraBlurPass | null = null;
  private bloom: UnrealBloomPass | null = null;
  private finalPass: ShaderPass | null = null;
  private dirty = 3;
  private born = -1;
  private lastRender = 0;
  private az = 0;
  private pol = 0;
  private azS = 0;
  private polS = 0;
  P = { x: 0, y: 0, nx: 0.5, ny: 0.5, in: false, down: false, dx: 0, dy: 0, moved: 0, type: "mouse" };
  private ray = new THREE.Raycaster();
  private v2 = new THREE.Vector2();
  private prevCam = new THREE.Matrix4();
  private prevPos = new THREE.Vector3();
  private prevQ = new THREE.Quaternion();
  private tmpV = new THREE.Vector3();
  private size = { w: 0, h: 0 };
  private alive = true;
  private loadedFinal = false;
  private slow = 0;
  private fr = { n: 0, t: 0 };

  constructor(world: World, opts: { reduced: boolean; captures: string[]; names: string[] }) {
    this.world = world;
    this.reduced = opts.reduced;
    this.names = opts.names;
    this.narrow = window.innerWidth < 760;
    this.lite = document.documentElement.classList.contains("lite");
    // LITE: sem pós (bloom/blur/SMAA), sem HDRI e só o GLB 1K
    this.weak = this.lite || this.narrow || (navigator.hardwareConcurrency || 8) <= 4;
    const r = world.renderer;
    RectAreaLightUniformsLib.init();
    this.scene.background = new THREE.Color(0x020104);
    this.pmrem = new THREE.PMREMGenerator(r);
    this.hdrReady = this.buildEnv();
    // texturas CC0: 1K primeiro em todos os aparelhos (decodificadas fora do thread principal via ImageBitmap); no
    // desktop o 2K substitui depois que a cena 4K entra (upgradeTextures)
    const cc = (n: string, srgb = false) => {
      const t = new THREE.Texture();
      t.flipY = false;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 8;
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.name = n;
      this.fetchTex(t, "1k");
      return t;
    };
    this.CC = {
      denimN: cc("denim_nor"), denimR: cc("denim_rough"), denimD: cc("denim_diff"),
      oakD: cc("oak_diff", true), oakN: cc("oak_nor"), oakR: cc("oak_rough"),
      metD: cc("metal_diff", true), metN: cc("metal_nor"), metA: cc("metal_arm"),
    };
    this.rectWall = new THREE.RectAreaLight(this.modeCol, 0, 2.6, 0.05);
    this.rectWall.position.set(0.32, -0.01, -0.62);
    this.rectWall.lookAt(0.32, 0.3, -0.92);
    this.rectStrip = new THREE.RectAreaLight(this.modeCol, 0, 2.7, 0.02);
    this.rectStrip.position.set(0.32, -0.04, 0.63);
    this.rectStrip.lookAt(0.32, -0.74, 1.4);
    this.fanLight.position.set(-1.15, 0.1, -0.02);
    this.lampLight.position.set(-1.25, 0.85, -0.05);
    this.scene.add(this.rectR, this.rectL, this.rectWall, this.rectStrip, this.fanLight, this.lampLight);

    const screenTex = (w = 1280, h = 720) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      t.flipY = false;
      return { c, x: c.getContext("2d")!, t };
    };
    this.SR = screenTex();
    this.SL = screenTex();
    const screenMat = (map: THREE.Texture) =>
      new THREE.MeshPhysicalMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0, roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.scrR = screenMat(this.SR.t);
    this.scrL = screenMat(this.SL.t);
    const img = new Image();
    img.src = "/brand/avatar-emblem.webp";
    img.onload = () => {
      this.emblem = img;
      this.drawRight();
    };
    opts.captures.forEach((src, i) => {
      const im = new Image();
      im.src = src;
      im.onload = () => void (this.caps[i] = im);
    });
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
      this.drawRight();
      this.drawLeft(0);
      this.dirty = 2;
    });

    this.U = {
      uX0: { value: -1 }, uX1: { value: 1 }, uY0: { value: -1 }, uY1: { value: 1 }, uT: { value: 0 }, uOn: { value: 0 }, uRit: { value: 0 },
      uC: { value: this.modeCol }, uLed: { value: 0 }, uKb: { value: 0 },
    };
    this.ringMat = new THREE.ShaderMaterial({
      uniforms: this.U,
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform float uT,uOn,uRit; varying vec3 vP; vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){ float a=atan(vP.y,vP.x)/6.2831+.5; vec3 c=mix(hue(fract(a*1.+uT)), vec3(1.,.02,.05), uRit); gl_FragColor=vec4(c*1.7*uOn,1.); }`,
    });
    this.ledMat = new THREE.ShaderMaterial({
      uniforms: this.U,
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `uniform vec3 uC; uniform float uLed,uX0,uX1; varying vec3 vP; void main(){ float x=(vP.x-uX0)/(uX1-uX0); float d=1.-smoothstep(.12,.45,abs(fract(x*96.)-.5)); float on=step(x,uLed);
        gl_FragColor=vec4(uC*(2.2+d*5.)*on + vec3(.02),1.); }`,
    });
    this.GRAIN = this.grainNormal();
    this.setupPost();
    this.load();
  }

  private postC: EffectComposer | null = null;
  private postOff = false;
  private wantHi = false;
  private hdrReady: Promise<void> = Promise.resolve();
  /** ambiente PBR: os shaders do PMREM (GGX/blur/equirect) e da RoomEnvironment são compilados em paralelo antes do
   *  1º uso — antes, o filtro GGX compilava de forma síncrona e travava ~0,7 s a montagem */
  private async buildEnv() {
    const r = this.world.renderer;
    const g = this.pmrem as unknown as Record<string, unknown> & {
      compileEquirectangularShader(): void;
      compileCubemapShader(): void;
      _setSize(n: number): void;
      _allocateTargets(): THREE.WebGLRenderTarget;
    };
    const room = new RoomEnvironment();
    try {
      g.compileEquirectangularShader();
      g.compileCubemapShader();
      g._setSize(256);
      g._allocateTargets().dispose();
      const warm = new THREE.Scene();
      const geo = new THREE.PlaneGeometry(2, 2);
      // as malhas reais do PMREM (atributos iguais aos do render) recebem cada material só para a compilação
      const lods = g._lodMeshes as THREE.Mesh[];
      const used: THREE.Mesh[] = [];
      ["_ggxMaterial", "_blurMaterial", "_equirectMaterial", "_cubemapMaterial"].forEach((k, i) => {
        const m = g[k] as THREE.Material | null;
        if (!m) return;
        const mesh = lods[i] ? new THREE.Mesh(lods[i].geometry, m) : new THREE.Mesh(geo, m);
        used.push(mesh);
        warm.add(mesh);
      });
      const prev = r.getRenderTarget();
      r.setRenderTarget(g._pingPongRenderTarget as THREE.WebGLRenderTarget);
      const ps = [r.compileAsync(warm, new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)), r.compileAsync(room, new THREE.PerspectiveCamera(90, 1, 0.1, 100))];
      r.setRenderTarget(prev);
      await Promise.race([Promise.all(ps), new Promise((res) => setTimeout(res, 5000))]);
    } catch {
      /* segue: compila no uso */
    }
    if (!this.alive) return;
    this.scene.environment = this.pmrem.fromScene(room, 0.04).texture;
    this.scene.environmentIntensity = 0.16;
    if (this.narrow || this.lite) return;
    // desktop: HDRI CC0 entra antes da 1ª compilação dos materiais (trocar o envMap depois recompila tudo)
    await new Promise<void>((res) => {
      new HDRLoader().load(
        B + "tex/studio_small_09_1k.hdr",
        (t) => {
          if (!this.alive) return void (t.dispose(), res());
          t.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.environment = this.pmrem.fromEquirectangular(t).texture;
          this.scene.environmentIntensity = 0.1;
          this.scene.environmentRotation = new THREE.Euler(0, 2.2, 0);
          t.dispose();
          this.dirty = 3;
          res();
        },
        undefined,
        () => res()
      );
    });
  }
  private bmpLoader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "none" });
  private fetchTex(t: THREE.Texture, size: "1k" | "2k") {
    this.bmpLoader.load(`${B}tex/${t.name}-${size}.webp`, (bmp) => {
      if (!this.alive) return void (bmp as ImageBitmap).close?.();
      const old = t.source.data as ImageBitmap | null;
      t.source.data = bmp;
      t.source.needsUpdate = true;
      old?.close?.();
      this.dirty = 2;
    });
  }
  private upgradeTextures() {
    Object.values(this.CC).forEach((t) => this.fetchTex(t, "2k"));
  }

  // ---------- telas ----------
  private drawRight() {
    const { x, c, t } = this.SR;
    const k = c.width / 1024;
    x.setTransform(k, 0, 0, k, 0, 0);
    x.fillStyle = "#060608";
    x.fillRect(0, 0, 1024, 576);
    x.fillStyle = "#16161c";
    x.fillRect(0, 0, 1024, 30);
    ["#ff5f57", "#febc2e", "#28c840"].forEach((q, i) => {
      x.fillStyle = q;
      x.beginPath();
      x.arc(16 + i * 16, 15, 4.5, 0, 7);
      x.fill();
    });
    x.fillStyle = "#f4f4f2";
    x.font = '900 112px "Inter Tight Variable", "Inter Tight", sans-serif';
    x.fillText("CREATIVE", 150, 205);
    if (this.emblem) {
      x.save();
      x.beginPath();
      x.arc(640, 290, 120, 0, 7);
      x.clip();
      x.drawImage(this.emblem, 520, 170, 240, 240);
      x.restore();
    }
    x.font = '400 96px "UnifrakturMaguntia", serif';
    x.fillText("Developer", 430, 420);
    x.font = '500 15px "Inter Tight Variable", "Inter Tight", sans-serif';
    x.fillStyle = "#ddd";
    x.fillText("I build the whole system: data, APIs, interfaces and", 40, 505);
    x.fillText("the motion on top. Click this screen to play the reel.", 40, 526);
    x.fillStyle = "#1b1b22";
    x.fillRect(0, 546, 1024, 30);
    x.fillStyle = "#c20b21";
    x.fillRect(500, 556, 10, 10);
    t.needsUpdate = true;
  }
  private drawLeft(dt: number) {
    const { x, c, t } = this.SL;
    const k = c.width / 1024;
    x.setTransform(k, 0, 0, k, 0, 0);
    const W = 1024;
    const H = 576;
    const caps = this.caps.filter(Boolean);
    if (this.leftMode === "works" && caps.length) {
      this.worksT += dt;
      x.fillStyle = "#08080a";
      x.fillRect(0, 0, W, H);
      const q = this.worksT / 1.8;
      const i = Math.floor(q) % caps.length;
      const f = smooth((q % 1) * 2.2 - 1.2);
      for (let n = -2; n <= 2; n++) {
        const j = (i + n + caps.length * 4) % caps.length;
        const pos = n - f;
        const sc = 0.62 - Math.abs(pos) * 0.14;
        if (sc <= 0.2) continue;
        const w = 760 * sc;
        const h = (w * 9) / 16;
        x.globalAlpha = 1 - Math.min(1, Math.abs(pos) * 0.45);
        x.drawImage(caps[j], W / 2 - w / 2 + pos * 330, H / 2 - h / 2 - 10, w, h);
      }
      x.globalAlpha = 1;
      x.fillStyle = "#fff";
      x.font = '900 34px "Inter Tight Variable", sans-serif';
      x.fillText("WORKS", 36, 56);
      const cur = (i + (f > 0.5 ? 1 : 0)) % caps.length;
      x.font = '500 13px "Martian Mono Variable", monospace';
      x.fillStyle = "#ff3346";
      x.fillText(`${String(cur + 1).padStart(2, "0")}/08 · ${(this.names[cur] ?? "").toUpperCase()}`, 36, H - 30);
    } else {
      x.fillStyle = "#cfd0d6";
      x.fillRect(0, 0, W, H);
      x.fillStyle = "#c3c4cc";
      x.fillRect(0, 0, 230, H);
      x.fillStyle = "#111";
      x.font = '700 18px "Inter Tight Variable", sans-serif';
      x.fillText("Notes", 22, 40);
      x.font = '500 13px "Inter Tight Variable", sans-serif';
      ["Portfolio v6", "Hero: dial + signal", "Studio scene", "Reel player", "4K captures"].forEach((s, i) => {
        if (!i) {
          x.fillStyle = "#b3b4bf";
          x.fillRect(12, 64, 206, 28);
        }
        x.fillStyle = "#333";
        x.fillText(s, 22, 83 + i * 34);
      });
      x.fillStyle = "#e4e5ea";
      x.fillRect(260, 40, W - 300, 120);
      x.fillStyle = "#555";
      x.font = '400 13px "Inter Tight Variable", sans-serif';
      ["Click the left monitor to open the works.", "Click the keyboard and type — the keys light up."].forEach((s, i) => x.fillText(s, 280, 80 + i * 24));
      x.fillStyle = "#ececf0";
      x.fillRect(260, 190, W - 300, 290);
      x.strokeStyle = "#c20b21";
      x.lineWidth = this.leftMode === "type" ? 3 : 1;
      x.strokeRect(260, 190, W - 300, 290);
      x.fillStyle = "#111";
      x.font = '500 17px "Martian Mono Variable", monospace';
      const lines = ("> " + this.typed).match(/.{1,52}/g) || ["> "];
      const last = lines.slice(-10);
      last.forEach((s, i) => x.fillText(s, 280, 226 + i * 26));
      if (this.leftMode === "type" && ((performance.now() / 500) | 0) % 2) x.fillRect(280 + x.measureText(last[last.length - 1]).width + 3, 210 + (last.length - 1) * 26, 10, 20);
      x.fillStyle = "#777";
      x.font = '500 11px "Martian Mono Variable", monospace';
      x.fillText(this.leftMode === "type" ? "TYPE · ESC TO EXIT" : "CLICK THE KEYBOARD TO TYPE", 280, 510);
    }
    t.needsUpdate = true;
  }

  // ---------- materiais ----------
  private grainNormal() {
    const N = 512;
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const x = c.getContext("2d")!;
    const im = x.createImageData(N, N);
    const h = new Float32Array(N * N);
    for (let i = 0; i < h.length; i++) h[i] = Math.random();
    for (let k = 0; k < 2; k++) for (let i = 0; i < h.length; i++) h[i] = (h[i] + h[(i + 1) % h.length] + h[(i + N) % h.length]) / 3;
    for (let y = 0; y < N; y++)
      for (let q = 0; q < N; q++) {
        const i = y * N + q;
        const dx = h[y * N + ((q + 1) % N)] - h[i];
        const dy = h[((y + 1) % N) * N + q] - h[i];
        im.data.set([128 - dx * 300, 128 - dy * 300, 255, 255], i * 4);
      }
    x.putImageData(im, 0, 0);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 6);
    return t;
  }
  private toPhys(m: THREE.MeshStandardMaterial) {
    if ((m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) return m as THREE.MeshPhysicalMaterial;
    return new THREE.MeshPhysicalMaterial({
      name: m.name, color: m.color, roughness: m.roughness, metalness: m.metalness, map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap,
      metalnessMap: m.metalnessMap, emissive: m.emissive, emissiveMap: m.emissiveMap, emissiveIntensity: m.emissiveIntensity, side: m.side,
    });
  }
  private texRep(t: THREE.Texture, x: number, y: number) {
    const c = t.clone();
    c.repeat.set(x, y);
    c.needsUpdate = true;
    return c;
  }
  private applyFabric(m: THREE.MeshStandardMaterial) {
    const p = this.toPhys(m);
    const CC = this.CC;
    p.normalMap = this.texRep(CC.denimN, 7, 2.6);
    p.normalScale = new THREE.Vector2(0.9, 0.9);
    p.roughnessMap = this.texRep(CC.denimR, 7, 2.6);
    p.roughness = 1;
    p.onBeforeCompile = (sh) => {
      sh.uniforms.uDen = { value: CC.denimD };
      sh.fragmentShader = "uniform sampler2D uDen;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb *= 1.7*mix(1., texture2D(uDen, vMapUv*vec2(7.,2.6)).r*2.2, .35);");
    };
    p.customProgramCacheKey = () => "fabric";
    return p;
  }
  private applyOak(m: THREE.MeshStandardMaterial) {
    const p = this.toPhys(m);
    const CC = this.CC;
    p.normalMap = this.texRep(CC.oakN, 3, 3);
    p.roughnessMap = this.texRep(CC.oakR, 3, 3);
    p.roughness = 1;
    p.clearcoat = 0.35;
    p.clearcoatRoughness = 0.3;
    p.onBeforeCompile = (sh) => {
      sh.uniforms.uOak = { value: CC.oakD };
      sh.fragmentShader = "uniform sampler2D uOak;\n" + sh.fragmentShader.replace("#include <map_fragment>", "#include <map_fragment>\n diffuseColor.rgb *= texture2D(uOak, vMapUv*3.).rgb*5.;");
    };
    p.customProgramCacheKey = () => "oak";
    return p;
  }
  private applyMetal(m: THREE.MeshStandardMaterial, alu: boolean) {
    const p = this.toPhys(m);
    const CC = this.CC;
    p.clearcoat = 0;
    p.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uMD: { value: CC.metD }, uMA: { value: CC.metA }, uAlu: { value: alu ? 1 : 0 } });
      sh.vertexShader = "varying vec3 vTP; varying vec3 vTN;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vTP=(modelMatrix*vec4(position,1.)).xyz*2.2; vTN=normalize(mat3(modelMatrix)*normal);");
      sh.fragmentShader =
        "uniform sampler2D uMD,uMA; uniform float uAlu; varying vec3 vTP; varying vec3 vTN;\nvec4 tri(sampler2D t){ vec3 w=pow(abs(vTN),vec3(4.)); w/=dot(w,vec3(1.)); return texture2D(t,vTP.yz)*w.x+texture2D(t,vTP.xz)*w.y+texture2D(t,vTP.xy)*w.z; }\n" +
        sh.fragmentShader
          .replace("#include <map_fragment>", "#include <map_fragment>\n vec3 md=vec3(dot(tri(uMD).rgb,vec3(.333))); diffuseColor.rgb = mix(diffuseColor.rgb*md*2.2, md*1.1, uAlu*.5);")
          .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n vec4 arm=tri(uMA); roughnessFactor = clamp(mix(roughnessFactor, arm.g, .75)*mix(1.,.7,uAlu),.08,1.);")
          .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n metalnessFactor = max(metalnessFactor*.6, arm.b);");
    };
    p.customProgramCacheKey = () => "metal" + alu;
    return p;
  }

  // ---------- carregamento progressivo ----------
  private async load() {
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    const get = (url: string, label: string) =>
      new Promise<{ scene: THREE.Group }>((res, rej) =>
        loader.load(url, res, (e) => {
          if (e.total && this.els) {
            const p = e.loaded / e.total;
            this.els.bar.style.transform = `scaleX(${p})`;
            this.els.barText.textContent = `${label} · ${Math.round(p * 100)}% · ${(e.total / 1048576).toFixed(1)} MB`;
          }
        }, rej)
      );
    try {
      await Promise.race([this.hdrReady, new Promise((r) => setTimeout(r, 8000))]);
      const low = await get(B + "setup-v3cc-1k.glb", this.narrow ? "Scene 1K" : "Preview 1K");
      if (!this.alive) return;
      await this.install(low.scene, this.narrow || this.lite);
      window.dispatchEvent(new Event("rito:ready"));
      if (!this.narrow && !this.lite) {
        const hi = await get(B + "setup-v3cc-4k.glb", "Scene 4K");
        if (!this.alive) return;
        await this.install(hi.scene, true);
      }
    } catch (e) {
      console.warn("Studio GLB failed:", (e as Error).message);
      this.els?.onStatus("The 3D scene could not be loaded");
      document.documentElement.classList.add("studio-nogl");
    }
  }
  private disposeRoot(old: THREE.Object3D) {
    {
      this.scene.remove(old);
      old.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.geometry.dispose();
        ([] as THREE.Material[]).concat(m.material).forEach((mt) => {
          if (mt === this.scrR || mt === this.scrL || mt === this.ringMat || mt === this.ledMat) return;
          for (const k in mt) {
            const v = (mt as unknown as Record<string, unknown>)[k] as THREE.Texture | undefined;
            if (v && (v as THREE.Texture).isTexture && v !== this.SR.t && v !== this.SL.t && !Object.values(this.CC).includes(v) && v !== this.GRAIN) v.dispose();
          }
          mt.dispose();
        });
      });
    }
  }
  private async install(root: THREE.Object3D, final: boolean) {
    const prev = this.gltfRoot;
    root.visible = false;
    this.scene.add(root);
    this.fanBlades = [];
    this.lampDome = null;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) {
        if (/^FanBlades\d$/.test(o.name)) this.fanBlades.push(o);
        return;
      }
      const m = mesh.material as THREE.MeshStandardMaterial;
      const n = o.name;
      if (n === "ScreenR") mesh.material = this.scrR;
      else if (n === "ScreenL") mesh.material = this.scrL;
      else if (/^FanRing/.test(n) || m?.name === "FanRing") mesh.material = this.ringMat;
      else if (n === "LEDStrip") {
        mesh.material = this.ledMat;
        mesh.geometry.computeBoundingBox();
        this.U.uX0.value = mesh.geometry.boundingBox!.min.x;
        this.U.uX1.value = mesh.geometry.boundingBox!.max.x;
      } else if (m) {
        m.envMapIntensity = 1;
        if (m.name === "Glass") {
          mesh.material = new THREE.MeshPhysicalMaterial({ color: 0x0c0a12, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false, envMapIntensity: 2.5 });
          mesh.renderOrder = 5;
        }
        if (m.name === "MetalBrushed" || m.name === "Aluminium") mesh.material = this.applyMetal(m, m.name === "Aluminium");
        if (m.name === "Deskmat") mesh.material = this.applyFabric(m);
        if (m.name === "DeskTop") mesh.material = this.applyOak(m);
        if (m.name === "PlasticGloss") {
          const p = this.toPhys(m);
          p.clearcoat = 0.6;
          p.clearcoatRoughness = 0.2;
          mesh.material = p;
        }
        if (m.name === "LampDome" || m.name === "LampVisor") this.lampDome = this.lampDome || (mesh.material as THREE.MeshStandardMaterial);
        if (m.name === "PhoneScreen") this.phoneScr = mesh.material as THREE.MeshStandardMaterial;
        if (m.name === "PlasticBlack" || m.name === "Rubber") {
          const p = this.toPhys(m);
          p.normalMap = this.GRAIN;
          p.normalScale = new THREE.Vector2(0.35, 0.35);
          p.roughness = Math.max(0.6, p.roughness);
          mesh.material = p;
        }
        if (n === "KeyboardPlate") {
          const p = this.toPhys(m);
          p.emissive = new THREE.Color(0x14e6b0);
          p.emissiveIntensity = 0;
          mesh.material = p;
          this.kbPlate = p;
        }
        if (m.map) m.map.anisotropy = 8;
      }
      if (n === "KeycapProto") o.visible = false;
    });
    const proto = root.getObjectByName("KeycapProto") as THREE.Mesh | undefined;
    const kb = root.getObjectByName("Keyboard");
    if (proto && kb) this.buildKeys(proto, kb);
    // shaders compilados em paralelo (KHR_parallel_shader_compile) ANTES do 1º render: no ANGLE/D3D11 a compilação
    // síncrona travava o thread principal por segundos (e congelava a transição de rota)
    await this.precompile(root);
    if (!this.alive) return;
    if (prev) this.disposeRoot(prev);
    this.gltfRoot = root;
    root.visible = true;
    if (!prev) this.born = -1;
    this.buildHotspots();
    if (this.els) {
      this.els.loader.classList.toggle("done", final);
      if (final) this.els.barText.textContent = this.narrow ? "1K scene loaded" : "4K scene loaded";
    }
    if (final) {
      this.loadedFinal = true;
      // 2K só quando a pessoa interage com a cena (economiza ~3,5 MB em visitas rápidas)
      this.wantHi = !this.narrow;
      this.els?.onLoaded();
    }
    this.dirty = 3;
  }
  /** compila com o MESMO estado do render real (ACES/sRGB na tela, ou alvo do composer) */
  private async precompile(root: THREE.Object3D) {
    const r = this.world.renderer;
    const prevTM = r.toneMapping;
    const prevCS = r.outputColorSpace;
    const prevRT = r.getRenderTarget();
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    if (this.postC) r.setRenderTarget(this.postC.renderTarget1);
    let p: Promise<unknown> = Promise.resolve();
    root.visible = true;
    try {
      p = r.compileAsync(root, this.cam, this.scene);
    } catch {
      /* segue com compilação no 1º render */
    }
    root.visible = false;
    r.setRenderTarget(prevRT);
    r.toneMapping = prevTM;
    r.outputColorSpace = prevCS;
    await Promise.race([p, new Promise((res) => setTimeout(res, 8000))]);
  }
  private buildKeys(proto: THREE.Mesh, kb: THREE.Object3D) {
    const g = proto.geometry.clone();
    const rows = [[1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2], [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.5], [1.75, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.25], [2.25, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.75], [1.25, 1.25, 1.25, 6.25, 1.25, 1.25, 1.25, 1.25]];
    const chars = ["`1234567890-=", "\tqwertyuiop[]\\", "\0asdfghjkl;'", "\0zxcvbnm,./", "\0\0\0 "];
    const u = 0.0265;
    const n = rows.flat().length;
    g.computeBoundingBox();
    const gs = g.boundingBox!.getSize(new THREE.Vector3());
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0d, roughness: 0.55, clearcoat: 0.15 });
    const heat = new Float32Array(n);
    const tint = new Float32Array(n);
    g.setAttribute("aHeat", new THREE.InstancedBufferAttribute(heat, 1));
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(tint, 1));
    const U = this.U;
    mat.onBeforeCompile = (sh) => {
      U.uY0.value = g.boundingBox!.min.y;
      U.uY1.value = g.boundingBox!.max.y;
      Object.assign(sh.uniforms, { uKb: U.uKb, uRit: U.uRit, uY0: U.uY0, uY1: U.uY1 });
      sh.vertexShader = "attribute float aHeat; attribute float aTint; varying float vHeat; varying float vTint; varying float vY;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n vHeat=aHeat; vTint=aTint; vY=position.y;");
      sh.fragmentShader =
        "uniform float uKb,uRit,uY0,uY1; varying float vHeat; varying float vTint; varying float vY;\n" +
        sh.fragmentShader.replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          vec3 kc=mix(vec3(.08,1.,.6),vec3(.1,.85,1.),vTint); kc=mix(kc,vec3(1.,.05,.1),uRit*.7);
          float yn=(vY-uY0)/(uY1-uY0); float under=1.-smoothstep(.0,.22,yn); float top=smoothstep(.75,.98,yn);
          totalEmissiveRadiance += kc*(under*3.2*uKb + top*vHeat*3.) + vec3(.9,1.,.95)*vHeat*top*2.;`
        );
    };
    const keys = new THREE.InstancedMesh(g, mat, n);
    this.keys = keys;
    this.keyHeat = heat;
    const d = new THREE.Object3D();
    let i = 0;
    this.keyIndex = new Map();
    const tilts = [-0.14, -0.06, 0, 0.06, 0.1];
    const lifts = [0.0026, 0.0012, 0, 0.0008, 0.0016];
    rows.forEach((row, r) => {
      let x = (-row.reduce((a, b) => a + b, 0) * u) / 2;
      row.forEach((w, c) => {
        const cx = x + (w * u) / 2;
        x += w * u;
        d.position.set(cx, 0.0265 + 0.0065 + lifts[r], -0.055 + r * u);
        d.rotation.set(tilts[r], 0, 0);
        d.scale.set((w * u - 0.0048) / gs.x, 0.011 / gs.y, (u - 0.0048) / gs.z);
        d.updateMatrix();
        keys.setMatrixAt(i, d.matrix);
        tint[i] = clamp((cx + 0.2) / 0.4);
        const ch = chars[r][c];
        if (ch && ch !== "\0" && ch !== "\t") this.keyIndex.set(ch, i);
        i++;
      });
    });
    keys.instanceMatrix.needsUpdate = true;
    kb.add(keys);
  }
  private buildHotspots() {
    this.proxies.forEach((p) => this.scene.remove(p));
    this.proxies = [];
    this.hots = [];
    for (const [id, nm] of Object.entries(NODE) as [HotId, string][]) {
      const node = this.gltfRoot?.getObjectByName(nm);
      if (!node) continue;
      const bb = new THREE.Box3().setFromObject(node);
      const size = bb.getSize(new THREE.Vector3()).addScalar(0.02);
      const c = bb.getCenter(new THREE.Vector3());
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const p = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ visible: false }));
      p.position.copy(c);
      const out = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xff2a40, transparent: true, opacity: 0, depthTest: false, toneMapped: false }));
      out.renderOrder = 9;
      // etapa 6: a caixa de contorno (depthTest off) cruzava o vão entre os monitores como uma linha vermelha solta;
      // o hover fica no rótulo 3D + cursor ritual
      out.visible = false;
      p.add(out);
      const h: Hot = { id, proxy: p, out, top: size.y / 2 };
      p.userData.h = h;
      this.scene.add(p);
      this.proxies.push(p);
      this.hots.push(h);
    }
  }

  // ---------- ações / entrada ----------
  /** retângulo em px de um objeto (para o player nascer do monitor) */
  rectOf(id: HotId) {
    const h = this.hots.find((x) => x.id === id);
    if (!h) return null;
    const bb = new THREE.Box3().setFromObject(h.proxy);
    const pts = [bb.min, bb.max].flatMap((a) => [a, new THREE.Vector3(a.x, bb.max.y, a.z), new THREE.Vector3(bb.max.x, a.y, a.z)]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of pts) {
      const v = p.clone().project(this.cam);
      const x = (v.x * 0.5 + 0.5) * this.size.w;
      const y = (-v.y * 0.5 + 0.5) * this.size.h;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }
  act(id: HotId) {
    if (id === "works") {
      this.leftMode = "works";
      this.worksT = 0;
    } else if (id === "keyboard") {
      this.leftMode = "type";
    } else if (id === "case") this.fanBoost = 1;
    else if (id === "lamp") {
      this.ritual = this.ritual ? 0 : 1;
      this.els?.onStatus(this.ritual ? "Lighting: ember ritual" : "Lighting: purple night");
    }
    this.dirty = 2;
    this.els?.onAction(id, id === "reel" || id === "works" ? this.rectOf(id) : null);
  }
  exitType() {
    if (this.leftMode !== "chat") this.leftMode = "chat";
    this.dirty = 2;
  }
  type(ch: string) {
    if (ch === "\b") this.typed = this.typed.slice(0, -1);
    else {
      this.typed = (this.typed + ch).slice(-400);
      const i = this.keyIndex.get(ch.toLowerCase());
      if (i !== undefined && this.keyHeat) this.keyHeat[i] = 1;
    }
    this.dirty = 2;
  }
  pointerMove(x: number, y: number, type: string) {
    if (this.wantHi) {
      this.wantHi = false;
      this.upgradeTextures();
    }
    const P = this.P;
    const dx = x - P.x;
    const dy = y - P.y;
    Object.assign(P, { x, y, nx: x / innerWidth, ny: y / innerHeight, in: true, type });
    if (P.down) {
      P.dx += dx;
      P.dy += dy;
      P.moved += Math.abs(dx) + Math.abs(dy);
    }
    this.dirty = Math.max(this.dirty, 1);
  }
  pointerDown(x: number, y: number, type: string) {
    Object.assign(this.P, { x, y, nx: x / innerWidth, ny: y / innerHeight, down: true, moved: 0, in: true, type });
  }
  /** devolve o hotspot clicado (ou null) */
  pointerUp(type: string) {
    const P = this.P;
    P.down = false;
    let h: Hot | null = null;
    if (P.moved < 8) {
      h = this.pick();
      if (type !== "mouse") this.hover = h;
      if (h) this.act(h.id);
      this.dirty = 2;
    }
    if (type !== "mouse") P.in = false;
    return h;
  }
  pointerLeave() {
    this.P.in = false;
  }
  private pick(): Hot | null {
    if (!this.proxies.length) return null;
    this.v2.set(this.P.nx * 2 - 1, -(this.P.ny * 2 - 1));
    this.ray.setFromCamera(this.v2, this.cam);
    const i = this.ray.intersectObjects(this.proxies, false)[0];
    return i ? (i.object.userData.h as Hot) : null;
  }
  replay() {
    this.born = -1;
    this.dirty = 3;
  }

  // ---------- pós ----------
  private setupPost() {
    if (this.weak) return;
    const r = this.world.renderer;
    const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 0 });
    rt.depthTexture = new THREE.DepthTexture(4, 4);
    rt.depthTexture.type = THREE.UnsignedIntType;
    const composer = new EffectComposer(r, rt);
    composer.renderTarget2.depthTexture = new THREE.DepthTexture(4, 4);
    composer.renderTarget2.depthTexture.type = THREE.UnsignedIntType;
    composer.addPass(new RenderPass(this.scene, this.cam));
    this.blur = new CameraBlurPass();
    this.blur.enabled = false;
    composer.addPass(this.blur);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 1.05);
    composer.addPass(this.bloom);
    composer.addPass(new OutputPass());
    this.finalPass = new ShaderPass(FinalShader);
    composer.addPass(this.finalPass);
    composer.addPass(new SMAAPass());
    this.postC = composer;
    // shaders do pós (bloom, SMAA, blur, saída) compilados em paralelo; o pós só liga quando estiverem prontos
    const mats: THREE.Material[] = [];
    const seen = new Set<unknown>();
    const grab = (v: unknown, depth: number) => {
      if (!v || typeof v !== "object" || seen.has(v) || depth > 3) return;
      seen.add(v);
      if ((v as THREE.Material).isMaterial) return void mats.push(v as THREE.Material);
      if (Array.isArray(v)) return v.forEach((x) => grab(x, depth + 1));
      if ((v as THREE.Texture).isTexture || (v as THREE.WebGLRenderTarget).isRenderTarget) return;
      for (const k of Object.keys(v)) grab((v as Record<string, unknown>)[k], depth + 1);
    };
    composer.passes.forEach((ps) => grab(ps, 0));
    const warm = new THREE.Scene();
    const quad = new THREE.PlaneGeometry(2, 2);
    quad.deleteAttribute("normal"); // mesmos atributos do FullScreenQuad (a chave do programa depende deles)
    mats.forEach((m) => warm.add(new THREE.Mesh(quad, m)));
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const prevRT = r.getRenderTarget();
    r.setRenderTarget(composer.renderTarget1);
    let ready: Promise<unknown> = Promise.resolve();
    try {
      ready = r.compileAsync(warm, fsCam);
    } catch {
      /* compila no 1º render */
    }
    r.setRenderTarget(prevRT);
    this.composer = null;
    void Promise.race([ready, new Promise((res) => setTimeout(res, 6000))]).then(() => {
      if (this.alive) this.composer = composer;
      quad.dispose();
    });
  }
  private resize(w: number, h: number) {
    this.size = { w, h };
    this.cam.aspect = w / h;
    this.cam.fov = w / h < 0.8 ? 60 : 40;
    this.cam.updateProjectionMatrix();
    if (this.postC) {
      this.postC.setPixelRatio(Math.min(this.world.renderer.getPixelRatio(), 1.5));
      this.postC.setSize(w, h);
      this.bloom?.resolution.set(w / 2, h / 2);
    }
    this.dirty = 3;
  }

  // ---------- loop (World.update) ----------
  private active = true;
  private frameNow = 0;
  update(dtIn: number, time: number) {
    if (!this.object.visible) return;
    if (this.size.w !== this.world.vw || this.size.h !== this.world.vh) this.resize(this.world.vw, this.world.vh);
    // etapa 6: a intro (escuridão → LEDs → fans → teclado → telas → luminária) começa quando a 1ª cena (1K) aparece —
    // antes ela corria durante o download/compilação e a cena surgia já no enquadramento final. A troca 1K→4K não a reinicia.
    if (this.born < 0 && this.gltfRoot) this.born = time;
    const red = this.reduced;
    const dt = red ? 0 : dtIn;
    const t = red ? 99 : this.born < 0 ? 0 : (time - this.born) * (this.lite ? 2 : 1); // LITE: versão curta
    const intro = ease(t / 2.8);
    const ledOn = smooth((t - 0.5) / 1.2), fanOn = smooth((t - 1.1) / 0.6), kbOn = smooth((t - 1.5) / 0.6), scrOn = smooth((t - 1.9) / 0.7), lampOn = smooth((t - 2.3) / 0.5);
    const P = this.P;
    const touch = P.type !== "mouse";
    if (P.down && P.moved > 8) {
      this.az = clamp(this.az - P.dx * 0.004, -0.38, 0.38);
      this.pol = clamp(this.pol + P.dy * 0.003, -0.12, 0.16);
    }
    P.dx = P.dy = 0;
    const par = P.in && !touch ? (P.nx - 0.5) * 0.07 : 0;
    const parY = P.in && !touch ? (P.ny - 0.5) * 0.04 : 0;
    this.azS += (this.az + par - this.azS) * (red ? 1 : 0.07);
    this.polS += (this.pol + parY - this.polS) * (red ? 1 : 0.07);
    const cam = this.cam;
    const R = (cam.aspect < 0.8 ? 3.9 : 3.0) * mix(2.4, 1, intro);
    const el = 0.26 + this.polS;
    const tg = this.target;
    cam.position.set(tg.x + Math.sin(this.azS + 0.12) * Math.cos(el) * R, tg.y + Math.sin(el) * R, tg.z + Math.cos(this.azS + 0.12) * Math.cos(el) * R);
    cam.lookAt(cam.aspect < 0.8 ? this.tmpV.set(0, 0.3, -0.2) : tg);
    cam.updateMatrixWorld();
    const camMove = cam.position.distanceTo(this.prevPos) + 2 * (1 - Math.abs(cam.quaternion.dot(this.prevQ)));
    this.ritualT += (this.ritual - this.ritualT) * (red ? 1 : Math.min(1, dt * 3));
    this.modeCol.copy(this.COL.night).lerp(this.COL.ritual, this.ritualT);
    this.fanBoost = Math.max(0, this.fanBoost - dt * 0.25);
    let heatOn = false;
    if (this.keyHeat && this.keys) {
      for (let i = 0; i < this.keyHeat.length; i++)
        if (this.keyHeat[i] > 0) {
          heatOn = true;
          this.keyHeat[i] = red ? 0 : Math.max(0, this.keyHeat[i] - dt * 2.2);
        }
      (this.keys.geometry.attributes.aHeat as THREE.BufferAttribute).needsUpdate = true;
    }
    const now = time * 1000;
    this.frameNow = now;
    this.active = this.dirty > 0 || camMove > 1e-5 || t < 3.2 || heatOn || this.leftMode !== "chat" || this.fanBoost > 0 || Math.abs(this.ritual - this.ritualT) > 0.002 || !!this.hover;
    const U = this.U;
    U.uT.value = red ? 0 : (now / 4000) * (1 + this.fanBoost * 5);
    if (this.kbPlate) this.kbPlate.emissiveIntensity = 1.6 * kbOn * (1 - this.ritualT * 0.5);
    U.uOn.value = fanOn;
    U.uRit.value = this.ritualT;
    U.uLed.value = ledOn * 1.001;
    U.uKb.value = kbOn;
    this.fanBlades.forEach((b, i) => (b.rotation.z = red ? 0 : (now / 1000) * (8 + i) * (1 + this.fanBoost * 5)));
    this.rectWall.color.copy(this.modeCol);
    this.rectWall.intensity = 30 * ledOn;
    this.rectStrip.color.copy(this.modeCol);
    this.rectStrip.intensity = 22 * ledOn;
    this.fanLight.color.setHSL(0.5 + 0.45 * (0.5 + 0.5 * Math.sin(U.uT.value * 6.283)), 1, 0.55).lerp(this.COL.ritual, this.ritualT);
    this.fanLight.intensity = 0.45 * fanOn;
    this.lampLight.intensity = (0.35 + this.ritualT * 1.6) * lampOn;
    if (this.lampDome) {
      this.lampDome.emissiveIntensity = (0.9 + this.ritualT * 1.4) * lampOn;
      this.lampDome.emissive?.setRGB(0.9, 0.015, 0.05);
    }
    if (this.phoneScr) this.phoneScr.emissiveIntensity = (this.hover?.id === "phone" ? 3 : 1) * scrOn;
    this.scrR.emissiveIntensity = 0.95 * scrOn;
    this.scrL.emissiveIntensity = 0.62 * scrOn;
    this.rectR.intensity = 3.2 * scrOn;
    this.rectL.intensity = 2.2 * scrOn;
    const mR = this.gltfRoot?.getObjectByName("ScreenR");
    const mL = this.gltfRoot?.getObjectByName("ScreenL");
    if (mR && mL && !this.rectR.userData.ok) {
      mR.getWorldPosition(this.rectR.position);
      this.rectR.quaternion.copy(mR.getWorldQuaternion(new THREE.Quaternion()));
      mL.getWorldPosition(this.rectL.position);
      this.rectL.quaternion.copy(mL.getWorldQuaternion(new THREE.Quaternion()));
      this.rectR.rotateY(Math.PI);
      this.rectL.rotateY(Math.PI);
      this.rectR.translateZ(-0.01);
      this.rectL.translateZ(-0.01);
      this.rectR.userData.ok = true;
    }
    const blink = (now / 500) | 0;
    if (this.leftMode !== "chat" || blink !== (this as unknown as { _b?: number })._b) {
      this.drawLeft(Math.max(dt, 0.016));
      (this as unknown as { _b?: number })._b = blink;
    }
    this.expo = 1.1 * mix(0.12, 1, intro);
    // hover + rótulo
    const h = P.in && !P.down ? this.pick() : touch ? this.hover : null;
    if (h !== this.hover) {
      this.hover = h;
      this.dirty = 2;
    }
    this.hots.forEach((x) => {
      const m = x.out.material as THREE.LineBasicMaterial;
      m.opacity += ((x === this.hover ? 1 : 0) - m.opacity) * (red ? 1 : 0.25);
    });
    const lbl = this.els?.label;
    if (lbl) {
      if (this.hover) {
        this.tmpV.copy(this.hover.proxy.position);
        this.tmpV.y += this.hover.top + 0.02;
        this.tmpV.project(cam);
        lbl.textContent = HOT_LABEL[this.hover.id];
        lbl.style.transform = `translate(${((this.tmpV.x * 0.5 + 0.5) * this.size.w).toFixed(1)}px,${((-this.tmpV.y * 0.5 + 0.5) * this.size.h).toFixed(1)}px) translate(-50%,-130%)`;
        lbl.classList.add("on");
      } else lbl.classList.remove("on");
    }
    this.camMove = camMove;
  }
  private expo = 1.1;
  private camMove = 0;
  cursor() {
    return this.hover ? "pointer" : this.P.down && this.P.moved > 8 ? "grabbing" : "grab";
  }

  // ---------- render (World.render → própria) ----------
  render(renderer: THREE.WebGLRenderer) {
    const now = this.frameNow;
    if (this.postC && !this.composer && !this.postOff) return;
    const force = this.world.forceFrame;
    if (!force && !this.active && now - this.lastRender < 66) return; // parado: ~15 fps (LED/fans)
    if (!force && this.reduced && !this.active && this.lastRender) return;
    this.lastRender = now;
    if (this.dirty > 0) this.dirty--;
    const prevTM = renderer.toneMapping;
    const prevCS = renderer.outputColorSpace;
    const prevExp = renderer.toneMappingExposure;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMappingExposure = this.expo;
    renderer.setRenderTarget(null);
    if (this.composer && this.blur && this.finalPass) {
      const vp = new THREE.Matrix4().multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse);
      this.blur.enabled = !this.reduced && this.camMove > 2e-4;
      this.blur.prev.copy(this.prevCam);
      this.blur.inv.copy(vp).invert();
      this.blur.strength = 0.9;
      this.prevCam.copy(vp);
      this.finalPass.uniforms.uT.value = (now % 1000) / 1000;
      this.composer.render();
    } else renderer.render(this.scene, this.cam);
    renderer.toneMapping = prevTM;
    renderer.outputColorSpace = prevCS;
    renderer.toneMappingExposure = prevExp;
    this.prevPos.copy(this.cam.position);
    this.prevQ.copy(this.cam.quaternion);
    // GPU fraca: render ativo < 30 fps por ~3 s desliga o pós
    this.fr.n++;
    if (now - this.fr.t > 500) {
      const f = Math.round((this.fr.n * 1000) / Math.max(1, now - this.fr.t));
      if (this.composer && this.active && f < 30) {
        if (++this.slow > 6) {
          this.composer = null;
          this.postOff = true;
          this.els?.onStatus("Post-processing turned off (performance)");
        }
      } else this.slow = 0;
      this.fr = { n: 0, t: now };
    }
  }

  dispose() {
    this.alive = false;
    this.pmrem.dispose();
    this.postC?.dispose();
    this.SR.t.dispose();
    this.SL.t.dispose();
    Object.values(this.CC).forEach((t) => t.dispose());
    this.GRAIN.dispose();
  }
}
