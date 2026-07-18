import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

async function getStreamerId(token: string): Promise<string> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) throw new Error('TWITCH_CLIENT_ID is missing');
  const res = await fetch('https://api.twitch.tv/helix/users', {
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': clientId },
  });
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error('Twitch API auth response is not JSON');
  }

  if (!res.ok) {
    throw new Error(data.message || 'Twitch API Auth Error');
  }
  if (!data.data?.[0]?.id) {
    throw new Error('User ID not found in Twitch response');
  }
  return data.data[0].id;
}

const BRAND_SUFFIX = 'paracetamolhaze.ru';

function stripBrandSuffix(description: string): string {
  let value = typeof description === 'string' ? description.trim() : '';

  while (value.toLowerCase().endsWith(BRAND_SUFFIX.toLowerCase())) {
    value = value.slice(0, -BRAND_SUFFIX.length).trim();
  }

  return value;
}

function appendBrandSuffix(description: string): string {
  const clean = stripBrandSuffix(description);
  return clean ? `${clean}\n\n${BRAND_SUFFIX}` : BRAND_SUFFIX;
}

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let streamerId;
    try {
      streamerId = await getStreamerId(token);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const clientId = process.env.TWITCH_CLIENT_ID;
    const rewardsRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });

    const rewardsData = await rewardsRes.json();

    if (!rewardsRes.ok || rewardsData.error) {
       return NextResponse.json({ error: rewardsData.message || 'Twitch API Error' }, { status: rewardsRes.status || 500 });
    }

    const activeRewards = (rewardsData.data || [])
      .filter((r: any) => r.is_user_input_required)
      .map((r: any) => ({
        id: r.id,
        title: r.title,
        prompt: r.prompt,
        description: stripBrandSuffix(r.prompt || ''),
        userInputRequired: r.is_user_input_required,
        cost: r.cost,
        backgroundColor: r.background_color,
        isEnabled: r.is_enabled
      }));

    return NextResponse.json(activeRewards);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let streamerId;
    try {
      streamerId = await getStreamerId(token);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const body = await req.json();
    let { title, description, cost } = body;

    if (typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'title is required and must be a non-empty string' }, { status: 400 });
    }
    title = title.trim();

    if (description !== undefined && typeof description !== 'string') {
      return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
    }

    const parsedCost = Number(cost);
    if (!Number.isInteger(parsedCost) || parsedCost <= 0) {
      return NextResponse.json({ error: 'cost must be a positive integer' }, { status: 400 });
    }

    const normalizedDescription = typeof description === 'string' ? description.trim() : '';

    const clientId = process.env.TWITCH_CLIENT_ID;
    const twitchRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        prompt: appendBrandSuffix(normalizedDescription),
        cost: parsedCost,
        is_user_input_required: true,
        is_enabled: true,
        background_color: '#9333ea'
      })
    });

    const twitchData = await twitchRes.json();
    if (!twitchRes.ok) {
      return NextResponse.json({ error: twitchData.message || 'Twitch API Error' }, { status: twitchRes.status });
    }

    const newReward = twitchData.data[0];
    return NextResponse.json({ success: true, reward: newReward });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let streamerId;
    try {
      streamerId = await getStreamerId(token);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const body = await req.json();
    const { id, title, description, cost, is_enabled } = body;

    if (typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'id must be a non-empty string' }, { status: 400 });
    }

    const normalizedId = id.trim();

    const payload: any = {};
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return NextResponse.json({ error: 'title must be a non-empty string' }, { status: 400 });
      payload.title = title.trim();
    }
    if (description !== undefined) {
      if (typeof description !== 'string') return NextResponse.json({ error: 'description must be a string' }, { status: 400 });
      payload.prompt = appendBrandSuffix(description);
    }
    if (cost !== undefined) {
      const parsedCost = Number(cost);
      if (!Number.isInteger(parsedCost) || parsedCost <= 0) return NextResponse.json({ error: 'cost must be a positive integer' }, { status: 400 });
      payload.cost = parsedCost;
    }
    if (is_enabled !== undefined) payload.is_enabled = Boolean(is_enabled);

    const clientId = process.env.TWITCH_CLIENT_ID;
    const twitchRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}&id=${encodeURIComponent(normalizedId)}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const twitchData = await twitchRes.json();
    if (!twitchRes.ok) {
      return NextResponse.json({ error: twitchData.message || 'Twitch API Error' }, { status: twitchRes.status });
    }

    return NextResponse.json({ success: true, reward: twitchData.data[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let streamerId;
    try {
      streamerId = await getStreamerId(token);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }

    const { id } = await req.json();
    if (typeof id !== 'string' || !id.trim()) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const normalizedId = id.trim();

    const clientId = process.env.TWITCH_CLIENT_ID;
    const twitchRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${streamerId}&id=${encodeURIComponent(normalizedId)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId!
      }
    });

    if (!twitchRes.ok && twitchRes.status !== 204) {
      let msg = 'Twitch API Error';
      try {
        const d = await twitchRes.json();
        if (d.message) msg = d.message;
      } catch (e) {}
      return NextResponse.json({ error: msg }, { status: twitchRes.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
