import fs from 'fs';
import { execFileSync } from 'child_process';

const agentPath = 'scripts/cs2-agent.js';
const actionsPath = 'src/lib/cs2-actions.ts';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function replaceOnce(source, search, replacement, label) {
  const first = source.indexOf(search);
  if (first === -1) throw new Error(`Patch target not found: ${label}`);
  if (source.indexOf(search, first + search.length) !== -1) {
    throw new Error(`Patch target is ambiguous: ${label}`);
  }
  return source.slice(0, first) + replacement + source.slice(first + search.length);
}

function replaceRegexOnce(source, regex, replacement, label) {
  const matches = [...source.matchAll(new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g'))];
  if (matches.length !== 1) throw new Error(`Expected exactly one match for ${label}, got ${matches.length}`);
  return source.replace(regex, replacement);
}

let agent = read(agentPath);
let actions = read(actionsPath);

agent = replaceOnce(
  agent,
  'const AGENT_VERSION = "2.0.2";',
  'const AGENT_VERSION = "2.0.3";',
  'agent version 2.0.2 -> 2.0.3',
);

for (const flag of ['BlockJumpActive', 'BlockCrouchActive', 'PacifistActive', 'FreezeActive']) {
  agent = replaceOnce(
    agent,
    `    public bool ${flag} = false;`,
    `    public volatile bool ${flag} = false;`,
    `volatile ${flag}`,
  );
}

agent = replaceOnce(
  agent,
  `            bool isInjected = (ms.dwExtraInfo == INJECTED_TAG) || ((ms.flags & LLMHF_INJECTED) != 0);\n            \n            if (!isInjected)`,
  `            // Only input emitted by this helper may bypass Pacifist.\n            // Some gaming-mouse software marks real clicks as LLMHF_INJECTED,\n            // so treating every injected event as trusted made blocking intermittent.\n            bool isOwnInjected = ms.dwExtraInfo == INJECTED_TAG;\n            \n            if (!isOwnInjected)`,
  'mouse own-injected detection',
);

agent = replaceOnce(
  agent,
  `                if (PacifistActive && IsCs2Foreground() && (wm == 0x0201 || wm == 0x0202)) // LBUTTONDOWN / LBUTTONUP`,
  `                if (PacifistActive && IsCs2Foreground() && (wm == 0x0201 || wm == 0x0202 || wm == 0x0203)) // LBUTTONDOWN / LBUTTONUP / DBLCLK`,
  'pacifist low-level mouse messages',
);

agent = replaceOnce(
  agent,
  `                        uint ulExtra = (uint)Marshal.ReadInt32(pData, headerSize + 20);\n                        \n                        if (ulExtra != (uint)INJECTED_TAG.ToInt32() && (lLastX != 0 || lLastY != 0))`,
  `                        uint ulExtra = (uint)Marshal.ReadInt32(pData, headerSize + 20);\n                        ushort buttonFlags = (ushort)Marshal.ReadInt16(pData, headerSize + 4);\n\n                        // Raw Input can bypass WH_MOUSE_LL in some CS2/mouse-driver setups.\n                        // Immediately release every physical left-button down as a second layer.\n                        if (PacifistActive && IsCs2Foreground() && (buttonFlags & 0x0001) != 0) {\n                            SendMouseClick(false);\n                        }\n                        \n                        if (ulExtra != (uint)INJECTED_TAG.ToInt32() && (lLastX != 0 || lLastY != 0))`,
  'raw-input pacifist fallback',
);

agent = replaceOnce(
  agent,
  '    void FlashScreen(string cmdId)',
  '    void FlashScreen(string cmdId, int durationMs)',
  'flash signature',
);

agent = replaceOnce(
  agent,
  '            Application.Run(new FlashApplicationContext(flashForm, cmdId, this));',
  '            Application.Run(new FlashApplicationContext(flashForm, cmdId, this, durationMs));',
  'flash context invocation',
);

const flashContext = `    class FlashApplicationContext : ApplicationContext {
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
    }`;

agent = replaceRegexOnce(
  agent,
  /    class FlashApplicationContext : ApplicationContext \{[\s\S]*?^    \}\n\n    void ProcessCommand/m,
  `${flashContext}\n\n    void ProcessCommand`,
  'strong flash context',
);

const pacifistBlock = `            else if (actionType == "pacifist") {
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
            else if (actionType == "flash_screen")`;

agent = replaceRegexOnce(
  agent,
  /            else if \(actionType == "pacifist"\) \{[\s\S]*?^            \}\n            else if \(actionType == "flash_screen"\)/m,
  pacifistBlock,
  'pacifist execution block',
);

agent = replaceOnce(
  agent,
  '                FlashScreen(cmdId);',
  '                FlashScreen(cmdId, durationMs);',
  'flash call with duration',
);

actions = replaceRegexOnce(
  actions,
  /(play_sound:\s*\{[\s\S]*?durationMs:\s*)5000(,)/,
  '$12000$2',
  'play_sound duration 2 seconds',
);

actions = replaceOnce(
  actions,
  "    description: 'Воспроизводит звуковой эффект.',",
  "    description: 'Воспроизводит звук; уведомление показывается 2 секунды.',",
  'play_sound description',
);

actions = replaceOnce(
  actions,
  "    description: 'Белая вспышка на оверлее на 1 секунду.',",
  "    description: 'Сильная белая вспышка поверх окна CS2 на 2 секунды.',",
  'flash description',
);

fs.writeFileSync(agentPath, agent, 'utf8');
fs.writeFileSync(actionsPath, actions, 'utf8');

execFileSync(process.execPath, ['scripts/generate-cs2-agent-module.mjs'], { stdio: 'inherit' });
console.log('CS2 final polish applied and generated files refreshed.');
