import type { Metadata } from "next";
import { EN } from "@/lib/i18n/dict";
import About from "@/components/about/About";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: EN.meta.about.title,
  description: EN.meta.about.description,
  alternates: { canonical: "/about" },
  openGraph: { url: "/about", title: EN.meta.about.title, description: EN.meta.about.description },
};

export default function AboutPage() {
  return (
    <>
      <main id="content" tabIndex={-1} className="about">
        <About />
      </main>
      <SiteFooter />
    </>
  );
}
