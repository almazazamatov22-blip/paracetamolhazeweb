const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix state_update recovery
content = content.replace(
    "updateGameDisplay(); // Показываем кнопки админа в игре",
    "updateGameDisplay(); renderCard();"
);

// 2. Fix toggleCell persistence
// Original: updateGameStats(); checkWinLocal();
// I want to add sessionStorage save there.
content = content.replace(
    'updateGameStats();\n      checkWinLocal();',
    'updateGameStats(); checkWinLocal(); sessionStorage.setItem("markedCells", JSON.stringify([...markedCells]));'
);

// 3. Fix chat duplicate issues and ensure it shows
// I'll add a log to check if it's called
content = content.replace(
    'function appendChatMessage(msg) {',
    'function appendChatMessage(msg) { console.log("New msg:", msg); if (!msg.id || chatMessages.has(msg.id)) return; chatMessages.add(msg.id);'
);

// 4. Ensure cardNumbers is definitely loaded
content = content.replace(
    'let cardNumbers = [];',
    'let cardNumbers = []; try { const _saved = sessionStorage.getItem("cardNumbers"); if(_saved) { cardNumbers = JSON.parse(_saved); console.log("Recovered card:", cardNumbers); } } catch(e) {}'
);

fs.writeFileSync(path, content);
console.log('Index.html v5 patch applied');
