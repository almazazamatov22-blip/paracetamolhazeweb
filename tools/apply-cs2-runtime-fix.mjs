import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const root = process.cwd();

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, 'utf8');
  console.log(`[write] ${rel}`);
}

function replaceOnce(content, search, replacement, label) {
  const index = typeof search === 'string' ? content.indexOf(search) : content.search(search);
  if (index < 0) throw new Error(`Patch target not found: ${label}`);
  const updated = content.replace(search, replacement);
  if (updated === content) throw new Error(`Patch made no change: ${label}`);
  return updated;
}

// ---------------------------------------------------------------------------
// 1. Local agent / C# helper
// ---------------------------------------------------------------------------
const agentPath = 'scripts/cs2-agent.js';
let agent = read(agentPath);

agent = replaceOnce(
  agent,
  'const AGENT_VERSION = "2.0.1";',
  'const AGENT_VERSION = "2.0.2";',
  'agent version 2.0.2',
);

agent = replaceOnce(
  agent,
  `    IntPtr GetCs2Handle()\n    {\n        Process[] procs = Process.GetProcessesByName("cs2");\n        if (procs.Length > 0) return procs[0].MainWindowHandle;\n        return IntPtr.Zero;\n    }`,
  `    IntPtr cachedCs2Handle = IntPtr.Zero;\n\n    IntPtr GetCs2Handle()\n    {\n        if (cachedCs2Handle != IntPtr.Zero && IsWindow(cachedCs2Handle)) {\n            return cachedCs2Handle;\n        }\n\n        Process[] procs = Process.GetProcessesByName("cs2");\n        for (int i = 0; i < procs.Length; i++) {\n            IntPtr handle = procs[i].MainWindowHandle;\n            if (handle != IntPtr.Zero && IsWindow(handle)) {\n                cachedCs2Handle = handle;\n                return handle;\n            }\n        }\n\n        cachedCs2Handle = IntPtr.Zero;\n        return IntPtr.Zero;\n    }\n\n    bool IsCs2Foreground()\n    {\n        IntPtr cs2Wnd = GetCs2Handle();\n        return cs2Wnd != IntPtr.Zero && GetForegroundWindow() == cs2Wnd;\n    }`,
  'cached CS2 handle and foreground helper',
);

agent = replaceOnce(
  agent,
  'if (BlockJumpActive && kbd.vkCode == 0x20) // Space',
  'if (BlockJumpActive && IsCs2Foreground() && kbd.vkCode == 0x20) // Space',
  'jump keyboard foreground guard',
);
agent = replaceOnce(
  agent,
  'if (BlockCrouchActive && (kbd.vkCode == 0xA2 || kbd.vkCode == 0xA3 || kbd.vkCode == 0x11 || kbd.vkCode == 0x43)) // Ctrl/C',
  'if (BlockCrouchActive && IsCs2Foreground() && (kbd.vkCode == 0xA2 || kbd.vkCode == 0xA3 || kbd.vkCode == 0x11 || kbd.vkCode == 0x43)) // Ctrl/C',
  'crouch foreground guard',
);

agent = replaceOnce(
  agent,
  `            if (!isInjected)\n            {\n                if (BlockJumpActive && wm == 0x020A) // Scroll`,
  `            if (!isInjected)\n            {\n                // Suppress ordinary Windows mouse movement while CS2 freeze is active.\n                // Raw Input is compensated separately in WndProc below.\n                if (FreezeActive && IsCs2Foreground() && wm == 0x0200) // WM_MOUSEMOVE\n                {\n                    return (IntPtr)1;\n                }\n\n                if (BlockJumpActive && IsCs2Foreground() && wm == 0x020A) // Scroll`,
  'freeze mouse move + jump wheel foreground guard',
);
agent = replaceOnce(
  agent,
  'if (PacifistActive && (wm == 0x0201 || wm == 0x0202)) // LBUTTONDOWN / LBUTTONUP',
  'if (PacifistActive && IsCs2Foreground() && (wm == 0x0201 || wm == 0x0202)) // LBUTTONDOWN / LBUTTONUP',
  'pacifist foreground guard',
);

agent = replaceOnce(
  agent,
  `        SendKey(0x2A, false); // Shift\n    }`,
  `        SendKey(0x2A, false); // Shift\n        SendKey(0x2E, false); // C\n    }`,
  'release C during reset/freeze cleanup',
);

agent = replaceOnce(
  agent,
  `                    MultiplierX = 1.0;\n                    MultiplierY = 1.0;`,
  `                    MultiplierX = 1.0;\n                    MultiplierY = 1.0;\n                    SendMouseClick(false);`,
  'release LMB during RESET',
);

