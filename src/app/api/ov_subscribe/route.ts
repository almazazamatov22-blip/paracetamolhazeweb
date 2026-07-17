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
    const eventSubSecret = process.env.TWITCH_EVENTSUB_SECRET;
    
    if (!eventSubSecret || eventSubSecret.length < 10) {
      console.warn('[OV_EVENTSUB] TWITCH_EVENTSUB_SECRET is missing or too short.');
      return NextResponse.json({ error: 'Ошибка конфигурации сервера' }, { status: 500 });
    }

    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const callbackUrl = `${protocol}://${host}/api/ov_webhook`;

    // 1. Get User ID
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Ошибка авторизации Twitch' }, { status: 401 });

    const supabase = getSupabase();

    // Get current subscription ID from config
    const { data: configs } = await supabase
      .from('overlay_configs')
      .select('eventsub_subscription_id, overlay_type')
      .eq('user_id', userId);
      
    // find first existing sub id if any
    const savedSubId = configs?.find(c => c.eventsub_subscription_id)?.eventsub_subscription_id;

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

    // 3. Get existing subscriptions
    const getSubsRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Client-Id': clientId!
      }
    });
    const subsData = await getSubsRes.json();
    
    let existingSub = null;
    let needsNewSub = true;
    
    if (subsData.data && Array.isArray(subsData.data)) {
      for (const sub of subsData.data) {
        if (
          sub.type === 'channel.channel_points_custom_reward_redemption.add' && 
          sub.condition?.broadcaster_user_id === userId
        ) {
          if (
            savedSubId && sub.id === savedSubId && 
            sub.status === 'enabled' && 
            sub.transport?.callback === callbackUrl
          ) {
             existingSub = sub;
             needsNewSub = false;
          } else if (sub.transport?.callback === callbackUrl || sub.id === savedSubId) {
             // Delete old/invalid subscription
             try {
               await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${sub.id}`, {
                 method: 'DELETE',
                 headers: {
                   'Authorization': `Bearer ${appToken}`,
                   'Client-Id': clientId!
                 }
               });
               console.log(`[OV_EVENTSUB] old subscription deleted`);
             } catch (e) {
               console.error(`[OV_EVENTSUB] Failed to delete subscription ${sub.id}`, e);
             }
          }
        }
      }
    }

    let subId = existingSub?.id;
    let status = existingSub ? 'active' : 'pending';

    // 4. Create new if needed
    if (needsNewSub) {
      const subRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${appToken}`,
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
            secret: eventSubSecret
          }
        })
      });

      const subResData = await subRes.json();
      
      if (!subRes.ok) {
         console.error('[OV_EVENTSUB] Registration failed:', subResData);
         return NextResponse.json({ error: subResData.message || 'Ошибка подписки EventSub' }, { status: subRes.status });
      }
      
      subId = subResData.data?.[0]?.id;
      status = 'pending'; // Explicitly pending until webhook challenge succeeds
      console.log(`[OV_EVENTSUB] new subscription created`);
    }

    // 5. Update Supabase with new subId and status
    const { error: updateError } = await supabase
      .from('overlay_configs')
      .update({
        eventsub_status: status,
        eventsub_subscription_id: subId
      })
      .eq('user_id', userId);
      
    if (updateError) {
      console.error('[OV_EVENTSUB] Supabase update error:', updateError);
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error('[OV_EVENTSUB] Internal Error:', err);
    return NextResponse.json({ error: 'Внутренняя ошибка сервера' }, { status: 500 });
  }
}
