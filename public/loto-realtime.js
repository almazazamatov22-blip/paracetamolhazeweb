// =============================================
// LOTO — Supabase Bridge V7 (server-only fetch interceptor)
// Все игровые запросы идут через наш Next API, чтобы браузер игрока
// не зависел от прямого доступа к *.supabase.co.
// =============================================

const SUPABASE_URL  = 'https://dlybapjwphbcynfkdxyk.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseWJhcGp3cGhiY3luZmtkeHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTEzMzQsImV4cCI6MjA5MjAyNzMzNH0.XVjs3XJVUR51NXjxgFKnCrW1f-Irv3AQRItonjeDDPk';

// ── Supabase клиент ──────────────────────────────────────────────────────────

let _sb = null;
let _sbUnavailableUntil = 0;
const SB_WAIT_TIMEOUT_MS = 450;
const SB_RETRY_COOLDOWN_MS = 30000;

function getSB() {
  if (_sb) return _sb;
  if (!window.supabase) return null;
  _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  _sbUnavailableUntil = 0;
  return _sb;
}

// Ждёт инициализации SDK (на случай гонки, хотя в <head> она маловероятна)
function waitForSB(timeoutMs = SB_WAIT_TIMEOUT_MS) {
  if (Date.now() < _sbUnavailableUntil) return Promise.resolve(null);
  return new Promise(resolve => {
    const sb = getSB();
    if (sb) return resolve(sb);
    const timeout = setTimeout(() => {
      clearInterval(t);
      _sbUnavailableUntil = Date.now() + SB_RETRY_COOLDOWN_MS;
      resolve(null);
    }, timeoutMs);
    const t = setInterval(() => {
      const sb2 = getSB();
      if (sb2) {
        clearInterval(t);
        clearTimeout(timeout);
        resolve(sb2);
      }
    }, 50);
  });
}

// ── Утилиты ──────────────────────────────────────────────────────────────────

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function failSupabase(err) {
  if (!err) return;
  const msg = String(err?.message || err || 'Supabase request failed');
  throw new Error('SUPABASE_REQUEST_FAILED: ' + msg);
}

function withTimeout(promise, timeoutMs = 4000, code = 'SUPABASE_TIMEOUT') {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(code)), timeoutMs);
    promise.then((v) => { clearTimeout(t); resolve(v); }).catch((e) => { clearTimeout(t); reject(e); });
  });
}

function toServerBridgeUrl(url) {
  try {
    const u = new URL(String(url), window.location.origin);
    if (u.pathname === '/api/loto' || u.pathname === '/api/drawn') {
      u.pathname = '/api/loto-supabase';
      if (!u.searchParams.get('userId') && window.userId) {
        u.searchParams.set('userId', String(window.userId));
      }
    }
    return u.toString();
  } catch (_) {
    const mapped = String(url)
      .replace('/api/loto', '/api/loto-supabase')
      .replace('/api/drawn', '/api/loto-supabase');
    if (mapped.includes('userId=')) return mapped;
    if (!window.userId) return mapped;
    const glue = mapped.includes('?') ? '&' : '?';
    return `${mapped}${glue}userId=${encodeURIComponent(String(window.userId))}`;
  }
}

function genCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let r = '';
  for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return r;
}

// Стандартная карточка лото 3×9 (5 чисел в строке) — запасной вариант,
// если window.generateLotoCard ещё не определена (например, для adminStart)
function _defaultCard() {
  const rows = [[], [], []];
  // Для каждого столбца (десятки): 1-10, 11-20, … 81-90
  for (let col = 0; col < 9; col++) {
    const min = col * 10 + 1;
    const max = col === 8 ? 90 : (col + 1) * 10;
    const pool = [];
    for (let n = min; n <= max; n++) pool.push(n);
    // Перемешать
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let r = 0; r < 3; r++) rows[r].push(pool[r] !== undefined ? pool[r] : null);
  }
  // Оставить ровно 5 чисел в каждой строке
  rows.forEach(row => {
    const filled = row.map((v, i) => v !== null ? i : -1).filter(i => i >= 0);
    // Перемешать индексы заполненных клеток
    for (let i = filled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filled[i], filled[j]] = [filled[j], filled[i]];
    }
    // Обнулить лишние (оставить 5)
    filled.slice(5).forEach(i => { row[i] = null; });
  });
  return rows;
}

