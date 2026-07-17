import { generateBaseMetadata } from "@/lib/seo";

export const metadata = generateBaseMetadata({
  title: "Проверка каналов и подписок Twitch",
  description: "Инструмент для проверки информации об открытых подписках пользователей Twitch и анализа каналов.",
  path: "/check",
});

export default function CheckLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
