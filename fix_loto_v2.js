const fs = require('fs');

// --- ПАТЧ ДЛЯ ADMIN.HTML ---
const adminPath = 'public/lotomal/admin.html';
let adminContent = fs.readFileSync(adminPath, 'utf8');

const oldAddFunc = /async function addNumberToDrawn\(num\) \{[\s\S]+?\}/;
const newAddFunc = `let isAdding = false;
        async function addNumberToDrawn(num) {
            if (isAdding) return;
            if (!lobbyId || !userId) {
                alert('Ошибка: Отсутствует ID лобби или пользователя в URL.');
                return;
            }
            try {
                isAdding = true;
                const res = await fetch('/api/loto', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'draw_number', lobbyId, userId, number: num })
                });
                const data = await res.json();
                if (data.drawn) {
                    drawnOrder = data.drawn;
                    drawnNumbers = new Set(drawnOrder);
                    updateDisplay();
                }
            } catch(e) {
                console.error('API Error:', e);
            } finally {
                isAdding = false;
            }
        }`;

adminContent = adminContent.replace(oldAddFunc, newAddFunc);
fs.writeFileSync(adminPath, adminContent);
console.log('admin.html patched');
