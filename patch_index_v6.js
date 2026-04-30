const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Robust clearing function
const clearSessionStr = `
    function clearGameSession() {
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
      console.log('Game session cleared');
    }
`;
// Inject this function before leaveLobby or early in scripts
content = content.replace('function leaveLobby() {', clearSessionStr + '\n    function leaveLobby() {');

// 2. Update leaveLobby and leaveGame to use the clearer
content = content.replace(
    'function leaveLobby() {',
    'function leaveLobby() { if (currentLobbyId) sendWS({ type: "leave_lobby" }); clearGameSession();'
);
// I need to be careful with the rest of the function body.
// Better: replace the whole function

const newLeaveLobby = `function leaveLobby() {
      if (currentLobbyId) sendWS({ type: 'leave_lobby' });
      clearGameSession();
      showScreen('mainMenu');
    }`;
content = content.replace(/function leaveLobby\(\) \{[\s\S]*?showScreen\('mainMenu'\);\n    \}/, newLeaveLobby);

const newLeaveGame = `function leaveGame() {
      if (confirm('Выйти из игры?')) {
        if (currentLobbyId) sendWS({ type: 'leave_lobby' });
        clearGameSession();
        showScreen('mainMenu');
      }
    }`;
content = content.replace(/function leaveGame\(\) \{[\s\S]*?showScreen\('mainMenu'\);\n      \}\n    \}/, newLeaveGame);

fs.writeFileSync(path, content);
console.log('Index.html v6 patch applied (robust exit)');
