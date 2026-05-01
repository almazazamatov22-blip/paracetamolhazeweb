import { DurableObject } from "cloudflare:workers";

const GAME_OBJECT_NAME = "global";
const STATE_KEY = "lotomal-state-v1";
const PRESENCE_WRITE_INTERVAL_MS = 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const WAITING_PLAYER_STALE_MS = 10 * 60 * 1000;
const FINISHED_LOBBY_TTL_MS = 30 * 60 * 1000;

function json(data, init = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...(init.headers || {}),
    },
  });
}

function asString(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeLobbyId(value) {
  const normalized = asString(value);
  if (!normalized || normalized === "undefined" || normalized === "null") return "";
  return normalized;
}

function makeAssetRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

function normalizeAssetPath(pathname) {
  if (pathname === "/" || pathname === "/index.html" || pathname === "/lotomal" || pathname === "/lotomal/") return "/";
  if (
    pathname === "/admin.html" ||
    pathname === "/admin" ||
    pathname === "/lotomal/admin" ||
    pathname === "/lotomal/admin/" ||
    pathname === "/lotomal/admin.html"
  ) return "/admin";
  if (
    pathname === "/overlay.html" ||
    pathname === "/overlay" ||
    pathname === "/lotomal/overlay" ||
    pathname === "/lotomal/overlay/" ||
    pathname === "/lotomal/overlay.html"
  ) return "/overlay";
  if (pathname.startsWith("/lotomal/")) return pathname.slice("/lotomal".length) || "/";
  return pathname;
}

function getGameStub(env) {
  const id = env.LOTOMAL_GAME.idFromName(GAME_OBJECT_NAME);
  return env.LOTOMAL_GAME.get(id);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      return getGameStub(env).fetch(request);
    }

    if (pathname === "/api/status") {
      return json({ status: "online", version: "cloudflare-durable-object" });
    }

    if (
      pathname === "/api/loto" ||
      pathname === "/api/stats" ||
      pathname.startsWith("/api/users/") ||
      pathname.startsWith("/api/drawn")
    ) {
      return getGameStub(env).fetch(request);
    }

    const assetPath = normalizeAssetPath(pathname);
    return env.ASSETS.fetch(makeAssetRequest(request, assetPath));
  },
};

function createDefaultState() {
  return {
    meta: {
      last_cleanup_at: 0,
    },
    users: {},
    lobbies: {},
  };
}

function generateId(prefix = "") {
  return prefix + crypto.randomUUID();
}

