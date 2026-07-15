const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sourceDir = 'C:\\Users\\almaz\\Desktop\\награды';
const targetPublic = path.join(__dirname, 'public', 'icons');

if (!fs.existsSync(targetPublic)) {
  fs.mkdirSync(targetPublic, { recursive: true });
}

const map = {
  'Блок приседания': 'block_crouch',
  'Блок прыжка': 'block_jump',
  'Выбросить оружие': 'drop_weapon',
  'Высокая чувствительность': 'high_sens_10',
  'Заморозка 3 сек': 'freeze_3',
  'Заморозка 5 сек': 'freeze_5',
  'Звук хедшота': 'play_sound',
  'Инверсия мыши': 'invert_mouse',
  'Низкая чувствительность': 'low_sens_10',
  'Разворот 180': 'spin_180',
  'Случайное оружие': 'random_weapon_switch',
  'СпинБот': 'spinbot',
  'Тряска прицела': 'mouse_shake',
  'Флешка': 'flash_screen'
};

for (const [folderName, actionType] of Object.entries(map)) {
  const folderPath = path.join(sourceDir, folderName);
  if (!fs.existsSync(folderPath)) {
    console.warn(`Folder not found: ${folderPath}`);
    continue;
  }
  
  // Find the largest png (usually 112x112) to copy as the main icon
  const files = fs.readdirSync(folderPath);
  const pngs = files.filter(f => f.endsWith('.png'));
  
  // Try to find 112x112 first, else 112, else largest size based on name string length
  let bestPng = pngs.find(f => f.includes('112'));
  if (!bestPng && pngs.length > 0) {
    bestPng = pngs[0];
  }
  
  if (bestPng) {
    fs.copyFileSync(path.join(folderPath, bestPng), path.join(targetPublic, `${actionType}.png`));
  }
  
  // Create a zip of the folder
  const zipPath = path.join(targetPublic, `${actionType}.zip`);
  console.log(`Zipping ${folderPath} to ${zipPath}`);
  
  try {
    // using powershell to zip
    execSync(`powershell Compress-Archive -Path '${folderPath}\\*' -DestinationPath '${zipPath}' -Force`);
  } catch (e) {
    console.error(`Failed to zip ${folderName}: ${e.message}`);
  }
}

console.log('Done mapping icons.');