agent = replaceOnce(
  agent,
  `            flashForm.BackColor = Color.White;\n            flashForm.ShowInTaskbar = false;`,
  `            flashForm.BackColor = Color.White;\n            flashForm.TopMost = true;\n            flashForm.ShowInTaskbar = false;`,
  'flash TopMost',
);
agent = replaceOnce(
  agent,
  `            f.Opacity = opacity;\n            f.Show();\n            \n            fadeTimer = new System.Windows.Forms.Timer();`,
  `            f.Opacity = opacity;\n            f.Show();\n            f.TopMost = true;\n            SetWindowPos(f.Handle, HWND_TOPMOST, f.Left, f.Top, f.Width, f.Height, SWP_NOACTIVATE);\n            \n            fadeTimer = new System.Windows.Forms.Timer();`,
  'flash z-order after Show',
);

agent = replaceOnce(
  agent,
  `            Console.WriteLine("STARTED " + cmdId);\n            Console.Out.Flush();\n            \n            if (actionType == "drop_weapon") {`,
  `            Console.WriteLine("STARTED " + cmdId);\n            Console.Out.Flush();\n\n            // Give Node -> Supabase -> OBS Realtime a short head start, so the\n            // notification appears together with the actual effect.\n            Thread.Sleep(250);\n            \n            if (actionType == "drop_weapon") {`,
  'helper notification synchronization delay',
);

agent = replaceOnce(
  agent,
  `            else if (actionType == "block_jump") {\n                ThreadPool.QueueUserWorkItem(_ => {\n                    try {\n                        BlockJumpActive = true;\n                        Thread.Sleep(durationMs);\n                    } finally {\n                        BlockJumpActive = false;\n                        Console.WriteLine("FINISHED " + cmdId);`,
  `            else if (actionType == "block_jump") {\n                ThreadPool.QueueUserWorkItem(_ => {\n                    try {\n                        // Release a jump that was already held before enabling the hook.\n                        SendKey(0x39, false);\n                        BlockJumpActive = true;\n                        Thread.Sleep(durationMs);\n                    } finally {\n                        BlockJumpActive = false;\n                        SendKey(0x39, false);\n                        Console.WriteLine("FINISHED " + cmdId);`,
  'safe block_jump release',
);

agent = replaceOnce(
  agent,
  `            else if (actionType == "block_crouch") {\n                ThreadPool.QueueUserWorkItem(_ => {\n                    try {\n                        BlockCrouchActive = true;\n                        Thread.Sleep(durationMs);\n                    } finally {\n                        BlockCrouchActive = false;\n                        Console.WriteLine("FINISHED " + cmdId);`,
  `            else if (actionType == "block_crouch") {\n                ThreadPool.QueueUserWorkItem(_ => {\n                    try {\n                        // Release Ctrl/C before blocking. Otherwise a key pressed at the\n                        // activation boundary can remain logically held inside CS2.\n                        SendKey(0x1D, false); // Ctrl\n                        SendKey(0x2E, false); // C\n                        BlockCrouchActive = true;\n                        Thread.Sleep(durationMs);\n                    } finally {\n                        BlockCrouchActive = false;\n                        SendKey(0x1D, false);\n                        SendKey(0x2E, false);\n                        Console.WriteLine("FINISHED " + cmdId);`,
  'safe block_crouch release',
);

agent = replaceOnce(
  agent,
  `            else if (actionType == "pacifist") {\n                ThreadPool.QueueUserWorkItem(_ => {\n                    try {\n                        PacifistActive = true;\n                        Thread.Sleep(durationMs);\n                    } finally {\n                        PacifistActive = false;\n                        Console.WriteLine("FINISHED " + cmdId);`,
  `            else if (actionType == "pacifist") {\n                ThreadPool.QueueUserWorkItem(_ => {\n                    try {\n                        // Cancel a shot that was already held at activation time.\n                        SendMouseClick(false);\n                        PacifistActive = true;\n                        DateTime pacifistEnd = DateTime.UtcNow.AddMilliseconds(durationMs);\n                        while (DateTime.UtcNow < pacifistEnd) {\n                            SendMouseClick(false);\n                            Thread.Sleep(20);\n                        }\n                    } finally {\n                        PacifistActive = false;\n                        SendMouseClick(false);\n                        Console.WriteLine("FINISHED " + cmdId);`,
  'safe pacifist release',
);

