import type { MetadataRoute } from "next";
import { ROBOTS_INDEX, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: ROBOTS_INDEX ? { userAgent: "*", allow: "/" } : { userAgent: "*", disallow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
