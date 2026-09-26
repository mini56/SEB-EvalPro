const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 2_1: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html');
const page = read('app/web/js/qcm-page2-1.js');
const parcours = read('app/web/js/seb-parcours.js');

const start = qcm.indexOf('<div id="page2_1"');
const end = qcm.indexOf('<!-- PAGE 3 -->', start);
if (start < 0 || end <= start) fail('bloc Page 2_1 introuvable');
const slice = qcm.slice(start, end);

for (let i = 6; i <= 10; i += 1) {
  if (!slice.includes('id="reponse2_1_' + i + '"')) fail('réponse Page 2_1 absente: ' + i);
  if (!slice.includes('id="unite2_1_' + i + '"')) fail('unité Page 2_1 absente: ' + i);
}

for (const token of [
  'id="page2_1Pass"',
  'id="page2_1Next"',
  '<script src="js/qcm-page2-1.js"></script>'
]) {
  if (!slice.includes(token)) fail('structure Page 2_1 modulaire absente: ' + token);
}

if (/saveTableAnswers\(['"]2_1['"]\)/.test(slice)) fail('ancien saveTableAnswers(2_1) encore lié aux boutons');
if (/const\s+bonnesReponsesPage2_1\s*=/.test(qcm)) fail('ancien barème Page 2_1 encore inline');

const legacyNumericIds = [
  'reponse2_1_6','reponse2_1_7','reponse2_1_8','reponse2_1_9','reponse2_1_10'
];
const numericListMatch = qcm.match(/const numericInputIds = \[([\s\S]*?)\];/);
if (numericListMatch && legacyNumericIds.some((id) => numericListMatch[1].includes(id))) {
  fail('ancien filtrage numérique Page 2_1 encore détenu par le moteur global');
}

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_page2_1_state';",
  'const TOTAL = 5;',
  'const START = 6;',
  'const END = 10;',
  "const answers = Object.freeze({ 6:'10', 7:'75', 8:'12', 9:'24', 10:'165' });",
  'function normalizeNumeric(value)',
  ".replace(/\\s+/g, '')",
  ".replace(',', '.')",
  'function sameNumeric(left, right)',
  'function persistDraft()',
  'function restoreState()',
  'function syncStoredMapsIntoLegacyGlobals()',
  "storedResponses['page2_1_q' + i]",
  "storedScores['page2_1_q' + i]",
  "storedResponses['page2_1_unite' + i]",
  "storedScores['page2_1_unite' + i] = 0;",
  "this.value.replace(/[^0-9.,]/g, '')",
  "window.sebParcours.goNext('qcm-2_1')",
  'window.sebQcmPage2_1 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 2_1 absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "responsePrefix:'page2_1_q'",
  "unitPrefix:'page2_1_unite'",
  "stateStorage:'seb_evalpro_qcm_page2_1_state'"
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 2_1 absent: ' + token);
}

if (!qcm.includes('afficherLigne("Page 2.1", "page2_1", 6, 10);')) {
  fail('Résultats n’affichent plus Page 2_1');
}
for (let i = 6; i <= 10; i += 1) {
  if (!qcm.includes("'page2_1_unite" + i + "'")) fail('Résultats unité Page 2_1 absente: ' + i);
}

console.log('SEB EvalPro garde QCM Page 2_1: 5 réponses, unités non notées, filtrage numérique, reprise, Résultats et navigation centrale — OK.');
