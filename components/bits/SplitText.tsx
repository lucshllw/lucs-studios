"use client";
// Adaptado de React Bits · SplitText (TS-CSS, MIT + Commons Clause, https://reactbits.dev).
// Mudanças: sem GSAP SplitText/ScrollTrigger; o progresso vem de --in (useInProgress, scrub reversível no ticker);
// cada letra sobe e decodifica de um glifo ASCII. Texto real no aria-label; spans aria-hidden. Reduced-motion = final.
import { createElement, type CSSProperties } from "react";

type Tag = "h1" | "h2" | "h3" | "p" | "span";
export function SplitText({ text, tag = "h2", className = "", style }: { text: string; tag?: Tag; className?: string; style?: CSSProperties }) {
  const words = text.split(" ");
  let i = 0;
  const n = text.replace(/\s/g, "").length;
  const children = words.map((w, wi) => (
    <span className="st-w" key={wi}>
      {[...w].map((ch) => {
        const k = i++;
        return (
          <span className="st-c" key={k} style={{ "--i": k / Math.max(1, n - 1) } as CSSProperties} data-ch={ch}>
            {ch}
          </span>
        );
      })}
      {wi < words.length - 1 ? " " : null}
    </span>
  ));
  return createElement(
    tag,
    { className: `split-text ${className}`, style, "aria-label": text },
    <span aria-hidden="true">{children}</span>
  );
}