// ── Supabase Realtime подписки ────────────────────────────────────────────────

let _subscribedLobbyId = null;

function subscribeToLobby(lobbyId) {
  if (_subscribedLobbyId === lobbyId) return;
  _subscribedLobbyId = lobbyId;

  const sb = getSB();
  if (!sb) { console.warn('[Bridge] Supabase not ready for subscription'); return; }

  // Изменения лобби: бочонки, статус, событие
  sb.channel('bridge-lobby-' + lobbyId)
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'loto_lobbies',
      filter: `id=eq.${lobbyId}`
    }, ({ new: row }) => {
      const drawn = (row.drawn_numbers || []).map(Number);

      // Обновляем глобальные переменные index.html
      if (typeof window.drawnOrder    !== 'undefined') window.drawnOrder    = drawn;
      if (typeof window.drawnNumbers  !== 'undefined') window.drawnNumbers  = new Set(drawn);

      // Обновляем только отображение выпавших чисел — НЕ вызываем renderCard (анимации)
      if (window.updateGameDisplay)         window.updateGameDisplay();
      if (window.updateGameStats)           window.updateGameStats();
      if (window.updateDrawnNumbersDisplay) window.updateDrawnNumbersDisplay();
      // updateDisplay() для admin.html
      if (window.updateDisplay && !window.cardNumbers) window.updateDisplay();

      // Событие «игра стартовала» — загружаем карточку текущего игрока
      if (row.event && row.event.type === 'game_started') {
        _loadMyCard(lobbyId);
      }
    })
    .subscribe();

  // Изменения состава игроков
  sb.channel('bridge-players-' + lobbyId)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'loto_players',
      filter: `lobby_id=eq.${lobbyId}`
    }, async () => {
      const { data: players } = await sb
        .from('loto_players').select('*').eq('lobby_id', lobbyId);
      if (!players) return;

      const mapped = players.map(p => ({
        id:       p.id,
        nickname: p.nickname,
        isAdmin:  p.is_admin,
        status:   p.status,
        progress: (p.marked_cells || []).length
      }));

      if (typeof window.currentLobby !== 'undefined') {
        window.currentLobby = { ...(window.currentLobby || {}), players: mapped };
      }
      if (window.renderPlayers)     window.renderPlayers(mapped);
      if (window.updateLobbyDisplay) window.updateLobbyDisplay();
    })
    .subscribe();

  // Новые сообщения чата
  sb.channel('bridge-chat-' + lobbyId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'loto_chat',
      filter: `lobby_id=eq.${lobbyId}`
    }, ({ new: row }) => {
      if (window.appendChatMessage) {
        window.appendChatMessage({
          id:        row.id,
          userId:    row.user_id,
          nickname:  row.nickname,
          text:      row.text,
          timestamp: row.created_at
        });
      }
    })
    .subscribe();

  console.log('[Bridge] Subscribed to lobby:', lobbyId);
}

async function _loadMyCard(lobbyId) {
  const sb  = getSB();
  const uid = window.userId;
  if (!sb || !uid) return;
  const { data } = await sb
    .from('loto_players').select('card, marked_cells')
    .eq('id', uid).eq('lobby_id', lobbyId)
    .maybeSingle();
  if (data?.card) {
    window.cardNumbers   = data.card;
    window.gameScreenShown = true;
    // V5: сохраняем в localStorage для F5-восстановления
    try {
      localStorage.setItem('cardNumbers',    JSON.stringify(data.card));
      localStorage.setItem('gameScreenShown', 'true');
      localStorage.setItem('currentLobbyId',  lobbyId);
      if (data.marked_cells && data.marked_cells.length) {
        localStorage.setItem('markedCells', JSON.stringify(data.marked_cells));
        if (typeof window.markedCells !== 'undefined') {
          window.markedCells = new Set(data.marked_cells.map(Number));
        }
      }
    } catch(_) {}
    if (window.renderCard)  window.renderCard();
    if (window.showScreen)  window.showScreen('gameScreen');
  }
}

