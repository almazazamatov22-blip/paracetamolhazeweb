import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "О проекте",
  description: "Paracetamol Haze — это набор бесплатных инструментов, интерактивов и игр для Twitch-стримеров.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-16 px-4 sm:px-8 max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold mb-8 text-white">О проекте Paracetamol Haze</h1>
      
      <div className="space-y-6 text-gray-300 leading-relaxed">
        <p>
          <strong>Paracetamol Haze</strong> — это коллекция бесплатных инструментов, интерактивных игр и оверлеев, созданная специально для стримеров на Twitch.
        </p>
        <p>
          Наша цель — дать создателям контента удобные и качественные инструменты для взаимодействия с аудиторией. Мы верим, что стриминг должен быть веселым и интерактивным как для стримера, так и для его зрителей.
        </p>
        <h2 className="text-2xl font-bold mt-8 mb-4 text-white">Что мы предлагаем?</h2>
        <ul className="list-disc list-inside space-y-2">
          <li><strong>Интеграции с играми:</strong> Позвольте вашему чату управлять вашей игрой (например, CS2 × Twitch).</li>
          <li><strong>Мини-игры и квизы:</strong> КиноКадр, Эмоджино, Бредовуха и многое другое для перерывов и интерактива.</li>
          <li><strong>Инструменты:</strong> Розыгрыши (РОЗ), проверка подписок и настраиваемые оверлеи для OBS.</li>
        </ul>
        
        <h2 className="text-2xl font-bold mt-8 mb-4 text-white">Технологии</h2>
        <p>
          Проект построен на современных веб-технологиях (Next.js, React, TypeScript) и распространяется бесплатно.
        </p>
      </div>
    </main>
  );
}
