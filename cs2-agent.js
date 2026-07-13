/**
 * CS2 Interactive Local Agent
 */
'use strict';

const fs = require('fs');
const { execSync, spawn } = require('child_process');

const args = process.argv.slice(2).reduce((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  acc[k] = v ?? true;
  return acc;
}, {});

const BASE_URL     = process.env.CS2_BASE_URL     || args.baseUrl     || 'https://paracetamolhaze.vercel.app';
const STREAMER_ID  = process.env.CS2_STREAMER_ID  || args.streamerId;
const AGENT_SECRET = process.env.CS2_AGENT_SECRET || args.agentSecret || '';
const POLL_MS      = parseInt(process.env.CS2_POLL_MS || args.pollMs || '500');

if (!STREAMER_ID) {
  console.error('❌ Укажи streamerId: node cs2-agent.js --streamerId=YOUR_ID');
  process.exit(1);
}

// ── C# Helper Source ──
const csharpCode = `
using System;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using System.Threading;
using System.Diagnostics;

class HookApp : Form
{
    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICE {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTHEADER {
        public uint dwType;
        public uint dwSize;
        public IntPtr hDevice;
        public IntPtr wParam;
    }

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

    [DllImport("user32.dll")]
    static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);
    
    [DllImport("user32.dll")]
    static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);
    
    [DllImport("user32.dll")]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport("user32.dll")]
    static extern bool BlockInput(bool fBlockIt);

    delegate IntPtr LowLevelHookProc(int nCode, IntPtr wParam, IntPtr lParam);
    
    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetWindowsHookEx(int idHook, LowLevelHookProc lpfn, IntPtr hMod, uint dwThreadId);
    
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool UnhookWindowsHookEx(IntPtr hhk);
    
    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern IntPtr GetModuleHandle(string lpModuleName);

    const uint RID_INPUT = 0x10000003;
    const uint RIM_TYPEMOUSE = 0;
    const int WM_INPUT = 0x00FF;
    const int WH_KEYBOARD_LL = 13;
    const int WH_MOUSE_LL = 14;
    const int WM_MOUSEWHEEL = 0x020A;
    
    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;
    const uint KEYEVENTF_KEYDOWN = 0x0000;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_SCANCODE = 0x0008;

    static readonly IntPtr INJECTED_TAG = new IntPtr(0x1337);

    public double MultiplierX = 1.0;
    public double MultiplierY = 1.0;
    
    double remainderX = 0;
    double remainderY = 0;
    
    public bool BlockJumpActive = false;
    public bool BlockCrouchActive = false;

    IntPtr kbHookId = IntPtr.Zero;
    IntPtr msHookId = IntPtr.Zero;
    LowLevelHookProc kbProc;
    LowLevelHookProc msProc;

    public HookApp()
    {
        kbProc = KeyboardHookCallback;
        msProc = MouseHookCallback;
        
        using (Process curProcess = Process.GetCurrentProcess())
        using (ProcessModule curModule = curProcess.MainModule)
        {
            kbHookId = SetWindowsHookEx(WH_KEYBOARD_LL, kbProc, GetModuleHandle(curModule.ModuleName), 0);
            msHookId = SetWindowsHookEx(WH_MOUSE_LL, msProc, GetModuleHandle(curModule.ModuleName), 0);
        }

        RAWINPUTDEVICE rid = new RAWINPUTDEVICE();
        rid.usUsagePage = 0x01;
        rid.usUsage = 0x02;
        rid.dwFlags = 0x00000100; // RIDEV_INPUTSINK
        rid.hwndTarget = this.Handle;
        
        RegisterRawInputDevices(new RAWINPUTDEVICE[] { rid }, 1, (uint)Marshal.SizeOf(typeof(RAWINPUTDEVICE)));

        Thread t = new Thread(ReadCommands);
        t.IsBackground = true;
        t.Start();
    }

    IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int vkCode = Marshal.ReadInt32(lParam);
            if (BlockJumpActive && vkCode == 0x20) // Space
            {
                return (IntPtr)1;
            }
            if (BlockCrouchActive && (vkCode == 0xA2 || vkCode == 0xA3 || vkCode == 0x11)) // LCtrl, RCtrl, Ctrl
            {
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(kbHookId, nCode, wParam, lParam);
    }

    IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            if (BlockJumpActive && wParam == (IntPtr)WM_MOUSEWHEEL)
            {
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(msHookId, nCode, wParam, lParam);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_INPUT)
        {
            uint size = 0;
            GetRawInputData(m.LParam, RID_INPUT, IntPtr.Zero, ref size, (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER)));
            if (size > 0)
            {
                IntPtr pData = Marshal.AllocHGlobal((int)size);
                if (GetRawInputData(m.LParam, RID_INPUT, pData, ref size, (uint)Marshal.SizeOf(typeof(RAWINPUTHEADER))) == size)
                {
                    uint dwType = (uint)Marshal.ReadInt32(pData);
                    if (dwType == RIM_TYPEMOUSE)
                    {
                        int headerSize = Marshal.SizeOf(typeof(RAWINPUTHEADER));
                        int lLastX = Marshal.ReadInt32(pData, headerSize + 12);
                        int lLastY = Marshal.ReadInt32(pData, headerSize + 16);
                        uint ulExtra = (uint)Marshal.ReadInt32(pData, headerSize + 20);
                        
                        if (ulExtra != (uint)INJECTED_TAG.ToInt32() && (lLastX != 0 || lLastY != 0))
                        {
                            double injectX = lLastX * (MultiplierX - 1.0) + remainderX;
                            double injectY = lLastY * (MultiplierY - 1.0) + remainderY;
                            
                            int sendX = (int)Math.Round(injectX);
                            int sendY = (int)Math.Round(injectY);
                            
                            remainderX = injectX - sendX;
                            remainderY = injectY - sendY;
                            
                            if (sendX != 0 || sendY != 0)
                            {
                                SendMouseMove(sendX, sendY, INJECTED_TAG);
                            }
                        }
                    }
                }
                Marshal.FreeHGlobal(pData);
            }
        }
        base.WndProc(ref m);
    }

    static void SendMouseMove(int dx, int dy, IntPtr extraInfo)
    {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].u.mi.dx = dx;
        inputs[0].u.mi.dy = dy;
        inputs[0].u.mi.mouseData = 0;
        inputs[0].u.mi.dwFlags = 0x0001; // MOUSEEVENTF_MOVE
        inputs[0].u.mi.time = 0;
        inputs[0].u.mi.dwExtraInfo = extraInfo;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

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

    void ProcessCommand(string line)
    {
        string[] parts = line.Split(' ');
        if (parts.Length == 0) return;
        string cmd = parts[0].ToLower();

        if (cmd == "key" && parts.Length >= 3) {
            ushort scan = 0;
            switch(parts[1].ToLower()) {
                case "g": scan = 0x22; break;
            }
            if (scan != 0) {
                if (parts[2] == "click") { SendKey(scan, true); Thread.Sleep(80); SendKey(scan, false); }
            }
        }
        else if (cmd == "sens" && parts.Length >= 2) {
            double mult = double.Parse(parts[1], System.Globalization.CultureInfo.InvariantCulture);
            MultiplierX = mult;
            MultiplierY = mult;
        }
        else if (cmd == "invert" && parts.Length >= 2) {
            bool enable = parts[1] == "1";
            MultiplierX = enable ? -1.0 : 1.0;
            MultiplierY = enable ? -1.0 : 1.0;
        }
        else if (cmd == "block_jump" && parts.Length >= 2) {
            BlockJumpActive = parts[1] == "1";
        }
        else if (cmd == "block_crouch" && parts.Length >= 2) {
            BlockCrouchActive = parts[1] == "1";
        }
        else if (cmd == "freeze" && parts.Length >= 2) {
            int sec = int.Parse(parts[1]);
            BlockInput(true);
            Thread.Sleep(sec * 1000);
            BlockInput(false);
        }
        else if (cmd == "spin") {
            for (int i = 0; i < 40; i++) {
                SendMouseMove(500, 0, IntPtr.Zero);
                Thread.Sleep(5);
            }
        }
    }

    void ReadCommands()
    {
        while (true)
        {
            string cmd = Console.ReadLine();
            if (cmd == null) Environment.Exit(0);
            
            this.Invoke((MethodInvoker)delegate {
                try { ProcessCommand(cmd); } catch { }
            });
        }
    }

    protected override void SetVisibleCore(bool value)
    {
        base.SetVisibleCore(false);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        UnhookWindowsHookEx(kbHookId);
        UnhookWindowsHookEx(msHookId);
        base.OnFormClosed(e);
    }

    [STAThread]
    static void Main()
    {
        Application.Run(new HookApp());
    }
}
`;

