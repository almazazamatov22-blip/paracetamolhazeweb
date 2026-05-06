import { Redis } from '@upstash/redis';

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
  created_at: string;
  updated_at: string;
  players: BredPlayer[];
}

const LOBBY_TTL_SECONDS = 60 * 60 * 8;
const KEY_PREFIX = 'bred:lobby';
const CODE_PREFIX = 'bred:code';

let redisClient: Redis | null | undefined;

const memory = globalThis as typeof globalThis & {
  __bredLobbies?: Map<string, BredLobby>;
  __bredCodes?: Map<string, string>;
};

function getMemoryLobbies() {
  if (!memory.__bredLobbies) memory.__bredLobbies = new Map();
  return memory.__bredLobbies;
}

function getMemoryCodes() {
  if (!memory.__bredCodes) memory.__bredCodes = new Map();
  return memory.__bredCodes;
}

function getRedis() {
  if (redisClient !== undefined) return redisClient;

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return redisClient;
}

function lobbyKey(id: string) {
  return `${KEY_PREFIX}:${id}`;
}

function codeKey(code: string) {
  return `${CODE_PREFIX}:${code.toUpperCase()}`;
}

export function genBredCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export function genBredId(prefix = 'lobby'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export async function getBredLobbyById(id: string): Promise<BredLobby | null> {
  const redis = getRedis();

  if (redis) {
    return (await redis.get<BredLobby>(lobbyKey(id))) ?? null;
  }

  return getMemoryLobbies().get(id) ?? null;
}

export async function getBredLobbyByCode(code: string): Promise<BredLobby | null> {
  const normalizedCode = code.toUpperCase();
  const redis = getRedis();

  if (redis) {
    const id = await redis.get<string>(codeKey(normalizedCode));
    return id ? getBredLobbyById(id) : null;
  }

  const id = getMemoryCodes().get(normalizedCode);
  return id ? getBredLobbyById(id) : null;
}

export async function saveBredLobby(lobby: BredLobby): Promise<BredLobby> {
  const nextLobby = {
    ...lobby,
    code: lobby.code.toUpperCase(),
    updated_at: new Date().toISOString(),
  };
  const redis = getRedis();

  if (redis) {
    await Promise.all([
      redis.set(lobbyKey(nextLobby.id), nextLobby, { ex: LOBBY_TTL_SECONDS }),
      redis.set(codeKey(nextLobby.code), nextLobby.id, { ex: LOBBY_TTL_SECONDS }),
    ]);
    return nextLobby;
  }

  getMemoryLobbies().set(nextLobby.id, nextLobby);
  getMemoryCodes().set(nextLobby.code, nextLobby.id);
  return nextLobby;
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
    const existing = await getBredLobbyByCode(code);
    if (!existing) break;
    code = genBredCode();
  }

  const now = new Date().toISOString();
  const lobbyId = genBredId('lobby');
  const hostPlayer: BredPlayer = {
    id: hostId,
    lobby_id: lobbyId,
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

  return saveBredLobby({
    id: lobbyId,
    code,
    host_id: hostId,
    host_name: hostName,
    status: 'waiting',
    current_fact_idx: 0,
    facts: [],
    vote_results: [],
    created_at: now,
    updated_at: now,
    players: [hostPlayer],
  });
}

export async function updateBredLobby(
  id: string,
  updates: Partial<Omit<BredLobby, 'id' | 'code' | 'created_at' | 'players'>> & {
    players?: BredPlayer[];
  }
) {
  const lobby = await getBredLobbyById(id);
  if (!lobby) return null;

  return saveBredLobby({
    ...lobby,
    ...updates,
    players: updates.players ?? lobby.players,
  });
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

  return saveBredLobby({ ...lobby, players });
}
