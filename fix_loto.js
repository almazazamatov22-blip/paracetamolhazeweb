/**
 * ПОЛНЫЙ ХИРУРГИЧЕСКИЙ ФИК для Loto
 * Заменяет проблемные блоки кода в index.html точечно
 */
const fs = require('fs');
const filePath = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let html = fs.readFileSync(filePath, 'utf8');
let changed = 0;

function replace(from, to, desc) {
  if (!html.includes(from)) {
    console.warn(`[WARN] Not found: ${desc}`);
    return;
  }
  html = html.replace(from, to);
  changed++;
  console.log(`[OK] Replaced: ${desc}`);
}

// ============================================================
// 1. ФИК: "Подключение..." висит
//    Проблема: setConnStatus('connected') вызывается, но
//    статус не виден из-за дублирующейся инициализации
// ============================================================
replace(
  `function initWS() {\n      wsReady = true; const savedId = sessionStorage.getItem("currentLobbyId"); if(savedId) { currentLobbyId = savedId; isAdmin = (sessionStorage.getItem("isAdmin") === "true"); }\n      // Авторизация при старте\n      sendAPI({ action: 'auth', userId, nickname: userProfile.nickname })\n        .then(msg => handleWsMessage(msg));\n      \n      // Запуск поллинга\n      if (!pollInterval) {\n        pollInterval = setInterval(async () => {\n          if (currentLobbyId) {\n            try {\n              const res = await fetch(\`/api/loto?action=get_state&lobbyId=\${currentLobbyId}\`);\n              if (res.ok) {\n                const msg = await res.json();\n                handleWsMessage(msg);\n              }\n            } catch(e) {}\n          }\n        }, 1000); // Быстрее (1 сек)\n      }\n      \n      setConnStatus('connected', 'Онлайн (Vercel Mode)');\n    }`,
  `function initWS() {
      wsReady = true;

      // Восстановление сессии из sessionStorage
      const _savedLobbyId = sessionStorage.getItem('currentLobbyId');
      const _savedIsAdmin = sessionStorage.getItem('isAdmin') === 'true';
      const _savedCard = sessionStorage.getItem('cardNumbers');
      const _savedMarked = sessionStorage.getItem('markedCells');
      const _savedGameScreen = sessionStorage.getItem('gameScreenShown') === 'true';

      if (_savedLobbyId) {
        currentLobbyId = _savedLobbyId;
        isAdmin = _savedIsAdmin;
        if (_savedCard) { try { cardNumbers = JSON.parse(_savedCard); } catch(e) {} }
        if (_savedMarked) { try { markedCells = new Set(JSON.parse(_savedMarked)); } catch(e) {} }
        if (_savedGameScreen) {
          gameScreenShown = true;
          // Покажем экран игры и отрисуем карточку
          document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
          const gs = document.getElementById('gameScreen');
          if (gs) { gs.classList.add('active'); currentScreen = 'gameScreen'; }
          if (cardNumbers && cardNumbers.length > 0) renderCard();
          updateGameDisplay();
        }
      }

      // Авторизация
      setConnStatus('connecting', 'Подключение...');
      sendAPI({ action: 'auth', userId, nickname: userProfile.nickname })
        .then(msg => {
          handleWsMessage(msg);
          setConnStatus('connected', 'Онлайн');
          setTimeout(() => {
            const el = document.getElementById('connStatus');
            if (el) el.style.opacity = '0';
          }, 3000);
        })
        .catch(() => setConnStatus('error', 'Ошибка соединения'));

      // Поллинг раз в секунду
      if (!pollInterval) {
        pollInterval = setInterval(async () => {
          if (!currentLobbyId) return;
          try {
            const res = await fetch(\`/api/loto?action=get_state&lobbyId=\${currentLobbyId}\`);
            if (res.status === 404 || res.status === 410) {
              // Лобби удалено
              clearGameSession();
              showScreen('mainMenu');
              return;
            }
            if (res.ok) {
              const msg = await res.json();
              handleWsMessage(msg);
            }
          } catch(e) {}
        }, 1500);
      }
    }`,
  'initWS function'
);

// ============================================================
// 2. ФИК: clearGameSession — единая точка очистки
// ============================================================
// Убираем все старые версии и вставляем одну чистую версию
// перед leaveGame
const clearFnNew = `    function clearGameSession() {
      currentLobbyId = null;
      isAdmin = false;
      gameScreenShown = false;
      cardNumbers = [];
      markedCells.clear();
      drawnNumbers.clear();
      drawnOrder = [];
      alreadyWon = false;
      alreadyNotified14 = false;
      chatMessagesList.length = 0;
      chatMessagesIds.clear();
      sessionStorage.removeItem('currentLobbyId');
      sessionStorage.removeItem('isAdmin');
      sessionStorage.removeItem('cardNumbers');
      sessionStorage.removeItem('markedCells');
      sessionStorage.removeItem('gameScreenShown');
    }

    `;

