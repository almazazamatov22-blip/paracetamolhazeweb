/**
 * KinoQuiz — TMDB Stills Seed
 *
 * Для каждого фильма/сериала/аниме загружает кадры (stills) вместо постеров.
 * Для фильмов: /movie/{id}/images → backdrops (wide cinematic frames)
 * Для TV: /tv/{id}/images → backdrops (episode stills when available)
 *
 * Запуск:
 *   node --env-file=.env.local scripts/kinoquiz/seed_tmdb_stills.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const TMDB_TOKEN =
  process.env.TMDB_API_READ_ACCESS_TOKEN ||
  process.env.TMDB_API_TOKEN ||
  process.env.TMDB_BEARER_TOKEN;
const TMDB_API_KEY = process.env.TMDB_API_KEY_V3 || process.env.TMDB_API_KEY;
// Use v3 key or Bearer token
const USE_API_KEY = !TMDB_TOKEN && !!TMDB_API_KEY;

const TARGET_PER_TYPE = Number(process.env.KINOQUIZ_TARGET_PER_TYPE || 360);
const MAX_PAGES = Number(process.env.KINOQUIZ_MAX_PAGES || 40);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars.');
}
if (!TMDB_TOKEN && !TMDB_API_KEY) {
  throw new Error('Missing TMDB token. Set TMDB_API_READ_ACCESS_TOKEN or TMDB_API_KEY_V3.');
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
  // Support both Bearer token (v4 read access) and v3 api_key
  if (USE_API_KEY) url.searchParams.set('api_key', TMDB_API_KEY);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });
  const headers = { Accept: 'application/json' };
  if (!USE_API_KEY) headers['Authorization'] = `Bearer ${TMDB_TOKEN}`;
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMDB ${res.status} for ${path}: ${body.slice(0, 180)}`);
  }
  return res.json();
}

/**
 * Получить лучший стилл (кадр) для фильма или TV-шоу.
 * Возвращает URL строку или null если кадров нет.
 */
async function fetchBestStill(tmdbId, isMovie) {
  try {
    const endpoint = isMovie ? `/movie/${tmdbId}/images` : `/tv/${tmdbId}/images`;
    const data = await tmdbRequest(endpoint, {});
    // backdrops — широкоформатные кадры сцен (16:9), идеальны для квиза
    const backdrops = data?.backdrops;
    if (!Array.isArray(backdrops) || backdrops.length === 0) return null;
    // сортируем по vote_average + vote_count, берём топ
    const sorted = backdrops
      .filter(b => b.file_path)
      .sort((a, b) => {
        const scoreA = (a.vote_average || 0) * Math.log1p(a.vote_count || 1);
        const scoreB = (b.vote_average || 0) * Math.log1p(b.vote_count || 1);
        return scoreB - scoreA;
      });
    if (sorted.length === 0) return null;
    // Случайный из топ-3 чтобы не было одного и того же кадра
    const pick = sorted[Math.floor(Math.random() * Math.min(3, sorted.length))];
    return `https://image.tmdb.org/t/p/w1280${pick.file_path}`;
  } catch {
    return null;
  }
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

async function collectCategory({ mode, endpoint, baseParams, target = TARGET_PER_TYPE, maxPages = MAX_PAGES }) {
  const registry = new Map();

  for (let page = 1; page <= maxPages; page++) {
    const data = await tmdbRequest(endpoint, {
      language: 'ru-RU',
      include_adult: false,
      sort_by: 'popularity.desc',
      page,
      ...baseParams
    });

    const results = Array.isArray(data?.results) ? data.results : [];
    for (const item of results) {
      if (!item?.id) continue;
      if (registry.has(item.id)) continue;

      const { title, titleRu, originalTitle, year } = normalizeTitle(item, mode);
      if (!title && !originalTitle) continue;

      registry.set(item.id, {
        tmdb_id: Number(item.id),
        media_type: mode,
        title: title || originalTitle,
        title_ru: titleRu || title || originalTitle,
        original_title: originalTitle || title,
        year,
        backdrop_path: item.backdrop_path || null,
        poster_path: item.poster_path || null,
        popularity: item.popularity ?? null,
        vote_average: item.vote_average ?? null,
        vote_count: item.vote_count ?? null
      });
    }

    if (registry.size >= target * 1.5) break;
    await wait(120);
  }

  const sorted = [...registry.values()].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
  return sorted.slice(0, Math.ceil(target * 1.15)); // берём чуть больше — часть отсеется без stills
}

async function enrichWithStills(rows, isMovie) {
  const enriched = [];
  let fetched = 0;
  let skipped = 0;

  for (const row of rows) {
    const stillUrl = await fetchBestStill(row.tmdb_id, isMovie);
    await wait(60); // rate limit TMDB: ~40 req/s

    if (!stillUrl) {
      // Фоллбэк на backdrop_path из discover если нет стиллов
      if (row.backdrop_path) {
        enriched.push({ ...row, image_url: `https://image.tmdb.org/t/p/w1280${row.backdrop_path}` });
        fetched++;
      } else {
        skipped++;
      }
      continue;
    }

    enriched.push({ ...row, image_url: stillUrl });
    fetched++;

    if (fetched % 50 === 0) {
      console.log(`  [${row.media_type}] enriched ${fetched}/${rows.length}, skipped ${skipped}...`);
    }
  }

  console.log(`  [${rows[0]?.media_type}] stills done: ${fetched} ok, ${skipped} skipped (no image)`);
  return enriched;
}

async function replaceRowsForType(type, rows) {
  const { error: removeError } = await supabase.from(KINOQUIZ_TABLE).delete().eq('media_type', type);
  if (removeError) throw new Error(`[${type}] delete failed: ${removeError.message}`);

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize).map((row, idx) => ({
      ...row,
      difficulty: difficultyByRank(i + idx, rows.length)
    }));
    const { error } = await supabase.from(KINOQUIZ_TABLE).insert(batch);
    if (error) throw new Error(`[${type}] insert failed: ${error.message}`);
  }
}

