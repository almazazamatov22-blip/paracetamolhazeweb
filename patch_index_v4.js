const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// 1. Mark cells persistence
content = content.replace(
    'let markedCells = new Set();',
    'let markedCells = new Set(); try { const saved = sessionStorage.getItem("markedCells"); if(saved) markedCells = new Set(JSON.parse(saved)); } catch(e) {}'
);

content = content.replace(
    'function markCell(row, col) {',
    'function markCell(row, col) { const r = () => { sessionStorage.setItem("markedCells", JSON.stringify([...markedCells])); };'
);
// I'll manually inject the r() call in markCell later or use a better regex
// Better: hijack the Set.add/delete or just add the line at the end of markCell

// 2. Card numbers persistence
content = content.replace(
    'let cardNumbers = [];',
    'let cardNumbers = []; try { const saved = sessionStorage.getItem("cardNumbers"); if(saved) cardNumbers = JSON.parse(saved); } catch(e) {}'
);

// 3. Chat duplicate check
content = content.replace(
    'const chatMessages = new Set();', // If it exists, otherwise add it
    'const chatMessages = new Set();'
);
// If it doesn't exist, prepend it to the globally defined vars
if (!content.includes('const chatMessages = new Set()')) {
    content = content.replace('let wsReady = false;', 'let wsReady = false; const chatMessages = new Set();');
}

content = content.replace(
    'function appendChatMessage(msg) {',
    'function appendChatMessage(msg) { if (!msg.id || chatMessages.has(msg.id)) return; chatMessages.add(msg.id);'
);

// 4. Save card when received
content = content.replace(
    'cardNumbers = msg.card;',
    'cardNumbers = msg.card; sessionStorage.setItem("cardNumbers", JSON.stringify(cardNumbers));'
);

// 5. Update markCell to save
// Find the end of markCell function
const markCellEnd = 'markedCells.delete(num); } renderCard(); updateGameStats(); checkWinLocal();';
content = content.replace(markCellEnd, markCellEnd + ' sessionStorage.setItem("markedCells", JSON.stringify([...markedCells]));');

fs.writeFileSync(path, content);
console.log('Index.html chat and card persistence patch applied');
