const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const preloadPath = path.join(root, 'src', 'preload.js');
if (!fs.existsSync(preloadPath)) {
  console.error('SEB EvalPro affichage: src/preload.js introuvable.');
  process.exit(2);
}

let text = fs.readFileSync(preloadPath, 'utf8').replace(/\r\n/g, '\n');

// La page principale conserve une gouttière stable, mais ne force plus une
// scrollbar permanente. Le scroll de fond sera verrouillé uniquement pendant
// l'ouverture des fenêtres administrateur modales.
const oldCss = `    html{box-sizing:border-box}\n    body{padding-top:0 !important;box-sizing:border-box}`;
const newCss = `    html{box-sizing:border-box;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}\n    body{padding-top:0 !important;box-sizing:border-box;overflow-x:hidden}`;

if (!text.includes(oldCss)) {
  console.error('SEB EvalPro affichage: CSS shell attendu introuvable.');
  process.exit(3);
}
text = text.replace(oldCss, newCss);

// Chromium peut conserver une ancienne position scrollX après un changement de
// page. On neutralise uniquement cette position horizontale, sans toucher au
// défilement vertical normal.
const marker = `  updateAdminButtons();\n  hideBar();\n}`;
const replacement = `  updateAdminButtons();\n  hideBar();\n\n  const lockHorizontalPosition = () => {\n    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);\n  };\n  window.addEventListener('scroll', lockHorizontalPosition, { passive: true });\n  window.addEventListener('resize', lockHorizontalPosition, { passive: true });\n  setTimeout(lockHorizontalPosition, 0);\n}`;

if (!text.includes(marker)) {
  console.error('SEB EvalPro affichage: point de verrouillage horizontal introuvable.');
  process.exit(4);
}
text = text.replace(marker, replacement);
fs.writeFileSync(preloadPath, text, 'utf8');

// ---------------------------------------------------------------------------
// Fenêtres Admin "Ouvrir un ancien bilan" : une seule scrollbar verticale.
// Le bug provenait de la scrollbar de la page principale qui restait active
// derrière la scrollbar propre du sélecteur / éditeur historique.
// ---------------------------------------------------------------------------
const historyPath = path.join(root, 'src', 'bilan-history-preload.js');
if (!fs.existsSync(historyPath)) {
  console.error('SEB EvalPro affichage: src/bilan-history-preload.js introuvable.');
  process.exit(5);
}

let history = fs.readFileSync(historyPath, 'utf8').replace(/\r\n/g, '\n');

function replaceHistory(search, replacement, label) {
  if (!history.includes(search)) {
    console.error(`SEB EvalPro affichage Admin: cible introuvable pour ${label}.`);
    process.exit(6);
  }
  history = history.replace(search, replacement);
}

const chooserMarker = 'async function openChooser() {';
if (!history.includes('// SEB_ADMIN_MODAL_SCROLL_LOCK')) {
  const helpers = `// SEB_ADMIN_MODAL_SCROLL_LOCK\nlet sebAdminModalDepth = 0;\nlet sebAdminScrollSnapshot = null;\n\nfunction lockAdminBackgroundScroll() {\n  const html = document.documentElement;\n  const body = document.body;\n  if (!html || !body) return;\n  sebAdminModalDepth += 1;\n  if (sebAdminModalDepth !== 1) return;\n  sebAdminScrollSnapshot = {\n    htmlOverflow: html.style.overflow,\n    htmlOverflowY: html.style.overflowY,\n    htmlOverflowX: html.style.overflowX,\n    bodyOverflow: body.style.overflow,\n    bodyOverflowY: body.style.overflowY,\n    bodyOverflowX: body.style.overflowX\n  };\n  // scrollbar-gutter:stable sur <html> conserve la largeur utile pendant le verrouillage.\n  html.style.overflow = 'hidden';\n  body.style.overflow = 'hidden';\n}\n\nfunction unlockAdminBackgroundScroll() {\n  if (sebAdminModalDepth <= 0) return;\n  sebAdminModalDepth -= 1;\n  if (sebAdminModalDepth !== 0) return;\n  const html = document.documentElement;\n  const body = document.body;\n  const snap = sebAdminScrollSnapshot || {};\n  if (html) {\n    html.style.overflow = snap.htmlOverflow || '';\n    html.style.overflowY = snap.htmlOverflowY || '';\n    html.style.overflowX = snap.htmlOverflowX || '';\n  }\n  if (body) {\n    body.style.overflow = snap.bodyOverflow || '';\n    body.style.overflowY = snap.bodyOverflowY || '';\n    body.style.overflowX = snap.bodyOverflowX || '';\n  }\n  sebAdminScrollSnapshot = null;\n}\n\nfunction closeAdminHistoryOverlay(overlay) {\n  if (overlay && overlay.isConnected) overlay.remove();\n  unlockAdminBackgroundScroll();\n}\n\n`;
  if (!history.includes(chooserMarker)) {
    console.error('SEB EvalPro affichage Admin: fonction openChooser introuvable.');
    process.exit(7);
  }
  history = history.replace(chooserMarker, helpers + chooserMarker);
}