function compileHelper() {
  const csPath = 'cs2_input_helper.cs';
  const exePath = 'cs2_input_helper.exe';

  if (!fs.existsSync(exePath)) {
    console.log('⚙️ Компиляция Background Helper C#...');
    try {
      fs.writeFileSync(csPath, csharpCode, 'utf8');
      const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
      if (!fs.existsSync(cscPath)) throw new Error('csc.exe не найден.');
      execSync(`"${cscPath}" /nologo /out:"${exePath}" /target:winexe /optimize /r:System.Windows.Forms.dll "${csPath}"`);
      console.log('✅ Background Helper скомпилирован успешно!');
    } catch (err) {
      console.error('⚠️ Ошибка автокомпиляции C# Helper:', err.message);
    } finally {
      if (fs.existsSync(csPath)) {
        try { fs.unlinkSync(csPath); } catch {}
      }
    }
  }
}

if (process.platform === 'win32') compileHelper();

// ── Background Helper Process ──
let helperProc = null;
function startHelper() {
  if (process.platform !== 'win32') return;
  helperProc = spawn('cs2_input_helper.exe', [], { stdio: ['pipe', 'pipe', 'inherit'] });
  
  helperProc.on('exit', () => {
    console.log('⚠️ Helper process exited. Restarting...');
    setTimeout(startHelper, 1000);
  });
}
startHelper();

