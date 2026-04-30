const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\index.html';
let content = fs.readFileSync(path, 'utf8');

// Update isAdmin detection
content = content.replace(
  'isAdmin = (msg.lobby.admin_id === userId);',
  'isAdmin = (String(msg.lobby.admin_id) === String(userId));'
);

// Update poll callback
const oldPoll = `if (msg.lobby.status === 'playing' && !gameScreenShown) {
               gameScreenShown = true;
               showScreen('gameScreen');
               updateGameDisplay(); // Показываем кнопки админа в игре
            }`;
const newPoll = `if (msg.lobby.status === 'playing') {
                if (!gameScreenShown) {
                  gameScreenShown = true;
                  showScreen('gameScreen');
                }
                updateGameDisplay();
             }`;

content = content.replace(oldPoll, newPoll);

fs.writeFileSync(path, content);
console.log('Index.html patched successfully');
