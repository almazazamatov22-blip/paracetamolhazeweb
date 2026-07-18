import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "Политика конфиденциальности",
  description: "Политика конфиденциальности проекта Paracetamol Haze.",
  path: "/privacy",
  noindex: false,
});

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-white">Политика конфиденциальности</h1>
      <p className="text-sm text-gray-500 mb-8">Дата последнего обновления: 18 июля 2026 года</p>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Общая информация</h2>
        <p>Настоящая Политика конфиденциальности описывает обработку данных в сервисах проекта Paracetamol Haze. Оператор проекта — физическое лицо, управляющее проектом Paracetamol Haze, Республика Казахстан, город Астана.</p>
        <p>Контакт: <a href="mailto:support@aicarry.online" className="text-twitch-purple hover:underline">support@aicarry.online</a></p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Какие данные могут обрабатываться</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Twitch ID;</li>
          <li>Twitch login;</li>
          <li>отображаемое имя;</li>
          <li>URL аватара;</li>
          <li>email, если Twitch передаёт его согласно разрешению <code>user:read:email</code>;</li>
          <li>сообщения Twitch-чата, необходимые для работы игр и розыгрышей;</li>
          <li>информация о наградах Channel Points и их активациях;</li>
          <li>игровые результаты, очки и данные рейтингов;</li>
          <li>данные участников розыгрышей, билетов, ставок и победителей;</li>
          <li>техническая информация, необходимая для работы сайта и устранения ошибок.</li>
        </ul>
        <p>Разрешение <code>user:read:email</code> позволяет Twitch предоставить email пользователя. В настоящее время email не сохраняется в основной таблице пользовательских профилей, если это не требуется отдельной функцией сервиса.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Цели обработки</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Twitch-авторизация;</li>
          <li>работа игр и интерактивов;</li>
          <li>обработка сообщений чата;</li>
          <li>работа Channel Points;</li>
          <li>создание и управление наградами;</li>
          <li>розыгрыши и аукционы;</li>
          <li>игровые рейтинги;</li>
          <li>оверлеи;</li>
          <li>поддержка и исправление технических ошибок.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Twitch OAuth</h2>
        <p>Мы используем следующие разрешения (scopes):</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li><code>user:read:email</code> — для получения базового профиля и email.</li>
          <li><code>chat:read</code> — для чтения сообщений в чате (необходимо для интерактивов).</li>
          <li><code>chat:edit</code> — для отправки ответов бота или результатов в чат.</li>
          <li><code>channel:read:redemptions</code> — для отслеживания активации наград пользователями.</li>
          <li><code>channel:manage:redemptions</code> — для создания и управления пользовательскими наградами канала.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Cookies</h2>
        <p>Для Twitch-авторизации используется cookie <code>twitch_token</code>, содержащая Twitch access token. Cookie имеет защиту HttpOnly, используется только для работы авторизованных функций и хранится до окончания срока действия токена или выхода пользователя из сервиса.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. Хранение данных</h2>
        <p>Пользовательские данные хранятся только в объёме, необходимом для работы функций сервиса. Профильные данные и временная игровая информация могут храниться до 90 дней с момента последней активности. Данные рейтингов и результаты игр могут храниться дольше, пока они необходимы для работы соответствующей функции или до получения подтверждённого запроса на удаление.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Сторонние сервисы</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Twitch — авторизация, профиль, чат, Channel Points и события;</li>
          <li>Vercel — хостинг сайта и серверных функций;</li>
          <li>Supabase — хранение части пользовательских и игровых данных;</li>
          <li>Cloudflare — работа отдельных проектов и серверных функций;</li>
          <li>GitHub — распространение официальных релизов CS2Haze;</li>
          <li>Google Analytics — сбор обезличенной статистики посещений и взаимодействий с сайтом;</li>
          <li>Яндекс Метрика — сбор статистики посещений, переходов, кликов и взаимодействий с сайтом.</li>
        </ul>
        <p>Эти сервисы могут обрабатывать технические и пользовательские данные в соответствии со своими политиками конфиденциальности.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Аналитика</h2>
        <p>На сайте используются Google Analytics и Яндекс Метрика для получения статистики посещений и взаимодействий. Сервисы могут обрабатывать сведения о просмотренных страницах, событиях, кликах, источниках перехода, приблизительном местоположении, типе устройства и браузере. Эти сведения используются для анализа работы сайта и улучшения его функций.</p>
        <p className="mt-4">Google Analytics и Яндекс Метрика могут использовать cookies и аналогичные технологии. Обработка данных осуществляется Google и Яндексом в соответствии с их политиками конфиденциальности.</p>
        <p className="mt-4">Вебвизор Яндекс Метрики, запись действий посетителей и аналитика форм на дату последнего обновления отключены.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Удаление данных</h2>
        <p>Для запроса доступа, исправления или удаления данных пользователь может написать на <a href="mailto:support@aicarry.online" className="text-twitch-purple hover:underline">support@aicarry.online</a> и указать свой Twitch login или Twitch ID.</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>не нужно отправлять пароль;</li>
          <li>не нужно отправлять access token;</li>
          <li>не нужно отправлять cookie;</li>
          <li>для подтверждения владения аккаунтом может потребоваться дополнительная проверка.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Отзыв Twitch-доступа</h2>
        <p>Пользователь может в любой момент:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>выйти из сервиса;</li>
          <li>удалить cookies сайта;</li>
          <li>отозвать доступ приложения в настройках подключений Twitch;</li>
          <li>написать на email для удаления сохранённых данных.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Возраст</h2>
        <p>Сервис предназначен для пользователей в возрасте 13 лет и старше. Несовершеннолетние должны использовать сервис под надзором родителя или законного представителя.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">12. Безопасность</h2>
        <p>Оператор принимает разумные технические меры для защиты данных, однако ни один способ передачи или хранения информации в интернете не может гарантировать абсолютную безопасность.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">13. Изменения политики</h2>
        <p>Настоящий документ может обновляться, а новая версия публикуется на этой странице.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">14. Контакты</h2>
        <p>Paracetamol Haze<br/>
        Республика Казахстан, Астана<br/>
        <a href="mailto:support@aicarry.online" className="text-twitch-purple hover:underline">support@aicarry.online</a></p>
      </div>
    </main>
  );
}
