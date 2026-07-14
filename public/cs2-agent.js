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

const AGENT_VERSION = "2.0.0";
console.log(`[CS2 Agent] Запуск версии ${AGENT_VERSION}`);

if (!STREAMER_ID) {
  console.error('❌ Укажи streamerId: node cs2-agent.js --streamerId=YOUR_ID');
  process.exit(1);
}

// ── C# Helper Source ──
const csharpCode = `
using System;
using System.Drawing;
using System.Threading;
using System.Windows.Forms;
using System.Runtime.InteropServices;
using System.Diagnostics;

class HookApp : Form
{
    const int WH_KEYBOARD_LL = 13;
    const int WH_MOUSE_LL = 14;
    const int WM_INPUT = 0x00FF;
    const int RID_INPUT = 0x10000003;
    const int RIM_TYPEMOUSE = 0;
    
    const uint KEYEVENTF_KEYDOWN = 0x0000;
    const uint KEYEVENTF_KEYUP = 0x0002;
    const uint KEYEVENTF_SCANCODE = 0x0008;
    const uint INPUT_MOUSE = 0;
    const uint INPUT_KEYBOARD = 1;
    
    static IntPtr INJECTED_TAG = new IntPtr(0x1337);

    delegate IntPtr LowLevelHookProc(int nCode, IntPtr wParam, IntPtr lParam);
    
    [DllImport("user32.dll", SetLastError = true)]
    static extern IntPtr SetWindowsHookEx(int idHook, LowLevelHookProc lpfn, IntPtr hMod, uint dwThreadId);
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool UnhookWindowsHookEx(IntPtr hhk);
    [DllImport("user32.dll")]
    static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    static extern IntPtr GetModuleHandle(string lpModuleName);
    [DllImport("user32.dll")]
    static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool RegisterRawInputDevices(RAWINPUTDEVICE[] pRawInputDevices, uint uiNumDevices, uint cbSize);
    [DllImport("user32.dll")]
    static extern uint GetRawInputData(IntPtr hRawInput, uint uiCommand, IntPtr pData, ref uint pcbSize, uint cbSizeHeader);
    
    [DllImport("user32.dll")]
    static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    
    [DllImport("user32.dll", SetLastError = true)]
    static extern bool SetProcessDPIAware();

    static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
    const uint SWP_NOACTIVATE = 0x0010;

    [StructLayout(LayoutKind.Sequential)]
    struct RECT
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
        public int Width { get { return Right - Left; } }
        public int Height { get { return Bottom - Top; } }
    }

    [StructLayout(LayoutKind.Sequential)]
    struct POINT
    {
        public int X;
        public int Y;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct INPUT
    {
        public uint type;
        public InputUnion u;
    }

    [StructLayout(LayoutKind.Explicit)]
    struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct HARDWAREINPUT
    {
        public uint uMsg;
        public ushort wParamL;
        public ushort wParamH;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTDEVICE
    {
        public ushort usUsagePage;
        public ushort usUsage;
        public uint dwFlags;
        public IntPtr hwndTarget;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct RAWINPUTHEADER
    {
        public uint dwType;
        public uint dwSize;
        public IntPtr hDevice;
        public IntPtr wParam;
    }

    public double MultiplierX = 1.0;
    public double MultiplierY = 1.0;
    
    double remainderX = 0;
    double remainderY = 0;
    
    public bool BlockJumpActive = false;
    public bool BlockCrouchActive = false;
    public bool PacifistActive = false;
    public bool FreezeActive = false;

    IntPtr kbHookId = IntPtr.Zero;
    IntPtr msHookId = IntPtr.Zero;
    LowLevelHookProc kbProc;
    LowLevelHookProc msProc;

    Form activeFlashForm = null;

    public HookApp()
    {
        try { SetProcessDPIAware(); } catch {}

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

    [StructLayout(LayoutKind.Sequential)]
    struct KBDLLHOOKSTRUCT
    {
        public int vkCode;
        public int scanCode;
        public int flags;
        public int time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct MSLLHOOKSTRUCT
    {
        public int pt_x;
        public int pt_y;
        public int mouseData;
        public int flags;
        public int time;
        public IntPtr dwExtraInfo;
    }

    const int LLKHF_INJECTED = 0x00000010;
    const int LLMHF_INJECTED = 0x00000001;

    IntPtr GetCs2Handle()
    {
        Process[] procs = Process.GetProcessesByName("cs2");
        if (procs.Length > 0) return procs[0].MainWindowHandle;
        return IntPtr.Zero;
    }

    IntPtr KeyboardHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            KBDLLHOOKSTRUCT kbd = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            
            bool isInjected = (kbd.dwExtraInfo == INJECTED_TAG) || ((kbd.flags & LLKHF_INJECTED) != 0);
            
            if (!isInjected)
            {
                if (FreezeActive) {
                    IntPtr cs2Wnd = GetCs2Handle();
                    if (cs2Wnd != IntPtr.Zero && GetForegroundWindow() == cs2Wnd) {
                        // Block WASD, Space, Ctrl, Shift
                        int vk = kbd.vkCode;
                        if (vk == 0x57 || vk == 0x41 || vk == 0x53 || vk == 0x44 || 
                            vk == 0x20 || vk == 0xA2 || vk == 0xA3 || vk == 0x11 || 
                            vk == 0x10 || vk == 0xA0 || vk == 0xA1 || vk == 0x43) 
                        {
                            return (IntPtr)1;
                        }
                    }
                }

                if (BlockJumpActive && kbd.vkCode == 0x20) // Space
                {
                    return (IntPtr)1; // Block original space
                }
                
                if (BlockCrouchActive && (kbd.vkCode == 0xA2 || kbd.vkCode == 0xA3 || kbd.vkCode == 0x11 || kbd.vkCode == 0x43)) // Ctrl/C
                {
                    return (IntPtr)1; // Block original crouch
                }
            }
        }
        return CallNextHookEx(kbHookId, nCode, wParam, lParam);
    }

    IntPtr MouseHookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            MSLLHOOKSTRUCT ms = (MSLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(MSLLHOOKSTRUCT));
            int wm = wParam.ToInt32();
            
            bool isInjected = (ms.dwExtraInfo == INJECTED_TAG) || ((ms.flags & LLMHF_INJECTED) != 0);
            
            if (!isInjected)
            {
                if (BlockJumpActive && wm == 0x020A) // Scroll
                {
                    return (IntPtr)1; // Block scroll
                }
                
                if (PacifistActive && (wm == 0x0201 || wm == 0x0202)) // LBUTTONDOWN / LBUTTONUP
                {
                    return (IntPtr)1; // Block shooting
                }
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
                            if (!FreezeActive) {
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

    [DllImport("user32.dll", SetLastError = true)]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")]
    static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    void FlashScreen(string cmdId)
    {
        IntPtr cs2Wnd = GetCs2Handle();
        if (cs2Wnd == IntPtr.Zero || !IsWindow(cs2Wnd) || IsIconic(cs2Wnd)) {
            Console.WriteLine("ERROR " + cmdId + " " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("cs2 not running or minimized")));
            Console.Out.Flush();
            return;
        }

        RECT rect;
        if (!GetClientRect(cs2Wnd, out rect)) {
            Console.WriteLine("ERROR " + cmdId + " " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("cannot get client rect")));
            Console.Out.Flush();
            return;
        }

        POINT pt = new POINT { X = 0, Y = 0 };
        ClientToScreen(cs2Wnd, ref pt);

        if (rect.Width <= 0 || rect.Height <= 0) {
            Console.WriteLine("ERROR " + cmdId + " " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes("invalid bounds")));
            Console.Out.Flush();
            return;
        }

        // Close existing if any
        if (activeFlashForm != null && !activeFlashForm.IsDisposed) {
            try {
                activeFlashForm.Invoke((MethodInvoker)delegate {
                    activeFlashForm.Close();
                });
            } catch {}
        }

        ThreadPool.QueueUserWorkItem(_ => {
            Form flashForm = new Form();
            activeFlashForm = flashForm;
            flashForm.FormBorderStyle = FormBorderStyle.None;
            flashForm.StartPosition = FormStartPosition.Manual;
            flashForm.BackColor = Color.White;
            flashForm.ShowInTaskbar = false;
            
            flashForm.Location = new Point(pt.X, pt.Y);
            flashForm.Size = new Size(rect.Width, rect.Height);

            int initialStyle = GetWindowLong(flashForm.Handle, -20);
            SetWindowLong(flashForm.Handle, -20, initialStyle | 0x80000 /* WS_EX_LAYERED */ | 0x20 /* WS_EX_TRANSPARENT */ | 0x08000000 /* WS_EX_NOACTIVATE */ | 0x00000080 /* WS_EX_TOOLWINDOW */);
            
            SetWindowPos(flashForm.Handle, HWND_TOPMOST, pt.X, pt.Y, rect.Width, rect.Height, SWP_NOACTIVATE);

            Application.Run(new FlashApplicationContext(flashForm, cmdId, this));
        });
    }

    class FlashApplicationContext : ApplicationContext {
        System.Windows.Forms.Timer fadeTimer;
        Form f;
        double opacity = 1.0;
        string cmdId;
        HookApp app;
        
        public FlashApplicationContext(Form form, string commandId, HookApp mainApp) {
            f = form;
            cmdId = commandId;
            app = mainApp;
            f.Opacity = opacity;
            f.Show();
            
            fadeTimer = new System.Windows.Forms.Timer();
            fadeTimer.Interval = 30; // 30ms step
            fadeTimer.Tick += FadeTimer_Tick;
            fadeTimer.Start();
        }
        
        private void FadeTimer_Tick(object sender, EventArgs e) {
            opacity -= 0.03;
            if (opacity <= 0) {
                fadeTimer.Stop();
                f.Close();
                if (app.activeFlashForm == f) app.activeFlashForm = null;
                Console.WriteLine("FINISHED " + cmdId);
                Console.Out.Flush();
                ExitThread();
            } else {
                f.Opacity = opacity;
            }
        }
    }

    void ProcessCommand(string cmdId, string actionType, int durationMs, string[] parts)
    {
        try {
            Console.WriteLine("STARTED " + cmdId);
            Console.Out.Flush();
            
            if (actionType == "drop_weapon") {
                SendKey(0x22, true); Thread.Sleep(50); SendKey(0x22, false);
            }
            else if (actionType == "freeze_3" || actionType == "freeze_5") {
                ThreadPool.QueueUserWorkItem(_ => {
                    double savedX = MultiplierX;
                    double savedY = MultiplierY;
                    try {
                        ReleaseMovementKeys();
                        Thread.Sleep(50);
                        MultiplierX = 0; // stop raw mouse movement calculation
                        MultiplierY = 0;
                        FreezeActive = true;
                        Thread.Sleep(durationMs);
                    } finally {
                        FreezeActive = false;
                        MultiplierX = savedX;
                        MultiplierY = savedY;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "spin_180") {
                for (int i = 0; i < 8; i++) {
                    SendMouseMove(1000, 0, INJECTED_TAG);
                    Thread.Sleep(5);
                }
            }
            else if (actionType == "block_jump") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        BlockJumpActive = true;
                        Thread.Sleep(durationMs);
                    } finally {
                        BlockJumpActive = false;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "block_crouch") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        BlockCrouchActive = true;
                        Thread.Sleep(durationMs);
                    } finally {
                        BlockCrouchActive = false;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "pacifist") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        PacifistActive = true;
                        Thread.Sleep(durationMs);
                    } finally {
                        PacifistActive = false;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "flash_screen") {
                FlashScreen(cmdId);
                return; // finished is emitted internally
            }
            else if (actionType == "mouse_shake") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        Random rnd = new Random();
                        int loops = durationMs / 100;
                        for (int i = 0; i < loops; i++) {
                            SendMouseMove(rnd.Next(-100, 100), rnd.Next(-100, 100), INJECTED_TAG);
                            Thread.Sleep(100);
                        }
                    } finally {
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "invert_mouse") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        MultiplierX = -1.0;
                        MultiplierY = -1.0;
                        Thread.Sleep(durationMs);
                    } finally {
                        MultiplierX = 1.0;
                        MultiplierY = 1.0;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "low_sens_10") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        MultiplierX = 0.1;
                        MultiplierY = 0.1;
                        Thread.Sleep(durationMs);
                    } finally {
                        MultiplierX = 1.0;
                        MultiplierY = 1.0;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "high_sens_10") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        MultiplierX = 5.0;
                        MultiplierY = 5.0;
                        Thread.Sleep(durationMs);
                    } finally {
                        MultiplierX = 1.0;
                        MultiplierY = 1.0;
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "spinbot") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        DateTime endTime = DateTime.UtcNow.AddMilliseconds(durationMs);
                        while (DateTime.UtcNow < endTime) {
                            SendMouseClick(true);
                            Thread.Sleep(30);
                            SendMouseClick(false);
                            
                            for (int i = 0; i < 8; i++) {
                                SendMouseMove(1000, 0, INJECTED_TAG);
                                Thread.Sleep(10);
                            }
                        }
                    } finally {
                        SendMouseClick(false);
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            
            // For synchronous actions, emit FINISHED immediately
            Console.WriteLine("FINISHED " + cmdId);
            Console.Out.Flush();
        } catch (Exception ex) {
            Console.WriteLine("ERROR " + cmdId + " " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(ex.Message)));
            Console.Out.Flush();
        }
    }

    void ReadCommands()
    {
        Console.WriteLine("READY 1.0");
        Console.Out.Flush();
        while (true)
        {
            string line = Console.ReadLine();
            if (line == null) Environment.Exit(0);
            
            try { 
                string[] parts = line.Split(' ');
                if (parts.Length == 0) continue;
                if (parts[0] == "COMMAND" && parts.Length >= 4) {
                    string cmdId = parts[1];
                    string actionType = parts[2];
                    int durationMs = int.Parse(parts[3]);
                    ProcessCommand(cmdId, actionType, durationMs, parts);
                } else if (parts[0] == "RESET") {
                    ReleaseMovementKeys();
                    BlockJumpActive = false;
                    BlockCrouchActive = false;
                    PacifistActive = false;
                    FreezeActive = false;
                    MultiplierX = 1.0;
                    MultiplierY = 1.0;
                    if (activeFlashForm != null && !activeFlashForm.IsDisposed) {
                        try {
                            activeFlashForm.Invoke((MethodInvoker)delegate { activeFlashForm.Close(); });
                        } catch {}
                        activeFlashForm = null;
                    }
                    Console.WriteLine("RESET_DONE");
                    Console.Out.Flush();
                }
            } catch (Exception ex) { 
                Console.WriteLine("ERROR unknown " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(ex.Message)));
                Console.Out.Flush();
            }
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

const crypto = require('crypto');
function compileHelper() {
  const csPath = 'cs2_input_helper.cs';
  const exePath = 'cs2_input_helper.exe';
  const versionPath = '.helper_version';
  
  const currentHash = crypto.createHash('md5').update(csharpCode).digest('hex');
  let needsCompile = true;
  
  if (fs.existsSync(exePath) && fs.existsSync(versionPath)) {
    const savedHash = fs.readFileSync(versionPath, 'utf8').trim();
    if (savedHash === currentHash) {
      needsCompile = false;
    }
  }

  if (needsCompile) {
    console.log('⚙️ Компиляция Background Helper C#...');
    try {
      if (fs.existsSync(exePath)) fs.unlinkSync(exePath);
      fs.writeFileSync(csPath, csharpCode, 'utf8');
      const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
      if (!fs.existsSync(cscPath)) throw new Error('csc.exe не найден.');
      execSync(`"${cscPath}" /nologo /out:"${exePath}" /target:winexe /optimize /r:System.Windows.Forms.dll /r:System.Drawing.dll "${csPath}"`);
      fs.writeFileSync(versionPath, currentHash, 'utf8');
      console.log('✅ Background Helper скомпилирован успешно!');
    } catch (err) {
      console.error('⚠️ Ошибка автокомпиляции C# Helper:', err.message);
    } finally {
      if (fs.existsSync(csPath)) fs.unlinkSync(csPath);
    }
  } else {
    console.log('✅ Background Helper актуален (компиляция не требуется).');
  }
}
compileHelper();


// ── C# Helper Process ──
let helperProc = null;
const pendingCommands = new Map();

let helperReadyResolver = null;
let helperReadyRejector = null;
const helperReadyPromise = new Promise((resolve, reject) => {
  helperReadyResolver = resolve;
  helperReadyRejector = reject;
});

function startHelper() {
  if (process.platform !== 'win32') return;
  helperProc = spawn('cs2_input_helper.exe', [], { stdio: ['pipe', 'pipe', 'inherit'] });
  
  // Timeout for READY
  const readyTimeout = setTimeout(() => {
    if (helperReadyRejector) {
      helperReadyRejector(new Error('Helper ready timeout (10s). Helper did not start correctly.'));
      helperReadyRejector = null;
    }
  }, 10000);

  const readline = require('readline');
  const rl = readline.createInterface({ input: helperProc.stdout });
  
  rl.on('line', (line) => {
    line = line.trim();
    if (!line) return;
    const parts = line.split(' ');
    const msgType = parts[0];
    
    if (msgType === 'READY') {
      log(`[Helper] Ready v${parts[1] || '1.0'}`);
      if (helperReadyResolver) {
        clearTimeout(readyTimeout);
        helperReadyResolver();
        helperReadyResolver = null;
        helperReadyRejector = null;
      }
    } else if (msgType === 'STARTED' && parts[1]) {
      const cmdId = parts[1];
      if (pendingCommands.has(cmdId)) {
        pendingCommands.get(cmdId).onStarted();
      }
    } else if (msgType === 'FINISHED' && parts[1]) {
      const cmdId = parts[1];
      if (pendingCommands.has(cmdId)) {
        pendingCommands.get(cmdId).onFinished();
        pendingCommands.delete(cmdId);
      }
    } else if (msgType === 'ERROR' && parts[1]) {
      const cmdId = parts[1];
      const b64msg = parts[2] || '';
      let errMsg = 'Unknown error';
      try { errMsg = Buffer.from(b64msg, 'base64').toString('utf8'); } catch(e){}
      
      if (pendingCommands.has(cmdId)) {
        pendingCommands.get(cmdId).onError(new Error(errMsg));
        pendingCommands.delete(cmdId);
      }
    } else if (msgType === 'RESET_DONE') {
      log(`[Helper] Сброс выполнен`);
    }
  });

  helperProc.on('exit', () => {
    console.log('⚠️ Helper process exited. Restarting...');
    // Reject all pending commands
    for (const [cmdId, handlers] of pendingCommands.entries()) {
      handlers.onError(new Error('Helper process crashed'));
    }
    pendingCommands.clear();
    setTimeout(startHelper, 1000);
  });
}
startHelper();

function sendCmd(cmdId, actionType, durationMs) {
  return new Promise((resolve, reject) => {
    if (!helperProc || !helperProc.stdin.writable) {
      return reject(new Error('Helper not running'));
    }
    
    let started = false;
    
    const startTimeout = setTimeout(() => {
      if (!started) {
        pendingCommands.delete(cmdId);
        reject(new Error('Timeout waiting for STARTED'));
      }
    }, 3000);

    const handlers = {
      onStarted: () => {
        started = true;
        clearTimeout(startTimeout);
      },
      onFinished: () => {
        resolve();
      },
      onError: (err) => {
        reject(err);
      }
    };
    
    pendingCommands.set(cmdId, handlers);
    helperProc.stdin.write(`COMMAND ${cmdId} ${actionType} ${durationMs}\n`);
  });
}

// ── Utilities ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  { console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`); }

