const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde pageFinale: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html');
const page = read('app/web/js/qcm-final-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const preload = read('src/preload.js');

const start = qcm.search(/<div\s+id=["']pageFinale["']/i);
const end = start >= 0 ? qcm.search(/<div\s+id=["']bilanPage["']/i) : -1;
if (start < 0 || end <= start) fail('bloc pageFinale introuvable');
const slice = qcm.slice(start, end);

for (const token of [
  '<div id="pageFinale" class="page">',
  '<h2>Résultats du test</h2>',
  '<div id="resultat"></div>',
  '<script src="js/qcm-final-page.js"></script>'
]) {
  if (!slice.includes(token)) fail('structure pageFinale absente: ' + token);
}

for (const forbidden of [
  'window.print()',
  'savePDF()',
  "nextPage('bilanPage')",
  'goHome()',
  'Enregistrer en PDF',
  '>Imprimer<',
  '>Bilan<',
  '>Accueil<'
]) {
  if (slice.includes(forbidden)) fail('action interdite pageFinale réintroduite: ' + forbidden);
}

for (const token of [
  "const FINAL_PAGE_ID = 'pageFinale';",
  "const RESULT_ID = 'resultat';",
  "const END_MESSAGE_ID = 'seb-candidate-end-message';",
  'function isAdminUnlocked()',
  'function ensureEndMessage()',
  'function syncPageScrollPolicy()',
  'function applyFinalAccess()',
  "result.hidden = !admin;",
  "heading.textContent = admin ? 'Résultats du test' : 'Fin de l’évaluation';",
  "root.classList.toggle('seb-results-page-scroll', resultsVisible);",
  "root.classList.toggle('seb-candidate-no-page-scroll', !resultsVisible);",
  "pageObserver.observe(page, { attributes:true, attributeFilter:['class'] });",
  'window.sebQcmFinal = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module pageFinale absent: ' + token);
}

for (const forbidden of [
  'seb-candidate-results-admin-only',
  'seb-result-scroll-only-script'
]) {
  if (qcm.includes(forbidden)) fail('ancien runtime inline pageFinale encore présent: ' + forbidden);
}

for (const token of [
  'seb-result-scroll-only-style',
  'seb-candidate-no-page-scroll',
  'seb-results-page-scroll',
  'overflow-y: auto !important;'
]) {
  if (!qcm.includes(token)) fail('style final de défilement absent: ' + token);
}

if (parcours.indexOf("id:'qcm-11'") < 0 || parcours.indexOf("id:'qcm-finale'") < 0) {
  fail('étapes finales absentes du registre');
}
if (!parcours.includes("file:'qcmv1.0.html?page=finale#pageFinale'")) {
  fail('destination qcm-finale absente du registre');
}

for (const token of [
  'Revenir à l’écran SEB-éval-PRO',
  "const MODE_FINAL = 'final'",
  'seb-evalpro-final-privacy'
]) {
  if (!preload.includes(token)) fail('protection confidentialité finale absente: ' + token);
}

console.log('SEB EvalPro garde pageFinale: actions candidat retirées, résultats Admin protégés, scroll dédié et confidentialité finale — OK.');
