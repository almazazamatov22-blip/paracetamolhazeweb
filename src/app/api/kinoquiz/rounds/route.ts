import { NextResponse } from 'next/server';
import { kinoquizAdmin, KINOQUIZ_TABLE } from '@/lib/kinoquizSupabase';
import { supabase } from '@/lib/supabase';

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

interface KinokadrRow {
  id: string;
  title: string | null;
  title_ru: string | null;
  image_url: string | null;
  type: 'movie' | 'series' | null;
  year: number | null;
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function fallbackDifficultyByIndex(index: number): Difficulty {
  if (index % 3 === 0) return 'easy';
  if (index % 3 === 1) return 'medium';
  return 'hard';
}

function normalizeMediaType(type: string | null | undefined): MediaType {
  if (type === 'series') return 'series';
  return 'movie';
}

function toQuestionRow(row: KinokadrRow, index: number, forceType?: MediaType): DbQuestion | null {
  const titleRu = (row.title_ru || '').trim();
  const titleEn = (row.title || '').trim();
  const imageUrl = (row.image_url || '').trim();

  if (!imageUrl || (!titleRu && !titleEn)) return null;

  const idDigits = (row.id || '').replace(/\D+/g, '');
  const tmdbId = Number.parseInt(idDigits || `${100000 + index}`, 10);
  const mediaType = forceType || normalizeMediaType(row.type);

  return {
    id: 100000 + index,
    tmdb_id: Number.isFinite(tmdbId) ? tmdbId : 100000 + index,
    media_type: mediaType,
    difficulty: fallbackDifficultyByIndex(index),
    title: titleEn || titleRu,
    title_ru: titleRu || titleEn,
    original_title: titleEn || titleRu,
    image_url: imageUrl,
    year: row.year ?? null
  };
}

async function loadByDifficulty(type: MediaType, difficulty: Difficulty, take: number) {
  const { data, error } = await kinoquizAdmin
    .from(KINOQUIZ_TABLE)
    .select('id,tmdb_id,media_type,difficulty,title,title_ru,original_title,image_url,year')
    .eq('media_type', type)
    .eq('difficulty', difficulty)
    .limit(180);

  if (!error) {
    return shuffle((data || []) as DbQuestion[]).slice(0, take);
  }

  // Fallback when custom schema is not exposed by PostgREST.
  const { data: publicData, error: publicError } = await supabase
    .from('kinoquiz_questions')
    .select('id,tmdb_id,media_type,difficulty,title,title_ru,original_title,image_url,year')
    .eq('media_type', type)
    .eq('difficulty', difficulty)
    .limit(180);

  if (publicError) {
    throw new Error(`[kinoquiz][${type}/${difficulty}] ${error.message}; [kinoquiz_questions] ${publicError.message}`);
  }

  return shuffle((publicData || []) as DbQuestion[]).slice(0, take);
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

async function loadKinokadrFallback(type: MediaType, count: number) {
  let query = supabase
    .from('kinokadr_movies')
    .select('id,title,title_ru,image_url,type,year')
    .eq('is_textless', true)
    .not('image_url', 'is', null)
    .limit(600);

  if (type === 'movie' || type === 'series') {
    query = query.eq('type', type);
  } else {
    // We do not have dedicated anime table. Use series rows as best available fallback.
    query = query.eq('type', 'series');
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`[kinoquiz][fallback/${type}] ${error.message}`);
  }

  const mapped = (data || [])
    .map((row, index) => toQuestionRow(row as KinokadrRow, index, type))
    .filter(Boolean) as DbQuestion[];

  return shuffle(mapped).slice(0, count);
}

async function loadPrimaryRows(isCombo: boolean, requestedType: string) {
  if (isCombo) {
    const perType = 10;
    const [movies, series, anime] = await Promise.all([
      loadForType('movie', perType),
      loadForType('series', perType),
      loadForType('anime', perType)
    ]);
    return shuffle([...movies, ...series, ...anime]);
  }

  const type: MediaType = ['movie', 'series', 'anime'].includes(requestedType)
    ? (requestedType as MediaType)
    : 'movie';
  const [easy, medium, hard] = await Promise.all([
    loadByDifficulty(type, 'easy', 10),
    loadByDifficulty(type, 'medium', 10),
    loadByDifficulty(type, 'hard', 10)
  ]);
  return [...easy, ...medium, ...hard];
}

async function loadFallbackRows(isCombo: boolean, requestedType: string) {
  if (isCombo) {
    const perType = 10;
    const [movies, series, anime] = await Promise.all([
      loadKinokadrFallback('movie', perType),
      loadKinokadrFallback('series', perType),
      loadKinokadrFallback('anime', perType)
    ]);
    return shuffle([...movies, ...series, ...anime]);
  }

  const type: MediaType = ['movie', 'series', 'anime'].includes(requestedType)
    ? (requestedType as MediaType)
    : 'movie';
  return loadKinokadrFallback(type, 30);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get('type') || 'movie';
  const isCombo = requestedType === 'combo';

  let rows: DbQuestion[] = [];
  let primaryError: string | null = null;

  try {
    rows = await loadPrimaryRows(isCombo, requestedType);
  } catch (error: any) {
    primaryError = error?.message || 'Primary kinoquiz dataset unavailable';
  }

  if (!rows.length) {
    try {
      rows = await loadFallbackRows(isCombo, requestedType);
    } catch (fallbackError: any) {
      const fallbackMessage = fallbackError?.message || 'Fallback dataset unavailable';
      const message = primaryError ? `${primaryError}; ${fallbackMessage}` : fallbackMessage;
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  if (!rows.length) {
    return NextResponse.json(
      { error: 'KinoQuiz dataset is empty in both primary and fallback sources.' },
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

  return NextResponse.json({
    movies,
    source: primaryError ? 'fallback' : 'primary',
    warning: primaryError || undefined
  });
}
