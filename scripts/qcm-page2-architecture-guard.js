const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 2: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html');
const page = read('app/web/js/qcm-page2.js');
const parcours = read('app/web/js/seb-parcours.js');

const start = qcm.indexOf('<div id="page2"');
const end = qcm.indexOf('<!-- PAGE 2_1 -->', start);
if (start < 0 || end <= start) fail('bloc Page 2 introuvable');
const slice = qcm.slice(start, end);

for (let i = 1; i <= 5; i += 1) {
  if (!slice.includes('id="reponse2_' + i + '"')) fail('réponse Page 2 absente: ' + i);
  if (!slice.includes('id="unite2_' + i + '"')) fail('unité Page 2 absente: ' + i);
}
for (const token of [
  'id="page2Pass"',
  'id="page2Next"',
  '<script src="js/seb-parcours.js"></script>',
  '<script src="js/qcm-page2.js"></script>'
]) {
  if (!slice.includes(token)) fail('structure Page 2 modulaire absente: ' + token);
}
if (/saveTableAnswers\(2\)/.test(slice)) fail('ancien saveTableAnswers(2) encore lié aux boutons Page 2');
if (/const\s+bonnesReponsesPage2\s*=/.test(qcm)) fail('ancien barème Page 2 encore inline');
if (qcm.includes('id="seb-page2-safe-number-inputs"')) fail('ancien runtime numérique Page 2 inline encore présent');
if (!qcm.includes('id="seb-page2-no-spinner"')) fail('style sans curseur numérique Page 2 absent');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_page2_state';",
  'const TOTAL = 5;',
  "const answers = Object.freeze({ 1:'1020', 2:'1250', 3:'60', 4:'525', 5:'8' });",
  'function normalizeNumeric(value)',
  ".replace(/\\s+/g, '')",
  ".replace(',', '.')",
  'function sameNumeric(left, right)',
  'function persistDraft()',
  'function restoreState()',
  'function syncStoredMapsIntoLegacyGlobals()',
  "storedResponses['page2_q' + i]",
  "storedScores['page2_q' + i]",
  "storedResponses['page2_unite' + i]",
  "storedScores['page2_unite' + i] = 0;",
  "input.addEventListener('wheel'",
  "event.key === 'ArrowUp' || event.key === 'ArrowDown'",
  "window.sebParcours.goNext('qcm-2')",
  'window.sebQcmPage2 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 2 absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "responsePrefix:'page2_q'",
  "unitPrefix:'page2_unite'",
  "stateStorage:'seb_evalpro_qcm_page2_state'"
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 2 absent: ' + token);
}

if (!qcm.includes('afficherLigne("Page 2", "page2", 1, 5);')) {
  fail('Résultats n’affichent plus Page 2');
}
for (let i = 1; i <= 5; i += 1) {
  if (!qcm.includes("'page2_unite" + i + "'")) fail('Résultats unité Page 2 absente: ' + i);
}

console.log('SEB EvalPro garde QCM Page 2: 5 réponses, unités non notées, reprise, normalisation numérique, Résultats et navigation centrale — OK.');
