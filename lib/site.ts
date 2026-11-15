export const SITE = {
  name: "Lucas Melo",
  role: "Creative Developer · Full-Stack Developer",
  email: "lucas.melo10441816@gmail.com",
  github: "https://github.com/lucshllw",
  linkedin: "https://www.linkedin.com/in/lucashenriquemelobarbosa/",
  resume: "/docs/lucas-melo-resume.pdf",
  phone: "+55 15 98117-9084",
  tel: "tel:+5515981179084",
  whatsapp: "https://wa.me/5515981179084",
  /** aparece no reel; rede não confirmada → só texto, sem link */
  handle: "@vcenovra",
  tagline: "Creative developer — websites, motion, WebGL & automation",
  bio: "I'm Lucas Melo, a creative developer from Brazil who works the full stack on purpose — data, APIs, interfaces and the motion on top. I turn heavy art direction into fast, accessible websites with WebGL, GSAP and clean TypeScript.",
  mono: "WEB · GSAP · 3D · AUTOMATION",
  support: "Creative developer & full-stack — Brazil, working remote.",
};

/** Reel: 1080p no repositório; o master 4K (116 MB) fica fora do bundle. Defina NEXT_PUBLIC_REEL_4K_URL
 *  quando houver hospedagem externa aprovada (Vercel Blob, Mux…) — o player só oferece "4K" se existir. */
export const REEL = {
  src1080: "/reel/lucas-melo-reel-1080p.mp4",
  /** versão web do master 4K (3840×2160, H.264 CRF19 faststart, 57 MB) — servida do próprio site (etapa 6) */
  src4k: process.env.NEXT_PUBLIC_REEL_4K_URL || "/reel/lucas-melo-reel-4k-web.mp4",
  preview: "/reel/preview-720p.mp4",
  poster: { 828: "/reel/poster-828.webp", 1920: "/reel/poster-1920.webp", 3840: "/reel/poster-3840.webp" },
  duration: "1:15",
  /** o master não tem trilha de áudio (ffprobe: só vídeo) */
  hasAudio: false,
  fps: 24,
  chapters: [
    { t: 0, name: "Intro" },
    { t: 5.75, name: "Orinoco" },
    { t: 13.25, name: "ADO Lavanderias" },
    { t: 20.75, name: "Rio Uruguay" },
    { t: 28.25, name: "Ikari Studio" },
    { t: 35.75, name: "Jorak" },
    { t: 43.25, name: "Ohm Engenharia" },
    { t: 50.75, name: "InfernAI" },
    { t: 58.25, name: "Mavell Studio" },
    { t: 65.75, name: "Outro" },
  ],
  chapterThumb: (i: number) => `/reel/ch/${String(i).padStart(2, "0")}.jpg`,
  transcript:
    "A 75-second silent montage of the eight live projects — Orinoco, ADO Lavanderias, Rio Uruguay, Ikari Studio, Jorak, Ohm Engenharia, InfernAI and Mavell Studio.",
};

/** Currículo em EN (direction/about-curriculo.md — tradução fiel do PDF de Lucas, sem fatos novos). */
export const CV = {
  profile:
    "Creative and full-stack developer building web products end to end: brand sites, e-commerce, SaaS platforms and admin dashboards. I architect typed React/Next.js front-ends with real-time WebGL/3D and GSAP motion, and Node.js back-ends with PostgreSQL, REST APIs and JWT auth, shipped with attention to Core Web Vitals, accessibility and performance.",
  skills: [
    { k: "Languages", v: "TypeScript, JavaScript (ES2023+), HTML5, CSS3, GLSL, SQL, Python." },
    { k: "Front-end", v: "React 19, Next.js (App Router, SSG/static export), Vite, SvelteKit, Astro, TailwindCSS, CSS 3D, responsive and i18n UIs." },
    { k: "Motion & 3D", v: "GSAP (ScrollTrigger, Flip, timelines), Lenis smooth scroll, Three.js, React Three Fiber, WebGL/WebGL2, custom GLSL shaders, post-processing, Canvas 2D, Blender (modelling, baking, glTF/meshopt), Remotion." },
    { k: "Back-end & data", v: "Node.js, .NET (C#), REST API design, PostgreSQL, SQLite/Turso, JWT authentication, admin panels with uploads, serverless functions, Python automation and workflow integrations." },
    { k: "AI & automation", v: "Multi-agent orchestration, LLM/AI workflow optimization, Python + AI automations for continuous pipelines." },
    { k: "Performance & quality", v: "Core Web Vitals and Lighthouse, media pipelines (AVIF/WebP, H.264/VP9 via ffmpeg, sharp), GPU fallbacks, WCAG accessibility, technical SEO, Playwright QA." },
    { k: "Tooling & delivery", v: "Git/GitHub, npm, Docker, Vercel, Netlify, DNS and custom domains, CI deploys." },
  ],
  education: [
    { inst: "FACENS University Center", course: "Systems Analysis and Development", status: "In progress · expected 2028" },
    { inst: "SENAI Gaspar Ricardo", course: "Electromechanical Maintenance Electrician", status: "2026" },
    { inst: "ETEC Elias Miguel Júnior", course: "Web Development Technician, integrated with high school", status: "Completed 2024" },
  ],
};
