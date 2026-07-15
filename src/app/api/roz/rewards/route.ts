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

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    const clientId = process.env.TWITCH_CLIENT_ID;

    if (!token || !clientId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, cost } = await req.json();
    if (!title || !cost) {
      return NextResponse.json({ error: 'Missing title or cost' }, { status: 400 });
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

    const createRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        cost,
        is_user_input_required: false,
      }),
    });
    const createData = await createRes.json().catch(() => null);

    if (!createRes.ok) {
      return NextResponse.json(
        { error: createData?.message || 'Failed to create Twitch reward' },
        { status: createRes.status },
      );
    }

    const reward = createData.data[0];
    return NextResponse.json({
      id: reward.id,
      title: reward.title,
      cost: reward.cost,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    const clientId = process.env.TWITCH_CLIENT_ID;

    if (!token || !clientId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, action } = body;

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

    if (action === 'cleanup') {
      const rewardsRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Client-Id': clientId,
        },
      });
      const rewardsData = await rewardsRes.json().catch(() => null);
      if (!rewardsRes.ok) return NextResponse.json({ error: 'Failed to fetch rewards' }, { status: rewardsRes.status });
      
      const rewardsToDelete = (rewardsData?.data || []).filter((r: any) => r.title.includes('.by paracetamolhaze'));
      
      for (const r of rewardsToDelete) {
        await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userId}&id=${r.id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Client-Id': clientId,
          },
        });
      }
      return NextResponse.json({ success: true, deleted: rewardsToDelete.length });
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const deleteRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userId}&id=${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': clientId,
      },
    });

    if (!deleteRes.ok && deleteRes.status !== 204) {
      const deleteData = await deleteRes.json().catch(() => null);
      return NextResponse.json(
        { error: deleteData?.message || 'Failed to delete Twitch reward' },
        { status: deleteRes.status },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

