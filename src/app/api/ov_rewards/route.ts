import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('twitch_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = process.env.TWITCH_CLIENT_ID;
    
    // 1. Get User ID
    const authRes = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    const authData = await authRes.json();
    const userId = authData.data?.[0]?.id;
    if (!userId) return NextResponse.json({ error: 'Auth fail' }, { status: 401 });

    // 2. Fetch Rewards from Twitch
    const rewardsRes = await fetch(`https://api.twitch.tv/helix/channel_points/custom_rewards?broadcaster_id=${userId}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });
    
    const rewardsData = await rewardsRes.json();
    
    if (rewardsData.error) {
       return NextResponse.json({ error: rewardsData.message }, { status: rewardsRes.status });
    }

    // Return only active rewards that allow user input (since we need the number)
    const activeRewards = (rewardsData.data || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      userInputRequired: r.is_user_input_required
    }));

    return NextResponse.json(activeRewards);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
