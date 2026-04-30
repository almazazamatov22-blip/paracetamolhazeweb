import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

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

const PROFILE_LOBBY_ID = '00000000-0000-0000-0000-000000000000';
const MAX_NICKNAME_LENGTH = 24;
const MAX_AVATAR_LENGTH = 350_000;
const GAME_WON_CLEANUP_DELAY_MS = 20 * 60 * 1000;
const CLEANUP_CHECK_INTERVAL_MS = 60 * 60 * 1000;
let lastFinishedLobbyCleanupAt = 0;

function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });
}

function asString(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeLobbyId(value: unknown): string | null {
  const normalized = asString(value);
  if (!normalized || normalized === 'undefined' || normalized === 'null') return null;
  return normalized;
}

function normalizeGames(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function sanitizeNickname(value: unknown, userId = ''): string {
  let nickname = asString(value).replace(/\s+/g, ' ').trim();
  nickname = nickname.replace(/[^\p{L}\p{N}_ .-]/gu, '');
  if (!nickname) {
    const suffix = String(userId || '').replace(/\D/g, '').slice(-4) || String(Date.now()).slice(-4);
    nickname = `Игрок${suffix}`;
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) nickname = nickname.slice(0, MAX_NICKNAME_LENGTH);
  return nickname;
}

function sanitizeAvatar(value: unknown): string {
  const avatar = asString(value);
  if (!avatar) return '👤';
  if (avatar.startsWith('data:image/') && avatar.length <= MAX_AVATAR_LENGTH) return avatar;
  if (avatar.length <= 8) return avatar;
  return '👤';
}

function sanitizePassword(value: unknown): string | null {
  const password = asString(value);
  if (!password) return null;
  return password.slice(0, 64);
}

function parseCells(body: any): number[] {
  if (Array.isArray(body?.cells)) return body.cells.map(Number).filter((n: number) => Number.isFinite(n));
  const count = Number(body?.count) || 0;
  return Array.from({ length: Math.max(0, count) }, (_, i) => i);
}

function generateLobbyCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function generateFallbackCard(): (number | null)[][] {
  const ranges = [
    [1, 9],
    [10, 19],
    [20, 29],
    [30, 39],
    [40, 49],
    [50, 59],
    [60, 69],
    [70, 79],
    [80, 90],
  ];

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const colCount = Array(9).fill(0);
    const mask = Array.from({ length: 3 }, () => Array(9).fill(false));
    let ok = true;

    const requiredCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    shuffle(requiredCols);
    for (let i = 0; i < 9; i += 1) {
      const row = Math.floor(i / 3);
      const col = requiredCols[i];
      mask[row][col] = true;
      colCount[col] += 1;
    }

    for (let row = 0; row < 3; row += 1) {
      const need = 5 - mask[row].filter(Boolean).length;
      const available: number[] = [];
      for (let col = 0; col < 9; col += 1) {
        if (!mask[row][col] && colCount[col] < 2) available.push(col);
      }
      if (available.length < need) {
        ok = false;
        break;
      }
      shuffle(available);
      available.slice(0, need).forEach((col) => {
        mask[row][col] = true;
        colCount[col] += 1;
      });
    }
    if (!ok) continue;

    const card = Array.from({ length: 3 }, () => Array<number | null>(9).fill(null));
    for (let col = 0; col < 9; col += 1) {
      const [min, max] = ranges[col];
      const rows = [0, 1, 2].filter((row) => mask[row][col]);
      const pool: number[] = [];
      for (let n = min; n <= max; n += 1) pool.push(n);
      shuffle(pool);
      const chosen = pool.slice(0, rows.length).sort((a, b) => a - b);
      rows.sort((a, b) => a - b).forEach((row, index) => {
        card[row][col] = chosen[index];
      });
    }
    return card;
  }

  return Array.from({ length: 3 }, () => Array<number | null>(9).fill(null));
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function flattenCardNumbers(card: any): number[] {
  if (!Array.isArray(card)) return [];
  const result: number[] = [];
  for (const row of card) {
    if (!Array.isArray(row)) continue;
    for (const value of row) {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) result.push(n);
    }
  }
  return result;
}

function buildStateVersion(lobby: any, players: any[], markedCells: number[], drawn: number[]): string {
  const playersSig = (players || [])
    .map((p) => {
      const markedLen = Array.isArray(p.marked_cells) ? p.marked_cells.length : 0;
      return [
        String(p.id || ''),
        String(p.status || ''),
        asString(p.nickname).toLowerCase(),
        String(markedLen),
        String(normalizeGames(p.games_played)),
        String(normalizeGames(p.games_won)),
      ].join(':');
    })
    .sort()
    .join('|');
  const eventSig = lobby?.event ? JSON.stringify(lobby.event) : '';
  return [
    String(lobby?.status || ''),
    drawn.join(','),
    String(players.length || 0),
    playersSig,
    eventSig,
    String(markedCells.length),
  ].join('::');
}

function mapPlayers(players: any[]) {
  return (players || []).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatar: sanitizeAvatar(p.avatar),
    isAdmin: !!p.is_admin,
    status: p.status,
    games_played: normalizeGames(p.games_played),
    games_won: normalizeGames(p.games_won),
    progress: Array.isArray(p.marked_cells) ? p.marked_cells.length : 0,
  }));
}

