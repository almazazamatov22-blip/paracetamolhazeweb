import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = process.env.KV_REST_API_URL ? new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
}) : null;

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('twitch_token')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const clientId = process.env.TWITCH_CLIENT_ID;

  try {
    const response = await fetch('https://api.twitch.tv/helix/users', {
      headers: { 'Authorization': `Bearer ${token}`, 'Client-Id': clientId! },
    });

    const data = await response.json();
    if (!response.ok || !data.data?.[0]) return NextResponse.json({ error: 'Twitch Error' }, { status: 500 });

    return NextResponse.json(data.data[0]);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
