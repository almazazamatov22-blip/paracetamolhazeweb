import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';
import { addAuctionBid, addLotteryEntry, normalizeRozState } from '@/lib/roz-state';

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
  
  // Reject messages older than 10 minutes to prevent replay attacks
  const msgTime = new Date(msgTimestamp).getTime();
  const now = Date.now();
  if (now - msgTime > 10 * 60 * 1000) {
    console.warn('[OV_WEBHOOK] message too old, rejected');
    return false;
  }

  // Restore TWITCH_CLIENT_SECRET usage as per the working backup
  const secret = process.env.TWITCH_CLIENT_SECRET;

  if (!secret || !msgSignature || !msgId || !msgTimestamp) return false;

  const hmacMessage = msgId + msgTimestamp + rawBody;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret)
    .update(hmacMessage)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(msgSignature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
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
  try {
    const rawBody = await req.text();
    const messageType = req.headers.get('twitch-eventsub-message-type');

    // 1. Verify Twitch signature
    const isValidSignature = verifyTwitchSignature(req, rawBody);
    if (!isValidSignature) {
      console.warn('[OV_WEBHOOK] Twitch EventSub signature verification failed or message too old');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    const data = JSON.parse(rawBody);

    // 2. Handle verification challenge
    if (messageType === 'webhook_callback_verification') {
      console.log('[OV_WEBHOOK] challenge received');
      const broadcasterId = data.subscription?.condition?.broadcaster_user_id;
      
      if (broadcasterId) {
        const supabaseUrl = getSupabaseUrl();
        const supabaseKey = getSupabaseServerKey();
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from('overlay_configs')
            .update({ eventsub_status: 'active' })
            .eq('user_id', broadcasterId);
          console.log('[OV_EVENTSUB] subscription verified');
          console.log('[OV_WEBHOOK] challenge accepted, eventsub_status set to active');
        }
      }

      return new Response(data.challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 3. Handle revocation
    if (messageType === 'revocation') {
      const broadcasterId = data.subscription?.condition?.broadcaster_user_id;
      console.log(`[OV_WEBHOOK] revocation received, status: ${data.subscription?.status}`);
      if (broadcasterId) {
        const supabaseUrl = getSupabaseUrl();
        const supabaseKey = getSupabaseServerKey();
        if (supabaseUrl && supabaseKey) {
          const supabase = createClient(supabaseUrl, supabaseKey);
          await supabase
            .from('overlay_configs')
            .update({ eventsub_status: 'revoked' })
            .eq('user_id', broadcasterId);
        }
      }
      return NextResponse.json({ ok: true });
    }

    // 4. Handle actual events
    const { subscription, event } = data;

    if (subscription?.type === 'channel.channel_points_custom_reward_redemption.add') {
      console.log('[OV_WEBHOOK] redemption received');
      const streamerId = event.broadcaster_user_id || event.broadcaster_id;
      const twitchRewardId = event.reward.id;
      const userName = event.user_name || event.user_login;
      const userLogin = event.user_login || userName;
      const userMessage = event.user_input || "";
      const userId = event.user_id;

      const supabaseUrl = getSupabaseUrl();
      const supabaseKey = getSupabaseServerKey();
      if (!supabaseUrl || !supabaseKey) return NextResponse.json({ ok: true });

      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: configs, error: configError } = await supabase
        .from('overlay_configs')
        .select('settings, assets, overlay_type')
        .eq('user_id', streamerId);

      if (configError) throw configError;

      if (!configs || configs.length === 0) return NextResponse.json({ ok: true });

      let matchedConfig: any = null;
      let matchedType: string | null = null;
      let allSettings: any = {};
      let assets: any = {};
      let rozState: any = null;

      // Find which overlay config matches this reward_id
      for (const row of configs) {
         const rowSettings = row.settings || {};
         if (row.overlay_type === 'fate' && (rowSettings.reward_id === twitchRewardId || rowSettings.fate?.reward_id === twitchRewardId)) {
            matchedConfig = row;
            matchedType = 'fate';
            allSettings = rowSettings;
            assets = row.assets || {};
            break;
         }
         if (rowSettings.slots?.reward_id === twitchRewardId) {
            matchedConfig = row;
            matchedType = 'slots';
            allSettings = rowSettings;
            assets = row.assets || {};
            break;
         }
         if (rowSettings.roz) {
             const rs = normalizeRozState(rowSettings.roz);
             if (rs.lottery_reward_id === twitchRewardId || rs.auction_reward_ids.includes(twitchRewardId)) {
                 matchedConfig = row;
                 matchedType = 'roz';
                 allSettings = rowSettings;
                 assets = row.assets || {};
                 rozState = rs;
                 break;
             }
         }
      }

      // Legacy fallback
      if (!matchedConfig) {
         matchedConfig = configs[0];
         allSettings = matchedConfig.settings || {};
         assets = matchedConfig.assets || {};
         if (allSettings.reward_id === twitchRewardId) {
             matchedType = 'fate';
         } else if (allSettings.roz) {
             rozState = normalizeRozState(allSettings.roz);
             if (rozState.lottery_reward_id === twitchRewardId || rozState.auction_reward_ids.includes(twitchRewardId)) {
                 matchedType = 'roz';
             }
         }
      }

      if (!matchedType && !rozState) {
          // Unhandled reward
          return NextResponse.json({ ok: true });
      }

      console.log(`[OV_WEBHOOK] reward matched: ${matchedType || 'roz'}`);

      let appToken: string | null = null;
      let userAvatar: string | null = null;
      let assetsChanged = false;
      let settingsChanged = false;

      const loadUserAvatar = async () => {
        if (userAvatar) return userAvatar;
        try {
          appToken = appToken || await getAppToken();
          userAvatar = await getUserAvatar(userId, appToken) || `https://avatar.t.61.gd/a/${userName}?size=100`;
        } catch {
          userAvatar = `https://avatar.t.61.gd/a/${userName}?size=100`;
        }
        return userAvatar;
      };

      if (matchedType === 'fate') {
        const avatar = await loadUserAvatar();
        let typeSettings = allSettings.fate || allSettings;
        if (Object.keys(typeSettings).length === 0 && allSettings.reward_id) {
           typeSettings = allSettings;
        }

        const min = Number(typeSettings.min_val) || 1;
        const max = Number(typeSettings.max_val) || 100;
        const match = userMessage.match(/\d+/);
        const userChoice = match ? parseInt(match[0]) : 0;
        const result = Math.floor(Math.random() * (max - min + 1)) + min;

        const payload = { userChoice, result };

        const { error: insertError } = await supabase
          .from('overlay_events')
          .insert({
            user_id: streamerId,
            overlay_type: 'fate',
            event_type: 'reward_redemption',
            source: 'twitch',
            external_event_id: event.id,
            reward_id: twitchRewardId,
            reward_name: event.reward?.title || '',
            viewer_id: userId,
            viewer_name: userName,
            viewer_avatar: avatar,
            user_input: userMessage,
            payload: payload,
            status: 'pending'
          });

        if (insertError) {
          console.error('[OV_WEBHOOK] Failed to insert event:', insertError);
        } else {
          console.log('[OV_WEBHOOK] event inserted');
        }
      } else if (matchedType === 'slots') {
        const typeSettings = allSettings.slots || {};
        const avatar = await loadUserAvatar();

        let payload: any = {
          triggerId: event.id || Math.random().toString(36).substring(7),
          userName,
          userAvatar: avatar,
          timestamp: Date.now(),
          type: 'slots'
        };

        const { result, isJackpot, isWin } = getWeightedResult(typeSettings);
        payload.result = result;
        payload.isJackpot = isJackpot;
        payload.isWin = isWin;

        assets = { ...assets, last_trigger: payload };
        assetsChanged = true;
      }

      // --- ROZ LOGIC ---
      if (rozState) {
        const redemptionInput = {
          redemptionId: event.id || Math.random().toString(36).substring(7),
          userId,
          userLogin,
          userName,
          userInput: userMessage,
          rewardId: twitchRewardId,
          rewardName: event.reward?.title || '',
          rewardCost: Number(event.reward?.cost) || 0,
          redeemedAt: event.redeemed_at,
          userAvatar: null as string | null,
        };

        if (rozState.lottery_reward_id === twitchRewardId) {
          redemptionInput.userAvatar = await loadUserAvatar();
          const result = addLotteryEntry(rozState, redemptionInput);
          rozState = result.state;
          settingsChanged = settingsChanged || result.changed;
        }

        if (rozState.auction_reward_ids.includes(twitchRewardId)) {
          redemptionInput.userAvatar = redemptionInput.userAvatar || await loadUserAvatar();
          const result = addAuctionBid(rozState, redemptionInput);
          rozState = result.state;
          settingsChanged = settingsChanged || result.changed;
        }

        if (settingsChanged) {
          allSettings.roz = rozState;
        }
      }

      if (assetsChanged || settingsChanged) {
        const { error: updateError } = await supabase
          .from('overlay_configs')
          .update({
            settings: allSettings,
            assets,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', streamerId)
          .eq('overlay_type', matchedConfig.overlay_type || 'fate');

        if (updateError) throw updateError;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[OV_WEBHOOK] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
