import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';
import { getBestAuctionBid, normalizeRozState } from '@/lib/roz-state';

export const runtime = 'nodejs';

async function getTwitchUser(req: NextRequest) {
  const token = req.cookies.get('twitch_token')?.value;
  const clientId = process.env.TWITCH_CLIENT_ID;

  if (!token || !clientId) return null;

  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Client-Id': clientId,
    },
    cache: 'no-store',
  });
  const data = await res.json().catch(() => null);
  const user = data?.data?.[0];

  if (!res.ok || !user?.id) return null;
  return {
    id: user.id,
    login: user.login,
    display_name: user.display_name,
    profile_image_url: user.profile_image_url,
  };
}

function getSupabase() {
  const url = getSupabaseUrl();
  const key = getSupabaseServerKey();

  if (!url || !key) throw new Error('Supabase env missing');
  return createClient(url, key);
}

async function loadConfig(userId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('overlay_configs')
    .select('settings, assets')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;

  return {
    supabase,
    settings: (data?.settings || {}) as Record<string, unknown>,
    assets: data?.assets || {},
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await getTwitchUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { settings } = await loadConfig(user.id);
    const state = normalizeRozState(settings.roz);

    return NextResponse.json({ user, state });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getTwitchUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === 'string' ? body.action : 'save';
    const incomingSettings = body.settings && typeof body.settings === 'object' ? body.settings : {};
    const { supabase, settings, assets } = await loadConfig(user.id);

    let state = normalizeRozState({
      ...normalizeRozState(settings.roz),
      ...incomingSettings,
    });

    if (action === 'resetLottery') {
      state = normalizeRozState({
        ...state,
        lottery_entries: [],
        lottery_winner: null,
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'resetAuction') {
      state = normalizeRozState({
        ...state,
        auction_bids: [],
        auction_winner: null,
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'drawLottery') {
      const pool = state.lottery_entries;
      state = normalizeRozState({
        ...state,
        lottery_winner: pool.length ? pool[Math.floor(Math.random() * pool.length)] : null,
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'finishAuction') {
      state = normalizeRozState({
        ...state,
        auction_winner: getBestAuctionBid(state.auction_bids),
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'stopLottery') {
      state = normalizeRozState({
        ...state,
        lottery_reward_id: '',
        lottery_reward_name: '',
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'stopAuction') {
      state = normalizeRozState({
        ...state,
        auction_reward_ids: [],
        auction_reward_names: [],
        auction_reward_id: '',
        auction_reward_name: '',
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'deleteLotteryEntry') {
      const targetLogin = typeof body.login === 'string' ? body.login.toLowerCase() : '';
      state = normalizeRozState({
        ...state,
        lottery_entries: state.lottery_entries.filter(e => (e.login || e.username.toLowerCase()) !== targetLogin),
        updated_at: new Date().toISOString(),
      });
    } else if (action === 'deleteAuctionBid') {
      const targetLogin = typeof body.login === 'string' ? body.login.toLowerCase() : '';
      state = normalizeRozState({
        ...state,
        auction_bids: state.auction_bids.filter(b => (b.login || b.username.toLowerCase()) !== targetLogin),
        updated_at: new Date().toISOString(),
      });
    } else {
      state = normalizeRozState({
        ...state,
        updated_at: new Date().toISOString(),
      });
    }

    const nextSettings = {
      ...settings,
      roz: state,
    };

    const { error } = await supabase
      .from('overlay_configs')
      .upsert({
        user_id: user.id,
        settings: nextSettings,
        assets,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;

    return NextResponse.json({ success: true, user, state });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
