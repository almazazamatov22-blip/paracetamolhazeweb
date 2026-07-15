import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function write(path, content) {
  fs.writeFileSync(path, content, 'utf8');
}

function replaceOnce(source, pattern, replacement, label) {
  const next = source.replace(pattern, replacement);
  if (next === source) throw new Error(`Patch not applied: ${label}`);
  return next;
}

const agentPath = 'scripts/cs2-agent.js';
let agent = read(agentPath);

// Version.
agent = replaceOnce(
  agent,
  /const AGENT_VERSION = "2\.0\.5";/,
  'const AGENT_VERSION = "2.0.6";',
  'agent version 2.0.6'
);

// Add the Win32 helpers needed to make the flash a visible owned window
// without activating it.
agent = replaceOnce(
  agent,
  /\[DllImport\("user32\.dll"\)\]\r?\n    static extern bool ShowWindow\(IntPtr hWnd, int nCmdShow\);\r?\n/,
  `[DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    static extern bool UpdateWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
    static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
    static extern IntPtr SetWindowLongPtr32(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    static IntPtr SetWindowLongPtrSafe(IntPtr hWnd, int nIndex, IntPtr value)
    {
        return IntPtr.Size == 8
            ? SetWindowLongPtr64(hWnd, nIndex, value)
            : SetWindowLongPtr32(hWnd, nIndex, value);
    }

`,
  'Win32 flash helpers'
);

agent = replaceOnce(
  agent,
  /const int SW_SHOWNOACTIVATE = 4;\r?\n    const uint SWP_SHOWWINDOW = 0x0040;/,
  `const int SW_SHOWNOACTIVATE = 4;
    const int GWL_HWNDPARENT = -8;
    const uint SWP_SHOWWINDOW = 0x0040;`,
  'GWL_HWNDPARENT constant'
);

// Replace the body of the STA flash thread. The key change is using
// WinForms Show() so the framework marks the form visible and paints it.
// ShowWithoutActivation + WS_EX_NOACTIVATE prevents focus stealing.
// Making the form owned by CS2 keeps it above the game window.
const replacement = String.raw`        Thread flashThread = new Thread(() => {
            try {
                NoActivateFlashForm flashForm = new NoActivateFlashForm();
                activeFlashForm = flashForm;
                flashForm.FormBorderStyle = FormBorderStyle.None;
                flashForm.StartPosition = FormStartPosition.Manual;
                flashForm.BackColor = Color.White;
                flashForm.ShowInTaskbar = false;
                flashForm.Location = new Point(pt.X, pt.Y);
                flashForm.Size = new Size(rect.Width, rect.Height);
                flashForm.Opacity = 1.0;

                IntPtr foregroundBefore = GetForegroundWindow();
                IntPtr flashHandle = flashForm.Handle;

                // Make the flash an owned top-level window of CS2. Owned windows stay
                // above their owner and do not appear in Alt+Tab/taskbar.
                SetWindowLongPtrSafe(flashHandle, GWL_HWNDPARENT, cs2Wnd);

                // v2.0.5 only called native ShowWindow. WinForms still considered the
                // form hidden, so it could remain unpainted. Show() synchronizes the
                // managed Visible state; ShowWithoutActivation + WS_EX_NOACTIVATE keep
                // CS2 focused.
                flashForm.Show();

                ShowWindow(flashHandle, SW_SHOWNOACTIVATE);
                SetWindowPos(
                    flashHandle,
                    HWND_TOPMOST,
                    pt.X,
                    pt.Y,
                    rect.Width,
                    rect.Height,
                    SWP_NOACTIVATE | SWP_SHOWWINDOW
                );

                // Force the initial white frame to paint immediately.
                flashForm.Refresh();
                UpdateWindow(flashHandle);

                // Safety net: if Windows changed foreground despite NOACTIVATE,
                // immediately return foreground to the game.
                if (foregroundBefore == cs2Wnd && GetForegroundWindow() != cs2Wnd) {
                    SetForegroundWindow(cs2Wnd);
                }

                Application.Run(new FlashApplicationContext(flashForm, cmdId, this, durationMs));
            } catch (Exception ex) {
                Console.WriteLine("ERROR " + cmdId + " " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(ex.Message)));
                Console.Out.Flush();
            }
        });

        flashThread.IsBackground = true;
        flashThread.SetApartmentState(ApartmentState.STA);
        flashThread.Start();`;

agent = replaceOnce(
  agent,
  /        Thread flashThread = new Thread\(\(\) => \{[\s\S]*?        flashThread\.Start\(\);/,
  replacement,
  'visible owned flash thread'
);

write(agentPath, agent);

execFileSync(process.execPath, ['scripts/generate-cs2-agent-module.mjs'], {
  stdio: 'inherit',
});

console.log('CS2 in-game visible flash v2.0.6 patch applied.');