function getEventTimestampMs(event: any): number | null {
  let eventPayload = event;
  if (typeof eventPayload === 'string') {
    try {
      eventPayload = JSON.parse(eventPayload);
    } catch {
      return null;
    }
  }
  if (!eventPayload || typeof eventPayload !== 'object') return null;
  const ts = Number((eventPayload as any).ts);
  if (!Number.isFinite(ts) || ts <= 0) return null;
  return ts;
}

function isGameWonEvent(event: any): boolean {
  let eventPayload = event;
  if (typeof eventPayload === 'string') {
    try {
      eventPayload = JSON.parse(eventPayload);
    } catch {
      return false;
    }
  }
  return !!eventPayload && typeof eventPayload === 'object' && (eventPayload as any).type === 'game_won';
}

async function cleanupExpiredWonLobbies(sb: SupabaseClient, nowMs = Date.now()) {
  const { data: finishedLobbies, error: readErr } = await sb
    .from('loto_lobbies')
    .select('id,event')
    .eq('status', 'finished')
    .neq('id', PROFILE_LOBBY_ID)
    .limit(300);
  if (readErr) throw readErr;

  const expiredLobbyIds = (finishedLobbies || [])
    .filter((lobby: any) => {
      const event = lobby?.event;
      if (!isGameWonEvent(event)) return false;
      const ts = getEventTimestampMs(event);
      return ts !== null && nowMs - ts >= GAME_WON_CLEANUP_DELAY_MS;
    })
    .map((lobby: any) => String(lobby.id))
    .filter(Boolean);

  if (!expiredLobbyIds.length) return 0;

  const { error: chatDeleteErr } = await sb
    .from('loto_chat')
    .delete()
    .in('lobby_id', expiredLobbyIds);
  if (chatDeleteErr) throw chatDeleteErr;

  const { error: lobbyDeleteErr } = await sb
    .from('loto_lobbies')
    .delete()
    .in('id', expiredLobbyIds);
  if (lobbyDeleteErr) throw lobbyDeleteErr;

  return expiredLobbyIds.length;
}

async function maybeRunFinishedLobbyCleanup(sb: SupabaseClient) {
  const nowMs = Date.now();
  if (nowMs - lastFinishedLobbyCleanupAt < CLEANUP_CHECK_INTERVAL_MS) return;
  lastFinishedLobbyCleanupAt = nowMs;
  try {
    await cleanupExpiredWonLobbies(sb, nowMs);
  } catch (error: any) {
    console.warn('Loto cleanup warning:', String(error?.message || error || 'Unknown cleanup error'));
  }
}

async function isNicknameTaken(sb: SupabaseClient, nickname: string, userId: string): Promise<boolean> {
  const { data, error } = await sb
    .from('loto_players')
    .select('id')
    .ilike('nickname', nickname)
    .neq('id', userId)
    .limit(1);
  if (error) throw error;
  return !!(data && data.length);
}

