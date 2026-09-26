const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde Dictée: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/dictee.html');
const page = read('app/web/js/dictee-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const runtime = read('app/web/js/seb-ui-runtime.js');
const tri = read('app/web/js/tri-page.js');
const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');

try { new vm.Script(page); } catch (error) { fail('dictee-page.js invalide: ' + error.message); }

for (const token of [
  'id="dicteeAudio"',
  'id="playBtn"',
  'id="pauseBtn"',
  'id="stopBtn"',
  'id="restartBtn"',
  'id="progress"',
  'id="listenCount"',
  'id="status"',
  'id="candidateText"',
  'id="wordCount"',
  'id="feedback"',
  'id="verifyBtn"',
  'id="nextBtn"',
  'id="seb-dictee-stable-style"',
  'dictee-reclamation-client.wav',
  'src="js/seb-ui-runtime.js"',
  'src="js/seb-parcours.js"',
  'src="js/dictee-page.js"'
]) {
  if (!html.includes(token)) fail('structure finale Dictée absente: ' + token);
}

const inlineScripts = (html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/gi) || []).length;
if (inlineScripts !== 0) fail('scripts inline Dictée encore présents: ' + inlineScripts);

for (const forbidden of [
  'seb-dictee-fixed-audio-ui-112',
  'seb-dictee-moved-words-final',
  'seb-dictee-complex-move-v3',
  'seb-dictee-right-actions-final',
  'seb-dictee-stable-runtime',
  'dictee-reclamation-client.ogg',
  'SpeechSynthesisUtterance',
  'speechSynthesis'
]) {
  if (html.includes(forbidden)) fail('ancien mécanisme Dictée encore présent: ' + forbidden);
}

for (const token of [
  '#verifyBtn,#nextBtn,#feedback{display:none!important;visibility:hidden!important;}',
  '#seb-dictee-action{display:inline-flex!important;position:fixed!important;left:50%!important;right:auto!important;bottom:22px!important;transform:translateX(-50%)!important'
]) {
  if (!html.includes(token)) fail('style final Dictée absent: ' + token);
}

for (const token of [
  "const STORAGE_KEY = 'dictee_data';",
  "const AUDIO_FILE = 'dictee-reclamation-client.wav';",
  'const TOTAL_WORDS = 80;',
  'function tokens(text)',
  'function align(referenceTokens, userTokens)',
  'function classifyAlignmentV3(alignment)',
  'function evaluateText(text)',
  'function normalizeVerifiedState()',
  'function syncExternalTerminalState()',
  'function renderCorrection()',
  'function configureFixedAudio()',
  'function startPlayback(fromBeginning)',
  'function lockVerified()',
  'function ensureActionButton()',
  "action.textContent = done ? 'Suivant' : 'Dictée terminée';",
  "sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));",
  'scoreSur20:Math.round(matches * 25) / 100',
  'classificationVersion:3',
  "window.sebParcours.goNext('dictee')",
  'window.sebDictee = Object.freeze({'
]) {
  if (!page.includes(token)) fail('contrat Dictée modulaire absent: ' + token);
}

if (/tri_de_cheville\.html/.test(page)) fail('couplage direct Dictée -> Tri réintroduit');
if (/confirm\s*\(\s*["'][^"']*Abandonner/i.test(page)) fail('ancien abandon direct Dictée réintroduit');

const referenceMatch = page.match(/const REFERENCE = "([^"]+)";/);
if (!referenceMatch) fail('texte de référence Dictée absent');
const referenceWords = (referenceMatch[1].match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*(?:\s*[.,;:!?…]+)?/gu) || []).length;
if (referenceWords !== 80) fail('texte de référence Dictée différent de 80 mots: ' + referenceWords);

const genrePos = parcours.indexOf("id:'genrenombres'");
const dicteePos = parcours.indexOf("id:'dictee'");
const triPos = parcours.indexOf("id:'tri-de-cheville'");
if (genrePos < 0 || dicteePos <= genrePos || triPos <= dicteePos) {
  fail('ordre central Genre/Nombre -> Dictée -> Tri incorrect');
}
if (!parcours.includes("storage:'dictee_data'")) fail('contrat Résultats Dictée absent du registre');

for (const token of [
  "'dictee.html': 'tri_de_cheville.html'",
  "if (context.file === 'dictee.html')",
  "state.status = 'abandoned';",
  'state.scoreSur20 = 0;'
]) {
  if (!runtime.includes(token)) fail('abandon unifié Dictée incomplet: ' + token);
}

for (const token of [
  'function ensureDicteeCompleted()',
  "window.location.replace('dictee.html')"
]) {
  if (!tri.includes(token)) fail('garde Dictée avant Tri absente: ' + token);
}

for (const token of [
  'seb-dictee-complex-results-v3',
  "sessionStorage.getItem('dictee_data')",
  'Déplacements : '
]) {
  if (!qcm.includes(token)) fail('Résultats Dictée v3 absents: ' + token);
}

console.log('SEB EvalPro garde Dictée: 80 mots, WAV Julie, reprise, score ×0,25, déplacements v3, bouton unique, abandon unifié, Résultats et route centrale — OK.');
