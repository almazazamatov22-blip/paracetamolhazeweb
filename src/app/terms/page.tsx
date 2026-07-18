import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "Условия использования",
  description: "Условия использования проекта Paracetamol Haze.",
  path: "/terms",
  noindex: false,
});

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-white">Условия использования</h1>
      <p className="text-sm text-gray-500 mb-8">Дата последнего обновления: 18 июля 2026 года</p>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <h2 className="text-2xl font-bold text-white mt-8 mb-4">1. Общие положения</h2>
        <p>Использование сайта означает согласие с настоящими условиями.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">2. Оператор</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Paracetamol Haze;</li>
          <li>физическое лицо;</li>
          <li>Республика Казахстан, Астана;</li>
          <li><a href="mailto:support@aicarry.online" className="text-twitch-purple hover:underline">support@aicarry.online</a>.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">3. Возраст</h2>
        <p>Сервис предназначен для пользователей в возрасте 13 лет и старше. Пользователи, не достигшие совершеннолетия, должны использовать сервис под надзором родителя или законного представителя.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">4. Описание сервиса</h2>
        <p>Проект предоставляет:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Twitch-интерактивы;</li>
          <li>игры;</li>
          <li>розыгрыши;</li>
          <li>оверлеи;</li>
          <li>инструменты Channel Points;</li>
          <li>приложение CS2Haze;</li>
          <li>другие экспериментальные функции.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">5. Разрешённое использование</h2>
        <p>Пользователь обязуется:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>соблюдать правила Twitch, Steam, Valve и других платформ;</li>
          <li>не использовать сервис для вредоносных действий;</li>
          <li>не вмешиваться в работу серверов;</li>
          <li>не пытаться получить доступ к чужим данным;</li>
          <li>не использовать сервис для обмана, спама или нарушения закона.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">6. CS2Haze</h2>
        <p>CS2Haze предназначен для запуска интерактивных эффектов во время игры. Пользователь самостоятельно принимает решение об установке и использовании приложения.</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>приложение предоставляется «как есть»;</li>
          <li>использование не гарантирует отсутствие ограничений со стороны Steam, Valve, Counter-Strike 2 или сторонних античит-систем;</li>
          <li>пользователь отвечает за соблюдение правил платформ;</li>
          <li>установщик следует скачивать только с официального сайта или официального GitHub-релиза;</li>
          <li>запрещено модифицировать приложение для вредоносных действий, читов, обхода защиты или вмешательства в чужие системы.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">7. Twitch и сторонние платформы</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>проект не контролирует работу Twitch, Steam, Valve, GitHub, Vercel и других сторонних сервисов;</li>
          <li>правила и доступность этих сервисов могут изменяться;</li>
          <li>пользователь обязан соблюдать их условия.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">8. Игровые результаты</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>результаты и рейтинги могут быть сброшены;</li>
          <li>ошибки, сбои или технические работы могут привести к потере прогресса;</li>
          <li>сервис не гарантирует постоянное хранение игровых результатов.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">9. Доступность сервиса</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>функции могут изменяться;</li>
          <li>отдельные проекты могут временно отключаться;</li>
          <li>сервис может обновляться без предварительного уведомления.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">10. Ограничение ответственности</h2>
        <p>В пределах, допускаемых законодательством Республики Казахстан, оператор не несёт ответственности за косвенные убытки, ограничения аккаунтов на сторонних платформах, потерю игровых результатов, сбои сторонних сервисов или использование неофициальных копий программ.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">11. Ограничение доступа</h2>
        <p>Доступ может быть ограничен при:</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>злоупотреблениях;</li>
          <li>попытках взлома;</li>
          <li>спаме;</li>
          <li>нарушении правил;</li>
          <li>угрозе безопасности сервиса или других пользователей.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">12. Интеллектуальные права</h2>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>код, дизайн, тексты и материалы проекта защищены применимым законодательством;</li>
          <li>сторонние названия и товарные знаки принадлежат их владельцам;</li>
          <li>Twitch, Steam, Valve и Counter-Strike не являются владельцами или спонсорами Paracetamol Haze.</li>
        </ul>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">13. Изменение условий</h2>
        <p>Новая версия условий публикуется на этой странице.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">14. Применимое право</h2>
        <p>Настоящие Условия регулируются законодательством Республики Казахстан.</p>

        <h2 className="text-2xl font-bold text-white mt-8 mb-4">15. Контакты</h2>
        <p><a href="mailto:support@aicarry.online" className="text-twitch-purple hover:underline">support@aicarry.online</a></p>
      </div>
    </main>
  );
}