// Удаляем существующий clearGameSession если есть
if (html.includes('function clearGameSession()')) {
  html = html.replace(/\s*function clearGameSession\(\) \{[\s\S]*?\}\s*\n/, '\n');
  changed++;
  console.log('[OK] Removed old clearGameSession');
}

// Вставляем перед leaveGame
if (html.includes('function leaveGame()')) {
  html = html.replace('function leaveGame()', clearFnNew + 'function leaveGame()');
  changed++;
  console.log('[OK] Inserted new clearGameSession');
}

// ============================================================
// 3. ФИК: leaveGame — полная замена
// ============================================================
// Найдём текущую функцию leaveGame и заменим
const leaveGameRegex = /function leaveGame\(\) \{[\s\S]*?(?=\n\s*function )/;
if (leaveGameRegex.test(html)) {
  html = html.replace(leaveGameRegex, `function leaveGame() {
      if (!confirm('Выйти из игры?')) return;
      if (currentLobbyId) sendWS({ type: 'leave_lobby' });
      clearGameSession();
      showScreen('mainMenu');
    }

    `);
  changed++;
  console.log('[OK] Replaced leaveGame');
}

// ============================================================
// 4. ФИК: leaveLobby — добавить или заменить
// ============================================================
const leaveLobbyFn = `    function leaveLobby() {
      if (currentLobbyId) sendWS({ type: 'leave_lobby' });
      clearGameSession();
      showScreen('mainMenu');
    }

    `;

const leaveLobbyRegex = /function leaveLobby\(\) \{[\s\S]*?(?=\n\s*function )/;
if (leaveLobbyRegex.test(html)) {
  html = html.replace(leaveLobbyRegex, leaveLobbyFn);
  changed++;
  console.log('[OK] Replaced leaveLobby');
} else {
  // Вставить перед clearGameSession
  html = html.replace('function clearGameSession()', leaveLobbyFn + 'function clearGameSession()');
  changed++;
  console.log('[OK] Inserted leaveLobby');
}

// ============================================================
// 5. ФИК: Сохранение gameScreenShown в sessionStorage
// ============================================================
replace(
  `sessionStorage.setItem("currentLobbyId", currentLobbyId); sessionStorage.setItem("isAdmin", isAdmin);`,
  `sessionStorage.setItem('currentLobbyId', currentLobbyId); sessionStorage.setItem('isAdmin', isAdmin);`,
  'Session storage keys normalize'
);

// Сохраняем gameScreenShown при переходе в игру
replace(
  `gameScreenShown = true;\n               showScreen('gameScreen');`,
  `gameScreenShown = true;\n               sessionStorage.setItem('gameScreenShown', 'true');\n               showScreen('gameScreen');`,
  'Save gameScreenShown on game start'
);

// ============================================================
// 6. ФИК: Восстановление карточки — не перезаписывать при state_update
// ============================================================
// При state_update статус playing — только переключить экран, НЕ генерировать новую карту
replace(
  `if (msg.lobby.status === 'playing' && !gameScreenShown && currentScreen !== 'mainMenu') {`,
  `if (msg.lobby.status === 'playing' && !gameScreenShown && currentScreen !== 'mainMenu' && currentLobbyId) {`,
  'Add currentLobbyId guard for game screen redirect'
);

// ============================================================
// 7. ФИК: Чат — полная перезапись appendChatMessage и renderChatMessages
// ============================================================
// Удаляем текущие функции
const chatFnOld = /\/\/ ====== ЧАТ \(через WebSocket\) ======[\s\S]*?function sendChat\(/;
const chatFnNew = `// ====== ЧАТ ======
    function appendChatMessage(msg) {
      if (!msg || !msg.id) return;
      if (chatMessagesIds.has(msg.id)) return;
      chatMessagesIds.add(msg.id);
      chatMessagesList.push(msg);
      _renderOneMessage(msg);
    }

    function _renderOneMessage(msg) {
      // Рендерим в обе коробки чтобы сообщение было видно везде
      ['chatBoxLobby', 'chatBoxGame'].forEach(boxId => {
        const box = document.getElementById(boxId);
        if (!box) return;
        // Проверяем не добавили ли уже
        if (box.querySelector(\`[data-msgid="\${msg.id}"]\`)) return;
        const atBottom = (box.scrollTop + box.clientHeight + 40) >= box.scrollHeight;
        const el = document.createElement('div');
        el.className = 'chat-msg';
        el.dataset.msgid = msg.id;
        const dt = new Date(msg.timestamp || Date.now());
        const hh = String(dt.getHours()).padStart(2,'0');
        const mm = String(dt.getMinutes()).padStart(2,'0');
        el.innerHTML = \`<div class="chat-meta"><span class="chat-nick" style="cursor:pointer;color:#FFD700;"
          data-uid="\${escapeHtml(String(msg.userId||''))}"
          data-nick="\${escapeHtml(msg.nickname||'Игрок')}"
          data-av="\${escapeHtml(msg.avatar||'👤')}">\${escapeHtml(msg.nickname||'Игрок')}</span>
          <span>\${hh}:\${mm}</span></div>
          <div class="chat-text">\${escapeHtml(msg.text||'')}</div>\`;
        el.querySelector('.chat-nick').addEventListener('click', (e) => {
          const t = e.target;
          showPlayerProfile({ id: t.dataset.uid, nickname: t.dataset.nick, avatar: t.dataset.av });
        });
        box.appendChild(el);
        if (atBottom) box.scrollTop = box.scrollHeight;
      });
    }

    function sendChat(`;

if (chatFnOld.test(html)) {
  html = html.replace(chatFnOld, chatFnNew);
  changed++;
  console.log('[OK] Replaced chat functions');
}

// ============================================================
// 8. ФИК: sendChat с userProfile данными
// ============================================================
replace(
  `sendWS({ type: 'chat_message', text });`,
  `sendAPI({ action: 'chat_message', userId, lobbyId: currentLobbyId, text, nickname: userProfile.nickname, avatar: userProfile.avatar || '👤' })
        .then(resp => { if (resp && resp.message) appendChatMessage(resp.message); });`,
  'sendChat uses sendAPI directly with user data'
);

// ============================================================
// 9. ФИК: toggleCell — сохранять в sessionStorage + отправлять прогресс
// ============================================================
// Заменить updateGameStats(); checkWinLocal(); (последнее в toggleCell)
// Осторожно — эта строка встречается только в toggleCell
replace(
  `      updateGameStats();\n      checkWinLocal();`,
  `      updateGameStats();
      checkWinLocal();
      sessionStorage.setItem('markedCells', JSON.stringify([...markedCells]));
      if (currentLobbyId) sendAPI({ action: 'mark_cell', userId, lobbyId: currentLobbyId, count: markedCells.size });`,
  'toggleCell persistence and progress'
);

// ============================================================
// 10. ФИК: При game_started сохраняем gameScreenShown
// ============================================================
replace(
  `markedCells.clear();\r\n            drawnNumbers.clear();\r\n            drawnOrder = [];\r\n            alreadyWon = false;\r\n            alreadyNotified14 = false;\r\n            gameScreenShown = true;\r\n            renderCard();\r\n            updateGameStats();\r\n            if (currentScreen !== 'gameScreen') showScreen('gameScreen');`,
  `markedCells.clear();
            drawnNumbers.clear();
            drawnOrder = [];
            alreadyWon = false;
            alreadyNotified14 = false;
            gameScreenShown = true;
            sessionStorage.setItem('gameScreenShown', 'true');
            sessionStorage.setItem('cardNumbers', JSON.stringify(cardNumbers));
            sessionStorage.setItem('markedCells', '[]');
            renderCard();
            updateGameStats();
            if (currentScreen !== 'gameScreen') showScreen('gameScreen');`,
  'game_started saves session'
);

// ============================================================
// 11. ФИК: Убираем console.log('Session cleared') если есть
//     и дублирующуюся инициализацию cardNumbers из старых патчей
// ============================================================
html = html.replace(
  `let cardNumbers = []; try { const _saved = sessionStorage.getItem("cardNumbers"); if(_saved) { cardNumbers = JSON.parse(_saved); console.log("Recovered card:", cardNumbers); } } catch(e) {} try { const saved = sessionStorage.getItem("cardNumbers"); if(saved) cardNumbers = JSON.parse(saved); } catch(e) {}`,
  `let cardNumbers = [];`
);
console.log('[OK] Cleaned up duplicate cardNumbers init');

html = html.replace(
  `let markedCells = new Set(); try { const saved = sessionStorage.getItem("markedCells"); if(saved) markedCells = new Set(JSON.parse(saved)); } catch(e) {}`,
  `let markedCells = new Set();`
);
console.log('[OK] Cleaned up duplicate markedCells init');

// ============================================================
// Финал
// ============================================================
fs.writeFileSync(filePath, html);
console.log(`\n✅ Done! ${changed} replacements applied.`);
