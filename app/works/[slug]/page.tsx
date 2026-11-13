import type { Metadata } from "next";
import { PROJECTS, bySlug } from "@/lib/projects";

export const dynamicParams = false;
export function generateStaticParams() {
  return PROJECTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = bySlug(slug);
  return p ? { title: `${p.name} — Lucas Melo`, description: `${p.kind}. ${p.built}` } : {};
}

export default function Page() {
  return null;
}
