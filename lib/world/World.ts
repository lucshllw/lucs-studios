"use client";
// Mundo WebGL único (PROMPT-MESTRE §2.4): um renderer, uma cena, uma câmera perspectiva fov 35°.
// Vive fora do React; o canvas fica no layout raiz e persiste entre rotas. Atualizado só pelo gsap.ticker (lib/loop).
import { cover as introCover, ui } from "@/lib/store";
import * as THREE from "three";
import { gsap } from "gsap";
import { addTick } from "../loop";
import { cardFrag, cardVert, floorFrag, floorVert, fsVert, portalFrag, thumbFrag, thumbVert } from "./shaders";

export type WorldItem = { slug: string; texture: string; videos: { src: string; type: string }[] };
export type LabelPt = { x: number; y: number; rx: number; ry: number; scale: number; visible: boolean };
export type Rect = { x: number; y: number; w: number; h: number };
export type Mode = "off" | "featured" | "full" | "home" | "about" | "studio" | "lab";
const OWN: Mode[] = ["home", "about", "studio", "lab"];

/** Ponto de integração da próxima etapa: HeroGlyphs (partículas das frases do hero) e Rain entram como camadas. */
export interface WorldLayer {
  object: THREE.Object3D;
  update(dt: number, time: number): void;
  dispose(): void;
  /** render próprio (pós-processo da camada) quando a camada está visível */
  render?(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void;
}

/** alvo de pré-compilação: mesma cena/câmera/alvo/tone mapping do render real (a chave do programa depende disso) */
export type WarmTarget = { scene: THREE.Object3D; camera: THREE.Camera; target?: THREE.WebGLRenderTarget | null; aces?: boolean; within?: THREE.Scene };

type Card = {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  tex: THREE.Texture | null;
  texAspect: number;
  video: HTMLVideoElement | null;
  vtex: THREE.VideoTexture | null;
  push: number;
  hover: number;
  hoverT: number;
};

type Layout = {
  axis: 0 | 1;
  R: number;
  w: number;
  h: number;
  pitch: number;
  camPitch: number;
  y0: number;
  wpp: number; // unidades de mundo por px na distância R
  pitchPx: number;
};

const FOV = 35;
const TAN = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const OPEN_DEPTH = 6;

export class World {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 220);
  group = new THREE.Group();
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  cards: Card[] = [];
  items: WorldItem[] = [];
  layers: WorldLayer[] = [];
  L!: Layout;
  vw = 1;
  vh = 1;
  tierLevel: 1 | 2 = 2;
  reduced = false;
  mode: Mode = "off";

  // física do arco (posição contínua em índices)
  x = 0;
  xT = 0;
  v = 0;
  velS = 0;
  bend = 0;
  dragging = false;
  inertia = false;
  lastWheel = 0;
  wheelSnapped = true;
  private drag0 = { x: 0, p: 0 };
  private samples: { t: number; p: number }[] = [];
  private center = -1;

  // ponteiro / inclinação
  pointer = { x: -1, y: -1, inside: false, moved: false, fine: true };
  tilt = { x: 0, y: 0 };

  // painel aberto
  openIndex = -1;
  covered = false;
  private tweening = 0;

