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

    [DllImport("user32.dll")]
    static extern IntPtr GetDC(IntPtr hWnd);

    [DllImport("gdi32.dll")]
    static extern bool SetDeviceGammaRamp(IntPtr hDC, ref RAMP lpRamp);
    
    [DllImport("gdi32.dll")]
    static extern bool GetDeviceGammaRamp(IntPtr hDC, ref RAMP lpRamp);

    [DllImport("user32.dll")]
    static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    struct RAMP
    {
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Red;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Green;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 256)]
        public ushort[] Blue;
    }

    const uint RID_INPUT = 0x10000003;
    const uint RIM_TYPEMOUSE = 0;
    const int WM_INPUT = 0x00FF;
    const int WH_KEYBOARD_LL = 13;
    const int WH_MOUSE_LL = 14;
    
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
    public bool PacifistActive = false;

    IntPtr kbHookId = IntPtr.Zero;
    IntPtr msHookId = IntPtr.Zero;
    LowLevelHookProc kbProc;
    LowLevelHookProc msProc;

    RAMP origRamp = new RAMP();
    bool hasOrigRamp = false;

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
        rid.dwFlags = 0x00000100;
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
            int wm = wParam.ToInt32();
            bool isKeyDown = wm == 0x0100 || wm == 0x0104;
            
            if (BlockJumpActive && vkCode == 0x20) // Space
            {
                if (isKeyDown) {
                    SendKey(0x1D, true);
                    ThreadPool.QueueUserWorkItem(_ => { Thread.Sleep(300); SendKey(0x1D, false); });
                }
                return (IntPtr)1; // Block original space
            }
            
            if (BlockCrouchActive && (vkCode == 0xA2 || vkCode == 0xA3 || vkCode == 0x11 || vkCode == 0x43)) // Ctrl/C
            {
                if (isKeyDown) {
                    SendKey(0x39, true);
                    ThreadPool.QueueUserWorkItem(_ => { Thread.Sleep(50); SendKey(0x39, false); });
                }
                return (IntPtr)1; // Block original crouch
            }
        }
        return CallNextHookEx(kbHookId, nCode, wParam, lParam);
    }

    IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            int wm = wParam.ToInt32();
            
            if (BlockJumpActive && wm == 0x020A) // Scroll
            {
                SendKey(0x1D, true);
                ThreadPool.QueueUserWorkItem(_ => { Thread.Sleep(300); SendKey(0x1D, false); });
                return (IntPtr)1; // Block scroll
            }
            
            if (PacifistActive && (wm == 0x0201 || wm == 0x0202)) // LBUTTONDOWN / LBUTTONUP
            {
                return (IntPtr)1; // Block shooting
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
        inputs[0].u.mi.dwFlags = 0x0001;
        inputs[0].u.mi.time = 0;
        inputs[0].u.mi.dwExtraInfo = extraInfo;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void SendMouseClick(bool down)
    {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_MOUSE;
        inputs[0].u.mi.dwFlags = down ? (uint)0x0002 : (uint)0x0004;
        inputs[0].u.mi.dwExtraInfo = INJECTED_TAG;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    static void SendKey(ushort scanCode, bool down) {
        INPUT[] inputs = new INPUT[1];
        inputs[0].type = INPUT_KEYBOARD;
        inputs[0].u.ki.wVk = 0;
        inputs[0].u.ki.wScan = scanCode;
        inputs[0].u.ki.dwFlags = KEYEVENTF_SCANCODE | (down ? KEYEVENTF_KEYDOWN : KEYEVENTF_KEYUP);
        inputs[0].u.ki.time = 0;
        inputs[0].u.ki.dwExtraInfo = INJECTED_TAG;
        SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
    }

    void ReleaseMovementKeys() {
        SendKey(0x11, false); // W
        SendKey(0x1E, false); // A
        SendKey(0x1F, false); // S
        SendKey(0x20, false); // D
        SendKey(0x39, false); // Space
        SendKey(0x1D, false); // Ctrl
        SendKey(0x2A, false); // Shift
    }

    void FlashScreen()
    {
        IntPtr hDC = GetDC(IntPtr.Zero);
        if (!hasOrigRamp) {
            origRamp = new RAMP();
            origRamp.Red = new ushort[256];
            origRamp.Green = new ushort[256];
            origRamp.Blue = new ushort[256];
            GetDeviceGammaRamp(hDC, ref origRamp);
            hasOrigRamp = true;
        }

        RAMP whiteRamp = new RAMP();
        whiteRamp.Red = new ushort[256];
        whiteRamp.Green = new ushort[256];
        whiteRamp.Blue = new ushort[256];
        for (int i = 0; i < 256; i++) {
            whiteRamp.Red[i] = 65535;
            whiteRamp.Green[i] = 65535;
            whiteRamp.Blue[i] = 65535;
        }
        SetDeviceGammaRamp(hDC, ref whiteRamp);

        ThreadPool.QueueUserWorkItem(_ => {
            Thread.Sleep(1500);
            SetDeviceGammaRamp(hDC, ref origRamp);
            ReleaseDC(IntPtr.Zero, hDC);
        });
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
                case "1": scan = 0x02; break;
                case "2": scan = 0x03; break;
                case "3": scan = 0x04; break;
            }
            if (scan != 0) {
                if (parts[2] == "click") { SendKey(scan, true); Thread.Sleep(50); SendKey(scan, false); }
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
        else if (cmd == "pacifist" && parts.Length >= 2) {
            PacifistActive = parts[1] == "1";
        }
        else if (cmd == "freeze" && parts.Length >= 2) {
            int sec = int.Parse(parts[1]);
            ThreadPool.QueueUserWorkItem(_ => {
                ReleaseMovementKeys();
                Thread.Sleep(50);
                BlockInput(true);
                Thread.Sleep(sec * 1000);
                BlockInput(false);
            });
        }
        else if (cmd == "spin180") {
            ThreadPool.QueueUserWorkItem(_ => {
                for (int i = 0; i < 8; i++) {
                    SendMouseMove(1000, 0, INJECTED_TAG);
                    Thread.Sleep(5);
                }
            });
        }
        else if (cmd == "flash") {
            FlashScreen();
        }
        else if (cmd == "shake") {
            ThreadPool.QueueUserWorkItem(_ => {
                Random rnd = new Random();
                for (int i = 0; i < 50; i++) {
                    SendMouseMove(rnd.Next(-100, 100), rnd.Next(-100, 100), INJECTED_TAG);
                    Thread.Sleep(100);
                }
            });
        }
        else if (cmd == "spinbot" && parts.Length >= 2) {
            int sec = int.Parse(parts[1]);
            ThreadPool.QueueUserWorkItem(_ => {
                for(int i=0; i<3; i++) { SendMouseMove(0, 5000, INJECTED_TAG); Thread.Sleep(5); }
                SendMouseClick(true);
                int loops = sec * 100;
                for (int i = 0; i < loops; i++) {
                    SendMouseMove(1000, 0, INJECTED_TAG);
                    Thread.Sleep(10);
                }
                SendMouseClick(false);
            });
        }
    }

    void ReadCommands()
    {
        while (true)
        {
            string cmd = Console.ReadLine();
            if (cmd == null) Environment.Exit(0);
            
            try { ProcessCommand(cmd); } catch { }
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
        fs.unlinkSync(csPath);
      }
    }
  }
}
compileHelper();