agent = replaceOnce(
  agent,
  `            else if (actionType == "invert_mouse") {`,
  `            else if (actionType == "random_weapon_switch") {\n                // Press two distinct random weapon slots. The second slot is the final\n                // result; using two distinct slots guarantees a visible switch even\n                // when the first randomly selected slot was already active.\n                ushort[] slots = new ushort[] { 0x02, 0x03, 0x04 }; // 1, 2, 3\n                Random rnd = new Random();\n                int first = rnd.Next(0, slots.Length);\n                int second = (first + 1 + rnd.Next(0, slots.Length - 1)) % slots.Length;\n                SendKey(slots[first], true); Thread.Sleep(45); SendKey(slots[first], false);\n                Thread.Sleep(120);\n                SendKey(slots[second], true); Thread.Sleep(45); SendKey(slots[second], false);\n            }\n            else if (actionType == "invert_mouse") {`,
  'random weapon switch implementation',
);

agent = replaceOnce(
  agent,
  /function sendCmd\(cmdId, actionType, durationMs\) \{[\s\S]*?\n\}\n\n\/\/ ── Utilities ──/,
  `function sendCmd(cmdId, actionType, durationMs) {\n  if (!helperProc || !helperProc.stdin.writable) {\n    throw new Error('Helper not running');\n  }\n\n  let startResolve;\n  let startReject;\n  let finishResolve;\n  let finishReject;\n\n  const started = new Promise((resolve, reject) => {\n    startResolve = resolve;\n    startReject = reject;\n  });\n  const finished = new Promise((resolve, reject) => {\n    finishResolve = resolve;\n    finishReject = reject;\n  });\n  // Prevent an unhandled rejection when STARTED itself times out and the caller\n  // never reaches await command.finished. Awaiting it later still rejects normally.\n  finished.catch(() => {});\n\n  let didStart = false;\n  const startTimeout = setTimeout(() => {\n    if (!didStart) {\n      pendingCommands.delete(cmdId);\n      const error = new Error('Timeout waiting for STARTED');\n      startReject(error);\n      finishReject(error);\n    }\n  }, 3000);\n\n  const finishTimeout = setTimeout(() => {\n    if (pendingCommands.has(cmdId)) {\n      pendingCommands.delete(cmdId);\n      finishReject(new Error('Timeout waiting for FINISHED'));\n    }\n  }, Math.max(Number(durationMs) + 10000, 15000));\n\n  pendingCommands.set(cmdId, {\n    onStarted: () => {\n      if (didStart) return;\n      didStart = true;\n      clearTimeout(startTimeout);\n      startResolve();\n    },\n    onFinished: () => {\n      clearTimeout(startTimeout);\n      clearTimeout(finishTimeout);\n      finishResolve();\n    },\n    onError: (err) => {\n      clearTimeout(startTimeout);\n      clearTimeout(finishTimeout);\n      if (!didStart) startReject(err);\n      finishReject(err);\n    },\n  });\n\n  helperProc.stdin.write(\`COMMAND \${cmdId} \${actionType} \${durationMs}\\n\`);\n  return { started, finished };\n}\n\n// ── Utilities ──`,
  'two-phase helper command protocol',
);

agent = replaceOnce(
  agent,
  `  if (status === 'processing') {\n    body.started_at = new Date().toISOString();\n    if (Number.isFinite(Number(durationMs))) body.duration_ms = Number(durationMs);\n  } else if (status === 'done') {`,
  `  if (status === 'processing') {\n    // Claim the task first, but do not start the OBS timer until the helper\n    // confirms STARTED. markTaskStarted() writes started_at separately.\n    if (Number.isFinite(Number(durationMs))) body.duration_ms = Number(durationMs);\n  } else if (status === 'done') {`,
  'claim without early started_at',
);

agent = replaceOnce(
  agent,
  `  return data[0] || null;\n}\n\n// ── Действия ──`,
  `  return data[0] || null;\n}\n\nasync function markTaskStarted(taskId, durationMs) {\n  if (taskId.startsWith('test_')) return;\n\n  const url = \`\${supabaseUrl}/rest/v1/cs2_reward_queue?id=eq.\${encodeURIComponent(taskId)}&status=eq.processing\`;\n  const body = {\n    started_at: new Date().toISOString(),\n    duration_ms: Number(durationMs),\n  };\n\n  const result = await patchTaskStatus(url, body);\n  if (!result.res.ok) {\n    throw new Error(\`markTaskStarted failed: \${result.res.status} \${result.text}\`);\n  }\n}\n\n// ── Действия ──`,
  'markTaskStarted helper',
);

