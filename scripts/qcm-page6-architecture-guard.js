const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 6: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');
const page = read('app/web/js/qcm-page6.js');
const parcours = read('app/web/js/seb-parcours.js');
const checkpoint = read('scripts/checkpoint-patch.js');
const answerAudit = read('scripts/answer-entry-audit-fixes.js');

const start = qcm.indexOf('<div id="page6"');
const end = qcm.indexOf('<div id="page9"', start);
if (start < 0 || end <= start) fail('bloc Page 6 introuvable');
const slice = qcm.slice(start, end);

for (let i = 1; i <= 10; i += 1) {
  if (!slice.includes('id="reponse6_' + i + '"')) fail('réponse notée Page 6 absente: ' + i);
  if (!slice.includes('id="unite6_' + i + '"')) fail('unité Page 6 absente: ' + i);
}
for (let i = 11; i <= 20; i += 1) {
  if (!slice.includes('id="reponse6_' + i + '"')) fail('opération Page 6 absente: ' + i);
}

for (const token of [
  'Un sac de farine pèse <strong>2,3 kg</strong>',
  'Une planche mesure <strong>250 cm</strong>',
  'Un colis pèse <strong>5600 g</strong>',
  'doit être coupée en morceaux de <strong>80 cm</strong>',
  'id="page6Pass"',
  'id="page6Next"',
  '<script src="js/qcm-page6.js"></script>'
]) {
  if (!slice.includes(token)) fail('contenu/structure Page 6 absent: ' + token);
}

if (/onclick="[^"]*saveTableAnswers\(6\)/.test(slice)) fail('ancien saveTableAnswers(6) encore lié aux boutons');
if (/const\s+bonnesReponsesPage6\s*=/.test(qcm)) fail('ancien barème Page 6 encore inline');
if (/const\s+numericInputIds\s*=\s*\[[\s\S]*?reponse6_1/.test(qcm)) fail('ancien filtre numérique Page 6 encore inline');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_page6_state';",
  'const TOTAL = 10;',
  "1:'2300', 2:'7500', 3:'2.5', 4:'8400', 5:'3200'",
  "6:'450', 7:'750', 8:'5.6', 9:'1250', 10:'4'",
  'function normalizeNumeric(value)',
  'function sameNumeric(left, right)',
  "storedResponses['page6_q' + i] = result.details[i].reponse;",
  "storedResponses['page6_unite' + i] = String(values.units[i] || '').trim();",
  "storedScores['page6_unite' + i] = 0;",
  "storedResponses['page6_q' + i] = String(values.operations[i] || '').trim();",
  "storedScores['page6_q' + i] = 0;",
  "window.sebParcours.goNext('qcm-6')",
  'window.sebQcmPage6 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 6 absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "responsePrefix:'page6_q'",
  "unitPrefix:'page6_unite'",
  "stateStorage:'seb_evalpro_qcm_page6_state'",
  'operationStart:11',
  'operationEnd:20'
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 6 absent: ' + token);
}

if (!checkpoint.includes("page.id === 'page6' && window.sebQcmPage6")) {
  fail('ancien checkpoint possède encore la reprise Page 6');
}

if (!answerAudit.includes("const modularPage6 = out.includes('js/qcm-page6.js');")) {
  fail('audit réponses non adapté à Page 6 modulaire');
}
if (!answerAudit.includes("Page 6: module qcm-page6.js introuvable")) {
  fail('audit numérique Page 6 modulaire absent');
}

if (!qcm.includes('afficherLigne("Page 6", "page6", 1, 10);')) {
  fail('Résultats n’affichent plus les 10 réponses notées Page 6');
}
for (let i = 1; i <= 10; i += 1) {
  if (!qcm.includes("'page6_unite" + i + "'")) fail('Résultats unité Page 6 absente: ' + i);
}
if (!qcm.includes('for (let i = 11; i <= 20; i++) tmp6.push(')) {
  fail('Résultats opérations Q11-Q20 absents');
}

if (!qcm.includes("if (pageNum == 6 && window.sebQcmPage6?.save) return window.sebQcmPage6.save();")) {
  fail('pont historique saveTableAnswers(6) absent');
}

console.log('SEB EvalPro garde QCM Page 6: 10 réponses notées, unités + opérations non notées, reprise, Résultats et navigation centrale — OK.');
