import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/cs2-launcher-auth';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const token = request.cookies.get('twitch_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  
  const clientId = process.env.TWITCH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  try {
    const userResult = await fetch('https://api.twitch.tv/helix/users', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Client-Id': clientId,
      },
    });
    
    if (!userResult.ok) {
      return NextResponse.json({ error: 'twitch_api_error' }, { status: 401 });
    }
    
    const data = await userResult.json();
    const user = data?.data?.[0];
    
    if (!user) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const now = Math.floor(Date.now() / 1000);
    const connectToken = signToken({
      type: 'connect',
      streamerId: user.id,
      displayName: user.display_name || user.login,
      issuedAt: now,
      expiresAt: now + 300 // 5 minutes
    });

    return NextResponse.json({ token: connectToken });
  } catch (err) {
    console.error('Connect Token Error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