agent = replaceOnce(
  agent,
  /async function executeTask\(task\) \{[\s\S]*?\n\}\n\n\/\/ ── Polling loop \(REST polling напрямую в Supabase\) ──/,
  `async function executeTask(task) {\n  log(\`\\n▶ Задача [\${task.id.substring(0,8)}] action="\${task.action_type}" от "\${task.user_name}"\`);\n\n  const registryDurationMs = Number(actionsRegistry[task.action_type]?.durationMs);\n  const durationMs = registryDurationMs > 0\n    ? registryDurationMs\n    : (Number(task.duration_ms) > 0 ? Number(task.duration_ms) : 2000);\n  task.duration_ms = durationMs;\n\n  // Atomic claim. This prevents duplicate execution, but started_at is written\n  // only after the helper emits STARTED, keeping OBS synchronized with the effect.\n  try {\n    await setTaskStatus(task.id, 'processing', null, true, durationMs);\n  } catch (err) {\n    log(\`⚠️ Пропуск задачи \${task.id.substring(0,8)}: \${err.message}\`);\n    return;\n  }\n\n  try {\n    const cmdId = task.id;\n    const actionType = task.action_type;\n\n    log(\`⏳ Запуск действия \${actionType} (\${durationMs}ms)...\`);\n\n    if (actionType === 'play_sound') {\n      await markTaskStarted(task.id, durationMs);\n      await sleep(durationMs);\n    } else {\n      const command = sendCmd(cmdId, actionType, durationMs);\n      await command.started;\n      try {\n        await markTaskStarted(task.id, durationMs);\n      } catch (startErr) {\n        console.warn(\`[WARN] Не удалось синхронизировать started_at: \${startErr.message}\`);\n      }\n      await command.finished;\n    }\n\n    await setTaskStatus(task.id, 'done');\n    log(\`✅ Задача \${task.id.substring(0,8)} выполнена\`);\n  } catch (err) {\n    console.error(\`❌ Ошибка выполнения задачи: \${err.message}\`);\n    try {\n      await setTaskStatus(task.id, 'error', err.message);\n    } catch {}\n  }\n}\n\n// ── Polling loop (REST polling напрямую в Supabase) ──`,
  'synchronized executeTask',
);

agent = replaceOnce(
  agent,
  /let running = false;\nlet currentPollMs = 1000;\nlet emptyPollCount = 0;[\s\S]*?\n}\n\nasync function start\(\) \{/,
  `let running = false;\n\nasync function poll() {\n  if (running) return;\n  running = true;\n  try {\n    const task = await apiGetTask();\n    if (task) await executeTask(task);\n  } catch (err) {\n    if (!err.message?.includes('ECONNREFUSED')) console.error('[poll error]', err.message);\n  } finally {\n    running = false;\n    setTimeout(poll, POLL_MS);\n  }\n}\n\nasync function start() {`,
  'restore 500ms sequential polling',
);

agent = replaceOnce(
  agent,
  'log(`🚀 Агент запущен. REST polling напрямую в Supabase каждые 2500-5000ms...`);',
  'log(`🚀 Агент запущен. REST polling напрямую в Supabase каждые ${POLL_MS}ms...`);',
  'polling log',
);
agent = replaceOnce(
  agent,
  'setTimeout(poll, currentPollMs);',
  'setTimeout(poll, POLL_MS);',
  'initial polling delay',
);

write(agentPath, agent);

// ---------------------------------------------------------------------------
// 2. Queue creation: persist the canonical duration immediately
// ---------------------------------------------------------------------------
const webhookPath = 'src/app/api/cs2/webhook/route.ts';
let webhook = read(webhookPath);
webhook = replaceOnce(
  webhook,
  `import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';`,
  `import { getSupabaseServerKey, getSupabaseUrl } from '@/lib/supabase-env';\nimport { ACTION_REGISTRY } from '@/lib/cs2-actions';`,
  'webhook action registry import',
);
webhook = replaceOnce(
  webhook,
  `        reward_name: reward.name,\n        status: 'pending',`,
  `        reward_name: reward.name,\n        duration_ms: ACTION_REGISTRY[reward.action_type]?.durationMs ?? 2000,\n        status: 'pending',`,
  'webhook duration_ms insert',
);
write(webhookPath, webhook);

// ---------------------------------------------------------------------------
// 3. OBS overlay: correct duration, done fallback, reconciliation
// ---------------------------------------------------------------------------
const overlayPath = 'public/overlays/cs2.html';
let overlay = read(overlayPath);

