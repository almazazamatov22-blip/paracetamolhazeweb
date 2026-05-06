import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type BredPhase = 'waiting' | 'lobby' | 'input' | 'voting' | 'reveal' | 'leaderboard';

export interface BredPlayer {
  id: string;
  lobby_id: string;
  name: string;
  score: number;
  is_host: boolean;
  twitch_id?: string | null;
  avatar_url?: string | null;
  submitted_fact?: boolean;
  fact_a?: string | null;
  fact_b?: string | null;
  truth_index?: number | null;
  joined_at: string;
}

export interface BredVoteRound {
  targetId: string;
  votes: Record<string, number>;
}

export interface BredLobby {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  status: BredPhase;
  current_fact_idx: number;
  facts: string[];
  vote_results: BredVoteRound[];
  phase_started_at?: string | null;
  phase_deadline_at?: string | null;
  created_at: string;
  updated_at: string;
  players: BredPlayer[];
}

interface BredLobbyRow {
  id: string;
  code: string;
  host_id: string;
  host_name: string;
  status: BredPhase;
  current_fact_idx: number;
  facts?: unknown;
  vote_results?: unknown;
  phase_started_at?: string | null;
  phase_deadline_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface LotoLobbyRow {
  id: string;
  code: string;
  name?: string | null;
  admin_id: string;
  status: string;
  max_players?: number | null;
  drawn_numbers?: unknown;
  last_activity?: string | null;
  started_at?: string | null;
  mode?: string | null;
  event?: Record<string, unknown> | null;
}

interface LotoPlayerRow {
  id: string;
  lobby_id: string;
  nickname?: string | null;
  avatar?: string | null;
  card?: Record<string, unknown> | null;
  status?: string | null;
  joined_at?: string | null;
  is_admin?: boolean | null;
}

const BRED_MODE = 'bred';
const DEFAULT_MAX_PLAYERS = 14;

let supabaseClient: SupabaseClient | null | undefined;
let hasDedicatedBredTables: boolean | null = null;
let lastDedicatedTableCheckAt = 0;

const DEDICATED_TABLE_RETRY_MS = 60_000;

function getSupabase() {
  if (supabaseClient !== undefined) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    supabaseClient = null;
    return supabaseClient;
  }

  supabaseClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return supabaseClient;
}

function requireSupabase() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured for /bred');
  return supabase;
}

function isMissingTableError(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  const text = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  return (
    text.includes('pgrst205') ||
    text.includes('schema cache') ||
    text.includes('bred_lobbies') ||
    text.includes('bred_players') ||
    text.includes('phase_started_at') ||
    text.includes('phase_deadline_at')
  );
}

function canTryDedicatedTables() {
  return hasDedicatedBredTables !== false || Date.now() - lastDedicatedTableCheckAt > DEDICATED_TABLE_RETRY_MS;
}

function markDedicatedTablesMissing() {
  hasDedicatedBredTables = false;
  lastDedicatedTableCheckAt = Date.now();
}

function markDedicatedTablesAvailable() {
  hasDedicatedBredTables = true;
  lastDedicatedTableCheckAt = Date.now();
}

