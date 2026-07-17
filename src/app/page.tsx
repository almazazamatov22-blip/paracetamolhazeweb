import { generateBaseMetadata, SITE_URL } from "@/lib/seo";
import HomeClient from "./HomeClient";

export const metadata = generateBaseMetadata({
  title: "Интерактивы и игры для Twitch-стримов | Paracetamol Haze",
  description: "Бесплатные мини-игры, интерактивы и оверлеи для Twitch. Развлекайте зрителей, используйте баллы канала и создавайте лучший контент.",
  path: "/",
});

export default function Page() {
  return <HomeClient />;
}
