import { NextRequest, NextResponse } from 'next/server';
import {
  createBredLobby,
  getBredLobbyByCode,
  getBredLobbyById,
  updateBredLobby,
} from '@/lib/bred-store';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { hostId, hostName, avatarUrl, twitchId } = body;

  if (!hostId || !hostName) {
    return NextResponse.json({ error: 'Missing hostId or hostName' }, { status: 400 });
  }

  const lobby = await createBredLobby({
    hostId: String(hostId),
    hostName: String(hostName),
    twitchId: twitchId ? String(twitchId) : null,
    avatarUrl: avatarUrl ? String(avatarUrl) : null,
  });

  return NextResponse.json({ lobbyId: lobby.id, code: lobby.code, lobby, players: lobby.players });
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  const code = request.nextUrl.searchParams.get('code');

  if (!id && !code) {
    return NextResponse.json({ error: 'Missing id or code' }, { status: 400 });
  }

  const lobby = id ? await getBredLobbyById(id) : await getBredLobbyByCode(code!);

  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  return NextResponse.json(lobby);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing lobby id' }, { status: 400 });
  }

  const lobby = await updateBredLobby(String(id), updates);
  if (!lobby) {
    return NextResponse.json({ error: 'Lobby not found' }, { status: 404 });
  }

  return NextResponse.json(lobby);
}
