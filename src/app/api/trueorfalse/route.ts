import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function genId(): string {
  return Math.random().toString(36).slice(2, 11);
}

// POST /api/trueorfalse — create lobby
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { hostId, hostName, avatarUrl, twitchId } = body;

  if (!hostId || !hostName) {
    return NextResponse.json({ error: 'Missing hostId or hostName' }, { status: 400 });
  }

  let code = genCode();
  // ensure uniqueness
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.from('tof_lobbies').select('id').eq('code', code).maybeSingle();
    if (!data) break;
    code = genCode();
  }

  const lobbyId = genId();

  const { error: lobbyErr } = await supabase.from('tof_lobbies').insert({
    id: lobbyId,
    code,
    host_id: hostId,
    host_name: hostName,
    status: 'waiting',
    current_fact_idx: 0,
    facts: [],
    vote_results: [],
  });

  if (lobbyErr) {
    return NextResponse.json({ error: lobbyErr.message }, { status: 500 });
  }

  const { error: playerErr } = await supabase.from('tof_players').insert({
    id: hostId,
    lobby_id: lobbyId,
    name: hostName,
    score: 0,
    is_host: true,
    twitch_id: twitchId ?? null,
    avatar_url: avatarUrl ?? null,
  });

  if (playerErr) {
    return NextResponse.json({ error: playerErr.message }, { status: 500 });
  }

  return NextResponse.json({ lobbyId, code });
}

// GET /api/trueorfalse?code=XXXX — find lobby by code
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 });

  const { data, error } = await supabase
    .from('tof_lobbies')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });

  return NextResponse.json(data);
}
