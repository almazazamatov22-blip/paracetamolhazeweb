import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source');
  const target = request.nextUrl.clone();
  target.pathname = '/auth/twitch';
  target.search = source ? `?source=${encodeURIComponent(source)}` : '';
  return NextResponse.redirect(target);
}

