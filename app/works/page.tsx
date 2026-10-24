import type { Metadata } from "next";
import { EN, fmt } from "@/lib/i18n/dict";
import { countWord } from "@/lib/projects";
import WorksApp from "@/components/works/WorksApp";

export const metadata: Metadata = {
  title: EN.meta.works.title,
  description: fmt(EN.meta.works.description, { count: countWord("en") }),
  alternates: { canonical: "/works" },
  openGraph: { url: "/works", title: EN.meta.works.title, description: fmt(EN.meta.works.description, { count: countWord("en") }) },
};

export default function WorksPage() {
  return <WorksApp />;
}
