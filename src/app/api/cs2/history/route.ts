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

/**
 * GET /api/cs2/history?streamerId=XXX&limit=50&page=0
 */
export async function GET(req: NextRequest) {
  try {
    const streamerId = req.nextUrl.searchParams.get('streamerId');
    const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '50'), 200);
    const page = parseInt(req.nextUrl.searchParams.get('page') ?? '0');

    if (!streamerId) {
      return NextResponse.json({ error: 'streamerId required' }, { status: 400 });
    }

    const supabase = getSupabase();

    const { data, error, count } = await supabase
      .from('cs2_history')
      .select('*', { count: 'exact' })
      .eq('streamer_id', streamerId)
      .order('executed_at', { ascending: false })
      .range(page * limit, (page + 1) * limit - 1);

    if (error) throw error;

    return NextResponse.json({
      history: data ?? [],
      total: count ?? 0,
      page,
      limit,
    }, {
      headers: { 'Cache-Control': 'no-store, no-cache' },
    });
  } catch (err: any) {
    console.error('[cs2/history]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
