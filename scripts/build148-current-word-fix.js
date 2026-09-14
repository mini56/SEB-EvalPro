const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message, code = 2) {
  console.error('SEB EvalPro Build #148 Word courant unique: ' + message);
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

// -----------------------------------------------------------------------------
// 1. Le dossier Bilans ne contient qu'un Word courant par candidat/évaluation.
//    Les révisions complètes restent dans Historique en JSON.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-main.js');
  let out = text;

  const helperStart = out.indexOf('  function uniqueHistoricalWordPath(filename) {');
  const helperEnd = out.indexOf("\n\n  ipcMain.on('bilan-history:write-word-sync'", helperStart);
  if (helperStart < 0 || helperEnd < 0) fail('writer Word historique #139 introuvable', 3);

  const helper = `  function historicalWordPath(filename) {\n    const directory = historicalWordDir();\n    fs.mkdirSync(directory, { recursive: true });\n    return path.join(directory, filename);\n  }\n\n  function cleanupLegacyHistoricalWords(filename) {\n    const directory = historicalWordDir();\n    fs.mkdirSync(directory, { recursive: true });\n    const parsed = path.parse(filename);\n    const escapedBase = String(parsed.name).replace(/[.*+?^$(){}|[\\]\\\\]/g, '\\\\$&');\n    const oldRevision = new RegExp('^' + escapedBase + '_R\\\\d+(?:_\\\\d+)?\\\\.doc$', 'i');\n    const oldDuplicate = new RegExp('^' + escapedBase + '_\\\\d+\\\\.doc$', 'i');\n    for (const entry of fs.readdirSync(directory)) {\n      if (entry.toLowerCase() === filename.toLowerCase()) continue;\n      if (!oldRevision.test(entry) && !oldDuplicate.test(entry)) continue;\n      try { fs.rmSync(path.join(directory, entry), { force: true }); } catch (_) {}\n    }\n  }`;

  out = out.slice(0, helperStart) + helper + out.slice(helperEnd);

  const oldWrite = `      const target = uniqueHistoricalWordPath(filename);\n      const temp = \`${'${target}'}.tmp\`;\n      fs.writeFileSync(temp, '\\uFEFF' + html, 'utf8');\n      fs.renameSync(temp, target);`;
  const newWrite = `      cleanupLegacyHistoricalWords(filename);\n      const target = historicalWordPath(filename);\n      const temp = \`${'${target}'}.tmp\`;\n      fs.writeFileSync(temp, '\\uFEFF' + html, 'utf8');\n      if (fs.existsSync(target)) fs.rmSync(target, { force: true });\n      fs.renameSync(temp, target);`;
  if (!out.includes(oldWrite)) fail('bloc écriture Word unique introuvable', 4);
  out = out.replace(oldWrite, newWrite);

  if (out.includes('uniqueHistoricalWordPath(')) fail('ancien writer anti-écrasement encore actif', 5);
  for (const required of [
    'function historicalWordPath(filename)',
    'function cleanupLegacyHistoricalWords(filename)',
    "const oldRevision = new RegExp('^' + escapedBase + '_R",
    'if (fs.existsSync(target)) fs.rmSync(target, { force: true });'
  ]) {
    if (!out.includes(required)) fail('contrôle writer absent: ' + required, 6);
  }

  try { new vm.Script(out); } catch (error) { fail('bilan-history-main.js invalide: ' + error.message, 7); }
  write(file, out);
}

// -----------------------------------------------------------------------------
// 2. Le Word visible n'a plus de suffixe de révision. R01/R02/R03 restent dans
//    les archives JSON seulement. Un nouvel enregistrement met à jour le même .doc.
// -----------------------------------------------------------------------------
{
  const { file, text } = read('src/bilan-history-preload.js');
  let out = text;

  const oldName = `  const revisionNumber = Number.isFinite(Number(revision)) ? Number(revision) : 0;\n  const revisionSuffix = '_R' + String(revisionNumber).padStart(2, '0');\n  const wordFilename = 'Evaluation_' + safe(candidate.nom).toUpperCase() + '_' + safe(candidate.prenom).toUpperCase() + '_' + safe(candidate.date || '') + revisionSuffix + '.doc';`;
  const newName = `  const wordFilename = 'Evaluation_' + safe(candidate.nom).toUpperCase() + '_' + safe(candidate.prenom).toUpperCase() + '_' + safe(candidate.date || '') + '.doc';`;
  if (!out.includes(oldName)) fail('nom Word révisionné introuvable', 8);
  out = out.replace(oldName, newName);

  out = out.replace('Word créé automatiquement :', 'Word mis à jour automatiquement :');
  out = out.replace('Word créé :', 'Word mis à jour :');

  // Bloquer les doubles clics sur "Enregistrer une nouvelle révision" : une seule
  // requête de révision et un seul export Word peuvent être actifs à la fois.
  const listenerStart = out.indexOf("  overlay.querySelector('#seb-bh-save-revision').addEventListener('click', async () => {");
  const listenerEnd = out.indexOf("\n  overlay.querySelector('#seb-bh-export')", listenerStart);
  if (listenerStart < 0 || listenerEnd < 0) fail('listener nouvelle révision introuvable', 9);
  const block = out.slice(listenerStart, listenerEnd);
  const firstNewline = block.indexOf('\n');
  const closeIndex = block.lastIndexOf('\n  });');
  if (firstNewline < 0 || closeIndex < 0) fail('structure listener nouvelle révision invalide', 10);
  const body = block.slice(firstNewline + 1, closeIndex);
  const guardedBody = body.split('\n').map((line) => '  ' + line).join('\n');
  const guarded = `  const saveRevisionButton = overlay.querySelector('#seb-bh-save-revision');\n  let revisionSaveInFlight = false;\n  saveRevisionButton.addEventListener('click', async () => {\n    if (revisionSaveInFlight) return;\n    revisionSaveInFlight = true;\n    saveRevisionButton.disabled = true;\n    try {\n${guardedBody}\n    } finally {\n      revisionSaveInFlight = false;\n      saveRevisionButton.disabled = false;\n    }\n  });`;
  out = out.slice(0, listenerStart) + guarded + out.slice(listenerEnd);

  if (out.includes('revisionSuffix') || out.includes("padStart(2, '0') + '.doc'")) {
    fail('suffixe de révision encore présent dans le Word visible', 11);
  }
  for (const required of [
    "const wordFilename = 'Evaluation_' + safe(candidate.nom).toUpperCase()",
    "safe(candidate.date || '') + '.doc';",
    'let revisionSaveInFlight = false;',
    'if (revisionSaveInFlight) return;',
    'saveRevisionButton.disabled = true;'
  ]) {
    if (!out.includes(required)) fail('contrôle export unique absent: ' + required, 12);
  }

  try { new vm.Script(out); } catch (error) { fail('bilan-history-preload.js invalide: ' + error.message, 13); }
  write(file, out);
}

console.log('SEB EvalPro Build #148: un seul Word courant par candidat/évaluation; chaque nouvelle révision remplace ce Word et met à jour son heure; historique JSON complet conservé; anciens Word Rxx nettoyés au prochain enregistrement.');
