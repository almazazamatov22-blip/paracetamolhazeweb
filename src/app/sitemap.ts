import type { MetadataRoute } from "next";
import { PUBLIC_INDEXABLE_ROUTES, getCanonicalUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_INDEXABLE_ROUTES.map((route) => ({
    url: getCanonicalUrl(route),
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.8,
  }));
}
