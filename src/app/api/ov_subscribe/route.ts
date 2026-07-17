import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';

export const runtime = 'nodejs';

function getSupabase() {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseServerKey();

  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase env missing');
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Необходима авторизация Twitch' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    // Use TWITCH_CLIENT_SECRET as the webhook secret as requested
    const webhookSecret = process.env.TWITCH_CLIENT_SECRET;
    
    if (!webhookSecret || webhookSecret.length < 10) {
      console.warn('[OV_EVENTSUB] TWITCH_CLIENT_SECRET is missing or too short.');
      return NextResponse.json({ error: 'Ошибка конфигурации сервера (EventSub)' }, { status: 500 });
    }

    const forwardedHost = req.headers.get('x-forwarded-host');
    const host = forwardedHost || req.headers.get('host');
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const normalizedHost = host?.split(',')[0].trim().toLowerCase();

    const ALLOWED_EVENTSUB_HOSTS = new Set([
      'paracetamolhaze.ru',
      'www.paracetamolhaze.ru',
      'paracetamolhaze-six.vercel.app',
      'paracetamolhaze.online',
      'localhost:3000'
    ]);

    if (!normalizedHost || !ALLOWED_EVENTSUB_HOSTS.has(normalizedHost)) {
       return NextResponse.json({ error: 'Invalid callback host' }, { status: 400 });
    }

    const callbackUrl = `${protocol}://${normalizedHost}/api/ov_webhook`;

    // 1. Get User ID
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Ошибка авторизации Twitch' }, { status: 401 });

    const supabase = getSupabase();

    // Get current subscription ID and version from config
    const { data: configs } = await supabase
      .from('overlay_configs')
      .select('eventsub_subscription_id, settings')
      .eq('user_id', userId)
      .eq('overlay_type', 'fate');
      
    const fateConfig = configs?.[0];
    const savedSubId = fateConfig?.eventsub_subscription_id;
    const secretVersion = fateConfig?.settings?.eventsub_secret_version;

    // 2. Get App Token
    const appTokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: 'client_credentials'
      })
    });
    const appTokenData = await appTokenRes.json();
    const appToken = appTokenData.access_token;
    if (!appToken) return NextResponse.json({ error: 'Не удалось получить App Token' }, { status: 500 });

    // 3. Fetch all subscriptions with pagination
    let allSubs: any[] = [];
    let cursor: string | undefined = undefined;
    
    do {
      const url = new URL('https://api.twitch.tv/helix/eventsub/subscriptions');
      if (cursor) url.searchParams.set('after', cursor);
      
      const getSubsRes = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${appToken}`,
          'Client-Id': clientId!
        }
      });
      const subsData = await getSubsRes.json();
      if (subsData.data && Array.isArray(subsData.data)) {
        allSubs = allSubs.concat(subsData.data);
      }
      cursor = subsData.pagination?.cursor;
    } while (cursor);
    
    console.log('[OV_EVENTSUB] subscriptions fetched');
    
    let existingSub = null;
    let needsNewSub = true;
    
    for (const sub of allSubs) {
      if (
        sub.type === 'channel.channel_points_custom_reward_redemption.add' && 
        sub.condition?.broadcaster_user_id === userId
      ) {
        if (
          savedSubId && sub.id === savedSubId && 
          sub.status === 'enabled' && 
          sub.transport?.callback === callbackUrl &&
          secretVersion === 'client-secret-v1'
        ) {
           console.log('[OV_EVENTSUB] matching subscription found');
           existingSub = sub;
           needsNewSub = false;
        } else {
           console.log('[OV_EVENTSUB] deleting stale subscription', sub.id);
           const delRes = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
             method: 'DELETE',
             headers: {
               'Authorization': `Bearer ${appToken}`,
               'Client-Id': clientId!
             }
           });
           if (delRes.ok || delRes.status === 404) {
             console.log('[OV_EVENTSUB] stale subscription deleted');
           } else {
             console.error(`[OV_EVENTSUB] failed to delete subscription ${sub.id}:`, await delRes.text());
           }
        }
      }
    }

    let subId = existingSub?.id;
    let status = existingSub ? 'enabled' : 'pending';

    // 4. Create new if needed
    if (needsNewSub) {
      const createSub = async (appTokenStr: string) => {
        return fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${appTokenStr}`,
            'Client-Id': clientId!,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            type: 'channel.channel_points_custom_reward_redemption.add',
            version: '1',
            condition: { broadcaster_user_id: userId },
            transport: {
              method: 'webhook',
              callback: callbackUrl,
              secret: webhookSecret
            }
          })
        });
      };

      let subRes = await createSub(appToken);
      let subResData = await subRes.json();
      console.log('[OV_EVENTSUB] create response', subRes.status);

      if (subRes.status === 403) {
         console.error('[OV_EVENTSUB] Authorization missing (403):', subResData);
         return NextResponse.json({ 
             success: false,
             error: subResData.message || 'Требуется авторизация в Twitch',
             requiresReauth: true
         }, { status: 403 });
      }

      if (subRes.status === 409) {
         console.log('[OV_EVENTSUB] conflict detected');
         // Try to extract conflicting ID and delete it
         const conflictId = subResData.message?.match(/([a-f0-9\-]{36})/)?.[0];
         if (conflictId) {
             console.log('[OV_EVENTSUB] deleting conflicting subscription', conflictId);
             await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${conflictId}`, {
               method: 'DELETE',
               headers: { 'Authorization': `Bearer ${appToken}`, 'Client-Id': clientId! }
             });
             console.log('[OV_EVENTSUB] conflicting subscription deleted, retrying creation...');
             
             // Retry once
             subRes = await createSub(appToken);
             subResData = await subRes.json();
             console.log('[OV_EVENTSUB] retry create response', subRes.status);
         }
      }

      if (!subRes.ok) {
         console.error('[OV_EVENTSUB] Registration failed:', subRes.status, subResData);
         return NextResponse.json({ 
             success: false, 
             error: subResData.message || 'Ошибка подписки Twitch',
             status: subRes.status
         }, { status: subRes.status === 409 ? 409 : 500 });
      }
      
      subId = subResData.data?.[0]?.id;
      status = 'pending'; // Requires challenge verification
      console.log(`[OV_EVENTSUB] subscription created`);
    }

    // 5. Update Supabase with new subId, status, and secret_version
    let updatedSettings = fateConfig?.settings || {};
    updatedSettings.eventsub_secret_version = 'client-secret-v1';

    const { error: updateError } = await supabase
      .from('overlay_configs')
      .update({
        eventsub_status: status,
        eventsub_subscription_id: subId,
        settings: updatedSettings
      })
      .eq('user_id', userId)
      .eq('overlay_type', 'fate');
      
    if (updateError) {
      console.error('[OV_EVENTSUB] Supabase update error:', updateError);
    }

    return NextResponse.json({ 
      success: true,
      status: status,
      subscriptionId: subId,
      callback: callbackUrl
    });

  } catch (err: any) {
    console.error('[OV_EVENTSUB] Internal Error:', err.message);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
