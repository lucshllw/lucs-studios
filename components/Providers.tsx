"use client";
// Camada cliente persistente entre rotas (parecer v4 §1): idioma, tier, Lenis único, header, menu e transições.
import type { ReactNode } from "react";
import { LangProvider, useT } from "@/lib/i18n/provider";
import { TierProvider } from "@/lib/tier";
import SmoothScroll from "./SmoothScroll";
import SiteHeader from "./SiteHeader";
import PageTransition from "./PageTransition";

function Skip() {
  const t = useT();
  return (
    <a className="skip" href="#content">
      {t.a11y.skip}
    </a>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <TierProvider>
        <SmoothScroll>
          <PageTransition>
            <Skip />
            <SiteHeader />
            {children}
          </PageTransition>
        </SmoothScroll>
      </TierProvider>
    </LangProvider>
  );
}
