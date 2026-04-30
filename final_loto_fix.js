const fs = require('fs');

// --- ПАТЧ ДЛЯ INDEX.HTML ---
const indexPath = 'public/lotomal/index.html';
let indexContent = fs.readFileSync(indexPath, 'utf8');

// 1. Добавляем SDK в head
if (!indexContent.includes('supabase-js')) {
    indexContent = indexContent.replace('<title>Лото</title>', `<title>Лото</title>\n  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>`);
}

// 2. Добавляем конфиг Supabase
const supabaseConfig = `
    const SUPABASE_URL = 'https://dlybapjwphbcynfkdxyk.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRseWJhcGp3cGhiY3luZmtkeHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTEzMzQsImV4cCI6MjA5MjAyNzMzNH0.XVjs3XJVUR51NXjxgFKnCrW1f-Irv3AQRItonjeDDPk';
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);`;

if (!indexContent.includes('SUPABASE_URL')) {
    indexContent = indexContent.replace('const ADMIN_IDS', supabaseConfig + '\n    const ADMIN_IDS');
}

// 3. Добавляем слушатель Realtime
const realtimeLogic = `
    let realtimeChannel = null;
    function initRealtime(lobbyId) {
        if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = supabaseClient.channel('loto-' + lobbyId)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'loto_lobbies', filter: 'id=eq.' + lobbyId }, (payload) => {
                console.log('Realtime Signal:', payload.new.drawn_numbers);
                // При сигнале делаем ОДИН запрос к Redis за полным состоянием
                loadState();
            }).subscribe();
    }
    
    async function loadState() {
        if (!currentLobbyId) return;
        const res = await fetch(\`/api/loto?action=get_state&lobbyId=\${currentLobbyId}\`);
        if (res.ok) {
            const data = await res.json();
            handleWsMessage(data);
        }
    }`;

indexContent = indexContent.replace('function initWS() {', realtimeLogic + '\n\n    function initWS() {');
indexContent = indexContent.replace('initGameStream(currentLobbyId);', 'initRealtime(currentLobbyId); loadState();');
indexContent = indexContent.replace('initRealtime(currentLobbyId); loadState();', 'initRealtime(currentLobbyId); loadState();'); // Убираем дубли если есть

// 4. Убираем старый поллинг и EventSource
indexContent = indexContent.replace(/setInterval\(\(\) => \{[\s\S]+?\}, 500\);/g, '// Polling disabled');
indexContent = indexContent.replace(/new EventSource[\s\S]+?;/g, '// SSE disabled');

fs.writeFileSync(indexPath, indexContent);
console.log('index.html patched');

// --- ПАТЧ ДЛЯ ADMIN.HTML ---
const adminPath = 'public/lotomal/admin.html';
let adminContent = fs.readFileSync(adminPath, 'utf8');

// 1. Убираем все старые лаги и лишние интервалы
adminContent = adminContent.replace(/setInterval\(\(\) => \{[\s\S]+?\}, 500\);/g, '// Admin polling disabled');
adminContent = adminContent.replace('if (lobbyId) initGameStream(lobbyId);', 'loadFromServer();');

fs.writeFileSync(adminPath, adminContent);
console.log('admin.html patched');