replaceHistory(
  `  const existing = document.getElementById('seb-bilan-history-chooser');\n  if (existing) existing.remove();`,
  `  const existing = document.getElementById('seb-bilan-history-chooser');\n  if (existing) closeAdminHistoryOverlay(existing);`,
  'fermeture ancien sélecteur'
);

replaceHistory(
  `  document.body.appendChild(overlay);\n  overlay.querySelector('#seb-bh-close').addEventListener('click', () => overlay.remove());\n  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') overlay.remove(); });`,
  `  document.body.appendChild(overlay);\n  lockAdminBackgroundScroll();\n  overlay.querySelector('#seb-bh-close').addEventListener('click', () => closeAdminHistoryOverlay(overlay));\n  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAdminHistoryOverlay(overlay); });`,
  'verrouillage du sélecteur historique'
);

replaceHistory(
  `          overlay.remove();\n          openEditor(result.filename, result.archive);`,
  `          openEditor(result.filename, result.archive);\n          closeAdminHistoryOverlay(overlay);`,
  'transition sélecteur vers éditeur'
);

replaceHistory(
  `function openEditor(filename, archive) {\n  const existing = document.getElementById('seb-bilan-history-editor');\n  if (existing) existing.remove();`,
  `function openEditor(filename, archive) {\n  const existing = document.getElementById('seb-bilan-history-editor');\n  if (existing) closeAdminHistoryOverlay(existing);`,
  'fermeture ancien éditeur'
);

replaceHistory(
  `  document.body.appendChild(overlay);\n  const card = overlay.querySelector('.seb-bh-editor-card');`,
  `  document.body.appendChild(overlay);\n  lockAdminBackgroundScroll();\n  const card = overlay.querySelector('.seb-bh-editor-card');`,
  'verrouillage éditeur historique'
);

replaceHistory(
  `  overlay.querySelector('#seb-bh-editor-close').addEventListener('click', () => overlay.remove());`,
  `  overlay.querySelector('#seb-bh-editor-close').addEventListener('click', () => closeAdminHistoryOverlay(overlay));\n  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAdminHistoryOverlay(overlay); });`,
  'fermeture éditeur historique'
);

// Le conteneur modal est le seul élément qui doit défiler verticalement.
// Aucune scrollbar horizontale ne doit apparaître dans l'éditeur Admin.
replaceHistory(
  `.seb-bh-body{padding:15px;overflow:auto;background:#f5f7fb}`,
  `.seb-bh-body{padding:15px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;background:#f5f7fb;min-width:0}`,
  'scroll unique du sélecteur'
);

replaceHistory(
  `.seb-bh-editor-body{flex:1;overflow:auto;padding:16px;background:#fff}`,
  `.seb-bh-editor-body{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;padding:16px;background:#fff}`,
  'scroll unique de l éditeur'
);

replaceHistory(
  `.seb-bh-table th,.seb-bh-table td{border:1px solid #000;padding:5px;vertical-align:top}`,
  `.seb-bh-table th,.seb-bh-table td{border:1px solid #000;padding:5px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}`,
  'prévention débordement horizontal du tableau'
);

for (const token of [
  'overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable',
  '// SEB_ADMIN_MODAL_SCROLL_LOCK',
  "html.style.overflow = 'hidden';",
  "body.style.overflow = 'hidden';",
  'closeAdminHistoryOverlay(overlay)',
  '.seb-bh-editor-body{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable'
]) {
  if (!history.includes(token) && !text.includes(token)) {
    console.error('SEB EvalPro affichage Admin: contrôle final absent: ' + token);
    process.exit(8);
  }
}

fs.writeFileSync(historyPath, history, 'utf8');
console.log('SEB EvalPro: bug Admin corrigé — la page de fond est verrouillée pendant les fenêtres historiques; une seule scrollbar verticale reste active; plus de tremblement gauche/droite.');
