import { NextRequest, NextResponse } from 'next/server';
import { getRequestBaseUrl } from '@/lib/auth-origin';

function sourcePath(source: string) {
  if (source === '67') return '/67';
  if (source === 'kinokadr') return '/kinokadr';
  if (source === 'emojino') return '/emojino';
  if (source === 'poker') return '/poker';
  if (source === 'kinoquiz') return '/kinoquiz';
  if (source === 'overlays') return '/overlays/dashboard';
  return '/overlays/dashboard';
}

export async function GET(request: NextRequest) {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const source = request.nextUrl.searchParams.get('source') || '67';
  const origin = getRequestBaseUrl(request);
  const redirectUri = `${origin}/callback`;
  const scope = 'user:read:email chat:read chat:edit channel:read:redemptions';
  
  if (!clientId) {
    return NextResponse.redirect(`${origin}${sourcePath(source)}?error=twitch_client_id_missing`);
  }

  const twitchAuthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&state=${source}`;

  return NextResponse.redirect(twitchAuthUrl);
}
