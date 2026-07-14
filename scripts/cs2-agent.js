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

const BASE_URL_RAW = process.env.CS2_BASE_URL || args.baseUrl || 'https://paracetamolhaze.vercel.app';
const BASE_URL = String(BASE_URL_RAW).trim().replace(/\/+$/, '');
const STREAMER_ID = String(process.env.CS2_STREAMER_ID || args.streamerId || '').trim();
const AGENT_SECRET = process.env.CS2_AGENT_SECRET || args.agentSecret || '';
const POLL_MS = parseInt(process.env.CS2_POLL_MS || args.pollMs || '500');

const AGENT_VERSION = "2.0.3";
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
    
    public volatile bool BlockJumpActive = false;
    public volatile bool BlockCrouchActive = false;
    public volatile bool PacifistActive = false;
    public volatile bool FreezeActive = false;

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

    IntPtr cachedCs2Handle = IntPtr.Zero;

    IntPtr GetCs2Handle()
    {
        if (cachedCs2Handle != IntPtr.Zero && IsWindow(cachedCs2Handle)) {
            return cachedCs2Handle;
        }

        Process[] procs = Process.GetProcessesByName("cs2");
        for (int i = 0; i < procs.Length; i++) {
            IntPtr handle = procs[i].MainWindowHandle;
            if (handle != IntPtr.Zero && IsWindow(handle)) {
                cachedCs2Handle = handle;
                return handle;
            }
        }

        cachedCs2Handle = IntPtr.Zero;
        return IntPtr.Zero;
    }

    bool IsCs2Foreground()
    {
        IntPtr cs2Wnd = GetCs2Handle();
        return cs2Wnd != IntPtr.Zero && GetForegroundWindow() == cs2Wnd;
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

                if (BlockJumpActive && IsCs2Foreground() && kbd.vkCode == 0x20) // Space
                {
                    return (IntPtr)1; // Block original space
                }
                
                if (BlockCrouchActive && IsCs2Foreground() && (kbd.vkCode == 0xA2 || kbd.vkCode == 0xA3 || kbd.vkCode == 0x11 || kbd.vkCode == 0x43)) // Ctrl/C
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
            
            // Only input emitted by this helper may bypass Pacifist.
            // Some gaming-mouse software marks real clicks as LLMHF_INJECTED,
            // so treating every injected event as trusted made blocking intermittent.
            bool isOwnInjected = ms.dwExtraInfo == INJECTED_TAG;
            
            if (!isOwnInjected)
            {
                // Suppress ordinary Windows mouse movement while CS2 freeze is active.
                // Raw Input is compensated separately in WndProc below.
                if (FreezeActive && IsCs2Foreground() && wm == 0x0200) // WM_MOUSEMOVE
                {
                    return (IntPtr)1;
                }

                if (BlockJumpActive && IsCs2Foreground() && wm == 0x020A) // Scroll
                {
                    return (IntPtr)1; // Block scroll
                }
                
                if (PacifistActive && IsCs2Foreground() && (wm == 0x0201 || wm == 0x0202 || wm == 0x0203)) // LBUTTONDOWN / LBUTTONUP / DBLCLK
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
                        ushort buttonFlags = (ushort)Marshal.ReadInt16(pData, headerSize + 4);

                        // Raw Input can bypass WH_MOUSE_LL in some CS2/mouse-driver setups.
                        // Immediately release every physical left-button down as a second layer.
                        if (PacifistActive && IsCs2Foreground() && (buttonFlags & 0x0001) != 0) {
                            SendMouseClick(false);
                        }
                        
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
                            } else {
                                IntPtr cs2Wnd = GetCs2Handle();
                                if (cs2Wnd != IntPtr.Zero && GetForegroundWindow() == cs2Wnd) {
                                    SendMouseMove(-lLastX, -lLastY, INJECTED_TAG);
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
        SendKey(0x2E, false); // C
    }

    [DllImport("user32.dll", SetLastError = true)]
    static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")]
    static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

    void FlashScreen(string cmdId, int durationMs)
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
            flashForm.TopMost = true;
            flashForm.ShowInTaskbar = false;
            
            flashForm.Location = new Point(pt.X, pt.Y);
            flashForm.Size = new Size(rect.Width, rect.Height);

            int initialStyle = GetWindowLong(flashForm.Handle, -20);
            SetWindowLong(flashForm.Handle, -20, initialStyle | 0x80000 /* WS_EX_LAYERED */ | 0x20 /* WS_EX_TRANSPARENT */ | 0x08000000 /* WS_EX_NOACTIVATE */ | 0x00000080 /* WS_EX_TOOLWINDOW */);
            
            SetWindowPos(flashForm.Handle, HWND_TOPMOST, pt.X, pt.Y, rect.Width, rect.Height, SWP_NOACTIVATE);

            Application.Run(new FlashApplicationContext(flashForm, cmdId, this, durationMs));
        });
    }

    class FlashApplicationContext : ApplicationContext {
        System.Windows.Forms.Timer fadeTimer;
        Form f;
        string cmdId;
        HookApp app;
        DateTime startedAt;
        int totalMs;
        int holdMs;
        bool finished = false;
        
        public FlashApplicationContext(Form form, string commandId, HookApp mainApp, int durationMs) {
            f = form;
            cmdId = commandId;
            app = mainApp;
            totalMs = Math.Max(1200, durationMs);
            holdMs = Math.Min(700, Math.Max(500, totalMs / 3));
            startedAt = DateTime.UtcNow;

            // Strong flash: stay fully white first, then fade over the remaining time.
            f.Opacity = 1.0;
            f.Show();
            f.TopMost = true;
            SetWindowPos(f.Handle, HWND_TOPMOST, f.Left, f.Top, f.Width, f.Height, SWP_NOACTIVATE);
            
            fadeTimer = new System.Windows.Forms.Timer();
            fadeTimer.Interval = 16;
            fadeTimer.Tick += FadeTimer_Tick;
            fadeTimer.Start();
        }

        void Finish() {
            if (finished) return;
            finished = true;
            fadeTimer.Stop();
            try { f.Close(); } catch {}
            if (app.activeFlashForm == f) app.activeFlashForm = null;
            Console.WriteLine("FINISHED " + cmdId);
            Console.Out.Flush();
            ExitThread();
        }
        
        private void FadeTimer_Tick(object sender, EventArgs e) {
            double elapsedMs = (DateTime.UtcNow - startedAt).TotalMilliseconds;
            if (elapsedMs >= totalMs) {
                Finish();
                return;
            }

            if (elapsedMs <= holdMs) {
                f.Opacity = 1.0;
                return;
            }

            double fadeDuration = Math.Max(1.0, totalMs - holdMs);
            double progress = (elapsedMs - holdMs) / fadeDuration;
            f.Opacity = Math.Max(0.0, 1.0 - progress);
        }
    }

    void ProcessCommand(string cmdId, string actionType, int durationMs, string[] parts)
    {
        try {
            Console.WriteLine("STARTED " + cmdId);
            Console.Out.Flush();

            // Give Node -> Supabase -> OBS Realtime a short head start, so the
            // notification appears together with the actual effect.
            Thread.Sleep(250);
            
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
                        // Release a jump that was already held before enabling the hook.
                        SendKey(0x39, false);
                        BlockJumpActive = true;
                        Thread.Sleep(durationMs);
                    } finally {
                        BlockJumpActive = false;
                        SendKey(0x39, false);
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "block_crouch") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        // Release Ctrl/C before blocking. Otherwise a key pressed at the
                        // activation boundary can remain logically held inside CS2.
                        SendKey(0x1D, false); // Ctrl
                        SendKey(0x2E, false); // C
                        BlockCrouchActive = true;
                        Thread.Sleep(durationMs);
                    } finally {
                        BlockCrouchActive = false;
                        SendKey(0x1D, false);
                        SendKey(0x2E, false);
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "pacifist") {
                ThreadPool.QueueUserWorkItem(_ => {
                    try {
                        // Publish the state before releasing the button, so no click can
                        // slip through at the activation boundary.
                        PacifistActive = true;
                        SendMouseClick(false);
                        DateTime pacifistEnd = DateTime.UtcNow.AddMilliseconds(durationMs);
                        while (DateTime.UtcNow < pacifistEnd) {
                            // The low-level hook is primary. Rapid mouse-up injection is a
                            // fallback for CS2 Raw Input and gaming-mouse driver paths.
                            SendMouseClick(false);
                            Thread.Sleep(5);
                        }
                    } finally {
                        PacifistActive = false;
                        SendMouseClick(false);
                        Console.WriteLine("FINISHED " + cmdId);
                        Console.Out.Flush();
                    }
                });
                return;
            }
            else if (actionType == "flash_screen") {
                FlashScreen(cmdId, durationMs);
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
            else if (actionType == "random_weapon_switch") {
                // Press two distinct random weapon slots. The second slot is the final
                // result; using two distinct slots guarantees a visible switch even
                // when the first randomly selected slot was already active.
                ushort[] slots = new ushort[] { 0x02, 0x03, 0x04 }; // 1, 2, 3
                Random rnd = new Random();
                int first = rnd.Next(0, slots.Length);
                int second = (first + 1 + rnd.Next(0, slots.Length - 1)) % slots.Length;
                SendKey(slots[first], true); Thread.Sleep(45); SendKey(slots[first], false);
                Thread.Sleep(120);
                SendKey(slots[second], true); Thread.Sleep(45); SendKey(slots[second], false);
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
                    SendMouseClick(false);
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
  if (!helperProc || !helperProc.stdin.writable) {
    throw new Error('Helper not running');
  }

  let startResolve;
  let startReject;
  let finishResolve;
  let finishReject;

  const started = new Promise((resolve, reject) => {
    startResolve = resolve;
    startReject = reject;
  });
  const finished = new Promise((resolve, reject) => {
    finishResolve = resolve;
    finishReject = reject;
  });
  // Prevent an unhandled rejection when STARTED itself times out and the caller
  // never reaches await command.finished. Awaiting it later still rejects normally.
  finished.catch(() => {});

  let didStart = false;
  const startTimeout = setTimeout(() => {
    if (!didStart) {
      pendingCommands.delete(cmdId);
      const error = new Error('Timeout waiting for STARTED');
      startReject(error);
      finishReject(error);
    }
  }, 3000);

  const finishTimeout = setTimeout(() => {
    if (pendingCommands.has(cmdId)) {
      pendingCommands.delete(cmdId);
      finishReject(new Error('Timeout waiting for FINISHED'));
    }
  }, Math.max(Number(durationMs) + 10000, 15000));

  pendingCommands.set(cmdId, {
    onStarted: () => {
      if (didStart) return;
      didStart = true;
      clearTimeout(startTimeout);
      startResolve();
    },
    onFinished: () => {
      clearTimeout(startTimeout);
      clearTimeout(finishTimeout);
      finishResolve();
    },
    onError: (err) => {
      clearTimeout(startTimeout);
      clearTimeout(finishTimeout);
      if (!didStart) startReject(err);
      finishReject(err);
    },
  });

  helperProc.stdin.write(`COMMAND ${cmdId} ${actionType} ${durationMs}\n`);
  return { started, finished };
}

// ── Utilities ──
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function log(msg)  { console.log(`[${new Date().toLocaleTimeString('ru-RU')}] ${msg}`); }

let supabaseUrl = '';
let supabaseAnonKey = '';
let actionsRegistry = {};

async function fetchConfig() {
  const url = `${BASE_URL}/api/cs2/agent/config`;
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) {
    throw new Error(`fetchConfig failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  supabaseUrl = String(data.supabaseUrl || '').trim().replace(/\/+$/, '');
  supabaseAnonKey = String(data.supabaseAnonKey || '').trim();
  actionsRegistry = data.actions || {};

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public configuration is incomplete');
  }
}

// ── HTTP helpers (Supabase REST API directly) ──
async function apiGetTask() {
  const url = `${supabaseUrl}/rest/v1/cs2_reward_queue?streamer_id=eq.${STREAMER_ID}&status=eq.pending&order=created_at.asc&limit=1`;
  const res = await fetch(url, { headers: { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${supabaseAnonKey}` } });
  if (!res.ok) throw new Error(`apiGetTask failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data && data.length > 0 ? data[0] : null;
}

let timingCompatibilityWarned = false;

function isTimingSchemaError(status, responseText) {
  return status === 400 &&
    responseText.includes('PGRST204') &&
    /(started_at|finished_at|duration_ms)/.test(responseText);
}

async function patchTaskStatus(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  return { res, text, data };
}

async function setTaskStatus(taskId, status, errorMsg = null, requirePending = false, durationMs = null) {
  if (taskId.startsWith('test_')) {
    return { duration_ms: durationMs };
  }

  let url = `${supabaseUrl}/rest/v1/cs2_reward_queue?id=eq.${encodeURIComponent(taskId)}`;
  if (requirePending) url += '&status=eq.pending';

  const body = { status };
  if (errorMsg) body.error = errorMsg;
  if (status === 'processing') {
    // Claim the task first, but do not start the OBS timer until the helper
    // confirms STARTED. markTaskStarted() writes started_at separately.
    if (Number.isFinite(Number(durationMs))) body.duration_ms = Number(durationMs);
  } else if (status === 'done') {
    body.finished_at = new Date().toISOString();
  }

  let result = await patchTaskStatus(url, body);

  // The database migration can exist while PostgREST still has an old schema cache.
  // Do not leave the same pending task in an endless retry loop in that situation.
  if (!result.res.ok && isTimingSchemaError(result.res.status, result.text)) {
    if (!timingCompatibilityWarned) {
      timingCompatibilityWarned = true;
      console.warn('[WARN] Supabase timing columns are not visible to PostgREST yet. Using compatibility mode.');
    }

    const compatibilityBody = { status };
    if (errorMsg) compatibilityBody.error = errorMsg;
    result = await patchTaskStatus(url, compatibilityBody);
  }

  if (!result.res.ok) {
    throw new Error(`setTaskStatus failed: ${result.res.status} ${result.text}`);
  }

  const data = Array.isArray(result.data) ? result.data : [];
  if (requirePending && data.length === 0) {
    throw new Error('Claim failed: task already claimed or invalid');
  }
  return data[0] || null;
}

async function markTaskStarted(taskId, durationMs) {
  if (taskId.startsWith('test_')) return;

  const url = `${supabaseUrl}/rest/v1/cs2_reward_queue?id=eq.${encodeURIComponent(taskId)}&status=eq.processing`;
  const body = {
    started_at: new Date().toISOString(),
    duration_ms: Number(durationMs),
  };

  const result = await patchTaskStatus(url, body);
  if (!result.res.ok) {
    throw new Error(`markTaskStarted failed: ${result.res.status} ${result.text}`);
  }
}

// ── Действия ──
async function executeTask(task) {
  log(`\n▶ Задача [${task.id.substring(0,8)}] action="${task.action_type}" от "${task.user_name}"`);

  const registryDurationMs = Number(actionsRegistry[task.action_type]?.durationMs);
  const durationMs = registryDurationMs > 0
    ? registryDurationMs
    : (Number(task.duration_ms) > 0 ? Number(task.duration_ms) : 2000);
  task.duration_ms = durationMs;

  // Atomic claim. This prevents duplicate execution, but started_at is written
  // only after the helper emits STARTED, keeping OBS synchronized with the effect.
  try {
    await setTaskStatus(task.id, 'processing', null, true, durationMs);
  } catch (err) {
    log(`⚠️ Пропуск задачи ${task.id.substring(0,8)}: ${err.message}`);
    return;
  }

  try {
    const cmdId = task.id;
    const actionType = task.action_type;

    log(`⏳ Запуск действия ${actionType} (${durationMs}ms)...`);

    if (actionType === 'play_sound') {
      await markTaskStarted(task.id, durationMs);
      await sleep(durationMs);
    } else {
      const command = sendCmd(cmdId, actionType, durationMs);
      await command.started;
      try {
        await markTaskStarted(task.id, durationMs);
      } catch (startErr) {
        console.warn(`[WARN] Не удалось синхронизировать started_at: ${startErr.message}`);
      }
      await command.finished;
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

async function poll() {
  if (running) return;
  running = true;
  try {
    const task = await apiGetTask();
    if (task) await executeTask(task);
  } catch (err) {
    if (!err.message?.includes('ECONNREFUSED')) console.error('[poll error]', err.message);
  } finally {
    running = false;
    setTimeout(poll, POLL_MS);
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
  log(`🚀 Агент запущен. REST polling напрямую в Supabase каждые ${POLL_MS}ms...`);
  log('Нажми Ctrl+C для остановки\n');
  setTimeout(poll, POLL_MS);
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
