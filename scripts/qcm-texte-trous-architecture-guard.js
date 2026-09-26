const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde QCM Texte à trous: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');
const page = read('app/web/js/qcm-texte-trous.js');
const parcours = read('app/web/js/seb-parcours.js');
const checkpoint = read('scripts/checkpoint-patch.js');

const start = qcm.indexOf('<div id="pageTexteTrous"');
const end = qcm.indexOf('<div id="page4"', start);
if (start < 0 || end <= start) fail('bloc Texte à trous introuvable');
const slice = qcm.slice(start, end);

const expected = [
  'professionnelle','préparateur de commandes','ai pu','stage','clients',
  'tâches','conseillé','pense','logistique','colis',
  'qualités','sont','organiser','stages','expédition'
];
const actual = Array.from(slice.matchAll(/data-answer="([^"]+)"/g)).map((match) => match[1]);
if (actual.length !== 15) fail('15 réponses attendues, trouvé ' + actual.length);
if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('liste officielle des 15 réponses modifiée');

for (const token of [
  'id="texteTrousPass"',
  'id="texteTrousNext"',
  '<script src="js/qcm-texte-trous.js"></script>'
]) {
  if (!slice.includes(token)) fail('structure Texte à trous modulaire absente: ' + token);
}

if (/saveTextTrous\s*\(/.test(qcm)) fail('ancien moteur saveTextTrous encore présent');

for (const token of [
  "const RESPONSE_STORAGE = 'reponses_data';",
  "const SCORE_STORAGE = 'scores_data';",
  "const STATE_KEY = 'seb_evalpro_qcm_texte_trous_state';",
  "const PAGE_KEY = 'pageTexteTrous';",
  'const TOTAL = 15;',
  'function normalizeAnswer(value)',
  ".replace(/\\u00A0/g, ' ')",
  ".replace(/\\s+/g, ' ')",
  ".toLocaleLowerCase('fr-FR')",
  'function evaluate(values)',
  'function persistDraft()',
  'function restoreState()',
  "storedResponses[PAGE_KEY] = result.responses;",
  "storedScores[PAGE_KEY] = result.score;",
  "window.sebParcours.goNext('qcm-texte-trous')",
  'window.sebQcmTexteTrous = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat module Texte à trous absent: ' + token);
}

for (const token of [
  "responseStorage:'reponses_data'",
  "scoreStorage:'scores_data'",
  "responseKey:'pageTexteTrous'",
  "stateStorage:'seb_evalpro_qcm_texte_trous_state'"
]) {
  if (!parcours.includes(token)) fail('contrat registre Texte à trous absent: ' + token);
}

if (!checkpoint.includes("page.id === 'pageTexteTrous' && window.sebQcmTexteTrous")) {
  fail('ancien moteur de brouillon QCM possède encore Texte à trous');
}

for (const token of [
  "reponses['pageTexteTrous']",
  "scores['pageTexteTrous']",
  'const totalTexteTrous = 15;'
]) {
  if (!qcm.includes(token)) fail('contrat Résultats/Bilan Texte à trous absent: ' + token);
}

console.log('SEB EvalPro garde QCM Texte à trous: 15 réponses, normalisation casse/espaces, accents stricts, reprise, Résultats et navigation centrale — OK.');
