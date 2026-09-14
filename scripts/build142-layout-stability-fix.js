const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro stabilité Admin: ' + message);
  process.exit(code);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

function replaceOnce(text, search, replacement, label) {
  if (!text.includes(search)) fail(`cible introuvable pour ${label}`, 3);
  return text.replace(search, replacement);
}

// -----------------------------------------------------------------------------
// 1. Shell Electron : supprimer les anciens correctifs globaux de scroll.
//    Le Build #142/#144 forçait window.scrollTo() pendant scroll/resize. Lors
//    d'un clic dans le bilan Admin, un simple reflow pouvait donc provoquer un
//    aller-retour horizontal visible. Aucun code global ne doit repositionner
//    la fenêtre pendant le travail de l'administrateur.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;

  const oldCssVariants = [
    `    html{box-sizing:border-box;overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable}\n    body{padding-top:0 !important;box-sizing:border-box;overflow-x:hidden}`,
    `    html{box-sizing:border-box;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}\n    body{padding-top:0 !important;box-sizing:border-box;overflow-x:hidden}`
  ];
  for (const oldCss of oldCssVariants) {
    if (out.includes(oldCss)) {
      out = out.replace(oldCss, `    html{box-sizing:border-box}\n    body{padding-top:0 !important;box-sizing:border-box}`);
    }
  }

  const badLock = `\n\n  const lockHorizontalPosition = () => {\n    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY);\n  };\n  window.addEventListener('scroll', lockHorizontalPosition, { passive: true });\n  window.addEventListener('resize', lockHorizontalPosition, { passive: true });\n  setTimeout(lockHorizontalPosition, 0);`;
  if (out.includes(badLock)) out = out.replace(badLock, '');

  for (const forbidden of [
    'lockHorizontalPosition',
    'window.scrollTo(0, window.scrollY)',
    'overflow-y:scroll;overflow-x:hidden;scrollbar-gutter:stable'
  ]) {
    if (out.includes(forbidden)) fail('ancien correctif global encore présent: ' + forbidden, 4);
  }

  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Bilan Admin courant : un clic ne doit modifier que l'état de la case.
//    - pas de lettre injectée dans le flux de la cellule ;
//    - pas de changement de largeur du bandeau d'état ;
//    - sauvegarde silencieuse sur clic/changement pour éviter tout reflow du
//      bandeau d'outils à chaque action.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('app/web/admin-bilan.html');
  let out = text;

  out = replaceOnce(
    out,
    '#status{margin-left:auto;font-size:10pt}',
    '#status{margin-left:auto;font-size:10pt;flex:0 0 250px;min-width:250px;text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    'largeur stable du statut Admin'
  );

  out = replaceOnce(
    out,
    '.level.on:after{content:attr(data-l);font-weight:700;font-size:14pt}',
    '.level.on:after{content:none}',
    'case de niveau sans contenu dynamique'
  );

  out = replaceOnce(out, 'function save(){', 'function save(silent=false){', 'sauvegarde Admin silencieuse');
  out = replaceOnce(
    out,
    "window.sebEvalPro?.save?.();status('Modifications enregistrées')}",
    "window.sebEvalPro?.save?.();if(!silent)status('Modifications enregistrées')}",
    'statut uniquement sur sauvegarde explicite'
  );

  out = replaceOnce(
    out,
    "document.querySelectorAll('.level').forEach(x=>x.onclick=()=>{level(x.closest('tr'),x.dataset.l);save()});",
    "document.querySelectorAll('.level').forEach(x=>x.onclick=()=>{level(x.closest('tr'),x.dataset.l);save(true)});",
    'clic niveau sans reflow de statut'
  );

  out = replaceOnce(
    out,
    "if(t)t.value=x.value;save()});",
    "if(t)t.value=x.value;save(true)});",
    'sélection commentaire sans reflow de statut'
  );

  for (const required of [
    '.level.on:after{content:none}',
    'function save(silent=false){',
    'save(true)});',
    'flex:0 0 250px'
  ]) {
    if (!out.includes(required)) fail('contrôle Bilan Admin absent: ' + required, 5);
  }

  write(file, out);
}

