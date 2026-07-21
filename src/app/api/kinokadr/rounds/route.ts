import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseServerKey } from '@/lib/supabase-env';
import { toLocalKinoImageUrl } from '@/lib/kino-local-images';

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
      return NextResponse.json({ error: 'Supabase configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serverKey);

    let query = supabase
      .from('kinokadr_movies')
      .select('id, title, title_ru, image_url, type, category, year')
      .eq('is_textless', true);

    if (mode === 'movie') query = query.eq('type', 'movie');
    else if (mode === 'series') query = query.eq('type', 'series');

    const { data, error } = await query.limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Kinokadr dataset is empty' }, { status: 404 });
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
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
