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

function removeOnce(source, pattern, label) {
  return replaceOnce(source, pattern, '', label);
}

const agentPath = 'scripts/cs2-agent.js';
const registryPath = 'src/lib/cs2-actions.ts';
const webhookPath = 'src/app/api/cs2/webhook/route.ts';

let agent = read(agentPath);
let registry = read(registryPath);
let webhook = read(webhookPath);

// 1. Version.
agent = replaceOnce(
  agent,
  /const AGENT_VERSION = "2\.0\.3";/,
  'const AGENT_VERSION = "2.0.4";',
  'agent version 2.0.4'
);

// 2. Remove Pacifist state.
agent = removeOnce(
  agent,
  /^\s*public volatile bool PacifistActive = false;\r?\n/m,
  'PacifistActive state'
);

// 3. Restore normal injected-event filtering now that Pacifist is gone.
agent = replaceOnce(
  agent,
  /\s*\/\/ Only input emitted by this helper may bypass Pacifist\.\r?\n\s*\/\/ Some gaming-mouse software marks real clicks as LLMHF_INJECTED,\r?\n\s*\/\/ so treating every injected event as trusted made blocking intermittent\.\r?\n\s*bool isOwnInjected = ms\.dwExtraInfo == INJECTED_TAG;\r?\n\s*\r?\n\s*if \(!isOwnInjected\)/,
  `
            bool isInjected = (ms.dwExtraInfo == INJECTED_TAG) || ((ms.flags & LLMHF_INJECTED) != 0);

            if (!isInjected)`,
  'mouse injected filtering'
);

// 4. Remove Pacifist low-level hook branch.
agent = removeOnce(
  agent,
  /\r?\n\s*if \(PacifistActive && IsCs2Foreground\(\) && \(wm == 0x0201 \|\| wm == 0x0202 \|\| wm == 0x0203\)\)[\s\S]*?\r?\n\s*\}/,
  'Pacifist mouse hook'
);

// 5. Remove Pacifist Raw Input fallback.
agent = removeOnce(
  agent,
  /\r?\n\s*ushort buttonFlags = \(ushort\)Marshal\.ReadInt16\(pData, headerSize \+ 4\);\r?\n\r?\n\s*\/\/ Raw Input can bypass WH_MOUSE_LL in some CS2\/mouse-driver setups\.\r?\n\s*\/\/ Immediately release every physical left-button down as a second layer\.\r?\n\s*if \(PacifistActive && IsCs2Foreground\(\) && \(buttonFlags & 0x0001\) != 0\) \{\r?\n\s*SendMouseClick\(false\);\r?\n\s*\}/,
  'Pacifist raw input fallback'
);

// 6. Replace the whole flash implementation with a strictly non-activating,
// click-through window. It must not take foreground focus from CS2.
const flashReplacement = String.raw`    [DllImport("user32.dll")]
    static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    const int SW_SHOWNOACTIVATE = 4;
    const uint SWP_SHOWWINDOW = 0x0040;

    class NoActivateFlashForm : Form
    {
        const int WS_EX_LAYERED = 0x00080000;
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
                cp.ExStyle |= WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE;
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
                activeFlashForm.Invoke((MethodInvoker)delegate {
                    activeFlashForm.Close();
                });
            } catch {}
        }

        ThreadPool.QueueUserWorkItem(_ => {
            NoActivateFlashForm flashForm = new NoActivateFlashForm();
            activeFlashForm = flashForm;
            flashForm.FormBorderStyle = FormBorderStyle.None;
            flashForm.StartPosition = FormStartPosition.Manual;
            flashForm.BackColor = Color.White;
            flashForm.ShowInTaskbar = false;
            flashForm.Location = new Point(pt.X, pt.Y);
            flashForm.Size = new Size(rect.Width, rect.Height);
            flashForm.Opacity = 1.0;

            // Creating and showing the window with explicit NOACTIVATE flags avoids
            // the alt-tab-like focus/cursor flash caused by Form.Show()/TopMost.
            IntPtr flashHandle = flashForm.Handle;
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

            // Slower and stronger than v2.0.3:
            // at least 1 second fully white, then a long smooth fade.
            totalMs = Math.Max(3000, durationMs);
            holdMs = Math.Min(1200, Math.Max(1000, totalMs / 3));
            startedAt = DateTime.UtcNow;

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

    void ProcessCommand`;

agent = replaceOnce(
  agent,
  /    void FlashScreen\(string cmdId, int durationMs\)[\s\S]*?\r?\n    void ProcessCommand/,
  flashReplacement,
  'non-activating flash implementation'
);

// 7. Remove Pacifist command execution.
agent = removeOnce(
  agent,
  /\r?\n\s*else if \(actionType == "pacifist"\) \{[\s\S]*?\r?\n\s*return;\r?\n\s*\}/,
  'Pacifist command branch'
);

// 8. Remove Pacifist reset.
agent = removeOnce(
  agent,
  /^\s*PacifistActive = false;\r?\n/m,
  'Pacifist reset'
);

// 9. Remove Pacifist from the public action registry.
registry = removeOnce(
  registry,
  /\s*pacifist:\s*\{\s*actionType:\s*'pacifist',[\s\S]*?\n\s*\},\r?\n/,
  'Pacifist action registry'
);

// 10. Make the flash notification/action last 3 seconds.
registry = replaceOnce(
  registry,
  /(flash_screen:\s*\{[\s\S]*?durationMs:\s*)2000(,)/,
  '$13000$2',
  'flash duration 3000'
);
registry = replaceOnce(
  registry,
  /description:\s*'Сильная белая вспышка поверх окна CS2 на 2 секунды\.'/,
  "description: 'Сильная белая вспышка: 1 секунда полной яркости и плавное затухание.'",
  'flash description'
);

// 11. Old DB rewards with removed/unknown actions must never be queued.
// Disable them internally on the first redemption and return safely.
const rewardGuardAnchor = `    if (!reward) {
      // Награда не настроена под CS2 — игнорируем
      return NextResponse.json({ ok: true });
    }
`;

const rewardGuardReplacement = `${rewardGuardAnchor}
    const actionConfig = ACTION_REGISTRY[reward.action_type];
    if (!actionConfig) {
      // The action was removed from the product (for example, pacifist).
      // Disable the stale internal mapping so it cannot keep producing no-op tasks.
      await supabase
        .from('cs2_rewards')
        .update({ enabled: false })
        .eq('id', reward.id);

      await logError(
        'cs2_webhook',
        'Unsupported CS2 action was disabled',
        { rewardId: reward.id, actionType: reward.action_type },
        'warn'
      );

      return NextResponse.json({ ok: true });
    }
`;

webhook = replaceOnce(
  webhook,
  rewardGuardAnchor,
  rewardGuardReplacement,
  'unsupported action guard'
);

webhook = replaceOnce(
  webhook,
  /duration_ms:\s*ACTION_REGISTRY\[reward\.action_type\]\?\.durationMs\s*\?\?\s*2000,/,
  'duration_ms: actionConfig.durationMs,',
  'webhook actionConfig duration'
);

write(agentPath, agent);
write(registryPath, registry);
write(webhookPath, webhook);

// Regenerate the downloadable/public copies and metadata.
execFileSync(process.execPath, ['scripts/generate-cs2-agent-module.mjs'], {
  stdio: 'inherit',
});

console.log('CS2 pacifist removal and no-focus flash patch applied.');
