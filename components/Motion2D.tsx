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
import { ui } from "@/lib/store";

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
        if (document.hidden || covered()) return;
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
      if (document.hidden || covered()) return;
      x += (tx - x) * Math.min(1, dt * 3);
      y += (ty - y) * Math.min(1, dt * 3);
      drag += (Math.max(-160, Math.min(160, dx)) - drag) * Math.min(1, dt * 4);
      dx *= Math.pow(0.2, dt);
      const px = -x * 28 + Math.sin(t * 0.15) * 14 + drag * 0.3;
      const py = -y * 18 + Math.cos(t * 0.12) * 8;
      img.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0) scale(1.12)`;
      // 26/11: sem o brilho pulsante (filter a cada quadro = repintar a foto inteira na CPU)
    })
  );
  return () => offs.forEach((o) => o());
}

/** 26/11: menu/reel/perfil opacos cobrindo a página — sem desenhar por baixo (sem GPU cada quadro é caro) */
const covered = () => {
  const s = ui.get();
  return !!(s.menu || s.reel || s.profile);
};

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
      // 26/11: o Lab sem WebGL agora é do próprio Lab (lib/lab2d: as 4 relíquias)
    }, 120);
    return () => {
      clearTimeout(id);
      off();
    };
  }, [path]);
  return null;
}
