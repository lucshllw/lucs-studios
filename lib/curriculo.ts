// Currículo PT/EN (texto de Lucas em ../direction/cv-conteudo-lucas-v3.md, com os ajustes de veracidade
// marcados [ASTA]). v5 (24/10/2026, item 16): contato só com o site/portfólio (sem o link da Ikari); a seção 03 vira
// "Projetos concluídos / Completed projects" e lista TODOS os projetos do site a partir de lib/projects.ts (fonte
// única: nome, tipo curto, stack e link). Os 4 textos narrativos anteriores (Lucas Studio, Ikari, Orinoco,
// Rio Uruguay & ADO) saíram para o currículo caber na página A4; estão em app/qa/v5/curriculo-v4-backup.ts.txt.
// Formação: PROJECT/Portfólio/src/data/content.ts (education), já usada no README.
import { HANDLE, PROFILE } from "./content";
import { SITE_URL } from "./site";

import type { Lang } from "./i18n/dict";
export type { Lang };

export type Cv = {
  htmlLang: string;
  title: string;
  status: string;
  location: string;
  labels: {
    summary: string;
    stack: string;
    cases: string;
    method: string;
    education: string;
    contact: string;
    print: string;
    switch: string;
    /** aria-label da navegação superior do currículo */
    nav: string;
    back: string;
    copy: string;
    copied: string;
  };
  summary: string;
  stack: { title: string; items: string }[];
  method: { n: string; name: string; text: string }[];
  education: { inst: string; course: string; status: string }[];
};

export const CV_LINKS = {
  email: PROFILE.email,
  github: PROFILE.github,
  linkedin: PROFILE.linkedin,
  site: SITE_URL,
  handle: HANDLE,
};

