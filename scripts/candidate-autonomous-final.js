const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro candidats autonomes final: ' + message);
  process.exit(code);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return { file, text: fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') };
}
function write(file, text) { fs.writeFileSync(file, text, 'utf8'); }
function parseJs(text, label) {
  try { new Function(text); } catch (error) { fail(label + ': ' + error.message, 9); }
}

// -----------------------------------------------------------------------------
// MAIN : import depuis la racine USB + branchement du catalogue candidat.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/main.js');
  let out = text;

  out = out.replace(
    "ipcMain.handle('admin:import-candidates', async (_event, groupName) => {",
    "ipcMain.handle('admin:import-candidates', async () => {"
  );
  out = out.replace(
    "title: 'Choisir la clé USB contenant SEB EvalPro\\\\Candidats',",
    "title: 'Choisir la racine de la clé USB contenant les dossiers candidats',"
  );
  out = out.replace(
    "const result = getCandidateTransfer().importAll(selection.filePaths[0], groupName);",
    "const result = getCandidateTransfer().importAll(selection.filePaths[0]);"
  );

  const marker = "require('./session-close')({";
  if (!out.includes("require('./candidate-catalog-main')")) {
    if (!out.includes(marker)) fail('ancre session-close absente dans main', 3);
    out = out.replace(marker, `require('./candidate-catalog-main')({
  app,
  ipcMain,
  getAdminUnlocked: () => adminSessionUnlocked,
  getActiveCandidate: () => getCandidateStore().getActiveCandidate()
});

` + marker);
  }

  if (out.includes("importAll(selection.filePaths[0], groupName)")) fail('ancien import par regroupement encore actif', 4);
  if (!out.includes("candidate:set-admin-export-context")) fail('contexte export Word candidat absent', 4);
  if (!out.includes('SEB_RUNTIME_OFFLINE') || !out.includes('devTools: false')) fail('verrouillage hors-ligne/DevTools absent', 4);
  if (!out.includes('SEB_CANDIDATE_CLOSE_GUARD')) fail('garde de fermeture candidat absent', 4);
  parseJs(out, 'src/main.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// PRELOAD : catalogue Admin, import sans nom de regroupement, message USB sûr.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/preload.js');
  let out = text;

  if (!out.includes("const candidateCatalog = require('./candidate-catalog-preload');")) {
    const anchor = "const bilanHistory = require('./bilan-history-preload');";
    if (!out.includes(anchor)) fail('ancre bilanHistory preload absente', 3);
    out = out.replace(anchor, anchor + "\nconst candidateCatalog = require('./candidate-catalog-preload');");
  }

  if (!out.includes('candidateCatalog.install();')) {
    const anchor = '  bilanHistory.install();';
    if (!out.includes(anchor)) fail('installation bilanHistory absente', 3);
    out = out.replace(anchor, anchor + '\n  candidateCatalog.install();');
  }

  out = out.replace(/\s*const groupName = await createTransferNameDialog\(\);[\s\S]*?if \(!groupName\) \{[\s\S]*?return;\s*\}\s*/m, '\n');
  out = out.replace("ipcRenderer.invoke('admin:import-candidates', groupName)", "ipcRenderer.invoke('admin:import-candidates')");

  for (const token of [
    'Copie des fichiers terminée.',
    'Vous pouvez retirer la clé USB en toute sécurité.',
    'déjà présent(s) et ignoré(s)',
    'Fermeture impossible'
  ]) {
    if (!out.includes(token)) fail('règle interface absente: ' + token, 4);
  }
  if (out.includes("ipcRenderer.invoke('admin:import-candidates', groupName)")) fail('ancien import frontend encore actif', 4);
  parseJs(out, 'src/preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// WORD : conserver le modèle institutionnel historique, mais écrire le Word
// courant dans le dossier exact du candidat, jamais dans le vieux Bilans global.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-main.js');
  let out = text;

  if (out.includes("function historicalWordDir() {\n    return path.join(app.getPath('documents'), 'SEB EvalPro', 'Bilans');\n  }")) {
    out = out.replace(
      "function historicalWordDir() {\n    return path.join(app.getPath('documents'), 'SEB EvalPro', 'Bilans');\n  }",
      `function historicalWordDir(candidate) {
    const candidateDir = findCandidateDir(app.getPath('documents'), normalizeCandidate(candidate));
    if (!candidateDir) throw new Error('Dossier candidat introuvable pour le document Word.');
    const directory = path.join(candidateDir, 'bilan', 'exports');
    fs.mkdirSync(directory, { recursive: true });
    return directory;
  }`
    );
  }

  out = out.replace(
    'function historicalWordPath(filename) {\n    const directory = historicalWordDir();',
    'function historicalWordPath(filename, candidate) {\n    const directory = historicalWordDir(candidate);'
  );
  out = out.replace(
    'function cleanupLegacyHistoricalWords(filename) {\n    const directory = historicalWordDir();',
    'function cleanupLegacyHistoricalWords(filename, candidate) {\n    const directory = historicalWordDir(candidate);'
  );
  out = out.replace(
    'cleanupLegacyHistoricalWords(filename);\n      const target = historicalWordPath(filename);',
    'const candidate = normalizeCandidate(payload && payload.candidate);\n      cleanupLegacyHistoricalWords(filename, candidate);\n      const target = historicalWordPath(filename, candidate);'
  );

  if (out.includes("return path.join(app.getPath('documents'), 'SEB EvalPro', 'Bilans');")) {
    fail('writer Word global encore actif après correctif final', 5);
  }
  if (out.includes("bilan-history:write-word-sync") && !out.includes("historicalWordDir(candidate)")) {
    fail('writer Word présent mais non rattaché au candidat', 5);
  }
  parseJs(out, 'src/bilan-history-main.js');
  write(file, out);
}

