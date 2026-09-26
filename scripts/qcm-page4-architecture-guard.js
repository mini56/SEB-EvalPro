const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Page 4: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html');
const page = read('app/web/js/qcm-page4.js');
const parcours = read('app/web/js/seb-parcours.js');
const checkpoint = read('scripts/checkpoint-patch.js');

const start = qcm.indexOf('<div id="page4"');
const end = qcm.indexOf('<div id="page5"', start);
if (start < 0 || end <= start) fail('bloc Page 4 introuvable');
const slice = qcm.slice(start, end);

const fractions = Array.from(slice.matchAll(/data-fraction="([^"]+)"/g)).map((match) => match[1]);
if (JSON.stringify(fractions) !== JSON.stringify(['3/4','1/2','2/8'])) {
  fail('fractions visibles modifiées: ' + JSON.stringify(fractions));
}

const counts = {};
for (const fraction of fractions) {
  const marker = 'data-fraction="' + fraction + '"';
  const pos = slice.indexOf(marker);
  const next = fractions.map((f) => slice.indexOf('data-fraction="' + f + '"', pos + marker.length))
    .filter((n) => n > pos).sort((a,b) => a-b)[0];
  const section = slice.slice(pos, next || slice.length);
  counts[fraction] = (section.match(/class="item"/g) || []).length;
}
if (counts['3/4'] !== 4 || counts['1/2'] !== 6 || counts['2/8'] !== 12) {
  fail('nombre d’images Page 4 modifié: ' + JSON.stringify(counts));
}
if (slice.includes('data-fraction="3/12"')) fail('ancienne fraction 3/12 réintroduite dans la page visible');

for (const token of [
  'id="page4Pass"',
  'id="page4Next"',
  '<script src="js/qcm-page4.js"></script>',
  'data-cloud="true"'
]) {
  if (!slice.includes(token)) fail('structure spéciale Page 4 absente: ' + token);
}

if (slice.includes('id="checkBtn"')) fail('ancien id dupliqué checkBtn encore présent');
if (/function\s+saveFractionsPage4\s*\(/.test(qcm)) fail('ancien moteur fractions inline encore présent');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_page4_state';",
  "const LEGACY_DRAFT_KEY = 'seb_evalpro_qcm_drafts';",
  "const PAGE_KEY = 'page4';",
  'const TOTAL_FRACTIONS = 3;',
  "const CLOUD_FRACTIONS = new Set(['2/8', '3/12']);",
  'const expected = Math.round((numerator / denominator) * total);',
  "item.addEventListener('click'",
  "event.key !== 'Enter' && event.key !== ' '",
  "item.setAttribute('aria-pressed', selected ? 'true' : 'false');",
  'attempts < 400',
  'function nonOverlappingPosition(placed, metrics, margin)',
  'function collectCloudPositions()',
  'function applyCloudPositions(positions)',
  'function persistState(saveCandidate)',
  "storedResponses[PAGE_KEY] = result.score + '/' + result.total;",
  'storedScores[PAGE_KEY] = result.score;',
  "storedResponses['4'] = 'Mauvaise';",
  "storedResponses['4'] = 'Bonne';",
  "window.sebParcours.goNext('qcm-4')",
  'window.sebQcmPage4 = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Page 4 absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "responseKey:'page4'",
  "stateStorage:'seb_evalpro_qcm_page4_state'",
  'totalFractions:3'
]) {
  if (!parcours.includes(token)) fail('contrat registre Page 4 absent: ' + token);
}

if (!checkpoint.includes("page.id === 'page4' && window.sebQcmPage4")) {
  fail('ancien checkpoint possède encore la reprise Page 4');
}

const resultChecks = [
  [/const\s+rep4\s*=\s*reponses\[['"]page4['"]\]\s*\|\|\s*['"]0\/0['"]\s*;/, 'résultat fractions'],
  [/const\s+sc4\s*=\s*scores\[['"]page4['"]\]\s*\|\|\s*0\s*;/, 'score fractions'],
  [/scoreMathsProblemes\s*\+=\s*scoreFractions\s*;/, 'intégration maths problèmes'],
  [/totalMathsProblemes\s*=\s*27\s*;/, 'dénominateur maths problèmes']
];
for (const [pattern, label] of resultChecks) {
  if (!pattern.test(qcm)) fail('contrat Résultats/Maths Page 4 absent: ' + label);
}

if (!qcm.includes('sessionStorage.clear();')) fail('reset nouvelle évaluation ne nettoie plus l’état Page 4');

console.log('SEB EvalPro garde QCM Page 4: 3 fractions, 4/6/12 images, score par quantité, accessibilité, nuage, reprise positions, reset, Résultats et navigation centrale — OK.');
