// Projetos v4 (parecer v4 §6.1 e §11). Classificação pela stack declarada (lib/content.ts v3), sem inventar:
// 3d = GLSL/R3F/Three.js · motion = GSAP · web = app em framework de componentes / front-end com estado de UI.
// Ikari: o CV de Lucas descreve a entrega com GSAP (decisão de Asta, 23/10) → também em motion.
// Anos 2026 = inferidos (README, Procedência).
import type { Lang } from "./i18n/dict";

export type Tag = "web" | "motion" | "3d";
export type L10n = Record<Lang, string>;
export type Project = {
  n: string;
  slug: string;
  name: string;
  client: L10n;
  year: string;
  url: string;
  stack: string[];
  tags: Tag[];
  kind: L10n;
  built: L10n;
  base: string;
};

const P = (p: Omit<Project, "base">): Project => ({ ...p, base: `/media/projects/${p.slug}` });

export const PROJECTS: Project[] = [
  P({
    n: "001",
    slug: "orinoco",
    name: "Orinoco",
    client: { en: "Petroquímica Orinoco S/A", pt: "Petroquímica Orinoco S/A" },
    year: "2026",
    url: "https://orinoco-ind.vercel.app/",
    stack: ["HTML", "CSS", "JS", "GLSL", "Node"],
    tags: ["3d"],
    kind: { en: "Industrial corporate site · Cascavel, BR", pt: "Institucional industrial · Cascavel/PR" },
    built: {
      en: "Numbered intro, hero and brand catalogue — development and direction, with custom GLSL.",
      pt: "Intro numerada, hero e catálogo de marcas — desenvolvimento e direção, com GLSL próprio.",
    },
  }),
  P({
    n: "002",
    slug: "ado",
    name: "ADO Lavanderias",
    client: { en: "ADO Limpeza", pt: "ADO Limpeza" },
    year: "2026",
    url: "https://ado-limpeza.vercel.app/",
    stack: ["Next.js", "React", "TS", "GSAP", "Lenis", "R3F"],
    tags: ["web", "motion", "3d"],
    kind: { en: "Cleaning products and laundries", pt: "Produtos de limpeza e lavanderias" },
    built: {
      en: "Preloader, manifesto, product range and a laundry scene with WebGL water.",
      pt: "Preloader, manifesto, linha de produtos e lavanderia com água em WebGL.",
    },
  }),
  P({
    n: "003",
    slug: "rio-uruguay",
    name: "Rio Uruguay",
    client: { en: "Rio Uruguay Logística", pt: "Rio Uruguay Logística" },
    year: "2026",
    url: "https://rio-uruguay.vercel.app/",
    stack: ["React", "TS", "Vite"],
    tags: ["web"],
    kind: { en: "Freight across southern Brazil and Mercosur", pt: "Transporte no Sul e no Mercosul" },
    built: {
      en: "Interactive coverage map with zoom and drag, in PT, ES and EN.",
      pt: "Mapa de cobertura interativo com zoom e arraste, em PT, ES e EN.",
    },
  }),
  P({
    n: "004",
    slug: "ikari",
    name: "Ikari Studio",
    client: { en: "Ikari — 2D animator", pt: "Ikari — animadora 2D" },
    year: "2026",
    url: "https://www.ikari-studio.me/",
    stack: ["Front-end", "GSAP"],
    tags: ["web", "motion"],
    kind: { en: "2D animation portfolio", pt: "Portfólio de animação 2D" },
    built: {
      en: "Front-end with a REC / 24 FPS opening, hero and commission tiers.",
      pt: "Front-end com abertura REC / 24 FPS, hero e faixas de comissão.",
    },
  }),
  P({
    n: "005",
    slug: "jorak",
    name: "Jorak Editor",
    client: { en: "Jorak — MMV & motion editor", pt: "Jorak — editor MMV e motion" },
    year: "2026",
    url: "https://jorakeditor.netlify.app/",
    stack: ["Next.js", "React", "TS", "GSAP", "Three.js"],
    tags: ["web", "motion", "3d"],
    kind: { en: "Editing and motion design portfolio", pt: "Portfólio de edição e motion design" },
    built: { en: "Intro and a record collection that reveals the edits.", pt: "Intro e coleção de discos que revela os trabalhos." },
  }),
  P({
    n: "006",
    slug: "ohm",
    name: "Ohm Engenharia",
    client: { en: "OHM Engenharia", pt: "OHM Engenharia" },
    year: "2026",
    url: "https://ohm-engenharia.netlify.app/",
    stack: ["Astro", "TS", "GSAP", "Lenis", "Three.js"],
    tags: ["motion", "3d"],
    kind: { en: "Electrical engineering and electronic security", pt: "Engenharia elétrica e segurança eletrônica" },
    built: {
      en: "Interactive model of the Energy and Protection systems.",
      pt: "Maquete interativa com os sistemas Energia e Proteção.",
    },
  }),
  // v4b (dossiê Flash v4b, 24/10): fatos observados nos sites; tags por decisão de Asta; ano 2026 inferido (rodapé).
  P({
    n: "007",
    slug: "infernai",
    name: "InfernAI",
    client: { en: "InfernAI — Guarulhos, BR", pt: "InfernAI — Guarulhos/SP" },
    year: "2026",
    url: "https://infernai.com.br/",
    stack: ["HTML", "CSS", "JavaScript", "Canvas 2D"],
    tags: ["web"],
    kind: {
      en: "Sites, AI scheduling and automations for small businesses · Guarulhos, BR",
      pt: "Sites, agendamento com IA e automações para pequenos negócios · Guarulhos/SP",
    },
    built: {
      en: "Co-built with a second developer: static landing with a Canvas 2D particle hero, services, the FadeUp scheduling chat demo, pricing and FAQ.",
      pt: "Feito em dupla com outro dev: landing estática com hero de partículas em Canvas 2D, serviços, demo de chat do agendamento FadeUp, preços e FAQ.",
    },
  }),
  P({
    n: "008",
    slug: "mavell",
    name: "Mavell Studio",
    client: { en: "Mavell Studio — independent website studio", pt: "Mavell Studio — estúdio independente de sites" },
    year: "2026",
    url: "https://mavell-studio.netlify.app/",
    stack: ["Next.js", "GSAP", "ScrollTrigger", "Lenis", "Tailwind"],
    tags: ["web", "motion"],
    kind: { en: "Website studio for local businesses and brands", pt: "Estúdio de sites para negócios locais e marcas" },
    built: {
      en: "The studio's own site: hero, statement, a pinned horizontal showcase, services and a CSS 3D brand card you can drag and flip.",
      pt: "O site do próprio estúdio: hero, statement, vitrine horizontal pinada, serviços e cartão 3D da marca em CSS que gira e vira.",
    },
  }),
];

