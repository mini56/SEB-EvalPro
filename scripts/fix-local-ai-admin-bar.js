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

const oldBootPrefix = `window.addEventListener('DOMContentLoaded', async () => {\n  adminUnlocked = await ipcRenderer.invoke('admin:status');\n  injectAdminBar();`;
const newBootPrefix = `window.addEventListener('DOMContentLoaded', async () => {\n  // La barre doit apparaître immédiatement, indépendamment du délai IPC.\n  injectAdminBar();\n  try {\n    adminUnlocked = !!await Promise.race([\n      ipcRenderer.invoke('admin:status'),\n      new Promise((resolve) => setTimeout(() => resolve(adminUnlocked), 600))\n    ]);\n  } catch (_) {}\n  if (typeof window.__sebEvalProRefreshAdminBar === 'function') {\n    window.__sebEvalProRefreshAdminBar();\n  }`;

if (!source.includes('// La barre doit apparaître immédiatement, indépendamment du délai IPC.')) {
  if (!source.includes(oldBootPrefix)) fail('préfixe DOM de la barre Admin introuvable');
  source = source.replace(oldBootPrefix, newBootPrefix);
}

if (!source.includes('// La barre doit apparaître immédiatement, indépendamment du délai IPC.')) fail('garde d’affichage immédiat absente');
if (!source.includes('injectAdminBar();\n  try {')) fail('la barre Admin n’est pas injectée avant la lecture du statut');
if (!source.includes('window.__sebEvalProRefreshAdminBar = updateAdminButtons;')) fail('rafraîchissement Admin absent');

fs.writeFileSync(file, source, 'utf8');
console.log('IA locale: barre Administrateur injectée immédiatement et statut Admin resynchronisé après IPC.');
