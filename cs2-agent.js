/**
 * CS2 Interactive Local Agent
 * ───────────────────────────────────────────────────────────────
 * Запуск: node cs2-agent.js --streamerId=YOUR_STREAMER_ID
 *
 * Зависимости: нет (использует встроенный в Node.js fetch и C# компилятор системы)
 */

'use strict';

const fs = require('fs');
const { execSync, execFile } = require('child_process');

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

// ── Автокомпиляция C# Helper для DirectInput ──
const csharpCode = `
using System;
using System.Runtime.InteropServices;
using System.Threading;

class Program {
    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    struct INPUT {
        public uint type;
        public InputUnion u;
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SystemParametersInfo(uint uiAction, uint uiParam, out IntPtr pvParam, uint fWinIni);

    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SystemParametersInfo(uint uiAction, uint uiParam, IntPtr pvParam, uint fWinIni);

    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYDOWN = 0x0000;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_SCANCODE = 0x0008;
    const uint MOUSEEVENTF_MOVE = 0x0001;
    const uint SPI_GETMOUSESPEED = 0x0070;
    const uint SPI_SETMOUSESPEED = 0x0071;

    // Scan codes mapping
    const ushort SCAN_W = 0x11;
    const ushort SCAN_A = 0x1E;
    const ushort SCAN_S = 0x1F;
    const ushort SCAN_D = 0x20;
    const ushort SCAN_G = 0x22;
    const ushort SCAN_SPACE = 0x39;
    const ushort SCAN_LCTRL = 0x1D;
    const ushort SCAN_1 = 0x02;
    const ushort SCAN_2 = 0x03;
    const ushort SCAN_3 = 0x04;
    const ushort SCAN_4 = 0x05;
    const ushort SCAN_5 = 0x06;

    static void SendKey(ushort scanCode, bool down) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].u.ki.wVk = 0;
        inputs[0].u.ki.wScan = scanCode;
        inputs[0].u.ki.dwFlags = KEYEVENTF_SCANCODE | (down ? KEYEVENTF_KEYDOWN : KEYEVENTF_KEYUP);
        inputs[0].u.ki.time = 0;
        inputs[0].u.ki.dwExtraInfo = IntPtr.Zero;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void SendKeys(ushort[] scanCodes, bool down) {
        INPUT[] inputs = new INPUT[scanCodes.Length];
        for (int i = 0; i < scanCodes.Length; i++) {
            inputs[i].type = INPUT_KEYBOARD;
            inputs[i].u.ki.wVk = 0;
            inputs[i].u.ki.wScan = scanCodes[i];
            inputs[i].u.ki.dwFlags = KEYEVENTF_SCANCODE | (down ? KEYEVENTF_KEYDOWN : KEYEVENTF_KEYUP);
            inputs[i].u.ki.time = 0;
            inputs[i].u.ki.dwExtraInfo = IntPtr.Zero;
        }
        SendInput((uint)scanCodes.Length, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void SendMouseMove(int dx, int dy) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].u.mi.dx = dx;
        inputs[0].u.mi.dy = dy;
        inputs[0].u.mi.mouseData = 0;
        inputs[0].u.mi.dwFlags = MOUSEEVENTF_MOVE;
        inputs[0].u.mi.time = 0;
        inputs[0].u.mi.dwExtraInfo = IntPtr.Zero;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static ushort GetScanCode(string key) {
        switch (key.ToLower()) {
            case "w": return SCAN_W;
            case "a": return SCAN_A;
            case "s": return SCAN_S;
            case "d": return SCAN_D;
            case "g": return SCAN_G;
            case "space": return SCAN_SPACE;
            case "lctrl": return SCAN_LCTRL;
            case "1": return SCAN_1;
            case "2": return SCAN_2;
            case "3": return SCAN_3;
            case "4": return SCAN_4;
            case "5": return SCAN_5;
            default: return 0;
        }
    }

    static void Main(string[] args) {
        if (args.Length < 1) return;
        string command = args[0].ToLower();

        if (command == "key" && args.Length >= 3) {
            ushort scan = GetScanCode(args[1]);
            if (scan == 0) return;
            string action = args[2].ToLower();
            if (action == "click") {
                SendKey(scan, true);
                Thread.Sleep(80);
                SendKey(scan, false);
            } else if (action == "down") {
                SendKey(scan, true);
            } else if (action == "up") {
                SendKey(scan, false);
            }
        }
        else if (command == "freeze" && args.Length >= 2) {
            int sec = int.Parse(args[1]);
            ushort[] keys = { SCAN_W, SCAN_S, SCAN_A, SCAN_D };
            SendKeys(keys, true);
            Thread.Sleep(sec * 1000);
            SendKeys(keys, false);
        }
        else if (command == "spin") {
            for (int i = 0; i < 15; i++) {
                SendMouseMove(250, 0);
                Thread.Sleep(10);
            }
        }
        else if (command == "shake" && args.Length >= 2) {
            int sec = int.Parse(args[1]);
            Random rand = new Random();
            DateTime end = DateTime.Now.AddSeconds(sec);
            while (DateTime.Now < end) {
                int dx = rand.Next(-50, 50);
                int dy = rand.Next(-50, 50);
                SendMouseMove(dx, dy);
                Thread.Sleep(20);
            }
        }
        else if (command == "random_switch") {
            Random rand = new Random();
            ushort[] slots = { SCAN_1, SCAN_2, SCAN_3, SCAN_4, SCAN_5 };
            int count = rand.Next(4, 8);
            for (int i = 0; i < count; i++) {
                ushort key = slots[rand.Next(slots.Length)];
                SendKey(key, true);
                Thread.Sleep(50);
                SendKey(key, false);
                Thread.Sleep(150 + rand.Next(100));
            }
        }
        else if (command == "sens_low" && args.Length >= 2) {
            int sec = int.Parse(args[1]);
            IntPtr originalSpeed;
            SystemParametersInfo(SPI_GETMOUSESPEED, 0, out originalSpeed, 0);
            SystemParametersInfo(SPI_SETMOUSESPEED, 0, (IntPtr)2, 0);
            Thread.Sleep(sec * 1000);
            SystemParametersInfo(SPI_SETMOUSESPEED, 0, originalSpeed, 0);
        }
        else if (command == "sens_high" && args.Length >= 2) {
            int sec = int.Parse(args[1]);
            IntPtr originalSpeed;
            SystemParametersInfo(SPI_GETMOUSESPEED, 0, out originalSpeed, 0);
            SystemParametersInfo(SPI_SETMOUSESPEED, 0, (IntPtr)18, 0);
            Thread.Sleep(sec * 1000);
            SystemParametersInfo(SPI_SETMOUSESPEED, 0, originalSpeed, 0);
        }
    }
}
`;

