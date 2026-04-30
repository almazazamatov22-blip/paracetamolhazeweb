const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Clear Game Session Function
const clearFn = `function clearGameSession() {
      currentLobbyId = null;
      isAdmin = false;
      gameScreenShown = false;
      cardNumbers = [];
      markedCells.clear();
      drawnNumbers.clear();
      drawnOrder = [];
      sessionStorage.removeItem('currentLobbyId');
      sessionStorage.removeItem('isAdmin');
      sessionStorage.removeItem('cardNumbers');
      sessionStorage.removeItem('markedCells');
      console.log('Session cleared');
    }`;

if (!content.includes('function clearGameSession')) {
    content = content.replace('function leaveGame() {', clearFn + '\n\n    function leaveGame() {');
}

// 2. Overwrite leaveGame and leaveLobby
const leaveGameNew = `function leaveGame() {
      if (confirm('Выйти из игры?')) {
        if (currentLobbyId) sendWS({ type: 'leave_lobby' });
        clearGameSession();
        showScreen('mainMenu');
      }
    }`;
content = content.replace(/function leaveGame\(\) \{[\s\S]+?showScreen\('mainMenu'\);[\s\S]+?\}/, leaveGameNew);

const leaveLobbyNew = `function leaveLobby() {
      if (currentLobbyId) sendWS({ type: 'leave_lobby' });
      clearGameSession();
      showScreen('mainMenu');
    }`;
// If leaveLobby is missing or needs update
if (content.includes('function leaveLobby')) {
    content = content.replace(/function leaveLobby\(\) \{[\s\S]+?showScreen\('mainMenu'\);[\s\S]+?\}/, leaveLobbyNew);
} else {
    content = content.replace('function leaveGame() {', leaveLobbyNew + '\n\n    function leaveGame() {');
}

// 3. Fix Empty Card & Auto-redirect
content = content.replace(
    "if (msg.lobby.status === 'playing' && !gameScreenShown) {",
    "if (msg.lobby.status === 'playing' && !gameScreenShown && currentScreen !== 'mainMenu') {"
);

content = content.replace(
    'updateGameDisplay(); renderCard();',
    'if (!cardNumbers || cardNumbers.length === 0) { cardNumbers = generateLotoCard(); sessionStorage.setItem("cardNumbers", JSON.stringify(cardNumbers)); } updateGameDisplay(); renderCard();'
);

fs.writeFileSync(path, content);
console.log('Index.html v9 patch applied (robust fix)');
