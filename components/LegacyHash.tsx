"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Links antigos da v3 (#obras, #sobre-mim, #sobre) → rotas novas, sem entrada extra no histórico. */
export default function LegacyHash() {
  const router = useRouter();
  useEffect(() => {
    const h = location.hash;
    if (h === "#obras") router.replace("/works");
    else if (h === "#sobre-mim" || h === "#sobre") router.replace("/about");
    else if (h === "#contato") document.getElementById("contact")?.scrollIntoView();
  }, [router]);
  return null;
}
