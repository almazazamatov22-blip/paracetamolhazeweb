import { generateBaseMetadata, SITE_URL } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";

export const metadata = generateBaseMetadata({
  title: "Как подключить Twitch к CS2 и дать зрителям управлять игрой",
  description: "Пошаговая инструкция по настройке интерактивного режима CS2 × Twitch: установка CS2Haze, авторизация и создание наград за баллы канала.",
  path: "/guides/cs2-twitch-setup",
});

export default function CS2TwitchSetupGuide() {
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
              name: "CS2 × Twitch",
              item: `${SITE_URL}/cs2xtwitch`
            },
            {
              "@type": "ListItem",
              position: 3,
              name: "Инструкция по настройке"
            }
          ]
        }}
      />
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-white leading-tight">
        Как подключить Twitch к CS2 и дать зрителям управлять игрой
      </h1>
      
      <p className="text-gray-400 mb-8 text-sm">Обновлено: Июль 2026</p>

      <div className="space-y-10 text-gray-300 leading-relaxed">
        <section>
          <h2 className="text-2xl font-bold text-white mb-4">Оглавление</h2>
          <ul className="list-disc list-inside space-y-2 text-[#9146ff]">
            <li><a href="#step-1" className="hover:underline">Шаг 1: Скачивание лаунчера</a></li>
            <li><a href="#step-2" className="hover:underline">Шаг 2: Установка и запуск</a></li>
            <li><a href="#step-3" className="hover:underline">Шаг 3: Авторизация через Twitch</a></li>
            <li><a href="#step-4" className="hover:underline">Шаг 4: Настройка наград за баллы канала</a></li>
            <li><a href="#step-5" className="hover:underline">Шаг 5: Добавление оверлея в OBS</a></li>
          </ul>
        </section>

        <section id="step-1">
          <h2 className="text-2xl font-bold text-white mb-4">Шаг 1: Скачивание лаунчера</h2>
          <p className="mb-4">
            Для работы интеграции требуется специальная программа <strong>CS2Haze</strong>, которая принимает команды с Twitch и передает их в клиент игры.
          </p>
          <p>
            Перейдите на <a href="/cs2xtwitch" className="text-[#9146ff] hover:underline">главную страницу проекта</a> и нажмите <strong>«Скачать CS2Haze»</strong>. Приложение поддерживает Windows 10 и 11.
          </p>
        </section>

        <section id="step-2">
          <h2 className="text-2xl font-bold text-white mb-4">Шаг 2: Установка и запуск</h2>
          <p className="mb-4">
            Windows SmartScreen может показать предупреждение, поскольку текущая версия установщика не подписана коммерческим сертификатом издателя.
          </p>
          <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#333] mb-4 text-sm">
            <p><strong>Система Windows защитила компьютер</strong></p>
            <p className="mt-2">Нажмите <strong>«Подробнее»</strong> (More info), а затем <strong>«Выполнить в любом случае»</strong> (Run anyway).</p>
          </div>
          <p>Запустите установщик и следуйте стандартным инструкциям на экране.</p>
        </section>

        <section id="step-3">
          <h2 className="text-2xl font-bold text-white mb-4">Шаг 3: Авторизация через Twitch</h2>
          <p className="mb-4">
            Запустите установленное приложение. В главном окне нажмите кнопку <strong>Login with Twitch</strong>.
          </p>
          <p>
            Вас перенаправит в браузер, где необходимо разрешить приложению читать события баллов канала (Channel Points). После успешной авторизации программа подключится к вашему аккаунту.
          </p>
        </section>

        <section id="step-4">
          <h2 className="text-2xl font-bold text-white mb-4">Шаг 4: Настройка наград за баллы канала</h2>
          <p className="mb-4">
            Зайдите в <strong>Панель управления наградами</strong> на сайте Paracetamol Haze (кнопка доступна на странице CS2 × Twitch после входа).
          </p>
          <p className="mb-4">
            Здесь вы можете выбрать, какие эффекты вы хотите разрешить зрителям (например, сброс оружия, инверсия мыши, фейк-флешка). Выберите эффект, укажите его стоимость в баллах и сохраните. Приложение автоматически создаст соответствующую награду на вашем Twitch-канале!
          </p>
        </section>

        <section id="step-5">
          <h2 className="text-2xl font-bold text-white mb-4">Шаг 5: Добавление оверлея в OBS</h2>
          <p className="mb-4">
            Чтобы зрители и вы видели уведомления об активации эффектов, добавьте специальный оверлей в OBS:
          </p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Скопируйте вашу уникальную ссылку на оверлей из панели управления.</li>
            <li>В OBS добавьте источник <strong>Браузер (Browser Source)</strong>.</li>
            <li>Вставьте ссылку в поле URL, укажите размер 1920×1080.</li>
            <li>Установите галочки <em>Управление аудио через OBS</em> и <em>Обновить браузер, когда сцена становится активной</em>.</li>
          </ol>
        </section>
        
        <div className="mt-12 p-6 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-emerald-100">
          <strong>Готово!</strong> Теперь запустите CS2, запустите стрим и позвольте зрителям веселиться!
        </div>
      </div>
    </main>
  );
}
