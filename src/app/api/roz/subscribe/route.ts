import { NextRequest, NextResponse } from 'next/server';
import { getRequestBaseUrl } from '@/lib/auth-origin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;

    if (!token || !clientId || !clientSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
      },
      cache: 'no-store',
    });
    const userData = await userRes.json().catch(() => null);
    const userId = userData?.data?.[0]?.id;

    if (!userRes.ok || !userId) {
      return NextResponse.json({ error: 'Auth fail' }, { status: 401 });
    }

    const appTokenRes = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    });
    const appTokenData = await appTokenRes.json().catch(() => null);
    const appToken = appTokenData?.access_token;

    if (!appTokenRes.ok || !appToken) {
      return NextResponse.json({ error: 'Failed to get Twitch app token' }, { status: 502 });
    }

    const baseUrl = getRequestBaseUrl(req);
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
          callback: `${baseUrl}/api/ov_webhook`,
          secret: clientSecret,
        },
      }),
    });
    const subData = await subRes.json().catch(() => null);

    if (subRes.status === 409) {
      return NextResponse.json({ success: true, message: 'Already subscribed' });
    }

    if (!subRes.ok) {
      return NextResponse.json(
        { error: subData?.message || 'Subscription failed' },
        { status: subRes.status },
      );
    }

    return NextResponse.json({ success: true, subId: subData?.data?.[0]?.id });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
