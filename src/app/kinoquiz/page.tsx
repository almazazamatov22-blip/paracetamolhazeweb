import KinoQuizClient from './KinoQuizClient';

export const metadata = {
  title: 'КиноКвиз - Интерактив со зрителями',
  description: 'Угадывай фильмы, сериалы и аниме вместе со зрителями Твича в реальном времени.',
};

export default function KinoQuizPage() {
  return <KinoQuizClient />;
}
