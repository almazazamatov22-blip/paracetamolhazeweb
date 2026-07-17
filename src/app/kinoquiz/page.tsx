import KinoQuizClient from './KinoQuizClient';

import { generateBaseMetadata } from '@/lib/seo';

export const metadata = generateBaseMetadata({
  title: 'КиноКвиз - Интерактив со зрителями',
  description: 'Угадывай фильмы, сериалы и аниме вместе со зрителями Твича в реальном времени.',
  path: "/kinoquiz"
});

export default function KinoQuizPage() {
  return <KinoQuizClient />;
}