overlay = replaceOnce(
  overlay,
  /        const seenForBanner = new Set\(\);[\s\S]*?\n        async function init\(\) \{/,
  `        const seenForBanner = new Set();\n        const seenForEffects = new Set();\n        let overlayConfig = null;\n        let reconcileInFlight = false;\n\n        function getDurationMs(ev) {\n          const registryDuration = Number(ACTION_REGISTRY[ev.action_type]?.durationMs);\n          if (registryDuration > 0) return registryDuration;\n          const eventDuration = Number(ev.duration_ms);\n          return eventDuration > 0 ? eventDuration : 2000;\n        }\n\n        function maybeShowBanner(ev) {\n          if (!ev || seenForBanner.has(ev.id)) return;\n\n          const durationMs = getDurationMs(ev);\n          const startedAt = ev.started_at ? new Date(ev.started_at).getTime() : NaN;\n          let remainingMs = Number.isFinite(startedAt)\n            ? (startedAt + durationMs) - Date.now()\n            : 0;\n\n          // A fast action can change processing -> done before OBS receives the\n          // processing event. Keep a short done fallback for those actions.\n          if (ev.status === 'done' && durationMs <= 2500) {\n            remainingMs = Math.max(remainingMs, 1800);\n          }\n\n          // A processing claim without started_at is intentionally ignored. The\n          // agent writes started_at only after the helper confirms STARTED.\n          if (ev.status === 'processing' && !Number.isFinite(startedAt)) return;\n          if (remainingMs <= 0) return;\n\n          seenForBanner.add(ev.id);\n          showBanner(ev, remainingMs, durationMs);\n        }\n\n        function handleEvent(ev) {\n          if (!ev) return;\n\n          if (ev.status === 'processing' || ev.status === 'done') {\n            maybeShowBanner(ev);\n          }\n\n          const effectHasStarted = ev.status === 'done' ||\n            (ev.status === 'processing' && Boolean(ev.started_at));\n\n          if (effectHasStarted && !seenForEffects.has(ev.id)) {\n            seenForEffects.add(ev.id);\n            if (ev.action_type === 'flash_screen') {\n              triggerFlash();\n            } else if (ev.action_type === 'play_sound') {\n              triggerStreamSound();\n            }\n          }\n        }\n\n        async function reconcileProcessing() {\n          if (!overlayConfig || reconcileInFlight) return;\n          reconcileInFlight = true;\n          try {\n            const url = \`${'${overlayConfig.supabaseUrl}'}/rest/v1/cs2_reward_queue?streamer_id=eq.${'${STREAMER_ID}'}&status=eq.processing&started_at=not.is.null&order=created_at.desc&limit=5\`;\n            const res = await fetch(url, {\n              cache: 'no-store',\n              headers: {\n                'apikey': overlayConfig.supabaseAnonKey,\n                'Authorization': \`Bearer ${'${overlayConfig.supabaseAnonKey}'}\`,\n              },\n            });\n            if (!res.ok) return;\n            const events = await res.json();\n            for (const ev of (events || [])) handleEvent(ev);\n          } catch (e) {\n            console.warn('[CS2 Overlay] Reconcile failed:', e);\n          } finally {\n            reconcileInFlight = false;\n          }\n        }\n\n        async function init() {`,
  'overlay event timing block',
);

overlay = replaceOnce(
  overlay,
  `            const cfg = await cfgRes.json();\n            ACTION_REGISTRY = cfg.actions || {};`,
  `            const cfg = await cfgRes.json();\n            overlayConfig = cfg;\n            ACTION_REGISTRY = cfg.actions || {};`,
  'overlay config reference',
);

overlay = replaceOnce(
  overlay,
  `            client.channel('public:cs2_reward_queue')\n              .on('postgres_changes', { event: '*', schema: 'public', table: 'cs2_reward_queue', filter: \`streamer_id=eq.\${STREAMER_ID}\` }, payload => {\n                handleEvent(payload.new);\n              }).subscribe();`,
  `            client.channel('public:cs2_reward_queue')\n              .on('postgres_changes', { event: '*', schema: 'public', table: 'cs2_reward_queue', filter: \`streamer_id=eq.\${STREAMER_ID}\` }, payload => {\n                handleEvent(payload.new);\n              })\n              .subscribe(status => {\n                if (status === 'SUBSCRIBED') reconcileProcessing();\n              });\n\n            // Realtime is primary. This lightweight direct-Supabase reconciliation\n            // catches very fast processing -> done transitions and reconnect gaps.\n            setInterval(reconcileProcessing, 1000);`,
  'overlay realtime reconciliation',
);

write(overlayPath, overlay);

// Regenerate the public and TypeScript copies from the canonical agent.
execFileSync(process.execPath, ['scripts/generate-cs2-agent-module.mjs'], {
  cwd: root,
  stdio: 'inherit',
});

console.log('\nCS2 runtime synchronization patch applied successfully.');
