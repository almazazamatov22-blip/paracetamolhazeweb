import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/cs2-launcher-auth';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { refreshToken } = await request.json();
    if (!refreshToken) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const payload = verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.expiresAt) {
      return NextResponse.json({ error: 'token_expired' }, { status: 401 });
    }

    return NextResponse.json({
      access: true,
      subscriptionActive: true,
      plan: "free",
      streamerId: payload.streamerId,
      displayName: payload.displayName,
      refreshToken: refreshToken
    });
  } catch (err) {
    console.error('Auth Refresh Error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
