import { generateBaseMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Как добавить Twitch-оверлей Paracetamol Haze в OBS",
  description: "Пошаговая инструкция по добавлению браузерных оверлеев Paracetamol Haze в OBS Studio: настройка источника, аудио и размеров.",
  path: "/guides/obs-twitch-overlays",
});

export default function OBSOverlaysGuide() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Главная",
              item: SITE_URL
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Оверлеи",
              item: `${SITE_URL}/projects/twitch-overlays`
            },
            {
              "@type": "ListItem",
              position: 3,
              name: "Инструкция по настройке OBS"
            }
          ]
        }}
      />
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white leading-tight">
        Как добавить Twitch-оверлей Paracetamol Haze в OBS
      </h1>
      
      <p className="text-gray-400 mb-8 text-sm">Обновлено: Июль 2026</p>

      <div className="space-y-8 text-gray-300 leading-relaxed">
        <p>
          Использование оверлеев делает ваши интерактивные трансляции ярче. Paracetamol Haze предоставляет готовые веб-оверлеи (Browser Sources), которые легко интегрируются в любую программу для стриминга (OBS Studio, Streamlabs, XSplit).
        </p>

        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Пошаговая настройка в OBS Studio</h2>
          <ol className="list-decimal list-outside ml-6 space-y-4">
            <li>
              <strong>Получите ссылку на оверлей.</strong><br/>
              Зайдите в нужный вам проект на сайте (например, CS2 × Twitch) или в панель управления оверлеями и скопируйте вашу уникальную ссылку.
            </li>
            <li>
              <strong>Добавьте источник в OBS.</strong><br/>
              В панели <em>Источники (Sources)</em> нажмите <strong>+</strong> и выберите <strong>Браузер (Browser)</strong>. Назовите его, например, «Haze Overlay».
            </li>
            <li>
              <strong>Настройте параметры источника.</strong><br/>
              <ul className="list-disc list-outside ml-6 mt-2 space-y-1 text-sm text-gray-400">
                <li><strong>URL:</strong> Вставьте скопированную ссылку.</li>
                <li><strong>Ширина:</strong> 1920</li>
                <li><strong>Высота:</strong> 1080</li>
                <li><strong>Пользовательский CSS:</strong> Можно оставить пустым или по умолчанию.</li>
              </ul>
            </li>
            <li>
              <strong>Обязательные галочки.</strong><br/>
              Прокрутите окно свойств браузера вниз и поставьте галочки:
              <ul className="list-disc list-outside ml-6 mt-2 space-y-1 text-sm text-emerald-400">
                <li>Управление аудио через OBS (Control audio via OBS)</li>
                <li>Обновить браузер, когда сцена становится активной (Refresh browser when scene becomes active)</li>
              </ul>
            </li>
            <li>
              <strong>Настройте вывод звука.</strong><br/>
              После добавления оверлея в микшере звука появится новый ползунок «Haze Overlay». Нажмите на шестеренку рядом с ним, выберите <em>Расширенные свойства аудио (Advanced Audio Properties)</em> и для этого источника в колонке «Прослушивание (Audio Monitoring)» выберите <strong>Прослушивание и вывод (Monitor and Output)</strong>.
            </li>
          </ol>
        </section>

        <div className="mt-8 p-6 bg-[#1a1a1a] border border-[#333] rounded-xl text-sm">
          <strong>Зачем нужно управление аудио через OBS?</strong>
          <p className="mt-2">Браузеры по умолчанию блокируют автоматическое воспроизведение звука (Autoplay Policy), если пользователь не взаимодействовал со страницей. Включение «Управления аудио через OBS» обходит это ограничение, гарантируя, что все звуки оверлея (сирены, уведомления, музыка) сработают безотказно.</p>
        </div>
      </div>
    </main>
  );
}
