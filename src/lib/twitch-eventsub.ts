import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';
import { randomUUID } from 'crypto';

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env missing');
  return createClient(supabaseUrl, supabaseKey);
}

export async function getAppToken(): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId!,
      client_secret: clientSecret!,
      grant_type: 'client_credentials'
    })
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get App Token');
  return data.access_token;
}

export async function getBroadcasterId(token: string): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
  });
  const data = await res.json();
  return data.data?.[0]?.id || null;
}

const ALLOWED_EVENTSUB_HOSTS = new Set([
  'paracetamolhaze.ru',
  'www.paracetamolhaze.ru',
  'paracetamolhaze-six.vercel.app',
  'paracetamolhaze.online',
  'localhost:3000'
]);

export async function sharedSubscribeHandler(req: NextRequest, webhookPath: string = '/api/twitch/webhook') {
  const mode = req.nextUrl.searchParams.get('mode') === 'reconnect' ? 'reconnect' : 'ensure';
  
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) return Response.json({ error: 'Необходима авторизация Twitch' }, { status: 401 });

    const broadcasterId = await getBroadcasterId(token);
    if (!broadcasterId) return Response.json({ error: 'Ошибка авторизации Twitch' }, { status: 401 });

    const webhookSecret = process.env.TWITCH_CLIENT_SECRET;
    const clientId = process.env.TWITCH_CLIENT_ID;
    
    if (!webhookSecret || webhookSecret.length < 10) {
      console.warn('[TWITCH_EVENTSUB] TWITCH_CLIENT_SECRET is missing or too short.');
      return Response.json({ error: 'Ошибка конфигурации сервера (EventSub)' }, { status: 500 });
    }

    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const normalizedHost = host?.split(',')[0].trim().toLowerCase();

    if (!normalizedHost || !ALLOWED_EVENTSUB_HOSTS.has(normalizedHost)) {
      return Response.json({ error: 'Invalid callback host' }, { status: 400 });
    }

    const callbackUrl = `${protocol}://${normalizedHost}${webhookPath}`;
    const lockToken = randomUUID();
    const supabase = getSupabase();
    
    // Acquire lease
    const { data: lockAcquired, error: lockError } = await supabase.rpc('try_acquire_eventsub_lease', {
      p_broadcaster_id: broadcasterId,
      p_subscription_type: 'channel.channel_points_custom_reward_redemption.add',
      p_lock_token: lockToken,
      p_ttl_seconds: 30
    });

    if (lockError || !lockAcquired) {
      console.log(`[TWITCH_EVENTSUB] Could not acquire lock for ${broadcasterId}`);
      return Response.json({ success: true, status: 'processing', message: 'Another request is processing' });
    }

    try {
      const appToken = await getAppToken();

      // Fetch from Twitch API with pagination
      let allSubs: any[] = [];
      let cursor: string | undefined = undefined;
      do {
        const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
        if (cursor) url.searchParams.set('after', cursor);
        const getSubsRes = await fetch(url.toString(), {
          headers: { 'Authorization': `Bearer ${appToken}`, 'Client-Id': clientId! }
        });
        
        if (!getSubsRes.ok) {
           const errText = await getSubsRes.text();
           console.error('[TWITCH_EVENTSUB] Failed to fetch subscriptions:', getSubsRes.status, errText);
           return Response.json({ error: 'Ошибка получения подписок Twitch', status: getSubsRes.status }, { status: 500 });
        }

        const subsData = await getSubsRes.json();
        if (subsData.data && Array.isArray(subsData.data)) {
          allSubs = allSubs.concat(subsData.data);
        }
        cursor = subsData.pagination?.cursor;
      } while (cursor);

      let existingSub = null;
      let needsNewSub = true;
      let finalCallbackUrl = callbackUrl;
      let finalCallbackHost = normalizedHost;

      for (const sub of allSubs) {
        if (
          sub.type === 'channel.channel_points_custom_reward_redemption.add' && 
          sub.condition?.broadcaster_user_id === broadcasterId
        ) {
          const subUrl = new URL(sub.transport?.callback);
          const subHostname = subUrl.host.toLowerCase();
          const subPathname = subUrl.pathname;

          if (sub.status === 'enabled' || sub.status === 'webhook_callback_verification_pending') {
            if (mode === 'ensure') {
              if (ALLOWED_EVENTSUB_HOSTS.has(subHostname) && subPathname === webhookPath) {
                existingSub = sub;
                needsNewSub = false;
                finalCallbackUrl = sub.transport.callback;
                finalCallbackHost = subHostname;
                continue;
              }
              if (ALLOWED_EVENTSUB_HOSTS.has(subHostname)) {
                continue;
              }
            } else {
              if (subHostname === normalizedHost && subPathname === webhookPath) {
                existingSub = sub;
                needsNewSub = false;
                finalCallbackUrl = sub.transport.callback;
                finalCallbackHost = subHostname;
                continue;
              }
              if (ALLOWED_EVENTSUB_HOSTS.has(subHostname)) {
                continue;
              }
            }
          } else if (subPathname === webhookPath && subHostname === normalizedHost) {
            console.log(`[TWITCH_EVENTSUB] Deleting our broken sub ${sub.id}`);
            await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${appToken}`, 'Client-Id': clientId! }
            });
          }
        }
      }

      let subId = existingSub?.id;
      let status = existingSub?.status === 'enabled' ? 'enabled' : existingSub?.status === 'webhook_callback_verification_pending' ? 'webhook_callback_verification_pending' : 'pending';

      const createSub = async (tokenStr: string) => {
        return fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenStr}`,
            'Client-Id': clientId!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'channel.channel_points_custom_reward_redemption.add',
            version: '1',
            condition: { broadcaster_user_id: broadcasterId },
            transport: {
              method: 'webhook',
              callback: finalCallbackUrl,
              secret: webhookSecret
            }
          })
        });
      };

      if (needsNewSub) {
        let subRes = await createSub(appToken);
        let subResData = await subRes.json();

        if (subRes.status === 403) {
           return Response.json({ success: false, error: subResData.message || 'Требуется авторизация в Twitch', requiresReauth: true }, { status: 403 });
        }

        if (subRes.status === 409) {
           const conflictId = subResData.id || subResData.message?.match(/([a-f0-9\-]{36})/)?.[0];
           if (conflictId) {
               console.log(`[TWITCH_EVENTSUB] Conflict 409, verifying id ${conflictId}`);
               // Fetch it to see if it's the exact same we just couldn't find?
               const fetchConflict = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?subscription_id=${conflictId}`, {
                 headers: { 'Authorization': `Bearer ${appToken}`, 'Client-Id': clientId! }
               });
               
               if (!fetchConflict.ok) {
                 console.log(`[TWITCH_EVENTSUB] Could not fetch conflict sub ${conflictId}. Code: ${fetchConflict.status}`);
               } else {
                 const conflictData = await fetchConflict.json();
                 const subConf = conflictData.data?.[0];

                 if (subConf && subConf.transport?.callback === finalCallbackUrl && (subConf.status === 'enabled' || subConf.status === 'webhook_callback_verification_pending')) {
                   console.log(`[TWITCH_EVENTSUB] Conflict sub is perfectly valid, adopting it.`);
                   subId = subConf.id;
                   status = subConf.status;
                   needsNewSub = false;
                 } else if (subConf) {
                   console.log(`[TWITCH_EVENTSUB] Conflict sub is invalid/mismatched. Deleting...`);
                   await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${conflictId}`, {
                     method: 'DELETE',
                     headers: { 'Authorization': `Bearer ${appToken}`, 'Client-Id': clientId! }
                   });
                   console.log(`[TWITCH_EVENTSUB] Retrying creation...`);
                   subRes = await createSub(appToken);
                   subResData = await subRes.json();
                 }
               }
           }
        }

        if (needsNewSub) {
          if (!subRes.ok) {
             console.error('[TWITCH_EVENTSUB] Registration failed:', subRes.status, subResData);
             return Response.json({ success: false, error: subResData.message || 'Ошибка подписки Twitch', status: subRes.status }, { status: subRes.status === 409 ? 409 : 500 });
          }
          subId = subResData.data?.[0]?.id;
          status = 'webhook_callback_verification_pending';
        }
      }

      // Update DB
      let finalCurrent = null;
      if (subId) {
        const { data: fc } = await supabase.from('twitch_eventsub_subscriptions').select('status, twitch_subscription_id').eq('broadcaster_id', broadcasterId).eq('subscription_type', 'channel.channel_points_custom_reward_redemption.add').maybeSingle();
        finalCurrent = fc;
      }
      if (finalCurrent?.status === 'enabled' && finalCurrent?.twitch_subscription_id === subId && status !== 'enabled') {
         status = 'enabled'; // prevent downgrade from challenge race
      }

      const { error: saveSubError } = await supabase
        .from('twitch_eventsub_subscriptions')
        .upsert({
          broadcaster_id: broadcasterId,
          subscription_type: 'channel.channel_points_custom_reward_redemption.add',
          twitch_subscription_id: subId,
          callback_url: finalCallbackUrl,
          callback_host: finalCallbackHost,
          callback_updated_at: new Date().toISOString(),
          status,
          secret_version: 'client-secret-v1',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'broadcaster_id,subscription_type'
        });

      if (saveSubError) {
        throw saveSubError;
      }

      return Response.json({ success: true, status, subscriptionId: subId, callback: finalCallbackUrl });
    } finally {
      await supabase.rpc('release_eventsub_lease', {
        p_broadcaster_id: broadcasterId,
        p_subscription_type: 'channel.channel_points_custom_reward_redemption.add',
        p_lock_token: lockToken
      });
    }

  } catch (err: any) {
    console.error('[TWITCH_EVENTSUB] Internal Error:', err.message);
    return Response.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

export async function getSubscriptionStatus(req: NextRequest, webhookPath: string = '/api/twitch/webhook') {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) return Response.json({ isSubscribed: false, error: 'Необходима авторизация Twitch' }, { status: 401 });

    const broadcasterId = await getBroadcasterId(token);
    if (!broadcasterId) return Response.json({ isSubscribed: false, error: 'Ошибка авторизации Twitch' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    
    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const normalizedHost = host?.split(',')[0].trim().toLowerCase();

    if (!normalizedHost || !ALLOWED_EVENTSUB_HOSTS.has(normalizedHost)) {
      return Response.json({ isSubscribed: false, error: 'Invalid callback host' }, { status: 400 });
    }

    const callbackUrl = `${protocol}://${normalizedHost}${webhookPath}`;
    const appToken = await getAppToken();

    let isSubscribed = false;
    let cursor: string | undefined = undefined;

    do {
      const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
      if (cursor) url.searchParams.set('after', cursor);
      const getSubsRes = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${appToken}`, 'Client-Id': clientId! }
      });
      
      if (!getSubsRes.ok) {
         return Response.json({ isSubscribed: false, error: 'Ошибка получения подписок Twitch' }, { status: 500 });
      }

      const subsData = await getSubsRes.json();
      if (subsData.data && Array.isArray(subsData.data)) {
        for (const sub of subsData.data) {
          if (
            sub.type === 'channel.channel_points_custom_reward_redemption.add' && 
            sub.condition?.broadcaster_user_id === broadcasterId &&
            sub.status === 'enabled' &&
            sub.transport?.method === 'webhook' &&
            sub.transport?.callback === callbackUrl
          ) {
            isSubscribed = true;
            break;
          }
        }
      }
      if (isSubscribed) break;
      cursor = subsData.pagination?.cursor;
    } while (cursor);

    return Response.json({ isSubscribed, callbackUrl });
  } catch (err: any) {
    console.error('[TWITCH_EVENTSUB_GET] Internal Error:', err.message);
    return Response.json({ isSubscribed: false, error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}

