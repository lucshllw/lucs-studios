import Preloader from "@/components/Preloader";
import Hero from "@/components/Hero";
import PortalReel from "@/components/PortalReel";
import Filmstrip from "@/components/Filmstrip";
import Manifesto from "@/components/Manifesto";
import PreFooter from "@/components/PreFooter";
import SiteFooter from "@/components/SiteFooter";
import LegacyHash from "@/components/LegacyHash";

/** Home v4 (parecer §5): Preloader → Hero → PortalReel → Filmstrip → Manifesto → PreFooter → SiteFooter. */
export default function Home() {
  return (
    <>
      <Preloader />
      <main id="content" tabIndex={-1} className="home">
        <Hero />
        <PortalReel />
        <Filmstrip />
        <Manifesto />
        <PreFooter />
      </main>
      <SiteFooter />
      <LegacyHash />
    </>
  );
}