// -----------------------------------------------------------------------------
// 3. Ancien bilan ouvert depuis Admin : conserver une seule zone de défilement
//    sans toucher à la position de la fenêtre à chaque clic. Le verrouillage de
//    fond est appliqué uniquement pendant la présence réelle d'une modale.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  out = replaceOnce(
    out,
    `    #seb-evalpro-old-bilan{background:#f4ecff!important;color:#5a2794!important;border-color:#fff!important;font-weight:700}`,
    `    html.seb-admin-modal-open{overflow-y:hidden!important;scrollbar-gutter:stable}\n    html.seb-admin-modal-open body{overflow:hidden!important}\n    #seb-evalpro-old-bilan{background:#f4ecff!important;color:#5a2794!important;border-color:#fff!important;font-weight:700}`,
    'verrouillage visuel local des modales Admin'
  );

  out = replaceOnce(
    out,
    `.seb-bh-body{padding:15px;overflow:auto;background:#f5f7fb}`,
    `.seb-bh-body{padding:15px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;background:#f5f7fb;min-width:0}`,
    'scroll interne sélecteur historique'
  );

  out = replaceOnce(
    out,
    `.seb-bh-editor-body{flex:1;overflow:auto;padding:16px;background:#fff}`,
    `.seb-bh-editor-body{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:16px;background:#fff}`,
    'scroll interne éditeur historique'
  );

  out = replaceOnce(
    out,
    `.seb-bh-level.on:after{content:attr(data-level);font-weight:700;font-size:16px}`,
    `.seb-bh-level.on:after{content:none}`,
    'case historique sans contenu dynamique'
  );

  const chooserMarker = 'async function openChooser() {';
  if (!out.includes('// SEB_ADMIN_MODAL_CLASS_LOCK')) {
    const helper = `// SEB_ADMIN_MODAL_CLASS_LOCK\nlet sebAdminModalDepth = 0;\nfunction lockAdminModalPage() {\n  sebAdminModalDepth += 1;\n  if (sebAdminModalDepth === 1) document.documentElement.classList.add('seb-admin-modal-open');\n}\nfunction unlockAdminModalPage() {\n  if (sebAdminModalDepth <= 0) return;\n  sebAdminModalDepth -= 1;\n  if (sebAdminModalDepth === 0) document.documentElement.classList.remove('seb-admin-modal-open');\n}\nfunction closeAdminHistoryOverlay(overlay) {\n  if (overlay && overlay.isConnected) overlay.remove();\n  unlockAdminModalPage();\n}\n\n`;
    if (!out.includes(chooserMarker)) fail('fonction openChooser introuvable', 6);
    out = out.replace(chooserMarker, helper + chooserMarker);
  }

  out = replaceOnce(
    out,
    `  const existing = document.getElementById('seb-bilan-history-chooser');\n  if (existing) existing.remove();`,
    `  const existing = document.getElementById('seb-bilan-history-chooser');\n  if (existing) closeAdminHistoryOverlay(existing);`,
    'fermeture sélecteur existant'
  );

  out = replaceOnce(
    out,
    `  document.body.appendChild(overlay);\n  overlay.querySelector('#seb-bh-close').addEventListener('click', () => overlay.remove());\n  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') overlay.remove(); });`,
    `  document.body.appendChild(overlay);\n  lockAdminModalPage();\n  overlay.querySelector('#seb-bh-close').addEventListener('click', () => closeAdminHistoryOverlay(overlay));\n  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAdminHistoryOverlay(overlay); });`,
    'ouverture/fermeture sélecteur'
  );

  out = replaceOnce(
    out,
    `          overlay.remove();\n          openEditor(result.filename, result.archive);`,
    `          openEditor(result.filename, result.archive);\n          closeAdminHistoryOverlay(overlay);`,
    'transition sélecteur vers éditeur'
  );

  out = replaceOnce(
    out,
    `function openEditor(filename, archive) {\n  const existing = document.getElementById('seb-bilan-history-editor');\n  if (existing) existing.remove();`,
    `function openEditor(filename, archive) {\n  const existing = document.getElementById('seb-bilan-history-editor');\n  if (existing) closeAdminHistoryOverlay(existing);`,
    'fermeture éditeur existant'
  );

  out = replaceOnce(
    out,
    `  document.body.appendChild(overlay);\n  const card = overlay.querySelector('.seb-bh-editor-card');`,
    `  document.body.appendChild(overlay);\n  lockAdminModalPage();\n  const card = overlay.querySelector('.seb-bh-editor-card');`,
    'ouverture éditeur historique'
  );

  out = replaceOnce(
    out,
    `  overlay.querySelector('#seb-bh-editor-close').addEventListener('click', () => overlay.remove());`,
    `  overlay.querySelector('#seb-bh-editor-close').addEventListener('click', () => closeAdminHistoryOverlay(overlay));\n  overlay.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeAdminHistoryOverlay(overlay); });`,
    'fermeture éditeur historique'
  );

  for (const required of [
    '// SEB_ADMIN_MODAL_CLASS_LOCK',
    '.seb-bh-level.on:after{content:none}',
    'overscroll-behavior:contain',
    "classList.add('seb-admin-modal-open')",
    'closeAdminHistoryOverlay(overlay)'
  ]) {
    if (!out.includes(required)) fail('contrôle historique Admin absent: ' + required, 7);
  }
  for (const forbidden of ['window.scrollTo(0, window.scrollY)', 'lockHorizontalPosition']) {
    if (out.includes(forbidden)) fail('repositionnement horizontal interdit présent dans historique: ' + forbidden, 8);
  }

  write(file, out);
}

console.log('SEB EvalPro: stabilité Admin corrigée à la source — aucun scroll horizontal forcé, cases sans contenu dynamique, sauvegarde silencieuse au clic et scroll modal isolé.');
