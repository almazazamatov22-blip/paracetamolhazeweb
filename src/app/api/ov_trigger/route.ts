import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function emptyResponse() {
  return NextResponse.json({}, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store'
    }
  });
}

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env missing');
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    const requestedType = req.nextUrl.searchParams.get('type');
    if (!userId) return emptyResponse();

    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('overlay_configs')
      .select('assets')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return emptyResponse();

    const rawTrigger = data.assets?.last_trigger;
    let finalTrigger: any = {};
    try {
      finalTrigger = (typeof rawTrigger === 'string' ? JSON.parse(rawTrigger || '{}') : rawTrigger) || {};
    } catch {
      finalTrigger = {};
    }

    if (requestedType && finalTrigger.type && finalTrigger.type !== requestedType) {
      return emptyResponse();
    }

    return NextResponse.json(finalTrigger || {}, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
