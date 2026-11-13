// v6 — somente inglês (decisão de Lucas 11/11). Dados de summoner-study/app/lib/projects.ts, sem fatos novos.
// Jorak: URL correta https://jorakstudio.vercel.app/ (decisão 11/11); nome exibido "Jorak" até Lucas confirmar "Jorak Studio".
import manifest from "./media-manifest.json";

export type Shot = { id: string; w: number; h: number; widths: number[] };
export type Project = {
  n: string;
  slug: string;
  name: string;
  client: string;
  year: string;
  url: string;
  stack: string[];
  tags: ("web" | "motion" | "3d")[];
  kind: string;
  built: string;
  shots: Shot[];
  /** versão 1440p para telas grandes (opcional) */
  hq?: string;
};

const M = manifest as Record<string, Shot[]>;
const P = (p: Omit<Project, "shots">): Project => ({ ...p, shots: M[p.slug] ?? [] });

export const PROJECTS: Project[] = [
  P({
    n: "001", slug: "orinoco", name: "Orinoco", client: "Petroquímica Orinoco S/A", year: "2026",
    url: "https://orinoco-ind.vercel.app/", stack: ["HTML", "CSS", "JS", "GLSL", "Node"], tags: ["3d"],
    kind: "Industrial corporate site · Cascavel, BR",
    built: "Numbered intro, hero and brand catalogue — development and direction, with custom GLSL.",
  }),
  P({
    n: "002", slug: "ado", name: "ADO Lavanderias", client: "ADO Limpeza", year: "2026",
    url: "https://ado-limpeza.vercel.app/", stack: ["Next.js", "React", "TS", "GSAP", "Lenis", "R3F"], tags: ["web", "motion", "3d"],
    kind: "Cleaning products and laundries",
    built: "Preloader, manifesto, product range and a laundry scene with WebGL water.",
  }),
  P({
    n: "003", slug: "rio-uruguay", name: "Rio Uruguay", client: "Rio Uruguay Logística", year: "2026",
    url: "https://rio-uruguay.vercel.app/", stack: ["React", "TS", "Vite"], tags: ["web"],
    kind: "Freight across southern Brazil and Mercosur",
    built: "Interactive coverage map with zoom and drag, in PT, ES and EN.",
  }),
  P({
    n: "004", slug: "ikari", name: "Ikari Studio", client: "Ikari — 2D animator", year: "2026",
    url: "https://www.ikari-studio.me/", stack: ["Front-end", "GSAP"], tags: ["web", "motion"],
    kind: "2D animation portfolio",
    built: "Front-end with a REC / 24 FPS opening, hero and commission tiers.",
  }),
  P({
    n: "005", slug: "jorak", name: "Jorak", client: "Jorak — MMV & motion editor", year: "2026",
    url: "https://jorakstudio.vercel.app/", hq: "/media/projects/jorak/desktop-1440.mp4", stack: ["Next.js", "React", "TS", "GSAP", "Three.js"], tags: ["web", "motion", "3d"],
    kind: "Editing and motion design portfolio",
    built: "Intro and a record collection that reveals the edits.",
  }),
  P({
    n: "006", slug: "ohm", name: "Ohm Engenharia", client: "OHM Engenharia", year: "2026",
    url: "https://ohm-engenharia.netlify.app/", stack: ["Astro", "TS", "GSAP", "Lenis", "Three.js"], tags: ["motion", "3d"],
    kind: "Electrical engineering and electronic security",
    built: "Interactive model of the Energy and Protection systems.",
  }),
  P({
    n: "007", slug: "infernai", name: "InfernAI", client: "InfernAI — Guarulhos, BR", year: "2026",
    url: "https://infernai.com.br/", stack: ["HTML", "CSS", "JavaScript", "Canvas 2D"], tags: ["web"],
    kind: "Sites, AI scheduling and automations for small businesses · Guarulhos, BR",
    built: "Co-built with a second developer: static landing with a Canvas 2D particle hero, services, the FadeUp scheduling chat demo, pricing and FAQ.",
  }),
  P({
    n: "008", slug: "mavell", name: "Mavell Studio", client: "Mavell Studio — independent website studio", year: "2026",
    url: "https://mavell-studio.netlify.app/", stack: ["Next.js", "GSAP", "ScrollTrigger", "Lenis", "Tailwind"], tags: ["web", "motion"],
    kind: "Website studio for local businesses and brands",
    built: "The studio's own site: hero, statement, a pinned horizontal showcase, services and a CSS 3D brand card you can drag and flip.",
  }),
];

export const TOTAL = PROJECTS.length;
export const TAG_LABEL = { web: "Web", motion: "GSAP", "3d": "3D" } as const;
export const bySlug = (slug: string | null | undefined) => PROJECTS.find((p) => p.slug === slug);
export const indexOf = (slug: string) => PROJECTS.findIndex((p) => p.slug === slug);
export const nextOf = (p: Project) => PROJECTS[(PROJECTS.indexOf(p) + 1) % TOTAL];

export const media = (p: Project) => `/media/projects/${p.slug}`;
export const videoSrc = (p: Project): { src: string; type: string; media?: string }[] => [
  ...(p.hq ? [{ src: p.hq, type: "video/mp4", media: "(min-width: 2200px)" }] : []),
  { src: `${media(p)}/desktop.webm`, type: "video/webm" },
  { src: `${media(p)}/desktop.mp4`, type: "video/mp4" },
];
export const shotUrl = (p: Project, id: string, w: number, ext: "avif" | "webp" = "webp") => `/media/4k/${p.slug}/${id}-${w}.${ext}`;
export const srcSet = (p: Project, s: Shot, ext: "avif" | "webp") => s.widths.map((w) => `${shotUrl(p, s.id, w, ext)} ${w}w`).join(", ");
/** textura do card (WebGL): 1280 px basta para ~666 px de tela em DPR 2 */
export const cardTexture = (p: Project) => shotUrl(p, p.shots[0]?.id ?? "s00", 1280);

/** nome gigante do painel: 2+ palavras → última em blackletter; 1 palavra → inteira em blackletter (PROMPT-MESTRE §7.4 A) */
export function splitName(name: string): { grot: string; black: string } {
  const parts = name.split(" ");
  if (parts.length < 2) return { grot: "", black: name };
  return { grot: parts.slice(0, -1).join(" "), black: parts[parts.length - 1] };
}
