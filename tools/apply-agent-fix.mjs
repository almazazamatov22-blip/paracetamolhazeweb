import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const agentPath = path.join(repoRoot, 'scripts', 'cs2-agent.js');
const generatorPath = path.join(repoRoot, 'scripts', 'generate-cs2-agent-module.mjs');

if (!fs.existsSync(agentPath)) {
  throw new Error(`Run this script from the repository root. Missing: ${agentPath}`);
}

let source = fs.readFileSync(agentPath, 'utf8');
const backupPath = `${agentPath}.before-cs2-fix`;
if (!fs.existsSync(backupPath)) {
  fs.writeFileSync(backupPath, source, 'utf8');
}

function replaceRequired(pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Could not find the expected ${label} block. Stop and review the current file.`);
  }
  source = source.replace(pattern, replacement);
}

if (!source.includes('const BASE_URL_RAW =')) {
  replaceRequired(
    /const BASE_URL\s*=\s*process\.env\.CS2_BASE_URL[\s\S]*?const POLL_MS\s*=\s*parseInt\([^\n]+\);/,
    `const BASE_URL_RAW = process.env.CS2_BASE_URL || args.baseUrl || 'https://paracetamolhaze.vercel.app';
const BASE_URL = String(BASE_URL_RAW).trim().replace(/\\/+$/, '');
const STREAMER_ID = String(process.env.CS2_STREAMER_ID || args.streamerId || '').trim();
const AGENT_SECRET = process.env.CS2_AGENT_SECRET || args.agentSecret || '';
const POLL_MS = parseInt(process.env.CS2_POLL_MS || args.pollMs || '500');`,
    'agent URL constants',
  );
}

source = source.replace(
  /const AGENT_VERSION\s*=\s*["']2\.0\.0["'];/,
  'const AGENT_VERSION = "2.0.1";',
);

replaceRequired(
  /async function fetchConfig\(\) \{[\s\S]*?\n\}/,
  `async function fetchConfig() {
  const url = \`${'${BASE_URL}'}/api/cs2/agent/config\`;
  const res = await fetch(url, { headers: { 'Cache-Control': 'no-cache' } });
  if (!res.ok) {
    throw new Error(\`fetchConfig failed: \${res.status} \${await res.text()}\`);
  }

  const data = await res.json();
  supabaseUrl = String(data.supabaseUrl || '').trim().replace(/\\/+$/, '');
  supabaseAnonKey = String(data.supabaseAnonKey || '').trim();
  actionsRegistry = data.actions || {};

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public configuration is incomplete');
  }
}`,
  'fetchConfig',
);

replaceRequired(
  /async function setTaskStatus\([\s\S]*?\n\}\n\n\/\/ ── Действия ──/,
  `let timingCompatibilityWarned = false;

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
      'Authorization': \`Bearer \${supabaseAnonKey}\`,
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

  let url = \`${'${supabaseUrl}'}/rest/v1/cs2_reward_queue?id=eq.\${encodeURIComponent(taskId)}\`;
  if (requirePending) url += '&status=eq.pending';

  const body = { status };
  if (errorMsg) body.error = errorMsg;
  if (status === 'processing') {
    body.started_at = new Date().toISOString();
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
    throw new Error(\`setTaskStatus failed: \${result.res.status} \${result.text}\`);
  }

  const data = Array.isArray(result.data) ? result.data : [];
  if (requirePending && data.length === 0) {
    throw new Error('Claim failed: task already claimed or invalid');
  }
  return data[0] || null;
}

// ── Действия ──`,
  'setTaskStatus',
);

replaceRequired(
  /const updatedTask = await setTaskStatus\(task\.id, 'processing', null, true\);\n\s*\/\/ Use the duration from DB if available, else fallback to registry\n\s*task\.duration_ms = updatedTask\.duration_ms \|\| \(actionsRegistry\[task\.action_type\]\?\.durationMs \?\? 2000\);/,
  `const fallbackDurationMs = Number(task.duration_ms) || Number(actionsRegistry[task.action_type]?.durationMs) || 2000;
    const updatedTask = await setTaskStatus(task.id, 'processing', null, true, fallbackDurationMs);
    task.duration_ms = Number(updatedTask?.duration_ms) || fallbackDurationMs;`,
  'task claim duration',
);

fs.writeFileSync(agentPath, source, 'utf8');
console.log(`Updated ${path.relative(repoRoot, agentPath)}`);

if (!fs.existsSync(generatorPath)) {
  throw new Error(`Missing generator: ${generatorPath}`);
}

const generated = spawnSync(process.execPath, [generatorPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (generated.status !== 0) {
  throw new Error('Agent generation failed');
}

console.log('Agent patch applied and generated files refreshed.');
