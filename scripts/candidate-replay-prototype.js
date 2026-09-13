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

// Brancher le backend d'archivage/replay après tous les correctifs du Build #134.
{
  const { file, text } = read('src/main.js');
  let out = text;
  if (!out.includes('// SEB_CANDIDATE_REPLAY_PROTO_MAIN')) {
    const marker = "require('./session-close')({";
    const index = out.indexOf(marker);
    if (index < 0) fail('point d’insertion main.js introuvable');
    const block = `// SEB_CANDIDATE_REPLAY_PROTO_MAIN\nrequire('./replay-main')({\n  app,\n  ipcMain,\n  getAdminUnlocked: () => adminSessionUnlocked,\n  buildNumber: ${JSON.stringify(buildNumber)}\n});\n\n`;
    out = out.slice(0, index) + block + out.slice(index);
  }
  if (!out.includes("require('./replay-main')")) fail('backend replay non branché');
  if (!out.includes(`buildNumber: ${JSON.stringify(buildNumber)}`)) fail('numéro de build replay non injecté');
  write(file, out);
}

// Brancher le module preload : archive à l'affichage de Résultats + UI admin en lecture seule.
{
  const { file, text } = read('src/preload.js');
  let out = text;
  if (!out.includes('// SEB_CANDIDATE_REPLAY_PROTO_PRELOAD')) {
    const importMarker = "const path = require('path');";
    if (!out.includes(importMarker)) fail('import path preload introuvable');
    out = out.replace(
      importMarker,
      `${importMarker}\nconst replayPrototype = require('./replay-preload');\n// SEB_CANDIDATE_REPLAY_PROTO_PRELOAD`
    );

    const domMarker = "  injectAdminBar();\n  document.addEventListener('input', scheduleSave, true);";
    if (!out.includes(domMarker)) fail('point d’installation replay dans DOMContentLoaded introuvable');
    out = out.replace(
      domMarker,
      "  injectAdminBar();\n  replayPrototype.install();\n  document.addEventListener('input', scheduleSave, true);"
    );
  }
  if (!out.includes("require('./replay-preload')")) fail('module replay preload non importé');
  if (!out.includes('replayPrototype.install();')) fail('module replay preload non installé');
  write(file, out);
}

// Contrôles bloquants sur les modules livrés avec l'application.
{
  const replayMain = read('src/replay-main.js').text;
  const replayPreload = read('src/replay-preload.js').text;
  const requiredMain = [
    "path.join(app.getPath('documents'), 'SEB EvalPro', 'parcours')",
    "ipcMain.handle('replay:archive-final'",
    "ipcMain.handle('admin:list-parcours'",
    "ipcMain.handle('admin:load-parcours'",
    "Archive modifiée ou corrompue : replay refusé.",
    "readOnly: true"
  ];
  const requiredPreload = [
    "final.classList.contains('visible')",
    "seb_evalpro_replay_archive_file",
    "Rejouer un parcours",
    "LECTURE SEULE · AUCUN RECALCUL",
    "Choisir le parcours à rejouer",
    "Documents\\\\SEB EvalPro\\\\parcours"
  ];
  for (const token of requiredMain) if (!replayMain.includes(token)) fail('contrôle backend manquant: ' + token);
  for (const token of requiredPreload) if (!replayPreload.includes(token)) fail('contrôle interface manquant: ' + token);
}

console.log(`SEB EvalPro replay prototype: archivage figé sur page Résultats, dossier parcours, replay administrateur lecture seule, Build #${buildNumber}.`);
