import { NextResponse } from 'next/server';
import { kinoquizAdmin, KINOQUIZ_TABLE } from '@/lib/kinoquizSupabase';

type MediaType = 'movie' | 'series' | 'anime';
type Difficulty = 'easy' | 'medium' | 'hard';

interface DbQuestion {
  id: number;
  tmdb_id: number;
  media_type: MediaType;
  difficulty: Difficulty;
  title: string;
  title_ru: string;
  original_title: string;
  image_url: string;
  year: number | null;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

async function loadByDifficulty(type: MediaType, difficulty: Difficulty, take: number) {
  const { data, error } = await kinoquizAdmin
    .from(KINOQUIZ_TABLE)
    .select('id,tmdb_id,media_type,difficulty,title,title_ru,original_title,image_url,year')
    .eq('media_type', type)
    .eq('difficulty', difficulty)
    .limit(180);

  if (error) {
    throw new Error(`[kinoquiz][${type}/${difficulty}] ${error.message}`);
  }

  return shuffle((data || []) as DbQuestion[]).slice(0, take);
}

async function loadForType(type: MediaType, count: number) {
  const perBucket = Math.ceil(count / 3);
  const [easy, medium, hard] = await Promise.all([
    loadByDifficulty(type, 'easy', perBucket),
    loadByDifficulty(type, 'medium', perBucket),
    loadByDifficulty(type, 'hard', perBucket)
  ]);
  return shuffle([...easy, ...medium, ...hard]).slice(0, count);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get('type') || 'movie';
  const isCombo = requestedType === 'combo';

  try {
    let rows: DbQuestion[];

    if (isCombo) {
      // Для комбо: по 10 вопросов каждого типа (итого 30 — делится на 3)
      const PER_TYPE = 10;
      const [movies, series, anime] = await Promise.all([
        loadForType('movie', PER_TYPE),
        loadForType('series', PER_TYPE),
        loadForType('anime', PER_TYPE)
      ]);
      // Чередуем по типам для разнообразия, затем перемешиваем
      rows = shuffle([...movies, ...series, ...anime]);
    } else {
      const type: MediaType = ['movie', 'series', 'anime'].includes(requestedType)
        ? (requestedType as MediaType)
        : 'movie';
      const [easy, medium, hard] = await Promise.all([
        loadByDifficulty(type, 'easy', 10),
        loadByDifficulty(type, 'medium', 10),
        loadByDifficulty(type, 'hard', 10)
      ]);
      rows = [...easy, ...medium, ...hard];
    }

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'KinoQuiz dataset is empty. Seed `kinoquiz.questions` first.' },
        { status: 503 }
      );
    }

    const movies = rows.map(row => ({
      id: `tmdb-${row.media_type}-${row.tmdb_id}`,
      title: row.original_title || row.title,
      title_ru: row.title_ru || row.title || row.original_title,
      imageUrl: row.image_url,
      type: row.media_type,
      difficulty: row.difficulty,
      year: row.year || undefined
    }));

    return NextResponse.json({ movies });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