// ── Вспомогательные запросы к Supabase ───────────────────────────────────────

async function _getLobbyState(sb, lobbyId) {
  const [{ data: lobby, error: lobbyErr }, { data: players, error: playersErr }] = await Promise.all([
    sb.from('loto_lobbies').select('*').eq('id', lobbyId).maybeSingle(),
    sb.from('loto_players').select('*').eq('lobby_id', lobbyId)
  ]);
  failSupabase(lobbyErr);
  failSupabase(playersErr);
  return {
    lobby,
    players: (players || []).map(p => ({
      id:       p.id,
      nickname: p.nickname,
      isAdmin:  p.is_admin,
      status:   p.status,
      progress: (p.marked_cells || []).length
    }))
  };
}

// ── Главный обработчик API ────────────────────────────────────────────────────

async function _handleLotoAPI(url, options) {
  const sb    = await waitForSB();
  if (!sb) throw new Error('SUPABASE_UNAVAILABLE');
  const isGet = !options?.method || options.method === 'GET';
  let body    = {};
  let action;

  if (isGet) {
    const qs = new URLSearchParams((String(url).split('?')[1]) || '');
    action   = qs.get('action');
    body     = { lobbyId: qs.get('lobbyId'), userId: window.userId };
  } else {
    try { body = JSON.parse(options.body || '{}'); } catch (e) {}
    action = body.action || body.type;
  }

  // Часто используемые поля — с надёжными fallback-ами
  const lobbyId  = body.lobbyId  || window.currentLobbyId  || null;
  const userId   = String(body.userId  || window.userId   || '');
  const nickname = body.nickname || window.userProfile?.nickname || window.userName || 'Игрок';

  console.log('[Bridge] action:', action, '| lobby:', lobbyId, '| user:', userId);

  switch (action) {

    // ─────────────────────────────────────────────────────────────
    // Авторизация — мгновенно возвращаем auth_success,
    // снимая «вечную загрузку»
    // ─────────────────────────────────────────────────────────────
    case 'auth':
      return jsonResponse({
        type: 'auth_success',
        user: { id: userId, nickname, games_played: 0, games_won: 0 }
      });

    // ─────────────────────────────────────────────────────────────
    // Получение состояния лобби (поллинг, тоже будет перехвачен)
    // ─────────────────────────────────────────────────────────────
    case 'get_state': {
      if (!lobbyId) return jsonResponse({ type: 'no_change' });

      const { lobby, players } = await _getLobbyState(sb, lobbyId);
      if (!lobby) return jsonResponse({ type: 'error', message: 'Лобби не найдено' }, 404);

      const drawn = (lobby.drawn_numbers || []).map(Number);
      subscribeToLobby(lobbyId); // Подписываемся, если ещё нет

      // ── V5: сервер-авторизация прав и восстановление карточки ────
      const isAdminVerified = String(lobby.admin_id) === String(userId);
      let myCard = null;
      let myMarkedCells = [];

      if (userId) {
        const { data: playerRow, error: playerErr } = await sb
          .from('loto_players')
          .select('card, marked_cells')
          .eq('id', userId)
          .eq('lobby_id', lobbyId)
          .maybeSingle();
        failSupabase(playerErr);
        if (playerRow) {
          myCard        = playerRow.card        || null;
          myMarkedCells = playerRow.marked_cells || [];
        }
      }
      // ─────────────────────────────────────────────────────────────

      return jsonResponse({
        type: 'state_update',
        drawn,
        isAdmin:      isAdminVerified,   // всегда верифицируется на сервере
        card:         myCard,            // null пока игра не стартовала
        markedCells:  myMarkedCells,     // реальные числа, не dummy-индексы
        lobby: {
          id:          lobby.id,
          code:        lobby.code,
          name:        lobby.name,
          status:      lobby.status,
          admin_id:    lobby.admin_id,
          max_players: lobby.max_players,
          players
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Список лобби для экрана «Войти в лобби»
    // ─────────────────────────────────────────────────────────────
    case 'list_lobbies': {
      const { data: lobbies, error: lobbiesErr } = await sb.from('loto_lobbies')
        .select('id, code, name, max_players, status')
        .in('status', ['waiting', 'playing'])
        .order('created_at', { ascending: false })
        .limit(20);
      failSupabase(lobbiesErr);

      if (!lobbies || lobbies.length === 0) return jsonResponse([]);

      // Добавляем количество игроков
      const result = await Promise.all(lobbies.map(async l => {
        const { count, error: countErr } = await sb
          .from('loto_players')
          .select('id', { count: 'exact', head: true })
          .eq('lobby_id', l.id);
        failSupabase(countErr);
        return { ...l, players_count: count || 0, has_password: 0 };
      }));

      return jsonResponse(result);
    }

    // ─────────────────────────────────────────────────────────────
    // Создать лобби
    // ─────────────────────────────────────────────────────────────
    case 'create_lobby': {
      const code = genCode();
      const { data: lobby, error } = await sb.from('loto_lobbies').insert({
        code,
        name:         body.name    || 'Моя игра',
        admin_id:     userId,
        max_players:  body.maxPlayers || 10,
        status:       'waiting',
        drawn_numbers: []
      }).select().single();

      failSupabase(error);

      const { error: upsertErr } = await sb.from('loto_players').upsert({
        id:       userId,
        lobby_id: lobby.id,
        nickname,
        is_admin: true,
        status:   'waiting'
      }, { onConflict: 'id,lobby_id' });
      failSupabase(upsertErr);

      subscribeToLobby(lobby.id);

      // Возвращаем lobby_created — handleWsMessage переключит экран
      return jsonResponse({
        type: 'lobby_created',
        lobby: {
          id:          lobby.id,
          code:        lobby.code,
          name:        lobby.name,
          status:      lobby.status,
          admin_id:    lobby.admin_id,
          max_players: lobby.max_players,
          players:     [{ id: userId, nickname, isAdmin: true }]
        }
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Войти в лобби по коду
    // ─────────────────────────────────────────────────────────────
    case 'join_lobby': {
      const code = (body.code || '').toUpperCase().trim();
      if (!code) return jsonResponse({ type: 'error', message: 'Введите код лобби' });

      const { data: lobby, error: lobbyErr } = await sb.from('loto_lobbies')
        .select('*').eq('code', code).maybeSingle();
      failSupabase(lobbyErr);

      if (!lobby)                    return jsonResponse({ type: 'error', message: 'Лобби не найдено. Проверь код.' });
      if (lobby.status === 'finished') return jsonResponse({ type: 'error', message: 'Игра уже завершена.' });

      const isAdminHere = String(lobby.admin_id) === String(userId);

      const { error: upsertErr } = await sb.from('loto_players').upsert({
        id:       userId,
        lobby_id: lobby.id,
        nickname,
        is_admin: isAdminHere,
        status:   'waiting'
      }, { onConflict: 'id,lobby_id' });
      failSupabase(upsertErr);

      subscribeToLobby(lobby.id);

      // lobby_joined → handleWsMessage запросит get_state сам
      return jsonResponse({
        type:    'lobby_joined',
        lobbyId: lobby.id,
        isAdmin: isAdminHere
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Покинуть лобби
    // ─────────────────────────────────────────────────────────────
    case 'leave_lobby': {
      if (lobbyId && userId) {
        const { error: leaveErr } = await sb.from('loto_players')
          .delete().eq('id', userId).eq('lobby_id', lobbyId);
        failSupabase(leaveErr);
      }
      return jsonResponse({ type: 'left_lobby' });
    }

    // ─────────────────────────────────────────────────────────────
    // Запустить игру (только для хоста)
    // ─────────────────────────────────────────────────────────────
    case 'start_game': {
      if (!lobbyId) return jsonResponse({ type: 'error', message: 'Нет лобби' });

      // Проверяем права
      const { data: lobbyCheck, error: lobbyCheckErr } = await sb
        .from('loto_lobbies').select('admin_id').eq('id', lobbyId).single();
      failSupabase(lobbyCheckErr);
      if (!lobbyCheck || String(lobbyCheck.admin_id) !== String(userId)) {
        return jsonResponse({ type: 'error', message: 'Только хост может запустить игру' });
      }

      const { data: players, error: playersErr } = await sb
        .from('loto_players').select('id').eq('lobby_id', lobbyId);
      failSupabase(playersErr);

      const generateCard = window.generateLotoCard || _defaultCard;

      for (const p of (players || [])) {
        const card = generateCard();
        const { error: updatePlayerErr } = await sb.from('loto_players')
          .update({ card, status: 'playing', marked_cells: [] })
          .eq('id', p.id).eq('lobby_id', lobbyId);
        failSupabase(updatePlayerErr);
      }

      const { error: startErr } = await sb.from('loto_lobbies').update({
        status:        'playing',
        drawn_numbers: [],
        event:         { type: 'game_started', ts: Date.now() }
      }).eq('id', lobbyId);
      failSupabase(startErr);

      return jsonResponse({ type: 'state_update', lobby: { status: 'playing' } });
    }

    // ─────────────────────────────────────────────────────────────
    // Вытащить бочонок (из admin.html и внутри index.html)
    // ─────────────────────────────────────────────────────────────
    case 'draw_number': {
      if (!lobbyId) return jsonResponse({ type: 'error', message: 'Нет лобби' });
      const num = Number(body.number);
      if (!num || num < 1 || num > 90) return jsonResponse({ type: 'error', message: 'Введите число 1–90' });

      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies').select('drawn_numbers, admin_id').eq('id', lobbyId).single();
      failSupabase(lobbyErr);
      if (!lobby) return jsonResponse({ type: 'error', message: 'Лобби не найдено' }, 404);

      // Проверка прав администратора
      if (String(lobby.admin_id) !== String(userId)) {
        return jsonResponse({ type: 'error', message: 'Нет прав. userId в URL не совпадает с admin_id лобби.' });
      }

      const arr = [...(lobby.drawn_numbers || [])];
      if (arr.includes(num)) return jsonResponse({ type: 'error', message: 'Это число уже выпало!' });
      arr.push(num);

      const { error: drawErr } = await sb.from('loto_lobbies').update({ drawn_numbers: arr }).eq('id', lobbyId);
      failSupabase(drawErr);

      // Ответ понятен и admin.html (data.drawn) и index.html (handleWsMessage → msg.drawn)
      return jsonResponse({ type: 'state_update', drawn: arr });
    }

    // Отменить последний/конкретный бочонок
    case 'undo_number': {
      if (!lobbyId) return jsonResponse({ all: [] });
      const num = Number(body.number);
      const { data: lobby, error: lobbyErr } = await sb
        .from('loto_lobbies').select('drawn_numbers').eq('id', lobbyId).single();
      failSupabase(lobbyErr);
      const arr = (lobby?.drawn_numbers || []).filter(n => n !== num);
      const { error: undoErr } = await sb.from('loto_lobbies').update({ drawn_numbers: arr }).eq('id', lobbyId);
      failSupabase(undoErr);
      return jsonResponse({ all: arr });
    }

    // Сбросить все бочонки
    case 'reset_numbers': {
      if (lobbyId) {
        const { error: resetErr } = await sb.from('loto_lobbies').update({ drawn_numbers: [] }).eq('id', lobbyId);
        failSupabase(resetErr);
      }
      return jsonResponse({ type: 'success' });
    }

    // ─────────────────────────────────────────────────────────────
    // Чат
    // ─────────────────────────────────────────────────────────────
    case 'chat_message': {
      if (!lobbyId) return jsonResponse({ type: 'success' });
      const { data: msg, error: msgErr } = await sb.from('loto_chat').insert({
        lobby_id: lobbyId,
        user_id:  userId,
        nickname: body.nickname || nickname,
        text:     body.text || ''
      }).select().single();
      failSupabase(msgErr);

      return jsonResponse({
        type: 'chat_message',
        message: msg ? {
          id:        msg.id,
          userId:    msg.user_id,
          nickname:  msg.nickname,
          text:      msg.text,
          timestamp: msg.created_at
        } : null
      });
    }

    // ─────────────────────────────────────────────────────────────
    // Обновление профиля / ника
    // ─────────────────────────────────────────────────────────────
    case 'update_profile': {
      if (lobbyId && userId && body.nickname) {
        const { error: profileErr } = await sb.from('loto_players')
          .update({ nickname: body.nickname })
          .eq('id', userId).eq('lobby_id', lobbyId);
        failSupabase(profileErr);
      }
      return jsonResponse({ type: 'success' });
    }

    // ─────────────────────────────────────────────────────────────
    // Прогресс закрытых клеток (нужен для прогресс-бара в admin.html)
    // V5: храним реальные числа — восстанавливаем при F5
    // ─────────────────────────────────────────────────────────────
    case 'mark_cell': {
      if (lobbyId && userId) {
        // Принимаем cells:[10,45,88] (новый формат) или count:5 (старый fallback)
        let cells;
        if (Array.isArray(body.cells)) {
          cells = body.cells.map(Number);
        } else {
          // Старый формат: dummy-массив нужной длины
          const count = Number(body.count) || 0;
          cells = Array.from({ length: count }, (_, i) => i);
        }
        const { error: markErr } = await sb.from('loto_players')
          .update({ marked_cells: cells })
          .eq('id', userId).eq('lobby_id', lobbyId);
        failSupabase(markErr);
      }
      return jsonResponse({ type: 'success' });
    }

    // ─────────────────────────────────────────────────────────────
    // Неизвестное действие — тихо возвращаем успех
    // ─────────────────────────────────────────────────────────────
    default:
      console.log('[Bridge] Unhandled action:', action);
      return jsonResponse({ type: 'success' });
  }
}

// ── Установка fetch-перехватчика ──────────────────────────────────────────────

(function installBridge() {
  const _origFetch = window.fetch.bind(window);

  window.fetch = function bridgedFetch(url, options) {
    const urlStr = String(url);
    const isServerSupabaseRoute = urlStr.includes('/api/loto-supabase');
    const isLotoRoute = (urlStr.includes('/api/loto') || urlStr.includes('/api/drawn')) && !isServerSupabaseRoute;
    // Перехватываем только игровые API-маршруты.
    if (isLotoRoute) {
      return _origFetch(toServerBridgeUrl(urlStr), options);
    }
    return _origFetch(url, options);
  };

  console.log('[Loto Bridge V7] fetch interceptor installed — /api/loto → server Supabase API');
})();

// ── Обратная совместимость: adminAddBarrel ────────────────────────────────────
// Используется как прямой вызов из старых мест в коде

window.adminAddBarrel = async function(val) {
  const lid = window.currentLobbyId;
  if (!lid) return;
  await fetch('/api/loto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'draw_number',
      lobbyId: lid,
      userId: window.userId,
      number: Number(val)
    })
  });
};
