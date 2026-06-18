/**
 * CS2 Interactive Local Agent
 * ───────────────────────────────────────────────────────────────
 * Запуск: node cs2-agent.js --streamerId=YOUR_STREAMER_ID
 *
 * Зависимости (установить один раз):
 *   npm install @nut-tree/nut-js node-fetch
 *
 * Опционально — для воспроизведения звука:
 *   npm install play-sound
 *
 * Переменные окружения:
 *   CS2_BASE_URL      — URL сайта (по умолчанию: https://paracetamolhaze.vercel.app)
 *   CS2_STREAMER_ID   — ID стримера (или через --streamerId)
 *   CS2_AGENT_SECRET  — Секрет агента (если задан в .env сайта)
 *   CS2_SOUND_FILE    — Путь к звуковому файлу для action play_sound
 */

'use strict';

// ── Аргументы командной строки ──
const args = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const BASE_URL     = process.env.CS2_BASE_URL     || args.baseUrl     || 'https://paracetamolhaze.vercel.app';
const STREAMER_ID  = process.env.CS2_STREAMER_ID  || args.streamerId;
const AGENT_SECRET = process.env.CS2_AGENT_SECRET || args.agentSecret || '';
const SOUND_FILE   = process.env.CS2_SOUND_FILE   || args.soundFile   || '';
const POLL_MS      = parseInt(process.env.CS2_POLL_MS || args.pollMs || '500');

if (!STREAMER_ID) {
  console.error('❌ Укажи streamerId: node cs2-agent.js --streamerId=YOUR_ID');
  process.exit(1);
}

console.log(`
╔══════════════════════════════════════════╗
║   CS2 Interactive Agent  v1.0            ║
║──────────────────────────────────────────║
║  Base URL:  ${BASE_URL.padEnd(27)}║
║  Streamer:  ${STREAMER_ID.toString().substring(0,27).padEnd(27)}║
║  Poll:      ${String(POLL_MS + 'ms').padEnd(27)}║
╚══════════════════════════════════════════╝
`);

// ── Lazy-load nut.js ──
let keyboard, mouse, Key, Button;
let nutLoaded = false;

async function loadNut() {
  if (nutLoaded) return true;
  try {
    const nut = await import('@nut-tree/nut-js');
    keyboard = nut.keyboard;
    mouse    = nut.mouse;
    Key      = nut.Key;
    Button   = nut.Button;

    // Настройки nut-js
    keyboard.config.autoDelayMs = 50;
    mouse.config.autoDelayMs    = 30;
    mouse.config.mouseSpeed     = 5000; // px/s — очень быстро для CS2

    nutLoaded = true;
    console.log('✅ nut-js загружен');
    return true;
  } catch (e) {
    console.error('❌ @nut-tree/nut-js не установлен. Запусти: npm install @nut-tree/nut-js');
    return false;
  }
}

// ── Lazy-load fetch ──
let fetchFn;
async function getFetch() {
  if (fetchFn) return fetchFn;
  // Node 18+ имеет встроенный fetch
  if (typeof globalThis.fetch === 'function') {
    fetchFn = globalThis.fetch.bind(globalThis);
    return fetchFn;
  }
  try {
    const { default: nodeFetch } = await import('node-fetch');
    fetchFn = nodeFetch;
    return fetchFn;
  } catch {
    throw new Error('Нет fetch. Установи: npm install node-fetch');
  }
}

