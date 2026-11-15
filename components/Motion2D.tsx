"use client";
// 15/11 — modo 2D (html.m2d: sem WebGL, ex.: aceleração de hardware desligada no navegador, e sem reduced-motion).
// Dá movimento às páginas que, sem GPU, caíam em layout parado: About (revelação da foto como cópia revelando +
// paralaxe + estações), Studio (foto real com paralaxe de câmera e deriva lenta) e Lab (orbe de partículas em
// Canvas 2D que segue o ponteiro). Home e Works têm o próprio modo 2D (Hero2D / WorksApp).
// Um único loop (addTick → gsap.ticker); tudo pausa com a aba oculta ou elemento fora da tela.
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { addTick } from "@/lib/loop";

type Off = () => void;

function about(root: HTMLElement): Off {
  const photo = root.querySelector<HTMLElement>(".dark-fallback");
  const stations = Array.from(root.querySelectorAll<HTMLElement>(".stations li"));
  const offs: Off[] = [];
  if (photo) {
    photo.classList.add("m2-print");
    gsap.fromTo(
      photo,
      { clipPath: "inset(100% 0% 0% 0%)", filter: "grayscale(1) brightness(2.2) blur(6px)" },
      { clipPath: "inset(0% 0% 0% 0%)", filter: "grayscale(0) brightness(1) blur(0px)", duration: 2.2, ease: "expo.out", delay: 0.2 }
    );
    let tx = 0, ty = 0, x = 0, y = 0;
    const mv = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      tx = (e.clientX / innerWidth - 0.5) * 2;
      ty = (e.clientY / innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", mv, { passive: true });
    offs.push(() => window.removeEventListener("pointermove", mv));
    offs.push(
      addTick((t, dt) => {
        if (document.hidden) return;
        const r = photo.getBoundingClientRect();
        if (r.bottom < 0 || r.top > innerHeight) return;
        x += (tx - x) * Math.min(1, dt * 4);
        y += (ty - y) * Math.min(1, dt * 4);
        const off = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
        photo.style.transform = `perspective(1000px) rotateY(${(x * 4).toFixed(2)}deg) rotateX(${(-y * 3).toFixed(2)}deg) translate3d(0, ${(off * -30).toFixed(1)}px, 0) scale(${(1.02 + Math.sin(t * 0.4) * 0.01).toFixed(4)})`;
      })
    );
  }
  if (stations.length) {
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (!e.isIntersecting) return;
          io.unobserve(e.target);
          gsap.fromTo(e.target, { opacity: 0, x: -40, clipPath: "inset(0% 100% 0% 0%)" }, { opacity: 1, x: 0, clipPath: "inset(0% 0% 0% 0%)", duration: 0.9, ease: "expo.out", clearProps: "clipPath,transform" });
        }),
      { threshold: 0.2 }
    );
    stations.forEach((s) => {
      gsap.set(s, { opacity: 0 });
      io.observe(s);
    });
    offs.push(() => io.disconnect());
  }
  return () => offs.forEach((o) => o());
}

