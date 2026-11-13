"use client";
// Loop único (PROMPT-MESTRE §2.2): gsap.ticker é o único rAF do app. Lenis, World e painel assinam aqui.
import { gsap } from "gsap";

type Tick = (time: number, dt: number) => void;
const subs = new Set<Tick>();
let started = false;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 0.1);
    subs.forEach((f) => f(time, dt));
  });
}

export function addTick(fn: Tick) {
  start();
  subs.add(fn);
  return () => void subs.delete(fn);
}