async function makeUniqueNickname(sb: SupabaseClient, nickname: string, userId: string): Promise<string> {
  let candidate = sanitizeNickname(nickname, userId);
  if (!(await isNicknameTaken(sb, candidate, userId))) return candidate;

  const fallback = sanitizeNickname(`${candidate}${String(userId).replace(/\D/g, '').slice(-4)}`, userId);
  if (!(await isNicknameTaken(sb, fallback, userId))) return fallback;

  for (let i = 0; i < 20; i += 1) {
    const rnd = String(Math.floor(1000 + Math.random() * 9000));
    const next = sanitizeNickname(`${candidate}${rnd}`, userId);
    if (!(await isNicknameTaken(sb, next, userId))) return next;
  }

  throw new Error('NICKNAME_TAKEN');
}

async function ensureNicknameFree(sb: SupabaseClient, nickname: string, userId: string): Promise<string> {
  const candidate = sanitizeNickname(nickname, userId);
  if (await isNicknameTaken(sb, candidate, userId)) {
    throw new Error('NICKNAME_TAKEN');
  }
  return candidate;
}

async function readProfileRow(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('loto_players')
    .select('*')
    .eq('id', userId)
    .eq('lobby_id', PROFILE_LOBBY_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function readFallbackProfileFromAnyLobby(sb: SupabaseClient, userId: string) {
  const { data, error } = await sb
    .from('loto_players')
    .select('nickname, avatar, games_played, games_won')
    .eq('id', userId)
    .neq('lobby_id', PROFILE_LOBBY_ID)
    .limit(50);
  if (error) throw error;
  if (!data || !data.length) return null;

  const sorted = [...data].sort((a, b) => {
    const pa = normalizeGames(a.games_played);
    const pb = normalizeGames(b.games_played);
    if (pb !== pa) return pb - pa;
    return normalizeGames(b.games_won) - normalizeGames(a.games_won);
  });
  return sorted[0];
}

async function upsertProfileRow(
  sb: SupabaseClient,
  userId: string,
  profile: { nickname: string; avatar: string; games_played: number; games_won: number }
) {
  const { error } = await sb.from('loto_players').upsert(
    {
      id: userId,
      lobby_id: PROFILE_LOBBY_ID,
      nickname: profile.nickname,
      avatar: profile.avatar,
      is_admin: false,
      status: 'profile',
      card: null,
      marked_cells: [],
      games_played: profile.games_played,
      games_won: profile.games_won,
    },
    { onConflict: 'id,lobby_id' }
  );
  if (error) throw error;
}

async function resolveProfile(
  sb: SupabaseClient,
  userId: string,
  requestedNickname: unknown,
  requestedAvatar: unknown
) {
  if (!userId) {
    return {
      nickname: sanitizeNickname(requestedNickname),
      avatar: sanitizeAvatar(requestedAvatar),
      games_played: 0,
      games_won: 0,
    };
  }

  await ensureProfileLobbyExists(sb);

  const profileRow = await readProfileRow(sb, userId);
  const fallbackRow = profileRow ? null : await readFallbackProfileFromAnyLobby(sb, userId);

  const baseNickname = sanitizeNickname(
    requestedNickname || profileRow?.nickname || fallbackRow?.nickname,
    userId
  );
  const nickname = await makeUniqueNickname(sb, baseNickname, userId);
  const avatar = sanitizeAvatar(requestedAvatar || profileRow?.avatar || fallbackRow?.avatar || '👤');
  const games_played = normalizeGames(profileRow?.games_played ?? fallbackRow?.games_played);
  const games_won = normalizeGames(profileRow?.games_won ?? fallbackRow?.games_won);

  await upsertProfileRow(sb, userId, { nickname, avatar, games_played, games_won });

  return { nickname, avatar, games_played, games_won };
}

async function ensureProfileLobbyExists(sb: SupabaseClient) {
  const { data, error } = await sb
    .from('loto_lobbies')
    .select('id')
    .eq('id', PROFILE_LOBBY_ID)
    .maybeSingle();
  if (error) throw error;
  if (data?.id) return;

  const code = await findFreeLobbyCode(sb);
  const { error: insertErr } = await sb
    .from('loto_lobbies')
    .insert({
      id: PROFILE_LOBBY_ID,
      code,
      name: 'System Profiles',
      password: null,
      admin_id: 'system-profile',
      max_players: 1,
      status: 'finished',
      mode: 'system',
      drawn_numbers: [],
      event: { type: 'profile_store', ts: 0 },
    })
    .select('id')
    .single();

  if (insertErr) {
    const msg = String(insertErr?.message || '').toLowerCase();
    const codeErr = String((insertErr as any)?.code || '');
    if (codeErr === '23505' || msg.includes('duplicate key')) return;
    throw insertErr;
  }
}

async function syncProfileFromPlayerRow(sb: SupabaseClient, player: any) {
  if (!player?.id) return;
  await upsertProfileRow(sb, String(player.id), {
    nickname: sanitizeNickname(player.nickname, String(player.id)),
    avatar: sanitizeAvatar(player.avatar),
    games_played: normalizeGames(player.games_played),
    games_won: normalizeGames(player.games_won),
  });
}

async function findFreeLobbyCode(sb: SupabaseClient): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const code = generateLobbyCode();
    const { data, error } = await sb
      .from('loto_lobbies')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    if (!data) return code;
  }
  return `L${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

async function readLobbyAndPlayers(sb: SupabaseClient, lobbyId: string) {
  const [{ data: lobby, error: lobbyErr }, { data: players, error: playersErr }] = await Promise.all([
    sb.from('loto_lobbies').select('*').eq('id', lobbyId).maybeSingle(),
    sb.from('loto_players').select('*').eq('lobby_id', lobbyId),
  ]);
  if (lobbyErr) throw lobbyErr;
  if (playersErr) throw playersErr;
  return { lobby, players: players || [] };
}

async function syncPlayerMarksToDrawn(sb: SupabaseClient, lobbyId: string, drawn: number[]) {
  const allowed = new Set(drawn.map(Number));
  const { data: players, error } = await sb
    .from('loto_players')
    .select('id, marked_cells')
    .eq('lobby_id', lobbyId);
  if (error) throw error;

  await Promise.all(
    (players || []).map(async (player) => {
      const current = Array.isArray(player.marked_cells) ? player.marked_cells.map(Number) : [];
      const next = current.filter((number) => allowed.has(number));
      if (next.length === current.length && next.every((number, index) => number === current[index])) return;

      const { error: updateErr } = await sb
        .from('loto_players')
        .update({ marked_cells: next })
        .eq('id', player.id)
        .eq('lobby_id', lobbyId);
      if (updateErr) throw updateErr;
    })
  );
}

async function readChatWithAvatars(sb: SupabaseClient, lobbyId: string, players: any[]) {
  const { data, error } = await sb
    .from('loto_chat')
    .select('id, user_id, nickname, text, created_at')
    .eq('lobby_id', lobbyId)
    .order('created_at', { ascending: true })
    .limit(50);
  if (error) throw error;

  const avatarByUserId = new Map<string, string>();
  for (const player of players || []) {
    avatarByUserId.set(String(player.id), sanitizeAvatar(player.avatar));
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    lobbyId,
    userId: row.user_id,
    nickname: row.nickname,
    avatar: avatarByUserId.get(String(row.user_id)) || '👤',
    text: row.text,
    timestamp: row.created_at,
  }));
}

async function handleAction(
  sb: SupabaseClient,
  action: string | null,
  body: any,
  lobbyId: string | null,
  userId: string,
  nickname: string,
  avatar: string
) {
  switch (action) {
    case 'auth': {
      if (!userId) return json({ type: 'error', message: 'Missing userId' });
      const profile = await resolveProfile(sb, userId, nickname, avatar);
      return json({
        type: 'auth_success',
        user: {
          id: userId,
          nickname: profile.nickname,
          avatar: profile.avatar,
          games_played: profile.games_played,
          games_won: profile.games_won,
        },
      });
    }

    case 'get_state': {
      if (!lobbyId) return json({ type: 'no_change' });
      const { lobby, players } = await readLobbyAndPlayers(sb, lobbyId);
      if (!lobby) return json({ error: 'Lobby not found' }, 404);

      const clientVersion = asString(body?.v || body?.version);
      const drawn = (lobby.drawn_numbers || []).map(Number);
      let card: (number | null)[][] | null = null;
      let markedCells: number[] = [];
      const playerRow = userId ? (players || []).find((p) => String(p.id) === userId) : null;
      if (playerRow) {
        card = playerRow.card || null;
        markedCells = Array.isArray(playerRow.marked_cells) ? playerRow.marked_cells.map(Number) : [];
      }

      const version = buildStateVersion(lobby, players, markedCells, drawn);
      if (clientVersion && clientVersion === version) {
        return json({ type: 'no_change', version });
      }

      const chat = await readChatWithAvatars(sb, lobbyId, players);

      return json({
        type: 'state_update',
        version,
        drawn,
        isAdmin: String(lobby.admin_id) === userId,
        card,
        markedCells,
        chat,
        lobby: {
          id: lobby.id,
          code: lobby.code,
          name: lobby.name,
          status: lobby.status,
          admin_id: lobby.admin_id,
          max_players: lobby.max_players,
          players: mapPlayers(players),
        },
      });
    }

    case 'list_lobbies': {
      const { data: lobbies, error: lobbiesErr } = await sb
        .from('loto_lobbies')
        .select('id, code, name, max_players, status, password')
        .in('status', ['waiting', 'playing'])
        .limit(50);
      if (lobbiesErr) throw lobbiesErr;
      if (!lobbies?.length) return json([]);

      const mapped = await Promise.all(
        lobbies.map(async (lobby: any) => {
          const { count, error: countErr } = await sb
            .from('loto_players')
            .select('id', { count: 'exact', head: true })
            .eq('lobby_id', lobby.id);
          if (countErr) throw countErr;
          return {
            id: lobby.id,
            code: lobby.code,
            name: lobby.name,
            max_players: lobby.max_players,
            status: lobby.status,
            players_count: count || 0,
            has_password: asString(lobby.password) ? 1 : 0,
          };
        })
      );
      return json(mapped);
    }

    case 'create_lobby': {
      if (!userId) return json({ type: 'error', message: 'Missing userId' });
      const profile = await resolveProfile(sb, userId, nickname, avatar);
      const code = await findFreeLobbyCode(sb);
      const password = sanitizePassword(body?.password);

      const { data: lobby, error: createErr } = await sb
        .from('loto_lobbies')
        .insert({
          code,
          name: body?.name || 'Моя игра',
          password,
          admin_id: userId,
          max_players: body?.maxPlayers || 10,
          status: 'waiting',
          mode: asString(body?.mode) || 'classic',
          drawn_numbers: [],
          event: { type: 'lobby_created', ts: Date.now() },
        })
        .select()
        .single();
      if (createErr) throw createErr;

      const { error: upsertErr } = await sb.from('loto_players').upsert(
        {
          id: userId,
          lobby_id: lobby.id,
          nickname: profile.nickname,
          avatar: profile.avatar,
          games_played: profile.games_played,
          games_won: profile.games_won,
          is_admin: true,
          status: 'waiting',
        },
        { onConflict: 'id,lobby_id' }
      );
      if (upsertErr) throw upsertErr;

      return json({
        type: 'lobby_created',
        lobby: {
          id: lobby.id,
          code: lobby.code,
          name: lobby.name,
          status: lobby.status,
          admin_id: lobby.admin_id,
          max_players: lobby.max_players,
          players: [
            {
              id: userId,
              nickname: profile.nickname,
              avatar: profile.avatar,
              games_played: profile.games_played,
              games_won: profile.games_won,
              isAdmin: true,
            },
          ],
        },
      });
    }

    case 'join_lobby': {
      if (!userId) return json({ type: 'error', message: 'Missing userId' });
      const code = asString(body?.code).toUpperCase();
      if (!code) return json({ type: 'error', message: 'Enter lobby code' });

      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (lobbyErr) throw lobbyErr;

      if (!lobby) return json({ type: 'error', message: 'Lobby not found' });
      if (lobby.status === 'finished') return json({ type: 'error', message: 'Game is already finished' });
      if (lobby.status !== 'waiting') return json({ type: 'error', message: 'Game already started' });

      const expectedPassword = asString(lobby.password);
      const providedPassword = asString(body?.password);
      if (expectedPassword && expectedPassword !== providedPassword) {
        return json({ type: 'error', message: 'Неверный пароль' });
      }

      const profile = await resolveProfile(sb, userId, nickname, avatar);
      const isAdminHere = String(lobby.admin_id) === userId;
      const { error: joinErr } = await sb.from('loto_players').upsert(
        {
          id: userId,
          lobby_id: lobby.id,
          nickname: profile.nickname,
          avatar: profile.avatar,
          games_played: profile.games_played,
          games_won: profile.games_won,
          is_admin: isAdminHere,
          status: 'waiting',
        },
        { onConflict: 'id,lobby_id' }
      );
      if (joinErr) throw joinErr;

      return json({
        type: 'lobby_joined',
        lobbyId: lobby.id,
        isAdmin: isAdminHere,
      });
    }

    case 'leave_lobby': {
      if (lobbyId && userId) {
        const { error } = await sb
          .from('loto_players')
          .delete()
          .eq('id', userId)
          .eq('lobby_id', lobbyId);
        if (error) throw error;
      }
      return json({ type: 'left_lobby' });
    }

    case 'start_game': {
      if (!lobbyId) return json({ type: 'error', message: 'No lobby id' });

      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies')
        .select('admin_id,status')
        .eq('id', lobbyId)
        .single();
      if (lobbyErr) throw lobbyErr;
      if (!lobby || String(lobby.admin_id) !== userId) {
        return json({ type: 'error', message: 'Only host can start game' });
      }

      const { data: players, error: playersErr } = await sb
        .from('loto_players')
        .select('id,nickname,avatar,games_played,games_won')
        .eq('lobby_id', lobbyId);
      if (playersErr) throw playersErr;

      await Promise.all(
        (players || []).map(async (player: any) => {
          const nextPlayed = normalizeGames(player.games_played) + 1;
          const { error: updErr } = await sb
            .from('loto_players')
            .update({
              card: generateFallbackCard(),
              status: 'playing',
              marked_cells: [],
              games_played: nextPlayed,
            })
            .eq('id', player.id)
            .eq('lobby_id', lobbyId);
          if (updErr) throw updErr;

          await upsertProfileRow(sb, String(player.id), {
            nickname: sanitizeNickname(player.nickname, String(player.id)),
            avatar: sanitizeAvatar(player.avatar),
            games_played: nextPlayed,
            games_won: normalizeGames(player.games_won),
          });
        })
      );

      const { error: startErr } = await sb
        .from('loto_lobbies')
        .update({
          status: 'playing',
          drawn_numbers: [],
          event: { type: 'game_started', ts: Date.now() },
        })
        .eq('id', lobbyId);
      if (startErr) throw startErr;

      return handleAction(sb, 'get_state', { lobbyId, userId, nickname, avatar }, lobbyId, userId, nickname, avatar);
    }

    case 'draw_number': {
      if (!lobbyId) return json({ type: 'error', message: 'No lobby id' });
      const number = Number(body?.number);
      if (!Number.isInteger(number) || number < 1 || number > 90) {
        return json({ type: 'error', message: 'Number must be between 1 and 90' });
      }

      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies')
        .select('drawn_numbers, admin_id')
        .eq('id', lobbyId)
        .single();
      if (lobbyErr) throw lobbyErr;
      if (!lobby) return json({ error: 'Lobby not found' }, 404);
      if (String(lobby.admin_id) !== userId) {
        return json({ type: 'error', message: 'Only host can draw numbers' });
      }

      const drawn = Array.isArray(lobby.drawn_numbers) ? [...lobby.drawn_numbers] : [];
      if (drawn.includes(number)) return json({ type: 'error', message: 'Number already drawn' });
      drawn.push(number);

      const { error: updErr } = await sb
        .from('loto_lobbies')
        .update({ drawn_numbers: drawn, event: { type: 'number_drawn', ts: Date.now(), number } })
        .eq('id', lobbyId);
      if (updErr) throw updErr;

      return json({ type: 'state_update', drawn, all: drawn });
    }

    case 'undo_number': {
      if (!lobbyId) return json({ type: 'state_update', all: [], drawn: [] });
      const number = Number(body?.number);
      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies')
        .select('drawn_numbers')
        .eq('id', lobbyId)
        .single();
      if (lobbyErr) throw lobbyErr;
      const current = Array.isArray(lobby?.drawn_numbers) ? lobby.drawn_numbers.map(Number) : [];
      const next =
        Number.isInteger(number) && number > 0
          ? current.filter((n) => n !== number)
          : current.slice(0, -1);
      const { error: updErr } = await sb
        .from('loto_lobbies')
        .update({ drawn_numbers: next, event: { type: 'number_undone', ts: Date.now(), number } })
        .eq('id', lobbyId);
      if (updErr) throw updErr;
      await syncPlayerMarksToDrawn(sb, lobbyId, next);
      return json({ type: 'state_update', all: next, drawn: next });
    }

    case 'reset_numbers': {
      if (lobbyId) {
        const { error: resetErr } = await sb
          .from('loto_lobbies')
          .update({ drawn_numbers: [], event: { type: 'numbers_reset', ts: Date.now() } })
          .eq('id', lobbyId);
        if (resetErr) throw resetErr;
        const { error: clearMarksErr } = await sb
          .from('loto_players')
          .update({ marked_cells: [] })
          .eq('lobby_id', lobbyId);
        if (clearMarksErr) throw clearMarksErr;
      }
      return json({ type: 'state_update', all: [], drawn: [] });
    }

    case 'chat_message': {
      if (!lobbyId) return json({ type: 'success' });
      const profile = await resolveProfile(sb, userId, nickname, avatar);
      const { data: msg, error: msgErr } = await sb
        .from('loto_chat')
        .insert({
          lobby_id: lobbyId,
          user_id: userId,
          nickname: profile.nickname,
          text: body?.text || '',
        })
        .select()
        .single();
      if (msgErr) throw msgErr;
      const { error: chatEventErr } = await sb
        .from('loto_lobbies')
        .update({ event: { type: 'chat_message', ts: Date.now(), userId } })
        .eq('id', lobbyId);
      if (chatEventErr) throw chatEventErr;

      return json({
        type: 'chat_message',
        message: msg
          ? {
              id: msg.id,
              lobbyId,
              userId: msg.user_id,
              nickname: msg.nickname,
              avatar: profile.avatar,
              text: msg.text,
              timestamp: msg.created_at,
            }
          : null,
      });
    }

    case 'clear_chat': {
      if (!lobbyId) return json({ type: 'error', message: 'No lobby id' });

      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies')
        .select('admin_id')
        .eq('id', lobbyId)
        .maybeSingle();
      if (lobbyErr) throw lobbyErr;
      if (!lobby) return json({ error: 'Lobby not found' }, 404);
      if (String(lobby.admin_id) !== userId) {
        return json({ type: 'error', message: 'Only host can clear chat' });
      }

      const { error: clearErr } = await sb
        .from('loto_chat')
        .delete()
        .eq('lobby_id', lobbyId);
      if (clearErr) throw clearErr;
      const { error: clearEventErr } = await sb
        .from('loto_lobbies')
        .update({ event: { type: 'chat_cleared', ts: Date.now(), userId } })
        .eq('id', lobbyId);
      if (clearEventErr) throw clearEventErr;

      return json({ type: 'chat_cleared', lobbyId });
    }

    case 'update_profile': {
      if (!userId) return json({ type: 'error', message: 'Missing userId' });

      const currentProfile = await resolveProfile(sb, userId, nickname, avatar);
      const nextNickname = body?.nickname !== undefined
        ? await ensureNicknameFree(sb, sanitizeNickname(body.nickname, userId), userId)
        : currentProfile.nickname;
      const nextAvatar = body?.avatar !== undefined
        ? sanitizeAvatar(body.avatar)
        : currentProfile.avatar;

      await upsertProfileRow(sb, userId, {
        nickname: nextNickname,
        avatar: nextAvatar,
        games_played: normalizeGames(currentProfile.games_played),
        games_won: normalizeGames(currentProfile.games_won),
      });

      const { error: syncRowsErr } = await sb
        .from('loto_players')
        .update({ nickname: nextNickname, avatar: nextAvatar })
        .eq('id', userId)
        .neq('lobby_id', PROFILE_LOBBY_ID);
      if (syncRowsErr) throw syncRowsErr;

      return json({
        type: 'profile_updated',
        profile: {
          id: userId,
          nickname: nextNickname,
          avatar: nextAvatar,
          games_played: normalizeGames(currentProfile.games_played),
          games_won: normalizeGames(currentProfile.games_won),
        },
      });
    }

    case 'mark_cell': {
      if (!lobbyId || !userId) return json({ type: 'success' });

      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies')
        .select('drawn_numbers,status')
        .eq('id', lobbyId)
        .maybeSingle();
      if (lobbyErr) throw lobbyErr;
      if (!lobby) return json({ type: 'error', message: 'Lobby not found' });

      const { data: player, error: playerErr } = await sb
        .from('loto_players')
        .select('card, marked_cells, nickname, avatar, games_played, games_won')
        .eq('id', userId)
        .eq('lobby_id', lobbyId)
        .maybeSingle();
      if (playerErr) throw playerErr;
      if (!player) return json({ type: 'error', message: 'Player not found in lobby' });

      const allowed = new Set((lobby.drawn_numbers || []).map(Number));
      const cells = parseCells(body).filter((number) => allowed.has(number));

      const { error: markErr } = await sb
        .from('loto_players')
        .update({ marked_cells: cells })
        .eq('id', userId)
        .eq('lobby_id', lobbyId);
      if (markErr) throw markErr;

      const cardNumbers = flattenCardNumbers(player.card);
      const cardSet = new Set(cardNumbers);
      const markedCardCount = [...new Set(cells)].filter((n) => cardSet.has(n)).length;
      const isWin = cardNumbers.length > 0 && markedCardCount >= cardNumbers.length;

      if (isWin && lobby.status !== 'finished') {
        const nextWon = normalizeGames(player.games_won) + 1;
        const nextPlayed = normalizeGames(player.games_played);
        const winnerName = sanitizeNickname(player.nickname || nickname, userId);
        const winnerAvatar = sanitizeAvatar(player.avatar || avatar);

        const [{ error: winRowErr }, { error: finishErr }] = await Promise.all([
          sb
            .from('loto_players')
            .update({ games_won: nextWon })
            .eq('id', userId)
            .eq('lobby_id', lobbyId),
          sb
            .from('loto_lobbies')
            .update({
              status: 'finished',
              event: { type: 'game_won', ts: Date.now(), winnerId: userId, winnerName },
            })
            .eq('id', lobbyId),
        ]);
        if (winRowErr) throw winRowErr;
        if (finishErr) throw finishErr;

        await upsertProfileRow(sb, userId, {
          nickname: winnerName,
          avatar: winnerAvatar,
          games_played: nextPlayed,
          games_won: nextWon,
        });

        return json({
          type: 'game_won',
          winnerId: userId,
          winnerName,
        });
      }

      return json({ type: 'success' });
    }

    default:
      return json({ error: 'Unknown action' }, 400);
  }
}

function getIdentity(bodyOrParams: any) {
  const lobbyId = normalizeLobbyId(bodyOrParams?.lobbyId);
  const userId = asString(bodyOrParams?.userId);
  const nickname = sanitizeNickname(bodyOrParams?.nickname, userId);
  const avatar = sanitizeAvatar(bodyOrParams?.avatar);
  return { lobbyId, userId, nickname, avatar };
}

export async function POST(req: NextRequest) {
  const sb = getSupabaseClient();
  if (!sb) return json({ error: 'Supabase is not configured on server' }, 500);

  try {
    await maybeRunFinishedLobbyCleanup(sb);
    const body = await req.json().catch(() => ({}));
    const action = asString(body?.action || body?.type) || null;
    const { lobbyId, userId, nickname, avatar } = getIdentity(body);
    return await handleAction(sb, action, body, lobbyId, userId, nickname, avatar);
  } catch (error: any) {
    const messageRaw = String(error?.message || error || 'Internal server error');
    if (messageRaw.includes('NICKNAME_TAKEN')) {
      return json({ type: 'error', message: 'Этот ник уже занят' }, 409);
    }
    console.error('Loto Supabase API Error:', messageRaw);
    return json({ error: messageRaw }, 500);
  }
}

export async function GET(req: NextRequest) {
  const sb = getSupabaseClient();
  if (!sb) return json({ error: 'Supabase is not configured on server' }, 500);

  try {
    await maybeRunFinishedLobbyCleanup(sb);
    const { searchParams } = new URL(req.url);
    const action = asString(searchParams.get('action')) || null;
    const lobbyId = normalizeLobbyId(searchParams.get('lobbyId'));
    const userId = asString(searchParams.get('userId'));
    const nickname = sanitizeNickname(searchParams.get('nickname'), userId);
    const avatar = sanitizeAvatar(searchParams.get('avatar'));
    const v = asString(searchParams.get('v'));
    return await handleAction(
      sb,
      action,
      { lobbyId, userId, nickname, avatar, v },
      lobbyId,
      userId,
      nickname,
      avatar
    );
  } catch (error: any) {
    const message = String(error?.message || error || 'Internal server error');
    console.error('Loto Supabase API Error:', message);
    return json({ error: message }, 500);
  }
}
