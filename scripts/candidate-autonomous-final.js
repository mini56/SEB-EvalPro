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

  if (out.includes('candidateCatalog.install();')) {
    out = out.replace('candidateCatalog.install();', 'candidateCatalog.install({ beforeNavigate: () => saveNow(true) });');
  } else if (!out.includes('candidateCatalog.install({ beforeNavigate: () => saveNow(true) });')) {
    const anchor = '  bilanHistory.install();';
    if (!out.includes(anchor)) fail('installation bilanHistory absente', 3);
    out = out.replace(anchor, anchor + '\n  candidateCatalog.install({ beforeNavigate: () => saveNow(true) });');
  }

  out = out.replace(/\s*const groupName = await createTransferNameDialog\(\);[\s\S]*?if \(!groupName\) \{[\s\S]*?return;\s*\}\s*/m, '\n');
  out = out.replace("ipcRenderer.invoke('admin:import-candidates', groupName)", "ipcRenderer.invoke('admin:import-candidates')");
  // SEB_BUILD94_ADMIN_HOME_EXPORT
  const exportGuardMarker = '// SEB_ADMIN_EXPORT_REQUIRES_CLOSED_CANDIDATE';
  if (!out.includes(exportGuardMarker)) {
    const exportAnchor = "  exportCandidatesButton.addEventListener('click', async () => {\n    showBar();\n    saveNow(true);";
    if (!out.includes(exportAnchor)) fail('ancre export dossiers candidats absente', 3);
    const exportReplacement = [
      "  exportCandidatesButton.addEventListener('click', async () => {",
      "    showBar();",
      "    // SEB_ADMIN_EXPORT_REQUIRES_CLOSED_CANDIDATE",
      "    const candidateFolderOpen = !!document.getElementById('seb-candidate-detail')",
      "      || !!adminCandidateWorkspace",
      "      || !!adminCandidateResultsWorkspace",
      "      || !!document.getElementById('seb-bilan-history-editor')",
      "      || !!document.getElementById('seb-replay-viewer');",
      "    if (candidateFolderOpen) {",
      "      await showTransferMessage('Export impossible', 'Fermez le dossier candidat avant de lancer l’export.', true);",
      "      scheduleHideBar();",
      "      return;",
      "    }",
      "    saveNow(true);"
    ].join('\n');
    out = out.replace(exportAnchor, exportReplacement);
  }

  const adminHomeButtonMarker = '// SEB_ADMIN_HOME_PRIVACY_BUTTON_IN_BAR';
  if (!out.includes(adminHomeButtonMarker)) {
    const toggleAnchor = "  function ensurePrivacyToggle(){\n    let button = document.getElementById('seb-evalpro-privacy-toggle');\n    if (button) return button;";
    if (!out.includes(toggleAnchor)) fail('ancre bouton écran accueil absente', 3);
    const toggleReplacement = [
      "  // SEB_ADMIN_HOME_PRIVACY_BUTTON_IN_BAR",
      "  function placePrivacyToggleForAdminHome(button){",
      "    if (!button) return button;",
      "    const onAdminHome = typeof isAdminCandidatesPage === 'function' && isAdminCandidatesPage();",
      "    if (!onAdminHome) return button;",
      "    const bar = document.getElementById('seb-evalpro-topbar');",
      "    if (!bar) return button;",
      "    if (button.parentElement !== bar) bar.appendChild(button);",
      "    const centered = {",
      "      position:'absolute', left:'50%', right:'auto', bottom:'auto', top:'50%',",
      "      transform:'translate(-50%, -50%)', zIndex:'2147483647', margin:'0',",
      "      padding:'6px 12px', border:'2px solid #0070c0', borderRadius:'6px',",
      "      background:'#fff', color:'#0070c0', whiteSpace:'nowrap',",
      "      font:'700 14px Arial, sans-serif', boxShadow:'0 2px 5px rgba(0,0,0,.18)'",
      "    };",
      "    Object.entries(centered).forEach(([name, value]) => {",
      "      const cssName = name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());",
      "      button.style.setProperty(cssName, value, 'important');",
      "    });",
      "    return button;",
      "  }",
      "",
      "  function ensurePrivacyToggle(){",
      "    let button = document.getElementById('seb-evalpro-privacy-toggle');",
      "    if (button) return placePrivacyToggleForAdminHome(button);"
    ].join('\n');
    out = out.replace(toggleAnchor, toggleReplacement);
    const appendAnchor = "    document.body.appendChild(button);\n    return button;\n  }\n\n  function ensurePrivacyLayer(){";
    if (!out.includes(appendAnchor)) fail('ancre insertion bouton écran accueil absente', 3);
    out = out.replace(appendAnchor, "    document.body.appendChild(button);\n    return placePrivacyToggleForAdminHome(button);\n  }\n\n  function ensurePrivacyLayer(){");
  }

  for (const token of [
    'adminCandidateResultsWorkspace',
    'showReadOnlyCandidateResults',
    "candidate-catalog:results-workspace-load-sync"
  ]) if (!out.includes(token)) fail('résultats candidat Admin incomplets: ' + token, 7);

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
// ÉCRAN ADMIN NEUTRE : visuel SEB EvalPro centré, sans modifier le parcours.
// -----------------------------------------------------------------------------
{
  const adminHomeFile = path.join(root, 'app', 'web', 'admin-candidats.html');
  if (!fs.existsSync(adminHomeFile)) fail('page Admin candidats générée introuvable', 6);
  let adminHome = fs.readFileSync(adminHomeFile, 'utf8').replace(/\r\n/g, '\n');
  if (!adminHome.includes('seb-admin-home-program-image')) {
    if (!adminHome.includes('</style>')) fail('style page Admin candidats introuvable', 6);
    adminHome = adminHome.replace('</style>', "    #seb-admin-home-program-image{display:block;width:min(560px,36vw);max-width:72%;max-height:42vh;height:auto;object-fit:contain;margin:0 auto;user-select:none;-webkit-user-drag:none}\n  </style>");
    const titleAnchor = '<h1>Espace administrateur</h1>';
    if (!adminHome.includes(titleAnchor)) fail('contenu page Admin candidats introuvable', 6);
    adminHome = adminHome.replace(titleAnchor, titleAnchor + '\n    <img id="seb-admin-home-program-image" src="imageqcm/seb-evalpro-privacy-screen.jpg" alt="SEB EvalPro">');
  }
  fs.writeFileSync(adminHomeFile, adminHome, 'utf8');
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
  const localAi = read('src/local-ai.js').text;
  const installer = read('build/installer.nsh').text;
  const priorityFixes = read('scripts/priority-fixes.js').text;
  const packageText = read('package.json').text;
  const build135Audit = read('scripts/build135-audit-fixes.js').text;
  const build135Runner = read('scripts/build135-runner.js').text;
  const cleanRegressionGuard = read('scripts/build159-clean-regression-guard.js').text;
  const adminCandidatesPage = read('overrides/admin-candidats.html').text;
  const adminCandidatesGenerated = read('app/web/admin-candidats.html').text;

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
    "const baseFolderName = buildFolderName(identity)",
    "function candidateIdentityKey(candidate)",
    "function existingCandidateForIdentity(identity)",
    "return activateExistingCandidate(existing, identity)"
  ]) if (!store.includes(token)) fail('unicité dossier candidat incomplète: ' + token, 7);

  for (const token of [
    "candidate-catalog:list",
    "candidate-catalog:detail",
    "candidate-catalog:delete",
    "candidate-catalog:open-export",
    "candidate-catalog:begin-bilan",
    "candidate-catalog:workspace-load-sync",
    "candidate-catalog:workspace-save-sync",
    "candidate-catalog:begin-results",
    "candidate-catalog:results-workspace-load-sync",
    "seb_evalpro_admin_candidate_id",
    "cleanupDuplicateWordExports",
    "verifyBilan",
    "syncLegacyArtifacts",
    "consolidateDuplicateCandidateFolders",
    "'Corbeille', 'Doublons'",
    "consolidatedDuplicates"
  ]) if (!catalogMain.includes(token)) fail('catalogue backend incomplet: ' + token, 7);

  for (const token of [
    'removeLegacyCandidateCopies',
    'removeCandidateRuntimeState',
    "candidate-catalog:delete"
  ]) if (!catalogMain.includes(token)) fail('effacement candidat Admin incomplet: ' + token, 7);
  for (const token of [
    'confirmCandidateDeletion',
    'seb-cc-detail-delete',
    'Supprimer définitivement',
    "ipcRenderer.invoke('candidate-catalog:delete'"
  ]) if (!catalogPreload.includes(token)) fail('interface effacement candidat incomplète: ' + token, 7);
  if (catalogPreload.includes('function statusLabel') || catalogPreload.includes('Session fermée') || catalogPreload.includes('>En cours<')) {
    fail('statut technique candidat encore affiché dans le catalogue', 7);
  }

  for (const token of [
    "openCandidateReplay(candidateId, filename)",
    "candidate-catalog:open-export",
    "Faire le bilan",
    "Résultats du candidat",
    "Ouvrir les résultats",
    "beginCandidateResults",
    "Document Word du bilan",
    "admin:open-candidate-browser",
    "isCandidateAdminHost",
    "requestedCandidateId",
    "openCatalog(initialCandidateId = '')",
    "closeButton.addEventListener('click', close)",
    "if (isCandidateAdminHost()) {\n        await openCatalog();",
    "button.hidden = !unlocked || onBilan || !!(results && results.ok);"
  ]) if (!catalogPreload.includes(token)) fail('accès/navigation exacte candidat incomplet: ' + token, 7);

  if (catalogPreload.includes("closeButton.hidden = true")) {
    fail('bouton Fermer du catalogue Admin encore neutralisé', 7);
  }

  if (catalogPreload.includes("bilan.textContent='Faire le bilan'")) {
    fail('Faire le bilan encore proposé directement depuis la liste candidats', 7);
  }
  if (!adminCandidatesPage.includes('Espace administrateur')) fail('page Admin candidats incomplète: Espace administrateur', 7);
  if (adminCandidatesPage.includes('<p>Dossiers candidats</p>')) fail('texte noir Dossiers candidats encore présent sur l’écran Admin neutre', 7);

  for (const token of ['seb-admin-home-program-image', 'imageqcm/seb-evalpro-privacy-screen.jpg']) {
    if (!adminCandidatesGenerated.includes(token)) fail('écran Admin neutre incomplet: ' + token, 7);
  }
  if (adminCandidatesGenerated.includes('<p>Dossiers candidats</p>')) fail('texte Dossiers candidats réintroduit dans l’écran Admin neutre', 7);
  if (!preload.includes('const BAR_HIDE_DELAY = 1000;')) fail('temporisation de fermeture barre Admin différente de 1 seconde', 7);
  for (const token of [
    '.seb-cc-detail-actions .danger{margin-left:auto;background:#fff!important;color:#c00000!important;border-color:#c00000!important}',
    '.seb-delete-actions .danger{background:#fff!important;color:#c00000!important;border-color:#c00000!important}'
  ]) if (!catalogPreload.includes(token)) fail('style blanc/contour rouge des boutons Supprimer incomplet: ' + token, 7);

  if (/\.(?:pdf)\b/i.test(catalogMain) || /Word\s*\/\s*PDF|Word\/PDF/i.test(catalogPreload)) {
    fail('référence PDF encore active dans le catalogue candidat', 7);
  }

  if (preload.includes('id="seb-evalpro-results"')) {
    fail('ancien bouton global Résultats stagiaires encore injecté malgré les résultats par dossier candidat', 7);
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
    'cleanupNumberedCandidateWordCopies',
    'admin:open-candidate-results',
    'adminCandidateResultsMode',
    'admin:open-candidate-browser',
    'admin:return-candidate-browser',
    'admin-candidats.html',
    'isAdminNavigationPage(page)'
  ]) if (!main.includes(token)) fail('confinement/navigation Admin incomplet: ' + token, 7);

  for (const token of [
    'Copie des fichiers terminée.',
    'Vous pouvez retirer la clé USB en toute sécurité.',
    'déjà présent(s) et ignoré(s)',
    "closeSessionButton.hidden = !adminUnlocked;",
    'seb-admin-results-close',
    'Fermer les résultats',
    'adminNavigationLeaving',
    'isAdminCandidatesPage',
    "returnButton.textContent = 'Retour au candidat'",
    'admin:return-candidate-browser',
    'SEB_ADMIN_NAVIGATION_SAFE_LOCK',
    'bilanButton.hidden = true',
    'candidateCatalog.install({ beforeNavigate: () => saveNow(true) });',
    'SEB_ADMIN_EXPORT_REQUIRES_CLOSED_CANDIDATE',
    'Fermez le dossier candidat avant de lancer l’export.',
    'SEB_ADMIN_HOME_PRIVACY_BUTTON_IN_BAR'
  ]) if (!preload.includes(token)) fail('interface/navigation Admin candidat incomplète: ' + token, 7);

  for (const token of [
    'Microsoft Visual C++ x64',
    '3221225781',
    "serverProcess.on('error'"
  ]) if (!localAi.includes(token)) fail('diagnostic runtime IA incomplet: ' + token, 7);

  for (const token of [
    'vc_redist.x64.exe',
    'ExecShellWait "runas"',
    'VC\\Runtimes\\x64'
  ]) if (!installer.includes(token)) fail('prérequis Visual C++ absent du Setup: ' + token, 7);

  for (const forbidden of [
    'admin:list-results',
    'admin:open-result',
    'seb-evalpro-results',
    'createCandidateResultsDialog',
    'sauvegarderResultatStagiaireDocx',
    'seb-result-docx-lib'
  ]) if (priorityFixes.includes(forbidden)) fail('ancien flux Résultats global encore présent dans priority-fixes: ' + forbidden, 7);

  if (packageText.includes('result-docx-style-fix.js')) {
    fail('ancien script result-docx-style-fix encore exécuté par prepare:web', 7);
  }
  if (qcm.includes('sauvegarderResultatStagiaireDocx') || qcm.includes('seb-result-docx-lib')) {
    fail('ancien DOCX automatique Résultat encore généré', 7);
  }

  for (const [label, source] of [
    ['build135-audit', build135Audit],
    ['build135-runner', build135Runner],
    ['build159-clean-regression-guard', cleanRegressionGuard]
  ]) {
    for (const forbidden of ['sauvegarderResultatStagiaireDocx', 'seb_evalpro_candidate_result_saved']) {
      if (source.includes(forbidden)) fail(label + ' dépend encore de l’ancien DOCX Résultat: ' + forbidden, 7);
    }
  }

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
    ['preload', preload],
    ['local-ai', localAi],
    ['priority-fixes', priorityFixes]
  ]) parseJs(source, label);
}

console.log('SEB EvalPro candidats autonomes final: dossier candidat source unique, USB vérifié sans écrasement, replay exact, bilans/Word candidats, corruption contrôlée et runtime hors ligne — OK.');