// ── C# Helper Process ──
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

// ── Utilities ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  { console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`); }

let supabaseUrl = '';
let supabaseAnonKey = '';

async function fetchConfig() {
  const url = `${BASE_URL}/api/cs2/agent/config`;
  const res = await fetch(url);
  const data = await res.json();
  supabaseUrl = data.supabaseUrl;
  supabaseAnonKey = data.supabaseAnonKey;
}

// ── HTTP helpers (Supabase REST API directly) ──
async function apiGetTask() {
  const url = `${supabaseUrl}/rest/v1/cs2_reward_queue?streamer_id=eq.${STREAMER_ID}&status=eq.pending&order=created_at.asc&limit=1`;
  const res = await fetch(url, { headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` } });
  const data = await res.json();
  return data && data.length > 0 ? data[0] : null;
}

async function setTaskStatus(taskId, status, errorMsg = null) {
  const url = `${supabaseUrl}/rest/v1/cs2_reward_queue?id=eq.${taskId}`;
  const body = { status };
  if (errorMsg) body.error = errorMsg;
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` },
    body: JSON.stringify(body)
  });
}

// ── Действия ──
async function executeTask(task) {
  log(`\n▶ Задача [${task.id.substring(0,8)}] action="${task.action_type}" от "${task.user_name}"`);

  // Атомарный перевод в processing напрямую через REST
  await setTaskStatus(task.id, 'processing');

  try {
    switch (task.action_type) {
      case 'drop_weapon':
        sendCmd('key g click');
        log('🔫 Выполнено: Выбросить оружие (G)');
        await sleep(2000);
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
        sendCmd('spin180');
        await sleep(2000);
        log('✅ Разворот выполнен');
        break;
      case 'block_jump':
        log('🚫 Прыжок заблокирован на 30с');
        sendCmd('block_jump 1');
        await sleep(30000);
        sendCmd('block_jump 0'); 
        log('✅ Блок прыжка снят');
        break;
      case 'block_crouch':
        log('🦆 Приседание заблокировано на 30с');
        sendCmd('block_crouch 1');
        await sleep(30000);
        sendCmd('block_crouch 0'); 
        log('✅ Блок приседания снят');
        break;
      case 'pacifist':
        log('🕊️ Пацифист на 15с...');
        sendCmd('pacifist 1');
        await sleep(15000);
        sendCmd('pacifist 0'); 
        log('✅ Пацифист снят');
        break;
      case 'play_sound':
        log('🔊 Воспроизведение звука на стриме (через оверлей)');
        await sleep(5000);
        break;
      case 'flash_screen':
        log('💥 Вспышка экрана');
        sendCmd('flash');
        await sleep(2000);
        break;
      case 'random_weapon_switch':
        log('🎲 Выполнение: Рандомное переключение оружия');
        const rKey = ['1','2','3'][Math.floor(Math.random()*3)];
        sendCmd(`key ${rKey} click`);
        await sleep(2000);
        break;
      case 'mouse_shake':
        log('🥴 Тряска мыши 5с...');
        sendCmd('shake');
        await sleep(5000);
        break;
      case 'invert_mouse':
        log('🔃 Инверсия мыши 10с...');
        sendCmd('invert 1');
        await sleep(10000);
        sendCmd('invert 0'); 
        log('✅ Инверсия мыши снята');
        break;
      case 'low_sens_10':
        log('🐢 Низкая чувствительность 10с...');
        sendCmd('sens 0.1');
        await sleep(10000);
        sendCmd('sens 1.0'); 
        log('✅ Низкая чувствительность снята');
        break;
      case 'high_sens_10':
        log('🐇 Высокая чувствительность 10с...');
        sendCmd('sens 5.0');
        await sleep(10000);
        sendCmd('sens 1.0'); 
        log('✅ Высокая чувствительность снята');
        break;
      case 'spinbot':
        log('🌪️ Выполнение: Крутилка 10с...');
        sendCmd('spinbot 10');
        await sleep(10000);
        log('✅ Крутилка завершена');
        break;
      default:
        log(`⚠️ Неизвестное действие: ${task.action_type}`);
        await sleep(2000);
    }

    await setTaskStatus(task.id, 'done');
    log(`✅ Задача ${task.id.substring(0,8)} выполнена`);
  } catch (err) {
    console.error(`❌ Ошибка выполнения задачи: ${err.message}`);
    try {
      await setTaskStatus(task.id, 'error', err.message);
    } catch {}
  }
}

// ── Polling loop (Прямой опрос Supabase REST, 0 Vercel CPU) ──
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
