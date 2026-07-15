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
const overlayPath = 'public/overlays/cs2.html';

let agent = read(agentPath);
let overlay = read(overlayPath);

// 1. Version.
agent = replaceOnce(
  agent,
  /const AGENT_VERSION = "2\.0\.4";/,
  'const AGENT_VERSION = "2.0.5";',
  'agent version 2.0.5'
);

// 2. Replace the local game flash implementation.
//
// Root fixes:
// - do NOT force WS_EX_LAYERED before configuring layered alpha;
// - use a dedicated STA thread for WinForms;
// - create/show the window on that STA thread;
// - keep WS_EX_NOACTIVATE + SW_SHOWNOACTIVATE + click-through behavior.
const flashBlock = String.raw`    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    const int SW_SHOWNOACTIVATE = 4;
    const uint SWP_SHOWWINDOW = 0x0040;

    class NoActivateFlashForm : Form
    {
        const int WS_EX_TRANSPARENT = 0x00000020;
        const int WS_EX_TOOLWINDOW = 0x00000080;
        const int WS_EX_NOACTIVATE = 0x08000000;
        const int WM_NCHITTEST = 0x0084;
        const int HTTRANSPARENT = -1;

        protected override bool ShowWithoutActivation
        {
            get { return true; }
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;

                // Do not add WS_EX_LAYERED here. A manually-layered window without
                // SetLayeredWindowAttributes/UpdateLayeredWindow may be fully invisible.
                // WinForms will add layered rendering itself when Opacity drops below 1.
                cp.ExStyle |= WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
                return cp;
            }
        }

        protected override void WndProc(ref Message m)
        {
            if (m.Msg == WM_NCHITTEST)
            {
                m.Result = new IntPtr(HTTRANSPARENT);
                return;
            }
            base.WndProc(ref m);
        }
    }

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

        if (activeFlashForm != null && !activeFlashForm.IsDisposed) {
            try {
                activeFlashForm.BeginInvoke((MethodInvoker)delegate {
                    activeFlashForm.Close();
                });
            } catch {}
        }

        Thread flashThread = new Thread(() => {
            try {
                NoActivateFlashForm flashForm = new NoActivateFlashForm();
                activeFlashForm = flashForm;
                flashForm.FormBorderStyle = FormBorderStyle.None;
                flashForm.StartPosition = FormStartPosition.Manual;
                flashForm.BackColor = Color.White;
                flashForm.ShowInTaskbar = false;
                flashForm.Location = new Point(pt.X, pt.Y);
                flashForm.Size = new Size(rect.Width, rect.Height);

                // Accessing Handle creates the native window on this STA thread.
                IntPtr flashHandle = flashForm.Handle;

                // Keep CS2 foreground: show without activation and make the window
                // click-through. No Form.Show(), no Activate(), no focus stealing.
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

                Application.Run(new FlashApplicationContext(flashForm, cmdId, this, durationMs));
            } catch (Exception ex) {
                Console.WriteLine("ERROR " + cmdId + " " + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes(ex.Message)));
                Console.Out.Flush();
            }
        });

        flashThread.IsBackground = true;
        flashThread.SetApartmentState(ApartmentState.STA);
        flashThread.Start();
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
            totalMs = Math.Max(3000, durationMs);
            holdMs = Math.Min(1200, Math.Max(1000, totalMs / 3));
            startedAt = DateTime.UtcNow;

            // The first phase is an ordinary opaque white window. Once fading
            // begins, WinForms enables layered opacity automatically.
            f.Opacity = 1.0;

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
                if (f.Opacity != 1.0) f.Opacity = 1.0;
                return;
            }

            double fadeDuration = Math.Max(1.0, totalMs - holdMs);
            double progress = (elapsedMs - holdMs) / fadeDuration;
            f.Opacity = Math.Max(0.01, 1.0 - progress);
        }
    }

    void ProcessCommand`;

agent = replaceOnce(
  agent,
  /    \[DllImport\("user32\.dll"\)\]\r?\n    static extern bool ShowWindow\(IntPtr hWnd, int nCmdShow\);[\s\S]*?\r?\n    void ProcessCommand/,
  flashBlock,
  'local flash implementation'
);

// 3. Add an actual visual OBS flash layer below the notification banner.
// The existing triggerFlash() only played audio.
overlay = replaceOnce(
  overlay,
  /(\s*\/\* ── Big activation banner \(center-bottom\) ── \*\/)/,
  `
    /* ── Full-screen flash for OBS ──
       Kept below the notification banner so the notification remains visible. */
    #flash-overlay {
      position: fixed;
      inset: 0;
      background: #fff;
      opacity: 0;
      pointer-events: none;
      z-index: 5;
      will-change: opacity;
    }

$1`,
  'OBS flash CSS'
);

overlay = replaceOnce(
  overlay,
  /<body>\r?\n\s*<div id="banner-container"><\/div>/,
  `<body>
  <div id="flash-overlay"></div>
  <div id="banner-container"></div>`,
  'OBS flash element'
);

overlay = replaceOnce(
  overlay,
  /const bannerEl = document\.getElementById\('banner-container'\);/,
  `const bannerEl = document.getElementById('banner-container');
        const flashOverlayEl = document.getElementById('flash-overlay');`,
  'OBS flash element reference'
);

overlay = replaceOnce(
  overlay,
  /function triggerFlash\(\) \{\r?\n\s*flashSound\.currentTime = 0;\r?\n\s*flashSound\.play\(\)\.catch\(console\.error\);\r?\n\s*\}/,
  `let flashVisualTimer = null;
        let flashFadeTimer = null;

        function triggerFlash(durationMs = 3000) {
          flashSound.currentTime = 0;
          flashSound.play().catch(console.error);

          const totalMs = Math.max(3000, Number(durationMs) || 3000);
          const holdMs = Math.min(1200, Math.max(1000, Math.round(totalMs / 3)));
          const fadeMs = Math.max(300, totalMs - holdMs);

          if (flashVisualTimer) clearTimeout(flashVisualTimer);
          if (flashFadeTimer) clearTimeout(flashFadeTimer);

          flashOverlayEl.style.transition = 'none';
          flashOverlayEl.style.opacity = '1';

          // Force style application so repeated rewards restart the flash.
          void flashOverlayEl.offsetWidth;

          flashVisualTimer = setTimeout(() => {
            flashOverlayEl.style.transition = \`opacity \${fadeMs}ms linear\`;
            flashOverlayEl.style.opacity = '0';
          }, holdMs);

          flashFadeTimer = setTimeout(() => {
            flashOverlayEl.style.transition = 'none';
            flashOverlayEl.style.opacity = '0';
          }, totalMs + 100);
        }`,
  'OBS visual triggerFlash'
);

overlay = replaceOnce(
  overlay,
  /triggerFlash\(\);/,
  'triggerFlash(getDurationMs(ev));',
  'pass flash duration to OBS effect'
);

write(agentPath, agent);
write(overlayPath, overlay);

// Regenerate downloadable/public agent and metadata.
execFileSync(process.execPath, ['scripts/generate-cs2-agent-module.mjs'], {
  stdio: 'inherit',
});

console.log('CS2 visible flash v2.0.5 patch applied.');
