const WebSocket = require('ws');
const express = require('express');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const path = require('path');

// Инициализация Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));
// также раздаём файлы из папки server (game.html, admin.html, overlay.html, sounds.json)
app.use(express.static(__dirname));

// Инициализация базы данных
const DB_PATH = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? require('path').join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'loto.db')
  : 'loto.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// Создание таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    telegram_id INTEGER UNIQUE,
    nickname TEXT NOT NULL,
    avatar TEXT DEFAULT '👤',
    games_played INTEGER DEFAULT 0,
    games_won INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    achievements TEXT DEFAULT '[]',
    friends TEXT DEFAULT '[]',
    settings TEXT DEFAULT '{}',
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    last_seen INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS lobbies (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password TEXT,
    admin_id TEXT NOT NULL,
    max_players INTEGER DEFAULT 10,
    status TEXT DEFAULT 'waiting',
    mode TEXT DEFAULT 'classic',
    current_round INTEGER DEFAULT 1,
    total_rounds INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    started_at INTEGER,
    ended_at INTEGER,
    FOREIGN KEY (admin_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS lobby_players (
    lobby_id TEXT,
    user_id TEXT,
    status TEXT DEFAULT 'waiting',
    card TEXT,
    marked_cells TEXT DEFAULT '[]',
    position INTEGER,
    score INTEGER DEFAULT 0,
    joined_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (lobby_id, user_id),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS drawn_numbers (
    lobby_id TEXT,
    number INTEGER,
    drawn_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (lobby_id, number),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id)
  );

  CREATE TABLE IF NOT EXISTS games_history (
    id TEXT PRIMARY KEY,
    lobby_id TEXT,
    winner_id TEXT,
    mode TEXT,
    round INTEGER,
    players_count INTEGER,
    duration INTEGER,
    numbers_drawn INTEGER,
    replay_data TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (winner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    lobby_id TEXT,
    user_id TEXT,
    message TEXT NOT NULL,
    timestamp INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (lobby_id) REFERENCES lobbies(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    icon TEXT,
    condition_type TEXT,
    condition_value INTEGER
  );

  CREATE TABLE IF NOT EXISTS leaderboard (
    user_id TEXT,
    period TEXT,
    wins INTEGER DEFAULT 0,
    games INTEGER DEFAULT 0,
    score INTEGER DEFAULT 0,
    rank INTEGER,
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    PRIMARY KEY (user_id, period),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// Заполняем достижения
const achievements = [
  { id: 'first_win', name: 'Первая победа', description: 'Выиграйте первую игру', icon: '🏆', type: 'wins', value: 1 },
  { id: 'win_streak_3', name: 'Серия из 3', description: 'Выиграйте 3 игры подряд', icon: '🔥', type: 'streak', value: 3 },
  { id: 'win_streak_5', name: 'Серия из 5', description: 'Выиграйте 5 игр подряд', icon: '⭐', type: 'streak', value: 5 },
  { id: 'games_10', name: 'Десяточка', description: 'Сыграйте 10 игр', icon: '🎮', type: 'games', value: 10 },
  { id: 'games_50', name: 'Ветеран', description: 'Сыграйте 50 игр', icon: '🎯', type: 'games', value: 50 },
  { id: 'games_100', name: 'Легенда', description: 'Сыграйте 100 игр', icon: '👑', type: 'games', value: 100 },
  { id: 'fast_win', name: 'Быстрая победа', description: 'Победите за 15 бочонков', icon: '⚡', type: 'fast', value: 15 },
  { id: 'social', name: 'Общительный', description: 'Добавьте 5 друзей', icon: '👥', type: 'friends', value: 5 },
];

const insertAchievement = db.prepare(`
  INSERT OR IGNORE INTO achievements (id, name, description, icon, condition_type, condition_value)
  VALUES (?, ?, ?, ?, ?, ?)
`);

achievements.forEach(a => {
  insertAchievement.run(a.id, a.name, a.description, a.icon, a.type, a.value);
});

// ============================================================
// Глобальное состояние бочонков (текущая игра, in-memory)
// ============================================================
let globalDrawn = []; // массив чисел в порядке вытягивания

// ============================================================
// WebSocket сервер
// ============================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

const wss = new WebSocket.Server({ server });

// Хранилище активных соединений
const clients = new Map(); // userId -> WebSocket
const lobbyClients = new Map(); // lobbyId -> Set<userId>

// Вспомогательные функции
function generateLobbyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function broadcast(lobbyId, message, excludeUserId = null) {
  const users = lobbyClients.get(lobbyId);
  if (!users) return;

  users.forEach(userId => {
    if (userId !== excludeUserId) {
      const client = clients.get(userId);
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  });
}

function sendToUser(userId, message) {
  const client = clients.get(userId);
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
  }
}

// Обработка WebSocket соединений
wss.on('connection', (ws) => {
  let currentUserId = null;
  let currentLobbyId = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      switch (message.type) {
        case 'auth':
          handleAuth(ws, message);
          break;
        case 'create_lobby':
          handleCreateLobby(ws, message);
          break;
        case 'join_lobby':
          handleJoinLobby(ws, message);
          break;
        case 'leave_lobby':
          handleLeaveLobby(ws, message);
          break;
        case 'start_game':
          handleStartGame(ws, message);
          break;
        case 'draw_number':
          handleDrawNumber(ws, message);
          break;
        case 'mark_cell':
          handleMarkCell(ws, message);
          break;
        case 'chat_message':
          handleChatMessage(ws, message);
          break;
        case 'get_leaderboard':
          handleGetLeaderboard(ws, message);
          break;
        case 'get_history':
          handleGetHistory(ws, message);
          break;
        case 'add_friend':
          handleAddFriend(ws, message);
          break;
        case 'update_profile':
          handleUpdateProfile(ws, message);
          break;
        case 'change_theme':
          handleChangeTheme(ws, message);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    if (currentUserId) {
      clients.delete(currentUserId);
      
      if (currentLobbyId) {
        const users = lobbyClients.get(currentLobbyId);
        if (users) {
          users.delete(currentUserId);
          
          // Уведомляем остальных игроков
          broadcast(currentLobbyId, {
            type: 'player_left',
            userId: currentUserId
          });
        }
      }
    }
  });

  // Обработчики
  function handleAuth(ws, message) {
    const { userId, telegramId, nickname } = message;
    
    // Создаём или обновляем пользователя
    const stmt = db.prepare(`
      INSERT INTO users (id, telegram_id, nickname, last_seen)
      VALUES (?, ?, ?, strftime('%s', 'now'))
      ON CONFLICT(id) DO UPDATE SET
        last_seen = strftime('%s', 'now'),
        nickname = excluded.nickname
      ON CONFLICT(telegram_id) DO UPDATE SET
        last_seen = strftime('%s', 'now'),
        nickname = excluded.nickname
    `);
    
    stmt.run(userId, telegramId || null, nickname);
    
    // Сохраняем соединение
    currentUserId = userId;
    clients.set(userId, ws);
    
    // Загружаем профиль
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const achievements = db.prepare(`
      SELECT a.* FROM achievements a
      WHERE a.id IN (SELECT value FROM json_each(?))
    `).all(user.achievements);
    
    ws.send(JSON.stringify({
      type: 'auth_success',
      user: {
        ...user,
        achievements: achievements
      }
    }));
  }

  function handleCreateLobby(ws, message) {
    const { name, password, maxPlayers, mode, rounds } = message;
    const lobbyId = uuidv4();
    const code = generateLobbyCode();
    
    const stmt = db.prepare(`
      INSERT INTO lobbies (id, code, name, password, admin_id, max_players, mode, total_rounds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(lobbyId, code, name, password || null, currentUserId, maxPlayers, mode || 'classic', rounds || 1);
    
    // Добавляем создателя в лобби
    db.prepare(`
      INSERT INTO lobby_players (lobby_id, user_id, status)
      VALUES (?, ?, 'ready')
    `).run(lobbyId, currentUserId);
    
    currentLobbyId = lobbyId;
    
    if (!lobbyClients.has(lobbyId)) {
      lobbyClients.set(lobbyId, new Set());
    }
    lobbyClients.get(lobbyId).add(currentUserId);
    
    ws.send(JSON.stringify({
      type: 'lobby_created',
      lobby: {
        id: lobbyId,
        code: code,
        name: name,
        adminId: currentUserId,
        maxPlayers: maxPlayers,
        mode: mode,
        rounds: rounds
      }
    }));
  }

  function handleJoinLobby(ws, message) {
    const { code, password } = message;
    
    const lobby = db.prepare(`SELECT * FROM lobbies WHERE code = ? AND status = 'waiting'`).get(code);
    
    if (!lobby) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Лобби не найдено' }));
    }
    
    if (lobby.password && lobby.password !== password) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Неверный пароль' }));
    }
    
    const playersCount = db.prepare('SELECT COUNT(*) as count FROM lobby_players WHERE lobby_id = ?').get(lobby.id).count;
    
    if (playersCount >= lobby.max_players) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Лобби заполнено' }));
    }
    
    // Добавляем игрока
    db.prepare(`
      INSERT OR IGNORE INTO lobby_players (lobby_id, user_id)
      VALUES (?, ?)
    `).run(lobby.id, currentUserId);
    
    currentLobbyId = lobby.id;
    
    if (!lobbyClients.has(lobby.id)) {
      lobbyClients.set(lobby.id, new Set());
    }
    lobbyClients.get(lobby.id).add(currentUserId);
    
    // Отправляем данные лобби
    const players = db.prepare(`
      SELECT u.id, u.nickname, u.avatar, lp.status
      FROM lobby_players lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.lobby_id = ?
    `).all(lobby.id);
    
    ws.send(JSON.stringify({
      type: 'lobby_joined',
      lobby: {
        ...lobby,
        players: players
      }
    }));
    
    // Уведомляем остальных
    broadcast(lobby.id, {
      type: 'player_joined',
      player: {
        id: currentUserId,
        nickname: db.prepare('SELECT nickname, avatar FROM users WHERE id = ?').get(currentUserId)
      }
    }, currentUserId);
  }

  function handleLeaveLobby(ws, message) {
    if (!currentLobbyId) return;
    
    db.prepare('DELETE FROM lobby_players WHERE lobby_id = ? AND user_id = ?').run(currentLobbyId, currentUserId);
    
    const users = lobbyClients.get(currentLobbyId);
    if (users) {
      users.delete(currentUserId);
    }
    
    broadcast(currentLobbyId, {
      type: 'player_left',
      userId: currentUserId
    });
    
    currentLobbyId = null;
    
    ws.send(JSON.stringify({ type: 'left_lobby' }));
  }

  function handleStartGame(ws, message) {
    if (!currentLobbyId) return;
    
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(currentLobbyId);
    
    if (lobby.admin_id !== currentUserId) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Только админ может начать игру' }));
    }
    
    // Обновляем статус лобби
    db.prepare(`
      UPDATE lobbies SET status = 'playing', started_at = strftime('%s', 'now')
      WHERE id = ?
    `).run(currentLobbyId);
    
    // Генерируем карточки для всех игроков
    const players = db.prepare('SELECT user_id FROM lobby_players WHERE lobby_id = ?').all(currentLobbyId);
    
    players.forEach(player => {
      const card = generateLotoCard();
      db.prepare(`
        UPDATE lobby_players SET card = ?, status = 'playing'
        WHERE lobby_id = ? AND user_id = ?
      `).run(JSON.stringify(card), currentLobbyId, player.user_id);
      
      // Увеличиваем счётчик игр
      db.prepare('UPDATE users SET games_played = games_played + 1 WHERE id = ?').run(player.user_id);

      sendToUser(player.user_id, {
        type: 'game_started',
        card: card
      });
    });
    
    broadcast(currentLobbyId, {
      type: 'game_started'
    });
  }

  function handleDrawNumber(ws, message) {
    const { lobbyId, number } = message;
    
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(lobbyId);
    
    if (lobby.admin_id !== currentUserId) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Только админ может тянуть бочонки' }));
    }
    
    // Добавляем число
    db.prepare(`
      INSERT OR IGNORE INTO drawn_numbers (lobby_id, number)
      VALUES (?, ?)
    `).run(lobbyId, number);
    
    // Отправляем всем игрокам
    broadcast(lobbyId, {
      type: 'number_drawn',
      number: number
    });
  }

  function handleMarkCell(ws, message) {
    const { number } = message;
    
    if (!currentLobbyId) return;
    
    // Проверяем, выпало ли число (через глобальный список globalDrawn)
    if (!globalDrawn.includes(Number(number))) {
      return ws.send(JSON.stringify({ type: 'error', message: 'Это число ещё не выпало' }));
    }
    
    // Получаем текущие отмеченные ячейки
    const player = db.prepare('SELECT marked_cells FROM lobby_players WHERE lobby_id = ? AND user_id = ?').get(currentLobbyId, currentUserId);
    const markedCells = JSON.parse(player.marked_cells);
    
    if (!markedCells.includes(number)) {
      markedCells.push(number);
    }
    
    db.prepare(`
      UPDATE lobby_players SET marked_cells = ?
      WHERE lobby_id = ? AND user_id = ?
    `).run(JSON.stringify(markedCells), currentLobbyId, currentUserId);
    
    // Проверяем победу
    if (markedCells.length === 15) {
      handleWin();
    }
  }

  function handleWin() {
    // Обновляем статистику
    db.prepare('UPDATE users SET games_won = games_won + 1, total_score = total_score + 100 WHERE id = ?').run(currentUserId);
    
    // Сохраняем игру в историю
    const lobby = db.prepare('SELECT * FROM lobbies WHERE id = ?').get(currentLobbyId);
    const numbersDrawn = db.prepare('SELECT COUNT(*) as count FROM drawn_numbers WHERE lobby_id = ?').get(currentLobbyId).count;
    const playersCount = db.prepare('SELECT COUNT(*) as count FROM lobby_players WHERE lobby_id = ?').get(currentLobbyId).count;
    
    const gameId = uuidv4();
    db.prepare(`
      INSERT INTO games_history (id, lobby_id, winner_id, mode, round, players_count, numbers_drawn, duration)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(gameId, currentLobbyId, currentUserId, lobby.mode, lobby.current_round, playersCount, numbersDrawn, Date.now() - lobby.started_at * 1000);
    
    // Уведомляем всех
    broadcast(currentLobbyId, {
      type: 'game_won',
      winnerId: currentUserId,
      winnerName: db.prepare('SELECT nickname FROM users WHERE id = ?').get(currentUserId).nickname
    });
    
    // Проверяем достижения
    checkAchievements(currentUserId);
  }

  function handleChatMessage(ws, message) {
    const { text } = message;
    
    if (!currentLobbyId) return;
    
    const messageId = uuidv4();
    
    db.prepare(`
      INSERT INTO chat_messages (id, lobby_id, user_id, message)
      VALUES (?, ?, ?, ?)
    `).run(messageId, currentLobbyId, currentUserId, text);
    
    const user = db.prepare('SELECT nickname, avatar FROM users WHERE id = ?').get(currentUserId);
    
    broadcast(currentLobbyId, {
      type: 'chat_message',
      message: {
        id: messageId,
        userId: currentUserId,
        nickname: user.nickname,
        avatar: user.avatar,
        text: text,
        timestamp: Date.now()
      }
    });
  }

  function handleGetLeaderboard(ws, message) {
    const { period } = message; // 'daily', 'weekly', 'alltime'
    
    const leaderboard = db.prepare(`
      SELECT u.id, u.nickname, u.avatar, u.games_won, u.games_played, u.total_score,
             ROUND(CAST(u.games_won AS FLOAT) / NULLIF(u.games_played, 0) * 100, 1) as win_rate
      FROM users u
      WHERE u.games_played > 0
      ORDER BY u.total_score DESC
      LIMIT 100
    `).all();
    
    ws.send(JSON.stringify({
      type: 'leaderboard',
      period: period,
      data: leaderboard
    }));
  }

  function handleGetHistory(ws, message) {
    const history = db.prepare(`
      SELECT gh.*, u.nickname as winner_name, l.name as lobby_name
      FROM games_history gh
      JOIN users u ON gh.winner_id = u.id
      JOIN lobbies l ON gh.lobby_id = l.id
      WHERE gh.lobby_id IN (
        SELECT lobby_id FROM lobby_players WHERE user_id = ?
      )
      ORDER BY gh.created_at DESC
      LIMIT 50
    `).all(currentUserId);
    
    ws.send(JSON.stringify({
      type: 'history',
      data: history
    }));
  }

  function handleAddFriend(ws, message) {
    const { friendId } = message;
    
    const user = db.prepare('SELECT friends FROM users WHERE id = ?').get(currentUserId);
    const friends = JSON.parse(user.friends);
    
    if (!friends.includes(friendId)) {
      friends.push(friendId);
      db.prepare('UPDATE users SET friends = ? WHERE id = ?').run(JSON.stringify(friends), currentUserId);
      
      ws.send(JSON.stringify({
        type: 'friend_added',
        friendId: friendId
      }));
      
      checkAchievements(currentUserId);
    }
  }

  function handleUpdateProfile(ws, message) {
    const { nickname, avatar } = message;
    
    db.prepare('UPDATE users SET nickname = ?, avatar = ? WHERE id = ?').run(nickname, avatar, currentUserId);
    
    ws.send(JSON.stringify({
      type: 'profile_updated'
    }));
  }

  function handleChangeTheme(ws, message) {
    const { theme } = message;
    
    const user = db.prepare('SELECT settings FROM users WHERE id = ?').get(currentUserId);
    const settings = JSON.parse(user.settings || '{}');
    settings.theme = theme;
    
    db.prepare('UPDATE users SET settings = ? WHERE id = ?').run(JSON.stringify(settings), currentUserId);
    
    ws.send(JSON.stringify({
      type: 'theme_changed',
      theme: theme
    }));
  }

  function checkAchievements(userId) {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const currentAchievements = JSON.parse(user.achievements);
    const newAchievements = [];
    
    // Проверяем различные достижения
    const checks = [
      { id: 'first_win', condition: user.games_won >= 1 },
      { id: 'games_10', condition: user.games_played >= 10 },
      { id: 'games_50', condition: user.games_played >= 50 },
      { id: 'games_100', condition: user.games_played >= 100 },
      { id: 'social', condition: JSON.parse(user.friends).length >= 5 },
    ];
    
    checks.forEach(check => {
      if (check.condition && !currentAchievements.includes(check.id)) {
        currentAchievements.push(check.id);
        newAchievements.push(check.id);
      }
    });
    
    if (newAchievements.length > 0) {
      db.prepare('UPDATE users SET achievements = ? WHERE id = ?').run(JSON.stringify(currentAchievements), userId);
      
      const achievementData = db.prepare(`
        SELECT * FROM achievements WHERE id IN (${newAchievements.map(() => '?').join(',')})
      `).all(...newAchievements);
      
      sendToUser(userId, {
        type: 'achievements_unlocked',
        achievements: achievementData
      });
    }
  }

  function shuffle(a) {
    for (let i = a.length-1; i > 0; i--) {
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
  }

  function generateLotoCard() {
    const ranges = [[1,9],[10,19],[20,29],[30,39],[40,49],[50,59],[60,69],[70,79],[80,90]];

    for (let attempt = 0; attempt < 2000; attempt++) {
      const colCount = Array(9).fill(0);
      const mask = Array(3).fill(null).map(() => Array(9).fill(false));
      let ok = true;

      // Шаг 1: каждому столбцу — минимум 1 число
      const cols9 = [0,1,2,3,4,5,6,7,8];
      shuffle(cols9);
      for (let i = 0; i < 9; i++) {
        const row = Math.floor(i / 3);
        const col = cols9[i];
        mask[row][col] = true;
        colCount[col]++;
      }

      // Шаг 2: добавляем ещё по 2 числа в каждый ряд (до 5)
      for (let row = 0; row < 3; row++) {
        const need = 5 - mask[row].filter(Boolean).length;
        const available = [];
        for (let c = 0; c < 9; c++) {
          if (!mask[row][c] && colCount[c] < 2) available.push(c);
        }
        if (available.length < need) { ok = false; break; }
        shuffle(available);
        for (const c of available.slice(0, need)) {
          mask[row][c] = true;
          colCount[c]++;
        }
      }
      if (!ok) continue;

      // Проверка: каждый ряд = 5, каждый столбец = 1-2
      let valid = true;
      for (let r = 0; r < 3; r++) if (mask[r].filter(Boolean).length !== 5) { valid = false; break; }
      for (let c = 0; c < 9; c++) if (colCount[c] < 1 || colCount[c] > 2) { valid = false; break; }
      if (!valid) continue;

      const card = Array(3).fill(null).map(() => Array(9).fill(null));
      for (let col = 0; col < 9; col++) {
        const [min, max] = ranges[col];
        const rows = [0,1,2].filter(r => mask[r][col]);
        const pool = [];
        for (let n = min; n <= max; n++) pool.push(n);
        shuffle(pool);
        const chosen = pool.slice(0, rows.length).sort((a,b) => a-b);
        rows.sort((a,b)=>a-b).forEach((r, i) => { card[r][col] = chosen[i]; });
      }
      return card;
    }
    return Array(3).fill(null).map(() => Array(9).fill(null));
  }


});

// REST API endpoints
app.get('/api/status', (req, res) => {
  res.json({ status: 'online', version: '1.0.0' });
});

// ---- REST: глобальные бочонки (для admin.html и overlay.html) ----

app.get('/api/drawn', (req, res) => {
  res.json({ drawn: globalDrawn });
});

app.post('/api/drawn', (req, res) => {
  const n = parseInt(req.body.number);
  if (isNaN(n) || n < 1 || n > 90) {
    return res.status(400).json({ error: 'Число должно быть от 1 до 90' });
  }
  if (!globalDrawn.includes(n)) {
    globalDrawn.push(n);
    // Рассылаем всем WS-клиентам
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(JSON.stringify({ type: 'number_drawn', number: n, all: [...globalDrawn] }));
      }
    });
  }
  res.json({ ok: true, drawn: globalDrawn });
});

app.delete('/api/drawn/all', (req, res) => {
  globalDrawn = [];
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify({ type: 'numbers_updated', all: [] }));
    }
  });
  res.json({ ok: true });
});

