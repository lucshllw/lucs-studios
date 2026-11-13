import type { Metadata } from "next";
import { Resume } from "@/components/resume/Resume";
import { SmoothScroll } from "@/components/SmoothScroll";

export const metadata: Metadata = {
  title: "Résumé — Lucas Melo",
  description: "Résumé of Lucas Melo, creative developer and full-stack developer from Brazil: profile, skills, selected work, education and contact.",
};

export default function Page() {
  return (
    <>
      <SmoothScroll />
      <Resume />
    </>
  );
}
