import fs from 'fs';

function read(path) {
  if (!fs.existsSync(path)) throw new Error(`Missing file: ${path}`);
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Verification failed: ${label}`);
}

const agent = read('scripts/cs2-agent.js');
const publicAgent = read('public/cs2-agent.js');
const generated = read('src/generated/cs2-agent-source.ts');
const actions = read('src/lib/cs2-actions.ts');

requireText(agent, 'const AGENT_VERSION = "2.0.3";', 'agent version 2.0.3');
requireText(agent, 'public volatile bool PacifistActive = false;', 'volatile pacifist flag');
requireText(agent, 'bool isOwnInjected = ms.dwExtraInfo == INJECTED_TAG;', 'only helper input bypasses pacifist');
requireText(agent, 'wm == 0x0201 || wm == 0x0202 || wm == 0x0203', 'all left button messages blocked');
requireText(agent, 'ushort buttonFlags = (ushort)Marshal.ReadInt16(pData, headerSize + 4);', 'raw input button fallback');
requireText(agent, 'Thread.Sleep(5);', 'rapid mouse-up fallback');
requireText(agent, 'void FlashScreen(string cmdId, int durationMs)', 'flash receives duration');
requireText(agent, 'holdMs = Math.Min(700, Math.Max(500, totalMs / 3));', 'strong flash hold');
requireText(agent, 'FlashScreen(cmdId, durationMs);', 'flash call passes duration');
requireText(actions, 'durationMs: 2000,', '2-second action exists');
requireText(actions, "description: 'Воспроизводит звук; уведомление показывается 2 секунды.'", 'sound notification description');
requireText(actions, "description: 'Сильная белая вспышка поверх окна CS2 на 2 секунды.'", 'strong flash description');
requireText(generated, 'export const CS2_AGENT_VERSION = "2.0.3";', 'generated version 2.0.3');

if (agent !== publicAgent) throw new Error('Verification failed: public/cs2-agent.js differs from scripts/cs2-agent.js');

console.log('CS2 final polish verification passed.');
