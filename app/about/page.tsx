import type { Metadata } from "next";
import { About } from "@/components/about/About";
import { SmoothScroll } from "@/components/SmoothScroll";

export const metadata: Metadata = {
  title: "About — Lucas Melo",
  description: "Lucas Melo: creative developer and full-stack developer from Brazil. Profile, skills, selected work and education.",
};

export default function Page() {
  return (
    <>
      <SmoothScroll />
      <About />
    </>
  );
}
