import { generateBaseMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Эмоджино — угадай фильм по эмодзи",
  description: "Онлайн-игра, в которой нужно угадывать фильмы и сериалы по эмодзи, набирать очки и соревноваться с другими игроками.",
  path: "/emojino",
});

export default function EmojinoLayout({
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
          name: "Эмоджино",
          description: "Онлайн-игра, в которой нужно угадывать фильмы и сериалы по эмодзи.",
          url: "https://paracetamolhaze.ru/emojino",
        }}
      />
      {children}
    </>
  );
}
