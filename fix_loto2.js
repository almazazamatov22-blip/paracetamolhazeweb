const fs = require('fs');
const filePath = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let html = fs.readFileSync(filePath, 'utf8');

// Helper: replace with CRLF-aware matching  
function rep(from, to, desc) {
  // Normalize line endings in search pattern to match both \r\n and \n
  const normalized = from.replace(/\r\n/g, '\n');
  if (html.includes(from)) {
    html = html.replace(from, to);
    console.log(`[OK] ${desc}`);
    return true;
  } else if (html.includes(normalized)) {
    html = html.replace(normalized, to);
    console.log(`[OK] ${desc} (LF)`);
    return true;
  }
  console.warn(`[WARN] Not found: ${desc}`);
  return false;
}

// ------------------------------------------------------------------
// 1. Восстановить playSound (был повреждён)
// ------------------------------------------------------------------
rep(
`          osc.start(); osc.stop(ctx.currentTime + 0.35);\r\n\r\n\r\n\r\n    function setConnStatus`,
`          osc.start(); osc.stop(ctx.currentTime + 0.35);\r\n\r\n          // Второй осциллятор — "звон"\r\n          const osc2 = ctx.createOscillator();\r\n          const gain2 = ctx.createGain();\r\n          osc2.connect(gain2); gain2.connect(ctx.destination);\r\n          osc2.type = 'sine';\r\n          osc2.frequency.setValueAtTime(600, ctx.currentTime);\r\n          osc2.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);\r\n          gain2.gain.setValueAtTime(0.2, ctx.currentTime);\r\n          gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);\r\n          osc2.start(); osc2.stop(ctx.currentTime + 0.2);\r\n\r\n        } else if (name === 'win') {\r\n          // Победная фанфара\r\n          const notes = [523, 659, 784, 1047];\r\n          notes.forEach((freq, i) => {\r\n            const osc = ctx.createOscillator();\r\n            const gain = ctx.createGain();\r\n            osc.connect(gain); gain.connect(ctx.destination);\r\n            osc.type = 'sine';\r\n            const t = ctx.currentTime + i * 0.12;\r\n            osc.frequency.setValueAtTime(freq, t);\r\n            gain.gain.setValueAtTime(0.0, t);\r\n            gain.gain.linearRampToValueAtTime(0.4, t + 0.05);\r\n            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);\r\n            osc.start(t); osc.stop(t + 0.3);\r\n          });\r\n        }\r\n      } catch(_) {}\r\n    }\r\n\r\n\r\n    function setConnStatus`,
'Restore playSound barrel/win'
);

// ------------------------------------------------------------------
// 2. Заменить initWS
// ------------------------------------------------------------------
rep(
`    function initWS() {\r\n      wsReady = true; const savedId = sessionStorage.getItem("currentLobbyId"); if(savedId) { currentLobbyId = savedId; isAdmin = (sessionStorage.getItem("isAdmin") === "true"); }\r\n      // Авторизация при старте\r\n      sendAPI({ action: 'auth', userId, nickname: userProfile.nickname })\r\n        .then(msg => handleWsMessage(msg));\r\n      \r\n      // Запуск поллинга\r\n      if (!pollInterval) {\r\n        pollInterval = setInterval(async () => {\r\n          if (currentLobbyId) {\r\n            try {\r\n              const res = await fetch(\`/api/loto?action=get_state&lobbyId=\${currentLobbyId}\`);\r\n              if (res.ok) {\r\n                const msg = await res.json();\r\n                handleWsMessage(msg);\r\n              }\r\n            } catch(e) {}\r\n          }\r\n        }, 1000); // Быстрее (1 сек)\r\n      }\r\n      \r\n      setConnStatus('connected', 'Онлайн (Vercel Mode)');\r\n    }`,
`    function initWS() {
      wsReady = true;

      // Восстановление сессии
      const _sid   = sessionStorage.getItem('currentLobbyId');
      const _adm   = sessionStorage.getItem('isAdmin') === 'true';
      const _card  = sessionStorage.getItem('cardNumbers');
      const _marks = sessionStorage.getItem('markedCells');
      const _game  = sessionStorage.getItem('gameScreenShown') === 'true';

      if (_sid) {
        currentLobbyId = _sid;
        isAdmin        = _adm;
        try { if (_card)   cardNumbers = JSON.parse(_card);            } catch(e){}
        try { if (_marks)  markedCells = new Set(JSON.parse(_marks));  } catch(e){}
        if (_game) {
          gameScreenShown = true;
          document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
          const gs = document.getElementById('gameScreen');
          if (gs) { gs.classList.add('active'); currentScreen = 'gameScreen'; }
          if (!cardNumbers || !cardNumbers.length) cardNumbers = generateLotoCard();
          renderCard(); updateGameStats(); updateGameDisplay();
        }
      }

      // Авторизация
      setConnStatus('connecting', 'Подключение...');
      sendAPI({ action: 'auth', userId, nickname: userProfile.nickname })
        .then(msg => {
          handleWsMessage(msg);
          setConnStatus('connected', 'Онлайн');
          setTimeout(() => { const el = document.getElementById('connStatus'); if(el) el.style.opacity='0'; }, 2000);
        })
        .catch(() => setConnStatus('error', 'Ошибка'));

      // Поллинг
      if (!pollInterval) {
        pollInterval = setInterval(async () => {
          if (!currentLobbyId) return;
          try {
            const res = await fetch(\`/api/loto?action=get_state&lobbyId=\${currentLobbyId}\`);
            if (res.status === 404 || res.status === 410) { clearGameSession(); showScreen('mainMenu'); return; }
            if (res.ok) { const msg = await res.json(); handleWsMessage(msg); }
          } catch(e) {}
        }, 1500);
      }
    }`,
'Replace initWS'
);