function compileHelper() {
  const csPath = 'cs2_input_helper.cs';
  const exePath = 'cs2_input_helper.exe';

  if (!fs.existsSync(exePath)) {
    log('⚙️ Компиляция Input Helper C# для DirectInput...');
    try {
      fs.writeFileSync(csPath, csharpCode, 'utf8');
      const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
      if (!fs.existsSync(cscPath)) {
        throw new Error('csc.exe не найден в системе. Убедитесь, что установлен .NET Framework.');
      }
      execSync(`"${cscPath}" /nologo /out:"${exePath}" /optimize "${csPath}"`);
      log('✅ Input Helper скомпилирован успешно!');
    } catch (err) {
      console.error('⚠️ Ошибка автокомпиляции C# Helper:', err.message);
    } finally {
      if (fs.existsSync(csPath)) {
        try { fs.unlinkSync(csPath); } catch {}
      }
    }
  }
}

if (process.platform === 'win32') {
  compileHelper();
} else {
  console.warn('⚠️ Запуск не на Windows. Эмуляция DirectInput C# отключена.');
}

// ── HTTP helpers ──
async function apiGet(path) {
  const url = `${BASE_URL}${path}&agentSecret=${encodeURIComponent(AGENT_SECRET)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'cs2-agent/1.0' } });
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'cs2-agent/1.0' },
    body: JSON.stringify({ ...body, agentSecret: AGENT_SECRET }),
  });
  return res.json();
}

// ── Блокировщик ──
const activeBlocks = new Set();
function isBlocked(type) { return activeBlocks.has(type); }
function setBlock(type, durationMs) {
  activeBlocks.add(type);
  setTimeout(() => activeBlocks.delete(type), durationMs);
}

// ── Вызов C# хелпера ──
function runHelper(args) {
  return new Promise((resolve) => {
    execFile('cs2_input_helper.exe', args, (err) => {
      if (err) {
        console.error('❌ Ошибка выполнения helper:', err.message);
      }
      resolve();
    });
  });
}

// ── Действия ──
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

async function actionBlockJump(ms = 30000) {
  if (isBlocked('jump')) return;
  setBlock('jump', ms);
  log(`🚫 Прыжок заблокирован на ${ms/1000}с`);
  const end = Date.now() + ms;
  while (Date.now() < end && isBlocked('jump')) {
    await runHelper(['key', 'space', 'click']);
    await sleep(100);
  }
  log('✅ Блок прыжка снят');
}

async function actionBlockCrouch(ms = 30000) {
  if (isBlocked('crouch')) return;
  setBlock('crouch', ms);
  log(`🦆 Приседание заблокировано на ${ms/1000}с`);
  const end = Date.now() + ms;
  while (Date.now() < end && isBlocked('crouch')) {
    await runHelper(['key', 'lctrl', 'click']);
    await sleep(100);
  }
  log('✅ Блок приседания снят');
}

// ── Выполнение задачи ──
async function executeTask(task) {
  log(`\n▶ Задача [${task.id.substring(0,8)}] action="${task.action_type}" от "${task.user_name}"`);

  try {
    switch (task.action_type) {
      case 'drop_weapon':
        await runHelper(['key', 'g', 'click']);
        log('🔫 Выполнено: Выбросить оружие (G)');
        break;
      case 'freeze_3':
        log('🧊 Выполнение: Заморозка 3с...');
        await runHelper(['freeze', '3']);
        log('✅ Заморозка 3с завершена');
        break;
      case 'freeze_5':
        log('❄️ Выполнение: Заморозка 5с...');
        await runHelper(['freeze', '5']);
        log('✅ Заморозка 5с завершена');
        break;
      case 'spin_180':
        log('🔄 Выполнение: Разворот 180°...');
        await runHelper(['spin']);
        log('✅ Разворот выполнен');
        break;
      case 'block_jump':
        actionBlockJump(30000); // fire-and-forget
        break;
      case 'block_crouch':
        actionBlockCrouch(30000); // fire-and-forget
        break;
      case 'play_sound':
        await actionPlaySound();
        break;
      case 'mouse_shake':
        log('🖱️ Выполнение: Тряска мыши 5с...');
        await runHelper(['shake', '5']);
        log('✅ Тряска мыши завершена');
        break;
      case 'flash_screen':
        log('💥 Вспышка экрана (через оверлей)');
        break;
      case 'random_weapon_switch':
        log('🎲 Выполнение: Рандомное переключение оружия...');
        await runHelper(['random_switch']);
        log('✅ Рандомное переключение завершено');
        break;
      case 'invert_mouse':
        log('🔃 Выполнение: Инверсия мыши (тряска 10с)...');
        await runHelper(['shake', '10']);
        log('✅ Инверсия мыши завершена');
        break;
      case 'low_sens_10':
        log('🐢 Выполнение: Низкая чувствительность 10с...');
        await runHelper(['sens_low', '10']);
        log('✅ Низкая чувствительность завершена');
        break;
      case 'high_sens_10':
        log('🐇 Выполнение: Высокая чувствительность 10с...');
        await runHelper(['sens_high', '10']);
        log('✅ Высокая чувствительность завершена');
        break;
      default:
        log(`⚠️ Неизвестное действие: ${task.action_type}`);
    }

    await apiPost('/api/cs2/agent/confirm', { taskId: task.id, status: 'done' });
    log(`✅ Задача ${task.id.substring(0,8)} подтверждена сервером`);
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
  if (running) return;
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

process.on('SIGINT', () => {
  log('\n👋 Агент остановлен');
  process.exit(0);
});
