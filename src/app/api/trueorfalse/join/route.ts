import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/trueorfalse/join — join existing lobby
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { lobbyId, playerId, name, twitchId, avatarUrl } = body;

  if (!lobbyId || !playerId || !name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  // Check lobby exists and is in waiting state
  const { data: lobby, error: lobbyErr } = await supabase
    .from('tof_lobbies')
    .select('status')
    .eq('id', lobbyId)
    .maybeSingle();

  if (lobbyErr) return NextResponse.json({ error: lobbyErr.message }, { status: 500 });
  if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  if (lobby.status !== 'waiting') return NextResponse.json({ error: 'Game already started' }, { status: 409 });

  // Upsert player
  const { error } = await supabase.from('tof_players').upsert({
    id: playerId,
    lobby_id: lobbyId,
    name,
    score: 0,
    is_host: false,
    twitch_id: twitchId ?? null,
    avatar_url: avatarUrl ?? null,
  }, { onConflict: 'id,lobby_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
