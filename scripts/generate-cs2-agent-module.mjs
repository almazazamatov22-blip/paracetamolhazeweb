import fs from 'fs';
import path from 'path';

const agentFile = path.resolve('scripts/cs2-agent.js');
const outDir = path.resolve('src/generated');
const outFile = path.join(outDir, 'cs2-agent-source.ts');

if (!fs.existsSync(agentFile)) {
  console.error(`Source file not found: ${agentFile}`);
  process.exit(1);
}

const content = fs.readFileSync(agentFile, 'utf-8');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Write the content as an exported string
const tsContent = `// AUTO-GENERATED FILE. DO NOT EDIT.
export const CS2_AGENT_SOURCE = ${JSON.stringify(content)};
`;

fs.writeFileSync(outFile, tsContent, 'utf-8');
console.log(`Generated ${outFile}`);
