import { Metadata } from 'next';
import KinokadrClient from './KinokadrClient';
import { generateBaseMetadata } from '@/lib/seo';

type MetadataSearchParams = Promise<{
  score?: string | string[];
  user?: string | string[];
}>;

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Server-side metadata generation for rich social previews
export async function generateMetadata({
  searchParams,
}: {
  searchParams: MetadataSearchParams;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const score = firstParam(resolvedSearchParams.score) || '0';
  const user = firstParam(resolvedSearchParams.user) || 'Игрок';
  
  const title = score !== '0' 
    ? `Я набрал ${score} очков в КиноКадре!` 
    : 'КиноКадр — угадай фильм по кадру';
    
  const description = 'Угадывай фильмы и сериалы по кадрам в захватывающей игре от ParacetamolHAZE! 10 раундов, хитрые вопросы и мировой рейтинг.';
  
  // Dynamic OG image generated based on score and user info
  const ogImage = score !== '0' 
    ? `https://paracetamolhaze.ru/api/og/record?game=kinokadr&score=${score}&user=${encodeURIComponent(user)}`
    : 'https://paracetamolhaze.ru/kinokadr_og.png';

  return generateBaseMetadata({
    title,
    description,
    path: "/kinokadr",
    ogImage,
    noindex: score !== '0'
  });
}

export default function KinokadrPage() {
  return <KinokadrClient />;
}
