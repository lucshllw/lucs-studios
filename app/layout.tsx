import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight";
import "@fontsource-variable/martian-mono/standard.css";
import "@fontsource/unifrakturmaguntia";
import "@fontsource-variable/big-shoulders-display";
import "./globals.css";
import { Shell } from "@/components/shell/Shell";

export const metadata: Metadata = {
  title: "Lucas Melo — Creative Developer",
  description:
    "Portfolio of Lucas Melo, a creative developer and full-stack developer from Brazil: data, APIs, interfaces and motion. Eight live projects.",
  icons: { icon: "/brand/favicon.ico", apple: "/brand/apple-icon-180.png" },
  openGraph: { images: ["/brand/og-lucas-melo.jpg"], type: "website" },
};

export const viewport: Viewport = { themeColor: "#000000", colorScheme: "dark" };

// Antes da pintura: classes js / gl (WebGL2 disponível e não desligado por ?webgl=0) / rm (reduced-motion).
const BOOT = `(function(){var d=document.documentElement;d.classList.add('js');try{if(/[?&]webgl=0/.test(location.search))throw 0;var L=null;try{var q=location.search.match(/[?&]lite=([01])/);if(q)localStorage.setItem('rito-lite',q[1]);L=localStorage.getItem('rito-lite');}catch(e){}var c=document.createElement('canvas'),g=c.getContext('webgl2');if(g){d.classList.add('gl');var soft=false;try{var di=g.getExtension('WEBGL_debug_renderer_info');var rn=di?String(g.getParameter(di.UNMASKED_RENDERER_WEBGL)):'';soft=/swiftshader|llvmpipe|softpipe|basic render|microsoft basic|software/i.test(rn);if(!soft){var c2=document.createElement('canvas'),g2=c2.getContext('webgl2',{failIfMajorPerformanceCaveat:true});if(!g2)soft=true;else{var x2=g2.getExtension('WEBGL_lose_context');x2&&x2.loseContext();}}}catch(e){}var n=navigator,low=(n.deviceMemory||8)<=2||(n.hardwareConcurrency||8)<=2;if(L==='1'||(L!=='0'&&(soft||low)))d.classList.add('lite');var x=g.getExtension('WEBGL_lose_context');x&&x.loseContext();}}catch(e){}if(matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('rm');var f=function(){d.classList.add('fr')};document.fonts&&document.fonts.ready.then(f);setTimeout(f,2500);})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Shell />
        {children}
      </body>
    </html>
  );
}