let supabaseUrl = '';
let supabaseAnonKey = '';
let actionsRegistry = {};

async function fetchConfig() {
  const url = `${BASE_URL}/api/cs2/agent/config`;
  const res = await fetch(url);
  const data = await res.json();
  supabaseUrl = data.supabaseUrl;
  supabaseAnonKey = data.supabaseAnonKey;
  actionsRegistry = data.actions || {};
}

// ── HTTP helpers (Supabase REST API directly) ──
async function apiGetTask() {
  const url = `${supabaseUrl}/rest/v1/cs2_reward_queue?streamer_id=eq.${STREAMER_ID}&status=eq.pending&order=created_at.asc&limit=1`;
  const res = await fetch(url, { headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` } });
  if (!res.ok) throw new Error(`apiGetTask failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data && data.length > 0 ? data[0] : null;
}

async function setTaskStatus(taskId, status, errorMsg = null, requirePending = false) {
  if (taskId.startsWith('test_')) {
    return { duration_ms: 2000 };
  }
  
  let url = `${supabaseUrl}/rest/v1/cs2_reward_queue?id=eq.${taskId}`;
  if (requirePending) {
    url += `&status=eq.pending`;
  }
  const body = { status };
  if (errorMsg) body.error = errorMsg;
  if (status === 'processing') {
    body.started_at = new Date().toISOString();
  } else if (status === 'done') {
    body.finished_at = new Date().toISOString();
  }

  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json', 
      'apikey': supabaseAnonKey, 
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(body)
  });
  
  if (!res.ok) throw new Error(`setTaskStatus failed: ${res.status} ${await res.text()}`);
  
  const data = await res.json();
  if (requirePending && (!data || data.length === 0)) {
    throw new Error('Claim failed: task already claimed or invalid');
  }
  return data[0];
}

