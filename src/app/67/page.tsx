import { Metadata, ResolvingMetadata } from 'next';
import Client67 from './Client67';

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
    ? `https://paracetamolhaze.vercel.app/api/og/record?game=67&score=${score}&user=${encodeURIComponent(user)}`
    : 'https://paracetamolhaze.vercel.app/67_og.png'; 

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [ogImage],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  };
}

export default function Page67() {
  return <Client67 />;
}
