"use client";
// Scrub palavra a palavra (parecer v4 §5.4): span por palavra (sem SplitText), opacidade .16 → 1 em sequência,
// scrub .5. O texto inteiro continua no elemento para leitor de tela. Reduced/sem JS: opacidade 1.
import { useRef, type ElementType, type ReactNode } from "react";
import { gsap, MOTION_OK, useIsoLayoutEffect } from "@/lib/gsap";

export type ScrubLine = { text: string; black?: boolean; ember?: boolean };

export function splitWords(text: string, cls = "") {
  return text.split(/(\s+)/).map((w, i) => (/^\s+$/.test(w) ? w : <span key={i} className={`w ${cls}`}>{w}</span>));
}

export default function WordScrub({
  as: Tag = "h2",
  lines,
  className,
  id,
  start = ["top 80%", "top 85%"],
  end = ["bottom 45%", "bottom 55%"],
  render,
}: {
  as?: ElementType;
  lines: ScrubLine[];
  className?: string;
  id?: string;
  /** [desktop, mobile] */
  start?: [string, string];
  end?: [string, string];
  render?: (l: ScrubLine, i: number) => ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const sig = lines.map((l) => l.text).join("|");
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    const build = (s: string, e: string) => () => {
      const words = el.querySelectorAll<HTMLElement>(".w");
      gsap
        .timeline({ scrollTrigger: { trigger: el, start: s, end: e, scrub: 0.5 } })
        .fromTo(words, { opacity: 0.16 }, { opacity: 1, ease: "none", stagger: 1, duration: 1 });
    };
    mm.add(`${MOTION_OK} and (min-width: 768px)`, build(start[0], end[0]));
    mm.add(`${MOTION_OK} and (max-width: 767px)`, build(start[1], end[1]));
    return () => mm.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return (
    <Tag ref={ref} className={className} id={id}>
      {lines.map((l, i) =>
        render ? (
          render(l, i)
        ) : (
          <span key={i} className={`ws__line ${l.black ? "black" : ""} ${l.ember ? "ws__ember" : ""}`}>
            {splitWords(l.text)}
          </span>
        ),
      )}
    </Tag>
  );
}
