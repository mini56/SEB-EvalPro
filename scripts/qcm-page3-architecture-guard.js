const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 3: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');
const page = read('app/web/js/qcm-page3.js');
const parcours = read('app/web/js/seb-parcours.js');

const start = qcm.indexOf('<div id="page3"');
const end = qcm.indexOf('<!-- PAGE TEXTE A TROUS -->', start);
if (start < 0 || end <= start) fail('bloc Page 3 introuvable');
const slice = qcm.slice(start, end);

for (let i = 1; i <= 14; i += 1) {
  if (!slice.includes('id="reponse3_' + i + '"')) fail('réponse Page 3 absente: ' + i);
}

for (const token of [
  'id="page3Pass"',
  'id="page3Next"',
  '<script src="js/qcm-page3.js"></script>'
]) {
  if (!slice.includes(token)) fail('structure Page 3 modulaire absente: ' + token);
}

if (/saveTableAnswers\(3\)/.test(slice)) fail('ancien saveTableAnswers(3) encore lié aux boutons');
if (/const\s+bonnesReponsesPage3\s*=/.test(qcm)) fail('ancien barème Page 3 encore inline');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const DEDICATED_KEY = 'page3_resultats';",
  "const STATE_KEY = 'seb_evalpro_qcm_page3_state';",
  "const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';",
  'const TOTAL = 14;',
  "1:'9h15', 2:'8h50', 3:'9h05', 4:'9h20', 5:'8h45', 6:'5h15'",
  "7:'9h45', 8:'9h15', 9:'9h30', 10:'9h55', 11:'9h25', 12:'2h35'",
  "13:'0h31', 14:'1h03'",
  'function parseTimeToMinutes(value)',
  'function sameTime(left, right)',
  ".replace(/heures?/g, 'h')",
  ".replace(/minutes?/g, 'm')",
  "match = text.match(/^(\\d+)\\s*m$/);",
  "match = text.match(/^(\\d+)\\s*h$/);",
  "match = text.match(/^(\\d+)\\s*(?:h|:)\\s*(\\d{1,2})\\s*m?$/);",
  "if (!match) match = text.match(/^(\\d+)\\s+(\\d{1,2})$/);",
  'minutes > 59',
  "sessionStorage.setItem(DEDICATED_KEY",
  "storedResponses['3'] = 'Mauvaise réponse';",
  "storedResponses['3'] = 'Bonne réponse';",
  "window.sebParcours.goNext('qcm-3')",
  'window.sebQcmPage3 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 3 absent: ' + token);
}

for (const forbidden of [
  "9:'9h25', 10:'9h55', 11:'9h25', 12:'2h30'",
  "13:'0h30', 14:'1h03'"
]) {
  if (page.includes(forbidden) || qcm.includes(forbidden)) fail('ancienne grille Page 3 réintroduite: ' + forbidden);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "dedicatedStorage:'page3_resultats'",
  "responsePrefix:'page3_q'",
  "stateStorage:'seb_evalpro_qcm_page3_state'"
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 3 absent: ' + token);
}

if (!qcm.includes('afficherLigne("Page 3 — Réception & Rangement", "page3", 1, 14);')) {
  fail('Résultats n’affichent plus les 14 réponses Page 3');
}
if (!qcm.includes('scoreMathsProblemes += scores[`page3_q${i}`] || 0;')) {
  fail('score problèmes ne reprend plus Page 3');
}

console.log('SEB EvalPro garde QCM Page 3: 14 réponses, formats horaires tolérants, minutes strictes, persistance dédiée, Résultats et navigation centrale — OK.');
