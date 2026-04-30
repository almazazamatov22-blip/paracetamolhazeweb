const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix auto-redirect back to game after exit
content = content.replace(
    "if (msg.lobby.status === 'playing' && !gameScreenShown) {",
    "if (msg.lobby.status === 'playing' && !gameScreenShown && currentScreen !== 'mainMenu') {"
);

// 2. Clear setInterval on exit? No, but make sure currentLobbyId is null
// I already have clearGameSession() which sets currentLobbyId = null.
// In checkWS (polling), it checks if (currentLobbyId). So it should stop.

// 3. Fix Empty Card issue
// Check if generateLotoCard is returning [null, null, null] instead of a filled 3x9 array
// Pre-fill card when entering playing state if it somehow didn't generate
content = content.replace(
    'updateGameDisplay(); renderCard();',
    'if (!cardNumbers || cardNumbers.length === 0) { cardNumbers = generateLotoCard(); sessionStorage.setItem("cardNumbers", JSON.stringify(cardNumbers)); } updateGameDisplay(); renderCard();'
);

// 4. Robust leaveGame (sometimes regex replacement failed if text changed)
// I will use a more direct replacement for the back button and leave functions
content = content.replace(
    "function leaveGame() {",
    "function leaveGame() { console.log('Leaving game...'); if(confirm('Выйти из игры?')) { if(currentLobbyId) sendWS({type:'leave_lobby'}); clearGameSession(); showScreen('mainMenu'); } }"
);

fs.writeFileSync(path, content);
console.log('Index.html v8 patch applied (fix exit loop and empty card)');
