import { generateBaseMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Twitch Оверлеи — виджеты для OBS",
  description: "Бесплатные оверлеи и виджеты для OBS Studio, работающие с баллами канала Twitch.",
  path: "/projects/twitch-overlays",
});

export default function TwitchOverlaysPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebApplication",
          name: "Twitch Оверлеи Paracetamol Haze",
          description: "Бесплатные оверлеи и виджеты для OBS Studio, работающие с баллами канала Twitch.",
          applicationCategory: "UtilityApplication",
          operatingSystem: "Any",
          url: "https://paracetamolhaze.ru/projects/twitch-overlays",
          isAccessibleForFree: true,
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "RUB",
          },
        }}
      />
      <h1 className="text-4xl font-bold mb-6 text-white">Оверлеи для Twitch и OBS</h1>
      
      <section className="mb-10 text-gray-300 leading-relaxed space-y-4">
        <p>
          Специально разработанные веб-виджеты и оверлеи, которые можно легко встроить в вашу трансляцию через <strong>OBS Studio</strong>. Они реагируют на события в чате и активации наград за баллы канала.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-2xl font-bold mb-4 text-white">Доступные возможности</h2>
        <ul className="list-disc list-inside text-gray-300 space-y-2">
          <li><strong>Визуальные оповещения:</strong> всплывающие уведомления при покупке наград.</li>
          <li><strong>Анимации на экране:</strong> эффекты, запускаемые зрителями за Channel Points.</li>
          <li><strong>Интеграция с играми:</strong> отображение статуса наград для интерактивов (например, CS2 × Twitch).</li>
        </ul>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4 text-white">Как использовать оверлеи в OBS?</h2>
        <ol className="list-decimal list-inside text-gray-300 space-y-3">
          <li>Откройте панель управления оверлеями на нашем сайте.</li>
          <li>Скопируйте уникальную ссылку для вашего Browser Source.</li>
          <li>В OBS Studio добавьте новый источник: <strong>Браузер (Browser Source)</strong>.</li>
          <li>Вставьте скопированную ссылку в поле <code>URL</code>.</li>
          <li>Установите ширину <code>1920</code> и высоту <code>1080</code> (или в соответствии с размером вашего холста).</li>
          <li>Обязательно включите галочки <strong>Управление аудио через OBS</strong> и <strong>Обновить браузер, когда сцена становится активной</strong>.</li>
        </ol>
      </section>

      <div className="flex flex-wrap gap-4 mt-8">
        <a 
          href="/overlays/dashboard" 
          className="bg-[#9146ff] hover:bg-[#a970ff] text-white px-6 py-3 rounded-xl font-bold transition-transform hover:scale-105"
        >
          Открыть панель управления
        </a>
        <a 
          href="/guides/obs-twitch-overlays" 
          className="bg-[#2a2a2a] hover:bg-[#333] text-white px-6 py-3 rounded-xl font-bold transition-transform hover:scale-105"
        >
          Подробная инструкция
        </a>
      </div>
    </main>
  );
}
