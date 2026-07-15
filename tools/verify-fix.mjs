import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const batRoute = read('src/app/api/cs2/agent/download-bat/route.ts');
const updaterRoute = read('src/app/api/cs2/agent/updater/route.ts');
const agent = read('scripts/cs2-agent.js');
const generated = read('src/generated/cs2-agent-source.ts');
const publicAgent = read('public/cs2-agent.js');

const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(!batRoute.includes('echo set BASE_URL='), 'BAT route still contains unsafe echo set BASE_URL');
expect(!batRoute.includes('echo set UPDATER_URL='), 'BAT route still contains unsafe echo set UPDATER_URL');
expect(batRoute.includes('copy /y "%~f0" "start.bat"'), 'Installer does not copy the self-updating BAT to start.bat');
expect(batRoute.includes('set "BASE_URL='), 'Installer does not use quoted BASE_URL assignment');
expect(updaterRoute.includes("$BaseUrl = $BaseUrl.Trim().TrimEnd('/')"), 'Updater does not trim BaseUrl');
expect(updaterRoute.includes('Buffer.from([0xff, 0xfe])'), 'Updater is not emitted with UTF-16LE BOM');
expect(agent.includes('const AGENT_VERSION = "2.0.1";'), 'Agent version is not 2.0.1');
expect(agent.includes('Using compatibility mode'), 'Agent lacks PostgREST schema-cache compatibility mode');
expect(generated.includes('export const CS2_AGENT_VERSION = "2.0.1"'), 'Generated TS agent version is stale');
expect(publicAgent.includes('const AGENT_VERSION = "2.0.1";'), 'Public agent version is stale');

if (failures.length) {
  console.error('Verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('CS2 delivery fix verification passed.');