// ── HTTP helpers ──
async function apiGet(path) {
  const fetch = await getFetch();
  const url = `${BASE_URL}${path}&agentSecret=${encodeURIComponent(AGENT_SECRET)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'cs2-agent/1.0' } });
  return res.json();
}

async function apiPost(path, body) {
  const fetch = await getFetch();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'cs2-agent/1.0' },
    body: JSON.stringify({ ...body, agentSecret: AGENT_SECRET }),
  });
  return res.json();
}

// ── Блокировщик ── (отслеживает активные блоки ввода)
const activeBlocks = new Set();

function isBlocked(type) {
  return activeBlocks.has(type);
}

function setBlock(type, durationMs) {
  activeBlocks.add(type);
  setTimeout(() => activeBlocks.delete(type), durationMs);
}

// ── Действия ──

async function actionDropWeapon() {
  await keyboard.pressKey(Key.G);
  await sleep(80);
  await keyboard.releaseKey(Key.G);
  log('🔫 Бросил оружие (G)');
}

async function actionFreeze(seconds) {
  const keys = [Key.W, Key.A, Key.S, Key.D, Key.Space, Key.LeftControl];
  log(`🧊 Заморозка ${seconds}с — блокирую ввод...`);

  // Перехват ввода через nut-js невозможен напрямую.
  // Вместо этого мы эмулируем удерживание противоположных клавиш,
  // чтобы компенсировать движение.
  // Для реальной заморозки используй console.warn — нужен драйвер уровня ядра.
  // Простая реализация: нажать и держать все кнопки движения одновременно.
  for (const k of keys) { try { await keyboard.pressKey(k); } catch {} }
  await sleep(seconds * 1000);
  for (const k of keys) { try { await keyboard.releaseKey(k); } catch {} }
  log(`✅ Заморозка ${seconds}с завершена`);
}

async function actionSpin180() {
  log('🔄 Разворот 180°...');
  const { x, y } = await mouse.getPosition();
  // CS2 sensitivity-независимое движение: большое смещение мыши по X
  // При стандартной чувствительности 2.0 + DPI 800: ~8000 пикселей = ~180°
  // Значение подбирается под настройки стримера
  const SPIN_PX = 8000;
  await mouse.setPosition({ x: x + SPIN_PX, y });
  await sleep(50);
  await mouse.setPosition({ x, y }); // вернуть обратно (в CS2 мышь виртуальная)
  log('✅ Разворот выполнен');
}

async function actionBlockJump(ms = 30000) {
  if (isBlocked('jump')) { log('⚠️ Прыжок уже заблокирован'); return; }
  setBlock('jump', ms);
  log(`🚫 Прыжок заблокирован на ${ms/1000}с`);
  // Эмулируем нажатие и удержание клавиши прыжка-антагониста
  // (нажать Ctrl + Space = приседание + прыжок = нейтральный эффект)
  // Реальная блокировка требует драйвера ввода (например AutoHotkey на Windows)
  const end = Date.now() + ms;
  while (Date.now() < end && isBlocked('jump')) {
    try {
      await keyboard.pressKey(Key.Space);
      await sleep(20);
      await keyboard.releaseKey(Key.Space);
    } catch {}
    await sleep(100);
  }
  log('✅ Блок прыжка снят');
}

async function actionBlockCrouch(ms = 30000) {
  if (isBlocked('crouch')) { log('⚠️ Приседание уже заблокировано'); return; }
  setBlock('crouch', ms);
  log(`🦆 Приседание заблокировано на ${ms/1000}с`);
  const end = Date.now() + ms;
  while (Date.now() < end && isBlocked('crouch')) {
    try {
      await keyboard.pressKey(Key.LeftControl);
      await sleep(20);
      await keyboard.releaseKey(Key.LeftControl);
    } catch {}
    await sleep(100);
  }
  log('✅ Блок приседания снят');
}

async function actionPlaySound() {
  if (!SOUND_FILE) {
    log('🔊 play_sound: CS2_SOUND_FILE не задан, пропускаю');
    return;
  }
  try {
    const { default: player } = await import('play-sound');
    const pl = player({});
    await new Promise((res, rej) => {
      pl.play(SOUND_FILE, err => err ? rej(err) : res());
    });
    log(`🔊 Звук воспроизведён: ${SOUND_FILE}`);
  } catch (e) {
    log(`⚠️ Ошибка воспроизведения звука: ${e.message}`);
  }
}

// ── Выполнение задачи ──
async function executeTask(task) {
  log(`\n▶ Задача [${task.id.substring(0,8)}] action="${task.action_type}" от "${task.user_name}"`);

  try {
    const nutOk = await loadNut();
    if (!nutOk && !['play_sound'].includes(task.action_type)) {
      throw new Error('nut-js недоступен');
    }

    switch (task.action_type) {
      case 'drop_weapon':   await actionDropWeapon();    break;
      case 'freeze_3':      await actionFreeze(3);        break;
      case 'freeze_5':      await actionFreeze(5);        break;
      case 'spin_180':      await actionSpin180();        break;
      case 'block_jump':    actionBlockJump(30000);       break; // fire-and-forget
      case 'block_crouch':  actionBlockCrouch(30000);     break; // fire-and-forget
      case 'play_sound':    await actionPlaySound();      break;
      default:
        log(`⚠️ Неизвестное действие: ${task.action_type}`);
    }

    await apiPost('/api/cs2/agent/confirm', { taskId: task.id, status: 'done' });
    log(`✅ Задача ${task.id.substring(0,8)} выполнена`);
  } catch (err) {
    console.error(`❌ Ошибка выполнения задачи: ${err.message}`);
    try {
      await apiPost('/api/cs2/agent/confirm', {
        taskId: task.id,
        status: 'error',
        error: err.message,
      });
    } catch {}
  }
}

// ── Polling loop ──
let running = false;

async function poll() {
  if (running) return; // защита от параллельного выполнения
  running = true;
  try {
    const data = await apiGet(`/api/cs2/agent/poll?streamerId=${STREAMER_ID}`);
    if (data.task) {
      await executeTask(data.task);
    }
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED')) {
      console.error('[poll error]', err.message);
    }
  } finally {
    running = false;
  }
}

// ── Utilities ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  { console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`); }

// ── Entry ──
log(`🚀 Агент запущен. Опрос каждые ${POLL_MS}ms...`);
log('Нажми Ctrl+C для остановки\n');

setInterval(poll, POLL_MS);

// Graceful shutdown
process.on('SIGINT', () => {
  log('\n👋 Агент остановлен');
  process.exit(0);
});
