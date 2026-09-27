const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const buildNumber = String(process.env.SEB_BUILD_LABEL || process.env.GITHUB_RUN_NUMBER || 'DEV');

function fail(message) {
  console.error('SEB EvalPro replay prototype: ' + message);
  process.exit(2);
}

function read(relativePath) {
  const file = path.join(root, relativePath);
  if (!fs.existsSync(file)) fail(`fichier introuvable: ${relativePath}`);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}

function write(file, text) {
  fs.writeFileSync(file, text, 'utf8');
}

// Brancher les backends d'archivage/replay et d'historique des bilans après
// tous les correctifs du Build #134.
{
  const { file, text } = read('src/main.js');
  let out = text;
  if (!out.includes('// SEB_CANDIDATE_REPLAY_PROTO_MAIN')) {
    const marker = "require('./session-close')({";
    const index = out.indexOf(marker);
    if (index < 0) fail('point d’insertion main.js introuvable');
    const block = `// SEB_CANDIDATE_REPLAY_PROTO_MAIN\nrequire('./replay-main')({\n  app,\n  ipcMain,\n  getAdminUnlocked: () => adminSessionUnlocked,\n  buildNumber: ${JSON.stringify(buildNumber)}\n});\nrequire('./bilan-history-main')({\n  app,\n  ipcMain,\n  getAdminUnlocked: () => adminSessionUnlocked,\n  buildNumber: ${JSON.stringify(buildNumber)}\n});\n\n`;
    out = out.slice(0, index) + block + out.slice(index);
  }
  if (!out.includes("require('./replay-main')")) fail('backend replay non branché');
  if (!out.includes("require('./bilan-history-main')")) fail('backend historique bilan non branché');
  if (!out.includes(`buildNumber: ${JSON.stringify(buildNumber)}`)) fail('numéro de build non injecté');
  write(file, out);
}

// Brancher les modules preload : captures visuelles du parcours + historique
// autonome et éditable des bilans administrateur.
{
  const { file, text } = read('src/preload.js');
  let out = text;
  if (!out.includes('// SEB_CANDIDATE_REPLAY_PROTO_PRELOAD')) {
    const importMarker = "const path = require('path');";
    if (!out.includes(importMarker)) fail('import path preload introuvable');
    out = out.replace(
      importMarker,
      `${importMarker}\nconst replayPrototype = require('./replay-preload');\nconst bilanHistory = require('./bilan-history-preload');\n// SEB_CANDIDATE_REPLAY_PROTO_PRELOAD`
    );

    const domMarker = "  injectAdminBar();";
    if (!out.includes(domMarker)) fail('point d’installation modules après injectAdminBar introuvable');
    out = out.replace(
      domMarker,
      "  injectAdminBar();\n  replayPrototype.install();\n  bilanHistory.install();"
    );
  }
  if (!out.includes("require('./replay-preload')")) fail('module replay preload non importé');
  if (!out.includes("require('./bilan-history-preload')")) fail('module historique bilan preload non importé');
  if (!out.includes('replayPrototype.install();')) fail('module replay preload non installé');
  if (!out.includes('bilanHistory.install();')) fail('module historique bilan non installé');
  write(file, out);
}

// Contrôles bloquants : replay visuel autonome + bilans historiques autonomes,
// éditables par révisions sans écraser l'original.
{
  const replayMain = read('src/replay-main.js').text;
  const replayPreload = read('src/replay-preload.js').text;
  const bilanMain = read('src/bilan-history-main.js').text;
  const bilanPreload = read('src/bilan-history-preload.js').text;
  const candidateCatalogPreload = read('src/candidate-catalog-preload.js').text;
  const requiredMain = [
    "path.join(storageRoot, 'parcours')",
    "ipcMain.handle('replay:capture-page'",
    "ipcMain.handle('replay:archive-final'",
    "ipcMain.handle('admin:list-parcours'",
    "ipcMain.handle('admin:load-parcours'",
    "ipcMain.handle('admin:get-parcours-slide'",
    "archiveMode: 'VISUAL_FROZEN_SLIDES'",
    'futureVersionIndependent: true',
    "path.join(tempFolder, 'manifest.json')",
    "path.join(tempFolder, 'slides')",
    'Archive modifiée ou corrompue : replay refusé.',
    'readOnly: true'
  ];
  const requiredPreload = [
    "final.classList.contains('visible')",
    'replay:capture-page',
    'seb_evalpro_replay_archive_file',
    'LECTURE SEULE · ARCHIVE VISUELLE FIGÉE · AUCUN RECALCUL',
    'admin:get-parcours-slide',
    'openCandidateReplay(candidateId, filename)'
  ];
  const requiredBilanMain = [
    "SEB_CANDIDATE_AUTONOMOUS_BILAN",
    "path.join(candidateDir, 'bilan', 'historique')",
    "legacyHistoryDir = path.join(root, 'Bilans', 'Historique')",
    "ipcMain.handle('bilan-history:save-current'",
    "ipcMain.handle('bilan-history:list'",
    "ipcMain.handle('bilan-history:load'",
    "ipcMain.handle('bilan-history:save-revision'",
    "type: TYPE",
    "autonomous: true",
    "editable: true",
    "immutableRevision: true"
  ];
  const requiredBilanPreload = [
    'Ouvrir un ancien bilan',
    'Enregistrer une nouvelle révision',
    'Stockage interne SEB EvalPro',
    "bilan-history:save-current",
    "bilan-history:save-revision",
    'le bilan d\'origine n\'est jamais écrasé'
  ];
  for (const token of requiredMain) if (!replayMain.includes(token)) fail('contrôle backend replay manquant: ' + token);
  for (const token of requiredPreload) if (!replayPreload.includes(token)) fail('contrôle interface replay manquant: ' + token);
  for (const token of ["open.textContent = 'Rejouer'", 'replayPreload.openCandidateReplay(candidateId, filename)']) {
    if (!candidateCatalogPreload.includes(token)) fail('Replay absent de la fiche candidat: ' + token);
  }
  if (replayPreload.includes('Rejouer un parcours') || replayPreload.includes('seb-evalpro-replay')) {
    fail('Le Replay ne doit plus être proposé comme bouton global dans la barre Admin.');
  }
  for (const token of requiredBilanMain) if (!bilanMain.includes(token)) fail('contrôle backend bilan manquant: ' + token);
  for (const token of requiredBilanPreload) if (!bilanPreload.includes(token)) fail('contrôle interface bilan manquant: ' + token);
}

console.log(`SEB EvalPro prototype: replay visuel autonome + historique de bilans éditable par révisions, Build #${buildNumber}.`);
