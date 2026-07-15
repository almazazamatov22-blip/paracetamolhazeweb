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

    const rewards = data ?? [];
    let syncWarning = '';
    for (const reward of rewards) {
      const prompt = getRewardPrompt(String(reward.action_type));
      if (reward.description === prompt) continue;

      try {
        await updateTwitchReward(token, streamerId, reward, 'prompt');
        const { error: syncError } = await supabase
          .from('cs2_rewards')
          .update({ description: prompt })
          .eq('id', reward.id)
          .eq('streamer_id', streamerId);
        if (syncError) throw syncError;
        reward.description = prompt;
      } catch (syncError) {
        console.error('[cs2/rewards prompt sync]', syncError);
        syncWarning = syncError instanceof TwitchRewardUpdateError
          && (syncError.status === 403 || syncError.status === 404)
          ? 'Twitch не разрешает менять награду, которая была создана вручную. Удалите её и создайте заново через эту панель.'
          : 'Не все описания удалось обновить на Twitch. Попробуйте открыть панель позже.';
      }
    }

    return NextResponse.json({ rewards, syncWarning: syncWarning || undefined });
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
  play_sound: 'Проигрывает звук хедшота.',
  mouse_shake: 'Трясет прицел 5 секунд.',
  flash_screen: 'флешка.',
  random_weapon_switch: 'Случайное оружия.',
  invert_mouse: 'Инверсия мыши на 10 секунд.',
  low_sens_10: 'Очень низкая чувствительность на 10 секунд.',
  high_sens_10: 'Очень высокая чувствительность на 10 секунд.',
  spinbot: 'СпинБот.',
};

function getRewardPrompt(actionType: string): string {
  const description = ACTION_DESCRIPTIONS[actionType]?.trim();
  return description
    ? `${description}\n\nby paracetamolhaze.ru`
    : 'by paracetamolhaze.ru';
}

class TwitchRewardUpdateError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function updateTwitchReward(
  token: string,
  streamerId: string,
  reward: Record<string, any>,
  scope: 'prompt' | 'full' = 'full'
): Promise<void> {
  if (!reward.twitch_reward_id) return;

  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error('TWITCH_CLIENT_ID missing');

  const twitchBody: Record<string, unknown> = {
    prompt: getRewardPrompt(String(reward.action_type)),
  };
  if (scope === 'full') {
    const cooldownSeconds = Math.max(0, Number(reward.cooldown_seconds) || 0);
    Object.assign(twitchBody, {
      title: String(reward.name),
      cost: Number(reward.cost),
      is_enabled: Boolean(reward.enabled),
      is_global_cooldown_enabled: cooldownSeconds > 0,
    });
    if (cooldownSeconds > 0) {
      twitchBody.global_cooldown_seconds = cooldownSeconds;
    }
  }

  const twitchRes = await fetch(
    `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}&id=${reward.twitch_reward_id}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(twitchBody),
    }
  );

  if (!twitchRes.ok) {
    const twitchData = await twitchRes.json().catch(() => ({}));
    throw new TwitchRewardUpdateError(
      twitchData.message || 'Не удалось обновить награду Twitch',
      twitchRes.status
    );
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
    const { name, action_type, cost, cooldown_seconds } = body;

    if (!name || !action_type || !cost) {
      return NextResponse.json({ error: 'name, action_type, cost required' }, { status: 400 });
    }

    const prompt = getRewardPrompt(action_type);
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
      .select('id, twitch_reward_id, name, action_type, cost, cooldown_seconds, enabled')
      .eq('id', id)
      .eq('streamer_id', streamerId)
      .single();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const allowedFields = ['name', 'action_type', 'cost', 'cooldown_seconds', 'enabled'];
    const update: Record<string, any> = {};
    for (const f of allowedFields) {
      if (f in fields) update[f] = fields[f];
    }

    const merged = { ...existing, ...update };
    const cooldownSeconds = Math.max(0, Number(merged.cooldown_seconds) || 0);
    const prompt = getRewardPrompt(String(merged.action_type));
    update.description = prompt;
    update.cooldown_seconds = cooldownSeconds;

    const { data, error } = await supabase
      .from('cs2_rewards')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    let twitchSyncWarning = '';
    if (data?.twitch_reward_id) {
      try {
        await updateTwitchReward(token, streamerId, data);
      } catch (twitchError) {
        console.error('Twitch Update Reward Error:', twitchError);
        twitchSyncWarning = twitchError instanceof TwitchRewardUpdateError
          && (twitchError.status === 403 || twitchError.status === 404)
          ? 'Изменения сохранены в CS2Haze, но Twitch не разрешает менять награду, созданную вручную. Удалите её и создайте заново через панель.'
          : 'Изменения сохранены в CS2Haze, но синхронизация с Twitch временно недоступна.';
      }
    }

    return NextResponse.json({ reward: data, syncWarning: twitchSyncWarning || undefined });
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
