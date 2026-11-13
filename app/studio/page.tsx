import type { Metadata } from "next";
import { Studio } from "@/components/studio/Studio";

export const metadata: Metadata = {
  title: "Studio — Lucas Melo",
  description: "Lucas Melo's real desk setup as an interactive 3D scene: reel, works, stack, résumé and WhatsApp from the objects on the desk.",
};

export default function Page() {
  return <Studio />;
}
