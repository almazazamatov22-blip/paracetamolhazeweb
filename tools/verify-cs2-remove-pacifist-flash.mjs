import fs from 'node:fs';

function must(condition, message) {
  if (!condition) throw new Error(message);
}

const agent = fs.readFileSync('scripts/cs2-agent.js', 'utf8');
const publicAgent = fs.readFileSync('public/cs2-agent.js', 'utf8');
const generated = fs.readFileSync('src/generated/cs2-agent-source.ts', 'utf8');
const registry = fs.readFileSync('src/lib/cs2-actions.ts', 'utf8');
const webhook = fs.readFileSync('src/app/api/cs2/webhook/route.ts', 'utf8');

must(agent.includes('const AGENT_VERSION = "2.0.4";'), 'Agent version is not 2.0.4');
must(!/pacifist/i.test(agent), 'Pacifist still exists in agent source');
must(!/actionType:\s*['"]pacifist['"]/i.test(registry), 'Pacifist still exists in action registry');

must(agent.includes('class NoActivateFlashForm : Form'), 'NoActivateFlashForm missing');
must(agent.includes('ShowWithoutActivation'), 'ShowWithoutActivation override missing');
must(agent.includes('WS_EX_NOACTIVATE'), 'WS_EX_NOACTIVATE missing');
must(agent.includes('SW_SHOWNOACTIVATE'), 'SW_SHOWNOACTIVATE missing');
must(agent.includes('HTTRANSPARENT'), 'click-through hit testing missing');
must(!agent.includes('f.Show();'), 'Activating Form.Show() still exists in flash context');
must(agent.includes('totalMs = Math.Max(3000, durationMs);'), '3 second minimum flash missing');
must(agent.includes('holdMs = Math.Min(1200, Math.Max(1000, totalMs / 3));'), 'strong white hold missing');

must(/flash_screen:[\s\S]*?durationMs:\s*3000,/.test(registry), 'flash_screen duration is not 3000');
must(webhook.includes('Unsupported CS2 action was disabled'), 'unsupported action webhook guard missing');
must(webhook.includes('duration_ms: actionConfig.durationMs,'), 'webhook duration does not use actionConfig');

must(agent === publicAgent, 'scripts/cs2-agent.js and public/cs2-agent.js differ');
must(generated.includes('export const CS2_AGENT_VERSION = "2.0.4";'), 'generated version is not 2.0.4');

console.log('CS2 pacifist removal and no-focus flash verification passed.');