{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;
  out = out.replace(
    "ipcRenderer.sendSync('bilan-history:write-word-sync', { filename: wordFilename, html })",
    "ipcRenderer.sendSync('bilan-history:write-word-sync', { filename: wordFilename, html, candidate })"
  );
  if (out.includes("bilan-history:write-word-sync") && !out.includes("{ filename: wordFilename, html, candidate }")) {
    fail('identité candidat absente de l’export Word', 5);
  }
  if (out.includes('module.exports = { install };')) {
    out = out.replace('module.exports = { install };', 'module.exports = { install, openEditor };');
  }
  if (!out.includes('module.exports = { install, openEditor };')) fail('export openEditor bilan absent', 5);
  parseJs(out, 'src/bilan-history-preload.js');
  write(file, out);
}

// -----------------------------------------------------------------------------
// Contrôles bloquants : ces choix sont désormais des invariants fonctionnels.
// -----------------------------------------------------------------------------
{
  const transfer = read('src/candidate-transfer-main.js').text;
  const store = read('src/candidate-store-main.js').text;
  const catalogMain = read('src/candidate-catalog-main.js').text;
  const catalogPreload = read('src/candidate-catalog-preload.js').text;
  const replay = read('src/replay-main.js').text;
  const replayPreload = read('src/replay-preload.js').text;
  const bilan = read('src/bilan-history-main.js').text;
  const main = read('src/main.js').text;
  const preload = read('src/preload.js').text;
  const qcm = read('source/qcmv1.0.html').text;
  const carre = read('source/carre.html').text;

  for (const token of [
    'copyVerifiedAtomic',
    'verifyExactCopy',
    'sha256',
    'skipped',
    'updated:0',
    'sameCandidate',
    'candidateShapeValid'
  ]) if (!transfer.includes(token)) fail('transfert USB sécurisé incomplet: ' + token, 7);

  for (const forbidden of [
    'mergeDirectory(source.candidateDir, target)',
    'unmarkDeleted(documentsPath',
    'updated += 1'
  ]) if (transfer.includes(forbidden)) fail('ancien comportement de fusion/écrasement encore présent: ' + forbidden, 7);

  for (const token of [
    "sanitizeSegment(identity.groupe)",
    "const baseFolderName = buildFolderName(identity)"
  ]) if (!store.includes(token)) fail('nommage dossier candidat incomplet: ' + token, 7);

  for (const token of [
    "candidate-catalog:list",
    "candidate-catalog:detail",
    "candidate-catalog:open-export",
    "candidate-catalog:begin-bilan",
    "candidate-catalog:workspace-load-sync",
    "candidate-catalog:workspace-save-sync",
    "seb_evalpro_admin_candidate_id",
    "cleanupDuplicateWordExports",
    "verifyBilan",
    "syncLegacyArtifacts"
  ]) if (!catalogMain.includes(token)) fail('catalogue backend incomplet: ' + token, 7);

  if (catalogMain.includes("candidate-catalog:delete")) fail('suppression d’un dossier candidat encore possible', 7);
  if (catalogPreload.includes("candidate-catalog:delete") || catalogPreload.includes("remove.textContent='Supprimer'")) {
    fail('bouton suppression candidat encore présent', 7);
  }

  for (const token of [
    "openCandidateReplay(candidateId, filename)",
    "candidate-catalog:open-export",
    "Faire le bilan",
    "Document Word du bilan"
  ]) if (!catalogPreload.includes(token)) fail('accès exact candidat incomplet: ' + token, 7);

  if (/\.(?:pdf)\b/i.test(catalogMain) || /Word\s*\/\s*PDF|Word\/PDF/i.test(catalogPreload)) {
    fail('référence PDF encore active dans le catalogue candidat', 7);
  }

  for (const token of [
    'SEB_CANDIDATE_AUTONOMOUS_REPLAY',
    "admin:load-candidate-parcours",
    "admin:get-candidate-parcours-slide",
    "path.join(candidateDir, 'replay')"
  ]) if (!replay.includes(token)) fail('replay candidat incomplet: ' + token, 7);

  if (!replayPreload.includes('openCandidateReplay')) fail('lecteur replay exact candidat absent', 7);

  for (const token of [
    'SEB_CANDIDATE_AUTONOMOUS_BILAN',
    "path.join(candidateDir, 'bilan', 'historique')",
    "candidateHistoryDir(candidate, candidateId)",
    "candidateId:String(source.candidateId || '')"
  ]) if (!bilan.includes(token)) fail('bilan candidat incomplet: ' + token, 7);

  for (const token of [
    'SEB_RUNTIME_OFFLINE',
    'devTools: false',
    'SEB_CANDIDATE_CLOSE_GUARD',
    'candidate:set-admin-export-context',
    'isCurrentCandidateWord',
    'cleanupNumberedCandidateWordCopies'
  ]) if (!main.includes(token)) fail('confinement/offline incomplet: ' + token, 7);

  for (const token of [
    'Copie des fichiers terminée.',
    'Vous pouvez retirer la clé USB en toute sécurité.',
    'déjà présent(s) et ignoré(s)'
  ]) if (!preload.includes(token)) fail('retour USB incomplet: ' + token, 7);

  if (/https:\/\/cdnjs\.cloudflare\.com/i.test(qcm)) fail('CDN jsPDF encore présent', 7);
  if (/url\(\s*['"]?https?:\/\//i.test(carre)) fail('image Internet encore présente dans carre.html', 7);

  for (const [label, source] of [
    ['candidate-transfer-main', transfer],
    ['candidate-store-main', store],
    ['candidate-catalog-main', catalogMain],
    ['candidate-catalog-preload', catalogPreload],
    ['replay-main', replay],
    ['replay-preload', replayPreload],
    ['bilan-history-main', bilan],
    ['main', main],
    ['preload', preload]
  ]) parseJs(source, label);
}

console.log('SEB EvalPro candidats autonomes final: dossier candidat source unique, USB vérifié sans écrasement, replay exact, bilans/Word candidats, corruption contrôlée et runtime hors ligne — OK.');
