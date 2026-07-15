import fs from 'node:fs';

function must(condition, message) {
  if (!condition) throw new Error(message);
}

const agent = fs.readFileSync('scripts/cs2-agent.js', 'utf8');
const publicAgent = fs.readFileSync('public/cs2-agent.js', 'utf8');
const generated = fs.readFileSync('src/generated/cs2-agent-source.ts', 'utf8');

must(agent.includes('const AGENT_VERSION = "2.0.6";'), 'Agent version is not 2.0.6');
must(agent.includes('flashForm.Show();'), 'WinForms Show() is missing');
must(agent.includes('protected override bool ShowWithoutActivation'), 'ShowWithoutActivation missing');
must(agent.includes('WS_EX_NOACTIVATE'), 'WS_EX_NOACTIVATE missing');
must(agent.includes('SetWindowLongPtrSafe(flashHandle, GWL_HWNDPARENT, cs2Wnd);'), 'CS2 owner relationship missing');
must(agent.includes('UpdateWindow(flashHandle);'), 'Immediate paint is missing');
must(agent.includes('flashForm.Refresh();'), 'Refresh is missing');
must(agent.includes('SW_SHOWNOACTIVATE'), 'SW_SHOWNOACTIVATE missing');
must(agent.includes('SWP_NOACTIVATE | SWP_SHOWWINDOW'), 'NOACTIVATE SetWindowPos missing');
must(agent.includes('flashThread.SetApartmentState(ApartmentState.STA);'), 'STA thread missing');
must(!agent.includes('flashForm.TopMost = true;'), 'TopMost property must remain unused');
must(!agent.includes('flashForm.Activate();'), 'Activate must not be used');
must(agent.includes('SetForegroundWindow(cs2Wnd);'), 'foreground safety restoration missing');

must(agent === publicAgent, 'scripts/cs2-agent.js and public/cs2-agent.js differ');
must(generated.includes('export const CS2_AGENT_VERSION = "2.0.6";'), 'Generated agent version is not 2.0.6');

console.log('CS2 in-game visible flash v2.0.6 verification passed.');
