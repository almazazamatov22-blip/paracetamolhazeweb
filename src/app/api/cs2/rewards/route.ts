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

const ACTION_DESCRIPTIONS: Record<string, string> = {
  drop_weapon: 'Выбрасывает активное оружие в руках.',
  freeze_3: 'Замораживает на 3 секунды.',
  freeze_5: 'Замораживает на 5 секунд.',
  spin_180: 'Мгновенный разворот на 180 градусов.',
  block_jump: 'Блокирует прыжок на 30 секунд.',
  block_crouch: 'Блокирует приседание на 30 секунд.',
  play_sound: 'Проигрывает звук на стриме.',
  mouse_shake: 'Трясет прицел 5 секунд.',
  flash_screen: 'Белая вспышка на экране стрима.',
  random_weapon_switch: 'Случайное переключение оружия.',
  invert_mouse: 'Инверсия мыши на 10 секунд.',
  low_sens_10: 'Очень низкая чувствительность на 10 секунд.',
  high_sens_10: 'Очень высокая чувствительность на 10 секунд.',
};

// POST — создать награду
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const streamerId = await getStreamerId(token);
    if (!streamerId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    const body = await req.json();
    const { name, action_type, cost, cooldown_seconds } = body;

    if (!name || !action_type || !cost) {
      return NextResponse.json({ error: 'name, action_type, cost required' }, { status: 400 });
    }

    const desc = ACTION_DESCRIPTIONS[action_type] || '';
    const prompt = `${desc}\n\nby paracetamolhaze.ru`;
    const cd = Number(cooldown_seconds) || 0;

    // Create on Twitch
    const clientId = process.env.TWITCH_CLIENT_ID;
    const twitchRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: name,
        cost: Number(cost),
        prompt: prompt,
        is_enabled: true,
        background_color: '#6366f1',
        is_global_cooldown_enabled: cd > 0,
        global_cooldown_seconds: cd > 0 ? cd : undefined
      })
    });

    const twitchData = await twitchRes.json();
    if (!twitchRes.ok) {
      console.error('Twitch Create Reward Error:', twitchData);
      return NextResponse.json({ error: twitchData.message || 'Twitch API Error' }, { status: twitchRes.status });
    }

    const twitchRewardId = twitchData.data[0].id;

    // Save in Supabase
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cs2_rewards')
      .insert({
        streamer_id: streamerId,
        name,
        description: prompt,
        action_type,
        cost: Number(cost),
        cooldown_seconds: cd,
        enabled: true,
        twitch_reward_id: twitchRewardId,
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
    // Get twitch_reward_id before deleting
    const { data: reward } = await supabase
      .from('cs2_rewards')
      .select('twitch_reward_id')
      .eq('id', id)
      .eq('streamer_id', streamerId)
      .single();

    if (reward?.twitch_reward_id) {
      // Try to delete from Twitch
      const clientId = process.env.TWITCH_CLIENT_ID;
      await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}&id=${reward.twitch_reward_id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': clientId!
        }
      }).catch(e => console.error('Failed to delete on twitch:', e));
    }

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
