"use client";
// Intro RITO (pedido de Lucas 11/11): completa em toda carga/F5 e ao voltar à Home; curta (≤ 1,2 s) como transição
// ao trocar de aba pelo Menu. Preloader real: 3 traços acendem com fontes, load e cena (evento "rito:ready").
// Skip: botão, Esc, Enter ou clique. Reduced-motion: fade ≤ 0,3 s. Sem JS: o overlay nem aparece (classe .js);
// se o JS falhar depois do boot, uma animação CSS de segurança o esconde.
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { reducedMotion } from "@/lib/motion";
import { cover as introCover, ui } from "@/lib/store";
import { runGenie, snapshot } from "@/lib/genie";
import { isLite, lastFrameMs } from "@/lib/perf";

const VERBS = ["Builds", "Automates", "Animates", "Integrates", "Delivers"];
const norm = (p: string) => (p.replace(/\/+$/, "") || "/");
const TAB_N: Record<string, string> = { "": "00", works: "01", studio: "02", lab: "03", about: "04", resume: "05" };
const LABEL: Record<string, string> = { "": "Home", works: "Works", studio: "Studio", lab: "Lab", about: "About", resume: "Résumé" };

let readyCount = 0;
if (typeof window !== "undefined") window.addEventListener("rito:ready", () => void readyCount++);
let pageLoaded = typeof document !== "undefined" && document.readyState === "complete";
if (typeof window !== "undefined" && !pageLoaded) window.addEventListener("load", () => void (pageLoaded = true), { once: true });

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const until = (cond: () => boolean, cap: number) =>
  new Promise<void>((res) => {
    const t0 = performance.now();
    const f = () => (cond() || performance.now() - t0 > cap ? res() : setTimeout(f, 30));
    f();
  });

type Api = { go: (href: string, label: string) => void };
let api: Api | null = null;
export const intro = { go: (href: string, label: string) => api?.go(href, label) };

