import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "Пользовательское соглашение",
  description: "Пользовательское соглашение проекта Paracetamol Haze.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-white">Пользовательское соглашение</h1>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <p><em>Последнее обновление: [TODO: Указать дату]</em></p>
        
        <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Общие положения</h2>
        <p>
          Используя сервисы, инструменты и игры Paracetamol Haze, вы соглашаетесь с настоящими условиями. Инструменты предоставляются "как есть", без каких-либо явных или подразумеваемых гарантий.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Использование сервиса</h2>
        <p>
          Сервис предназначен для создания интерактива на Twitch-трансляциях. Вы обязуетесь не использовать сервис для нарушения правил платформы Twitch, законов вашей страны или распространения вредоносного ПО.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Ответственность</h2>
        <p>
          Разработчики Paracetamol Haze не несут ответственности за любые проблемы, связанные с блокировками аккаунтов на сторонних платформах (Twitch, Steam и др.), сбоями в работе оверлеев на ваших трансляциях или потерей данных.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Сторонние интеграции</h2>
        <p>
          Мы используем официальные API платформы Twitch. Вы несете ответственность за соблюдение Условий обслуживания (Terms of Service) Twitch при использовании наших инструментов.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Изменения</h2>
        <p>
          Мы оставляем за собой право вносить изменения в сервис и в настоящее соглашение в любой момент без предварительного уведомления.
        </p>
        
        <h2 className="text-2xl font-bold text-white mt-8 mb-4">Контакты и Реквизиты</h2>
        <p>
          [TODO: Указать реквизиты, юридическую информацию владельца проекта или контакты для связи.]
        </p>
      </div>
    </main>
  );
}