export const CV: Record<Lang, Cv> = {
  pt: {
    htmlLang: "pt-BR",
    title: "Creative Developer & Desenvolvedor Full-Stack",
    status: "DISPONÍVEL PARA PROJETOS — 2026",
    location: "Brasil — Remoto (PT / EN)",
    labels: {
      summary: "01 — Resumo",
      stack: "02 — Arquitetura & Stack",
      cases: "03 — Projetos concluídos",
      method: "04 — Metodologia",
      education: "05 — Formação",
      contact: "Contato",
      print: "[ BAIXAR CV EM PDF ]",
      switch: "Idioma do currículo",
      nav: "Currículo",
      back: "← Voltar ao portfólio",
      copy: "Clique para copiar",
      copied: "Copiado!",
    },
    summary:
      "Creative Developer e Desenvolvedor Full-Stack focado na interseção entre desenvolvimento de software, motion design e automação. Especialista em construir interfaces web imersivas (WebGL/3D, animações complexas orientadas a scroll com GSAP) aliadas a arquiteturas sólidas, tipadas e escaláveis (React, SvelteKit, TypeScript, Supabase). Transformo direção de arte pesada em código limpo, performático (60fps desktop/mobile) e orientado à conversão.",
    stack: [
      {
        title: "01. Front-End & Core",
        items: "React, SvelteKit, Next.js, TypeScript, JavaScript (ES6+), HTML5 Semântico, TailwindCSS, CSS3 / Shaders.",
      },
      {
        title: "02. Motion & 3D Web",
        items:
          "GSAP (ScrollTrigger, Flip, Timeline), Three.js, React Three Fiber (R3F), Rapier (Física 3D), Lenis (Smooth Scroll), Canvas 2D / WebGL.",
      },
      {
        title: "03. Back-End, Dados & Automação",
        items:
          "Node.js, Supabase (PostgreSQL, Auth, Storage), Integração de APIs REST, Automação de Fluxos, Validação Avançada de Dados.",
      },
      {
        title: "04. Performance & Qualidade",
        items:
          "Otimização de renderização 4K/Retina, fallback de aceleração de hardware mobile (Safari/iOS), Acessibilidade (A11y), SEO Técnico, Deploy Contínuo (Vercel / Netlify) e Workflows assistidos por IA.",
      },
    ],
    method: [
      { n: "01", name: "OBSERVAR", text: "Referência e Medida" },
      { n: "02", name: "DECIDIR", text: "Métrica e Ritmo" },
      { n: "03", name: "CONSTRUIR", text: "Código Tipado" },
      { n: "04", name: "ANIMAR", text: "GSAP, 3D, Scroll" },
      { n: "05", name: "MEDIR", text: "Testes, Acessibilidade, Peso" },
      { n: "06", name: "ENTREGAR", text: "Deploy e Cuidado" },
    ],
    education: [
      { inst: "Centro Universitário FACENS", course: "Análise e Desenvolvimento de Sistemas", status: "Em andamento · conclusão prevista em 2028" },
      { inst: "SENAI Gaspar Ricardo", course: "Eletricista de Manutenção Eletroeletrônica", status: "Conclusão indicada: 2026" },
      { inst: "ETEC Elias Miguel Júnior", course: "Ensino médio integrado — Informática para Internet", status: "Concluído em 2024" },
    ],
  },
  en: {
    htmlLang: "en",
    title: "Creative Developer & Full-Stack Developer",
    status: "AVAILABLE FOR PROJECTS — 2026",
    location: "Brazil — Remote (PT / EN)",
    labels: {
      summary: "01 — Summary",
      stack: "02 — Architecture & Stack",
      cases: "03 — Completed projects",
      method: "04 — Methodology",
      education: "05 — Education",
      contact: "Contact",
      print: "[ DOWNLOAD CV AS PDF ]",
      switch: "Résumé language",
      nav: "Résumé",
      back: "← Back to portfolio",
      copy: "Click to copy",
      copied: "Copied!",
    },
    summary:
      "Creative Developer and Full-Stack Developer operating at the intersection of software development, motion design, and automation. Specialized in building immersive web interfaces (WebGL/3D, complex scroll-driven animations with GSAP) backed by solid, type-safe, and scalable architectures (React, SvelteKit, TypeScript, Supabase). Turning bold art direction into clean, high-performance (60fps desktop/mobile), conversion-driven code.",
    stack: [
      {
        title: "01. Front-End & Core",
        items: "React, SvelteKit, Next.js, TypeScript, JavaScript (ES6+), Semantic HTML5, TailwindCSS, CSS3 / Shaders.",
      },
      {
        title: "02. Motion & 3D Web",
        items:
          "GSAP (ScrollTrigger, Flip, Timeline), Three.js, React Three Fiber (R3F), Rapier (3D Physics), Lenis (Smooth Scroll), Canvas 2D / WebGL.",
      },
      {
        title: "03. Back-End, Data & Automation",
        items: "Node.js, Supabase (PostgreSQL, Auth, Storage), REST API Integration, Workflow Automation, Advanced Data Validation.",
      },
      {
        title: "04. Performance & Quality",
        items:
          "4K/Retina rendering optimization, mobile hardware-acceleration fallbacks (Safari/iOS), Accessibility (A11y), Technical SEO, Continuous Deployment (Vercel / Netlify) and AI-assisted workflows.",
      },
    ],
    method: [
      { n: "01", name: "OBSERVE", text: "Reference & Measure" },
      { n: "02", name: "DECIDE", text: "Metric & Rhythm" },
      { n: "03", name: "BUILD", text: "Typed Code" },
      { n: "04", name: "ANIMATE", text: "GSAP, 3D, Scroll" },
      { n: "05", name: "MEASURE", text: "Tests, Accessibility, Weight" },
      { n: "06", name: "DELIVER", text: "Deploy & Care" },
    ],
    education: [
      { inst: "Centro Universitário FACENS", course: "Systems Analysis and Development", status: "In progress · expected completion in 2028" },
      { inst: "SENAI Gaspar Ricardo", course: "Electrical and Electronic Maintenance Electrician", status: "Completion listed: 2026" },
      { inst: "ETEC Elias Miguel Júnior", course: "Integrated secondary education — Internet Computing", status: "Completed in 2024" },
    ],
  },
};