export function Intro() {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [status, setStatus] = useState("");
  const path = useRef(norm(pathname));
  const prevPath = useRef<string | null>(null);
  const running = useRef<{ skip: () => void } | null>(null);
  const navigating = useRef(false);
  const first = useRef(true);

  const q = (s: string) => ref.current!.querySelectorAll<HTMLElement | SVGElement>(s);
  const one = (s: string) => ref.current!.querySelector<HTMLElement>(s)!;

  function show() {
    const el = ref.current!;
    introCover.on = true;
    gsap.killTweensOf(el);
    el.classList.add("is-ctl", "is-on");
    el.classList.remove("is-done");
    gsap.set(el, { clipPath: "inset(0% 0% 0% 0%)", opacity: 1 });
    ui.set({ intro: true });
  }
  function reset() {
    gsap.set(q(".intro-dashes i"), { backgroundColor: "#2a2a2a", scaleX: 1, opacity: 1 });
    gsap.set(one(".intro-ring"), { strokeDashoffset: 252 });
    gsap.set(q(".intro-ticks line"), { opacity: 0 });
    gsap.set(one(".intro-flare"), { rotate: -90, opacity: 0, transformOrigin: "0 0" });
    gsap.set(one(".intro-emblem"), { opacity: 0.18, scale: 0.86 });
    gsap.set(q(".intro-word .in"), { yPercent: 110 });
    gsap.set(one(".intro-dest"), { opacity: 0 });
    fillAscii();
    // campo ASCII cobre 100% desde o 1º quadro; a varredura só "acende" a cópia quente acima da linha brasa.
    // (antes: o campo era revelado por clip e sumia antes do fim da varredura, e um scale .96 de uma execução
    // anterior nunca era resetado → faixa cortada ao navegar pelo Menu)
    gsap.set(one(".intro-ascii.base"), { opacity: 0.3, scale: 1, clipPath: "none" });
    gsap.set(one(".intro-ascii.hot"), { opacity: 0.8, scale: 1, clipPath: "inset(0% 0% 100% 0%)" });
    gsap.set(one(".intro-scan"), { y: 0, opacity: 0 });
    one(".intro-verb").textContent = VERBS[0];
  }
  /** gera o campo para a viewport atual, medindo a largura real do glifo (não um valor estimado).
   *  Etapa 6: desenhado em canvas 2D (antes <pre> de texto: o campo de tela cheia preenchido por JS virava o elemento
   *  de LCP e atrasava a métrica em segundos no celular) */
  function fillAscii() {
    const base = one(".intro-ascii.base") as unknown as HTMLCanvasElement;
    const hot = one(".intro-ascii.hot") as unknown as HTMLCanvasElement;
    const cs = getComputedStyle(base);
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const W = innerWidth;
    const H = innerHeight;
    base.width = hot.width = Math.round(W * dpr);
    base.height = hot.height = Math.round(H * dpr);
    const ctx = base.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.fillStyle = cs.color;
    ctx.textBaseline = "middle";
    const cw = Math.max(4, ctx.measureText("@").width);
    const lh = parseFloat(cs.lineHeight) || 15;
    const cols = Math.ceil(W / cw) + 1;
    const rows = Math.ceil(H / lh) + 1;
    const G = " .:-=+*#%@";
    for (let r = 0; r < rows; r++) {
      let line = "";
      for (let c = 0; c < cols; c++) {
        const dx = (c / cols - 0.5) * (W / H);
        const dy = r / rows - 0.5;
        const d = Math.hypot(dx, dy);
        const v = Math.max(0, 1 - Math.abs(d - 0.26) * 9) * 0.9 + Math.random() * 0.18;
        line += G[Math.min(9, Math.floor(v * 10))];
      }
      ctx.fillText(line, 0, r * lh + lh / 2);
    }
    const hx = hot.getContext("2d")!;
    hx.clearRect(0, 0, hot.width, hot.height);
    hx.drawImage(base, 0, 0);
  }
  /** medição sem sobrecarga: início/fim de cada execução (window.__intro) */
  const mark = (kind: string, t0: number, skipped = false) => {
    const w = window as unknown as { __intro?: { kind: string; ms: number; fromNav: number; skipped: boolean }[] };
    (w.__intro ??= []).push({ kind, ms: Math.round(performance.now() - t0), fromNav: Math.round(performance.now()), skipped });
  };
  function finish(focusMain: boolean) {
    introCover.on = false;
    const el = ref.current!;
    el.classList.remove("is-on");
    el.classList.add("is-done");
    ui.set({ intro: false });
    running.current = null;
    setStatus("Lucas Melo portfolio ready");
    const ae = document.activeElement;
    if (focusMain && (!ae || ae === document.body || el.contains(ae) || ae.classList.contains("hud-menu"))) document.getElementById("main")?.focus({ preventScroll: true });
  }
  const focusSkip = () => one(".intro-skip").focus({ preventScroll: true });

  /** intro completa (≈ 2,8–3,4 s): preloader → anel + marcas + flare → LUCAS / verbo / MELO → cortina sobe */
  async function full(opts: { coverFirst?: boolean; nav?: () => Promise<void> } = {}) {
    const el = ref.current!;
    const tStart = performance.now();
    running.current?.skip();
    const reduced = reducedMotion();
    let skipped = false;
    let tl: gsap.core.Timeline | null = null;
    const exit = (fast: boolean) =>
      new Promise<void>((res) => {
        introCover.on = false;
        tl?.kill();
        if (reduced || fast) gsap.to(el, { opacity: 0, duration: reduced ? 0.3 : 0.25, onComplete: res });
        else gsap.to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.4, ease: "expo.inOut", onComplete: res });
      });
    const handle = { skip: () => void (skipped = true) };
    running.current = handle;
    if (opts.coverFirst) {
      introCover.on = true;
      el.classList.add("is-ctl", "is-on");
      el.classList.remove("is-done");
      reset();
      gsap.set(el, { opacity: 1 });
      await new Promise<void>((r) =>
        gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: reduced ? 0.01 : 0.3, ease: "power2.inOut", onComplete: r })
      );
      ui.set({ intro: true, menu: false });
    } else {
      show();
      reset();
    }
    focusSkip();
    let scanDone: Promise<void> = Promise.resolve();
    if (!reducedMotion()) {
      gsap.to(one(".intro-ascii.hot"), { clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "none" });
      scanDone = new Promise<void>((r) =>
        gsap.fromTo(one(".intro-scan"), { y: 0, opacity: 1 }, { y: innerHeight, duration: 0.9, ease: "none", onComplete: r })
      );
    }
    const c0 = readyCount;
    if (opts.nav) await opts.nav();
    // preloader: fontes → página carregada → cena pronta. Na primeira carga conta desde a navegação
    // (o overlay já está na tela desde o primeiro paint), então o tempo de boot não se soma à intro.
    const t0 = first.current ? 0 : performance.now();
    first.current = false;
    const sources = [
      () => document.fonts.status === "loaded",
      () => pageLoaded,
      () => readyCount > c0 || !document.documentElement.classList.contains("gl") || !(path.current === "/" || path.current.startsWith("/works") || path.current.startsWith("/studio")),
    ];
    for (let i = 0; i < 3 && !skipped; i++) {
      setStatus(`Loading ${i + 1} of 3`);
      await until(() => sources[i]() || skipped, Math.max(0, 1100 - (performance.now() - t0)));
      const min = (i + 1) * 260 - (performance.now() - t0);
      if (min > 0 && !reduced) await delay(min);
      if (!reduced) gsap.to(q(".intro-dashes i")[i], { backgroundColor: "#c20b21", duration: 0.25, ease: "power1.out" });
    }
    if (skipped || reduced) {
      await exit(true);
      mark("full", tStart, skipped);
      return finish(true);
    }
    await Promise.race([scanDone, delay(1000)]);
    await new Promise<void>((res) => {
      tl = gsap.timeline({ onComplete: res });
      tl.to(q(".intro-dashes i"), { scaleX: 6, opacity: 0, duration: 0.35, ease: "expo.out", stagger: 0.04 }, 0)
        .to(q(".intro-ascii"), { opacity: 0, duration: 0.6, ease: "power2.out" }, 0.05)
        .to(one(".intro-scan"), { opacity: 0, duration: 0.2 }, 0)
        .to(one(".intro-ring"), { strokeDashoffset: 0, duration: 0.8, ease: "expo.out" }, 0.05)
        .to(q(".intro-ticks line"), { opacity: 1, duration: 0.2, stagger: 0.006 }, 0.1)
        .to(one(".intro-flare"), { opacity: 1, duration: 0.15 }, 0.05)
        .to(one(".intro-flare"), { rotate: 270, duration: 0.95, ease: "power2.inOut" }, 0.05)
        .to(one(".intro-flare"), { opacity: 0, duration: 0.3 }, 0.85)
        .to(one(".intro-emblem"), { opacity: 0.9, scale: 1, duration: 0.45, ease: "expo.out" }, 0.2)
        .to(one(".intro-emblem"), { opacity: 0.18, duration: 0.4 }, 0.7)
        .to(q(".intro-word .in"), { yPercent: 0, duration: 0.45, ease: "expo.out", stagger: 0.06 }, 0.6);
      // verbos rotativos (identidade v5): giram e param em DELIVERS
      const seq = [...VERBS, ...VERBS];
      seq.forEach((v, i) => tl!.call(() => void (one(".intro-verb").textContent = v), [], 0.62 + i * 0.07));
      tl.to({}, { duration: 0.1 });
      handle.skip = () => {
        skipped = true;
        tl?.kill();
        res();
      };
    });
    await exit(skipped);
    mark("full", tStart, skipped);
    finish(true);
  }

  /** intro de aba (etapa 6, pedido de Lucas): a rota troca NO MESMO QUADRO do clique (router.push primeiro) e a página
   *  carrega por baixo; por cima, uma intro de verdade (~1,4 s): o genie suga a página para o anel, varredura ASCII em
   *  tela cheia, dial desenhando, número "02 / 05" e o nome da aba grande (grotesca decodificando + blackletter), e então
   *  revela. Clique / Esc / Enter pulam na hora. LITE: ~0,6 s só com o nome + fade. Reduced-motion: fade sem animação. */
  async function short(href: string, label: string) {
    const el = ref.current!;
    const tStart = performance.now();
    running.current?.skip();
    const reduced = reducedMotion();
    const plain = reduced || isLite();
    const busy = lastFrameMs() > 50; // máquina ocupada no quadro anterior: intro sem o genie
    let skipped = false;
    let wake: () => void = () => {};
    running.current = {
      skip: () => {
        skipped = true;
        wake();
      },
    };
    navigating.current = true;
    const target = norm(href);
    router.push(href);
    let snap: HTMLCanvasElement | null = null;
    if (!plain && !busy) {
      try {
        snap = snapshot();
      } catch {
        snap = null;
      }
    }
    // cortina (opaca) por cima; o menu fecha já
    introCover.on = true;
    const sec = target.split("/")[1] ?? "";
    const n = TAB_N[sec] ?? "00";
    el.classList.add("is-ctl", "is-on", "is-short", "is-tab");
    el.classList.remove("is-done");
    gsap.killTweensOf(el);
    gsap.set(el, { clipPath: "inset(0% 0% 0% 0%)", opacity: plain ? 0 : 1 });
    gsap.set(q(".intro-word .in"), { yPercent: 110 });
    gsap.set(one(".intro-dest"), { opacity: 0 });
    const nEl = one(".intro-tab-n");
    const nameEl = one(".intro-tab-name");
    const blackEl = one(".intro-tab-black");
    nEl.textContent = `${n} / 05`;
    nameEl.textContent = label.toUpperCase();
    blackEl.textContent = label;
    setStatus(`Opening ${label}`);
    ui.set({ intro: true, menu: false });
    focusSkip();
    const hold = (ms: number) =>
      new Promise<void>((r) => {
        if (skipped) return r();
        const t = window.setTimeout(r, ms);
        wake = () => (clearTimeout(t), r());
      });
    let kind: string;
    if (plain) {
      // LITE / reduced: nome da aba + fade (~0,6 s)
      kind = reduced ? "tab-reduced" : "tab-lite";
      gsap.set(q(".intro-ascii"), { opacity: 0 });
      gsap.set(one(".intro-scan"), { opacity: 0 });
      gsap.set(one(".intro-ring"), { strokeDashoffset: 0 });
      gsap.set(q(".intro-ticks line"), { opacity: 1 });
      gsap.set([nEl, nameEl, blackEl], { opacity: 1, y: 0 });
      gsap.to(el, { opacity: 1, duration: 0.12 });
      await hold(320);
    } else {
      kind = snap ? "tab-genie" : "tab";
      fillAscii();
      gsap.set(one(".intro-ascii.base"), { opacity: 0.32, clipPath: "none" });
      gsap.set(one(".intro-ascii.hot"), { opacity: 0.85, clipPath: "inset(0% 0% 100% 0%)" });
      gsap.set(one(".intro-ring"), { strokeDashoffset: 252 });
      gsap.set(q(".intro-ticks line"), { opacity: 0 });
      gsap.set([nEl, blackEl], { opacity: 0, y: 14 });
      gsap.set(nameEl, { opacity: 1, y: 0 });
      // decodificação (comportamento do DecryptedText): caracteres aleatórios assentam da esquerda para a direita
      const final = label.toUpperCase();
      const GL = "#%@*+=-:/<>[]{}01";
      nameEl.textContent = final.replace(/\S/g, () => GL[(Math.random() * GL.length) | 0]);
      const dec = { k: 0 };
      const tl = gsap.timeline();
      if (snap) {
        const ring = one(".intro-dial").getBoundingClientRect();
        void runGenie(snap, ring.left + ring.width / 2, ring.top + ring.height / 2, 300);
      }
      tl.to(one(".intro-ascii.hot"), { clipPath: "inset(0% 0% 0% 0%)", duration: 0.75, ease: "none" }, 0)
        .fromTo(one(".intro-scan"), { y: 0, opacity: 1 }, { y: innerHeight, duration: 0.75, ease: "none" }, 0)
        .to(one(".intro-scan"), { opacity: 0, duration: 0.15 }, 0.75)
        .to(one(".intro-ring"), { strokeDashoffset: 0, duration: 0.85, ease: "expo.out" }, 0.1)
        .to(q(".intro-ticks line"), { opacity: 1, duration: 0.2, stagger: 0.004 }, 0.15)
        .to(nEl, { opacity: 1, y: 0, duration: 0.35, ease: "expo.out" }, 0.2)
        .to(
          dec,
          {
            k: 1,
            duration: 0.6,
            ease: "none",
            onUpdate: () => {
              const rev = Math.floor(dec.k * final.length);
              nameEl.textContent = [...final].map((c, i) => (i < rev || c === " " ? c : GL[(Math.random() * GL.length) | 0])).join("");
            },
            onComplete: () => void (nameEl.textContent = final),
          },
          0.28
        )
        .to(blackEl, { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, 0.55)
        .to(q(".intro-ascii"), { opacity: 0.12, duration: 0.4 }, 0.85);
      await hold(1150);
      tl.progress(1).kill();
      nameEl.textContent = final;
    }
    // a rota nova já está montada por baixo (espera no máximo 400 ms além da intro)
    await until(() => path.current === target, 400);
    navigating.current = false;
    introCover.on = false;
    await new Promise<void>((r) =>
      plain || skipped
        ? gsap.to(el, { opacity: 0, duration: skipped ? 0.12 : 0.2, ease: "power1.out", onComplete: r })
        : gsap.to(el, { clipPath: "inset(0% 0% 100% 0%)", duration: 0.28, ease: "expo.inOut", onComplete: r })
    );
    el.classList.remove("is-short", "is-tab");
    mark(kind, tStart, skipped);
    finish(true);
  }

  // API para o Menu
  useEffect(() => {
    api = {
      go: (href, label) => {
        const target = norm(href);
        if (target === path.current) return void ui.set({ menu: false });
        // etapa 6: Menu/links levam à Home pela transição curta; a intro completa fica para F5/carga direta
        void short(href, label);
      },
    };
    return () => void (api = null);
  });

  // links internos (fora do Menu): mesma transição. Captura antes do React/Next Link; respeita modificadores,
  // nova aba, downloads, âncoras da mesma página, arquivos e trocas dentro da mesma seção (ex.: Works ↔ Full/painel).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download") || a.closest("#site-menu, [data-no-genie]")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || /\.[a-z0-9]{2,5}$/i.test(url.pathname) || url.pathname.startsWith("/docs/")) return;
      const to = norm(url.pathname);
      const from = path.current;
      if (to === from) return;
      const sec = (p: string) => p.split("/")[1] ?? "";
      if (sec(to) === sec(from) && to !== "/") return;
      e.preventDefault();
      e.stopPropagation();
      intro.go(url.pathname + url.search, LABEL[sec(to)] ?? "Lucas Melo");
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, []);

  // carga completa / F5 em qualquer rota
  useEffect(() => {
    void full();
    const onKey = (e: KeyboardEvent) => {
      if (!ref.current?.classList.contains("is-on")) return;
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        running.current?.skip();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const onResize = () => {
      if (ref.current?.classList.contains("is-on")) fillAscii();
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // voltar à Home (link, HUD, botão voltar): intro completa, sem pintar a Home antes
  useLayoutEffect(() => {
    const now = norm(pathname);
    path.current = now;
    const before = prevPath.current;
    prevPath.current = now;
    if (before !== null && before !== now && now === "/" && !navigating.current) void full();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2;
    const r1 = i % 5 === 0 ? 47 : 45;
    // coordenadas arredondadas: servidor e cliente geram exatamente a mesma string (sem aviso de hidratação)
    const f = (n: number) => n.toFixed(3);
    return <line key={i} x1={f(Math.cos(a) * 43)} y1={f(Math.sin(a) * 43)} x2={f(Math.cos(a) * r1)} y2={f(Math.sin(a) * r1)} />;
  });

  return (
    <div ref={ref} id="intro" className="intro" role="dialog" aria-modal="true" aria-label="Intro" onClick={() => running.current?.skip()}>
      <canvas className="intro-ascii base" aria-hidden="true" />
      <canvas className="intro-ascii hot" aria-hidden="true" />
      <i className="intro-scan" aria-hidden="true" />
      <div className="intro-dashes" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <svg className="intro-dial" viewBox="-60 -60 120 120" aria-hidden="true">
        <g className="intro-ticks">{ticks}</g>
        <circle r="40" className="intro-ring" />
        <g className="intro-flare">
          <circle cx="40" cy="0" r="2.4" />
          <circle cx="40" cy="0" r="7" className="glow" />
        </g>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="intro-emblem" src="/brand/avatar-emblem.webp" alt="" width={1024} height={1024} fetchPriority="high" />
      <p className="intro-word" aria-hidden="true">
        <span className="mask">
          <span className="in grot">Lucas</span>
        </span>
        <span className="mask">
          <span className="in black intro-verb">Builds</span>
        </span>
        <span className="mask">
          <span className="in grot">Melo</span>
        </span>
      </p>
      <p className="intro-dest" aria-hidden="true" />
      <p className="intro-tab" aria-hidden="true">
        <span className="intro-tab-n" />
        <span className="intro-tab-name grot" />
        <span className="intro-tab-black black" />
      </p>
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
      <button
        type="button"
        className="intro-skip"
        onClick={(e) => {
          e.stopPropagation();
          running.current?.skip();
        }}
      >
        Skip intro <span aria-hidden="true">(Esc)</span>
      </button>
    </div>
  );
}
