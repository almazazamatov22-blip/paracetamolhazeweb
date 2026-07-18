import type { Metadata } from "next";

export const SITE_URL = "https://paracetamolhaze.ru";
export const SITE_NAME = "Paracetamol Haze";
export const DEFAULT_DESCRIPTION = "Бесплатные игры, розыгрыши, Twitch-оверлеи и интерактивы для стримеров и зрителей: CS2 × Twitch, КиноКадр, КиноКвиз, Эмоджино, Лотомаль и другие проекты.";
export const DEFAULT_LOCALE = "ru_RU";

export const PUBLIC_INDEXABLE_ROUTES = [
  "/",
  "/cs2xtwitch",
  "/roz",
  "/check",
  "/67",
  "/kinokadr",
  "/kinoquiz",
  "/bred",
  "/emojino",
  "/projects/lotomal",
  "/overlays",
  "/guides/cs2-twitch-setup",
  "/guides/obs-twitch-overlays",
  "/about",
  "/privacy",
  "/terms",
];

export function getCanonicalUrl(path: string): string {
  // Ensure path starts with /
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  // Remove trailing slash if any (unless it's just "/")
  const normalizedPath = cleanPath === "/" ? "" : cleanPath.replace(/\/$/, "");
  return `${SITE_URL}${normalizedPath}`;
}

export function generateBaseMetadata({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  noindex = false,
  ogImage,
}: {
  title: string;
  description?: string;
  path: string;
  noindex?: boolean;
  ogImage?: string;
}): Metadata {
  const url = getCanonicalUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    robots: {
      index: !noindex,
      follow: true,
      googleBot: {
        index: !noindex,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: DEFAULT_LOCALE,
      type: "website",
      ...(ogImage && {
        images: [
          {
            url: ogImage,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(ogImage && { images: [ogImage] }),
    },
  };
}
