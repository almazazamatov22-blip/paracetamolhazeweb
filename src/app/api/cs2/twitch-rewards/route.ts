import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/cs2/twitch-rewards
 * Fetches the streamer's custom Channel Point rewards from Twitch Helix API.
 * Requires the user to be logged in (twitch_token cookie).
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json({ error: 'TWITCH_CLIENT_ID not configured' }, { status: 500 });
    }

    // First get the user's broadcaster ID
    const userRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId,
      },
    });

    const userData = await userRes.json();
    if (!userRes.ok || !userData.data?.length) {
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    const broadcasterId = userData.data[0].id;

    // Fetch custom rewards for this broadcaster
    const rewardsRes = await fetch(
      `https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${broadcasterId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Client-Id': clientId,
        },
      }
    );

    if (!rewardsRes.ok) {
      const errData = await rewardsRes.json().catch(() => ({}));
      // If the user doesn't have affiliate/partner status, they can't have custom rewards
      if (rewardsRes.status === 403) {
        return NextResponse.json({
          rewards: [],
          warning: 'Для создания наград за баллы канала нужен статус Компаньона или Партнёра Twitch.',
        });
      }
      return NextResponse.json(
        { error: errData.message || 'Failed to fetch rewards from Twitch' },
        { status: rewardsRes.status }
      );
    }

    const rewardsData = await rewardsRes.json();
    const rewards = (rewardsData.data || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      cost: r.cost,
      is_enabled: r.is_enabled,
      background_color: r.background_color,
      image_url: r.image?.url_1x || r.default_image?.url_1x || null,
    }));

    return NextResponse.json({ rewards });
  } catch (err: any) {
    console.error('[cs2/twitch-rewards]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
