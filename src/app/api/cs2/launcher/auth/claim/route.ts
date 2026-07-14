import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signToken } from '@/lib/cs2-launcher-auth';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = body?.token ?? body?.connectToken;
    if (!token) {
      return NextResponse.json({ error: 'missing_token' }, { status: 400 });
    }

    const payload = verifyToken(token);
    if (!payload || payload.type !== 'connect') {
      return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > payload.expiresAt) {
      return NextResponse.json({ error: 'token_expired' }, { status: 401 });
    }

    const refreshToken = signToken({
      type: 'refresh',
      streamerId: payload.streamerId,
      displayName: payload.displayName,
      issuedAt: now,
      expiresAt: now + 30 * 24 * 60 * 60 // 30 days
    });

    return NextResponse.json({
      access: true,
      subscriptionActive: true,
      plan: "free",
      streamerId: payload.streamerId,
      displayName: payload.displayName,
      refreshToken: refreshToken
    });
  } catch (err) {
    console.error('Auth Claim Error:', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
