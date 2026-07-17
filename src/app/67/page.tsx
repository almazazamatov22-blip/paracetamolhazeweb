import { Metadata, ResolvingMetadata } from 'next';
import Client67 from './Client67';
import { generateBaseMetadata } from '@/lib/seo';

export async function generateMetadata(
  { searchParams }: { searchParams: { score?: string, user?: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const score = searchParams.score || '0';
  const user = searchParams.user || 'Игрок';
  
  const title = score !== '0' 
    ? `Я выжал ${score} в 67! А сколько сможешь ты?` 
    : '67 • Проверка скорости реакции на ParacetamolHAZE';
    
  const description = 'Проверь свою ловкость в интерактивной игре 67! Управляй движениями рук через камеру и устанавливай мировые рекорды.';
  
  const ogImage = score !== '0' 
    ? `https://paracetamolhaze.ru/api/og/record?game=67&score=${score}&user=${encodeURIComponent(user)}`
    : 'https://paracetamolhaze.ru/67_og.png';

  return generateBaseMetadata({
    title,
    description,
    path: "/67",
    ogImage,
    noindex: score !== '0'
  });
}

export default function Page67() {
  return <Client67 />;
}