app.delete('/api/drawn/:number', (req, res) => {
  const n = parseInt(req.params.number);
  globalDrawn = globalDrawn.filter(x => x !== n);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) {
      c.send(JSON.stringify({ type: 'numbers_updated', all: [...globalDrawn] }));
    }
  });
  res.json({ ok: true, drawn: globalDrawn });
});


// ---- REST: статистика игрока ----
app.get('/api/users/:id/stats', (req, res) => {
  try {
    const user = db.prepare('SELECT games_played, games_won, nickname FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'not found' });
    res.json(user);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- REST: управление лобби (для admin.html) ----

// Все лобби (включая playing)
app.get('/api/lobbies/all', (req, res) => {
  const lobbies = db.prepare(`
    SELECT l.id, l.code, l.name, l.admin_id, l.max_players, l.status, l.created_at,
      CASE WHEN l.password IS NULL THEN 0 ELSE 1 END as has_password,
      COUNT(lp.user_id) as players_count
    FROM lobbies l
    LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
    WHERE l.status IN ('waiting','playing')
    GROUP BY l.id
    ORDER BY l.created_at DESC
    LIMIT 50
  `).all();
  res.json(lobbies);
});

// Игроки в лобби с прогрессом
app.get('/api/lobbies/:id/players', (req, res) => {
  const players = db.prepare(`
    SELECT u.id, u.nickname, lp.marked_cells, lp.status,
      CASE WHEN l.admin_id = u.id THEN 1 ELSE 0 END as is_admin
    FROM lobby_players lp
    JOIN users u ON lp.user_id = u.id
    JOIN lobbies l ON lp.lobby_id = l.id
    WHERE lp.lobby_id = ?
  `).all(req.params.id);
  res.json(players);
});

// Закрыть лобби (админ)
app.delete('/api/lobbies/:id', (req, res) => {
  const id = req.params.id;
  // Уведомляем игроков
  const players = db.prepare('SELECT user_id FROM lobby_players WHERE lobby_id = ?').all(id);
  players.forEach(p => {
    const client = clients.get(p.user_id);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: 'left_lobby', reason: 'Лобби закрыто администратором' }));
    }
  });
  // Удаляем в правильном порядке (FOREIGN KEY)
  db.prepare('DELETE FROM chat_messages WHERE lobby_id = ?').run(id);
  db.prepare('DELETE FROM drawn_numbers WHERE lobby_id = ?').run(id);
  db.prepare('DELETE FROM games_history WHERE lobby_id = ?').run(id);
  db.prepare('DELETE FROM lobby_players WHERE lobby_id = ?').run(id);
  db.prepare('DELETE FROM lobbies WHERE id = ?').run(id);
  const lc = lobbyClients.get(id);
  if (lc) lobbyClients.delete(id);
  res.json({ ok: true });
});

// ---- REST: список лобби ----
app.get('/api/lobbies', (req, res) => {
  const showAll = req.query.all === '1';
  let lobbies;
  if (showAll) {
    lobbies = db.prepare(`
      SELECT l.id, l.code, l.name, l.admin_id, l.max_players, l.status, l.created_at,
        CASE WHEN l.password IS NULL THEN 0 ELSE 1 END as has_password,
        COUNT(lp.user_id) as players_count
      FROM lobbies l LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
      WHERE l.status IN ('waiting','playing')
      GROUP BY l.id ORDER BY l.created_at DESC LIMIT 50
    `).all();
  } else {
    lobbies = db.prepare(`
      SELECT l.id, l.code, l.name, l.admin_id, l.max_players, l.status, l.created_at,
        CASE WHEN l.password IS NULL THEN 0 ELSE 1 END as has_password,
        COUNT(lp.user_id) as players_count
      FROM lobbies l LEFT JOIN lobby_players lp ON l.id = lp.lobby_id
      WHERE l.status = 'waiting'
      GROUP BY l.id ORDER BY l.created_at DESC LIMIT 50
    `).all();
  }
  res.json(lobbies);
});
console.log('✅ Database initialized');
console.log('✅ WebSocket server ready');