function sendCmd(cmd) {
  if (helperProc && helperProc.stdin.writable) {
    helperProc.stdin.write(cmd + '\n');
  }
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

// ── Utilities ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  { console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`); }

// ── Действия ──
async function executeTask(task) {
  log(`\n▶ Задача [${task.id.substring(0,8)}] action="${task.action_type}" от "${task.user_name}"`);

  try {
    switch (task.action_type) {
      case 'drop_weapon':
        sendCmd('key g click');
        log('🔫 Выполнено: Выбросить оружие (G)');
        break;
      case 'freeze_3':
        log('🧊 Выполнение: Заморозка 3с...');
        sendCmd('freeze 3');
        await sleep(3000);
        log('✅ Заморозка 3с завершена');
        break;
      case 'freeze_5':
        log('❄️ Выполнение: Заморозка 5с...');
        sendCmd('freeze 5');
        await sleep(5000);
        log('✅ Заморозка 5с завершена');
        break;
      case 'spin_180':
        log('🔄 Выполнение: Разворот 180°...');
        sendCmd('spin');
        log('✅ Разворот выполнен');
        break;
      case 'block_jump':
        log('🚫 Прыжок заблокирован на 30с');
        sendCmd('block_jump 1');
        setTimeout(() => { sendCmd('block_jump 0'); log('✅ Блок прыжка снят'); }, 30000);
        break;
      case 'block_crouch':
        log('🦆 Приседание заблокировано на 30с');
        sendCmd('block_crouch 1');
        setTimeout(() => { sendCmd('block_crouch 0'); log('✅ Блок приседания снят'); }, 30000);
        break;
      case 'play_sound':
        log('🔊 Воспроизведение звука на стриме (через оверлей)');
        break;
      case 'flash_screen':
        log('💥 Вспышка экрана (через оверлей)');
        break;
      case 'random_weapon_switch':
        log('🎲 Выполнение: Рандомное переключение оружия (недоступно без console/raw hook, пропуск)');
        break;
      case 'invert_mouse':
        log('🔃 Инверсия мыши 10с...');
        sendCmd('invert 1');
        setTimeout(() => { sendCmd('invert 0'); log('✅ Инверсия мыши снята'); }, 10000);
        break;
      case 'low_sens_10':
        log('🐢 Низкая чувствительность 10с...');
        sendCmd('sens 0.1');
        setTimeout(() => { sendCmd('sens 1.0'); log('✅ Низкая чувствительность снята'); }, 10000);
        break;
      case 'high_sens_10':
        log('🐇 Высокая чувствительность 10с...');
        sendCmd('sens 5.0');
        setTimeout(() => { sendCmd('sens 1.0'); log('✅ Высокая чувствительность снята'); }, 10000);
        break;
      default:
        log(`⚠️ Неизвестное действие: ${task.action_type}`);
    }

    await apiPost('/api/cs2/agent/confirm', { taskId: task.id, status: 'done' });
    log(`✅ Задача ${task.id.substring(0,8)} подтверждена сервером`);
  } catch (err) {
    console.error(`❌ Ошибка выполнения задачи: ${err.message}`);
    try {
      await apiPost('/api/cs2/agent/confirm', { taskId: task.id, status: 'error', error: err.message });
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
    if (data.task) await executeTask(data.task);
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED')) console.error('[poll error]', err.message);
  } finally {
    running = false;
  }
}

log(`🚀 Агент запущен. Опрос каждые ${POLL_MS}ms...`);
log('Нажми Ctrl+C для остановки\n');
setInterval(poll, POLL_MS);

process.on('SIGINT', () => {
  log('\n👋 Остановка агента...');
  if (helperProc) helperProc.kill();
  process.exit(0);
});
