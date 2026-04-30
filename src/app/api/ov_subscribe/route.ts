import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('host');
    const callbackUrl = `${protocol}://${host}/api/ov_webhook`;

    // 1. Get User ID
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Auth fail' }, { status: 401 });

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

    // 3. Register Product EventSub
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
          secret: clientSecret
        }
      })
    });

    const subData = await subRes.json();
    
    if (subRes.status === 409) {
        return NextResponse.json({ success: true, message: 'Already subscribed' });
    }

    if (!subRes.ok) {
       return NextResponse.json({ error: subData.message || 'Subscription failed' }, { status: subRes.status });
    }

    return NextResponse.json({ success: true, subId: subData.data?.[0]?.id });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
