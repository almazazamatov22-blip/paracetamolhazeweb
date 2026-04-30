const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\public\\lotomal\\admin.html';
let content = fs.readFileSync(path, 'utf8');

// Update renderPlayers to use p.progress
const newRenderPlayers = `function renderPlayers(players) {
            const list = document.getElementById('playersList');
            list.innerHTML = '';
            if (!players || !players.length) {
                list.innerHTML = '<div style="color:rgba(255,215,0,.5);font-size:14px;text-align:center;">Нет игроков</div>';
                return;
            }
            players.forEach(p => {
                const marked = parseInt(p.progress || 0);
                const total = 15;
                const pct = Math.round(marked / total * 100);
                const row = document.createElement('div');
                row.className = 'player-progress-row';
                row.style.cssText = 'background:rgba(255,215,0,0.05); padding:10px; border-radius:10px; margin-bottom:5px;';
                row.innerHTML = \`
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-weight:bold; color:#FFD700;">\${p.nickname || 'Игрок'}</span>
                        <span style="font-size:12px; color:rgba(255,215,0,0.7);">\${marked}/15</span>
                    </div>
                    <div style="width:100%; height:4px; background:rgba(255,215,0,0.1); border-radius:2px;">
                        <div style="width:\${pct}%; height:100%; background:#FFD700; border-radius:2px; box-shadow:0 0 10px #FFD700;"></div>
                    </div>
                \`;
                list.appendChild(row);
            });
        }`;

content = content.replace(/function renderPlayers\(players\) \{[\s\S]*?list\.appendChild\(row\);\s+?\}\);\s+\}/, newRenderPlayers);

fs.writeFileSync(path, content);
console.log('Admin.html progress patch applied');
