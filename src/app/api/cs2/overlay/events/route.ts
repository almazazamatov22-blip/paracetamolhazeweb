import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0',
};

/**
 * GET /api/cs2/overlay/events?streamerId=XXX&since=ISO_TIMESTAMP
 * OBS оверлей polling — возвращает события после указанного времени
 * События включают pending+processing (для отображения в очереди)
 * и недавно done (для анимации выполнения)
 */
export async function GET(req: NextRequest) {
  try {
    const streamerId = req.nextUrl.searchParams.get('streamerId');
    const since = req.nextUrl.searchParams.get('since');

    if (!streamerId) {
      return NextResponse.json({ events: [] }, { headers: NO_CACHE_HEADERS });
    }

    const supabase = getSupabase();

    // Время отсечки — 30 секунд назад (чтобы показать недавние события)
    const cutoff = since
      ? new Date(since).toISOString()
      : new Date(Date.now() - 30_000).toISOString();

    const { data: events, error } = await supabase
      .from('cs2_reward_queue')
      .select('id, user_name, user_avatar, action_type, reward_name, status, created_at, executed_at')
      .eq('streamer_id', streamerId)
      .gte('created_at', cutoff)
      .order('created_at', { ascending: true })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ events: events ?? [], serverTime: new Date().toISOString() }, {
      headers: NO_CACHE_HEADERS,
    });
  } catch (err: any) {
    console.error('[cs2/overlay/events]', err);
    return NextResponse.json({ events: [], error: err.message }, {
      status: 500,
      headers: NO_CACHE_HEADERS,
    });
  }
}
