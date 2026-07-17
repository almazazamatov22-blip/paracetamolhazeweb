import { generateBaseMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Лотомаль — Многопользовательская игра в Лото для стримов",
  description: "Лотомаль — интерактивная игра в Лото для Twitch-стримеров и их зрителей. Раздавайте билеты и разыгрывайте призы в прямом эфире.",
  path: "/projects/lotomal",
});

export default function LotomalPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Game",
          name: "Лотомаль",
          description: "Интерактивная игра в Лото для Twitch-стримеров и их зрителей.",
          url: "https://paracetamolhaze.ru/projects/lotomal",
          isAccessibleForFree: true,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "RUB",
          },
        }}
      />
      <h1 className="text-4xl font-bold mb-6 text-white">Лотомаль — игра в Лото для Twitch-стримеров</h1>
      
      <section className="mb-10 text-gray-300 leading-relaxed space-y-4">
        <p>
          <strong>Лотомаль</strong> — это многопользовательская онлайн-игра в классическое Лото (Бинго), созданная специально для Twitch-стримеров и их зрителей. 
        </p>
        <p>
          Это идеальный вариант для интерактивного времяпрепровождения: вы можете раздавать билеты зрителям, проводить розыгрыши в прямом эфире и дарить призы самым удачливым.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4 text-white">Кому это подходит?</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li>Стримерам, ищущим новые способы взаимодействия со зрителями.</li>
          <li>Каналам, которые регулярно проводят розыгрыши и ивенты.</li>
          <li>Всем, кто хочет расслабиться с аудиторией за классической и понятной игрой.</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-white">Краткая механика</h2>
        <ol className="list-decimal list-inside text-gray-300 space-y-2">
          <li>Стример создает лобби и делится ссылкой со зрителями.</li>
          <li>Зрители заходят по ссылке и получают свои виртуальные билеты Лото.</li>
          <li>Система (или сам стример) начинает вытягивать бочонки с номерами.</li>
          <li>Номера автоматически (или вручную) зачеркиваются на билетах.</li>
          <li>Тот, кто первым закроет линию или весь билет, становится победителем!</li>
        </ol>
      </section>

      <div className="flex justify-center">
        <a 
          href="/lotomal" 
          className="bg-[#ff4500] hover:bg-[#ff6a1a] text-white px-8 py-4 rounded-xl font-bold text-lg transition-transform hover:scale-105"
        >
          Открыть Лотомаль
        </a>
      </div>
    </main>
  );
}
