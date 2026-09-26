const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 5: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html');
const page = read('app/web/js/qcm-page5.js');
const parcours = read('app/web/js/seb-parcours.js');
const checkpoint = read('scripts/checkpoint-patch.js');

const start = qcm.indexOf('<div id="page5"');
const end = qcm.indexOf('<div id="page5_1"', start);
if (start < 0 || end <= start) fail('bloc Page 5 introuvable');
const slice = qcm.slice(start, end);

for (let i = 1; i <= 8; i += 1) {
  if (!slice.includes('id="reponse5_' + i + '"')) fail('champ Page 5 absent: ' + i);
}

const contentChecks = [
  [/Emballer les pièces et protéger les machines fragiles\./i, 'Emballer'],
  [/Décharger le camion et positionner les machines\./i, 'Décharger'],
  [/Charger le camion et les machines\./i, 'Charger'],
  [/vérifier l'inventaire du stock à transférer\./i, 'Inventaire'],
  [/Transporter le matériel jusqu'au nouvel atelier\.\.?/i, 'Transporter'],
  [/Installer les postes de travail et le mobilier\./i, 'Installer'],
  [/Préparer le planning des premières productions dans le nouvel atelier\./i, 'Planning'],
  [/Vérifier que tout le matériel est intact et fonctionnel\./i, 'Vérifier']
];
for (const [pattern, label] of contentChecks) {
  if (!pattern.test(slice)) fail('contenu Page 5 absent: ' + label);
}
for (const token of [
  'id="page5Pass"',
  'id="page5Next"',
  '<script src="js/qcm-page5.js"></script>'
]) {
  if (!slice.includes(token)) fail('structure Page 5 absente: ' + token);
}

if (/saveTableAnswers\(5\)/.test(slice)) fail('ancien saveTableAnswers(5) encore lié aux boutons');
if (/const\s+bonnesReponsesPage5\s*=/.test(qcm)) fail('ancien barème Page 5 encore inline');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const SNAPSHOT_KEY = 'page5_organisation_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_page5_state';",
  'const TOTAL = 8;',
  "1:'2', 2:'5', 3:'3', 4:'1'",
  "5:'4', 6:'7', 7:'8', 8:'6'",
  'function evaluate(values)',
  'function persistDraft()',
  'function restoreState()',
  "storedResponses[key] = result.details[i].reponse;",
  "storedScores[key] = result.details[i].correct ? 1 : 0;",
  "sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));",
  "window.sebParcours.goNext('qcm-5')",
  'window.sebQcmPage5 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 5 absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "snapshotStorage:'page5_organisation_data'",
  "responsePrefix:'page5_q'",
  "stateStorage:'seb_evalpro_qcm_page5_state'"
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 5 absent: ' + token);
}

if (!checkpoint.includes("page.id === 'page5' && window.sebQcmPage5")) {
  fail('ancien checkpoint possède encore la reprise Page 5');
}

for (const token of [
  'SEB_PAGE5_RESULTS_RECOVERY',
  'SEB_PAGE51_IMMEDIATE_PERSIST',
  'afficherLigne("Page 5 — Organisation", "page5", 1, 8);'
]) {
  if (!qcm.includes(token)) fail('contrat Résultats/Page 5.1 absent: ' + token);
}

console.log('SEB EvalPro garde QCM Page 5: 8 étapes, barème officiel, reprise, snapshot organisation, Résultats et navigation centrale — OK.');
