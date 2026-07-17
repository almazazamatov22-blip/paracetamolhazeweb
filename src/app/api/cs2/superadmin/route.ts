import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const streamerId = await getStreamerId(token);
    if (!streamerId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    // SUPER ADMIN CHECK
    if (streamerId !== '119989080') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = getSupabase();

    // 1. Fetch all rewards
    const { data: rewardsData, error: rewardsError } = await supabase
      .from('cs2_rewards')
      .select('id, streamer_id, name, action_type, enabled, created_at');
    if (rewardsError) throw rewardsError;
    const rewards = rewardsData ?? [];

    // 2. Fetch history from queue (recent 500)
    const { data: historyData, error: historyError } = await supabase
      .from('cs2_reward_queue')
      .select('id, streamer_id, user_name, user_avatar, reward_name, action_type, status, created_at, started_at, finished_at, error_message')
      .order('created_at', { ascending: false })
      .limit(500);
    if (historyError) throw historyError;
    const history = historyData ?? [];

    // 3. Collect unique streamer IDs
    const uniqueIds = new Set<string>();
    rewards.forEach(r => { if (r.streamer_id) uniqueIds.add(r.streamer_id); });
    history.forEach(h => { if (h.streamer_id) uniqueIds.add(h.streamer_id); });
    const streamerIds = Array.from(uniqueIds);

    // 4. Fetch Twitch info for these streamers
    const clientId = process.env.TWITCH_CLIENT_ID!;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

    // Get an App Access Token
    const appTokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    const appTokenData = await appTokenRes.json();
    const appToken = appTokenData.access_token;

    const twitchUsers: Record<string, any> = {};
    if (appToken && streamerIds.length > 0) {
      // Twitch API allows max 100 IDs per request
      for (let i = 0; i < streamerIds.length; i += 100) {
        const chunk = streamerIds.slice(i, i + 100);
        const queryParams = chunk.map(id => `id=${id}`).join('&');
        const res = await fetch(`https://api.twitch.tv/helix/users?${queryParams}`, {
          headers: {
            'Authorization': `Bearer ${appToken}`,
            'Client-Id': clientId
          }
        });
        if (res.ok) {
          const data = await res.json();
          data.data.forEach((u: any) => {
            twitchUsers[u.id] = {
              login: u.login,
              displayName: u.display_name,
              avatar: u.profile_image_url
            };
          });
        }
      }
    }

    // 5. Aggregate metrics per streamer
    const streamersAgg: Record<string, any> = {};
    streamerIds.forEach(id => {
      streamersAgg[id] = {
        id,
        twitch: twitchUsers[id] || { login: id, displayName: 'Unknown', avatar: '' },
        rewardsCount: 0,
        activationsCount: 0,
        lastActivation: null,
      };
    });

    rewards.forEach(r => {
      if (r.streamer_id && streamersAgg[r.streamer_id]) {
        streamersAgg[r.streamer_id].rewardsCount++;
      }
    });

    history.forEach(h => {
      if (h.streamer_id && streamersAgg[h.streamer_id]) {
        if (h.status === 'done') {
          streamersAgg[h.streamer_id].activationsCount++;
        }
        const currentLast = streamersAgg[h.streamer_id].lastActivation;
        if (!currentLast || new Date(h.created_at) > new Date(currentLast)) {
          streamersAgg[h.streamer_id].lastActivation = h.created_at;
        }
      }
    });

    return NextResponse.json({
      global: {
        totalStreamers: streamerIds.length,
        totalRewards: rewards.length,
        recentActivationsCount: history.length,
      },
      streamers: Object.values(streamersAgg).sort((a, b) => b.activationsCount - a.activationsCount),
      historyFeed: history
    });

  } catch (err: any) {
    console.error('[cs2/superadmin GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
