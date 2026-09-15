const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
function fail(message) {
  console.error('SEB EvalPro clean regression guard: ' + message);
  process.exit(2);
}
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

const pkg = read('package.json');
for (const forbidden of [
  'build142-layout-stability-fix.js',
  'build149-admin-global-stability-fix.js',
  'build154-scrollbar-gutter-fix.js',
  'build155-admin-bar-static-fix.js',
  'build156-admin-overlay-isolation-fix.js',
  'build158-scroll-policy-fix.js'
]) {
  if (pkg.includes(forbidden)) fail('script interdit dans prepare:web: ' + forbidden);
}

const admin = read('app/web/admin-bilan.html');
const qcm = read('app/web/qcmv1.0.html');
const paronymes = read('app/web/paronymes.html');
const replayMain = read('src/replay-main.js');
const replayPreload = read('src/replay-preload.js');
const historyMain = read('src/bilan-history-main.js');
const historyPreload = read('src/bilan-history-preload.js');

const required = [
  [admin, "const bl=be<=2?'I':be<=4?'II':'III'", 'barème Briques'],
  [admin, "apply('mail',e<=1?'I':e<=3?'II':'III'", 'barème Messagerie'],
  [admin, 'Math.round(pr/27*100)', 'Maths /27'],
  [qcm, 'const scoreMax = 7;', 'traitement de texte /7'],
  [qcm, 'seb_evalpro_candidate_result_saved', 'DOCX candidat unique par session'],
  [paronymes, 'data-correct="true">Aplanir</td>', 'Paronymes Raboter -> Aplanir'],
  [replayMain, 'captureBeyondViewport: true', 'Replay pleine page'],
  [replayMain, 'SEB_ADMIN_CAPTURE_ADMINMODE_GUARD', 'barrière backend Admin'],
  [replayPreload, 'ensureFinalArchive', 'archivage final Replay'],
  [replayPreload, 'SEB_RESULTS_CAPTURE_STOP', 'arrêt Replay à Résultats'],
  [replayPreload, 'function adminInteractionTarget(target)', 'filtre interactions Admin'],
  [historyMain, "bilan-history:get-word-template-sync", 'modèle Word institutionnel'],
  [historyMain, "bilan-history:write-word-sync", 'écriture Word directe'],
  [historyMain, 'function historicalWordPath(filename)', 'Word courant unique'],
  [historyPreload, "safe(candidate.date || '') + '.doc';", 'nom Word courant sans suffixe de révision'],
  [historyPreload, 'let revisionSaveInFlight = false;', 'protection double clic révision'],
  [historyPreload, "comment.value = chosen ? String(chosen.value || '') : '';", 'synchronisation commentaire/niveau'],
  [historyPreload, 'SEB_WORD_EQUAL_LEVEL_WIDTHS', 'largeurs Word égales']
];
for (const [text, token, label] of required) {
  if (!text.includes(token)) fail(label + ' absent');
}

for (const forbidden of [
  'SEB_ADMIN_MODAL_CLASS_LOCK',
  'html.seb-admin-modal-open{overflow-y:hidden',
  "classList.add('seb-admin-modal-open')"
]) {
  if (historyPreload.includes(forbidden)) fail('régression layout historique détectée: ' + forbidden);
}

for (const [label, code] of [
  ['replay-main.js', replayMain],
  ['replay-preload.js', replayPreload],
  ['bilan-history-main.js', historyMain],
  ['bilan-history-preload.js', historyPreload],
  ['replay-navigation-capture.js', read('src/replay-navigation-capture.js')],
  ['preload.js', read('src/preload.js')]
]) {
  try { new vm.Script(code); }
  catch (error) { fail(label + ' invalide: ' + error.message); }
}

console.log('SEB EvalPro clean regression guard: fonctions attendues présentes, couches layout/scroll exclues, JavaScript valide.');