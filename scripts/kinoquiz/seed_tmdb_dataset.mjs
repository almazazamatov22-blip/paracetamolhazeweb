import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const TMDB_TOKEN =
  process.env.TMDB_API_READ_ACCESS_TOKEN ||
  process.env.TMDB_API_TOKEN ||
  process.env.TMDB_BEARER_TOKEN;

const TARGET_PER_TYPE = Number(process.env.KINOQUIZ_TARGET_PER_TYPE || 360);
const MAX_PAGES = Number(process.env.KINOQUIZ_MAX_PAGES || 40);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing Supabase env vars. Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
  );
}

if (!TMDB_TOKEN) {
  throw new Error('Missing TMDB token env var. Set TMDB_API_READ_ACCESS_TOKEN.');
}

const KINOQUIZ_TABLE = 'questions';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  db: { schema: 'kinoquiz' },
  auth: { persistSession: false }
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const parseYear = value => {
  if (!value || typeof value !== 'string') return null;
  const [year] = value.split('-');
  const parsed = Number(year);
  return Number.isFinite(parsed) ? parsed : null;
};

async function tmdbRequest(path, params) {
  const url = new URL(`https://api.themoviedb.org/3${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${TMDB_TOKEN}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TMDB ${response.status} for ${path}: ${body.slice(0, 180)}`);
  }

  return response.json();
}

function difficultyByRank(index, total) {
  const easyCut = Math.floor(total * 0.34);
  const mediumCut = Math.floor(total * 0.67);
  if (index < easyCut) return 'easy';
  if (index < mediumCut) return 'medium';
  return 'hard';
}

function normalizeTitle(item, mode) {
  if (mode === 'movie') {
    return {
      title: item.title || item.original_title || '',
      titleRu: item.title || item.original_title || '',
      originalTitle: item.original_title || item.title || '',
      year: parseYear(item.release_date)
    };
  }

  return {
    title: item.name || item.original_name || '',
    titleRu: item.name || item.original_name || '',
    originalTitle: item.original_name || item.name || '',
    year: parseYear(item.first_air_date)
  };
}

async function collectCategory({
  mode,
  endpoint,
  baseParams,
  target = TARGET_PER_TYPE,
  maxPages = MAX_PAGES
}) {
  const registry = new Map();

  for (let page = 1; page <= maxPages; page += 1) {
    const data = await tmdbRequest(endpoint, {
      language: 'ru-RU',
      include_adult: false,
      sort_by: 'popularity.desc',
      page,
      ...baseParams
    });

    const results = Array.isArray(data?.results) ? data.results : [];
    for (const item of results) {
      if (!item?.id || !item?.backdrop_path) continue;
      if (registry.has(item.id)) continue;

      const { title, titleRu, originalTitle, year } = normalizeTitle(item, mode);
      if (!title && !originalTitle) continue;

      registry.set(item.id, {
        tmdb_id: Number(item.id),
        media_type: mode,
        difficulty: 'medium',
        title: title || originalTitle,
        title_ru: titleRu || title || originalTitle,
        original_title: originalTitle || title,
        year,
        image_url: `https://image.tmdb.org/t/p/w1280${item.backdrop_path}`,
        backdrop_path: item.backdrop_path || null,
        poster_path: item.poster_path || null,
        popularity: item.popularity ?? null,
        vote_average: item.vote_average ?? null,
        vote_count: item.vote_count ?? null
      });
    }

    if (registry.size >= target * 1.25) break;
    await wait(120);
  }

  const sorted = [...registry.values()].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  const limited = sorted.slice(0, target);

  return limited.map((row, index) => ({
    ...row,
    difficulty: difficultyByRank(index, limited.length)
  }));
}

async function replaceRowsForType(type, rows) {
  const table = supabase.from(KINOQUIZ_TABLE);
  const { error: removeError } = await table.delete().eq('media_type', type);
  if (removeError) throw new Error(`[${type}] delete failed: ${removeError.message}`);

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(KINOQUIZ_TABLE).insert(batch);
    if (error) throw new Error(`[${type}] insert failed: ${error.message}`);
  }
}

async function main() {
  console.log(`Seeding KinoQuiz dataset. target=${TARGET_PER_TYPE}, maxPages=${MAX_PAGES}`);

  const movieRows = await collectCategory({
    mode: 'movie',
    endpoint: '/discover/movie',
    baseParams: {
      with_original_language: 'en',
      'vote_count.gte': 100
    }
  });
  console.log(`Movies prepared: ${movieRows.length}`);

  const seriesRows = await collectCategory({
    mode: 'series',
    endpoint: '/discover/tv',
    baseParams: {
      without_genres: 16,
      'vote_count.gte': 80
    }
  });
  console.log(`Series prepared: ${seriesRows.length}`);

  const animeRows = await collectCategory({
    mode: 'anime',
    endpoint: '/discover/tv',
    baseParams: {
      with_genres: 16,
      with_origin_country: 'JP',
      'vote_count.gte': 50
    },
    maxPages: Math.max(MAX_PAGES, 60)
  });
  console.log(`Anime prepared: ${animeRows.length}`);

  if (movieRows.length < 300 || seriesRows.length < 300 || animeRows.length < 300) {
    throw new Error(
      `Not enough data collected. movie=${movieRows.length}, series=${seriesRows.length}, anime=${animeRows.length}. Increase MAX_PAGES.`
    );
  }

  await replaceRowsForType('movie', movieRows);
  await replaceRowsForType('series', seriesRows);
  await replaceRowsForType('anime', animeRows);

  const { count, error } = await supabase.from(KINOQUIZ_TABLE).select('*', { count: 'exact', head: true });
  if (error) throw error;

  console.log(`Done. Total kinoquiz.questions rows: ${count || 0}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
