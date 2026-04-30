import { NextRequest, NextResponse } from 'next/server';

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
  const limit = searchParams.get('limit') || '100';

  if (!username) {
    return NextResponse.json({ error: 'Username is required' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(
      `${API_BASE}/api_proxy.php?action=follows&username=${encodeURIComponent(username)}&limit=${limit}`,
      {
        headers: HEADERS,
        cache: 'no-store',
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: `Failed to fetch follows: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching Twitch follows:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