// ------------------------------------------------------------------
// 3. Починить state_update — убираем дублирующийся generateLotoCard
// ------------------------------------------------------------------
rep(
`               if (!cardNumbers || cardNumbers.length === 0) { cardNumbers = generateLotoCard(); sessionStorage.setItem("cardNumbers", JSON.stringify(cardNumbers)); } if (!cardNumbers || cardNumbers.length === 0) { cardNumbers = generateLotoCard(); sessionStorage.setItem("cardNumbers", JSON.stringify(cardNumbers)); } updateGameDisplay(); renderCard();`,
`               if (!cardNumbers || !cardNumbers.length) { cardNumbers = generateLotoCard(); sessionStorage.setItem('cardNumbers', JSON.stringify(cardNumbers)); }
               sessionStorage.setItem('gameScreenShown', 'true');
               updateGameDisplay(); renderCard(); updateGameStats();`,
'Fix state_update duplicate generateLotoCard'
);

// ------------------------------------------------------------------
// 4. Сохранять gameScreenShown при game_started
// ------------------------------------------------------------------
rep(
`            gameScreenShown = true;\r\n            sessionStorage.setItem('gameScreenShown', 'true');\r\n            sessionStorage.setItem('cardNumbers', JSON.stringify(cardNumbers));\r\n            sessionStorage.setItem('markedCells', '[]');`,
`            gameScreenShown = true;
            sessionStorage.setItem('gameScreenShown', 'true');
            sessionStorage.setItem('cardNumbers', JSON.stringify(cardNumbers));
            sessionStorage.setItem('markedCells', '[]');`,
'game_started saves sessionStorage (normalize CRLF)'
);

// ------------------------------------------------------------------
// 5. toggleCell — сохранять markedCells после каждого клика
// ------------------------------------------------------------------
// Найдём updateGameStats(); checkWinLocal(); в toggleCell
// Need to check exact whitespace
const toggleCheck = `      updateGameStats();\r\n      checkWinLocal();`;
const toggleReplace = `      updateGameStats();
      checkWinLocal();
      sessionStorage.setItem('markedCells', JSON.stringify([...markedCells]));
      if (currentLobbyId) sendAPI({ action: 'mark_cell', userId, lobbyId: currentLobbyId, count: markedCells.size });`;
rep(toggleCheck, toggleReplace, 'toggleCell save markedCells');

// ------------------------------------------------------------------
// 6. clearGameSession — убедимся что есть корректная версия
// ------------------------------------------------------------------  
if (!html.includes('function clearGameSession')) {
  const insertBefore = 'function leaveLobby()';
  if (html.includes(insertBefore)) {
    html = html.replace(insertBefore, `function clearGameSession() {
      currentLobbyId = null; isAdmin = false; gameScreenShown = false;
      cardNumbers = []; markedCells.clear(); drawnNumbers.clear(); drawnOrder = [];
      alreadyWon = false; alreadyNotified14 = false;
      chatMessagesList.length = 0; chatMessagesIds.clear();
      sessionStorage.removeItem('currentLobbyId'); sessionStorage.removeItem('isAdmin');
      sessionStorage.removeItem('cardNumbers'); sessionStorage.removeItem('markedCells');
      sessionStorage.removeItem('gameScreenShown');
    }

    function leaveLobby()`);
    console.log('[OK] Inserted clearGameSession');
  }
}

// ------------------------------------------------------------------
// 7. Убедимся что chatMessagesList — массив (не Set)
// ------------------------------------------------------------------
rep(
  `let wsReady = false; const chatMessagesList = []; const chatMessagesIds = new Set();`,
  `let wsReady = false; const chatMessagesList = []; const chatMessagesIds = new Set();`,
  'chatMessagesList check (no-op if correct)'
);

fs.writeFileSync(filePath, html);
console.log('\n✅ Final fix applied!');
