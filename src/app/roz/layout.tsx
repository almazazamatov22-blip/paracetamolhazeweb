import { generateBaseMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Розыгрыши в чате Twitch — розыгрыш, лотерея и аукцион",
  description: "Инструмент для проведения розыгрышей, лотерей и аукционов среди зрителей Twitch с использованием чата и баллов канала.",
  path: "/roz",
});

export default function RozLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "РОЗ (Розыгрыши Twitch)",
          description: "Инструмент для проведения розыгрышей, лотерей и аукционов среди зрителей Twitch.",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Any",
          url: "https://paracetamolhaze.ru/roz",
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "RUB",
          },
        }}
      />
      {children}
    </>
  );
}
