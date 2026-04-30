import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('twitch_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = process.env.TWITCH_CLIENT_ID;

  try {
    const res = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId!,
      },
    });

    const data = await res.json();

    if (!res.ok || !data.data || data.data.length === 0) {
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    const user = data.data[0];
    return NextResponse.json({
      id: user.id,
      login: user.login,
      display_name: user.display_name,
      profile_image_url: user.profile_image_url,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
