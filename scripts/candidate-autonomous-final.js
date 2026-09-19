const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function fail(message, code = 2) {
  console.error('SEB EvalPro candidats autonomes: ' + message);
  process.exit(code);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function replaceRequired(text, oldValue, newValue, label) {
  if (!text.includes(oldValue)) fail('cible introuvable: ' + label, 3);
  return text.replace(oldValue, newValue);
}
function parseJs(text, label) {
  try { new Function(text); } catch (error) { fail(label + ': ' + error.message, 9); }
}

// -----------------------------------------------------------------------------
// MAIN : import sans regroupement manuel + catalogue candidats.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/main.js');
  let out = text;

  out = replaceRequired(
    out,
    "ipcMain.handle('admin:import-candidates', async (_event, groupName) => {",
    "ipcMain.handle('admin:import-candidates', async () => {",
    'signature import candidats'
  );
  out = out.replace("title: 'Choisir la clé USB contenant SEB EvalPro\\Candidats',", "title: 'Choisir la clé USB contenant les dossiers candidats',");
  out = replaceRequired(
    out,
    "const result = getCandidateTransfer().importAll(selection.filePaths[0], groupName);",
    "const result = getCandidateTransfer().importAll(selection.filePaths[0]);",
    'import sans nom de groupe'
  );

  const marker = "require('./session-close')({";
  if (!out.includes("require('./candidate-catalog-main')")) {
    const block = `
require('./candidate-catalog-main')({
  app,
  ipcMain,
  getAdminUnlocked: () => adminSessionUnlocked,
  getActiveCandidate: () => getCandidateStore().getActiveCandidate()
});

`;
    out = replaceRequired(out, marker, block + marker, 'branchement catalogue candidats');
  }

  if (out.includes('importAll(selection.filePaths[0], groupName)')) fail('ancien import avec regroupement encore actif', 4);
  if (!out.includes("require('./candidate-catalog-main')")) fail('catalogue backend absent', 4);
  parseJs(out, 'src/main.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// PRELOAD : bouton Ouvrir un candidat + import en un clic, sans demande de nom.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;

  if (!out.includes("const candidateCatalog = require('./candidate-catalog-preload');")) {
    out = replaceRequired(
      out,
      "const bilanHistory = require('./bilan-history-preload');",
      "const bilanHistory = require('./bilan-history-preload');\nconst candidateCatalog = require('./candidate-catalog-preload');",
      'import catalogue preload'
    );
  }

  if (!out.includes('candidateCatalog.install();')) {
    out = replaceRequired(
      out,
      "  bilanHistory.install();",
      "  bilanHistory.install();\n  candidateCatalog.install();",
      'installation catalogue preload'
    );
  }

  const groupPrompt = `    const groupName = await createTransferNameDialog();
    if (!groupName) {
      scheduleHideBar();
      return;
    }

`;
  if (out.includes(groupPrompt)) out = out.replace(groupPrompt, '');

  out = out.replace("ipcRenderer.invoke('admin:import-candidates', groupName)", "ipcRenderer.invoke('admin:import-candidates')");
  out = out.replace(
    "`${result.total} dossier(s) candidat(s) copié(s) dans « ${result.groupName} ».\\n${result.added} ajouté(s), ${result.updated} mis à jour.\\n\\nDossier : ${result.destinationRoot}`",
    "`${result.total} dossier(s) candidat(s) importé(s).\\n${result.added} ajouté(s), ${result.updated} mis à jour.\\n\\nDossier SEB EvalPro : ${result.destinationRoot}`"
  );

  if (!out.includes('candidateCatalog.install();')) fail('catalogue frontend absent', 4);
  if (out.includes("ipcRenderer.invoke('admin:import-candidates', groupName)")) fail('ancienne invocation import encore active', 4);
  parseJs(out, 'src/preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// REPLAY : à la création, copier également l'archive dans le dossier candidat.
// L'ancien dossier global reste un miroir de compatibilité et de sécurité.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/replay-main.js');
  let out = text;
  const importMarker = "const crypto = require('crypto');";
  if (!out.includes("require('./candidate-folder-utils')")) {
    out = replaceRequired(
      out,
      importMarker,
      importMarker + "\nconst { findCandidateDir, copyDirectoryIfMissing } = require('./candidate-folder-utils');",
      'utils replay candidat'
    );
  }

  const renameLine = "      fs.renameSync(tempFolder, targetFolder);";
  if (!out.includes('SEB_CANDIDATE_AUTONOMOUS_REPLAY')) {
    const mirror = `
      // SEB_CANDIDATE_AUTONOMOUS_REPLAY
      try {
        const candidateDir = findCandidateDir(app.getPath('documents'), candidate);
        if (candidateDir) {
          const autonomousReplayDir = path.join(candidateDir, 'replay');
          ensureDir(autonomousReplayDir);
          copyDirectoryIfMissing(targetFolder, path.join(autonomousReplayDir, folderName));
        }
      } catch (_) {}
`;
    out = replaceRequired(out, renameLine, renameLine + mirror, 'miroir replay candidat');
  }

  if (!out.includes('SEB_CANDIDATE_AUTONOMOUS_REPLAY')) fail('replay autonome absent', 5);
  parseJs(out, 'src/replay-main.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// BILAN : chaque original/révision est aussi copié dans bilan/historique du
// candidat. L'historique global reste intact pour compatibilité.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-main.js');
  let out = text;
  const importMarker = "const crypto = require('crypto');";
  if (!out.includes("require('./candidate-folder-utils')")) {
    out = replaceRequired(
      out,
      importMarker,
      importMarker + "\nconst { findCandidateDir, copyFileIfMissing, ensureDir } = require('./candidate-folder-utils');",
      'utils bilan candidat'
    );
  }

  const renameLine = "    fs.renameSync(temp, target);";
  if (!out.includes('SEB_CANDIDATE_AUTONOMOUS_BILAN')) {
    const mirror = `
    // SEB_CANDIDATE_AUTONOMOUS_BILAN
    try {
      const candidateDir = findCandidateDir(app.getPath('documents'), candidate);
      if (candidateDir) {
        const autonomousHistory = path.join(candidateDir, 'bilan', 'historique');
        ensureDir(autonomousHistory);
        copyFileIfMissing(target, path.join(autonomousHistory, filename));
      }
    } catch (_) {}
`;
    out = replaceRequired(out, renameLine, renameLine + mirror, 'miroir bilan candidat');
  }

  if (!out.includes('SEB_CANDIDATE_AUTONOMOUS_BILAN')) fail('bilan autonome absent', 5);
  parseJs(out, 'src/bilan-history-main.js');
  write(file, out);
}

// Permettre au nouveau catalogue d'ouvrir l'éditeur historique existant.
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;
  if (out.includes('module.exports = { install };')) {
    out = out.replace('module.exports = { install };', 'module.exports = { install, openEditor };');
  }
  if (!out.includes('module.exports = { install, openEditor };')) fail('export openEditor bilan absent', 5);
  parseJs(out, 'src/bilan-history-preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// Contrôles bloquants du nouveau modèle.
// -----------------------------------------------------------------------------
{
  const transfer = read('src/candidate-transfer-main.js').text;
  const store = read('src/candidate-store-main.js').text;
  const catalogMain = read('src/candidate-catalog-main.js').text;
  const catalogPreload = read('src/candidate-catalog-preload.js').text;
  const main = read('src/main.js').text;
  const preload = read('src/preload.js').text;
  const replay = read('src/replay-main.js').text;
  const bilan = read('src/bilan-history-main.js').text;

  const requiredTransfer = [
    'const destinationRoot = path.resolve',
    'const sourceRoot = path.resolve',
    'standardFolderName(sourceRecord.candidate)',
    'mergeDirectory(source.candidateDir, target)',
    'unmarkDeleted(documentsPath, source.candidateId)'
  ];
  for (const token of requiredTransfer) if (!transfer.includes(token)) fail('import/export simplifié incomplet: ' + token, 7);

  for (const token of [
    "sanitizeSegment(identity.groupe)",
    "const baseFolderName = buildFolderName(identity)",
    "folderName = `${baseFolderName}_${index}`"
  ]) if (!store.includes(token)) fail('nommage dossier candidat incomplet: ' + token, 7);

  for (const token of [
    "candidate-catalog:list",
    "candidate-catalog:detail",
    "candidate-catalog:delete",
    "migrateLegacyCandidateFolders",
    "syncLegacyArtifacts"
  ]) if (!catalogMain.includes(token)) fail('catalogue backend incomplet: ' + token, 7);

  for (const token of [
    'Ouvrir un candidat',
    'seb-cc-search',
    "Rechercher un nom, prénom, ville, groupe ou date",
    'Supprimer',
    'enhanceChooser',
    'seb-replay-chooser'
  ]) if (!catalogPreload.includes(token)) fail('catalogue/recherche frontend incomplet: ' + token, 7);

  if (!main.includes("require('./candidate-catalog-main')")) fail('catalogue non branché dans main', 7);
  if (!preload.includes("candidateCatalog.install();")) fail('catalogue non branché dans preload', 7);
  if (!replay.includes('SEB_CANDIDATE_AUTONOMOUS_REPLAY')) fail('replay non copié dans candidat', 7);
  if (!bilan.includes('SEB_CANDIDATE_AUTONOMOUS_BILAN')) fail('bilan non copié dans candidat', 7);

  for (const [label, source] of [
    ['candidate-folder-utils', read('src/candidate-folder-utils.js').text],
    ['candidate-transfer-main', transfer],
    ['candidate-store-main', store],
    ['candidate-catalog-main', catalogMain],
    ['candidate-catalog-preload', catalogPreload]
  ]) parseJs(source, label);
}

console.log('SEB EvalPro candidats autonomes: import/export racine USB, migration sûre, catalogue/recherche, replay et bilans intégrés au dossier candidat — OK.');
