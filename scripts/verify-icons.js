const fs = require('fs');
const path = require('path');

const actionsFile = path.join(__dirname, '..', 'src', 'lib', 'cs2-actions.ts');
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(actionsFile)) {
  console.error('[ERROR] Cannot find cs2-actions.ts');
  process.exit(1);
}

const content = fs.readFileSync(actionsFile, 'utf8');
const actionTypeRegex = /actionType:\s*['"]([^'"]+)['"]/g;
let match;
const actions = [];

while ((match = actionTypeRegex.exec(content)) !== null) {
  actions.push(match[1]);
}

if (actions.length === 0) {
  console.error('[ERROR] No actions found in cs2-actions.ts');
  process.exit(1);
}

let hasError = false;

actions.forEach((type) => {
  const pngPath = path.join(ICONS_DIR, `${type}.png`);
  const zipPath = path.join(ICONS_DIR, `${type}.zip`);

  if (!fs.existsSync(pngPath)) {
    console.error(`[ERROR] Missing PNG icon for action: ${type} -> expected at public/icons/${type}.png`);
    hasError = true;
  }

  if (!fs.existsSync(zipPath)) {
    console.error(`[ERROR] Missing ZIP archive for action: ${type} -> expected at public/icons/${type}.zip`);
    hasError = true;
  }
});

if (hasError) {
  console.error('[ERROR] Icon verification failed. Build cannot continue until all icons are present.');
  process.exit(1);
}

console.log('[OK] All required icons (PNG and ZIP) exist in public/icons/.');
