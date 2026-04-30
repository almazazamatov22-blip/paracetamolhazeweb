const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. All messages store
content = content.replace(
    'const chatMessages = new Set();',
    'const chatMessagesList = []; const chatMessagesIds = new Set();'
);

// 2. Clear appendChatMessage and make it robust
const newAppend = `    function appendChatMessage(msg) {
      if (!msg.id || chatMessagesIds.has(msg.id)) return;
      chatMessagesIds.add(msg.id);
      chatMessagesList.push(msg);
      renderChatMessages();
    }

    function renderChatMessages() {
      const boxId = (currentScreen === 'gameScreen' || gameScreenShown) ? 'chatBoxGame' : 'chatBoxLobby';
      const box = document.getElementById(boxId);
      if (!box) return;
      
      // Чтобы не перерисовывать все каждый раз, будем просто добавлять недостающие в активное окно
      const existingIds = new Set([...box.querySelectorAll('.chat-msg .chat-nick')].map(el => el.dataset.uid_msg));
      
      chatMessagesList.forEach(msg => {
        if (existingIds.has(msg.id)) return;
        
        const atBottom = (box.scrollTop + box.clientHeight + 40) >= box.scrollHeight;
        const el = document.createElement('div');
        el.className = 'chat-msg';
        const dt = new Date(msg.timestamp || Date.now());
        const hh = String(dt.getHours()).padStart(2,'0');
        const mm = String(dt.getMinutes()).padStart(2,'0');
        el.innerHTML = \`
          <div class="chat-meta">
            <span class="chat-nick" style="cursor:pointer;color:#FFD700;" 
              data-uid_msg="\${msg.id}"
              data-uid="\${escapeHtml(String(msg.userId || ''))}" 
              data-nick="\${escapeHtml(msg.nickname || 'Игрок')}" 
              data-av="\${escapeHtml(msg.avatar || '👤')}">\${escapeHtml(msg.nickname || 'Игрок')}</span>
            <span>\${hh}:\${mm}</span>
          </div>
          <div class="chat-text">\${escapeHtml(msg.text || '')}</div>
        \`;
        el.querySelector('.chat-nick').addEventListener('click', (e) => {
          showPlayerProfile({ id: e.target.dataset.uid, nickname: e.target.dataset.nick, avatar: e.target.dataset.av });
        });
        box.appendChild(el);
        if (atBottom) box.scrollTop = box.scrollHeight;
      });
    }
`;
content = content.replace(/function appendChatMessage\(msg\) \{[\s\S]*?box\.scrollTop = box\.scrollHeight;\s+\}/, newAppend);

// 3. Call renderChatMessages when switching screens
content = content.replace('currentScreen = screenId;', 'currentScreen = screenId; renderChatMessages();');

// 4. Update toggleCell to send progress
content = content.replace(
    'updateGameStats(); checkWinLocal();',
    'updateGameStats(); checkWinLocal(); sendWS({ type: "mark_cell", count: markedCells.size });'
);

// 5. Update admin.html renderPlayers
// (Wait, I'll do admin.html in a separate step or via node script too)

fs.writeFileSync(path, content);
console.log('Index.html v7 patch applied (chat rewrite)');