// ── Действия ──
async function executeTask(task) {
  log(`\n▶ Задача [${task.id.substring(0,8)}] action="${task.action_type}" от "${task.user_name}"`);

  // Атомарный перевод в processing
  try {
    const updatedTask = await setTaskStatus(task.id, 'processing', null, true);
    // Use the duration from DB if available, else fallback to registry
    task.duration_ms = updatedTask.duration_ms || (actionsRegistry[task.action_type]?.durationMs ?? 2000);
  } catch (err) {
    log(`⚠️ Пропуск задачи ${task.id.substring(0,8)}: ${err.message}`);
    return;
  }

  try {
    const cmdId = task.id;
    const actionType = task.action_type;
    const durationMs = task.duration_ms;

    log(`⏳ Ожидание завершения действия ${actionType} (${durationMs}ms)...`);
    
    // For play_sound, there is no C# helper logic, just wait.
    if (actionType === 'play_sound') {
      await sleep(durationMs);
    } else {
      await sendCmd(cmdId, actionType, durationMs);
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

// ── Polling loop (REST polling напрямую в Supabase) ──
let running = false;
let currentPollMs = 1000;
let emptyPollCount = 0;

async function poll() {
  if (running) return;
  running = true;
  try {
    const task = await apiGetTask();
    if (task) {
      emptyPollCount = 0;
      currentPollMs = 1000;
      await executeTask(task);
    } else {
      emptyPollCount++;
      if (emptyPollCount > 5) {
        currentPollMs = 5000;
      } else {
        currentPollMs = 2500;
      }
    }
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED')) console.error('[poll error]', err.message);
  } finally {
    running = false;
    setTimeout(poll, currentPollMs);
  }
}

async function start() {
  log('🚀 Ожидание запуска C# Helper...');
  try {
    await helperReadyPromise;
  } catch (err) {
    console.error('❌ Ошибка запуска Helper:', err.message);
    process.exit(1);
  }

  if (args['self-test']) {
    log('🧪 ЗАПУСК В РЕЖИМЕ SELF-TEST...');
    actionsRegistry = {
      'drop_weapon': { type: 'drop_weapon', durationMs: 2000 },
      'freeze_3': { type: 'freeze_3', durationMs: 3000 }
    };
    log('1. Тестирование сброса оружия (drop_weapon)');
    await executeTask({ id: 'test_1', action_type: 'drop_weapon', user_name: 'self_test' });
    
    log('2. Тестирование заморозки (freeze_3)');
    await executeTask({ id: 'test_2', action_type: 'freeze_3', duration_ms: 3000, user_name: 'self_test' });
    
    log('✅ Self-test успешно завершен!');
    if (helperProc) {
      try { helperProc.stdin.write('RESET\n'); await sleep(1000); } catch(e){}
      helperProc.kill();
    }
    process.exit(0);
    return;
  }

  log('🚀 Инициализация... Получение конфига Supabase');
  await fetchConfig();
  log(`🚀 Агент запущен. REST polling напрямую в Supabase каждые 2500-5000ms...`);
  log('Нажми Ctrl+C для остановки\n');
  setTimeout(poll, currentPollMs);
}
start();

process.on('SIGINT', async () => {
  log('\n👋 Остановка агента...');
  if (helperProc && helperProc.stdin.writable) {
    try {
      helperProc.stdin.write('RESET\n');
      log('Ожидание сброса (до 2с)...');
      await sleep(2000); // give it time to reset
    } catch(e) {}
    helperProc.kill();
  }
  process.exit(0);
});

// Also handle unhandled exceptions gracefully
process.on('uncaughtException', async (err) => {
  console.error('Uncaught Exception:', err);
  if (helperProc && helperProc.stdin.writable) {
    try { helperProc.stdin.write('RESET\n'); await sleep(1000); } catch(e){}
    helperProc.kill();
  }
  process.exit(1);
});

process.on('unhandledRejection', async (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  if (helperProc && helperProc.stdin.writable) {
    try { helperProc.stdin.write('RESET\n'); await sleep(1000); } catch(e){}
    helperProc.kill();
  }
  process.exit(1);
});
