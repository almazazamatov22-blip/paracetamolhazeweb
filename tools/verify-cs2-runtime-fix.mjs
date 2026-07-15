import fs from 'fs';
import { execFileSync } from 'child_process';

function must(file, pattern, description) {
  const text = fs.readFileSync(file, 'utf8');
  const ok = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
  if (!ok) throw new Error(`${description} missing in ${file}`);
}

function mustNot(file, pattern, description) {
  const text = fs.readFileSync(file, 'utf8');
  const bad = typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
  if (bad) throw new Error(`${description} still present in ${file}`);
}

must('scripts/cs2-agent.js', 'const AGENT_VERSION = "2.0.2";', 'agent version');
must('scripts/cs2-agent.js', 'duration_ms: Number(durationMs)', 'started timing write');
must('scripts/cs2-agent.js', 'const command = sendCmd(cmdId, actionType, durationMs);', 'two-phase command');
must('scripts/cs2-agent.js', 'await command.started;', 'STARTED synchronization');
must('scripts/cs2-agent.js', 'setTimeout(poll, POLL_MS);', '500ms sequential polling');
mustNot('scripts/cs2-agent.js', '2500-5000ms', 'old polling backoff log');
must('scripts/cs2-agent.js', 'actionType == "random_weapon_switch"', 'random weapon action');
must('scripts/cs2-agent.js', 'BlockCrouchActive && IsCs2Foreground()', 'crouch foreground protection');
must('scripts/cs2-agent.js', 'PacifistActive && IsCs2Foreground()', 'pacifist foreground protection');
must('scripts/cs2-agent.js', 'SendKey(0x2E, false); // C', 'C release');
must('scripts/cs2-agent.js', 'Thread.Sleep(250);', 'OBS synchronization delay');

must('src/app/api/cs2/webhook/route.ts', "import { ACTION_REGISTRY } from '@/lib/cs2-actions';", 'webhook registry import');
must('src/app/api/cs2/webhook/route.ts', 'duration_ms: ACTION_REGISTRY[reward.action_type]?.durationMs ?? 2000', 'canonical queue duration');

must('public/overlays/cs2.html', 'function maybeShowBanner(ev)', 'banner timing function');
must('public/overlays/cs2.html', "ev.status === 'done' && durationMs <= 2500", 'done fallback');
must('public/overlays/cs2.html', 'setInterval(reconcileProcessing, 1000);', 'reconciliation loop');
must('public/overlays/cs2.html', 'registryDuration > 0', 'registry-first duration');

must('public/cs2-agent.js', 'const AGENT_VERSION = "2.0.2";', 'generated public agent');
must('src/generated/cs2-agent-source.ts', '2.0.2', 'generated TS agent');

execFileSync(process.execPath, ['--check', 'scripts/cs2-agent.js'], { stdio: 'inherit' });
console.log('CS2 runtime fix verification passed.');
