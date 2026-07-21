import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServerKey } from '@/lib/supabase-env';
import { toLocalKinoImageUrl } from '@/lib/kino-local-images';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // 1. Get exact count
    let countQuery = supabase
      .from('kinokadr_movies')
      .select('*', { count: 'exact', head: true })
      .eq('is_textless', true);

    if (mode === 'movie') countQuery = countQuery.eq('type', 'movie');
    else if (mode === 'series') countQuery = countQuery.eq('type', 'series');

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('[Kinokadr API] Count error:', countError);
      return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 500 });
    }

    if (count === null || count === 0) {
      console.error('[Kinokadr API] Dataset is empty');
      return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 404 });
    }

    // 2. Select random offset
    // We want a random window of up to 200 items. 
    // If count <= 200, offset is 0. If count > 200, max offset is count - 200.
    const maxOffset = Math.max(0, count - 200);
    const offset = Math.floor(Math.random() * (maxOffset + 1));

    // 3. Fetch the window
    let query = supabase
      .from('kinokadr_movies')
      .select('id, title, title_ru, image_url, type, category, year')
      .eq('is_textless', true);

    if (mode === 'movie') query = query.eq('type', 'movie');
    else if (mode === 'series') query = query.eq('type', 'series');

    const { data, error } = await query.range(offset, offset + 199);

    if (error) {
      console.error('[Kinokadr API] Fetch error:', error);
      return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 500 });
    }

    if (!data || data.length === 0) {
      console.error('[Kinokadr API] No data returned from range');
      return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 404 });
    }

    let pool = data.filter(m => !seenIds.includes(String(m.id)));
    if (pool.length < 10) {
      pool = data;
    }

    const targetRounds = Math.min(30, Math.max(1, pool.length));
    const shuffled = pool.sort(() => Math.random() - 0.5).slice(0, targetRounds);

    const movies = shuffled.map(m => ({
      ...m,
      image_url: toLocalKinoImageUrl(m.image_url)
    }));

    return NextResponse.json({
      movies,
      source: 'supabase'
    });

  } catch (err: any) {
    console.error('[Kinokadr API] Internal error:', err);
    return NextResponse.json({ error: 'Не удалось загрузить базу Kinokadr' }, { status: 500 });
  }
}
