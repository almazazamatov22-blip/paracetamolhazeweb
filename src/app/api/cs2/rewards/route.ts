import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';

function getSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();
  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

async function getStreamerId(token: string): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId! },
  });
  const data = await res.json();
  return data.data?.[0]?.id ?? null;
}

// GET — список наград стримера
export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const streamerId = await getStreamerId(token);
    if (!streamerId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cs2_rewards')
      .select('*')
      .eq('streamer_id', streamerId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return NextResponse.json({ rewards: data ?? [] });
  } catch (err: any) {
    console.error('[cs2/rewards GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — создать награду
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const streamerId = await getStreamerId(token);
    if (!streamerId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    const body = await req.json();
    const { name, description, action_type, cost, cooldown_seconds, enabled } = body;

    if (!name || !action_type) {
      return NextResponse.json({ error: 'name and action_type required' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cs2_rewards')
      .insert({
        streamer_id: streamerId,
        name,
        description: description ?? '',
        action_type,
        cost: cost ?? 100,
        cooldown_seconds: cooldown_seconds ?? 30,
        enabled: enabled ?? true,
        twitch_reward_id: body.twitch_reward_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ reward: data });
  } catch (err: any) {
    console.error('[cs2/rewards POST]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT — обновить награду
export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const streamerId = await getStreamerId(token);
    if (!streamerId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    const body = await req.json();
    const { id, ...fields } = body;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = getSupabase();
    // Verify ownership
    const { data: existing } = await supabase
      .from('cs2_rewards')
      .select('id')
      .eq('id', id)
      .eq('streamer_id', streamerId)
      .single();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowedFields = ['name', 'description', 'action_type', 'cost', 'cooldown_seconds', 'enabled', 'twitch_reward_id'];
    const update: Record<string, any> = {};
    for (const f of allowedFields) {
      if (f in fields) update[f] = fields[f];
    }

    const { data, error } = await supabase
      .from('cs2_rewards')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ reward: data });
  } catch (err: any) {
    console.error('[cs2/rewards PUT]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE — удалить награду
export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const streamerId = await getStreamerId(token);
    if (!streamerId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase
      .from('cs2_rewards')
      .delete()
      .eq('id', id)
      .eq('streamer_id', streamerId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[cs2/rewards DELETE]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