  // portal + miniatura
  portal = { r: 0, cx: 0, cy: 0 };
  rt: THREE.WebGLRenderTarget;
  fsScene = new THREE.Scene();
  fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  portalMat: THREE.ShaderMaterial;
  thumbScene = new THREE.Scene();
  thumbMat: THREE.ShaderMaterial;
  thumb = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, w: 200, h: 130, a: 0, aT: 0, cur: -1, rotDrag: { x: 0, y: 0 } };
  thumbFollow = true;

  onLabels?: (pts: LabelPt[]) => void;
  onCenter?: (i: number) => void;
  onLost?: () => void;

  private untick: () => void;
  private loader = new THREE.TextureLoader();
  private blank: THREE.Texture;
  private time = 0;
  private loaded = 0;
  private alive = true;

  constructor(canvas: HTMLCanvasElement, opts: { tier: 1 | 2; reduced: boolean }) {
    this.canvas = canvas;
    this.tierLevel = opts.tier;
    this.reduced = opts.reduced;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // texturas cruas, sem conversão: cor da mídia preservada
    this.camera.position.set(0, 0, 0);
    this.scene.add(this.group);

    const blankData = new Uint8Array([17, 17, 17, 255]);
    this.blank = new THREE.DataTexture(blankData, 1, 1);
    this.blank.needsUpdate = true;

    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.ShaderMaterial({
        vertexShader: floorVert,
        fragmentShader: floorFrag,
        uniforms: { uAlpha: { value: 1 }, uRing: { value: 11 }, uGlow: { value: 0 }, uCenter: { value: new THREE.Vector2() } },
        transparent: true,
        depthWrite: false,
      })
    );
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.renderOrder = -1;
    this.scene.add(this.floor);

    this.rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4 });
    this.portalMat = new THREE.ShaderMaterial({
      vertexShader: fsVert,
      fragmentShader: portalFrag,
      uniforms: {
        uScene: { value: this.rt.texture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uCenter: { value: new THREE.Vector2() },
        uRadius: { value: 0 },
        uTime: { value: 0 },
        uLite: { value: opts.tier === 1 ? 1 : 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.fsScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.portalMat));

    this.thumbMat = new THREE.ShaderMaterial({
      vertexShader: thumbVert,
      fragmentShader: thumbFrag,
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uPos: { value: new THREE.Vector2() },
        uSize: { value: new THREE.Vector2(200, 130) },
        uRot: { value: new THREE.Vector3() },
        uMapA: { value: this.blank },
        uMapB: { value: this.blank },
        uTexA: { value: 16 / 9 },
        uTexB: { value: 16 / 9 },
        uMix: { value: 0 },
        uAlpha: { value: 0 },
        uRadius: { value: 10 },
        uDark: { value: 0 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const tm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 16, 10), this.thumbMat);
    tm.frustumCulled = false;
    this.thumbScene.add(tm);

    canvas.addEventListener("webglcontextlost", this.lost, false);
    this.resize();
    this.untick = addTick((t, dt) => this.update(t, dt));
  }

  private lost = (e: Event) => {
    e.preventDefault();
    this.alive = false;
    this.onLost?.();
  };

  // ---------- conteúdo ----------
  setItems(items: WorldItem[]) {
    this.items = items;
    items.forEach((it, i) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: cardVert,
        fragmentShader: cardFrag,
        uniforms: {
          uS: { value: 0 }, uW: { value: 1 }, uH: { value: 1 }, uR: { value: 10 }, uY0: { value: 0 }, uAxis: { value: 0 },
          uBend: { value: 0 }, uWave: { value: 10 }, uTime: { value: 0 }, uIdle: { value: 1 }, uPhase: { value: i * 1.7 },
          uHoverUV: { value: new THREE.Vector2(0.5, 0.5) }, uHover: { value: 0 },
          uDentUV: { value: new THREE.Vector2(0.5, 0.5) }, uDent: { value: 0 },
          uOpen: { value: 0 }, uDepth: { value: OPEN_DEPTH }, uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
          uMap: { value: this.blank }, uHasMap: { value: 0 }, uTexAspect: { value: 16 / 9 },
          uCardAspect: { value: 1.45 }, uOpenAspect: { value: 1.6 },
          uRadius: { value: 0.039 }, uRadiusOpen: { value: 0.0185 }, uBorder: { value: 0 },
          uDim: { value: 1 }, uDark: { value: 0 }, uDarkTo: { value: 0 }, uAlpha: { value: 0 },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1, 56, 28), mat);
      mesh.frustumCulled = false;
      this.group.add(mesh);
      const card: Card = { mesh, mat, tex: null, texAspect: 16 / 9, video: null, vtex: null, push: 0, hover: 0, hoverT: 0 };
      this.cards.push(card);
      this.loader.load(it.texture, (tex) => {
        if (!this.alive) return tex.dispose();
        tex.colorSpace = THREE.NoColorSpace;
        tex.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
        card.tex = tex;
        const img = tex.image as HTMLImageElement;
        card.texAspect = img.width / img.height;
        if (!card.vtex) {
          mat.uniforms.uMap.value = tex;
          mat.uniforms.uTexAspect.value = card.texAspect;
        }
        gsap.to(mat.uniforms.uHasMap, { value: 1, duration: 0.4, ease: "power1.out" });
        if (++this.loaded === items.length) window.dispatchEvent(new Event("rito:ready"));
      });
    });
    this.applyLayout();
  }

  /** camadas ainda compilando shaders em paralelo (KHR_parallel_shader_compile): não renderizam até ficarem prontas,
   *  para que a 1ª montagem não trave o thread principal (antes: 0,7–1 s de getProgramInfoLog síncrono) */
  warming = new Set<WorldLayer>();
  warm(layer: WorldLayer, list: WarmTarget[]) {
    const r = this.renderer;
    const ps: Promise<unknown>[] = [];
    this.warming.add(layer);
    const vis = layer.object.visible;
    layer.object.visible = true;
    for (const w of list) {
      const tm = r.toneMapping;
      const cs = r.outputColorSpace;
      const rt = r.getRenderTarget();
      if (w.aces) {
        r.toneMapping = THREE.ACESFilmicToneMapping;
        r.outputColorSpace = THREE.SRGBColorSpace;
      }
      r.setRenderTarget(w.target ?? null);
      try {
        ps.push(r.compileAsync(w.scene, w.camera, w.within ?? null));
      } catch {
        /* compila no 1º render */
      }
      r.setRenderTarget(rt);
      r.toneMapping = tm;
      r.outputColorSpace = cs;
    }
    layer.object.visible = vis;
    const done = Promise.race([Promise.all(ps), new Promise((res) => setTimeout(res, 6000))]).then(() => void this.warming.delete(layer));
    return done;
  }

  addLayer(layer: WorldLayer) {
    this.layers.push(layer);
    this.scene.add(layer.object);
  }

  // ---------- layout ----------
  resize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    this.vw = vw;
    this.vh = vh;
    // LITE (sem GPU): 0,6 — o custo do SwiftShader é proporcional aos pixels
    const dpr = document.documentElement.classList.contains("lite") ? 0.6 : this.tierLevel === 1 ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(vw, vh, false);
    this.rt.setSize(Math.floor(vw * dpr), Math.floor(vh * dpr));
    this.camera.aspect = vw / vh;
    this.camera.updateProjectionMatrix();
    this.portalMat.uniforms.uRes.value.set(vw * dpr, vh * dpr);
    this.thumbMat.uniforms.uRes.value.set(vw, vh);
    this.L = this.computeLayout(vw, vh);
    this.applyLayout();
  }

  private computeLayout(vw: number, vh: number): Layout {
    if (vw < 768) {
      // 390: pilha vertical (cards 365 × ~220, gap ~10) com curvatura leve
      const R = 12;
      const wpp = (2 * R * TAN) / vh;
      const wpx = Math.min(vw - 25, 560);
      const hpx = (wpx * 220) / 365;
      return { axis: 1, R, w: wpx * wpp, h: hpx * wpp, pitch: (hpx + 10) * wpp, camPitch: 0, y0: 0, wpp, pitchPx: hpx + 10 };
    }
    // 1440×900: card central ≈ 666 × 460, centros a ~690 px, horizonte ≈ 57,8% da altura
    const R = 11.2;
    const wpp = (2 * R * TAN) / vh;
    let hpx = (vh * 460) / 900;
    let wpx = (hpx * 666) / 460;
    if (wpx > vw * 0.66) {
      wpx = vw * 0.66;
      hpx = (wpx * 460) / 666;
    }
    const camPitch = Math.atan(((0.578 - 0.5) * 2) * TAN);
    return { axis: 0, R, w: wpx * wpp, h: hpx * wpp, pitch: (wpx + 24) * wpp, camPitch, y0: R * Math.tan(camPitch), wpp, pitchPx: wpx + 24 };
  }

  private applyLayout() {
    const L = this.L;
    if (!L) return;
    if (OWN.includes(this.mode)) return; // camadas próprias controlam câmera e piso
    this.camera.position.set(0, 0, 0);
    this.camera.rotation.set(L.camPitch, 0, 0);
    this.floor.material.uniforms.uCenter.value.set(0, 0);
    this.floor.material.uniforms.uGlow.value = 0;
    this.floor.visible = L.axis === 0;
    this.floor.position.y = L.y0 - L.h / 2 - L.h * 0.16;
    this.floor.material.uniforms.uRing.value = L.R;
    for (const c of this.cards) {
      const u = c.mat.uniforms;
      u.uW.value = L.w;
      u.uH.value = L.h;
      u.uR.value = L.R;
      u.uY0.value = L.y0;
      u.uAxis.value = L.axis;
      u.uWave.value = L.pitch * 3.2;
      u.uCardAspect.value = L.w / L.h;
      u.uRadius.value = 18 / (L.h / L.wpp);
    }
  }

  /** retângulo do painel em px → espaço de visão na profundidade OPEN_DEPTH */
  private rectToView(r: Rect) {
    const upp = (2 * OPEN_DEPTH * TAN) / this.vh;
    return new THREE.Vector4((r.x + r.w / 2 - this.vw / 2) * upp, -(r.y + r.h / 2 - this.vh / 2) * upp, r.w * upp, r.h * upp);
  }

  // ---------- modo ----------
  setMode(mode: Mode, instant = false) {
    const prev = this.mode;
    this.mode = mode;
    this.canvas.style.visibility = mode === "off" ? "hidden" : "visible";
    this.canvas.style.opacity = "1";
    this.canvas.style.transform = "";
    const own = OWN.includes(mode);
    this.group.visible = !own;
    if (!own && mode !== "off") this.applyLayout();
    if (mode === "off") {
      this.pauseVideos();
      return;
    }
    if (prev === "off" && !own) {
      // entrada: cards surgem já curvos e o central "desenrola"
      for (const c of this.cards) {
        const u = c.mat.uniforms;
        if (instant || this.reduced) {
          u.uAlpha.value = 1;
          u.uIdle.value = 1;
        } else {
          u.uAlpha.value = 0;
          u.uIdle.value = 5;
          this.tween(u.uAlpha, { value: 1, duration: 0.7, ease: "power1.out" });
          this.tween(u.uIdle, { value: 1, duration: 1.1, ease: "expo.out" });
        }
      }
      this.updateVideos(true);
    }
  }

  // ---------- portal (Featured ↔ Full) ----------
  portalTo(open: boolean, duration = 0.4) {
    const diag = Math.hypot(this.vw, this.vh);
    this.portal.cx = this.vw / 2;
    this.portal.cy = this.vh / 2;
    const target = open ? diag * 0.62 : 0;
    if (this.reduced || duration === 0) {
      this.portal.r = target;
      this.tickle();
      return Promise.resolve();
    }
    return new Promise<void>((res) =>
      this.tween(this.portal, { r: target, duration: open ? 0.42 : duration, ease: open ? "power2.out" : "power2.inOut", onComplete: res })
    );
  }

  // ---------- entrada ----------
  wheel(dx: number, dy: number) {
    if (this.openIndex >= 0 || this.mode !== "featured") return;
    const d = this.L.axis === 0 ? (Math.abs(dx) > Math.abs(dy) ? dx : dy) : dy;
    this.inertia = false;
    this.xT = clamp(this.xT + d * 0.0011, -0.15, this.cards.length - 1 + 0.15);
    this.lastWheel = performance.now();
    this.wheelSnapped = false;
    if (this.reduced) this.snap();
  }

  dragStart(p: number) {
    if (this.openIndex >= 0) return;
    this.dragging = true;
    this.inertia = false;
    this.drag0 = { x: this.x, p };
    this.samples = [{ t: performance.now(), p }];
  }

  dragMove(p: number) {
    if (!this.dragging) return;
    const n = this.cards.length - 1;
    let x = this.drag0.x - (p - this.drag0.p) / this.L.pitchPx;
    if (x < 0) x = x * 0.35;
    if (x > n) x = n + (x - n) * 0.35;
    this.xT = this.x = clamp(x, -0.15, n + 0.15);
    const t = performance.now();
    this.samples.push({ t, p });
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift();
  }

  dragEnd() {
    if (!this.dragging) return;
    this.dragging = false;
    const s = this.samples;
    let v = 0;
    if (s.length > 1) {
      const a = s[0];
      const b = s[s.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.008 && performance.now() - b.t < 80) v = -(b.p - a.p) / this.L.pitchPx / dt;
    }
    if (!this.reduced && Math.abs(v) > 0.6) {
      this.v = clamp(v, -14, 14);
      this.inertia = true;
    } else this.snap();
  }

  snap() {
    this.inertia = false;
    this.wheelSnapped = true;
    this.xT = clamp(Math.round(this.xT), 0, this.cards.length - 1);
    if (this.reduced) this.x = this.xT;
  }

  goTo(i: number, instant = false) {
    this.inertia = false;
    this.wheelSnapped = true;
    this.xT = clamp(i, 0, this.cards.length - 1);
    if (instant || this.reduced) this.x = this.xT;
  }

  get centerIndex() {
    return clamp(Math.round(this.xT), 0, this.cards.length - 1);
  }

  setPointer(x: number, y: number, inside: boolean) {
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.inside = inside;
    this.pointer.moved = true;
  }

  // ---------- geometria na CPU (espelho do vertex shader, sem bossa/dent/onda) ----------
  private tmp = new THREE.Vector3();
  private cardS(i: number) {
    return (i - this.x + this.cards[i].push) * this.L.pitch;
  }
  private bentWorld(i: number, u: number, v: number, out: THREE.Vector3) {
    const L = this.L;
    const px = (u - 0.5) * L.w;
    const py = (v - 0.5) * L.h;
    const along = L.axis === 0 ? px : -py;
    const across = L.axis === 0 ? py : px;
    const s = this.cardS(i) + along * (1 + 0.08 * Math.abs(this.bend));
    const ph = (Math.PI * 2 * s) / (L.pitch * 3.2);
    const r = L.R + this.bend * 0.95 * Math.sin(ph) + this.bend * 0.28 * across * Math.cos(ph);
    const a = s / L.R;
    if (L.axis === 0) out.set(r * Math.sin(a), across + L.y0, -r * Math.cos(a));
    else out.set(across, -r * Math.sin(a) + L.y0, -r * Math.cos(a));
    out.applyMatrix4(this.group.matrixWorld);
    return out;
  }
  private toScreen(p: THREE.Vector3) {
    p.project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.vw, y: (-p.y * 0.5 + 0.5) * this.vh, z: p.z };
  }

  /** card e uv sob o ponto (px) — malha amostrada 12×6 na CPU */
  pick(px: number, py: number): { i: number; uv: THREE.Vector2 } | null {
    if (!this.L || this.mode !== "featured") return null;
    const NU = 12;
    const NV = 6;
    for (let i = 0; i < this.cards.length; i++) {
      const s = this.cardS(i);
      if (Math.abs(s / this.L.R) > 1.3) continue;
      const g: { x: number; y: number }[][] = [];
      for (let a = 0; a <= NU; a++) {
        g[a] = [];
        for (let b = 0; b <= NV; b++) g[a][b] = this.toScreen(this.bentWorld(i, a / NU, b / NV, this.tmp));
      }
      for (let a = 0; a < NU; a++)
        for (let b = 0; b < NV; b++) {
          const p00 = g[a][b], p10 = g[a + 1][b], p01 = g[a][b + 1], p11 = g[a + 1][b + 1];
          const t1 = bary(px, py, p00, p10, p11);
          if (t1) return { i, uv: new THREE.Vector2((a + t1[1] + t1[2]) / NU, (b + t1[2]) / NV) };
          const t2 = bary(px, py, p00, p11, p01);
          if (t2) return { i, uv: new THREE.Vector2((a + t2[1]) / NU, (b + t2[1] + t2[2]) / NV) };
        }
    }
    return null;
  }

  // ---------- abrir / fechar ----------
  private tween(target: object, vars: gsap.TweenVars) {
    this.tweening++;
    const done = vars.onComplete;
    return gsap.to(target, {
      ...vars,
      onComplete: (...a: unknown[]) => {
        this.tweening--;
        (done as ((...x: unknown[]) => void) | undefined)?.(...a);
      },
      onInterrupt: () => void this.tweening--,
    });
  }
  private tickle() {
    this.tweening++;
    gsap.delayedCall(0.05, () => void this.tweening--);
  }

  /** depressão no ponto clicado → card avança, desencurva e cresce até o retângulo preto do painel (~0,45 s) */
  openCard(i: number, uv: THREE.Vector2 | null, rect: Rect, opts: { instant?: boolean } = {}) {
    const c = this.cards[i];
    if (!c) return Promise.resolve();
    this.openIndex = i;
    this.inertia = false;
    this.dragging = false;
    this.goTo(i, opts.instant);
    const u = c.mat.uniforms;
    u.uRect.value.copy(this.rectToView(rect));
    u.uOpenAspect.value = rect.w / rect.h;
    u.uRadiusOpen.value = 16 / rect.h;
    u.uDarkTo.value = 0;
    c.mesh.renderOrder = 10;
    if (opts.instant || this.reduced) {
      this.cards.forEach((k, j) => {
        k.push = j === i ? 0 : j < i ? -0.6 : 0.6;
        k.mat.uniforms.uDim.value = j === i ? 1 : 0.25;
      });
      u.uOpen.value = 1;
      u.uDark.value = 1;
      u.uBorder.value = 1;
      this.tickle();
      return Promise.resolve();
    }
    if (uv) u.uDentUV.value.copy(uv);
    gsap.killTweensOf(u.uDent);
    this.tween(u.uDent, { value: 1, duration: 0.12, ease: "power2.out" });
    this.tween(u.uDent, { value: 0, duration: 0.3, delay: 0.12, ease: "power2.out" });
    this.cards.forEach((k, j) => {
      if (j === i) return;
      this.tween(k, { push: j < i ? -0.6 : 0.6, duration: 0.35, ease: "power2.out" });
      this.tween(k.mat.uniforms.uDim, { value: 0.25, duration: 0.35, ease: "power2.out" });
    });
    this.tween(u.uDark, { value: 0.45, duration: 0.15, ease: "power2.out" });
    this.tween(u.uDark, { value: 1, duration: 0.3, delay: 0.15, ease: "power1.out" });
    this.tween(u.uBorder, { value: 1, duration: 0.2, delay: 0.3 });
    return new Promise<void>((res) => {
      this.tween(u.uOpen, { value: 0.12, duration: 0.15, ease: "power2.out" });
      this.tween(u.uOpen, { value: 1, duration: 0.3, delay: 0.15, ease: "expo.out", onComplete: res });
    });
  }

  /** painel → card: clareia para #1a1a1a (75 ms), re-curva e volta ao slot (0,33 s); vizinhos retornam (0,35 s) */
  closeCard() {
    const i = this.openIndex;
    const c = this.cards[i];
    this.covered = false;
    if (!c) return Promise.resolve();
    const u = c.mat.uniforms;
    const finish = () => {
      c.mesh.renderOrder = 0;
      this.openIndex = -1;
    };
    if (this.reduced) {
      this.cards.forEach((k) => {
        k.push = 0;
        k.mat.uniforms.uDim.value = 1;
      });
      u.uOpen.value = 0;
      u.uDark.value = 0;
      u.uBorder.value = 0;
      finish();
      this.tickle();
      return Promise.resolve();
    }
    u.uDarkTo.value = 0.1;
    return new Promise<void>((res) => {
      this.tween(u.uBorder, { value: 0, duration: 0.075 });
      this.tween(u.uOpen, {
        value: 0,
        duration: 0.33,
        delay: 0.075,
        ease: "power2.inOut",
        onComplete: () => {
          finish();
          res();
        },
      });
      this.tween(u.uDark, { value: 0, duration: 0.3, delay: 0.12, ease: "power1.out" });
      this.cards.forEach((k, j) => {
        if (j === i) return;
        this.tween(k, { push: 0, duration: 0.35, delay: 0.075, ease: "power2.out" });
        this.tween(k.mat.uniforms.uDim, { value: 1, duration: 0.35, delay: 0.075, ease: "power2.out" });
      });
    });
  }

  /** troca o card aberto sem animação (próximo projeto pelo painel) */
  swapOpen(i: number, rect: Rect) {
    const prev = this.cards[this.openIndex];
    if (prev) {
      prev.mat.uniforms.uOpen.value = 0;
      prev.mat.uniforms.uDark.value = 0;
      prev.mat.uniforms.uBorder.value = 0;
      prev.mesh.renderOrder = 0;
    }
    this.openCard(i, null, rect, { instant: true });
  }

  // ---------- miniatura do Full ----------
  thumbShow(i: number | -1) {
    const t = this.thumb;
    const u = this.thumbMat.uniforms;
    if (i < 0) {
      t.aT = 0;
      t.cur = -1;
      return;
    }
    const c = this.cards[i];
    if (!c) return;
    const map = c.tex ?? this.blank;
    if (t.aT === 0 || t.cur < 0) {
      u.uMapA.value = map;
      u.uTexA.value = c.texAspect;
      u.uMix.value = 0;
      if (t.a < 0.05) {
        t.x = t.tx;
        t.y = t.ty;
      }
    } else if (t.cur !== i) {
      u.uMapB.value = map;
      u.uTexB.value = c.texAspect;
      gsap.killTweensOf(u.uMix);
      u.uMix.value = 0;
      this.tween(u.uMix, {
        value: 1,
        duration: 0.2,
        ease: "power1.out",
        onComplete: () => {
          u.uMapA.value = u.uMapB.value;
          u.uTexA.value = u.uTexB.value;
          u.uMix.value = 0;
        },
      });
    }
    t.cur = i;
    t.aT = 1;
  }

  thumbTarget(x: number, y: number) {
    this.thumb.tx = x;
    this.thumb.ty = y;
  }

  thumbToPanel(rect: Rect) {
    const t = this.thumb;
    const u = this.thumbMat.uniforms;
    this.thumbFollow = false;
    if (this.reduced) {
      t.a = t.aT = 0;
      return Promise.resolve();
    }
    return new Promise<void>((res) => {
      this.tween(t, { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2, w: rect.w, h: rect.h, duration: 0.45, ease: "expo.out", onComplete: res });
      this.tween(u.uRadius, { value: 16, duration: 0.45 });
      this.tween(u.uDark, { value: 1, duration: 0.4, delay: 0.05, ease: "power1.out" });
    });
  }

  thumbReset() {
    const t = this.thumb;
    const u = this.thumbMat.uniforms;
    gsap.killTweensOf(t);
    this.thumbFollow = true;
    t.w = 200;
    t.h = 130;
    t.a = t.aT = 0;
    t.cur = -1;
    u.uRadius.value = 10;
    u.uDark.value = 0;
    u.uAlpha.value = 0;
  }

  // ---------- vídeos (≤ 3 tocando: central ± 1; T1 só o central) ----------
  private updateVideos(force = false) {
    const c = this.centerIndex;
    if (!force && c === this.center) return;
    this.center = c;
    this.onCenter?.(c);
    const span = this.tierLevel === 1 ? 0 : 1;
    this.cards.forEach((card, i) => {
      const active = this.mode === "featured" && Math.abs(i - c) <= span && !document.hidden;
      if (active) this.playVideo(card, i);
      else card.video?.pause();
    });
  }

  private playVideo(card: Card, i: number) {
    if (!card.video) {
      const v = document.createElement("video");
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = "auto";
      v.crossOrigin = "anonymous";
      v.setAttribute("aria-hidden", "true");
      for (const s of this.items[i].videos) {
        const so = document.createElement("source");
        so.src = s.src;
        so.type = s.type;
        v.appendChild(so);
      }
      card.video = v;
      v.addEventListener(
        "playing",
        () => {
          if (!this.alive || card.vtex) return;
          const vt = new THREE.VideoTexture(v);
          vt.colorSpace = THREE.NoColorSpace;
          card.vtex = vt;
          const u = card.mat.uniforms;
          u.uMap.value = vt;
          u.uTexAspect.value = v.videoWidth / v.videoHeight || 16 / 9;
          u.uHasMap.value = 1;
        },
        { once: true }
      );
    }
    card.video.play().catch(() => {});
  }

  pauseVideos() {
    this.cards.forEach((c) => c.video?.pause());
  }
  resumeVideos() {
    this.center = -1;
    this.updateVideos(true);
  }

  // ---------- loop ----------
  private update(time: number, dt: number) {
    if (!this.alive || this.mode === "off" || !this.L || document.hidden) return;
    if (introCover.on && !this.grabReq) return; // intro opaca cobrindo: sem quadros invisíveis (TBT da carga)
    if (ui.get().menu) return; // Menu opaco aberto: o clique no item responde sem disputar o thread com o WebGL
    // LITE (sem GPU / máquina lenta): no máximo ~30 quadros/s
    if (document.documentElement.classList.contains("lite")) {
      if (time - this.liteT < 1 / 31) return;
      dt = Math.min(0.1, time - this.liteT);
      this.liteT = time;
    }
    this.time = time;
    const n = this.cards.length - 1;
    const xPrev = this.x;

    if (this.mode === "featured" && this.openIndex < 0) {
      if (this.dragging) {
        /* x segue o ponteiro 1:1 (dragMove) */
      } else if (this.inertia) {
        this.xT += this.v * dt;
        this.v *= Math.exp(-dt / 0.35);
        if (this.xT < -0.15 || this.xT > n + 0.15) this.v *= 0.5;
        this.xT = clamp(this.xT, -0.15, n + 0.15);
        if (Math.abs(this.v) < 0.25) {
          this.inertia = false;
          this.xT = clamp(Math.round(this.xT + this.v * 0.35), 0, n);
        }
        this.x += (this.xT - this.x) * (1 - Math.exp(-dt * 16));
      } else {
        if (!this.wheelSnapped && performance.now() - this.lastWheel > 110) this.snap();
        this.x += (this.xT - this.x) * (1 - Math.exp(-dt * 9));
        if (Math.abs(this.xT - this.x) < 1e-4) this.x = this.xT;
      }
    } else if (this.openIndex >= 0) {
      this.x += (this.xT - this.x) * (1 - Math.exp(-dt * 12));
    }

    const vel = dt > 0 ? (this.x - xPrev) / dt : 0;
    this.velS += (vel - this.velS) * (1 - Math.exp(-dt * 20));
    const bendT = this.reduced ? 0 : clamp(this.velS * 0.17, -1, 1);
    this.bend += (bendT - this.bend) * (1 - Math.exp(-dt * (Math.abs(bendT) > Math.abs(this.bend) ? 18 : 6)));

    // inclinação da cena pelo mouse (±1,5°) — só ponteiro fino, fora do painel
    const fine = this.pointer.fine && !this.reduced && this.openIndex < 0 && this.mode === "featured" && this.L.axis === 0;
    const tx = fine && this.pointer.inside ? (this.pointer.x / this.vw - 0.5) * 2 : 0;
    const ty = fine && this.pointer.inside ? (this.pointer.y / this.vh - 0.5) * 2 : 0;
    const k = 1 - Math.exp(-dt * 4.8);
    this.tilt.x += (ty * 0.5 * 0.026 - this.tilt.x) * k;
    this.tilt.y += (-tx * 0.026 - this.tilt.y) * k;
    this.group.rotation.set(this.tilt.x, this.tilt.y, 0);
    this.group.updateMatrixWorld();

    // bossa do cursor
    let hovered: { i: number; uv: THREE.Vector2 } | null = null;
    if (fine && this.pointer.inside && !this.dragging) hovered = this.pick(this.pointer.x, this.pointer.y);
    this.cards.forEach((c, i) => {
      const u = c.mat.uniforms;
      c.hoverT = hovered && hovered.i === i ? 1 : 0;
      if (hovered && hovered.i === i) u.uHoverUV.value.lerp(hovered.uv, 1 - Math.exp(-dt * 10));
      c.hover += (c.hoverT - c.hover) * (1 - Math.exp(-dt * 5));
      u.uHover.value = c.hover;
      u.uS.value = this.cardS(i);
      u.uBend.value = this.bend;
      u.uTime.value = this.reduced ? 0 : time;
    });

    if (this.mode === "featured" && this.openIndex < 0) this.updateVideos();
    this.emitLabels();

    // miniatura
    const t = this.thumb;
    const tu = this.thumbMat.uniforms;
    if (this.thumbFollow) {
      const kk = this.reduced ? 1 : 1 - Math.pow(1 - 0.12, dt * 60);
      const px = t.x;
      const py = t.y;
      t.x += (t.tx - t.x) * kk;
      t.y += (t.ty - t.y) * kk;
      t.vx = dt > 0 ? (t.x - px) / dt : 0;
      t.vy = dt > 0 ? (t.y - py) / dt : 0;
      t.a += (t.aT - t.a) * (1 - Math.exp(-dt * 10));
      const rz = this.reduced ? 0 : clamp(t.vx * 0.00018, -0.14, 0.14);
      t.rotDrag.x *= Math.exp(-dt * 5);
      t.rotDrag.y *= Math.exp(-dt * 5);
      tu.uRot.value.set(t.rotDrag.x, t.rotDrag.y, rz);
    } else {
      t.a = 1;
      tu.uRot.value.multiplyScalar(Math.exp(-dt * 12));
    }
    tu.uPos.value.set(t.x, t.y);
    tu.uSize.value.set(t.w, t.h);
    tu.uAlpha.value = t.a;

    for (const l of this.layers) l.update(dt, time);
    if (this.grabReq) this.forceFrame = true;
    this.render();
    this.forceFrame = false;
    if (this.grabReq) {
      // ainda no mesmo quadro do render: o drawing buffer é legível (genie)
      const g = this.grabReq;
      this.grabReq = null;
      g(this.canvas);
    }
  }

  /** quadro atual do canvas para o snapshot da transição (lido no mesmo quadro do render) */
  forceFrame = false;
  private liteT = 0;
  private grabReq: ((c: HTMLCanvasElement | null) => void) | null = null;
  grab(draw: (c: HTMLCanvasElement | null) => void) {
    if (this.mode === "off" || document.hidden || this.canvas.style.visibility === "hidden") return draw(null);
    let done = false;
    const once = (c: HTMLCanvasElement | null) => {
      if (done) return;
      done = true;
      draw(c);
    };
    this.grabReq = once;
    window.setTimeout(() => {
      if (this.grabReq === once) this.grabReq = null;
      once(null);
    }, 120);
  }

  private emitLabels() {
    if (!this.onLabels) return;
    const pts: LabelPt[] = this.cards.map((c, i) => {
      const s = this.cardS(i);
      const ang = Math.abs(s / this.L.R);
      let visible = this.mode === "featured" && ang < 0.95 && c.mat.uniforms.uOpen.value < 0.02;
      const bl = this.toScreen(this.bentWorld(i, 0.035, 0.045, this.tmp));
      const br = this.toScreen(this.bentWorld(i, 0.965, 0.045, this.tmp));
      const tl = this.toScreen(this.bentWorld(i, 0.035, 0.955, this.tmp));
      // 390: rótulos não disputam espaço com o HUD do topo/base
      if (this.L.axis === 1 && (bl.y < 96 || bl.y > this.vh - 64)) visible = false;
      const scale = clamp(Math.abs(bl.y - tl.y) / (this.L.h / this.L.wpp) / 0.91, 0.5, 1.4);
      return { x: bl.x, y: bl.y, rx: br.x, ry: br.y, scale, visible };
    });
    this.onLabels(pts);
  }

  private render() {
    const r = this.renderer;
    const active =
      this.tweening > 0 ||
      this.dragging ||
      this.inertia ||
      Math.abs(this.xT - this.x) > 1e-4 ||
      Math.abs(this.bend) > 1e-3 ||
      this.pointer.moved ||
      this.mode === "full" ||
      this.cards.some((c) => c.hover > 0.002 || (c.video && !c.video.paused));
    this.pointer.moved = false;
    if (this.covered && this.tweening === 0 && !this.forceFrame) return; // painel opaco cobrindo: não renderiza
    if (!active && !this.forceFrame && !this.layers.some((l) => l.object.visible) && this.time > 2) return;
    const ownL = OWN.includes(this.mode) ? this.layers.find((l) => l.object.visible && l.render) : undefined;
    if (ownL) {
      if (this.warming.has(ownL)) return;
      r.autoClear = true;
      ownL.render!(r, this.scene, this.camera);
      return;
    }
    const diag = Math.hypot(this.vw, this.vh);
    const fullCover = this.portal.r >= diag * 0.6;
    r.autoClear = true;
    if (this.portal.r > 0.5) {
      if (!fullCover) {
        r.setRenderTarget(this.rt);
        r.render(this.scene, this.camera);
      }
      r.setRenderTarget(null);
      const pu = this.portalMat.uniforms;
      const dpr = r.getPixelRatio();
      pu.uCenter.value.set(this.portal.cx * dpr, (this.vh - this.portal.cy) * dpr);
      pu.uRadius.value = this.portal.r * dpr;
      pu.uTime.value = this.time;
      r.render(this.fsScene, this.fsCam);
    } else {
      r.setRenderTarget(null);
      r.render(this.scene, this.camera);
    }
    if (this.thumb.a > 0.003) {
      r.autoClear = false;
      r.render(this.thumbScene, this.fsCam);
      r.autoClear = true;
    }
  }

  dispose() {
    this.alive = false;
    this.untick();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    for (const c of this.cards) {
      c.video?.pause();
      c.video?.removeAttribute("src");
      c.video?.load();
      c.vtex?.dispose();
      c.tex?.dispose();
      c.mat.dispose();
      c.mesh.geometry.dispose();
    }
    this.layers.forEach((l) => l.dispose());
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.rt.dispose();
    this.portalMat.dispose();
    this.thumbMat.dispose();
    this.renderer.dispose();
  }
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

function bary(px: number, py: number, a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) {
  const v0x = b.x - a.x, v0y = b.y - a.y, v1x = c.x - a.x, v1y = c.y - a.y, v2x = px - a.x, v2y = py - a.y;
  const den = v0x * v1y - v1x * v0y;
  if (Math.abs(den) < 1e-6) return null;
  const v = (v2x * v1y - v1x * v2y) / den;
  const w = (v0x * v2y - v2x * v0y) / den;
  const u = 1 - v - w;
  if (u < 0 || v < 0 || w < 0) return null;
  return [u, v, w];
}

// ---------- singleton (o canvas mora no layout raiz) ----------
let world: World | null = null;
export function getWorld(opts: { tier: 1 | 2; reduced: boolean }) {
  if (world) return world;
  const canvas = document.getElementById("world") as HTMLCanvasElement | null;
  if (!canvas) return null;
  try {
    world = new World(canvas, opts);
  } catch {
    world = null;
  }
  return world;
}
export function peekWorld() {
  return world;
}
