import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

const API_BASE = 'https://followage.showmasterokda.com';

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
  'Origin': 'https://followage.showmasterokda.com',
  'Referer': 'https://followage.showmasterokda.com/',
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const username = searchParams.get('username');

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  // Update stats in background
  if (redis) {
    const cleanUsername = username.trim().toLowerCase();
    redis.incr('twitch_total_searches').catch(() => {});
    redis.sadd('twitch_unique_users', cleanUsername).catch(() => {});
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(
      `${API_BASE}/api_proxy.php?action=user&username=${encodeURIComponent(username)}`,
      {
        headers: HEADERS,
        cache: 'no-store',
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch user data: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Twitch user:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
