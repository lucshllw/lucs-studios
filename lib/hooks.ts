"use client";
import { useEffect, useState, type RefObject } from "react";

/** true quando o elemento está na viewport E a aba está visível. */
export function useActive<T extends Element>(ref: RefObject<T | null>, rootMargin = "0px", threshold = 0) {
  const [inView, setInView] = useState(false);
  const [docVisible, setDocVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { rootMargin, threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, threshold]);
  useEffect(() => {
    const on = () => setDocVisible(document.visibilityState === "visible");
    on();
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
  return inView && docVisible;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

export function hasWebGL2() {
  try {
    const c = document.createElement("canvas");
    return !!c.getContext("webgl2");
  } catch {
    return false;
  }
}

/** Marco da intro (ms desde navigationStart) — 0 se a intro não roda. */
export function introRunning() {
  return typeof document !== "undefined" && document.documentElement.dataset.intro === "run";
}
