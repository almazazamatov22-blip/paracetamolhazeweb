import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const agentFile = path.resolve('scripts/cs2-agent.js');
const outDir = path.resolve('src/generated');
const outFileTs = path.join(outDir, 'cs2-agent-source.ts');
const publicDir = path.resolve('public');
const outFilePublic = path.join(publicDir, 'cs2-agent.js');

if (!fs.existsSync(agentFile)) {
  console.error(`Source file not found: ${agentFile}`);
  process.exit(1);
}

const content = fs.readFileSync(agentFile, 'utf-8');

// Extract Version
const versionMatch = content.match(/const AGENT_VERSION\s*=\s*['"]([^'"]+)['"]/);
const version = versionMatch ? versionMatch[1] : 'unknown';

// Calculate SHA-256
const sha256 = crypto.createHash('sha256').update(content).digest('hex');
const sourceLength = Buffer.byteLength(content, 'utf8');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write the TS module
const tsContent = `// AUTO-GENERATED FILE. DO NOT EDIT.
export const CS2_AGENT_SOURCE = ${JSON.stringify(content)};
export const CS2_AGENT_VERSION = ${JSON.stringify(version)};
export const CS2_AGENT_SHA256 = ${JSON.stringify(sha256)};
export const CS2_AGENT_SOURCE_LENGTH = ${sourceLength};
`;

fs.writeFileSync(outFileTs, tsContent, 'utf-8');
console.log(`Generated ${outFileTs} (Version: ${version}, SHA256: ${sha256})`);

// Write the public file
fs.writeFileSync(outFilePublic, content, 'utf-8');
console.log(`Copied source to ${outFilePublic}`);
