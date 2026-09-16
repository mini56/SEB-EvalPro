const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'src', 'preload.js');

function fail(message) {
  console.error('IA locale - correction barre Admin: ' + message);
  process.exit(2);
}

let source = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const oldRefresh = `  updateAdminButtons();\n  hideBar();\n}`;
const newRefresh = `  window.__sebEvalProRefreshAdminBar = updateAdminButtons;\n  updateAdminButtons();\n  hideBar();\n}`;

if (!source.includes('window.__sebEvalProRefreshAdminBar = updateAdminButtons;')) {
  if (!source.includes(oldRefresh)) fail('point de rafraîchissement de la barre introuvable');
  source = source.replace(oldRefresh, newRefresh);
}

const oldBoot = `window.addEventListener('DOMContentLoaded', async () => {\n  adminUnlocked = await ipcRenderer.invoke('admin:status');\n  injectAdminBar();\n  document.addEventListener('input', scheduleSave, true);\n  document.addEventListener('change', scheduleSave, true);\n  document.addEventListener('click', scheduleSave, true);\n  periodicSaveTimer = setInterval(() => saveNow(false), 1000);\n});`;

const newBoot = `window.addEventListener('DOMContentLoaded', async () => {\n  // La barre doit apparaître même si une initialisation IPC secondaire tarde ou échoue.\n  injectAdminBar();\n  try {\n    adminUnlocked = !!await Promise.race([\n      ipcRenderer.invoke('admin:status'),\n      new Promise((resolve) => setTimeout(() => resolve(false), 600))\n    ]);\n  } catch (_) {\n    adminUnlocked = false;\n  }\n  if (typeof window.__sebEvalProRefreshAdminBar === 'function') {\n    window.__sebEvalProRefreshAdminBar();\n  }\n  document.addEventListener('input', scheduleSave, true);\n  document.addEventListener('change', scheduleSave, true);\n  document.addEventListener('click', scheduleSave, true);\n  periodicSaveTimer = setInterval(() => saveNow(false), 1000);\n});`;

if (!source.includes('// La barre doit apparaître même si une initialisation IPC secondaire tarde ou échoue.')) {
  if (!source.includes(oldBoot)) fail('initialisation DOM de la barre Admin introuvable');
  source = source.replace(oldBoot, newBoot);
}

if (!source.includes('injectAdminBar();\n  try {')) fail('la barre Admin n’est pas injectée avant la lecture du statut');
if (!source.includes("window.__sebEvalProRefreshAdminBar = updateAdminButtons;")) fail('rafraîchissement Admin absent');

fs.writeFileSync(file, source, 'utf8');
console.log('IA locale: barre Administrateur rendue indépendante du délai IPC et conservée sur les navigations.');