function generateLobbyCode(state) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = "";
    for (let i = 0; i < 6; i += 1) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    const exists = Object.values(state.lobbies).some((lobby) => lobby.code === code);
    if (!exists) return code;
  }
  return `L${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

function cleanNickname(value, fallbackId = "") {
  const nick = asString(value).slice(0, 40);
  return nick || `Player${String(fallbackId || Date.now()).slice(-4)}`;
}

function cleanAvatar(value) {
  return asString(value).slice(0, 120 * 1024) || "\u{1F464}";
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

function generateLotoCard() {
  const ranges = [[1,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,90]];

  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const colCount = Array(9).fill(0);
    const mask = Array(3).fill(null).map(() => Array(9).fill(false));
    let ok = true;

    const cols = [0,1,2,3,4,5,6,7,8];
    shuffle(cols);
    for (let i = 0; i < 9; i += 1) {
      const row = Math.floor(i / 3);
      const col = cols[i];
      mask[row][col] = true;
      colCount[col] += 1;
    }

    for (let row = 0; row < 3; row += 1) {
      const need = 5 - mask[row].filter(Boolean).length;
      const available = [];
      for (let col = 0; col < 9; col += 1) {
        if (!mask[row][col] && colCount[col] < 2) available.push(col);
      }
      if (available.length < need) {
        ok = false;
        break;
      }
      shuffle(available);
      for (const col of available.slice(0, need)) {
        mask[row][col] = true;
        colCount[col] += 1;
      }
    }
    if (!ok) continue;

    if (!mask.every((row) => row.filter(Boolean).length === 5)) continue;
    if (!colCount.every((count) => count >= 1 && count <= 2)) continue;

    const card = Array(3).fill(null).map(() => Array(9).fill(null));
    for (let col = 0; col < 9; col += 1) {
      const [min, max] = ranges[col];
      const rows = [0,1,2].filter((row) => mask[row][col]);
      const pool = [];
      for (let n = min; n <= max; n += 1) pool.push(n);
      shuffle(pool);
      const chosen = pool.slice(0, rows.length).sort((a, b) => a - b);
      rows.sort((a, b) => a - b).forEach((row, index) => {
        card[row][col] = chosen[index];
      });
    }
    return card;
  }

  return Array(3).fill(null).map(() => Array(9).fill(null));
}

function flattenCard(card) {
  if (!Array.isArray(card)) return [];
  return card.flat().map(Number).filter(Number.isFinite);
}

function normalizeCells(cells) {
  return [...new Set((cells || []).map(Number).filter(Number.isFinite))];
}

function getTimestamp() {
  return Date.now();
}

function toClientPlayer(lobby, player) {
  return {
    id: player.id,
    nickname: player.nickname,
    avatar: player.avatar,
    games_played: Number(player.games_played || 0),
    games_won: Number(player.games_won || 0),
    status: player.status || "waiting",
    isAdmin: String(player.id) === String(lobby.admin_id),
    progress: normalizeCells(player.marked_cells).length,
    marked_cells: normalizeCells(player.marked_cells),
    card: player.card || null,
  };
}

function buildStateVersion(lobby) {
  return JSON.stringify({
    status: lobby.status,
    drawn: lobby.drawn_numbers || [],
    players: Object.values(lobby.players || {}).map((player) => [
      player.id,
      player.status,
      normalizeCells(player.marked_cells).length,
      player.games_played || 0,
      player.games_won || 0,
    ]),
    chat: (lobby.chat || []).map((message) => message.id),
  });
}

export class LotomalGame extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.state = createDefaultState();
    this.ready = this.loadState();
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    );
  }

  async loadState() {
    const all = await this.ctx.storage.list();
    this.state = createDefaultState();

    const oldState = all.get(STATE_KEY);
    if (oldState) {
      this.state = oldState && typeof oldState === "object" ? oldState : createDefaultState();
      this.state.meta ||= { last_cleanup_at: 0 };
      this.state.users ||= {};
      this.state.lobbies ||= {};
      await this.persist();
      await this.ctx.storage.delete(STATE_KEY);
      return;
    }

    for (const [key, value] of all.entries()) {
      if (key === "meta") this.state.meta = value;
      else if (key.startsWith("user:")) this.state.users[key.slice(5)] = value;
      else if (key.startsWith("lobby:")) this.state.lobbies[key.slice(6)] = value;
    }
  }

  async persist() {
    this.state.meta.updated_at = getTimestamp();
    const puts = { meta: this.state.meta };
    for (const [id, user] of Object.entries(this.state.users)) {
      puts[`user:${id}`] = user;
    }
    for (const [id, lobby] of Object.entries(this.state.lobbies)) {
      puts[`lobby:${id}`] = lobby;
    }

    const chunks = Object.entries(puts);
    for (let i = 0; i < chunks.length; i += 100) {
      const chunk = Object.fromEntries(chunks.slice(i, i + 100));
      await this.ctx.storage.put(chunk);
    }
  }

  async fetch(request) {
    await this.ready;

    if (request.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({
        sessionId: crypto.randomUUID(),
        userId: "",
        lobbyId: "",
      });
      return new Response(null, { status: 101, webSocket: client });
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/users/")) {
      const parts = url.pathname.split("/").filter(Boolean); // ['api','users',':id'] or [..., 'stats']
      const userId = decodeURIComponent(parts[2] || "");
      const user = this.state.users[userId];
      if (!user) return json({ error: "User not found" }, { status: 404 });
      return json({
        id: user.id,
        nickname: user.nickname,
        avatar: user.avatar || null,
        games_played: user.games_played || 0,
        games_won: user.games_won || 0,
        total_score: user.total_score || 0,
        created_at: user.created_at,
      });
    }

    if (url.pathname === "/api/stats") {
      const lobbies = Object.values(this.state.lobbies);
      const users = Object.values(this.state.users);
      return json({
        total_users: users.length,
        total_lobbies: lobbies.length,
        lobbies_waiting: lobbies.filter(l => l.status === "waiting").length,
        lobbies_playing: lobbies.filter(l => l.status === "playing").length,
        lobbies_finished: lobbies.filter(l => l.status === "finished").length,
        active_lobbies: lobbies.filter(l => l.status === "waiting" || l.status === "playing").map(l => ({
          id: l.id,
          code: l.code,
          name: l.name,
          status: l.status,
          players: Object.keys(l.players || {}).length,
          max_players: l.max_players,
          created_at: l.created_at,
        })),
        recent_users: users
          .sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0))
          .slice(0, 20)
          .map(u => ({ id: u.id, nickname: u.nickname, games_played: u.games_played, games_won: u.games_won, last_seen: u.last_seen })),
      });
    }

    if (url.pathname.startsWith("/api/drawn")) {
      return this.handleLegacyDrawnApi(request);
    }

    if (request.method === "GET") {
      const payload = Object.fromEntries(url.searchParams.entries());
      payload.action ||= "get_state";
      return json(await this.handleAction(payload, null));
    }

    if (request.method === "POST") {
      const payload = await request.json().catch(() => ({}));
      return json(await this.handleAction(payload, null));
    }

    return json({ type: "error", message: "Method not allowed" }, { status: 405 });
  }

  async webSocketMessage(ws, rawMessage) {
    await this.ready;
    let message = null;
    try {
      message = JSON.parse(String(rawMessage));
    } catch (_) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
      return;
    }

    if (message.type !== "api") {
      ws.send(JSON.stringify({ type: "error", message: "Unknown WebSocket message" }));
      return;
    }

    const result = await this.handleAction(message.payload || {}, ws);
    ws.send(JSON.stringify({ ...result, requestId: message.requestId }));
  }

  async webSocketClose(ws) {
    const attachment = ws.deserializeAttachment() || {};
    if (attachment.userId && attachment.lobbyId) {
      const lobby = this.state.lobbies[attachment.lobbyId];
      const player = lobby?.players?.[attachment.userId];
      if (player) player.last_seen = getTimestamp();
      this.cleanupLobbies(true);
      await this.persist();
    }
  }

  async webSocketError(ws) {
    await this.webSocketClose(ws);
  }

  setSocketAttachment(ws, patch) {
    if (!ws) return;
    const current = ws.deserializeAttachment() || {};
    ws.serializeAttachment({ ...current, ...patch });
  }

  getSocketsForLobby(lobbyId, excludeUserId = "") {
    return this.ctx.getWebSockets().filter((socket) => {
      const attachment = socket.deserializeAttachment() || {};
      if (attachment.lobbyId !== lobbyId) return false;
      if (excludeUserId && attachment.userId === excludeUserId) return false;
      return true;
    });
  }

  hasActiveSocket(lobbyId, userId) {
    return this.ctx.getWebSockets().some((socket) => {
      const attachment = socket.deserializeAttachment() || {};
      return attachment.lobbyId === lobbyId && attachment.userId === userId;
    });
  }

  touchPresence(lobbyId, userId, nickname, avatar) {
    const id = asString(userId);
    const now = getTimestamp();
    let dirty = false;

    if (id && this.state.users[id]) {
      const user = this.state.users[id];
      if (now - Number(user.last_seen || 0) >= PRESENCE_WRITE_INTERVAL_MS) {
        user.last_seen = now;
        dirty = true;
      }
      if (nickname !== undefined) {
        const nextNickname = cleanNickname(nickname, id);
        if (nextNickname && nextNickname !== user.nickname) {
          user.nickname = nextNickname;
          dirty = true;
        }
      }
      if (avatar !== undefined) {
        const nextAvatar = cleanAvatar(avatar);
        if (nextAvatar && nextAvatar !== user.avatar) {
          user.avatar = nextAvatar;
          dirty = true;
        }
      }
    }

    const lobby = this.state.lobbies[normalizeLobbyId(lobbyId)];
    const player = lobby?.players?.[id];
    if (player && now - Number(player.last_seen || 0) >= PRESENCE_WRITE_INTERVAL_MS) {
      player.last_seen = now;
      dirty = true;
    }

    return dirty;
  }

  cleanupLobbies(force = false) {
    const now = getTimestamp();
    this.state.meta ||= { last_cleanup_at: 0 };
    if (!force && now - Number(this.state.meta.last_cleanup_at || 0) < CLEANUP_INTERVAL_MS) {
      return false;
    }

    this.state.meta.last_cleanup_at = now;
    let dirty = true;

    for (const [lobbyId, lobby] of Object.entries(this.state.lobbies)) {
      lobby.players ||= {};

      if (lobby.status === "waiting") {
        for (const [userId, player] of Object.entries(lobby.players)) {
          const lastSeen = Number(player.last_seen || player.joined_at || lobby.created_at || 0);
          if (!this.hasActiveSocket(lobbyId, userId) && now - lastSeen > WAITING_PLAYER_STALE_MS) {
            delete lobby.players[userId];
          }
        }
      }

      if (Object.keys(lobby.players).length === 0) {
        delete this.state.lobbies[lobbyId];
        this.ctx.storage.delete(`lobby:${lobbyId}`).catch(() => {});
        continue;
      }

      if (lobby.status === "finished") {
        const finishedAt = Number(lobby.finished_at || lobby.updated_at || lobby.started_at || lobby.created_at || 0);
        if (finishedAt && now - finishedAt > FINISHED_LOBBY_TTL_MS) {
          delete this.state.lobbies[lobbyId];
          this.ctx.storage.delete(`lobby:${lobbyId}`).catch(() => {});
        }
      }
    }

    return dirty;
  }

  broadcast(lobbyId, message, excludeUserId = "") {
    for (const socket of this.getSocketsForLobby(lobbyId, excludeUserId)) {
      try {
        socket.send(JSON.stringify(message));
      } catch (_) {}
    }
  }

  broadcastState(lobbyId, excludeUserId = "") {
    for (const socket of this.getSocketsForLobby(lobbyId, excludeUserId)) {
      const attachment = socket.deserializeAttachment() || {};
      socket.send(JSON.stringify(this.getLobbyState(lobbyId, attachment.userId || "")));
    }
  }

  ensureUser(userId, nickname, avatar) {
    const id = asString(userId);
    if (!id) throw new Error("Missing userId");

    const existing = this.state.users[id] || {
      id,
      games_played: 0,
      games_won: 0,
      total_score: 0,
      created_at: getTimestamp(),
    };

    const next = {
      ...existing,
      nickname: cleanNickname(nickname || existing.nickname, id),
      avatar: cleanAvatar(avatar || existing.avatar),
      last_seen: getTimestamp(),
    };
    this.state.users[id] = next;
    return next;
  }

  getLobbyState(lobbyId, userId, clientVersion = "") {
    const lobby = this.state.lobbies[normalizeLobbyId(lobbyId)];
    if (!lobby) return { type: "error", message: "Lobby not found" };

    const players = Object.values(lobby.players || {}).map((player) => toClientPlayer(lobby, player));
    const me = players.find((player) => String(player.id) === String(userId));
    const version = buildStateVersion(lobby);

    if (clientVersion && clientVersion === version) {
      return { type: "no_change", version };
    }

    return {
      type: "state_update",
      version,
      drawn: lobby.drawn_numbers || [],
      all: lobby.drawn_numbers || [],
      isAdmin: String(lobby.admin_id) === String(userId),
      card: me?.card || null,
      markedCells: normalizeCells(me?.marked_cells),
      chat: (lobby.chat || []).slice(-50),
      lobby: {
        id: lobby.id,
        code: lobby.code,
        name: lobby.name,
        status: lobby.status,
        admin_id: lobby.admin_id,
        max_players: lobby.max_players,
        players,
      },
    };
  }

  listLobbies() {
    return Object.values(this.state.lobbies)
      .filter((lobby) => ["waiting"].includes(lobby.status))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 50)
      .map((lobby) => ({
        id: lobby.id,
        code: lobby.code,
        name: lobby.name,
        admin_id: lobby.admin_id,
        max_players: lobby.max_players,
        status: lobby.status,
        players_count: Object.keys(lobby.players || {}).length,
        has_password: lobby.password ? 1 : 0,
      }));
  }

  getUserStats(userId) {
    const user = this.state.users[asString(userId)];
    if (!user) return { games_played: 0, games_won: 0, nickname: "Player" };
    return {
      games_played: Number(user.games_played || 0),
      games_won: Number(user.games_won || 0),
      nickname: user.nickname,
    };
  }

  async handleLegacyDrawnApi(request) {
    const url = new URL(request.url);
    const lobbyId = normalizeLobbyId(url.searchParams.get("lobbyId"));
    if (!lobbyId) return json({ drawn: [] });

    const lobby = this.state.lobbies[lobbyId];
    if (!lobby) return json({ drawn: [] });

    return json({ drawn: lobby.drawn_numbers || [] });
  }

  async handleAction(payload, ws) {
    const action = asString(payload.action || payload.type);
    const userId = asString(payload.userId);
    const lobbyId = normalizeLobbyId(payload.lobbyId);
    const nickname = payload.nickname;
    const avatar = payload.avatar;
    let preActionDirty = this.touchPresence(lobbyId, userId, nickname, avatar);
    preActionDirty = this.cleanupLobbies() || preActionDirty;

    switch (action) {
      case "auth": {
        const user = this.ensureUser(userId, nickname, avatar);
        this.setSocketAttachment(ws, { userId: user.id });
        await this.persist();
        return {
          type: "auth_success",
          user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            games_played: user.games_played,
            games_won: user.games_won,
          },
        };
      }

      case "get_state":
        if (preActionDirty) await this.persist();
        return this.getLobbyState(lobbyId, userId, asString(payload.v || payload.version));

      case "list_lobbies":
        if (preActionDirty) await this.persist();
        return this.listLobbies();

      case "create_lobby": {
        const user = this.ensureUser(userId, nickname, avatar);
        const id = generateId("lobby-");
        const maxPlayers = Math.max(2, Math.min(Number(payload.maxPlayers || 10), 1000));
        const lobby = {
          id,
          code: generateLobbyCode(this.state),
          name: asString(payload.name) || "Loto",
          password: asString(payload.password),
          admin_id: user.id,
          max_players: maxPlayers,
          status: "waiting",
          mode: asString(payload.mode) || "classic",
          created_at: getTimestamp(),
          started_at: null,
          drawn_numbers: [],
          chat: [],
          players: {},
        };
        lobby.players[user.id] = {
          id: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          games_played: user.games_played,
          games_won: user.games_won,
          status: "ready",
          is_admin: true,
          card: null,
          marked_cells: [],
          last_seen: getTimestamp(),
          joined_at: getTimestamp(),
        };
        this.state.lobbies[id] = lobby;
        this.setSocketAttachment(ws, { userId: user.id, lobbyId: id });
        await this.persist();
        return {
          type: "lobby_created",
          lobby: {
            id,
            code: lobby.code,
            name: lobby.name,
            adminId: user.id,
            admin_id: user.id,
            maxPlayers,
            max_players: maxPlayers,
            status: lobby.status,
            players: [toClientPlayer(lobby, lobby.players[user.id])],
          },
        };
      }

      case "join_lobby": {
        const user = this.ensureUser(userId, nickname, avatar);
        const code = asString(payload.code).toUpperCase();
        const lobby = Object.values(this.state.lobbies).find((item) => item.code === code);
        if (!lobby) return { type: "error", message: "Lobby not found" };
        if (lobby.status !== "waiting") return { type: "error", message: "Game already started" };
        if (lobby.password && lobby.password !== asString(payload.password)) {
          return { type: "error", message: "Wrong password" };
        }
        if (Object.keys(lobby.players || {}).length >= lobby.max_players) {
          return { type: "error", message: "Lobby is full" };
        }

        lobby.players ||= {};
        lobby.players[user.id] ||= {
          id: user.id,
          joined_at: getTimestamp(),
          last_seen: getTimestamp(),
          marked_cells: [],
          card: null,
        };
        Object.assign(lobby.players[user.id], {
          nickname: user.nickname,
          avatar: user.avatar,
          games_played: user.games_played,
          games_won: user.games_won,
          status: "waiting",
          is_admin: String(lobby.admin_id) === String(user.id),
        });
        this.setSocketAttachment(ws, { userId: user.id, lobbyId: lobby.id });
        await this.persist();

        this.broadcast(lobby.id, {
          type: "player_joined",
          player: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
          },
        }, user.id);
        this.broadcastState(lobby.id, user.id);

        return {
          type: "lobby_joined",
          lobbyId: lobby.id,
          isAdmin: String(lobby.admin_id) === String(user.id),
        };
      }

      case "leave_lobby": {
        const lobby = this.state.lobbies[lobbyId];
        if (lobby?.players?.[userId]) {
          delete lobby.players[userId];
          this.broadcast(lobby.id, { type: "player_left", userId }, userId);
          this.broadcastState(lobby.id, userId);
          if (Object.keys(lobby.players).length === 0 && lobby.status !== "playing") {
            delete this.state.lobbies[lobby.id];
            this.ctx.storage.delete(`lobby:${lobby.id}`).catch(() => {});
          }
          await this.persist();
        }
        this.setSocketAttachment(ws, { lobbyId: "" });
        return { type: "left_lobby" };
      }

      case "start_game": {
        const lobby = this.state.lobbies[lobbyId];
        if (!lobby) return { type: "error", message: "Lobby not found" };
        if (String(lobby.admin_id) !== String(userId)) {
          return { type: "error", message: "Only host can start game" };
        }
        lobby.status = "playing";
        lobby.started_at = getTimestamp();
        lobby.updated_at = getTimestamp();
        lobby.drawn_numbers = [];
        for (const player of Object.values(lobby.players || {})) {
          player.card = generateLotoCard();
          player.marked_cells = [];
          player.status = "playing";
          player.games_played = Number(player.games_played || 0) + 1;
          const profile = this.state.users[player.id];
          if (profile) profile.games_played = Number(profile.games_played || 0) + 1;
        }
        await this.persist();
        this.broadcast(lobby.id, { type: "game_started" });
        this.broadcastState(lobby.id);
        return this.getLobbyState(lobby.id, userId);
      }

      case "draw_number": {
        const lobby = this.state.lobbies[lobbyId];
        const number = Number(payload.number);
        if (!lobby) return { type: "error", message: "Lobby not found" };
        if (String(lobby.admin_id) !== String(userId)) {
          return { type: "error", message: "Only host can draw numbers" };
        }
        if (!Number.isInteger(number) || number < 1 || number > 90) {
          return { type: "error", message: "Number must be between 1 and 90" };
        }
        lobby.drawn_numbers ||= [];
        if (!lobby.drawn_numbers.includes(number)) lobby.drawn_numbers.push(number);
        lobby.updated_at = getTimestamp();
        await this.persist();
        this.broadcast(lobby.id, { type: "number_drawn", number, all: lobby.drawn_numbers });
        return { type: "state_update", drawn: lobby.drawn_numbers, all: lobby.drawn_numbers };
      }

      case "undo_number": {
        const lobby = this.state.lobbies[lobbyId];
        if (!lobby) return { type: "state_update", drawn: [], all: [] };
        const number = Number(payload.number);
        lobby.drawn_numbers = Number.isInteger(number) && number > 0
          ? (lobby.drawn_numbers || []).filter((item) => item !== number)
          : (lobby.drawn_numbers || []).slice(0, -1);
        lobby.updated_at = getTimestamp();
        this.syncMarksToDrawn(lobby);
        await this.persist();
        this.broadcast(lobby.id, { type: "numbers_updated", all: lobby.drawn_numbers });
        this.broadcastState(lobby.id);
        return { type: "state_update", drawn: lobby.drawn_numbers, all: lobby.drawn_numbers };
      }

      case "reset_numbers": {
        const lobby = this.state.lobbies[lobbyId];
        if (!lobby) return { type: "state_update", drawn: [], all: [] };
        lobby.drawn_numbers = [];
        lobby.updated_at = getTimestamp();
        this.syncMarksToDrawn(lobby);
        await this.persist();
        this.broadcast(lobby.id, { type: "numbers_updated", all: [] });
        this.broadcastState(lobby.id);
        return { type: "state_update", drawn: [], all: [] };
      }

      case "chat_message": {
        const lobby = this.state.lobbies[lobbyId];
        if (!lobby) return { type: "success" };
        const user = this.ensureUser(userId, nickname, avatar);
        const message = {
          id: generateId("msg-"),
          lobbyId: lobby.id,
          userId: user.id,
          nickname: user.nickname,
          avatar: user.avatar,
          text: asString(payload.text).slice(0, 500),
          timestamp: getTimestamp(),
        };
        lobby.chat ||= [];
        lobby.chat.push(message);
        lobby.chat = lobby.chat.slice(-100);
        lobby.updated_at = getTimestamp();
        await this.persist();
        this.broadcast(lobby.id, { type: "chat_message", message });
        return { type: "chat_message", message };
      }

      case "clear_chat": {
        const lobby = this.state.lobbies[lobbyId];
        if (!lobby) return { type: "error", message: "Lobby not found" };
        if (String(lobby.admin_id) !== String(userId)) {
          return { type: "error", message: "Only host can clear chat" };
        }
        lobby.chat = [];
        lobby.updated_at = getTimestamp();
        await this.persist();
        this.broadcast(lobby.id, { type: "chat_cleared", lobbyId: lobby.id });
        return { type: "chat_cleared", lobbyId: lobby.id };
      }

      case "update_profile": {
        const user = this.ensureUser(userId, payload.nickname || nickname, payload.avatar || avatar);
        for (const lobby of Object.values(this.state.lobbies)) {
          const player = lobby.players?.[user.id];
          if (player) {
            player.nickname = user.nickname;
            player.avatar = user.avatar;
          }
        }
        await this.persist();
        return {
          type: "profile_updated",
          profile: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            games_played: user.games_played,
            games_won: user.games_won,
          },
        };
      }

      case "mark_cell": {
        const lobby = this.state.lobbies[lobbyId];
        const player = lobby?.players?.[userId];
        if (!lobby || !player) return { type: "error", message: "Player not found in lobby" };
        const allowed = new Set((lobby.drawn_numbers || []).map(Number));
        let cells = Array.isArray(payload.cells)
          ? normalizeCells(payload.cells)
          : normalizeCells(player.marked_cells);
        if (payload.number !== undefined) {
          const number = Number(payload.number);
          if (allowed.has(number) && !cells.includes(number)) cells.push(number);
        }
        cells = normalizeCells(cells).filter((number) => allowed.has(number));
        player.marked_cells = cells;

        const cardNumbers = flattenCard(player.card);
        const cardSet = new Set(cardNumbers);
        const markedCardCount = cells.filter((number) => cardSet.has(number)).length;
        if (cardNumbers.length > 0 && markedCardCount >= cardNumbers.length && lobby.status !== "finished") {
          lobby.status = "finished";
          lobby.finished_at = getTimestamp();
          lobby.updated_at = getTimestamp();
          player.games_won = Number(player.games_won || 0) + 1;
          const profile = this.state.users[userId];
          if (profile) {
            profile.games_won = Number(profile.games_won || 0) + 1;
            profile.total_score = Number(profile.total_score || 0) + 100;
          }
          await this.persist();
          const win = { type: "game_won", winnerId: userId, winnerName: player.nickname };
          this.broadcast(lobby.id, win);
          return win;
        }

        lobby.updated_at = getTimestamp();
        await this.persist();
        this.broadcastState(lobby.id);
        return { type: "success" };
      }

      default:
        return { type: "error", message: "Unknown action" };
    }
  }

  syncMarksToDrawn(lobby) {
    const allowed = new Set((lobby.drawn_numbers || []).map(Number));
    for (const player of Object.values(lobby.players || {})) {
      player.marked_cells = normalizeCells(player.marked_cells).filter((number) => allowed.has(number));
    }
  }
}