function assertSupabase(error: { message?: string } | null) {
  if (!error) return;
  throw new Error(error.message || 'Supabase error');
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asBredPhase(value: unknown, fallback: string): BredPhase {
  if (
    value === 'waiting' ||
    value === 'lobby' ||
    value === 'input' ||
    value === 'voting' ||
    value === 'reveal' ||
    value === 'leaderboard'
  ) {
    return value;
  }

  return fallback === 'finished' ? 'leaderboard' : 'waiting';
}

function toLotoStatus(status: BredPhase) {
  if (status === 'leaderboard') return 'finished';
  if (status === 'waiting' || status === 'lobby') return 'waiting';
  return 'playing';
}

function mapDedicatedLobby(row: BredLobbyRow, players: BredPlayer[]): BredLobby {
  return {
    id: row.id,
    code: row.code.toUpperCase(),
    host_id: row.host_id,
    host_name: row.host_name,
    status: row.status,
    current_fact_idx: row.current_fact_idx ?? 0,
    facts: asJsonArray<string>(row.facts),
    vote_results: asJsonArray<BredVoteRound>(row.vote_results),
    phase_started_at: row.phase_started_at || null,
    phase_deadline_at: row.phase_deadline_at || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    players,
  };
}

function mapLegacyPlayer(row: LotoPlayerRow): BredPlayer {
  const card = asObject(row.card);
  const avatar = String(row.avatar || '');

  return {
    id: String(row.id),
    lobby_id: String(row.lobby_id),
    name: String(row.nickname || 'Игрок'),
    score: Number(card.score || 0),
    is_host: Boolean(row.is_admin),
    twitch_id: card.twitch_id ? String(card.twitch_id) : null,
    avatar_url: card.avatar_url ? String(card.avatar_url) : avatar.startsWith('http') ? avatar : null,
    submitted_fact: Boolean(card.submitted_fact),
    fact_a: card.fact_a ? String(card.fact_a) : null,
    fact_b: card.fact_b ? String(card.fact_b) : null,
    truth_index: Number.isFinite(Number(card.truth_index)) ? Number(card.truth_index) : null,
    joined_at: row.joined_at || new Date().toISOString(),
  };
}

function legacyPlayerToLoto(player: BredPlayer, lobbyId: string) {
  return {
    id: player.id,
    lobby_id: lobbyId,
    nickname: player.name,
    avatar: player.avatar_url || '👤',
    games_played: 0,
    games_won: 0,
    is_admin: player.is_host,
    status: 'waiting',
    marked_cells: [],
    card: {
      mode: BRED_MODE,
      score: player.score || 0,
      twitch_id: player.twitch_id || null,
      avatar_url: player.avatar_url || null,
      submitted_fact: Boolean(player.submitted_fact),
      fact_a: player.fact_a || null,
      fact_b: player.fact_b || null,
      truth_index: player.truth_index ?? null,
    },
  };
}

function legacyLobbyEvent(lobby: Omit<BredLobby, 'players'>) {
  return {
    type: 'bred_state',
    mode: BRED_MODE,
    host_name: lobby.host_name,
    status: lobby.status,
    current_fact_idx: lobby.current_fact_idx,
    facts: lobby.facts,
    vote_results: lobby.vote_results,
    phase_started_at: lobby.phase_started_at || null,
    phase_deadline_at: lobby.phase_deadline_at || null,
    created_at: lobby.created_at,
    updated_at: lobby.updated_at,
  };
}

async function readDedicatedLobby(row: BredLobbyRow | null): Promise<BredLobby | null> {
  if (!row) return null;

  const { data: players, error } = await requireSupabase()
    .from('bred_players')
    .select('*')
    .eq('lobby_id', row.id)
    .order('joined_at', { ascending: true });

  if (isMissingTableError(error)) {
    markDedicatedTablesMissing();
    return null;
  }
  assertSupabase(error);
  markDedicatedTablesAvailable();

  return mapDedicatedLobby(row, (players || []) as BredPlayer[]);
}

async function getDedicatedLobbyById(id: string): Promise<BredLobby | null> {
  if (!canTryDedicatedTables()) return null;

  const { data, error } = await requireSupabase()
    .from('bred_lobbies')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (isMissingTableError(error)) {
    markDedicatedTablesMissing();
    return null;
  }
  assertSupabase(error);
  markDedicatedTablesAvailable();
  return readDedicatedLobby(data as BredLobbyRow | null);
}

async function getDedicatedLobbyByCode(code: string): Promise<BredLobby | null> {
  if (!canTryDedicatedTables()) return null;

  const { data, error } = await requireSupabase()
    .from('bred_lobbies')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle();

  if (isMissingTableError(error)) {
    markDedicatedTablesMissing();
    return null;
  }
  assertSupabase(error);
  markDedicatedTablesAvailable();
  return readDedicatedLobby(data as BredLobbyRow | null);
}

async function getLegacyLobbyById(id: string): Promise<BredLobby | null> {
  const { data, error } = await requireSupabase()
    .from('loto_lobbies')
    .select('*')
    .eq('id', id)
    .eq('mode', BRED_MODE)
    .maybeSingle();

  assertSupabase(error);
  return readLegacyLobby(data as LotoLobbyRow | null);
}

async function getLegacyLobbyByCode(code: string): Promise<BredLobby | null> {
  const { data, error } = await requireSupabase()
    .from('loto_lobbies')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('mode', BRED_MODE)
    .maybeSingle();

  assertSupabase(error);
  return readLegacyLobby(data as LotoLobbyRow | null);
}

async function readLegacyLobby(row: LotoLobbyRow | null): Promise<BredLobby | null> {
  if (!row) return null;

  const { data: playerRows, error } = await requireSupabase()
    .from('loto_players')
    .select('*')
    .eq('lobby_id', row.id)
    .order('joined_at', { ascending: true });

  assertSupabase(error);

  const event = asObject(row.event);
  const now = new Date().toISOString();

  return {
    id: row.id,
    code: row.code.toUpperCase(),
    host_id: row.admin_id,
    host_name: String(event.host_name || row.name || 'Бредовуха'),
    status: asBredPhase(event.status, row.status),
    current_fact_idx: Number(event.current_fact_idx || 0),
    facts: asJsonArray<string>(event.facts),
    vote_results: asJsonArray<BredVoteRound>(event.vote_results),
    phase_started_at: event.phase_started_at ? String(event.phase_started_at) : null,
    phase_deadline_at: event.phase_deadline_at ? String(event.phase_deadline_at) : null,
    created_at: String(event.created_at || row.last_activity || now),
    updated_at: String(event.updated_at || row.last_activity || now),
    players: ((playerRows || []) as LotoPlayerRow[]).map(mapLegacyPlayer),
  };
}

async function saveDedicatedLobby(lobby: BredLobby, syncPlayers: boolean): Promise<BredLobby | null> {
  if (!canTryDedicatedTables()) return null;

  const now = new Date().toISOString();
  const nextLobby = {
    ...lobby,
    code: lobby.code.toUpperCase(),
    updated_at: now,
  };

  const { error: lobbyError } = await requireSupabase().from('bred_lobbies').upsert({
    id: nextLobby.id,
    code: nextLobby.code,
    host_id: nextLobby.host_id,
    host_name: nextLobby.host_name,
    status: nextLobby.status,
    current_fact_idx: nextLobby.current_fact_idx,
    facts: nextLobby.facts,
    vote_results: nextLobby.vote_results,
    phase_started_at: nextLobby.phase_started_at || null,
    phase_deadline_at: nextLobby.phase_deadline_at || null,
    created_at: nextLobby.created_at,
    updated_at: nextLobby.updated_at,
  });

  if (isMissingTableError(lobbyError)) {
    markDedicatedTablesMissing();
    return null;
  }
  assertSupabase(lobbyError);
  markDedicatedTablesAvailable();

  if (syncPlayers && nextLobby.players.length > 0) {
    const { error: playersError } = await requireSupabase().from('bred_players').upsert(
      nextLobby.players.map((player) => ({
        id: player.id,
        lobby_id: nextLobby.id,
        name: player.name,
        score: player.score || 0,
        is_host: player.is_host,
        twitch_id: player.twitch_id || null,
        avatar_url: player.avatar_url || null,
        submitted_fact: Boolean(player.submitted_fact),
        fact_a: player.fact_a || null,
        fact_b: player.fact_b || null,
        truth_index: player.truth_index ?? null,
        joined_at: player.joined_at,
      })),
      { onConflict: 'id,lobby_id' }
    );

    assertSupabase(playersError);
  }

  return (await getDedicatedLobbyById(nextLobby.id)) || nextLobby;
}

async function saveLegacyLobby(lobby: BredLobby, syncPlayers: boolean): Promise<BredLobby> {
  const now = new Date().toISOString();
  const nextLobby = {
    ...lobby,
    code: lobby.code.toUpperCase(),
    updated_at: now,
  };

  const { error: lobbyError } = await requireSupabase()
    .from('loto_lobbies')
    .update({
      code: nextLobby.code,
      name: 'Бредовуха',
      admin_id: nextLobby.host_id,
      status: toLotoStatus(nextLobby.status),
      max_players: DEFAULT_MAX_PLAYERS,
      mode: BRED_MODE,
      drawn_numbers: [],
      event: legacyLobbyEvent(nextLobby),
    })
    .eq('id', nextLobby.id)
    .eq('mode', BRED_MODE);

  assertSupabase(lobbyError);

  if (syncPlayers && nextLobby.players.length > 0) {
    const { error: playersError } = await requireSupabase().from('loto_players').upsert(
      nextLobby.players.map((player) => legacyPlayerToLoto(player, nextLobby.id)),
      { onConflict: 'id,lobby_id' }
    );

    assertSupabase(playersError);
  }

  return (await getLegacyLobbyById(nextLobby.id)) || nextLobby;
}

export function genBredCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function isLobbyCodeTaken(code: string) {
  const normalizedCode = code.toUpperCase();
  const dedicated = await getDedicatedLobbyByCode(normalizedCode);
  if (dedicated) return true;

  const legacy = await getLegacyLobbyByCode(normalizedCode);
  return Boolean(legacy);
}

export async function getBredLobbyById(id: string): Promise<BredLobby | null> {
  const dedicated = await getDedicatedLobbyById(id);
  if (dedicated) return dedicated;

  const legacy = await getLegacyLobbyById(id);
  if (legacy && canTryDedicatedTables()) {
    await saveDedicatedLobby(legacy, true);
  }
  return legacy;
}

export async function getBredLobbyByCode(code: string): Promise<BredLobby | null> {
  const dedicated = await getDedicatedLobbyByCode(code);
  if (dedicated) return dedicated;

  const legacy = await getLegacyLobbyByCode(code);
  if (legacy && canTryDedicatedTables()) {
    await saveDedicatedLobby(legacy, true);
  }
  return legacy;
}

export async function saveBredLobby(lobby: BredLobby, syncPlayers = true): Promise<BredLobby> {
  const dedicated = await saveDedicatedLobby(lobby, syncPlayers);
  if (dedicated) return dedicated;
  return saveLegacyLobby(lobby, syncPlayers);
}

export async function createBredLobby({
  hostId,
  hostName,
  twitchId,
  avatarUrl,
}: {
  hostId: string;
  hostName: string;
  twitchId?: string | null;
  avatarUrl?: string | null;
}) {
  let code = genBredCode();

  for (let i = 0; i < 8; i++) {
    const existing = await isLobbyCodeTaken(code);
    if (!existing) break;
    code = genBredCode();
  }

  const now = new Date().toISOString();
  const hostPlayer: BredPlayer = {
    id: hostId,
    lobby_id: '',
    name: hostName,
    score: 0,
    is_host: true,
    twitch_id: twitchId ?? null,
    avatar_url: avatarUrl ?? null,
    submitted_fact: false,
    fact_a: null,
    fact_b: null,
    truth_index: null,
    joined_at: now,
  };

  if (canTryDedicatedTables()) {
    const { data: row, error } = await requireSupabase()
      .from('bred_lobbies')
      .insert({
        code,
        host_id: hostId,
        host_name: hostName,
        status: 'waiting',
        current_fact_idx: 0,
        facts: [],
        vote_results: [],
        phase_started_at: null,
        phase_deadline_at: null,
      })
      .select('*')
      .single();

    if (!isMissingTableError(error)) {
      assertSupabase(error);
      markDedicatedTablesAvailable();
      const lobbyId = String(row.id);
      return saveBredLobby({
        id: lobbyId,
        code,
        host_id: hostId,
        host_name: hostName,
        status: 'waiting',
        current_fact_idx: 0,
        facts: [],
        vote_results: [],
        phase_started_at: row.phase_started_at || null,
        phase_deadline_at: row.phase_deadline_at || null,
        created_at: row.created_at || now,
        updated_at: row.updated_at || now,
        players: [{ ...hostPlayer, lobby_id: lobbyId }],
      });
    }

    markDedicatedTablesMissing();
  }

  const { data: row, error: lobbyError } = await requireSupabase()
    .from('loto_lobbies')
    .insert({
      code,
      name: 'Бредовуха',
      admin_id: hostId,
      status: 'waiting',
      max_players: DEFAULT_MAX_PLAYERS,
      mode: BRED_MODE,
      drawn_numbers: [],
      event: {
        type: 'bred_state',
        mode: BRED_MODE,
        host_name: hostName,
        status: 'waiting',
        current_fact_idx: 0,
        facts: [],
        vote_results: [],
        phase_started_at: null,
        phase_deadline_at: null,
        created_at: now,
        updated_at: now,
      },
    })
    .select('*')
    .single();

  assertSupabase(lobbyError);

  const lobbyId = String(row.id);
  const legacyLobby: BredLobby = {
    id: lobbyId,
    code,
    host_id: hostId,
    host_name: hostName,
    status: 'waiting',
    current_fact_idx: 0,
    facts: [],
    vote_results: [],
    phase_started_at: null,
    phase_deadline_at: null,
    created_at: now,
    updated_at: now,
    players: [{ ...hostPlayer, lobby_id: lobbyId }],
  };

  return saveLegacyLobby(legacyLobby, true);
}

export async function updateBredLobby(
  id: string,
  updates: Partial<Omit<BredLobby, 'id' | 'code' | 'created_at' | 'players'>> & {
    players?: BredPlayer[];
  }
) {
  const lobby = await getBredLobbyById(id);
  if (!lobby) return null;

  return saveBredLobby(
    {
      ...lobby,
      ...updates,
      players: updates.players ?? lobby.players,
    },
    Boolean(updates.players)
  );
}

export async function upsertBredPlayer(
  lobbyId: string,
  player: Omit<BredPlayer, 'lobby_id' | 'joined_at'> & { joined_at?: string }
) {
  const lobby = await getBredLobbyById(lobbyId);
  if (!lobby) return null;

  const existing = lobby.players.find((item) => item.id === player.id);
  const nextPlayer: BredPlayer = {
    ...existing,
    ...player,
    lobby_id: lobbyId,
    joined_at: existing?.joined_at || player.joined_at || new Date().toISOString(),
  };

  const players = [
    ...lobby.players.filter((item) => item.id !== player.id),
    nextPlayer,
  ].sort((a, b) => a.joined_at.localeCompare(b.joined_at));

  return saveBredLobby({ ...lobby, players }, true);
}