function studio(root: HTMLElement): Off {
  const img = root.querySelector<HTMLElement>(".st-fallback");
  const chips = Array.from(root.querySelectorAll<HTMLElement>(".st-chip"));
  const offs: Off[] = [];
  if (chips.length) gsap.fromTo(chips, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, ease: "expo.out", stagger: 0.05, delay: 0.3, clearProps: "transform" });
  if (!img) return () => {};
  img.classList.add("m2-desk");
  gsap.fromTo(img, { opacity: 0, scale: 1.25 }, { opacity: 0.62, scale: 1.12, duration: 2, ease: "expo.out" });
  let tx = 0, ty = 0, x = 0, y = 0, drag = 0, dx = 0;
  const mv = (e: PointerEvent) => {
    tx = (e.clientX / innerWidth - 0.5) * 2;
    ty = (e.clientY / innerHeight - 0.5) * 2;
    if (e.buttons === 1) dx += e.movementX;
  };
  window.addEventListener("pointermove", mv, { passive: true });
  offs.push(() => window.removeEventListener("pointermove", mv));
  offs.push(
    addTick((t, dt) => {
      if (document.hidden) return;
      x += (tx - x) * Math.min(1, dt * 3);
      y += (ty - y) * Math.min(1, dt * 3);
      drag += (Math.max(-160, Math.min(160, dx)) - drag) * Math.min(1, dt * 4);
      dx *= Math.pow(0.2, dt);
      const px = -x * 28 + Math.sin(t * 0.15) * 14 + drag * 0.3;
      const py = -y * 18 + Math.cos(t * 0.12) * 8;
      img.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) scale(1.12)`;
      img.style.filter = `brightness(${(1 + Math.sin(t * 2.3) * 0.03 + Math.sin(t * 7.1) * 0.015).toFixed(3)})`;
    })
  );
  return () => offs.forEach((o) => o());
}

function lab(root: HTMLElement): Off {
  if (!root.classList.contains("lab-nogl")) return () => {};
  const c = document.createElement("canvas");
  c.className = "m2-lab";
  c.setAttribute("aria-hidden", "true");
  root.prepend(c);
  const g = c.getContext("2d")!;
  let w = 0, h = 0;
  const N = innerWidth < 768 ? 420 : 900;
  // pontos numa esfera (Fibonacci), girando; o ponteiro puxa o orbe (como a relíquia Orb em WebGL)
  const P = Array.from({ length: N }, (_, i) => {
    const yy = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - yy * yy);
    const th = i * 2.399963;
    return { x: Math.cos(th) * r, y: yy, z: Math.sin(th) * r, n: Math.random() };
  });
  const size = () => {
    w = c.width = innerWidth;
    h = c.height = innerHeight;
  };
  size();
  window.addEventListener("resize", size);
  const ptr = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, down: 0 };
  const mv = (e: PointerEvent) => {
    ptr.tx = e.clientX / innerWidth;
    ptr.ty = e.clientY / innerHeight;
  };
  const dn = () => (ptr.down = 1);
  window.addEventListener("pointermove", mv, { passive: true });
  window.addEventListener("pointerdown", dn);
  let acc = 0;
  const untick = addTick((t, dt) => {
    if (document.hidden) return;
    ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt * 3);
    ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt * 3);
    ptr.down = Math.max(0, ptr.down - dt * 1.5);
    acc += dt;
    if (acc < 1 / 30) return;
    acc = 0;
    g.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * (0.24 + ptr.down * 0.05);
    const cx = w / 2 + (ptr.x - 0.5) * w * 0.18;
    const cy = h * 0.46 + (ptr.y - 0.5) * h * 0.14;
    const ay = t * 0.25 + (ptr.x - 0.5) * 1.2;
    const ax = (ptr.y - 0.5) * 0.8;
    const ca = Math.cos(ay), sa = Math.sin(ay), cb = Math.cos(ax), sb = Math.sin(ax);
    for (const p of P) {
      const noise = 1 + Math.sin(t * 1.6 + p.n * 12 + p.y * 4) * 0.08 + ptr.down * 0.25 * Math.sin(p.n * 40);
      let x = p.x * ca - p.z * sa;
      let z = p.x * sa + p.z * ca;
      const y = p.y * cb - z * sb;
      z = p.y * sb + z * cb;
      x *= noise;
      const k = 1.6 / (2.6 - z);
      const sx = cx + x * R * k;
      const sy = cy + y * R * noise * k;
      const a = 0.25 + (z + 1) * 0.35;
      g.fillStyle = z > 0.55 && p.n < 0.3 ? `rgba(255,42,42,${a})` : `rgba(235,235,235,${a})`;
      const s = 1 + (z + 1) * 0.8;
      g.fillRect(sx, sy, s, s);
    }
  });
  return () => {
    untick();
    window.removeEventListener("resize", size);
    window.removeEventListener("pointermove", mv);
    window.removeEventListener("pointerdown", dn);
    c.remove();
  };
}

export function Motion2D() {
  const path = usePathname();
  useEffect(() => {
    const html = document.documentElement;
    if (!html.classList.contains("m2d")) return;
    let off: Off = () => {};
    // espera a página montar (e o Lab decidir que não há WebGL)
    const id = window.setTimeout(() => {
      const main = document.querySelector<HTMLElement>("main#main");
      if (!main) return;
      if (main.classList.contains("about")) off = about(main);
      else if (main.classList.contains("studio")) off = studio(main);
      else if (main.classList.contains("lab")) off = lab(main);
    }, 120);
    return () => {
      clearTimeout(id);
      off();
    };
  }, [path]);
  return null;
}
