import { NextRequest, NextResponse } from 'next/server';
import { getRequestBaseUrl } from '@/lib/auth-origin';

function targetUrl(baseUrl: string, source: string | null, error?: string) {
  let path = '/overlays/dashboard';
  if (source === '67') path = '/67';
  if (source === 'kinokadr') path = '/kinokadr';
  if (source === 'emojino') path = '/emojino';
  if (source === 'poker') path = '/poker';
  if (source === 'kinoquiz') path = '/kinoquiz';
  if (source === 'overlays') path = '/overlays/dashboard';

  return error ? `${baseUrl}${path}?error=${error}` : `${baseUrl}${path}`;
}

function shouldRegisterRealtimeHooks(source: string | null): boolean {
  return source === '67' || source === null || source === '';
}

async function fetchJson(
  input: string,
  init?: RequestInit,
  timeoutMs = 7000
): Promise<{ ok: boolean; status: number; data: any }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    const text = await response.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const source = searchParams.get('state');
  const baseUrl = getRequestBaseUrl(request);

  if (error) {
    return NextResponse.redirect(targetUrl(baseUrl, source, error));
  }

  if (!code) {
    return NextResponse.redirect(targetUrl(baseUrl, source, 'no_code'));
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(targetUrl(baseUrl, source, 'twitch_env_missing'));
  }

  const redirectUri = `${baseUrl}${request.nextUrl.pathname}`;
  const needs67Bootstrap = shouldRegisterRealtimeHooks(source);

  try {
    const tokenResult = await fetchJson('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResult.ok || !tokenResult.data?.access_token) {
      console.error('Twitch Token Error:', tokenResult.data);
      return NextResponse.redirect(targetUrl(baseUrl, source, 'auth_failed'));
    }
    const data = tokenResult.data;

    let user: any = null;
    if (needs67Bootstrap) {
      const userResult = await fetchJson(
        'https://api.twitch.tv/helix/users',
        {
          headers: {
            'Authorization': `Bearer ${data.access_token}`,
            'Client-Id': clientId!,
          },
        },
        4000
      );
      user = userResult.data?.data?.[0] ?? null;
    }
    
    if (needs67Bootstrap && user?.id) {
      const userId = user.id;

      try {
        const appTokenResult = await fetchJson(
          'https://id.twitch.tv/oauth2/token',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: clientId!,
              client_secret: clientSecret!,
              grant_type: 'client_credentials',
            }),
          },
          4000
        );
        const appTokenData = appTokenResult.data;

        if (appTokenData.access_token) {
          const subResult = await fetchJson(
            'https://api.twitch.tv/helix/eventsub/subscriptions',
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${appTokenData.access_token}`,
                'Client-Id': clientId!,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'channel.channel_points_custom_reward_redemption.add',
                version: '1',
                condition: { broadcaster_user_id: userId },
                transport: {
                  method: 'webhook',
                  callback: `${baseUrl}/api/ov_webhook`,
                  secret: clientSecret || 'fallback_secret_1234567890123',
                },
              }),
            },
            4000
          );
          if (!subResult.ok) {
            console.error('Webhook Sub Error:', subResult.data);
          }
        }
      } catch (subErr) {
        console.error('Webhook registration failed:', subErr);
      }
    }

    if (needs67Bootstrap && user) {
      const { supabase } = await import('@/lib/supabase');
      const { error: syncError } = await supabase
        .from('game_67_users')
        .upsert({
          twitch_id: user.id,
          username: user.display_name,
          login: user.login,
          image: user.profile_image_url
        }, { onConflict: 'twitch_id' });
      
      if (syncError) console.error('Supabase User Sync Error:', syncError);
    }

    const res = NextResponse.redirect(targetUrl(baseUrl, source));
    res.cookies.set('twitch_token', data.access_token, {
      httpOnly: true,
      secure: baseUrl.startsWith('https://'),
      sameSite: 'lax',
      path: '/',
      maxAge: data.expires_in,
    });

    return res;
  } catch (err) {
    console.error('Callback error:', err);
    return NextResponse.redirect(targetUrl(baseUrl, source, 'server_error'));
  }
}
