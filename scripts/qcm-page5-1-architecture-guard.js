const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 5_1: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html');
const page = read('app/web/js/qcm-page5-1.js');
const parcours = read('app/web/js/seb-parcours.js');
const checkpoint = read('scripts/checkpoint-patch.js');

const start = qcm.indexOf('<div id="page5_1"');
const end = qcm.indexOf('<div id="page6"', start);
if (start < 0 || end <= start) fail('bloc Page 5_1 introuvable');
const slice = qcm.slice(start, end);

for (let i = 1; i <= 3; i += 1) {
  if (!slice.includes('id="reponse5_1_' + i + '"')) fail('champ posture absent: ' + i);
}

for (const token of [
  'qcm_posture.PNG',
  'Sélectionnez les trois bonnes postures parmi les six images proposées.',
  'id="page5_1Pass"',
  'id="page5_1Next"',
  '<script src="js/qcm-page5-1.js"></script>'
]) {
  if (!slice.includes(token)) fail('contenu/structure Page 5_1 absent: ' + token);
}

if (/saveTableAnswers\(['"]5_1['"]/.test(slice)) fail('ancien saveTableAnswers(5_1) encore lié aux boutons');
if (/const\s+bonnesReponsesPage5_1/.test(qcm)) fail('ancien ensemble Page 5_1 encore inline');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_page5_1_state';",
  'const TOTAL = 3;',
  "const ALLOWED = Object.freeze(['2', '3', '5']);",
  'const used = new Set();',
  'const duplicate = allowed && used.has(response);',
  'const correct = allowed && !duplicate;',
  "storedResponses['page5_1_q' + i] = result.details[i].reponse;",
  "storedScores['page5_1_q' + i] = result.details[i].correct ? 1 : 0;",
  "window.sebParcours.goNext('qcm-5_1')",
  'window.sebQcmPage5_1 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 5_1 absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "responsePrefix:'page5_1_q'",
  "stateStorage:'seb_evalpro_qcm_page5_1_state'",
  "allowedValues:Object.freeze(['2','3','5'])"
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 5_1 absent: ' + token);
}

if (!checkpoint.includes("page.id === 'page5_1' && window.sebQcmPage5_1")) {
  fail('ancien checkpoint possède encore la reprise Page 5_1');
}

if (!qcm.includes('afficherLigne("Page 5.1", "page5_1", 1, 3);')) {
  fail('Résultats n’affichent plus Page 5_1');
}

console.log('SEB EvalPro garde QCM Page 5_1: 3 champs, valeurs {2,3,5}, unicité stricte, reprise, Résultats et navigation centrale — OK.');
