import { Metadata, ResolvingMetadata } from 'next';
import KinokadrClient from './KinokadrClient';

// Server-side metadata generation for rich social previews
export async function generateMetadata(
  { searchParams }: { searchParams: { score?: string, user?: string } },
  parent: ResolvingMetadata
): Promise<Metadata> {
  const score = searchParams.score || '0';
  const user = searchParams.user || 'Игрок';
  
  const title = score !== '0' 
    ? `Я набрал ${score} в УГАДАЙ КАДР! А сколько сможешь ты?` 
    : 'УГАДАЙ КАДР • Киноигра на ParacetamolHAZE';
    
  const description = 'Угадывай фильмы и сериалы по кадрам в захватывающей игре от ParacetamolHAZE! 10 раундов, хитрые вопросы и мировой рейтинг.';
  
  // Dynamic OG image generated based on score and user info
  const ogImage = score !== '0' 
    ? `https://paracetamolhaze.vercel.app/api/og/record?game=kinokadr&score=${score}&user=${encodeURIComponent(user)}`
    : 'https://paracetamolhaze.vercel.app/kinokadr_og.png'; 

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

export default function KinokadrPage() {
  return <KinokadrClient />;
}
