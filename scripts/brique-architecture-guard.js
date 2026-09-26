const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function fail(message) {
  console.error('SEB EvalPro garde Brique: ' + message);
  process.exit(2);
}

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) fail('fichier introuvable: ' + rel);
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
}

const html = read('app/web/brique.html');
const page = read('app/web/js/brique-page.js');
const parcours = read('app/web/js/seb-parcours.js');
const qcm = read('app/web/qcmv1.0.html') + '\n' + read('app/web/js/qcm-runtime.js') + '\n' + read('app/web/js/qcm-runtime-ui.js') + '\n' + read('app/web/js/qcm-runtime-tail.js');
const resume = read('app/web/js/seb-page-draft-resume.js');

for (const token of [
  'id="startBtn"',
  'id="stopBtn"',
  'id="temps"',
  'id="nivDiff"',
  'id="secretCode"',
  'id="validBtn"',
  'id="autoEvalPart"',
  'id="autoEvalForm"',
  'id="autoEvalBtn"'
]) {
  if (!html.includes(token)) fail('élément fonctionnel Brique absent: ' + token);
}

for (const value of ['ease_br','difficulties_br','progress_br','motivation_br','stress_br']) {
  if (!html.includes('value="' + value + '"')) fail('valeur autoévaluation Brique absente: ' + value);
  if (!html.includes('for="' + value + '"')) fail('label autoévaluation Brique mal raccordé: ' + value);
}

if (!html.includes('<script src="js/seb-parcours.js"></script>') ||
    !html.includes('<script src="js/brique-page.js"></script>')) {
  fail('scripts modulaires Brique absents');
}
if (html.includes('id="resetBtn"')) fail('ancien bouton Remise à zéro réintroduit');
if (!/<input\s+id="nivDiff"[^>]*\bmin="0"\s+max="10"/.test(html)) fail('zéro erreur Brique non autorisé');
if (!html.includes('type="password" id="secretCode"')) fail('code de validation Brique non masqué');
if (/function\s+(?:updateChrono|checkInputs|clearPageData)\s*\(/.test(html)) {
  fail('ancien moteur Brique inline réintroduit');
}

for (const token of [
  "const DATA_KEY = 'eval_brique';",
  "const AUTO_KEY = 'eval_brique_auto';",
  "const CHECKPOINT_KEY = 'seb_evalpro_brique_checkpoint';",
  'const PERIOD_SECONDS = 1;',
  'function startChrono()',
  'function stopChrono()',
  'function persistCheckpoint(force)',
  'function restoreCheckpoint()',
  'function checkInputs()',
  'function validateMainEvaluation()',
  'function saveAutoEvaluation()',
  'function restoreMainEvaluation()',
  'function restoreAutoEvaluation()',
  'function restoreCanonicalState()',
  'setTimeout(function () {',
  '.map((cb) => cb.value);',
  "sessionStorage.setItem(DATA_KEY, JSON.stringify(data));",
  "sessionStorage.setItem(AUTO_KEY, JSON.stringify(data));",
  "window.sebParcours.goNext('brique')",
  'window.sebBrique = api;'
]) {
  if (!page.includes(token)) fail('contrat Brique modulaire absent: ' + token);
}
if (/stock\.html/i.test(page)) fail('couplage direct Brique -> stock réintroduit');
if (/removeItem\(['"]eval_brique/.test(page)) fail('effacement destructif Brique réintroduit');

const introPos = parcours.indexOf("id:'introbrique'");
const briquePos = parcours.indexOf("id:'brique'");
const stockPos = parcours.indexOf("id:'stock'");
if (introPos < 0 || briquePos <= introPos || stockPos <= briquePos) fail('ordre introbrique -> brique -> stock absent');

for (const token of [
  "storage:'eval_brique'",
  "autoStorage:'eval_brique_auto'",
  "checkpointStorage:'seb_evalpro_brique_checkpoint'"
]) {
  if (!parcours.includes(token)) fail('contrat Résultats Brique absent du registre: ' + token);
}

for (const token of [
  'sessionStorage.getItem("eval_brique")',
  'sessionStorage.getItem("eval_brique_auto")',
  '"ease_br"',
  '"difficulties_br"',
  '"progress_br"',
  '"motivation_br"',
  '"stress_br"'
]) {
  if (!qcm.includes(token)) fail('page Résultats ne récupère plus Brique: ' + token);
}

for (const token of [
  "const structuralContainer = id === 'consigne' || id === 'autoEvalPart';",
  "!structuralContainer && saved.text !== null"
]) {
  if (!resume.includes(token)) fail('protection reprise structurelle Brique absente: ' + token);
}

console.log('SEB EvalPro garde Brique: chrono, code, zéro erreur, reprise, autoévaluation, Résultats et navigation centrale — OK.');
