const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde Planning: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/planning.html');
const page = read('app/web/js/planning-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const resume = read('app/web/js/seb-page-draft-resume.js');
const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');

for (let i = 1; i <= 15; i += 1) {
  if (!html.includes('id="q' + i + '"')) fail('liste Planning absente: q' + i);
}
for (const token of [
  'id="btnValider"',
  'id="btnSuivant"',
  '<script src="js/seb-parcours.js"></script>',
  '<script src="js/planning-page.js"></script>'
]) {
  if (!html.includes(token)) fail('structure Planning absente: ' + token);
}
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail('ancien JavaScript Planning inline réintroduit');
if (/\bSpaghetti\b|\bspaghetti\b/.test(html)) fail('singulier Spaghetti réintroduit dans Planning');

const requiredSolutions = {
  q1:'Lizig👱🏼‍♀️',
  q2:'Katell👩🏻‍🦱',
  q3:'Lizig👱🏼‍♀️',
  q4:'Katell👩🏻‍🦱',
  q5:'Katell👩🏻‍🦱',
  q6:'Assiette de fruits de mer',
  q7:'Spaghettis',
  q8:'Pavé de saumon',
  q9:'Galettes au blé noir',
  q10:'Kig-Ha-Farz',
  q11:'Crème brûlée',
  q12:'Profiteroles',
  q13:'Tarte au citron',
  q14:'Crumble aux fruits rouges',
  q15:'Kouign-Amann'
};
for (const [id, value] of Object.entries(requiredSolutions)) {
  if (!page.includes(id + ":'" + value + "'")) fail('solution Planning absente ou modifiée: ' + id);
}

for (const token of [
  "const SCORE_KEY = 'planningScore';",
  "const CORRECTION_KEY = 'planningCorrection';",
  "const STATE_KEY = 'seb_evalpro_planning_state';",
  "const DONE_KEY = 'seb_planning_validated';",
  "const LEGACY_DRAFT_KEY = 'seb_evalpro_page_draft_planning.html';",
  'const TOTAL = 15;',
  'function anyPlanningEntry(answers)',
  'function correct(user)',
  'function scoreCorrection(correction)',
  'function afficherCorrection(correction)',
  'function persistState(validated)',
  'function restoreState()',
  'function validatePlanning()',
  "window.alert('Commencez l’exercice avant de le valider.",
  "sessionStorage.setItem(SCORE_KEY, String(score));",
  "sessionStorage.setItem(CORRECTION_KEY, JSON.stringify(correction));",
  "sessionStorage.setItem(DONE_KEY, '1');",
  "validate.style.setProperty('display', 'none', 'important');",
  'select.disabled = true;',
  "window.sebParcours.goNext('planning')",
  'window.sebPlanning = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat Planning modulaire absent: ' + token);
}
if (/genrenombres\.html/.test(page)) fail('couplage direct Planning -> genrenombres réintroduit');

for (const token of [
  "if (page === 'planning.html' && window.sebPlanning) return;"
]) {
  if (!resume.includes(token)) fail('double moteur de reprise Planning encore actif: ' + token);
}

const planningPos = parcours.indexOf("id:'planning'");
const genrePos = parcours.indexOf("id:'genrenombres'");
if (planningPos < 0 || genrePos <= planningPos) fail('ordre planning -> genrenombres absent du registre');

for (const token of [
  "scoreStorage:'planningScore'",
  "correctionStorage:'planningCorrection'",
  "stateStorage:'seb_evalpro_planning_state'",
  "validatedStorage:'seb_planning_validated'"
]) {
  if (!parcours.includes(token)) fail('contrat Résultats Planning absent du registre: ' + token);
}

for (const token of [
  'sessionStorage.getItem("planningScore")',
  'sessionStorage.getItem("planningCorrection")'
]) {
  if (!qcm.includes(token)) fail('page Résultats ne récupère plus Planning: ' + token);
}

console.log('SEB EvalPro garde Planning: 15 réponses, barème, Spaghettis, reprise, validation unique, Résultats et navigation centrale — OK.');
