import { Metadata } from 'next';
import Client67 from './Client67';
import { generateBaseMetadata } from '@/lib/seo';

type MetadataSearchParams = Promise<{
  score?: string | string[];
  user?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: MetadataSearchParams;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const score = firstParam(resolvedSearchParams.score) || '0';
  const user = firstParam(resolvedSearchParams.user) || 'Игрок';
  
  const title = score !== '0' 
    ? `Я выжал ${score} в 67! А сколько сможешь ты?` 
    : '67 — проверка скорости реакции';
    
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
