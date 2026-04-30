import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

export const runtime = 'nodejs';

async function getAppToken() {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID!,
      client_secret: process.env.TWITCH_CLIENT_SECRET!,
      grant_type: 'client_credentials'
    })
  });
  const data = await res.json();
  return data.access_token;
}

async function getUserAvatar(userId: string, appToken: string) {
  try {
    const res = await fetch(`https://api.twitch.tv/helix/users?id=${userId}`, {
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Client-Id': process.env.TWITCH_CLIENT_ID!
      }
    });
    const data = await res.json();
    return data.data?.[0]?.profile_image_url;
  } catch (e) {
    return null;
  }
}

function verifyTwitchSignature(req: NextRequest, rawBody: string): boolean {
  const msgId = req.headers.get('twitch-eventsub-message-id') || '';
  const msgTimestamp = req.headers.get('twitch-eventsub-message-timestamp') || '';
  const msgSignature = req.headers.get('twitch-eventsub-message-signature') || '';
  const secret = process.env.TWITCH_CLIENT_SECRET!;

  if (!msgSignature || !msgId || !msgTimestamp) return false;

  const hmacMessage = msgId + msgTimestamp + rawBody;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret)
    .update(hmacMessage)
    .digest('hex');

  return expected === msgSignature;
}

function getWeightedResult(settings: any) {
  const symbols = (settings.symbols || []).length > 0 ? settings.symbols : [
    { name: 'Вишня', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135520.png', chance: 15 },
    { name: 'Лимон', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135540.png', chance: 10 },
    { name: 'ДЖЕКПОТ', url: 'https://cdn-icons-png.flaticon.com/512/1135/1135640.png', chance: 0.1, isJackpot: true }
  ];
  
  const roll = Math.random() * 100;
  let cumulative = 0;

  for (const s of symbols) {
    cumulative += Number(s.chance) || 0;
    if (roll < cumulative) {
      return { result: [s.url, s.url, s.url], isJackpot: !!s.isJackpot, isWin: true };
    }
  }

  const allUrls = symbols.map((s: any) => s.url);
  const pool = allUrls.length >= 2 ? allUrls : ['https://cdn-icons-png.flaticon.com/512/1135/1135520.png', 'https://cdn-icons-png.flaticon.com/512/1135/1135540.png'];
  
  const r1 = pool[Math.floor(Math.random() * pool.length)];
  let r2 = pool[Math.floor(Math.random() * pool.length)];
  let r3 = pool[Math.floor(Math.random() * pool.length)];
  if (r1 === r2 && r2 === r3) {
    r3 = pool.find(u => u !== r1) || pool[0];
  }
  return { result: [r1, r2, r3], isJackpot: false, isWin: false };
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  
  if (!verifyTwitchSignature(req, rawBody)) {
    const challengeData = JSON.parse(rawBody);
    if (challengeData.challenge) {
       return new Response(challengeData.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
  }

  const data = JSON.parse(rawBody);
  const { subscription, event } = data;

  if (subscription?.type === 'channel.channel_points_custom_reward_redemption.add') {
    const streamerId = event.broadcaster_user_id || event.broadcaster_id;
    const twitchRewardId = event.reward.id;
    const userName = event.user_name || event.user_login;
    const userMessage = event.user_input || "";
    const userId = event.user_id;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: configs } = await supabase
      .from('overlay_configs')
      .select('settings, assets')
      .eq('user_id', streamerId);

    const config = configs?.[0] || null;
    if (!config) return NextResponse.json({ ok: true });

    const allSettings: any = config.settings || {};
    const assets: any = config.assets || {};

    let type: string | null = null;
    if (allSettings.fate?.reward_id === twitchRewardId) type = 'fate';
    else if (allSettings.slots?.reward_id === twitchRewardId) type = 'slots';

    if (type) {
      const typeSettings = allSettings[type] || {};
      const appToken = await getAppToken();
      const userAvatar = await getUserAvatar(userId, appToken) || `https://avatar.t.61.gd/a/${userName}?size=100`;

      let payload: any = {
        triggerId: event.id || Math.random().toString(36).substring(7),
        userName,
        userAvatar,
        timestamp: Date.now(),
        type
      };

      if (type === 'slots') {
        const { result, isJackpot, isWin } = getWeightedResult(typeSettings);
        payload.result = result;
        payload.isJackpot = isJackpot;
        payload.isWin = isWin;
      } else {
        const min = Number(typeSettings.min_val) || 1;
        const max = Number(typeSettings.max_val) || 100;
        const match = userMessage.match(/\d+/);
        payload.userChoice = match ? parseInt(match[0]) : 0;
        payload.result = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      await supabase.from('overlay_configs').update({
        assets: { ...assets, last_trigger: payload },
        updated_at: new Date().toISOString()
      }).eq('user_id', streamerId);
    }
  }

  return NextResponse.json({ ok: true });
}
