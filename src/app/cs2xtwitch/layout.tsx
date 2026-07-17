import { generateBaseMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-outfit",
});

export const metadata = generateBaseMetadata({
  title: "CS2 × Twitch — зрители управляют игрой через баллы канала",
  description: "Интеграция CS2 с Twitch: зрители активируют эффекты в игре за баллы канала, а стример управляет наградами и OBS-оверлеем.",
  path: "/cs2xtwitch",
});

export default function CS2TwitchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${outfit.variable} font-sans`}>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "CS2 × Twitch",
          description: "Интеграция CS2 с Twitch: зрители активируют эффекты в игре за баллы канала.",
          applicationCategory: "GameApplication",
          operatingSystem: "Windows 10, Windows 11",
          url: "https://paracetamolhaze.ru/cs2xtwitch",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "RUB",
          },
        }}
      />
      {children}
    </div>
  );
}
