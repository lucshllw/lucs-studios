// Dicionário do site (v5, 24/10/2026): o site é só em inglês por pedido de Lucas. O PT-BR existe apenas no
// currículo (lib/curriculo.ts, alternância EN/PT-BR só em /curriculo). Copy autoral a validar por Lucas.

type DeepString<T> = T extends string
  ? string
  : T extends boolean
    ? boolean
    : T extends readonly (infer U)[]
      ? readonly DeepString<U>[]
      : { [K in keyof T]: DeepString<T[K]> };

export const EN = {
  meta: {
    home: {
      title: "Lucas Melo — Creative Developer",
      description:
        "Portfolio of Lucas Melo, a creative developer who builds end-to-end: data, APIs, interfaces and motion. {count} live projects.",
    },
    works: { title: "Works — Lucas Melo", description: "{count} live projects by Lucas Melo: web apps, GSAP motion and interactive 3D." },
    about: {
      title: "About — Lucas Melo",
      description: "Lucas Melo: end-to-end creative developer. Stack, education and clients.",
    },
    cv: { title: "Résumé — Lucas Melo" },
  },
  a11y: { skip: "Skip to content", newTab: "(new tab)", pauseVideo: "Pause video", playVideo: "Play video" },
  header: {
    brand: "LUCAS MELO — CREATIVE DEV",
    brandShort: "LUCAS MELO",
    status: "Available 2026",
    langGroup: "Language",
    langEn: "English",
    langPt: "Portuguese (Brazil)",
    menu: "MENU",
    close: "CLOSE",
    noJsWorks: "WORKS",
    noJsAbout: "ABOUT",
  },
  menu: {
    label: "( MENU )",
    dialog: "Site menu",
    items: { home: "Home", works: "Works", about: "About", cv: "Résumé" },
    contact: "Contact",
    status: "Available 2026",
  },
  transition: { routes: { home: "HOME", works: "WORKS", about: "ABOUT", cv: "RÉSUMÉ" }, loaded: "{route} page loaded" },
  home: {
    hero: {
      eyebrow: "( PORTFOLIO — 2026 )",
      h1: "Lucas Melo — creative developer",
      wordGrot: "CREATIVE",
      wordBlack: "Developer",
      intro:
        "I build the whole system: data, APIs, interfaces and the motion on top. {count} projects are live below — scroll to open the reel.",
      scroll: "SCROLL ↓",
      emblemAlt:
        "Lucas Melo's avatar: black-and-white drawing of a young man with spiky hair and a fur-collared coat, inside a black disc with a white ring",
    },
    prefooter: "Lucas Melo builds, automates, animates, integrates and delivers",
    portal: {
      w1: "SHOW",
      w2: "REEL",
      label: "SHOWREEL '26",
      play: "[ PLAY REEL ]",
      meta: "0:24 · {count} live sites · sound",
      disc: "Play showreel",
      expand: "Expand reel (F)",
      soundOn: "Turn sound on",
      soundOff: "Turn sound off",
      sites: "{count} LIVE SITES",
      spec: "LUCAS MELO · 1920×1080 · {dur}",
      track: "Reel timeline",
      seek: "Jump to {t}",
      videoTitle:
        "Showreel 2026: cuts from the live sites Orinoco, ADO Lavanderias, Rio Uruguay, Ikari, Jorak, OHM, InfernAI and Mavell",
    },
    films: {
      label: "( SELECTED WORKS )",
      count: "{n} / {total}",
      hint: "SCROLL →",
      visit: "Visit site ↗",
      visitAria: "{name}: visit live site (new tab)",
      cta: "[ EXPLORE ALL WORKS → ]",
    },
    manifesto: {
      label: "( MANIFESTO )",
      lines: [
        { text: "EVERY", black: false, ember: false },
        { text: "Complex", black: true, ember: false },
        { text: "IDEA FITS INTO", black: false, ember: false },
        { text: "USEFUL CODE.", black: false, ember: false },
        { text: "I BUILD", black: false, ember: false },
        { text: "THE SYSTEM.", black: false, ember: true },
      ],
    },
  },
  footer: {
    label: "( WHERE TO FIND ME )",
    titleGrot: "BRING THE",
    titleBlack: "Problem",
    line: "Thirty minutes of conversation. No deck, no rush.",
    email: {
      copy: "Click to copy",
      copied: "Copied!",
      fail: "Select and copy",
      send: "Send email ↗",
      liveOk: "Email copied to the clipboard",
      liveFail: "Could not copy; the email was selected",
    },
    ctas: { works: "[ ALL WORKS → ]", about: "[ ABOUT → ]", cv: "[ RÉSUMÉ ]" },
    channels: "Channels",
    github: "Lucas Melo on GitHub (new tab)",
    linkedin: "Lucas Melo on LinkedIn (new tab)",
    mail: "Email",
    legal: { copy: "© 2026 Lucas Melo", built: "Built with Next.js, GSAP, Lenis and OGL", top: "Back to top ↑" },
  },
  works: {
    h1: "Works",
    hint: "SCROLL DOWN · DRAG TO SHIFT",
    hintTouch: "DRAG TO SHIFT · TAP TO OPEN",
    index: "Project index",
    open: "Open live site ↗",
    announce: "{name}, {year}, {tags}",
    filters: { label: "Filter projects", all: "ALL", web: "WEB APPS", motion: "MOTION / GSAP", "3d": "3D / INTERACTIVE" },
    view: { label: "View", grid: "GRID", list: "LIST" },
    cols: { n: "No.", project: "Project", client: "Client", year: "Year", stack: "Stack" },
    counter: "{i} / {total}",
  },
  about: {
    label: "( ABOUT )",
    first: "Lucas",
    last: "Melo",
    caption: "CREATIVE DEVELOPER · FULL-STACK",
    photoAlt: "Lucas Melo in a white shirt, at night",
    e2e: {
      label: "( END TO END )",
      text: "I work the whole stack on purpose. The table in Supabase, the route in Node, the component in React and the timeline in GSAP are one decision, not four handoffs. When something breaks, I know which layer to open.",
      layers: [
        { n: "01", name: "DATA", items: "Supabase · PostgreSQL" },
        { n: "02", name: "SERVER", items: "Node.js · APIs" },
        { n: "03", name: "INTERFACE", items: "React · SvelteKit · TypeScript" },
        { n: "04", name: "MOTION", items: "GSAP · Three.js / WebGL" },
      ],
    },
    edu: {
      label: "( EDUCATION )",
      caption: "Education and core stack",
      cols: { area: "Area", inst: "Institution", course: "Course", status: "Status" },
      areas: { academic: "ACADEMIC", hardware: "HARDWARE & ROOT", stack: "CORE STACK" },
      quote: "I like to understand the {circuit} before touching the interface.",
      quoteWord: "circuit",
    },
    clients: { label: "( CLIENTS )", title: "Who I built for", live: "Live site ↗", inWorks: "See in works →", built: "What I built", prev: "Previous client", next: "Next client" },
    cta: { resume: "[ VIEW RESUME ]", pdf: "[ DOWNLOAD PDF ]" },
  },
  player: {
    dialog: "Player",
    close: "Close player (Esc)",
    play: "Play (K)",
    pause: "Pause (K)",
    progress: "Reel progress",
    volume: "Volume",
    fullscreen: "Fullscreen (F)",
    noAudio: "Reel has no audio",
    checking: "Checking audio",
    unmute: "Unmute (M)",
    mute: "Mute (M)",
    of: "of",
    cursorPlay: "PLAY",
    cursorPause: "PAUSE",
    cursorClose: "CLOSE",
  },
} as const;

export type Dict = DeepString<typeof EN>;

export type Lang = "en" | "pt";
export const HTML_LANG: Record<Lang, string> = { en: "en", pt: "pt-BR" };

/** Interpola {chave} */
export const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));

export type RouteKey = "home" | "works" | "about" | "cv";
export const routeKey = (pathname: string): RouteKey => {
  const p = pathname.replace(/\/$/, "").replace(/\.html$/, "") || "/";
  if (p.startsWith("/works")) return "works";
  if (p.startsWith("/about")) return "about";
  if (p.startsWith("/curriculo")) return "cv";
  return "home";
};
