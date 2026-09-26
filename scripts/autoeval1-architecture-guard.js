const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde autoeval1: ' + message);
  process.exit(2);
}
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/autoeval1.html');
const page = read('app/web/js/autoeval1-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');

const protectedText = [
  'Autoévaluation personnelle',
  'À cette étape, prenez un moment pour évaluer votre ressenti et votre progression.',
  'Cochez les affirmations qui correspondent le mieux à votre expérience pendant cette activité.',
  'Je me suis senti(e) à l’aise dans les exercices proposés.',
  'J’ai rencontré des difficultés sur certaines consignes ou calculs.',
  'Je pense avoir progressé dans mes compétences de base.',
  'Cette activité m’a donné envie d’en apprendre davantage.',
  'Je me suis senti(e) stressé(e) ou bloqué(e) à certains moments.',
  'Laissez un commentaire pour préciser votre ressenti :',
  'Écrivez ici votre remarque libre...',
  'Valider mon autoévaluation'
];
for (const token of protectedText) {
  if (!html.includes(token)) fail('contenu validé modifié: ' + token);
}

for (const value of ['ease','difficulties','progress','motivation','stress']) {
  if (!html.includes('value="' + value + '"')) fail('valeur autoévaluation absente: ' + value);
}

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/autoeval1-page.js"></script>')) {
  fail('scripts modulaires autoeval1 absents');
}
if (/onclick=["'][^"']*(?:saveAutoEval1|passerEtapeSuivante)/i.test(html)) {
  fail('ancien gestionnaire autoeval1 inline réintroduit');
}
if (/function\s+(?:saveAutoEval1|passerEtapeSuivante)\s*\(/.test(html)) {
  fail('ancien moteur autoeval1 réintroduit dans HTML');
}

for (const token of [
  "const STORAGE_KEY = 'autoEval1_resultats';",
  "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));",
  "window.sebParcours.goNext('autoeval1')",
  'window.sebAutoEval1 = api;',
  'function restoreEvaluation()',
  'function validateAndNext()'
]) {
  if (!page.includes(token)) fail('contrat autoeval1 absent: ' + token);
}
if (/introbrique\.html/i.test(page)) fail('couplage direct autoeval1 -> introbrique réintroduit');

const autoPos = parcours.indexOf("id:'autoeval1'");
const introPos = parcours.indexOf("id:'introbrique'");
if (autoPos < 0 || introPos <= autoPos) fail('ordre autoeval1 -> introbrique absent');
if (!parcours.includes("storage:'autoEval1_resultats'")) fail('contrat Résultats autoeval1 absent du registre');

for (const token of [
  'sessionStorage.getItem("autoEval1_resultats")',
  '"ease": "Je me suis senti(e) à l\'aise dans les exercices proposés."',
  '"difficulties": "J\'ai rencontré des difficultés sur certaines consignes ou calculs."',
  '"motivation": "Cette activité m\'a donné envie d\'en apprendre davantage."'
]) {
  if (!qcm.includes(token)) fail('page Résultats ne récupère plus autoeval1: ' + token);
}

console.log('SEB EvalPro garde autoeval1: contenu, valeurs, reprise, Résultats et navigation centrale — OK.');
