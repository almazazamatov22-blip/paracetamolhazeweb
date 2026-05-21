import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    const clientId = process.env.TWITCH_CLIENT_ID;

    if (!token || !clientId) {
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

    const rewardsRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
      },
      cache: 'no-store',
    });
    const rewardsData = await rewardsRes.json().catch(() => null);

    if (!rewardsRes.ok) {
      return NextResponse.json(
        { error: rewardsData?.message || 'Failed to fetch Twitch rewards' },
        { status: rewardsRes.status },
      );
    }

    const rewards = (rewardsData?.data || []).map((reward: any) => ({
      id: reward.id,
      title: reward.title,
      cost: reward.cost,
      userInputRequired: reward.is_user_input_required,
      isEnabled: reward.is_enabled,
      isPaused: reward.is_paused,
      isInStock: reward.is_in_stock,
    }));

    return NextResponse.json(rewards);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
