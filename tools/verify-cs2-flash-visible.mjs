import fs from 'node:fs';

function must(condition, message) {
  if (!condition) throw new Error(message);
}

const agent = fs.readFileSync('scripts/cs2-agent.js', 'utf8');
const publicAgent = fs.readFileSync('public/cs2-agent.js', 'utf8');
const generated = fs.readFileSync('src/generated/cs2-agent-source.ts', 'utf8');
const overlay = fs.readFileSync('public/overlays/cs2.html', 'utf8');

must(agent.includes('const AGENT_VERSION = "2.0.5";'), 'Agent version is not 2.0.5');
must(agent.includes('flashThread.SetApartmentState(ApartmentState.STA);'), 'Flash is not using an STA thread');
must(agent.includes('SW_SHOWNOACTIVATE'), 'SW_SHOWNOACTIVATE missing');
must(agent.includes('WS_EX_NOACTIVATE'), 'WS_EX_NOACTIVATE missing');
must(agent.includes('ShowWithoutActivation'), 'ShowWithoutActivation missing');
must(agent.includes('HTTRANSPARENT'), 'HTTRANSPARENT missing');
must(!agent.includes('const int WS_EX_LAYERED = 0x00080000;'), 'Manual WS_EX_LAYERED still present');
must(!agent.includes('ThreadPool.QueueUserWorkItem(_ => {\n            NoActivateFlashForm'), 'Old MTA ThreadPool flash still present');
must(!agent.includes('flashForm.Show();'), 'Form.Show() must not be used');
must(!agent.includes('flashForm.TopMost = true;'), 'TopMost property must not be used');

must(overlay.includes('<div id="flash-overlay"></div>'), 'OBS flash element missing');
must(overlay.includes('#flash-overlay'), 'OBS flash CSS missing');
must(overlay.includes('z-index: 5;'), 'OBS flash must stay under banner');
must(overlay.includes('function triggerFlash(durationMs = 3000)'), 'OBS visual flash function missing');
must(overlay.includes('triggerFlash(getDurationMs(ev));'), 'OBS flash duration is not passed');
must(overlay.includes("flashOverlayEl.style.opacity = '1';"), 'OBS white phase missing');

must(agent === publicAgent, 'scripts/cs2-agent.js and public/cs2-agent.js differ');
must(generated.includes('export const CS2_AGENT_VERSION = "2.0.5";'), 'Generated agent version is not 2.0.5');

console.log('CS2 visible flash v2.0.5 verification passed.');
