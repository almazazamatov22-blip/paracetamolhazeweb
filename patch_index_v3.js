const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// Use precise replacements based on actual file content from previous view_file
content = content.replace(
    'isAdmin = (String(msg.lobby.admin_id).trim() === String(userId).trim());',
    'isAdmin = (String(msg.lobby.admin_id).trim() === String(userId).trim()); sessionStorage.setItem("currentLobbyId", currentLobbyId); sessionStorage.setItem("isAdmin", isAdmin);'
);

content = content.replace(
    'currentLobbyId = null; // Сброс перед созданием',
    'currentLobbyId = null; sessionStorage.removeItem("currentLobbyId");  // Сброс перед созданием'
);

// Recovery in initWS
content = content.replace(
    'wsReady = true; // Разрешаем действия в режиме поллинга',
    'wsReady = true; const savedId = sessionStorage.getItem("currentLobbyId"); if(savedId) { currentLobbyId = savedId; isAdmin = (sessionStorage.getItem("isAdmin") === "true"); }'
);

fs.writeFileSync(path, content);
console.log('Index.html persistence patch v3 applied');