export type Filter = "all" | Tag;
export const FILTERS: Filter[] = ["all", "web", "motion", "3d"];
export const filterProjects = (f: Filter) => (f === "all" ? PROJECTS : PROJECTS.filter((p) => p.tags.includes(f)));
export const countFor = (f: Filter) => filterProjects(f).length;

/**
 * Quadros. v5 (itens 13/15): "shot" = captura real 16:10 do topo do site (scripts/capture-shots.mjs; 800/1600 px,
 * cor e P&B), usada no /about e em /works. Os quadros v4 do vídeo (poster/still…) seguem só no Filmstrip da home.
 * As versões mobile (tile "device", vídeos/pôsteres 390×844) foram removidas em 24/10/2026 (item 15).
 */
export const VARIANTS = ["shot"] as const;
export type Variant = "shot" | "poster" | "still" | "still-a" | "still-b";
export const frame = (p: Project, v: Variant, gray = false, w: 800 | 1200 | 1600 = 800) =>
  v === "shot" ? `${p.base}/v5/shot-${w}${gray ? "-gray" : ""}.webp` : `${p.base}/v4/${v}${gray ? "-gray" : ""}.webp`;
/** srcset 800w/1200w/1600w da captura (cor ou P&B); 1200 derivado do 1600 (v5.1, nitidez em DPR 3 no mobile) */
export const shotSet = (p: Project, gray = false) =>
  `${frame(p, "shot", gray, 800)} 800w, ${frame(p, "shot", gray, 1200)} 1200w, ${frame(p, "shot", gray, 1600)} 1600w`;
export const videoSrc = (p: Project) => [
  { src: `${p.base}/desktop.webm`, type: "video/webm" },
  { src: `${p.base}/desktop.mp4`, type: "video/mp4" },
];
export const TAG_LABEL: Record<Tag, string> = { web: "Web", motion: "GSAP", "3d": "3D" };

/** Contagem por extenso (início de frase) para a copy que cita o número de projetos — N projetos, não fixo. */
const WORDS: Record<Lang, string[]> = {
  en: ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"],
  pt: ["Zero", "Um", "Dois", "Três", "Quatro", "Cinco", "Seis", "Sete", "Oito", "Nove", "Dez", "Onze", "Doze"],
};
export const TOTAL = PROJECTS.length;
export const countWord = (lang: Lang, n = TOTAL) => WORDS[lang][n] ?? String(n);
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const pad3 = (n: number) => String(n).padStart(3, "0");
