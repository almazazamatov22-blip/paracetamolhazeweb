import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';
import { addAuctionBid, addLotteryEntry, normalizeRozState } from '@/lib/roz-state';

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env missing');
  return createClient(supabaseUrl, supabaseKey);
}

function verifyTwitchSignature(req: NextRequest, rawBody: string): boolean {
  const msgId = req.headers.get('twitch-eventsub-message-id') || '';
  const msgTimestamp = req.headers.get('twitch-eventsub-message-timestamp') || '';
  const msgSignature = req.headers.get('twitch-eventsub-message-signature') || '';
  
  const msgTime = new Date(msgTimestamp).getTime();
  const now = Date.now();
  if (now - msgTime > 10 * 60 * 1000) {
    console.warn('[TWITCH_WEBHOOK] message too old, rejected');
    return false;
  }

  const secret = process.env.TWITCH_CLIENT_SECRET;
  if (!secret || !msgSignature || !msgId || !msgTimestamp) return false;

  const hmacMessage = msgId + msgTimestamp + rawBody;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(hmacMessage).digest('hex');

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

export async function handleTwitchWebhook(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const messageType = req.headers.get('twitch-eventsub-message-type');
    const messageId = req.headers.get('twitch-eventsub-message-id');

    if (!verifyTwitchSignature(req, rawBody)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const data = JSON.parse(rawBody);
    const supabase = getSupabase();
    
    // 1. Replay Protection
    if (messageId) {
      const { error: replayError } = await supabase
        .from('twitch_eventsub_messages')
        .insert({
          message_id: messageId,
          subscription_id: data.subscription?.id,
          message_type: messageType
        });
        
      if (replayError && replayError.code === '23505') { // Unique violation
        console.log(`[TWITCH_WEBHOOK] Duplicate message ignored: ${messageId}`);
        // For challenge, we MUST still return the challenge text even if it's a replay
        if (messageType === 'webhook_callback_verification') {
          return new Response(data.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // 2. Challenge
    if (messageType === 'webhook_callback_verification') {
      const subId = data.subscription?.id;
      if (subId) {
        await supabase
          .from('twitch_eventsub_subscriptions')
          .update({ status: 'enabled' })
          .eq('twitch_subscription_id', subId);
      }
      return new Response(data.challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    // 3. Revocation
    if (messageType === 'revocation') {
      const subId = data.subscription?.id;
      const status = data.subscription?.status;
      if (subId && status) {
        await supabase
          .from('twitch_eventsub_subscriptions')
          .update({ status: status })
          .eq('twitch_subscription_id', subId);
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Notification (Redemption)
    const { subscription, event } = data;
    if (subscription?.type !== 'channel.channel_points_custom_reward_redemption.add') {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    const streamerId = event.broadcaster_user_id || event.broadcaster_id;
    const twitchRewardId = event.reward.id;
    const userName = event.user_name || event.user_login;
    const userLogin = event.user_login || userName;
    const userMessage = event.user_input || "";
    const userId = event.user_id;

    // A. Consult Registry First
    const { data: binding } = await supabase
      .from('twitch_reward_bindings')
      .select('product_type, resource_id')
      .eq('broadcaster_id', streamerId)
      .eq('twitch_reward_id', twitchRewardId)
      .maybeSingle();

    let productType = binding?.product_type;
    let resourceId = binding?.resource_id;

    // B. Legacy Fallback
    if (!productType) {
      // Find the owner dynamically
      const { data: configs } = await supabase.from('overlay_configs').select('id, overlay_type, settings').eq('user_id', streamerId);
      const { data: cs2 } = await supabase.from('cs2_rewards').select('id').eq('streamer_id', streamerId).eq('twitch_reward_id', twitchRewardId).eq('enabled', true);
      
      let foundOwners = [];
      
      if (configs) {
        for (const c of configs) {
          if (c.settings?.reward_id === twitchRewardId || c.settings?.fate?.reward_id === twitchRewardId) {
             foundOwners.push({ type: 'fate', id: c.id });
          }
          if (c.settings?.slots?.reward_id === twitchRewardId) {
             foundOwners.push({ type: 'slots', id: c.id });
          }
          if (c.settings?.roz) {
             const rs = normalizeRozState(c.settings.roz);
             if (rs.lottery_reward_id === twitchRewardId || rs.auction_reward_ids.includes(twitchRewardId)) {
                foundOwners.push({ type: 'roz', id: c.id });
             }
          }
        }
      }
      
      if (cs2 && cs2.length > 0) {
        foundOwners.push({ type: 'cs2', id: cs2[0].id });
      }

      if (foundOwners.length === 1) {
        productType = foundOwners[0].type;
        resourceId = foundOwners[0].id;
        // Lazily create the binding now
        await supabase.from('twitch_reward_bindings').insert({
          broadcaster_id: streamerId,
          twitch_reward_id: twitchRewardId,
          product_type: productType,
          resource_id: resourceId
        }).select().maybeSingle();
      } else if (foundOwners.length > 1) {
        console.warn(`[TWITCH_WEBHOOK] Conflict! Multiple legacy owners for reward ${twitchRewardId}`, foundOwners);
        return new Response(JSON.stringify({ ok: true, conflict: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      } else {
        // Unknown reward, do nothing
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // C. Dispatch
    if (productType === 'fate') {
      const min = 1;
      const max = 100;
      const match = userMessage.match(/\d+/);
      const userChoice = match ? parseInt(match[0]) : 0;
      const result = Math.floor(Math.random() * (max - min + 1)) + min;
      
      await supabase.from('overlay_events').insert({
        user_id: streamerId,
        overlay_type: 'fate',
        event_type: 'reward_redemption',
        source: 'twitch',
        external_event_id: event.id,
        reward_id: twitchRewardId,
        reward_name: event.reward?.title || '',
        viewer_id: userId,
        viewer_name: userName,
        viewer_avatar: null, // Avoid API calls
        user_input: userMessage,
        payload: { userChoice, result },
        status: 'pending'
      });
    } 
    else if (productType === 'cs2') {
      const { data: reward } = await supabase.from('cs2_rewards').select('*').eq('id', resourceId).single();
      if (reward) {
        if (reward.cooldown_seconds > 0) {
          const cooldownAgo = new Date(Date.now() - reward.cooldown_seconds * 1000).toISOString();
          const { data: recentExec } = await supabase
            .from('cs2_reward_queue')
            .select('id')
            .eq('reward_id', reward.id)
            .gte('created_at', cooldownAgo)
            .in('status', ['pending', 'processing', 'done'])
            .limit(1)
            .maybeSingle();

          if (recentExec) {
            console.log(`[TWITCH_WEBHOOK] CS2 Reward "${reward.name}" on cooldown, skipping`);
            return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
        }
        
        const ACTION_REGISTRY: any = {
           drop: { durationMs: 0 }, drop_c4: { durationMs: 0 }, drop_all: { durationMs: 0 },
           burn: { durationMs: 0 }, blind: { durationMs: 0 }, 
           slap: { durationMs: 0 }, heal: { durationMs: 0 }, 
           kill: { durationMs: 0 }, move: { durationMs: 0 },
           give_money: { durationMs: 0 }, take_money: { durationMs: 0 },
           give_defuser: { durationMs: 0 },
           give_weapon: { durationMs: 0 }, give_nade: { durationMs: 0 },
           armor: { durationMs: 0 },
           speed: { durationMs: 15000 }, slowness: { durationMs: 15000 },
           low_gravity: { durationMs: 15000 }, fov: { durationMs: 15000 },
           invert_mouse: { durationMs: 15000 }, no_shoot: { durationMs: 15000 },
           pacifist: { durationMs: 15000 }
        };
        const actionConfig = ACTION_REGISTRY[reward.action_type] || { durationMs: 0 };

        await supabase.from('cs2_reward_queue').insert({
          streamer_id: streamerId,
          reward_id: reward.id,
          redemption_id: event.id,
          user_name: userName,
          user_avatar: null, // Avoid API calls
          action_type: reward.action_type,
          reward_name: reward.name,
          duration_ms: actionConfig.durationMs,
          status: 'pending'
        });
      }
    }
    else if (productType === 'slots' || productType === 'roz') {
       const { data: configRow } = await supabase.from('overlay_configs').select('settings, assets, overlay_type').eq('id', resourceId).single();
       if (configRow) {
         let allSettings = configRow.settings || {};
         let assets = configRow.assets || {};
         let settingsChanged = false;
         let assetsChanged = false;

         if (productType === 'slots') {
           const typeSettings = allSettings.slots || {};
           let payload: any = {
             triggerId: event.id || Math.random().toString(36).substring(7),
             userName,
             userAvatar: null,
             timestamp: Date.now(),
             type: 'slots'
           };
           const { result, isJackpot, isWin } = getWeightedResult(typeSettings);
           payload.result = result; payload.isJackpot = isJackpot; payload.isWin = isWin;
           assets = { ...assets, last_trigger: payload };
           assetsChanged = true;
         } else if (productType === 'roz') {
           let rozState = normalizeRozState(allSettings.roz);
           const redemptionInput = {
             redemptionId: event.id || Math.random().toString(36).substring(7),
             userId, userLogin, userName, userInput: userMessage,
             rewardId: twitchRewardId, rewardName: event.reward?.title || '',
             rewardCost: Number(event.reward?.cost) || 0,
             redeemedAt: event.redeemed_at,
             userAvatar: null,
           };

           if (rozState.lottery_reward_id === twitchRewardId) {
             const r = addLotteryEntry(rozState, redemptionInput);
             rozState = r.state; settingsChanged = settingsChanged || r.changed;
           }
           if (rozState.auction_reward_ids.includes(twitchRewardId)) {
             const r = addAuctionBid(rozState, redemptionInput);
             rozState = r.state; settingsChanged = settingsChanged || r.changed;
           }
           if (settingsChanged) allSettings.roz = rozState;
         }

         if (assetsChanged || settingsChanged) {
           await supabase.from('overlay_configs').update({
             settings: allSettings,
             assets,
             updated_at: new Date().toISOString()
           }).eq('id', resourceId);
         }
       }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error('[TWITCH_WEBHOOK] Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
