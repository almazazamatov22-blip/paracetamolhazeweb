import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности проекта Paracetamol Haze.",
  path: "/privacy",
  noindex: true,
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <div className="bg-yellow-900/30 border border-yellow-500/50 p-4 rounded-xl mb-8 text-yellow-200">
        <strong>Черновик.</strong> В базе данных отсутствует механизм автоматического удаления старше 90 дней (ввиду риска поломки глобальных лидербордов). До его реализации документ остается в статусе черновика.
      </div>
      <h1 className="text-4xl font-bold mb-8 text-white">Политика конфиденциальности</h1>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <p>
          Настоящая Политика конфиденциальности описывает, как проект Paracetamol Haze (далее — «Сервис») собирает, использует и защищает вашу информацию. Сервис управляется физическим лицом, находящимся в Республике Казахстан, г. Астана.
        </p>
        <p>
          Сервис предназначен для лиц старше 13 лет. Лица в возрасте от 13 до 17 лет могут использовать Сервис только под надзором родителей или законных представителей.
        </p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Сбор информации</h2>
        <p>При авторизации через Twitch мы запрашиваем доступ к следующим данным и функциям (в зависимости от проекта):</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li><strong>Базовый профиль:</strong> ваш Twitch ID, имя пользователя (login/display name) и URL аватара. Запрашивается разрешение <code>user:read:email</code>. Email-адрес технически доступен сервису, но не передается третьим лицам.</li>
          <li><strong>Чат:</strong> права <code>chat:read</code> и <code>chat:edit</code> для работы интерактивных игр (Бредовуха, Киноквиз, РОЗ).</li>
          <li><strong>Награды канала:</strong> права <code>channel:read:redemptions</code> и <code>channel:manage:redemptions</code> для создания и управления пользовательскими наградами за баллы канала (CS2 Interactive, Оверлеи).</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Использование и хранение данных</h2>
        <p>Собранные данные используются исключительно для обеспечения функционала сервиса (сохранение результатов, управление наградами, работа оверлеев). Мы храним данные в базах данных (Supabase PostgreSQL и SQLite/Prisma). Кэширование осуществляется через Upstash Redis.</p>
        <p><strong>Политика хранения:</strong> Мы стремимся хранить данные профилей и статистики не более 90 дней с момента вашей последней активности, после чего данные подлежат удалению.</p>
        <p><strong>Файлы cookie:</strong> Для поддержания сессии мы используем защищенные файлы cookie (например, <code>twitch_token</code> и токены NextAuth) с флагами HttpOnly, Secure и SameSite=Lax. Они не используются для межсайтового отслеживания.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Передача третьим лицам</h2>
        <p>Мы не продаем и не передаем ваши личные данные сторонним маркетинговым компаниям. Однако техническая инфраструктура Сервиса обеспечивается сторонними провайдерами:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li><strong>Vercel:</strong> хостинг основного приложения.</li>
          <li><strong>Cloudflare Workers:</strong> хостинг подпроекта Лотомаль.</li>
          <li><strong>Supabase / Upstash:</strong> облачные базы данных и кэш.</li>
          <li><strong>Twitch API:</strong> для синхронизации наград и статуса.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Аналитика</h2>
        <p>В Сервисе <strong>не используются</strong> сторонние системы отслеживания и аналитики, такие как Google Analytics или Яндекс.Метрика.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Контакты</h2>
        <p>Если у вас есть вопросы по поводу конфиденциальности или вы хотите запросить удаление своих данных, напишите нам на email: <a href="mailto:support@aicarry.online" className="text-twitch-purple hover:underline">support@aicarry.online</a>.</p>
      </div>
    </main>
  );
}
