const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde Stock: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/stock.html');
const page = read('app/web/js/stock-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const resume = read('app/web/js/seb-page-draft-resume.js');
const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');

for (const token of [
  'id="pots-source"',
  'id="zone-tri"',
  'id="stockActionBtn"',
  'class="verify-btn"',
  'data-etagere="1"',
  'data-etagere="2"',
  'data-etagere="3"'
]) {
  if (!html.includes(token)) fail('structure Stock absente: ' + token);
}

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/stock-page.js"></script>')) {
  fail('scripts modulaires Stock absents');
}
if (/onclick=["'][^"']*verifyPlacements/i.test(html)) fail('ancien onclick Vérifier Stock réintroduit');
if (/function\s+(?:verifyPlacements|getCorrectPosition|getDragAfterElement)\s*\(/.test(html)) {
  fail('ancien moteur Stock inline réintroduit');
}

const potDefinitions = Array.from(page.matchAll(/\{ id:(\d+), code:'([^']+)', percentage:(\d+), color:'([^']+)' \}/g));
if (potDefinitions.length !== 34) fail('catalogue Stock différent de 34 flacons: ' + potDefinitions.length);
const ids = new Set(potDefinitions.map((match) => match[1]));
if (ids.size !== 34 || !ids.has('1') || !ids.has('34')) fail('identifiants des 34 flacons Stock incomplets');

for (const token of [
  "const TOTAL_EVALUATED = 33;",
  "const EXAMPLE_ID = '8';",
  "const STATE_KEY = 'seb_evalpro_stock_state';",
  "const LEGACY_DRAFT_KEY = 'seb_evalpro_page_draft_stock.html';",
  "element.dataset.sebExample = 'true';",
  "'Ba-28': Object.freeze([",
  "'Lu-28': Object.freeze([",
  'function restorePositions(items)',
  'function persistState(validated)',
  'function computeScore(mark)',
  'function verifyPlacements()',
  "document.querySelectorAll('.pot:not([data-seb-example=\"true\"])')",
  "sessionStorage.setItem(CORRECT_KEY, String(score.correct));",
  "sessionStorage.setItem(ERROR_KEY, String(score.errors));",
  "sessionStorage.setItem(TOTAL_KEY, String(TOTAL_EVALUATED));",
  "window.sebParcours.goNext('stock')",
  'window.sebStock = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat Stock modulaire absent: ' + token);
}

if (/window\.location\.(?:href|assign|replace)\s*=?.*planning\.html|planning\.html/.test(page)) {
  fail('couplage direct Stock -> planning réintroduit');
}

for (const key of [
  'Ow-37','To-87','Ba-28','Sa-21','Lu-28','Uv-31','Ab-62','Ma-52','Ab-22','Ab-50',
  'Ac-30','Du-70','Kr-60','Qa-89','Ma-29','Ni-55','Pa-47','Qa-12','Gi-55','Ju-27',
  'Gi-12','Ux-31','Lu-18','Fa-90','Lu-53','Ju-20','Et-12','Ju-26','Ma-11','Ne-31','Ni-62'
]) {
  if (!page.includes("'" + key + "'")) fail('placement Stock absent: ' + key);
}

for (const token of [
  "if (page !== 'stock.html' || window.sebStock) return null;",
  "if (page !== 'stock.html' || window.sebStock || !Array.isArray(items)) return;",
  "page === 'stock.html' && !window.sebStock && state.stockValidated"
]) {
  if (!resume.includes(token)) fail('double moteur de reprise Stock encore actif: ' + token);
}

const stockPos = parcours.indexOf("id:'stock'");
const planningPos = parcours.indexOf("id:'planning'");
if (stockPos < 0 || planningPos <= stockPos) fail('ordre stock -> planning absent du registre');
for (const token of [
  "correctStorage:'stockCorrect'",
  "errorStorage:'stockErrors'",
  "totalStorage:'stockTotal'",
  "stateStorage:'seb_evalpro_stock_state'"
]) {
  if (!parcours.includes(token)) fail('contrat Résultats Stock absent du registre: ' + token);
}

for (const token of [
  'sessionStorage.getItem("stockCorrect")',
  'sessionStorage.getItem("stockErrors")',
  'sessionStorage.getItem("stockTotal")'
]) {
  if (!qcm.includes(token)) fail('page Résultats ne récupère plus Stock: ' + token);
}

console.log('SEB EvalPro garde Stock: 34 flacons / 33 évalués, exemple, doublons, erreurs non rangées, reprise, Résultats et navigation centrale — OK.');
