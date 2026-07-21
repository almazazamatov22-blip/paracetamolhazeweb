import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServerKey } from '@/lib/supabase-env';
import { toLocalKinoImageUrl } from '@/lib/kino-local-images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchRandomSample(supabase: any, type: 'movie' | 'series', seenIds: string[], maxItems: number) {
  const countQuery = supabase
    .from('kinokadr_movies')
    .select('*', { count: 'exact', head: true })
    .eq('is_textless', true)
    .eq('type', type);

  const { count, error: countError } = await countQuery;
  if (countError) throw countError;
  if (!count) return [];

  const maxOffset = Math.max(0, count - 200);
  const offset = Math.floor(Math.random() * (maxOffset + 1));

  const query = supabase
    .from('kinokadr_movies')
    .select('id, title, title_ru, image_url, type, category, year')
    .eq('is_textless', true)
    .eq('type', type);

  const { data, error } = await query.range(offset, offset + 199);
  if (error) throw error;
  if (!data) return [];

  let pool = data.filter((m: any) => !seenIds.includes(String(m.id)));
  if (pool.length < 10 && data.length >= 10) {
    pool = data;
  }

  const mapped = [];
  for (const item of pool) {
    const localUrl = toLocalKinoImageUrl(item.image_url);
    if (!localUrl || !localUrl.startsWith('/kino-images/')) {
      console.warn(`[Kinokadr API] Invalid local image URL for ID ${item.id}: ${localUrl}`);
      continue;
    }
    mapped.push({ ...item, image_url: localUrl });
  }

  const shuffled = mapped.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, maxItems);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'combo';
    
    if (!['movie', 'series', 'combo'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    let seenIds: string[] = [];
    const seenIdsParam = searchParams.get('seenIds');
    if (seenIdsParam) {
      try {
        const parsed = JSON.parse(seenIdsParam);
        if (Array.isArray(parsed)) {
          seenIds = parsed.map(String).slice(-200);
        }
      } catch {
        seenIds = seenIdsParam.split(',').slice(0, 200);
      }
    }

    const supabaseUrl = getSupabaseUrl();
    const serverKey = getSupabaseServerKey();

    if (!supabaseUrl || !serverKey) {
      console.error('[Kinokadr API] Supabase configuration missing');
      return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serverKey);

    let moviesList: any[] = [];
    let seriesList: any[] = [];

    if (mode === 'movie') {
      moviesList = await fetchRandomSample(supabase, 'movie', seenIds, 30);
    } else if (mode === 'series') {
      seriesList = await fetchRandomSample(supabase, 'series', seenIds, 30);
    } else if (mode === 'combo') {
      const mList = await fetchRandomSample(supabase, 'movie', seenIds, 30);
      const sList = await fetchRandomSample(supabase, 'series', seenIds, 30);
      
      let mCount = Math.min(15, mList.length);
      let sCount = Math.min(15, sList.length);
      
      if (mCount < 15) {
        sCount = Math.min(sList.length, 30 - mCount);
      } else if (sCount < 15) {
        mCount = Math.min(mList.length, 30 - sCount);
      }
      
      moviesList = mList.slice(0, mCount);
      seriesList = sList.slice(0, sCount);
    }

    const combined = [...moviesList, ...seriesList];
    combined.sort(() => Math.random() - 0.5);
    
    const uniqueIds = new Set();
    const finalResult = [];
    for (const item of combined) {
      if (!uniqueIds.has(item.id)) {
        uniqueIds.add(item.id);
        finalResult.push(item);
      }
    }

    if (finalResult.length === 0) {
      console.error('[Kinokadr API] Dataset is empty or all filtered out');
      return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 404 });
    }

    const composition = {
      movies: finalResult.filter(x => x.type === 'movie').length,
      series: finalResult.filter(x => x.type === 'series').length
    };

    return NextResponse.json({
      movies: finalResult,
      source: 'supabase',
      composition
    });

  } catch (err: any) {
    console.error('[Kinokadr API] Internal error:', err);
    return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 500 });
  }
}
