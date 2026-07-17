import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности проекта Paracetamol Haze.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-white">Политика конфиденциальности</h1>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <p><em>Последнее обновление: [TODO: Указать дату]</em></p>
        
        <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Сбор информации</h2>
        <p>
          При использовании наших инструментов авторизации через Twitch мы можем получать публичную информацию о вашем профиле (логин, аватар, ID) и доступ к управлению наградами за баллы канала (Channel Points), если вы предоставляете соответствующие права.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Использование информации</h2>
        <p>
          Собранные данные используются исключительно для обеспечения работоспособности сервиса (создание наград, отображение статистики, работа оверлеев). Мы не продаем и не передаем ваши данные третьим лицам.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Хранение данных</h2>
        <p>
          [TODO: Указать информацию о сроках хранения данных, использовании БД, файлов куки и сессий.]
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Аналитика</h2>
        <p>
          На сайте могут использоваться системы веб-аналитики (например, Яндекс Метрика или Google Analytics) для отслеживания посещаемости в обезличенном виде.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Контакты</h2>
        <p>
          Если у вас есть вопросы по поводу конфиденциальности, вы можете связаться с нами: [TODO: Указать email или ссылку на контакт].
        </p>
      </div>
    </main>
  );
}
