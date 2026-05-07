import { NextRequest, NextResponse } from 'next/server';
import { getBredLobbyById, upsertBredPlayer } from '@/lib/bred-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lobbyId, playerId, name, twitchId, avatarUrl } = body;

    if (!lobbyId || !playerId || !name) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    const lobby = await getBredLobbyById(String(lobbyId));
    if (!lobby) return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
    if (lobby.status !== 'waiting' && lobby.status !== 'lobby') {
      return NextResponse.json({ error: 'Game already started' }, { status: 409 });
    }

    const nextLobby = await upsertBredPlayer(String(lobbyId), {
      id: String(playerId),
      name: String(name),
      score: 0,
      is_host: false,
      twitch_id: twitchId ? String(twitchId) : null,
      avatar_url: avatarUrl ? String(avatarUrl) : null,
      submitted_fact: false,
      fact_a: null,
      fact_b: null,
      truth_index: null,
      fact_entries: [],
    });

    return NextResponse.json({ ok: true, lobby: nextLobby, players: nextLobby?.players ?? [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to join lobby' }, { status: 500 });
  }
}
