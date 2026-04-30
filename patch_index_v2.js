const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// Force updateGameDisplay to be called more often and be more robust
content = content.replace(
    'updateLobbyDisplay();',
    'updateLobbyDisplay(); updateGameDisplay();'
);

// Add visual debug for container
content = content.replace(
    'id="creatorButtonsGameContainer" style="display:none; padding:10px; gap:10px; max-width:800px; margin:10px auto;"',
    'id="creatorButtonsGameContainer" style="display:none; padding:10px; gap:10px; max-width:800px; margin:10px auto; border:1px dashed rgba(255,215,0,0.3); border-radius:10px;"'
);

// Fix the comparison logic to be even more loose (trimming whitespace etc)
content = content.replace(
    'isAdmin = (String(msg.lobby.admin_id) === String(userId));',
    'isAdmin = (String(msg.lobby.admin_id).trim() === String(userId).trim());'
);

fs.writeFileSync(path, content);
console.log('Index.html aggressive patch applied');
