import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

async function getStreamerId(token: string): Promise<string | null> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId! },
  });
  const data = await res.json();
  return data.data?.[0]?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID!;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

    const userId = await getStreamerId(token);
    if (!userId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    // App token
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
    if (!appToken) return NextResponse.json({ error: 'App token failed' }, { status: 500 });

    // Fetch EventSub subscriptions
    const subRes = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?user_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${appToken}`,
        'Client-Id': clientId,
      },
    });

    if (!subRes.ok) {
      const errData = await subRes.json().catch(() => ({}));
      return NextResponse.json({ error: errData.message || 'Failed to check subscriptions' }, { status: subRes.status });
    }

    const subData = await subRes.json();
    const isSubscribed = (subData.data || []).some(
      (sub: any) =>
        sub.type === 'channel.channel_points_custom_reward_redemption.add' &&
        sub.status === 'enabled'
    );

    return NextResponse.json({ isSubscribed });
  } catch (err: any) {
    console.error('[cs2/subscribe GET]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/cs2/subscribe
 * Подписывает канал стримера на channel_points redemption события
 * с callback на /api/cs2/webhook
 */
export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID!;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET!;

    // 1. Получить userId стримера
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
    });
    const userData = await userRes.json();
    const userId = userData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Auth failed' }, { status: 401 });

    // 2. App token
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
    if (!appToken) return NextResponse.json({ error: 'App token failed' }, { status: 500 });

    // 3. Определить callback URL
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const callbackUrl = `${protocol}://${host}/api/cs2/webhook`;

    // 4. Подписаться
    const subRes = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appToken}`,
        'Client-Id': clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'channel.channel_points_custom_reward_redemption.add',
        version: '1',
        condition: { broadcaster_user_id: userId },
        transport: {
          method: 'webhook',
          callback: callbackUrl,
          secret: clientSecret,
        },
      }),
    });

    const subData = await subRes.json();

    if (subRes.status === 409) {
      return NextResponse.json({ success: true, message: 'Already subscribed', streamerId: userId });
    }
    if (!subRes.ok) {
      return NextResponse.json(
        { error: subData.message || 'Subscription failed', details: subData },
        { status: subRes.status }
      );
    }

    return NextResponse.json({
      success: true,
      subId: subData.data?.[0]?.id,
      streamerId: userId,
      callbackUrl,
    });
  } catch (err: any) {
    console.error('[cs2/subscribe]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
