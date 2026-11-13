import { WorksApp } from "@/components/works/WorksApp";

// O layout persiste entre /works, /works/full e /works/[slug]: a cena e o estado não remontam.
export default function WorksLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="works-main">
      <WorksApp />
      {children}
    </main>
  );
}
