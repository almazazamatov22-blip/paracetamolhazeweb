import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const PROFILE_LOBBY_ID = '00000000-0000-0000-0000-000000000000';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  '';

function normalizeGames(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizeAvatar(value: unknown): string {
  const avatar = String(value ?? '').trim();
  if (!avatar) return '👤';
  if (avatar.startsWith('data:image/')) return avatar;
  if (avatar.length <= 8) return avatar;
  return '👤';
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json(
      {
        user_id: userId,
        games_played: 0,
        games_won: 0,
        total_score: 0,
        avatar: '👤',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: profile, error: profileErr } = await sb
      .from('loto_players')
      .select('nickname,avatar,games_played,games_won')
      .eq('id', userId)
      .eq('lobby_id', PROFILE_LOBBY_ID)
      .maybeSingle();
    if (profileErr) throw profileErr;

    let row = profile;
    if (!row) {
      const { data: rows, error: rowsErr } = await sb
        .from('loto_players')
        .select('nickname,avatar,games_played,games_won')
        .eq('id', userId)
        .neq('lobby_id', PROFILE_LOBBY_ID)
        .limit(50);
      if (rowsErr) throw rowsErr;
      if (rows && rows.length) {
        row = [...rows].sort((a: any, b: any) => {
          const playedDiff = normalizeGames(b.games_played) - normalizeGames(a.games_played);
          if (playedDiff !== 0) return playedDiff;
          return normalizeGames(b.games_won) - normalizeGames(a.games_won);
        })[0];
      }
    }

    const games_played = normalizeGames((row as any)?.games_played);
    const games_won = normalizeGames((row as any)?.games_won);
    const total_score = games_won * 100;

    return NextResponse.json(
      {
        user_id: userId,
        nickname: (row as any)?.nickname || null,
        avatar: sanitizeAvatar((row as any)?.avatar),
        games_played,
        games_won,
        total_score,
        win_rate: games_played > 0 ? Math.round((games_won / games_played) * 100) : 0,
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  } catch {
    return NextResponse.json(
      {
        user_id: userId,
        games_played: 0,
        games_won: 0,
        total_score: 0,
        avatar: '👤',
      },
      {
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
