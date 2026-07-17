import { generateBaseMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Бредовуха — Лобби с режимами для вечеринки",
  description: "Бредовуха — это веселые мини-игры для компании на стриме. Создавайте лобби и играйте вместе со зрителями.",
  path: "/bred",
});

export default function BredLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Game",
          name: "Бредовуха",
          description: "Веселые мини-игры для компании на стриме.",
          url: "https://paracetamolhaze.ru/bred",
        }}
      />
      {children}
    </>
  );
}