async function main() {
  console.log(`KinoQuiz Stills Seed — target=${TARGET_PER_TYPE} per type, maxPages=${MAX_PAGES}`);

  // ── MOVIES ──────────────────────────────────────────────────────────────────
  console.log('\n[1/3] Collecting movies from TMDB discover...');
  const movieCandidates = await collectCategory({
    mode: 'movie',
    endpoint: '/discover/movie',
    baseParams: { with_original_language: 'en', 'vote_count.gte': 200 }
  });
  console.log(`  candidates: ${movieCandidates.length}`);
  console.log('  Fetching movie stills...');
  const movieRows = (await enrichWithStills(movieCandidates, true)).slice(0, TARGET_PER_TYPE);
  console.log(`  Final movies: ${movieRows.length}`);

  // ── SERIES ──────────────────────────────────────────────────────────────────
  console.log('\n[2/3] Collecting series from TMDB discover...');
  const seriesCandidates = await collectCategory({
    mode: 'series',
    endpoint: '/discover/tv',
    baseParams: { without_genres: 16, 'vote_count.gte': 80 }
  });
  console.log(`  candidates: ${seriesCandidates.length}`);
  console.log('  Fetching series stills...');
  const seriesRows = (await enrichWithStills(seriesCandidates, false)).slice(0, TARGET_PER_TYPE);
  console.log(`  Final series: ${seriesRows.length}`);

  // ── ANIME ───────────────────────────────────────────────────────────────────
  console.log('\n[3/3] Collecting anime from TMDB discover...');
  const animeCandidates = await collectCategory({
    mode: 'anime',
    endpoint: '/discover/tv',
    baseParams: { with_genres: 16, with_origin_country: 'JP', 'vote_count.gte': 50 },
    maxPages: Math.max(MAX_PAGES, 60)
  });
  console.log(`  candidates: ${animeCandidates.length}`);
  console.log('  Fetching anime stills...');
  const animeRows = (await enrichWithStills(animeCandidates, false)).slice(0, TARGET_PER_TYPE);
  console.log(`  Final anime: ${animeRows.length}`);

  // ── VALIDATION ──────────────────────────────────────────────────────────────
  if (movieRows.length < 200 || seriesRows.length < 200 || animeRows.length < 200) {
    throw new Error(
      `Not enough data. movie=${movieRows.length}, series=${seriesRows.length}, anime=${animeRows.length}. Increase MAX_PAGES.`
    );
  }

  // ── UPLOAD ──────────────────────────────────────────────────────────────────
  console.log('\nUploading to Supabase...');
  await replaceRowsForType('movie', movieRows);
  console.log(`  movies uploaded: ${movieRows.length}`);
  await replaceRowsForType('series', seriesRows);
  console.log(`  series uploaded: ${seriesRows.length}`);
  await replaceRowsForType('anime', animeRows);
  console.log(`  anime uploaded: ${animeRows.length}`);

  const { count } = await supabase.from(KINOQUIZ_TABLE).select('*', { count: 'exact', head: true });
  console.log(`\nDone! Total kinoquiz.questions: ${count || 0}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
