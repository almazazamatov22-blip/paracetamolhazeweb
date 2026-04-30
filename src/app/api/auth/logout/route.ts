import { NextRequest, NextResponse } from 'next/server';
import { getRequestBaseUrl } from '@/lib/auth-origin';

function sourcePath(source: string | null) {
  if (source === '67') return '/67';
  if (source === 'kinokadr') return '/kinokadr';
  if (source === 'emojino') return '/emojino';
  if (source === 'poker') return '/poker';
  if (source === 'kinoquiz') return '/kinoquiz';
  return '/';
}

export async function GET(request: NextRequest) {
  const source = request.nextUrl.searchParams.get('source');
  const baseUrl = getRequestBaseUrl(request);

  const target = `${baseUrl}${sourcePath(source)}`;
  const response = NextResponse.redirect(target);

  response.cookies.set('twitch_token', '', {
    httpOnly: true,
    secure: baseUrl.startsWith('https://'),
    sameSite: 'lax',
    path: '/',
    expires: new Date(0)
  });

  return response;
}
