import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/inter";
import "@fontsource/unifrakturmaguntia";
import "@fontsource-variable/martian-mono/standard.css";
import "@fontsource/rubik-bubbles";
import "@fontsource-variable/big-shoulders-display";
import "./globals.css";
import "./v3.css";
import "./v4.css";
import { EN, fmt } from "@/lib/i18n/dict";
import { countWord } from "@/lib/projects";
import { ROBOTS_INDEX, SITE_URL } from "@/lib/site";
import Providers from "@/components/Providers";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
  title: EN.meta.home.title,
  description: fmt(EN.meta.home.description, { count: countWord("en") }),
  authors: [{ name: "Lucas Melo", url: "https://github.com/lucshllw" }],
  // Indexação controlada em lib/site.ts.
  robots: { index: ROBOTS_INDEX, follow: ROBOTS_INDEX },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/brand/icon.svg", type: "image/svg+xml" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/brand/apple-icon-180.png",
  },
  openGraph: {
    title: EN.meta.home.title,
    description: fmt(EN.meta.home.description, { count: countWord("en") }),
    type: "website",
    url: "/",
    locale: "en_US",
    alternateLocale: ["pt_BR"],
    images: [{ url: "/brand/og-lucas-melo.jpg", width: 1200, height: 630, alt: "Lucas Melo's avatar" }],
  },
  twitter: { card: "summary_large_image", title: EN.meta.home.title, description: fmt(EN.meta.home.description, { count: countWord("en") }), images: ["/brand/og-lucas-melo.jpg"] },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

// Head script v4 (antes da 1ª pintura): html.js; idioma — v5: só em /curriculo — (?lang → lm-lang → cv-lang → en; PT grava html.lang e
// data-lang-pending, que esconde o texto EN até o React aplicar o PT, com trava CSS de 1,2 s); tier inicial
// (?tier → reduced → sessão); intro só no 1º carregamento de "/" sem reduced-motion, ancorada na navegação.
const headScript = `try{var d=document.documentElement;d.classList.add('js');var Q=new URLSearchParams(location.search);var L='en';try{var q=Q.get('lang');if(q==='pt'||q==='en')L=q;else{var s=localStorage.getItem('lm-lang')||localStorage.getItem('cv-lang');if(s==='pt'||s==='en')L=s}}catch(e){}if(L==='pt'&&location.pathname.indexOf('/curriculo')===0){d.lang='pt-BR';d.dataset.lang='pt';d.dataset.langPending='1'}var rm=matchMedia('(prefers-reduced-motion: reduce)').matches;try{var tq=Q.get('tier');if(tq)d.dataset.tier=tq;else if(rm)d.dataset.tier='reduced';else{var ts=JSON.parse(sessionStorage.getItem('lm-tier')||'null');if(ts&&ts.tier)d.dataset.tier=ts.tier}}catch(e){}var hp=location.pathname==='/'||location.pathname==='/index.html';if(hp&&!rm&&scrollY<10&&!location.hash){d.dataset.intro='run';var R=/^(fadeIn|fadeOut|dropIn|preloaderGone|lmRise|lmHeader)$/,n=0;var f=function(){var a=document.getAnimations?document.getAnimations().filter(function(x){return R.test(x.animationName)}):[];if(a.length<6&&n++<60)return requestAnimationFrame(f);a.forEach(function(x){x.startTime=0});d.dataset.introAnchored=String(a.length)};requestAnimationFrame(f)}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: headScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
